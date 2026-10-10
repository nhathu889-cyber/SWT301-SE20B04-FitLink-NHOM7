import Session from '~/models/sql/Session.js'
import SessionChangeRequest from '~/models/sql/SessionChangeRequest.js'
import Notification from '~/models/sql/Notification.js'
import { StatusCodes } from 'http-status-codes'

const studentRequestChange = async (req, res) => {
  try {
    const { sessionId, reason, nnewStartTime, newStartTime = nnewStartTime, newEndTime } = req.body
    if (!sessionId || !reason || !newStartTime || !newEndTime) return res.status(StatusCodes.BAD_REQUEST).json({ message: 'Thiếu thông tin yêu cầu.' })
    const session = await Session.findByPk(sessionId)
    if (!session) return res.status(StatusCodes.NOT_FOUND).json({ message: 'Session không tồn tại' })
    if (String(session.studentId) !== String(req.user._id)) return res.status(StatusCodes.FORBIDDEN).json({ message: 'Không có quyền gửi yêu cầu.' })
    await SessionChangeRequest.destroy({ where: { sessionId, status: 'pending' } })
    const request = await SessionChangeRequest.create({ sessionId, studentId: session.studentId, ptId: session.ptId, reason, newStartTime, newEndTime })
    await session.update({ requestType: 'change', requestStatus: 'change_request_pending', requestReason: reason })
    await Notification.create({ userId: session.ptId, type: 'session', title: 'Yêu cầu đổi lịch mới', message: 'Học viên gửi yêu cầu đổi lịch.', meta: JSON.stringify({ sessionId, requestType: 'change', newStartTime, newEndTime, reason, pending: true }) })
    return res.json({ message: 'Đã gửi yêu cầu đổi lịch.', request })
  } catch (error) {
    return res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({ message: 'Lỗi hệ thống', error: error.message })
  }
}

const studentRequestAbsent = async (req, res) => {
  try {
    const { sessionId, reason } = req.body
    if (!sessionId || !reason) return res.status(StatusCodes.BAD_REQUEST).json({ message: 'Thiếu thông tin yêu cầu.' })
    const session = await Session.findByPk(sessionId)
    if (!session) return res.status(StatusCodes.NOT_FOUND).json({ message: 'Session không tồn tại' })
    if (String(session.studentId) !== String(req.user._id)) return res.status(StatusCodes.FORBIDDEN).json({ message: 'Không có quyền gửi yêu cầu nghỉ buổi.' })
    await SessionChangeRequest.update({ status: 'expired' }, { where: { sessionId, status: 'pending' } })
    await session.update({ requestType: 'absent', requestStatus: 'absent_request_pending', requestReason: reason, status: 'scheduled' })
    await Notification.create({ userId: session.ptId, type: 'session', title: 'Yêu cầu xin nghỉ', message: 'Học viên xin nghỉ buổi tập.', meta: JSON.stringify({ sessionId, requestType: 'absent', reason }) })
    return res.json({ message: 'Đã gửi yêu cầu xin nghỉ.' })
  } catch (error) {
    return res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({ message: 'Lỗi hệ thống', error: error.message })
  }
}

export { studentRequestChange, studentRequestAbsent }
