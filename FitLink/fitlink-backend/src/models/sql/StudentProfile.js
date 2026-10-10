import { DataTypes } from 'sequelize'
import { sequelize } from '../../config/sql.js'

const StudentProfileSQL = sequelize.define('StudentProfileSQL', {
  id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
  userId: { type: DataTypes.UUID, field: 'user_id', allowNull: false, unique: true },
  heightCm: { type: DataTypes.DECIMAL(6, 2), field: 'height_cm' },
  weightKg: { type: DataTypes.DECIMAL(6, 2), field: 'weight_kg' },
  bmi: { type: DataTypes.DECIMAL(6, 2) },
  goals: { type: DataTypes.TEXT, defaultValue: '[]' },
  defaultLocation: { type: DataTypes.TEXT, field: 'default_location' },
  bmiHistory: { type: DataTypes.TEXT, field: 'bmi_history', defaultValue: '[]' }
}, { tableName: 'student_profiles', timestamps: true, createdAt: 'created_at', updatedAt: 'updated_at' })

export default StudentProfileSQL