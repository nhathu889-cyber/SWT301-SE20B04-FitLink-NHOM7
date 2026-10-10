import { DataTypes } from 'sequelize'
import { sequelize } from '../../config/sql.js'

const PayoutRequestSQL = sequelize.define('PayoutRequestSQL', {
  id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
  ptId: { type: DataTypes.UUID, field: 'pt_id', allowNull: false },
  accountName: { type: DataTypes.STRING(255), field: 'account_name', allowNull: false },
  accountNumber: { type: DataTypes.STRING(100), field: 'account_number', allowNull: false },
  bankName: { type: DataTypes.STRING(255), field: 'bank_name', allowNull: false },
  amount: { type: DataTypes.BIGINT, allowNull: false },
  status: { type: DataTypes.STRING(20), defaultValue: 'pending' },
  adminNote: { type: DataTypes.TEXT, field: 'admin_note', defaultValue: '' },
  processedById: { type: DataTypes.UUID, field: 'processed_by_id' },
  processedAt: { type: DataTypes.DATE, field: 'processed_at' },
  walletTransactionId: { type: DataTypes.UUID, field: 'wallet_transaction_id' }
}, { tableName: 'payout_requests', timestamps: true, createdAt: 'created_at', updatedAt: 'updated_at' })

export default PayoutRequestSQL
