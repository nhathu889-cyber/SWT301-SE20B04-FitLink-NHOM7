import { DataTypes } from 'sequelize'
import { sequelize } from '../../config/sql.js'

const FeedbackSQL = sequelize.define('FeedbackSQL', {
  id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
  studentPackageId: { type: DataTypes.UUID, field: 'student_package_id', allowNull: false },
  sessionIndex: { type: DataTypes.INTEGER, field: 'session_index' },
  studentId: { type: DataTypes.UUID, field: 'student_id', allowNull: false },
  ptId: { type: DataTypes.UUID, field: 'pt_id', allowNull: false },
  rating: { type: DataTypes.INTEGER, allowNull: false },
  comment: { type: DataTypes.TEXT, defaultValue: '' }
}, { tableName: 'feedbacks', timestamps: true, createdAt: 'created_at', updatedAt: 'updated_at' })

export default FeedbackSQL
