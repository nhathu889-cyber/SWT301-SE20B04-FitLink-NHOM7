import { DataTypes } from 'sequelize'
import { sequelize } from '../../config/sql.js'

const StudentPackageSQL = sequelize.define('StudentPackageSQL', {
  id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
  studentId: { type: DataTypes.UUID, field: 'student_id', allowNull: false },
  ptId: { type: DataTypes.UUID, field: 'pt_id', allowNull: false },
  packageId: { type: DataTypes.UUID, field: 'package_id' },
  transactionId: { type: DataTypes.UUID, field: 'transaction_id', unique: true },
  bookingId: { type: DataTypes.UUID, field: 'booking_id' },
  sessions: { type: DataTypes.TEXT, defaultValue: '[]' },
  startDate: { type: DataTypes.DATE, field: 'start_date' },
  endDate: { type: DataTypes.DATE, field: 'end_date' },
  totalSessions: { type: DataTypes.INTEGER, field: 'total_sessions' },
  remainingSessions: { type: DataTypes.INTEGER, field: 'remaining_sessions' },
  pattern: { type: DataTypes.TEXT, defaultValue: '[]' },
  slot: { type: DataTypes.TEXT, defaultValue: '{}' },
  patternKey: { type: DataTypes.STRING(100), field: 'pattern_key' },
  slotKey: { type: DataTypes.STRING(100), field: 'slot_key' },
  status: { type: DataTypes.STRING(30), defaultValue: 'active' },
  isExternal: { type: DataTypes.BOOLEAN, field: 'is_external', defaultValue: false },
  createdByPT: { type: DataTypes.BOOLEAN, field: 'created_by_pt', defaultValue: false }
}, { tableName: 'student_packages', timestamps: true, createdAt: 'created_at', updatedAt: 'updated_at' })

export default StudentPackageSQL
