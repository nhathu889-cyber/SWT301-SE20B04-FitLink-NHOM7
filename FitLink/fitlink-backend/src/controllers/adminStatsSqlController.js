import Transaction from '~/models/sql/Transaction.js'
import User from '~/models/sql/User.js'
import Booking from '~/models/sql/Booking.js'
import Session from '~/models/sql/Session.js'
import { Op } from 'sequelize'

const rangeForYear = (year) => [new Date(`${year}-01-01T00:00:00+07:00`), new Date(`${year}-12-31T23:59:59+07:00`)]
const monthBuckets = (rows, value) => {
  const result = Array(12).fill(0)
  rows.forEach((row) => { result[new Date(row.created_at || row.startTime).getMonth()] += Number(value(row) || 0) })
  return result
}

const getRevenueByYear = async (req, res) => {
  try {
    const year = Number(req.query.year)
    if (!year) return res.status(400).json({ message: 'Missing year' })
    const [start, end] = rangeForYear(year)
    const rows = await Transaction.findAll({ where: { status: 'paid', created_at: { [Op.gte]: start } } })
    const revenue = monthBuckets(rows.filter((row) => new Date(row.created_at) <= end), (row) => row.platformFee)
    return res.json({ year, revenue })
  } catch (error) { return res.status(500).json({ message: error.message }) }
}

const getUsersByYear = async (req, res) => {
  try {
    const year = Number(req.query.year)
    if (!year) return res.status(400).json({ message: 'Missing year' })
    const [start, end] = rangeForYear(year)
    const rows = await User.findAll({ where: { created_at: { [Op.gte]: start } } })
    return res.json({ year, users: monthBuckets(rows.filter((row) => new Date(row.created_at) <= end), () => 1) })
  } catch (error) { return res.status(500).json({ message: error.message }) }
}

const getBookingTrends = async (req, res) => {
  try {
    const year = Number(req.query.year)
    if (!year) return res.status(400).json({ message: 'Missing year' })
    const [start, end] = rangeForYear(year)
    const rows = await Booking.findAll({ where: { status: 'PAID', created_at: { [Op.gte]: start } } })
    return res.json({ year, bookings: monthBuckets(rows.filter((row) => new Date(row.created_at) <= end), () => 1) })
  } catch (error) { return res.status(500).json({ message: error.message }) }
}

const getTopPT = async (req, res) => {
  try {
    const rows = await Session.findAll({ where: { status: 'completed' } })
    const counts = new Map()
    rows.forEach((row) => counts.set(row.ptId, (counts.get(row.ptId) || 0) + 1))
    const topPTs = [...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5).map(([ptId, totalSessions]) => ({ ptId, totalSessions }))
    return res.json({ topPTs })
  } catch (error) { return res.status(500).json({ message: error.message }) }
}

export const adminStatsSqlController = { getRevenueByYear, getUsersByYear, getBookingTrends, getTopPT }
