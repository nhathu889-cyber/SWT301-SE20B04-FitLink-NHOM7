import { DataTypes } from 'sequelize'
import { sequelize } from '../../config/sql.js'

const ChatSQL = sequelize.define('ChatSQL', {
  id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
  participants: { type: DataTypes.TEXT, allowNull: false, defaultValue: '[]' },
  lastMessage: { type: DataTypes.TEXT, field: 'last_message', defaultValue: '{}' },
  unreadCount: { type: DataTypes.TEXT, field: 'unread_count', defaultValue: '{}' }
}, { tableName: 'chats', timestamps: true, createdAt: 'created_at', updatedAt: 'updated_at' })

export default ChatSQL
