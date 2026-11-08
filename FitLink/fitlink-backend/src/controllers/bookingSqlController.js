import { sequelize } from '~/config/sql.js'
import PTProfile from '~/models/sql/PTProfile.js'
import StudentPackage from '~/models/sql/StudentPackage.js'
import Package from '~/models/sql/Package.js'
import Booking from '~/models/sql/Booking.js'
import Slot from '~/models/sql/Slot.js'
import Transaction from '~/models/sql/Transaction.js'
import User from '~/models/sql/User.js'
import Notification from '~/models/sql/Notification.js'
import { Op } from 'sequelize'
import { acquireScheduleLock } from '../services/bookingSchedule.js'

const json = (value, fallback) => { try { return value ? JSON.parse(value) : fallback } catch { return fallback } }
const toMin = (value) => { const [hour, minute] = String(value).split(':').map(Number); return hour * 60 + minute }
const toTime = (minutes) => `${String(Math.floor(minutes / 60)).padStart(2, '0')}:${String(minutes % 60).padStart(2, '0')}`
const patternKey = (pattern) => [...pattern].sort((a, b) => a - b).join('-')
const slotKey = (slot) => `${slot.start}-${slot.end}`
const vietnamTime = (date) => {
  const parts = new Intl.DateTimeFormat('en-US', { timeZone: 'Asia/Ho_Chi_Minh', weekday: 'short', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).formatToParts(date)
  const get = type => parts.find(part => part.type === type)?.value
  return { day: ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].indexOf(get('weekday')), minute: Number(get('hour')) * 60 + Number(get('minute')) }
}

const expireStaleBookings = async () => {
  const stale = await Booking.findAll({ where: { status: { [Op.in]: ['PENDING_APPROVAL', 'PENDING_PAYMENT'] }, expiresAt: { [Op.lte]: new Date() } }, attributes: ['id', 'ptId'] })
  for (const item of stale) {
    const tx = await sequelize.transaction()
    try {
      await acquireScheduleLock(item.ptId, tx)
      const booking = await Booking.findByPk(item.id, { transaction: tx, lock: tx.LOCK.UPDATE })
      if (!booking || !['PENDING_APPROVAL', 'PENDING_PAYMENT'].includes(booking.status) || !booking.expiresAt || new Date(booking.expiresAt) > new Date()) { await tx.commit(); continue }
      const payment = await Transaction.findOne({ where: { bookingId: booking.id }, transaction: tx, lock: tx.LOCK.UPDATE })
      if (payment && !['initiated', 'cancelled'].includes(payment.status)) { await tx.commit(); continue }
      await booking.update({ status: 'EXPIRED' }, { transaction: tx })
      if (payment?.status === 'initiated') await payment.update({ status: 'cancelled' }, { transaction: tx })
      await Slot.update({ status: 'OPEN', bookedByBookingId: null, expiresAt: null }, { where: { bookedByBookingId: booking.id, status: 'BOOKED' }, transaction: tx })
      await tx.commit()
    } catch (error) { if (!tx.finished) await tx.rollback(); throw error }
  }
}

export const getBlocksSimple = async (req, res) => {
  try {
    const pattern = String(req.query.pattern || '').split(',').map(Number).filter(Number.isInteger)
    const [profile, pkg] = await Promise.all([PTProfile.findOne({ where: { userId: req.params.ptId } }), Package.findByPk(req.query.packageId)])
    if (!profile || !pkg || !pattern.length || String(pkg.ptId) !== String(req.params.ptId) || !pkg.isActive || pkg.visibility !== 'public') return res.status(400).json({ error: 'PT, package or pattern is not available' })
    const allowed = json(pkg.recurrence, {})?.daysOfWeek || []
    if (!allowed.some(days => Array.isArray(days) && patternKey(days) === patternKey(pattern))) return res.status(400).json({ error: 'Pattern is not offered by this package' })
    const hours = json(profile.workingHours, [])
    const duration = pkg.sessionDurationMin || 60; const step = duration + (profile.defaultBreakMin || 0)
    const candidatesByDay = pattern.map(dayOfWeek => {
      const workday = hours.find(item => Number(item.dayOfWeek) === dayOfWeek)
      return (workday?.intervals || []).flatMap(interval => {
        const out = []
        for (let at = toMin(interval.start); at + duration <= toMin(interval.end); at += step) out.push({ start: toTime(at), end: toTime(at + duration) })
        return out
      })
    })
    const candidates = (candidatesByDay[0] || []).filter(item => candidatesByDay.every(day => day.some(candidate => slotKey(candidate) === slotKey(item))))
    const packages = await StudentPackage.findAll({ where: { ptId: req.params.ptId, packageId: pkg.id, patternKey: patternKey(pattern), status: 'active' }, attributes: ['slotKey'] })
    const used = new Set(packages.map((item) => item.slotKey))
    const now = new Date()
    const reserved = await Slot.findAll({ where: { ptId: req.params.ptId, status: { [Op.ne]: 'OPEN' }, startTime: { [Op.gt]: now }, [Op.or]: [{ expiresAt: null }, { expiresAt: { [Op.gt]: now } }] } })
    return res.json({ pattern, sessionDurationMin: duration, breakMin: profile.defaultBreakMin || 0, blocks: candidates.map((item) => {
      const start = toMin(item.start); const end = toMin(item.end)
      const taken = used.has(slotKey(item)) || reserved.some(slot => {
        const slotStart = vietnamTime(new Date(slot.startTime)); const slotEnd = vietnamTime(new Date(slot.endTime))
        return pattern.includes(slotStart.day) && slotStart.minute < end && slotEnd.minute > start
      })
      return taken ? { ...item, ok: false, reason: 'taken_by_booking' } : { ...item, ok: true }
    }) })
  } catch (error) { return res.status(400).json({ error: error.message }) }
}

