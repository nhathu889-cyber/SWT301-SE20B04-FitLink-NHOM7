import { fn, col, Op } from 'sequelize'
import StudentPackage from '~/models/sql/StudentPackage.js'
import Transaction from '~/models/sql/Transaction.js'
import Session from '~/models/sql/Session.js'
import User from '~/models/sql/User.js'

const y = (req) => Number(req.query.year) || new Date().getFullYear()
const range = (year) => ({ [Op.gte]: new Date(`${year}-01-01T00:00:00+07:00`), [Op.lt]: new Date(`${year + 1}-01-01T00:00:00+07:00`) })
const perMonth = async (Model, where, amount, dateColumn, aggregate = 'SUM') => { const rows = await Model.findAll({ attributes: [[fn('MONTH', col(dateColumn)), 'month'], [fn(aggregate, col(amount)), 'total']], where, group: [fn('MONTH', col(dateColumn))], raw: true }); const out = Array(12).fill(0); rows.forEach((r) => { out[Number(r.month) - 1] = Number(r.total) || 0 }); return out }

export const studentStatsSqlController = {
  async getDashboard(req, res) { const id = req.user._id; const [pkg, completed, cancelled, payments] = await Promise.all([StudentPackage.findOne({ where: { studentId: id, status: 'active' }, order: [['created_at', 'DESC']] }), Session.count({ where: { studentId: id, status: 'completed' } }), Session.count({ where: { studentId: id, status: 'cancelled' } }), Transaction.sum('amount', { where: { studentId: id, status: 'paid' } })]); return res.json({ totalSessions: pkg?.totalSessions || 0, remaining: pkg?.remainingSessions || 0, completed, cancelled, totalPaid: Number(payments) || 0 }) },
  async getPaymentHistory(req, res) { const year = y(req); return res.json({ year, payments: await perMonth(Transaction, { studentId: req.user._id, status: 'paid', created_at: range(year) }, 'amount', 'created_at') }) },
  async getCompletedSessionsByYear(req, res) { const year = y(req); return res.json({ year, completed: await perMonth(Session, { studentId: req.user._id, status: 'completed', startTime: range(year) }, 'id', 'start_time', 'COUNT') }) },
  async getProgressByYear(req, res) { const year = y(req); return res.json({ year, progress: await perMonth(Session, { studentId: req.user._id, status: 'completed', startTime: range(year) }, 'id', 'start_time', 'COUNT') }) },
  async getSessionHistory(req, res) { const year = y(req); if (req.query.full === '1') { const sessions = await Session.findAll({ where: { studentId: req.user._id }, order: [['start_time', 'DESC']] }); const pts = await User.findAll({ where: { id: [...new Set(sessions.map(s => s.ptId))] }, attributes: ['id', 'name', 'avatar'] }); const byId = new Map(pts.map(p => [p.id, p])); return res.json({ sessions: sessions.map(s => ({ ...s.toJSON(), pt: byId.get(s.ptId) || null })) }) } return res.json({ year, history: await perMonth(Session, { studentId: req.user._id, startTime: range(year) }, 'id', 'start_time', 'COUNT') }) }
}
