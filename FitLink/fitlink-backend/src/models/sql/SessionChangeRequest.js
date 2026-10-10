import { DataTypes } from 'sequelize'
import { sequelize } from '../../config/sql.js'

const SessionChangeRequestSQL = sequelize.define('SessionChangeRequestSQL', {
  id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
  sessionId: { type: DataTypes.UUID, field: 'session_id', allowNull: false },
  studentId: { type: DataTypes.UUID, field: 'student_id', allowNull: false },
  ptId: { type: DataTypes.UUID, field: 'pt_id', allowNull: false },
  reason: { type: DataTypes.TEXT, allowNull: false },
  newStartTime: { type: DataTypes.DATE, field: 'new_start_time', allowNull: false },
  newEndTime: { type: DataTypes.DATE, field: 'new_end_time', allowNull: false },
  status: { type: DataTypes.STRING(20), defaultValue: 'pending' },
  rejectReason: { type: DataTypes.TEXT, field: 'reject_reason' }
}, { tableName: 'session_change_requests', timestamps: true, createdAt: 'created_at', updatedAt: 'updated_at' })

export default SessionChangeRequestSQL
