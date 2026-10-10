import Feedback from '~/models/sql/Feedback.js'
import PTProfile from '~/models/sql/PTProfile.js'
import Notification from '~/models/sql/Notification.js'
import { StatusCodes } from 'http-status-codes'
import { hydrateFeedbacks } from '../services/sqlRelations.js'

const createFeedback = async (req, res) => {
  try {
    const { studentPackage, pt, rating, comment, notificationId } = req.body
    const student = req.user?._id || req.body.student
    if (!pt || !studentPackage || !rating) return res.status(StatusCodes.BAD_REQUEST).json({ success: false, message: 'Thiếu thông tin bắt buộc.' })
    const feedback = await Feedback.create({ studentPackageId: studentPackage, studentId: student, ptId: pt, rating, comment })
    if (notificationId) {
      const notification = await Notification.findByPk(notificationId)
      if (notification) {
        let meta = {}
        try { meta = JSON.parse(notification.meta || '{}') } catch { meta = {} }
        await notification.update({ meta: JSON.stringify({ ...meta, feedbackSent: true }) })
      }
    }
    const all = await Feedback.findAll({ where: { ptId: pt }, attributes: ['rating'] })
    const average = all.length ? all.reduce((sum, item) => sum + Number(item.rating), 0) / all.length : 0
    const [profile] = await PTProfile.findOrCreate({ where: { userId: pt }, defaults: { userId: pt } })
    await profile.update({ ratingAvg: average.toFixed(1), ratingCount: all.length })
    return res.status(StatusCodes.CREATED).json({ success: true, message: 'Gửi đánh giá thành công!', data: feedback })
  } catch (error) {
    if (error.name === 'SequelizeUniqueConstraintError') return res.status(StatusCodes.CONFLICT).json({ success: false, message: 'Bạn đã gửi đánh giá cho gói học này rồi.' })
    return res.status(StatusCodes.BAD_REQUEST).json({ success: false, message: error.message })
  }
}

const getFeedbackByPT = async (req, res) => {
  try {
    const feedbacks = await Feedback.findAll({ where: { ptId: req.params.ptId }, order: [['created_at', 'DESC']] })
    const average = feedbacks.length ? feedbacks.reduce((sum, item) => sum + Number(item.rating), 0) / feedbacks.length : 0
    return res.json({ success: true, avgRating: average.toFixed(1), data: await hydrateFeedbacks(feedbacks) })
  } catch (error) {
    return res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({ success: false, message: error.message })
  }
}

const getMine = async (req, res) => {
  try {
    const page = Math.max(parseInt(req.query.page, 10) || 1, 1)
    const limit = Math.min(parseInt(req.query.limit, 10) || 10, 100)
    const result = await Feedback.findAndCountAll({ where: { ptId: req.user?._id || req.user?.id }, order: [['created_at', 'DESC']], offset: (page - 1) * limit, limit })
    return res.json({ success: true, data: await hydrateFeedbacks(result.rows), pagination: { page, pages: Math.max(Math.ceil(result.count / limit), 1), total: result.count, limit } })
  } catch (error) {
    return res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({ message: error.message })
  }
}

export { createFeedback, getFeedbackByPT, getMine }
