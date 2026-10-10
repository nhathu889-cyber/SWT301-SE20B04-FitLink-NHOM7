import { sequelize } from '~/config/sql.js'
import PTProfile from '~/models/sql/PTProfile.js'
import StudentPackage from '~/models/sql/StudentPackage.js'
import Package from '~/models/sql/Package.js'
import Booking from '~/models/sql/Booking.js'
import Slot from '~/models/sql/Slot.js'
import { buildBookingSchedule } from '../services/bookingSchedule.js'

const json = (value, fallback) => { try { return value ? JSON.parse(value) : fallback } catch { return fallback } }
const toMin = (value) => { const [hour, minute] = String(value).split(':').map(Number); return hour * 60 + minute }
const toTime = (minutes) => `${String(Math.floor(minutes / 60)).padStart(2, '0')}:${String(minutes % 60).padStart(2, '0')}`
const patternKey = (pattern) => [...pattern].sort((a, b) => a - b).join('-')
const slotKey = (slot) => `${slot.start}-${slot.end}`

export const getBlocksSimple = async (req, res) => {
  try {
    const pattern = String(req.query.pattern || '').split(',').map(Number).filter(Number.isInteger)
    const [profile, pkg] = await Promise.all([PTProfile.findOne({ where: { userId: req.params.ptId } }), Package.findByPk(req.query.packageId)])
    if (!profile || !pkg || !pattern.length) return res.status(400).json({ error: 'ptId, packageId, pattern required' })
    const hours = json(profile.workingHours, []); const workday = hours.find((day) => day.dayOfWeek === pattern[0])
    const duration = pkg.sessionDurationMin || 60; const step = duration + (profile.defaultBreakMin || 0)
    const candidates = (workday?.intervals || []).flatMap((interval) => { const out = []; for (let at = toMin(interval.start); at + duration <= toMin(interval.end); at += step) out.push({ start: toTime(at), end: toTime(at + duration) }); return out })
    const packages = await StudentPackage.findAll({ where: { ptId: req.params.ptId, packageId: pkg.id, patternKey: patternKey(pattern), status: 'active' }, attributes: ['slotKey'] })
    const used = new Set(packages.map((item) => item.slotKey))
    return res.json({ pattern, sessionDurationMin: duration, breakMin: profile.defaultBreakMin || 0, blocks: candidates.map((item) => used.has(slotKey(item)) ? { ...item, ok: false, reason: 'taken_by_student_package' } : { ...item, ok: true }) })
  } catch (error) { return res.status(400).json({ error: error.message }) }
}

export const createBookingAndGenerateSlots = async (req, res) => {
  const tx = await sequelize.transaction()
  try {
    const body = req.body; const studentId = req.user?._id; const packageId = body.package || body.packageId
    if (!studentId || !body.pt || !packageId || !body.startDate || !Array.isArray(body.pattern) || !body.slot?.start) throw new Error('Missing booking schedule data')
    const pkg = await Package.findOne({ where: { id: packageId, ptId: body.pt, isActive: true }, transaction: tx })
    if (!pkg) throw new Error('Package not found')
    const schedule = buildBookingSchedule({ pattern: body.pattern, slot: body.slot, startDate: body.startDate, totalSessions: pkg.totalSessions, sessionDurationMin: pkg.sessionDurationMin })
    const booking = await Booking.create({ studentId, ptId: body.pt, packageId, pattern: JSON.stringify(body.pattern), slot: JSON.stringify(body.slot), patternKey: patternKey(body.pattern), slotKey: slotKey(body.slot), startDate: new Date(body.startDate), mode: body.mode, clientAddress: body.clientAddress ? JSON.stringify(body.clientAddress) : null, ptGymAddress: body.ptGymAddress ? JSON.stringify(body.ptGymAddress) : null, otherGymAddress: body.otherGymAddress ? JSON.stringify(body.otherGymAddress) : null, travelPolicy: JSON.stringify(body.travelPolicy || {}), travelDistanceKm: body.travelDistanceKm || 0, travelFee: body.travelFee || 0, inRange: body.inRange ?? true, exceededByKm: body.exceededByKm || 0, packageSnapshot: JSON.stringify(body.packageSnapshot || {}), pricing: JSON.stringify(body.pricing || {}), amount: body.amount ?? body.pricing?.total ?? 0, currency: body.currency || 'VND', status: body.status || 'PENDING_PAYMENT', expiresAt: body.expiresAt ? new Date(body.expiresAt) : null, notes: body.notes || null }, { transaction: tx })
    const slots = schedule.map(item => ({ ...item, ptId: body.pt, packageId, seriesId: `${booking.id}:${patternKey(body.pattern)}`, kind: 'recurring', status: 'BOOKED', capacity: 1, bookedByBookingId: booking.id, expiresAt: new Date(item.endTime.getTime() + 3600000) }))
    const createdSlots = slots.length ? await Slot.bulkCreate(slots, { transaction: tx }) : []
    await tx.commit()
    return res.json({ ok: true, bookingId: booking.id, createdSlots: createdSlots.length, createdSessions: 0, items: createdSlots.map((item, index) => ({ index: index + 1, startTime: item.startTime.toISOString(), endTime: item.endTime.toISOString(), slotId: item.id })) })
  } catch (error) { await tx.rollback(); return res.status(400).json({ ok: false, error: error.message || 'create_failed' }) }
}
