import User from '../models/sql/User.js'
import Package from '../models/sql/Package.js'
import StudentPackage from '../models/sql/StudentPackage.js'
import Session from '../models/sql/Session.js'
import Booking from '../models/sql/Booking.js'
import Transaction from '../models/sql/Transaction.js'

const publicUserFields = ['id', 'name', 'email', 'phone', 'avatar', 'role']
const key = value => String(value).toLowerCase()

// Batch related rows instead of returning bare SQL foreign keys to the UI.
export const withRelations = async (records, relations, options = {}) => {
  const rows = records.map(row => row.toJSON ? row.toJSON() : { ...row })
  await Promise.all(Object.entries(relations).map(async ([alias, [model, foreignKey]]) => {
    const ids = [...new Set(rows.map(row => row[foreignKey]).filter(Boolean))]
    if (!ids.length) return
    const related = await model.findAll({ where: { id: ids }, ...(model === User ? { attributes: publicUserFields } : {}), ...options })
    const byId = new Map(related.map(row => [key(row.id), row.toJSON()]))
    rows.forEach(row => { row[alias] = byId.get(key(row[foreignKey])) || null })
  }))
  return rows
}

export const hydrateStudentPackages = async (records, options = {}) => {
  const rows = await withRelations(records, { student: [User, 'studentId'], pt: [User, 'ptId'], package: [Package, 'packageId'], transaction: [Transaction, 'transactionId'], booking: [Booking, 'bookingId'] }, options)
  if (!rows.length) return rows
  const sessions = await Session.findAll({ where: { studentPackageId: rows.map(row => row.id) }, order: [['startTime', 'ASC']], ...options })
  const byPackage = new Map()
  sessions.forEach(session => {
    const id = key(session.studentPackageId)
    if (!byPackage.has(id)) byPackage.set(id, [])
    byPackage.get(id).push(session.toJSON())
  })
  return rows.map(row => ({ ...row, sessions: byPackage.get(key(row.id)) || [] }))
}

export const hydrateSessions = (records, options = {}) => withRelations(records, { student: [User, 'studentId'], pt: [User, 'ptId'], studentPackage: [StudentPackage, 'studentPackageId'] }, options)

export const hydrateFeedbacks = async (records, options = {}) => {
  const rows = await withRelations(records, { student: [User, 'studentId'], pt: [User, 'ptId'], studentPackage: [StudentPackage, 'studentPackageId'] }, options)
  const packages = await withRelations(rows.map(row => row.studentPackage).filter(Boolean), { package: [Package, 'packageId'] }, options)
  const byId = new Map(packages.map(row => [key(row.id), row]))
  return rows.map(row => ({ ...row, studentPackage: byId.get(key(row.studentPackageId)) || null }))
}
