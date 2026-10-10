import { hydrateStudentPackages } from '../services/sqlRelations.js'
import StudentPackage from '~/models/sql/StudentPackage.js'
import { StatusCodes } from 'http-status-codes'

const getMyStudentPackages = async (req, res) => {
  try { if (req.user.role !== 'student') return res.status(StatusCodes.FORBIDDEN).json({ message: 'Chỉ học viên mới được xem danh sách gói.' }); const page = Number(req.query.page || 1); const limit = Number(req.query.limit || 10); const where = { studentId: req.user._id }; if (req.query.status) where.status = req.query.status; const result = await StudentPackage.findAndCountAll({ where, order: [['created_at', 'DESC']], offset: (page - 1) * limit, limit }); return res.json({ total: result.count, page, limit, data: await hydrateStudentPackages(result.rows) }) } catch (error) { return res.status(500).json({ message: error.message }) }
}
const getMyStudentPackageById = async (req, res) => {
  try { if (req.user.role !== 'student') return res.status(StatusCodes.FORBIDDEN).json({ message: 'Chỉ học viên mới được xem chi tiết gói.' }); const item = await StudentPackage.findOne({ where: { id: req.params.id, studentId: req.user._id } }); if (!item) return res.status(404).json({ message: 'Không tìm thấy gói tập.' }); return res.json((await hydrateStudentPackages([item]))[0]) } catch (error) { return res.status(500).json({ message: error.message }) }
}
export { getMyStudentPackages, getMyStudentPackageById }
