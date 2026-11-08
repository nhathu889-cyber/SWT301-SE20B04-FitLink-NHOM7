import { Op } from 'sequelize'
import Session from '~/models/sql/Session.js'
import Slot from '~/models/sql/Slot.js'
import { sequelize } from '../config/sql.js'
import { updateSessionRecord } from '../services/sqlSessionService.js'
import { StatusCodes } from 'http-status-codes'
import { hydrateSessions } from '../services/sqlRelations.js'
import { acquireScheduleLock } from '../services/bookingSchedule.js'

const updateSessionStatus = async (req, res) => {
  try {
    const session = await Session.findByPk(req.params.id)
    if (!session) return res.status(StatusCodes.NOT_FOUND).json({ message: 'Session not found.' })
    if (String(session.ptId) !== String(req.user?._id) && req.user?.role !== 'admin') {
      return res.status(StatusCodes.FORBIDDEN).json({ message: 'You do not have permission to update this session.' })
    }
    const { status, ptNote, attendance } = req.body
    const updates = {}
    const allowedTransitions = { scheduled: ['completed', 'cancelled', 'missed'], completed: [], cancelled: [], missed: [] }
    if (status !== undefined) {
      if (!allowedTransitions[session.status] || !allowedTransitions[session.status].includes(status)) {
        return res.status(StatusCodes.BAD_REQUEST).json({ message: `Invalid session status transition: ${session.status} -> ${status}` })
      }
      if (['completed', 'missed'].includes(status) && new Date(session.endTime) > new Date()) {
        return res.status(StatusCodes.BAD_REQUEST).json({ message: 'A future session cannot be marked completed or missed.' })
      }
      updates.status = status
    }
    if (attendance !== undefined && !['pending', 'present', 'absent'].includes(attendance)) {
      return res.status(StatusCodes.BAD_REQUEST).json({ message: 'Invalid attendance value.' })
    }
    if (attendance !== undefined && !['completed', 'missed'].includes(status || session.status)) {
      return res.status(StatusCodes.BAD_REQUEST).json({ message: 'Attendance can only be recorded for completed or missed sessions.' })
    }
    if (ptNote !== undefined) updates.ptNote = ptNote
    if (attendance !== undefined) updates.attendance = attendance
    if (status === 'completed') updates.completedAt = new Date()
    const notifications = await sequelize.transaction(async transaction => {
      await acquireScheduleLock(session.ptId, transaction)
      const current = await Session.findOne({ where: { id: session.id, ptId: session.ptId }, transaction, lock: transaction.LOCK.UPDATE })
      if (!current || current.status !== session.status) { const error = new Error('Session changed; reload the calendar.'); error.statusCode = StatusCodes.CONFLICT; throw error }
      const nextStatus = updates.status || current.status
      if (updates.status && !allowedTransitions[current.status]?.includes(updates.status)) { const error = new Error(`Invalid session status transition: ${current.status} -> ${updates.status}`); error.statusCode = StatusCodes.CONFLICT; throw error }
      const result = await updateSessionRecord(current, updates, transaction)
      if (nextStatus === 'cancelled' && current.slotId) {
        const activeSessions = await Session.count({ where: { slotId: current.slotId, id: { [Op.ne]: current.id }, status: { [Op.notIn]: ['cancelled', 'missed'] } }, transaction })
        if (!activeSessions) await Slot.update({ status: 'OPEN', bookedByBookingId: null, expiresAt: null }, { where: { id: current.slotId }, transaction })
      }
      await session.reload({ transaction })
      return result
    })
    if (global.emitSessionUpdate) global.emitSessionUpdate(session.studentId, { sessionId: session.id, status: session.status, ptNote: session.ptNote, attendance: session.attendance, startTime: session.startTime, endTime: session.endTime })
    if (global.sendNotificationToUser) notifications.forEach(notification => global.sendNotificationToUser(session.studentId, notification))
    return res.json({ message: 'Session updated successfully', session })
  } catch (error) {
    return res.status(error.statusCode || StatusCodes.INTERNAL_SERVER_ERROR).json({ message: 'Server error', error: error.message })
  }
}

const deleteSession = async (req, res) => updateSessionStatus({ ...req, body: { status: 'cancelled', ptNote: req.body?.reason } }, res)

const getSessionsByPT = async (req, res) => {
  try {
    const sessions = await Session.findAll({ where: { ptId: req.user._id }, order: [['start_time', 'ASC']] })
    const data = (await hydrateSessions(sessions)).map((value) => {
      const start = new Date(value.startTime)
      const end = new Date(value.endTime)
      return { ...value, _id: value.id, date: start.toISOString().slice(0, 10), start: start.toISOString().slice(11, 16), end: end.toISOString().slice(11, 16) }
    })
    return res.json({ success: true, data })
  } catch (error) {
    return res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({ message: 'Server error while loading sessions', error: error.message })
  }
}

export const sessionSqlController = { updateSessionStatus, deleteSession, getSessionsByPT }
