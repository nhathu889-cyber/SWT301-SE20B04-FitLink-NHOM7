import { DataTypes } from 'sequelize'
import { sequelize } from '../../config/sql.js'

const PackageSQL = sequelize.define('PackageSQL', {
  id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
  ptId: { type: DataTypes.UUID, field: 'pt_id', allowNull: false },
  name: { type: DataTypes.STRING(80), allowNull: false },
  description: { type: DataTypes.STRING(1000) },
  price: { type: DataTypes.BIGINT, defaultValue: 0 },
  recurrence: { type: DataTypes.TEXT, defaultValue: '{"daysOfWeek":[]}' },
  totalSessions: { type: DataTypes.INTEGER, field: 'total_sessions', allowNull: false },
  sessionDurationMin: { type: DataTypes.INTEGER, field: 'session_duration_min', allowNull: false },
  durationDays: { type: DataTypes.INTEGER, field: 'duration_days', allowNull: false },
  isActive: { type: DataTypes.BOOLEAN, field: 'is_active', defaultValue: true },
  visibility: { type: DataTypes.STRING(20), defaultValue: 'private' },
  supports: { type: DataTypes.TEXT, defaultValue: '{"atPtGym":true,"atClient":true,"atOtherGym":true}' },
  travelPricing: { type: DataTypes.TEXT, field: 'travel_pricing', defaultValue: '{}' },
  tags: { type: DataTypes.TEXT, defaultValue: '[]' }
}, { tableName: 'packages', timestamps: true, createdAt: 'created_at', updatedAt: 'updated_at' })

export default PackageSQL
