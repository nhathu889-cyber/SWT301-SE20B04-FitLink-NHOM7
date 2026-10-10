import { StatusCodes } from 'http-status-codes'
import Package from '~/models/sql/Package.js'

const MON_FIRST = [1, 2, 3, 4, 5, 6, 0]

const normalizePatterns = (input) => {
  let patterns = input
  if (Array.isArray(patterns) && patterns.length && typeof patterns[0] === 'number') patterns = [patterns]
  if (!Array.isArray(patterns)) return []
  return patterns.map((pattern) => [...new Set((Array.isArray(pattern) ? pattern : [])
    .map(Number)
    .filter((day) => Number.isInteger(day) && day >= 0 && day <= 6))]
    .sort((a, b) => MON_FIRST.indexOf(a) - MON_FIRST.indexOf(b)))
    .filter((pattern) => pattern.length > 0)
}

const parseJson = (value, fallback) => {
  try {
    return value ? JSON.parse(value) : fallback
  } catch {
    return fallback
  }
}

const serializePackage = (record) => {
  if (!record) return null
  const data = record.toJSON ? record.toJSON() : record
  return {
    ...data,
    _id: data.id,
    pt: data.ptId,
    recurrence: parseJson(data.recurrence, { daysOfWeek: [] }),
    supports: parseJson(data.supports, { atPtGym: true, atClient: true, atOtherGym: true }),
    travelPricing: parseJson(data.travelPricing, {}),
    tags: parseJson(data.tags, [])
  }
}

const packagePayload = (body) => {
  const recurrence = typeof body.recurrence === 'string' ? parseJson(body.recurrence, {}) : body.recurrence
  const patterns = normalizePatterns(recurrence?.daysOfWeek)
  return {
    name: String(body.name || '').trim(),
    description: body.description ?? '',
    price: Math.max(0, Math.round(Number(body.price || 0))),
    totalSessions: Number(body.totalSessions),
    sessionDurationMin: Number(body.sessionDurationMin),
    durationDays: Number(body.durationDays),
    isActive: typeof body.isActive === 'boolean' ? body.isActive : true,
    visibility: body.visibility === 'public' ? 'public' : 'private',
    recurrence: JSON.stringify({ daysOfWeek: patterns }),
    supports: JSON.stringify(body.supports || { atPtGym: true, atClient: true, atOtherGym: true }),
    travelPricing: JSON.stringify(body.travelPricing || {}),
    tags: JSON.stringify(Array.isArray(body.tags) ? body.tags : [])
  }
}

const createPackage = async (req, res) => {
  try {
    const payload = packagePayload(req.body)
    if (!payload.name || !payload.totalSessions || !payload.sessionDurationMin || !payload.durationDays) {
      return res.status(StatusCodes.BAD_REQUEST).json({ success: false, message: 'Vui lòng nhập đầy đủ thông tin gói' })
    }
    const pkg = await Package.create({ ...payload, ptId: req.user._id })
    return res.status(StatusCodes.CREATED).json({ success: true, message: 'Tạo gói tập thành công', data: serializePackage(pkg) })
  } catch (error) {
    if (error.name === 'SequelizeUniqueConstraintError') {
      return res.status(StatusCodes.CONFLICT).json({ success: false, message: 'Tên gói đã tồn tại trong tài khoản PT' })
    }
    return res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({ success: false, message: 'Lỗi server', error: error.message })
  }
}

const getMyPackages = async (req, res) => {
  try {
    const page = Math.max(1, parseInt(req.query.page, 10) || 1)
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit, 10) || 10))
    const where = { ptId: req.user._id }
    if (typeof req.query.isActive !== 'undefined') where.isActive = req.query.isActive === 'true'
    const result = await Package.findAndCountAll({ where, order: [['created_at', 'DESC']], limit, offset: (page - 1) * limit })
    return res.status(StatusCodes.OK).json({ success: true, data: result.rows.map(serializePackage), pagination: { total: result.count, page, pages: Math.ceil(result.count / limit) } })
  } catch (error) {
    return res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({ success: false, message: 'Lỗi server', error: error.message })
  }
}

const getPackagesByPTPublic = async (req, res) => {
  try {
    const items = await Package.findAll({ where: { ptId: req.params.ptId, isActive: true, visibility: 'public' }, order: [['created_at', 'DESC']] })
    return res.status(StatusCodes.OK).json({ success: true, data: items.map(serializePackage) })
  } catch (error) {
    return res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({ success: false, message: 'Lỗi server', error: error.message })
  }
}

const getPackageById = async (req, res) => {
  try {
    const pkg = await Package.findByPk(req.params.id)
    if (!pkg) return res.status(StatusCodes.NOT_FOUND).json({ success: false, message: 'Không tìm thấy gói tập' })
    const data = serializePackage(pkg)
    const isOwner = req.user && String(data.ptId) === String(req.user._id)
    if (!isOwner && data.visibility !== 'public') return res.status(StatusCodes.FORBIDDEN).json({ success: false, message: 'Bạn không có quyền xem gói này' })
    return res.status(StatusCodes.OK).json({ success: true, data })
  } catch (error) {
    return res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({ success: false, message: 'Lỗi server', error: error.message })
  }
}

const updatePackage = async (req, res) => {
  try {
    const pkg = await Package.findOne({ where: { id: req.params.id, ptId: req.user._id } })
    if (!pkg) return res.status(StatusCodes.NOT_FOUND).json({ success: false, message: 'Không tìm thấy gói tập' })
    await pkg.update(packagePayload({ ...pkg.toJSON(), ...req.body }))
    return res.status(StatusCodes.OK).json({ success: true, message: 'Cập nhật gói thành công', data: serializePackage(pkg) })
  } catch (error) {
    if (error.name === 'SequelizeUniqueConstraintError') return res.status(StatusCodes.CONFLICT).json({ success: false, message: 'Tên gói đã tồn tại trong tài khoản PT' })
    return res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({ success: false, message: 'Lỗi server', error: error.message })
  }
}

const deletePackage = async (req, res) => {
  const [updated] = await Package.update({ isActive: false }, { where: { id: req.params.id, ptId: req.user._id } })
  if (!updated) return res.status(StatusCodes.NOT_FOUND).json({ success: false, message: 'Không tìm thấy gói tập' })
  return res.status(StatusCodes.OK).json({ success: true, message: 'Đã ẩn gói tập thành công' })
}

const hardDeletePackage = async (req, res) => {
  const deleted = await Package.destroy({ where: { id: req.params.id, ptId: req.user._id } })
  if (!deleted) return res.status(StatusCodes.NOT_FOUND).json({ success: false, message: 'Không tìm thấy gói tập' })
  return res.status(StatusCodes.OK).json({ success: true, message: 'Đã xoá gói tập vĩnh viễn' })
}

export const packageController = { createPackage, getMyPackages, getPackagesByPTPublic, getPackageById, updatePackage, deletePackage, hardDeletePackage }
