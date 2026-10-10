import { fn, col, Op } from 'sequelize'
import Transaction from '~/models/sql/Transaction.js'
import StudentPackage from '~/models/sql/StudentPackage.js'
import Session from '~/models/sql/Session.js'
import PTProfile from '~/models/sql/PTProfile.js'

const rangeForYear = (year) => ({ [Op.gte]: new Date(`${year}-01-01T00:00:00+07:00`), [Op.lt]: new Date(`${Number(year) + 1}-01-01T00:00:00+07:00`) })
const monthly = async (Model, where, valueField, dateField, aggregate = 'SUM') => {
  const rows = await Model.findAll({ attributes: [[fn('MONTH', col(dateField)), 'month'], [fn(aggregate, col(valueField)), 'total']], where, group: [fn('MONTH', col(dateField))], raw: true })
  const values = Array(12).fill(0)
  rows.forEach((row) => { values[Number(row.month) - 1] = Number(row.total) || 0 })
  return values
}
const countMonthly = async (where) => monthly(Session, where, 'id', 'start_time', 'COUNT')
const year = (req) => Number(req.query.year) || new Date().getFullYear()

export const ptStatsSqlController = {
  async getRevenueByYear(req, res) { const y = year(req); return res.json({ year: y, revenue: await monthly(Transaction, { ptId: req.user._id, status: 'paid', created_at: rangeForYear(y) }, 'pt_earning', 'created_at') }) },
  async getStudentsByYear(req, res) { const y = year(req); return res.json({ year: y, students: await monthly(StudentPackage, { ptId: req.user._id, created_at: rangeForYear(y) }, 'id', 'created_at', 'COUNT') }) },
  async getCompletedSessionsByYear(req, res) { const y = year(req); return res.json({ year: y, completed: await countMonthly({ ptId: req.user._id, status: 'completed', startTime: rangeForYear(y) }) }) },
  async getCancelRateByYear(req, res) {
    const y = year(req); const base = { ptId: req.user._id, startTime: rangeForYear(y) }
    const [completed, cancelled] = await Promise.all([countMonthly({ ...base, status: 'completed' }), countMonthly({ ...base, status: 'cancelled' })])
    return res.json({ year: y, cancelRate: completed.map((n, i) => n + cancelled[i] ? Math.round(cancelled[i] * 100 / (n + cancelled[i])) : 0) })
  },
  async getPTRatingStats(req, res) { const profile = await PTProfile.findOne({ where: { userId: req.user._id } }); return res.json({ success: true, averageRating: Number(profile?.ratingAvg) || 0, totalReviews: profile?.ratingCount || 0 }) }
}
