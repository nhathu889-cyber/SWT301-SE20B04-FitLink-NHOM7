import { DataTypes } from 'sequelize'
import { sequelize } from '../../config/sql.js'

const MessageSQL = sequelize.define('MessageSQL', {
  id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
  chatId: { type: DataTypes.UUID, field: 'chat_id', allowNull: false },
  senderId: { type: DataTypes.UUID, field: 'sender_id', allowNull: false },
  text: { type: DataTypes.STRING(2000), allowNull: false },
  attachments: { type: DataTypes.TEXT, defaultValue: '[]' },
  readBy: { type: DataTypes.TEXT, field: 'read_by', defaultValue: '[]' },
  read: { type: DataTypes.BOOLEAN, defaultValue: false },
  readAt: { type: DataTypes.DATE, field: 'read_at' }
}, { tableName: 'messages', timestamps: true, createdAt: 'created_at', updatedAt: 'updated_at' })

export default MessageSQL
