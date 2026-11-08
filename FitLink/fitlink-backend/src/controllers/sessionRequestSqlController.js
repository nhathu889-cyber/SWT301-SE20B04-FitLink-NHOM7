import Session from '~/models/sql/Session.js'
import SessionChangeRequest from '~/models/sql/SessionChangeRequest.js'
import Notification from '~/models/sql/Notification.js'
import { StatusCodes } from 'http-status-codes'
import { Op } from 'sequelize'
import { sequelize } from '~/config/sql.js'

const studentRequestChange = async (req, res) => {
  try {
    const { sessionId, reason, newStartTime, newEndTime } = req.body
    if (!sessionId || !reason?.trim() || !newStartTime || !newEndTime) {
      return res.status(StatusCodes.BAD_REQUEST).json({ message: 'Vui lòng nhập đầy đủ thời gian mới và lý do.' })
    }

    const start = new Date(newStartTime)
    const end = new Date(newEndTime)
    if (!Number.isFinite(start.getTime()) || !Number.isFinite(end.getTime()) || start <= new Date() || end <= start) {
      return res.status(StatusCodes.BAD_REQUEST).json({ message: 'Thời gian mới không hợp lệ hoặc đã qua.' })
    }

    const session = await Session.findOne({ where: { id: sessionId, studentId: req.user._id } })
    if (!session) return res.status(StatusCodes.NOT_FOUND).json({ message: 'Không tìm thấy buổi tập của bạn.' })
    if (session.status !== 'scheduled' || new Date(session.startTime) <= new Date()) {
      return res.status(StatusCodes.CONFLICT).json({ message: 'Không thể đổi lịch buổi tập đã bắt đầu hoặc đã kết thúc.' })
    }
    const requestedDuration = end.getTime() - start.getTime()
    const currentDuration = new Date(session.endTime).getTime() - new Date(session.startTime).getTime()
    if (requestedDuration !== currentDuration) {
      return res.status(StatusCodes.BAD_REQUEST).json({ message: 'Thời lượng buổi tập mới phải bằng buổi tập hiện tại.' })
    }
    if (session.requestStatus) {
      return res.status(StatusCodes.CONFLICT).json({ message: 'Buổi tập này đã có yêu cầu đang chờ PT xử lý.' })
    }

    const overlap = await Session.findOne({
      where: {
        ptId: session.ptId,
        id: { [Op.ne]: session.id },
        status: { [Op.notIn]: ['cancelled', 'missed'] },
        startTime: { [Op.lt]: end },
        endTime: { [Op.gt]: start }
      }
    })
    if (overlap) return res.status(StatusCodes.CONFLICT).json({ message: 'Khung giờ mới bị trùng với buổi tập khác của PT.' })

    const tx = await sequelize.transaction()
    let request
    try {
      const lockedSession = await Session.findOne({ where: { id: sessionId, studentId: req.user._id }, transaction: tx, lock: tx.LOCK.UPDATE })
      if (!lockedSession || lockedSession.status !== 'scheduled' || lockedSession.requestStatus) {
        await tx.rollback()
        return res.status(StatusCodes.CONFLICT).json({ message: 'Buổi tập đã thay đổi hoặc đang có yêu cầu chờ xử lý.' })
      }
      request = await SessionChangeRequest.create({
        sessionId,
        studentId: session.studentId,
        ptId: session.ptId,
        reason: reason.trim(),
        newStartTime: start,
        newEndTime: end
      }, { transaction: tx })
      await lockedSession.update({ requestType: 'change', requestStatus: 'change_request_pending', requestReason: reason.trim() }, { transaction: tx })
      await tx.commit()
    } catch (error) {
      if (!tx.finished) await tx.rollback()
      throw error
    }

    try {
      const notification = await Notification.create({
        userId: session.ptId,
        type: 'session',
        title: 'Yêu cầu đổi lịch mới',
        message: 'Học viên gửi yêu cầu đổi lịch.',
        meta: JSON.stringify({ sessionId, requestType: 'change', newStartTime: start, newEndTime: end, reason: reason.trim() })
      })
      global.sendNotificationToUser?.(session.ptId, notification)
    } catch (error) {
      console.error('Could not notify PT about schedule request:', error)
    }
    return res.status(StatusCodes.CREATED).json({ success: true, message: 'Đã gửi yêu cầu đổi lịch.', data: request })
  } catch (error) {
    return res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({ message: 'Không thể gửi yêu cầu đổi lịch.', error: error.message })
  }
}

const studentRequestAbsent = async (req, res) => {
  try {
    const { sessionId, reason } = req.body
    if (!sessionId || !reason?.trim()) return res.status(StatusCodes.BAD_REQUEST).json({ message: 'Vui lòng nhập lý do xin nghỉ.' })
    const session = await Session.findOne({ where: { id: sessionId, studentId: req.user._id } })
    if (!session) return res.status(StatusCodes.NOT_FOUND).json({ message: 'Không tìm thấy buổi tập của bạn.' })
    if (session.status !== 'scheduled' || new Date(session.startTime) <= new Date()) {
      return res.status(StatusCodes.CONFLICT).json({ message: 'Không thể xin nghỉ cho buổi tập đã bắt đầu hoặc đã kết thúc.' })
    }
    if (session.requestStatus) return res.status(StatusCodes.CONFLICT).json({ message: 'Buổi tập này đã có yêu cầu đang chờ PT xử lý.' })
    await session.update({ requestType: 'absent', requestStatus: 'absent_request_pending', requestReason: reason.trim() })
    try {
      const notification = await Notification.create({ userId: session.ptId, type: 'session', title: 'Yêu cầu xin nghỉ', message: 'Học viên xin nghỉ buổi tập.', meta: JSON.stringify({ sessionId, requestType: 'absent', reason: reason.trim() }) })
      global.sendNotificationToUser?.(session.ptId, notification)
    } catch (error) {
      console.error('Could not notify PT about absence request:', error)
    }
    return res.status(StatusCodes.CREATED).json({ success: true, message: 'Đã gửi yêu cầu xin nghỉ.' })
  } catch (error) {
    return res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({ message: 'Không thể gửi yêu cầu xin nghỉ.', error: error.message })
  }
}

const studentGetRequests = async (req, res) => {
  try {
    const data = await SessionChangeRequest.findAll({
      where: { studentId: req.user._id },
      order: [['createdAt', 'DESC']],
      limit: 100
    })
    return res.json({ success: true, data })
  } catch (error) {
    return res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({ success: false, message: error.message })
  }
}

export { studentRequestChange, studentRequestAbsent, studentGetRequests }
