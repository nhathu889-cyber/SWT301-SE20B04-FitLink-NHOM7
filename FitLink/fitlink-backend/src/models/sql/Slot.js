import { DataTypes } from 'sequelize'
import { sequelize } from '../../config/sql.js'

const SlotSQL = sequelize.define('SlotSQL', {
  id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
  ptId: { type: DataTypes.UUID, field: 'pt_id', allowNull: false },
  packageId: { type: DataTypes.UUID, field: 'package_id' },
  seriesId: { type: DataTypes.STRING(255), field: 'series_id' },
  kind: { type: DataTypes.STRING(20), allowNull: false },
  status: { type: DataTypes.STRING(30), defaultValue: 'BLOCKED' },
  startTime: { type: DataTypes.DATE, field: 'start_time', allowNull: false },
  endTime: { type: DataTypes.DATE, field: 'end_time', allowNull: false },
  modes: { type: DataTypes.TEXT, defaultValue: '{"atPtGym":true,"atClient":false,"atOtherGym":false}' },
  capacity: { type: DataTypes.INTEGER, defaultValue: 1 },
  notes: { type: DataTypes.STRING(500), defaultValue: '' },
  hold: { type: DataTypes.TEXT, defaultValue: '{}' },
  bookedByBookingId: { type: DataTypes.UUID, field: 'booked_by_booking_id' },
  expiresAt: { type: DataTypes.DATE, field: 'expires_at' }
}, { tableName: 'slots', timestamps: true, createdAt: 'created_at', updatedAt: 'updated_at' })

export default SlotSQL
