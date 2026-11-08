import { Op } from 'sequelize'
import Slot from '../models/sql/Slot.js'
import Session from '../models/sql/Session.js'
import Booking from '../models/sql/Booking.js'
import { sequelize } from '../config/sql.js'

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

const parseJson = (value, fallback) => {
  try { return typeof value === 'string' ? JSON.parse(value || '') : (value ?? fallback) } catch { return fallback }
}
const minutes = value => {
  if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(String(value || ''))) return NaN
  const [hour, minute] = value.split(':').map(Number)
  return hour * 60 + minute
}
const normalizedDays = days => [...new Set(days.map(Number))].sort((a, b) => a - b)

export const validateBookingSelection = ({ ptProfile, pkg, pattern, slot, startDate, mode }) => {
  if (!ptProfile) throw new Error('PT không có hồ sơ lịch làm việc.')
  const recurrence = parseJson(pkg.recurrence, {})
  const availablePatterns = Array.isArray(recurrence.daysOfWeek) ? recurrence.daysOfWeek : []
  if (!Array.isArray(pattern) || !pattern.length || pattern.some(day => !Number.isInteger(Number(day)) || Number(day) < 0 || Number(day) > 6)) {
    throw new Error('Ngày tập không hợp lệ.')
  }
  const requestedPattern = normalizedDays(pattern)
  if (!availablePatterns.some(days => Array.isArray(days) && JSON.stringify(normalizedDays(days)) === JSON.stringify(requestedPattern))) {
    throw new Error('Lịch tập không thuộc các ngày PT mở cho gói này.')
  }
  const startMinute = minutes(slot?.start)
  const endMinute = minutes(slot?.end)
  const duration = Number(pkg.sessionDurationMin)
  if (!Number.isFinite(startMinute) || !Number.isFinite(endMinute) || endMinute <= startMinute || endMinute - startMinute !== duration) {
    throw new Error('Khung giờ không khớp thời lượng của gói tập.')
  }
  const supports = parseJson(pkg.supports, {})
  const deliveryModes = parseJson(ptProfile.deliveryModes, {})
  if (!mode || !supports[mode] || !deliveryModes[mode]) throw new Error('PT hoặc gói tập không hỗ trợ địa điểm đã chọn.')

  const workingHours = parseJson(ptProfile.workingHours, [])
  const breakMin = Math.max(0, Number(ptProfile.defaultBreakMin) || 0)
  for (const dayOfWeek of requestedPattern) {
    const day = workingHours.find(item => Number(item.dayOfWeek) === dayOfWeek)
    const available = (day?.intervals || []).some(interval => {
      const intervalStart = minutes(interval.start)
      const intervalEnd = minutes(interval.end)
      const step = duration + breakMin
      return Number.isFinite(intervalStart) && Number.isFinite(intervalEnd) && startMinute >= intervalStart && endMinute <= intervalEnd && (startMinute - intervalStart) % step === 0
    })
    if (!available) throw new Error(`PT không có lịch làm việc vào ${['Chủ nhật', 'Thứ 2', 'Thứ 3', 'Thứ 4', 'Thứ 5', 'Thứ 6', 'Thứ 7'][dayOfWeek]} trong khung giờ này.`)
  }
  const occurrences = buildBookingSchedule({ pattern: requestedPattern, slot, startDate, totalSessions: pkg.totalSessions, sessionDurationMin: duration })
  if (!occurrences.length || occurrences[0].startTime <= new Date()) throw new Error('Ngày bắt đầu phải nằm trong tương lai.')
  return occurrences
}

export const acquireScheduleLock = async (ptId, transaction) => {
  await sequelize.query(
    "DECLARE @result int; EXEC @result = sp_getapplock @Resource = :resource, @LockMode = 'Exclusive', @LockOwner = 'Transaction', @LockTimeout = 10000; IF @result < 0 THROW 51000, 'Could not lock PT schedule', 1;",
    { replacements: { resource: `fitlink-pt-schedule-${ptId}` }, transaction }
  )
}

