import { DataTypes } from 'sequelize'
import { sequelize } from '../../config/sql.js'

const PTWalletTransactionSQL = sequelize.define('PTWalletTransactionSQL', {
  id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
  ptId: { type: DataTypes.UUID, field: 'pt_id', allowNull: false },
  type: { type: DataTypes.STRING(30), allowNull: false },
  direction: { type: DataTypes.STRING(20), allowNull: false },
  amount: { type: DataTypes.BIGINT, allowNull: false },
  refId: { type: DataTypes.UUID, field: 'ref_id' },
  refType: { type: DataTypes.STRING(50), field: 'ref_type' },
  status: { type: DataTypes.STRING(20), defaultValue: 'completed' },
  balanceAfter: { type: DataTypes.BIGINT, field: 'balance_after', defaultValue: 0 }
}, { tableName: 'pt_wallet_transactions', timestamps: true, createdAt: 'created_at', updatedAt: 'updated_at' })

export default PTWalletTransactionSQL
