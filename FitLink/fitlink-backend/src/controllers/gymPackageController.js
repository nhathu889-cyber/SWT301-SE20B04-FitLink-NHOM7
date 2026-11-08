import { Op, literal } from 'sequelize'
import { sequelize } from '../config/sql.js'
import Package from '../models/sql/Package.js'
import StudentPackage from '../models/sql/StudentPackage.js'
import Transaction from '../models/sql/Transaction.js'
import { manualPayment } from '../config/manualPayment.js'

const fail = (res, error) => res.status(500).json({ success: false, message: 'Không thể xử lý gói tập gym', error: error.message })

export const list = async (req, res) => {
  try {
    const where = { ptId: null }
    const enrollments = req.user.role === 'student' ? await StudentPackage.findAll({ where: { studentId: req.user._id, ptId: null }, order: [['created_at', 'DESC']] }) : []
    if (req.user?.role !== 'admin') where[Op.or] = [{ isActive: true, visibility: 'public' }, { id: { [Op.in]: enrollments.map(item => item.packageId) } }]
    const data = await Package.findAll({ where, order: [['created_at', 'DESC']] })
    res.json({ success: true, data, enrollments })
  } catch (error) { fail(res, error) }
}

export const save = async (req, res) => {
  const { name, description = '', price, durationDays, totalSessions, gymName, gymAddress, isActive = true } = req.body
  if (typeof name !== 'string' || !name.trim() || name.trim().length > 80 || typeof description !== 'string' || description.length > 1000 ||
    !Number.isSafeInteger(Number(price)) || Number(price) <= 0 ||
    ![durationDays, totalSessions].every(value => Number.isInteger(Number(value)) && Number(value) > 0 && Number(value) <= 3650) ||
    typeof gymName !== 'string' || !gymName.trim() || gymName.length > 120 ||
    typeof gymAddress !== 'string' || !gymAddress.trim() || gymAddress.length > 500 || typeof isActive !== 'boolean') {
    return res.status(400).json({ success: false, message: 'Nhập tên gói, giá dương, thời hạn, số lượt, tên và địa chỉ phòng gym hợp lệ' })
  }
  try {
    const data = await sequelize.transaction(async transaction => {
      const values = { name: name.trim(), description, price: Number(price), durationDays: Number(durationDays), totalSessions: Number(totalSessions), sessionDurationMin: 0, gymName: gymName.trim(), gymAddress: gymAddress.trim(), isActive, visibility: 'public', ptId: null }
      let pkg
      if (req.params.id) {
        pkg = await Package.findOne({ where: { id: req.params.id, ptId: null }, transaction })
        if (!pkg) return null
        await pkg.update(values, { transaction })
      } else pkg = await Package.create(values, { transaction })
      return pkg
    })
    if (!data) return res.status(404).json({ success: false, message: 'Không tìm thấy gói tập gym' })
    res.status(req.params.id ? 200 : 201).json({ success: true, data })
  } catch (error) { fail(res, error) }
}

export const useVisit = async (req, res) => {
  try {
    const [updated] = await StudentPackage.update({ remainingSessions: literal('remaining_sessions - 1') }, {
      where: { id: req.params.id, ptId: null, status: 'active', endDate: { [Op.gt]: new Date() }, remainingSessions: { [Op.gt]: 0 } }
    })
    if (!updated) return res.status(409).json({ success: false, message: 'Vé không tồn tại, đã hết hạn hoặc hết lượt' })
    res.json({ success: true, message: 'Đã ghi nhận 1 lượt vào gym' })
  } catch (error) { fail(res, error) }
}

export const checkout = async (req, res) => {
  try {
    const pkg = await Package.findOne({ where: { id: req.params.id, ptId: null, isActive: true, visibility: 'public' } })
    if (!pkg) return res.status(404).json({ success: false, message: 'Gói tập gym không khả dụng' })
    const existing = await StudentPackage.findOne({ where: { packageId: pkg.id, studentId: req.user._id, status: 'active', endDate: { [Op.gt]: new Date() }, remainingSessions: { [Op.gt]: 0 } } })
    if (existing) return res.status(409).json({ success: false, message: 'Bạn đang có vé gym còn lượt và còn hạn' })
    // Reuse a pending checkout so retrying payment does not create another purchase.
    let payment = await Transaction.findOne({ where: { packageId: pkg.id, studentId: req.user._id, status: { [Op.in]: ['initiated', 'pending_transfer', 'pending_gateway'] } }, order: [['created_at', 'DESC']] })
    if (!payment) payment = await Transaction.create({ studentId: req.user._id, ptId: null, packageId: pkg.id, bookingId: null, amount: Number(pkg.price), method: manualPayment.enabled ? 'bank_transfer' : 'payos', status: 'initiated' })
    res.status(201).json({ success: true, data: { transactionId: payment.id, amount: payment.amount } })
  } catch (error) { fail(res, error) }
}