export const listBookings = async (req, res) => {
  try {
    await expireStaleBookings()
    const where = req.user.role === 'student' ? { studentId: req.user._id } : req.user.role === 'pt' ? { ptId: req.user._id } : {}
    if (req.user.role === 'admin') {
      if (req.query.ptId) where.ptId = req.query.ptId
      if (req.query.studentId) where.studentId = req.query.studentId
    }
    if (req.query.status) where.status = String(req.query.status).toUpperCase()
    if (req.query.from || req.query.to) {
      where.createdAt = {}
      if (req.query.from) where.createdAt[Op.gte] = new Date(`${req.query.from}T00:00:00.000Z`)
      if (req.query.to) where.createdAt[Op.lte] = new Date(`${req.query.to}T23:59:59.999Z`)
      if (Object.values(where.createdAt).some(value => !Number.isFinite(value.getTime()))) return res.status(400).json({ success: false, message: 'Khoảng ngày lọc không hợp lệ.' })
    }
    const search = String(req.query.search || '').trim()
    if (search) {
      const clauses = [{ notes: { [Op.like]: `%${search}%` } }]
      if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(search)) clauses.push({ id: search })
      where[Op.or] = clauses
    }
    const bookings = await Booking.findAll({ where, order: [['createdAt', 'DESC']] })
    const transactions = bookings.length ? await Transaction.findAll({ where: { bookingId: bookings.map(row => row.id) }, attributes: ['id', 'bookingId', 'status'] }) : []
    const transactionByBooking = new Map(transactions.map(row => [String(row.bookingId), row]))
    const students = bookings.length ? await User.findAll({ where: { id: [...new Set(bookings.map(row => row.studentId))] }, attributes: ['id', 'name', 'email'] }) : []
    const pts = req.user.role === 'admin' && bookings.length ? await User.findAll({ where: { id: [...new Set(bookings.map(row => row.ptId))] }, attributes: ['id', 'name', 'email'] }) : []
    const studentById = new Map(students.map(row => [String(row.id), row]))
    const ptById = new Map(pts.map(row => [String(row.id), row]))
    return res.json({ success: true, data: bookings.map(row => ({ ...row.toJSON(), student: studentById.get(String(row.studentId)) || null, pt: ptById.get(String(row.ptId)) || null, transactionStatus: transactionByBooking.get(String(row.id))?.status || null })) })
  } catch (error) { return res.status(500).json({ success: false, message: error.message }) }
}

export const approveBooking = async (req, res) => {
  const tx = await sequelize.transaction()
  try {
    await acquireScheduleLock(req.user._id, tx)
    const booking = await Booking.findOne({ where: { id: req.params.bookingId, ptId: req.user._id }, transaction: tx, lock: tx.LOCK.UPDATE })
    if (!booking) { await tx.rollback(); return res.status(404).json({ success: false, message: 'Không tìm thấy yêu cầu đặt lịch.' }) }
    if (booking.status !== 'PENDING_APPROVAL' || (booking.expiresAt && new Date(booking.expiresAt) <= new Date())) {
      await tx.rollback(); return res.status(409).json({ success: false, message: 'Yêu cầu đã hết hạn hoặc không còn chờ duyệt.' })
    }
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000)
    await booking.update({ status: 'PENDING_PAYMENT', expiresAt }, { transaction: tx })
    await Slot.update({ expiresAt }, { where: { bookedByBookingId: booking.id, status: 'BOOKED' }, transaction: tx })
    const notification = await Notification.create({ userId: booking.studentId, type: 'booking', title: 'PT đã duyệt lịch', message: 'PT đã duyệt yêu cầu. Bạn có thể tiếp tục thanh toán.', meta: JSON.stringify({ bookingId: booking.id, transactionId: booking.transactionId }) }, { transaction: tx })
    await tx.commit()
    try { global.sendNotificationToUser?.(booking.studentId, notification) } catch {}
    return res.json({ success: true, data: { bookingId: booking.id, transactionId: booking.transactionId, status: 'PENDING_PAYMENT', expiresAt } })
  } catch (error) { if (!tx.finished) await tx.rollback(); return res.status(500).json({ success: false, message: error.message }) }
}

