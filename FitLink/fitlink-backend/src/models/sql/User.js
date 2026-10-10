import { DataTypes } from 'sequelize'
import { sequelize } from '../../config/sql.js'

const UserSQL = sequelize.define('UserSQL', {
  id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
  email: { type: DataTypes.STRING(255), allowNull: true },
  phone: { type: DataTypes.STRING(20), allowNull: true },
  password: { type: DataTypes.STRING(255), allowNull: true },
  googleId: { type: DataTypes.STRING(255), field: 'google_id' },
  role: { type: DataTypes.STRING(20), defaultValue: 'student' },
  name: { type: DataTypes.STRING(30) },
  avatar: { type: DataTypes.STRING(500), defaultValue: '' },
  gender: { type: DataTypes.STRING(20), defaultValue: 'other' },
  homeAddress: { type: DataTypes.STRING(500), field: 'home_address', defaultValue: '' },
  homeLatitude: { type: DataTypes.DECIMAL(10, 7), field: 'home_latitude' },
  homeLongitude: { type: DataTypes.DECIMAL(10, 7), field: 'home_longitude' },
  dob: { type: DataTypes.DATE },
  isActive: { type: DataTypes.BOOLEAN, field: 'is_active', defaultValue: true },
  refreshToken: { type: DataTypes.STRING(500), field: 'refresh_token', defaultValue: '' },
  resetPasswordToken: { type: DataTypes.STRING(255), field: 'reset_password_token' },
  resetTokenExpires: { type: DataTypes.DATE, field: 'reset_token_expires' }
}, {
  tableName: 'users',
  timestamps: true,
  createdAt: 'created_at',
  updatedAt: 'updated_at'
})

export default UserSQL