export const reserveBookingSlots = async ({ booking, pkg, occurrences, expiresAt, transaction }) => {
  await acquireScheduleLock(booking.ptId, transaction)
  const now = new Date()
  for (const occurrence of occurrences) {
    const overlappingSlots = await Slot.findAll({
      where: { ptId: booking.ptId, startTime: { [Op.lt]: occurrence.endTime }, endTime: { [Op.gt]: occurrence.startTime } },
      transaction,
    })
    let reusableOpenSlot = null
    for (const slot of overlappingSlots) {
      if (String(slot.bookedByBookingId || '').toLowerCase() === String(booking.id).toLowerCase()) continue
      if (slot.status === 'OPEN' && new Date(slot.startTime).getTime() === occurrence.startTime.getTime() && new Date(slot.endTime).getTime() === occurrence.endTime.getTime()) {
        reusableOpenSlot = slot
        continue
      }
      if (slot.status === 'OPEN' && new Date(slot.startTime).getTime() === occurrence.startTime.getTime()) {
        const error = new Error('PT đang có slot mở với thời lượng khác. Vui lòng chọn khung giờ khác.')
        error.statusCode = 409
        throw error
      }
      if (slot.status === 'OPEN') continue
      if (slot.status === 'BOOKED' && slot.bookedByBookingId) {
        const previousBooking = await Booking.findByPk(slot.bookedByBookingId, { transaction })
        const expiredHold = previousBooking && ['PENDING_APPROVAL', 'PENDING_PAYMENT', 'CANCELLED', 'EXPIRED', 'REJECTED'].includes(previousBooking.status) && previousBooking.expiresAt && new Date(previousBooking.expiresAt) <= now
        const terminal = previousBooking && ['CANCELLED', 'EXPIRED', 'REJECTED'].includes(previousBooking.status)
        if (expiredHold || terminal) {
          await slot.update({ status: 'OPEN', bookedByBookingId: null, expiresAt: null }, { transaction })
          const sameStart = new Date(slot.startTime).getTime() === occurrence.startTime.getTime()
          const sameEnd = new Date(slot.endTime).getTime() === occurrence.endTime.getTime()
          if (sameStart && sameEnd) reusableOpenSlot = slot
          else if (sameStart) {
            const error = new Error('Existing PT slot has a different duration.')
            error.statusCode = 409
            throw error
          }
          continue
        }
      }
      const error = new Error('Khung giờ PT đã được giữ hoặc bị khóa. Vui lòng chọn khung giờ khác.')
      error.statusCode = 409
      throw error
    }

    const conflict = await Session.findOne({
      where: {
        ptId: booking.ptId,
        startTime: { [Op.lt]: occurrence.endTime },
        endTime: { [Op.gt]: occurrence.startTime },
        status: { [Op.notIn]: ['cancelled', 'missed'] },
      },
      transaction,
    })
    if (conflict) {
      const error = new Error('Khung giờ PT đã có buổi tập. Vui lòng chọn khung giờ khác.')
      error.statusCode = 409
      throw error
    }

    const reservation = {
      ptId: booking.ptId,
      packageId: pkg.id,
      seriesId: `${booking.id}:${booking.patternKey}`,
      kind: 'recurring',
      status: 'BOOKED',
      capacity: 1,
      bookedByBookingId: booking.id,
      expiresAt,
    }
    if (reusableOpenSlot) await reusableOpenSlot.update({ ...reservation, ...occurrence }, { transaction })
    else await Slot.create({ ...occurrence, ...reservation }, { transaction })
  }
}

export const releaseBookingSlots = async (bookingId, transaction) => {
  await Slot.update(
    { status: 'OPEN', bookedByBookingId: null, expiresAt: null },
    { where: { bookedByBookingId: bookingId, status: 'BOOKED' }, transaction }
  )
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
    } else {
      await slot.update({ status: 'BOOKED', expiresAt: null }, { transaction })
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
