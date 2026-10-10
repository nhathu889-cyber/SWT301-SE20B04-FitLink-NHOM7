import { DataTypes } from 'sequelize'
import { sequelize } from '../../config/sql.js'

const BookingSQL = sequelize.define('BookingSQL', {
  id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
  studentId: { type: DataTypes.UUID, field: 'student_id', allowNull: false },
  ptId: { type: DataTypes.UUID, field: 'pt_id', allowNull: false },
  packageId: { type: DataTypes.UUID, field: 'package_id', allowNull: false },
  pattern: { type: DataTypes.TEXT, defaultValue: '[]' },
  slot: { type: DataTypes.TEXT, defaultValue: '{}' },
  patternKey: { type: DataTypes.STRING(100), field: 'pattern_key' },
  slotKey: { type: DataTypes.STRING(100), field: 'slot_key' },
  startDate: { type: DataTypes.DATE, field: 'start_date' },
  mode: { type: DataTypes.STRING(30) },
  clientAddress: { type: DataTypes.TEXT, field: 'client_address' },
  ptGymAddress: { type: DataTypes.TEXT, field: 'pt_gym_address' },
  otherGymAddress: { type: DataTypes.TEXT, field: 'other_gym_address' },
  travelPolicy: { type: DataTypes.TEXT, field: 'travel_policy', defaultValue: '{}' },
  travelDistanceKm: { type: DataTypes.DECIMAL(10, 2), field: 'travel_distance_km', defaultValue: 0 },
  travelFee: { type: DataTypes.BIGINT, field: 'travel_fee', defaultValue: 0 },
  inRange: { type: DataTypes.BOOLEAN, field: 'in_range', defaultValue: true },
  exceededByKm: { type: DataTypes.DECIMAL(10, 2), field: 'exceeded_by_km', defaultValue: 0 },
  packageSnapshot: { type: DataTypes.TEXT, field: 'package_snapshot', defaultValue: '{}' },
  pricing: { type: DataTypes.TEXT, defaultValue: '{}' },
  status: { type: DataTypes.STRING(30), defaultValue: 'PENDING_PAYMENT' },
  expiresAt: { type: DataTypes.DATE, field: 'expires_at' },
  transactionId: { type: DataTypes.UUID, field: 'transaction_id' },
  amount: { type: DataTypes.BIGINT, defaultValue: 0 },
  currency: { type: DataTypes.STRING(10), defaultValue: 'VND' },
  notes: { type: DataTypes.TEXT }
}, { tableName: 'bookings', timestamps: true, createdAt: 'created_at', updatedAt: 'updated_at' })

export default BookingSQL
