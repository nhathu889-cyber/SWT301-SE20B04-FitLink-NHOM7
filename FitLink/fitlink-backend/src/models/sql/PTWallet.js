import { DataTypes } from 'sequelize'
import { sequelize } from '../../config/sql.js'

const PTWalletSQL = sequelize.define('PTWalletSQL', {
  id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
  ptId: { type: DataTypes.UUID, field: 'pt_id', allowNull: false, unique: true },
  available: { type: DataTypes.BIGINT, defaultValue: 0 },
  pending: { type: DataTypes.BIGINT, defaultValue: 0 },
  totalEarned: { type: DataTypes.BIGINT, field: 'total_earned', defaultValue: 0 },
  withdrawn: { type: DataTypes.BIGINT, defaultValue: 0 }
}, { tableName: 'pt_wallets', timestamps: true, createdAt: 'created_at', updatedAt: 'updated_at' })

export default PTWalletSQL
