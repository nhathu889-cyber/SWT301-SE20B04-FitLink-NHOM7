import { Op } from 'sequelize'
import { sequelize } from '../config/sql.js'
import Session from '../models/sql/Session.js'
import Slot from '../models/sql/Slot.js'
import PTProfile from '../models/sql/PTProfile.js'
import { acquireScheduleLock } from './bookingSchedule.js'

const parse = value => { try { return typeof value === 'string' ? JSON.parse(value || '[]') : value } catch { return [] } }
const localParts = date => {
  const parts = new Intl.DateTimeFormat('en-US', { timeZone: 'Asia/Ho_Chi_Minh', weekday: 'short', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).formatToParts(date)
  const get = type => parts.find(part => part.type === type)?.value
  return { day: ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].indexOf(get('weekday')), minute: Number(get('hour')) * 60 + Number(get('minute')) }
}

export const movePTSession = async ({ sessionId, ptId, startTime, endTime }) => {
  const start = new Date(startTime); const end = new Date(endTime)
  if (!Number.isFinite(start.getTime()) || !Number.isFinite(end.getTime()) || start <= new Date() || end <= start) {
    const error = new Error('Thời gian buổi tập không hợp lệ hoặc đã qua.')
    error.statusCode = 400
    throw error
  }
  const tx = await sequelize.transaction()
  try {
    await acquireScheduleLock(ptId, tx)
    const session = await Session.findOne({ where: { id: sessionId, ptId }, transaction: tx, lock: tx.LOCK.UPDATE })
    if (!session) { const error = new Error('Không tìm thấy buổi tập trong lịch của PT này.'); error.statusCode = 404; throw error }
    if (session.status !== 'scheduled') { const error = new Error('Chỉ có thể đổi giờ buổi tập đang được lên lịch.'); error.statusCode = 409; throw error }
    if (end.getTime() - start.getTime() !== new Date(session.endTime).getTime() - new Date(session.startTime).getTime()) {
      const error = new Error('Độ dài buổi tập phải được giữ nguyên.'); error.statusCode = 400; throw error
    }

    const profile = await PTProfile.findOne({ where: { userId: ptId }, transaction: tx })
    const localStart = localParts(start); const localEnd = localParts(end)
    const hours = parse(profile?.workingHours)
    const breakMin = Math.max(0, Number(profile?.defaultBreakMin) || 0)
    const duration = (end.getTime() - start.getTime()) / 60000
    const inWorkingHours = localStart.day === localEnd.day && hours.some(day => Number(day.dayOfWeek) === localStart.day && (day.intervals || []).some(interval => {
      const [sh, sm] = String(interval.start).split(':').map(Number)
      const [eh, em] = String(interval.end).split(':').map(Number)
      const intervalStart = sh * 60 + sm; const intervalEnd = eh * 60 + em
      return localStart.minute >= intervalStart && localStart.minute + duration <= intervalEnd && (localStart.minute - intervalStart) % (duration + breakMin) === 0
    }))
    if (!inWorkingHours) { const error = new Error('Thời gian mới nằm ngoài lịch làm việc của PT.'); error.statusCode = 400; throw error }

    const collision = await Session.findOne({ where: { ptId, id: { [Op.ne]: session.id }, status: { [Op.notIn]: ['cancelled', 'missed'] }, startTime: { [Op.lt]: end }, endTime: { [Op.gt]: start } }, transaction: tx })
    if (collision) { const error = new Error('Khung giờ mới bị trùng với buổi tập khác.'); error.statusCode = 409; throw error }

    const oldSlot = session.slotId ? await Slot.findByPk(session.slotId, { transaction: tx, lock: tx.LOCK.UPDATE }) : null
    const sameSlot = oldSlot && new Date(oldSlot.startTime).getTime() === start.getTime() && new Date(oldSlot.endTime).getTime() === end.getTime()
    let targetSlot = sameSlot ? oldSlot : await Slot.findOne({ where: { ptId, startTime: start }, transaction: tx, lock: tx.LOCK.UPDATE })
    if (targetSlot && targetSlot.id !== oldSlot?.id && targetSlot.status !== 'OPEN') { const error = new Error('Khung giờ mới đã được giữ.'); error.statusCode = 409; throw error }
    const otherSlots = await Slot.findAll({ where: { ptId, id: { [Op.ne]: targetSlot?.id || oldSlot?.id || '00000000-0000-0000-0000-000000000000' }, startTime: { [Op.lt]: end }, endTime: { [Op.gt]: start }, status: { [Op.ne]: 'OPEN' } }, transaction: tx })
    if (otherSlots.length) { const error = new Error('Khung giờ mới đã được giữ.'); error.statusCode = 409; throw error }

    if (!sameSlot) {
      if (!targetSlot) targetSlot = await Slot.create({ ptId, packageId: oldSlot?.packageId || null, seriesId: oldSlot?.seriesId || `session:${session.id}`, kind: 'recurring', status: 'BOOKED', startTime: start, endTime: end, modes: oldSlot?.modes || '{}', capacity: 1, bookedByBookingId: oldSlot?.bookedByBookingId || null, expiresAt: null }, { transaction: tx })
      else await targetSlot.update({ status: 'BOOKED', startTime: start, endTime: end, bookedByBookingId: oldSlot?.bookedByBookingId || null, expiresAt: null }, { transaction: tx })
      await session.update({ startTime: start, endTime: end, slotId: targetSlot.id }, { transaction: tx })
      if (oldSlot && oldSlot.id !== targetSlot.id) {
        const otherSessionCount = await Session.count({ where: { slotId: oldSlot.id, id: { [Op.ne]: session.id }, status: { [Op.notIn]: ['cancelled', 'missed'] } }, transaction: tx })
        if (!otherSessionCount) await oldSlot.update({ status: 'OPEN', bookedByBookingId: null, expiresAt: null }, { transaction: tx })
      }
    }
    await tx.commit()
    return session
  } catch (error) {
    if (!tx.finished) await tx.rollback()
    throw error
  }
}
