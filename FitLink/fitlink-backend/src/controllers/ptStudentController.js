// src/controllers/ptStudentController.js
import { StatusCodes } from 'http-status-codes'
import StudentPackage from '~/models/sql/StudentPackage.js'
import Session from '~/models/sql/Session.js'
import { Op } from 'sequelize'
import { hydrateStudentPackages, hydrateSessions } from '../services/sqlRelations.js'

/**
 * GET /api/pt/students?packageId=&status=active&page=1&limit=10
 * Trả về danh sách học viên thuộc PT (từ StudentPackage),
 * có thể lọc theo package đang dùng.
 */
const listMyStudents = async (req, res) => {
  try {


    const ptId = req.user._id
    const { packageId, status = 'active', page = 1, limit = 10 } = req.query

    const filter = { ptId }
    if (status) filter.status = status
    if (packageId) filter.packageId = packageId

    // tìm các StudentPackage thỏa filter
    const [items, total] = await Promise.all([
      StudentPackage.findAll({ where: filter, order: [['created_at', 'DESC']], offset: (Number(page) - 1) * Number(limit), limit: Number(limit) }),
      StudentPackage.count({ where: filter })
    ])

    // search q (tên/email) phía FE hoặc lọc nhẹ phía BE
    const data = await hydrateStudentPackages(items)

    return res.status(StatusCodes.OK).json({
      success: true,
      data,
      pagination: {
        total,
        page: Number(page),
        pages: Math.ceil(total / Number(limit))
      }
    })
  } catch (e) {
    return res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({ success: false, message: e.message })
  }
}

/**
 * GET /api/pt/students/:studentPackageId/sessions
 */
const listSessionsByStudentPackage = async (req, res) => {
  try {
    const { studentPackageId } = req.params
    const sessions = await Session.findAll({ where: { studentPackageId, ...(req.user.role === 'pt' ? { ptId: req.user._id } : { studentId: req.user._id }) }, order: [['start_time', 'ASC']] })
    return res.status(StatusCodes.OK).json({ success: true, data: await hydrateSessions(sessions) })
  } catch (e) {
    return res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({ success: false, message: e.message })
  }
}

/**
 * POST /api/pt/students/:studentPackageId/sessions
 * body: { title, startTime, endTime, ptNote }
 * chỉ PT sở hữu StudentPackage mới tạo được
 */
const createSessionForStudentPackage = async (req, res) => {
  try {
    const { studentPackageId } = req.params
    const { title, startTime, endTime, ptNote } = req.body

    if (!title || !startTime || !endTime) {
      return res.status(StatusCodes.BAD_REQUEST).json({
        success: false,
        message: 'Thiếu title / startTime / endTime'
      })
    }

    const sp = await StudentPackage.findByPk(studentPackageId)
    if (!sp) return res.status(StatusCodes.NOT_FOUND).json({ success: false, message: 'Không tìm thấy student package' })

    // quyền PT
    if (String(sp.ptId) !== String(req.user._id)) {
      return res.status(StatusCodes.FORBIDDEN).json({ success: false, message: 'Không có quyền tạo lịch cho học viên này' })
    }

    // (tuỳ chọn) chặn trùng giờ cho cùng 1 PT
    const overlap = await Session.findOne({ where: {
      ptId: sp.ptId,
      startTime: { [Op.lt]: new Date(endTime) },
      endTime: { [Op.gt]: new Date(startTime) },
      status: { [Op.ne]: 'cancelled' }
    }
    })
    if (overlap) {
      return res.status(StatusCodes.BAD_REQUEST).json({ success: false, message: 'PT đã có lịch trùng thời gian' })
    }

    const session = await Session.create({
      studentPackageId: sp.id,
      ptId: sp.ptId,
      studentId: sp.studentId,
      title,
      startTime,
      endTime,
      status: 'scheduled',
      attendance: 'pending',
      ptNote
    })

    return res.status(StatusCodes.CREATED).json({ success: true, data: session })
  } catch (e) {
    return res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({ success: false, message: e.message })
  }
}

export const ptStudentController = {
  listMyStudents,
  listSessionsByStudentPackage,
  createSessionForStudentPackage
}
