import { DataTypes } from 'sequelize'
import { sequelize } from '../../config/sql.js'

const PendingRegistrationSQL = sequelize.define('PendingRegistrationSQL', {
  id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
  token: { type: DataTypes.STRING(255), allowNull: false },
  phone: { type: DataTypes.STRING(20), allowNull: false },
  email: { type: DataTypes.STRING(255), allowNull: false },
  name: { type: DataTypes.STRING(30), allowNull: false },
  passwordHash: { type: DataTypes.STRING(255), field: 'password_hash', allowNull: false },
  role: { type: DataTypes.STRING(20), allowNull: false, defaultValue: 'student' },
  expireAt: { type: DataTypes.DATE, field: 'expire_at', allowNull: false },
  consumed: { type: DataTypes.BOOLEAN, defaultValue: false }
}, {
  tableName: 'pending_registrations',
  timestamps: true,
  createdAt: 'created_at',
  updatedAt: 'updated_at'
})

export default PendingRegistrationSQL