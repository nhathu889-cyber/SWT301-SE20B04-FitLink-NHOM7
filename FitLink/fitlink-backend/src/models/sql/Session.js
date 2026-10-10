import { DataTypes } from 'sequelize'
import { sequelize } from '../../config/sql.js'

const SessionSQL = sequelize.define('SessionSQL', {
  id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
  studentPackageId: { type: DataTypes.UUID, field: 'student_package_id', allowNull: false },
  ptId: { type: DataTypes.UUID, field: 'pt_id', allowNull: false },
  studentId: { type: DataTypes.UUID, field: 'student_id', allowNull: false },
  slotId: { type: DataTypes.UUID, field: 'slot_id' },
  title: { type: DataTypes.STRING(255), defaultValue: 'Buổi tập' },
  startTime: { type: DataTypes.DATE, field: 'start_time', allowNull: false },
  endTime: { type: DataTypes.DATE, field: 'end_time', allowNull: false },
  status: { type: DataTypes.STRING(30), defaultValue: 'scheduled' },
  attendance: { type: DataTypes.STRING(20), defaultValue: 'pending' },
  requestType: { type: DataTypes.STRING(20), field: 'request_type' },
  requestStatus: { type: DataTypes.STRING(40), field: 'request_status' },
  requestReason: { type: DataTypes.TEXT, field: 'request_reason' },
  ptNote: { type: DataTypes.TEXT, field: 'pt_note', defaultValue: '' },
  studentNote: { type: DataTypes.TEXT, field: 'student_note', defaultValue: '' },
  completedAt: { type: DataTypes.DATE, field: 'completed_at' },
  studentConfirmedAt: { type: DataTypes.DATE, field: 'student_confirmed_at' }
}, { tableName: 'sessions', timestamps: true, createdAt: 'created_at', updatedAt: 'updated_at' })

export default SessionSQL
