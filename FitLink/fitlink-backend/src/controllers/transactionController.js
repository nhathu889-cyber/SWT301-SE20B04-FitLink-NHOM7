import Transaction from '../models/sql/Transaction.js'
import User from '../models/sql/User.js'
import Package from '../models/sql/Package.js'
import { withRelations } from '../services/sqlRelations.js'

export const getTransactions = async (req, res) => {
  try {
    const { status = 'paid', page = 1, limit = 10 } = req.query

    const where = { status }
    const pageNumber = Number(page)
    const limitNumber = Number(limit)
    const skip = (pageNumber - 1) * limitNumber

    // Lấy danh sách giao dịch nhanh + ổn định
    const { rows: transactions, count: total } = await Transaction.findAndCountAll({
      where,
      order: [['created_at', 'DESC']],
      offset: skip,
      limit: limitNumber
    })

    // Đếm tổng số
    const summary = transactions.reduce((result, item) => {
      result.totalPlatformFee += Number(item.platformFee || 0)
      result.totalPTEarning += Number(item.ptEarning || 0)
      result.count += 1
      return result
    }, { totalPlatformFee: 0, totalPTEarning: 0, count: 0 })

    return res.json({
      success: true,
      summary,
      data: await withRelations(transactions, { student: [User, 'studentId'], pt: [User, 'ptId'], package: [Package, 'packageId'] }),
      pagination: {
        total,
        page: pageNumber,
        limit: limitNumber,
        totalPages: Math.ceil(total / limitNumber)
      }
    })
  } catch (err) {
    console.error('❌ getTransactions:', err)
    res.status(500).json({ success: false, message: 'Server error' })
  }
}
