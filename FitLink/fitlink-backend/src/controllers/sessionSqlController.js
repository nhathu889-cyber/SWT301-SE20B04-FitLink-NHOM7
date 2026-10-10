import Session from '~/models/sql/Session.js'
import { sequelize } from '../config/sql.js'
import { updateSessionRecord } from '../services/sqlSessionService.js'
import { StatusCodes } from 'http-status-codes'
import { hydrateSessions } from '../services/sqlRelations.js'

const updateSessionStatus = async (req, res) => {
  try {
    const session = await Session.findByPk(req.params.id)
    if (!session) return res.status(StatusCodes.NOT_FOUND).json({ message: 'Session not found.' })
    if (String(session.ptId) !== String(req.user?._id) && req.user?.role !== 'admin') {
      return res.status(StatusCodes.FORBIDDEN).json({ message: 'You do not have permission to update this session.' })
    }
    const { status, ptNote, attendance } = req.body
    const updates = {}
    if (status) updates.status = status
    if (ptNote !== undefined) updates.ptNote = ptNote
    if (attendance) updates.attendance = attendance
    if (status === 'completed') updates.completedAt = new Date()
    const notifications = await sequelize.transaction(transaction => updateSessionRecord(session, updates, transaction))
    if (global.emitSessionUpdate) global.emitSessionUpdate(session.studentId, { sessionId: session.id, status: session.status, ptNote: session.ptNote, attendance: session.attendance, startTime: session.startTime, endTime: session.endTime })
    if (global.sendNotificationToUser) notifications.forEach(notification => global.sendNotificationToUser(session.studentId, notification))
    return res.json({ message: 'Session updated successfully', session })
  } catch (error) {
    return res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({ message: 'Server error', error: error.message })
  }
}

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

export const sessionSqlController = { updateSessionStatus, getSessionsByPT }
