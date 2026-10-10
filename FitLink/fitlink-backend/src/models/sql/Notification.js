import { DataTypes } from 'sequelize'
import { sequelize } from '../../config/sql.js'

const NotificationSQL = sequelize.define('NotificationSQL', {
  id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
  userId: { type: DataTypes.UUID, field: 'user_id', allowNull: false },
  type: { type: DataTypes.STRING(30), defaultValue: 'system' },
  title: { type: DataTypes.STRING(255) },
  message: { type: DataTypes.TEXT },
  read: { type: DataTypes.BOOLEAN, defaultValue: false },
  meta: { type: DataTypes.TEXT, defaultValue: '{}' }
}, { tableName: 'notifications', timestamps: true, createdAt: 'created_at', updatedAt: 'updated_at' })

export default NotificationSQL