export const rejectBooking = async (req, res) => {
  const tx = await sequelize.transaction()
  try {
    await acquireScheduleLock(req.user._id, tx)
    const booking = await Booking.findOne({ where: { id: req.params.bookingId, ptId: req.user._id }, transaction: tx, lock: tx.LOCK.UPDATE })
    if (!booking) { await tx.rollback(); return res.status(404).json({ success: false, message: 'Không tìm thấy yêu cầu đặt lịch.' }) }
    if (booking.status !== 'PENDING_APPROVAL') { await tx.rollback(); return res.status(409).json({ success: false, message: 'Chỉ có thể từ chối yêu cầu đang chờ duyệt.' }) }
    await booking.update({ status: 'REJECTED' }, { transaction: tx })
    await Transaction.update({ status: 'cancelled' }, { where: { bookingId: booking.id, status: 'initiated' }, transaction: tx })
    await Slot.update({ status: 'OPEN', bookedByBookingId: null, expiresAt: null }, { where: { bookedByBookingId: booking.id, status: 'BOOKED' }, transaction: tx })
    const notification = await Notification.create({ userId: booking.studentId, type: 'booking', title: 'PT đã từ chối lịch', message: 'PT không thể nhận yêu cầu đặt lịch này. Khung giờ đã được giải phóng.', meta: JSON.stringify({ bookingId: booking.id }) }, { transaction: tx })
    await tx.commit()
    try { global.sendNotificationToUser?.(booking.studentId, notification) } catch {}
    return res.json({ success: true, data: { bookingId: booking.id, status: 'REJECTED' } })
  } catch (error) { if (!tx.finished) await tx.rollback(); return res.status(500).json({ success: false, message: error.message }) }
}

export const cancelMyBooking = async (req, res) => {
  let tx
  try {
    const ownedBooking = await Booking.findOne({ where: { id: req.params.bookingId, studentId: req.user._id } })
    if (!ownedBooking) return res.status(404).json({ success: false, message: 'Không tìm thấy booking.' })
    tx = await sequelize.transaction()
    await acquireScheduleLock(ownedBooking.ptId, tx)
    const booking = await Booking.findOne({ where: { id: req.params.bookingId, studentId: req.user._id }, transaction: tx, lock: tx.LOCK.UPDATE })
    if (!booking) { await tx.rollback(); return res.status(404).json({ success: false, message: 'Không tìm thấy booking.' }) }
    if (!['PENDING_APPROVAL', 'PENDING_PAYMENT'].includes(booking.status)) { await tx.rollback(); return res.status(409).json({ success: false, message: 'Booking không còn ở trạng thái có thể hủy.' }) }
    const transaction = await Transaction.findOne({ where: { bookingId: booking.id }, transaction: tx, lock: tx.LOCK.UPDATE })
    if (transaction && !['initiated', 'cancelled'].includes(transaction.status)) {
      await tx.rollback(); return res.status(409).json({ success: false, message: 'Giao dịch đã được khởi tạo thanh toán nên không thể hủy booking tại đây.' })
    }
    await booking.update({ status: 'CANCELLED' }, { transaction: tx })
    if (transaction?.status === 'initiated') await transaction.update({ status: 'cancelled' }, { transaction: tx })
    await Slot.update({ status: 'OPEN', bookedByBookingId: null, expiresAt: null }, { where: { bookedByBookingId: booking.id, status: 'BOOKED' }, transaction: tx })
    const notification = await Notification.create({ userId: booking.ptId, type: 'booking', title: 'Học viên đã hủy yêu cầu', message: 'Học viên đã hủy yêu cầu đặt lịch.', meta: JSON.stringify({ bookingId: booking.id }) }, { transaction: tx })
    await tx.commit()
    try { global.sendNotificationToUser?.(booking.ptId, notification) } catch {}
    return res.json({ success: true, data: { bookingId: booking.id, status: 'CANCELLED' } })
  } catch (error) { if (tx && !tx.finished) await tx.rollback(); return res.status(500).json({ success: false, message: error.message }) }
}
