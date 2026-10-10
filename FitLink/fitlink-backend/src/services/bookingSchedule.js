import { Op } from 'sequelize'
import Slot from '../models/sql/Slot.js'
import Session from '../models/sql/Session.js'

const parse = value => typeof value === 'string' ? JSON.parse(value) : value

export const buildBookingSchedule = ({ pattern, slot, startDate, totalSessions, sessionDurationMin }) => {
  const days = parse(pattern)
  const time = parse(slot)
  const total = Number(totalSessions)
  const duration = Number(sessionDurationMin)
  if (!Array.isArray(days) || !days.length || days.some(day => !Number.isInteger(day) || day < 0 || day > 6)) throw new Error('Invalid booking weekdays')
  if (!Number.isInteger(total) || total < 1 || total > 1000 || !Number.isInteger(duration) || duration < 1 || duration > 1440) throw new Error('Invalid session count or duration')
  if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(time?.start)) throw new Error('Invalid booking time')
  const date = new Date(startDate)
  if (!Number.isFinite(date.getTime())) throw new Error('Invalid booking start date')
  const day = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Ho_Chi_Minh', year: 'numeric', month: '2-digit', day: '2-digit' }).format(date)
  const cursor = new Date(`${day}T00:00:00Z`)
  const items = []
  // Bounded iteration avoids hanging the server on an invalid weekday pattern.
  for (let i = 0; i < total * 7 && items.length < total; i++) {
    if (days.includes(cursor.getUTCDay())) {
      const startTime = new Date(`${cursor.toISOString().slice(0, 10)}T${time.start}:00+07:00`)
      items.push({ startTime, endTime: new Date(startTime.getTime() + duration * 60000) })
    }
    cursor.setUTCDate(cursor.getUTCDate() + 1)
  }
  return items
}

// The caller owns the SQL transaction: payment, enrollment, schedule and wallet
// either commit together or roll back together. Reruns reuse the same slots.
export const createSlotsAndSessionsForBooking = async (booking, studentPackage, pkg, transaction) => {
  const items = buildBookingSchedule({ pattern: booking.pattern, slot: booking.slot, startDate: booking.startDate, totalSessions: studentPackage.totalSessions, sessionDurationMin: pkg.sessionDurationMin })
  let createdSlots = 0
  let createdSessions = 0
  const sessionIds = []
  for (const item of items) {
    let slot = await Slot.findOne({ where: { ptId: booking.ptId, startTime: item.startTime }, transaction })
    if (slot && String(slot.bookedByBookingId).toLowerCase() !== String(booking.id).toLowerCase()) throw new Error('PT slot is already reserved')
    const conflict = await Session.findOne({ where: {
      ptId: booking.ptId, studentPackageId: { [Op.ne]: studentPackage.id },
      startTime: { [Op.lt]: item.endTime }, endTime: { [Op.gt]: item.startTime }, status: { [Op.ne]: 'cancelled' }
    }, transaction })
    if (conflict) throw new Error('PT has an overlapping session')
    if (!slot) {
      slot = await Slot.create({ ...item, ptId: booking.ptId, packageId: pkg.id, seriesId: booking.id, kind: 'recurring', status: 'BOOKED', bookedByBookingId: booking.id }, { transaction })
      createdSlots++
    }
    let session = await Session.findOne({ where: { slotId: slot.id, studentPackageId: studentPackage.id }, transaction })
    if (!session) {
      session = await Session.create({ ...item, slotId: slot.id, studentPackageId: studentPackage.id, ptId: booking.ptId, studentId: booking.studentId, title: pkg.name, status: 'scheduled' }, { transaction })
      createdSessions++
    }
    sessionIds.push(session.id)
  }
  await studentPackage.update({ sessions: JSON.stringify(sessionIds) }, { transaction })
  return { createdSlots, createdSessions }
}
