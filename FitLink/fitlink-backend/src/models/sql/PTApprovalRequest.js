import { DataTypes } from 'sequelize'
import { sequelize } from '../../config/sql.js'

const PTApprovalRequestSQL = sequelize.define('PTApprovalRequestSQL', {
  id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
  userId: { type: DataTypes.UUID, field: 'user_id', allowNull: false },
  ptProfileId: { type: DataTypes.UUID, field: 'pt_profile_id', allowNull: false },
  status: { type: DataTypes.STRING(20), defaultValue: 'pending' },
  rejectReason: { type: DataTypes.STRING(1000), field: 'reject_reason', defaultValue: '' },
  adminNote: { type: DataTypes.STRING(1000), field: 'admin_note', defaultValue: '' },
  reviewedById: { type: DataTypes.UUID, field: 'reviewed_by_id' },
  reviewedAt: { type: DataTypes.DATE, field: 'reviewed_at' },
  submittedProfile: { type: DataTypes.TEXT, field: 'submitted_profile', allowNull: false, defaultValue: '{}' },
  submitCount: { type: DataTypes.INTEGER, field: 'submit_count', defaultValue: 1 },
  logs: { type: DataTypes.TEXT, defaultValue: '[]' }
}, { tableName: 'pt_approval_requests', timestamps: true, createdAt: 'created_at', updatedAt: 'updated_at' })

export default PTApprovalRequestSQL
