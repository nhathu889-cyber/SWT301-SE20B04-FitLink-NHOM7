import { DataTypes } from 'sequelize'
import { sequelize } from '../../config/sql.js'

const TransactionSQL = sequelize.define('TransactionSQL', {
  id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
  studentId: { type: DataTypes.UUID, field: 'student_id', allowNull: false },
  ptId: { type: DataTypes.UUID, field: 'pt_id', allowNull: false },
  packageId: { type: DataTypes.UUID, field: 'package_id', allowNull: false },
  bookingId: { type: DataTypes.UUID, field: 'booking_id' },
  amount: { type: DataTypes.BIGINT, allowNull: false },
  method: { type: DataTypes.STRING(30), defaultValue: 'payos' },
  status: { type: DataTypes.STRING(30), defaultValue: 'initiated' },
  platformFee: { type: DataTypes.BIGINT, field: 'platform_fee', defaultValue: 0 },
  ptEarning: { type: DataTypes.BIGINT, field: 'pt_earning', defaultValue: 0 },
  gatewayTxnId: { type: DataTypes.STRING(255), field: 'gateway_txn_id' },
  payosOrderCode: { type: DataTypes.BIGINT, field: 'payos_order_code' },
  payosCheckoutUrl: { type: DataTypes.STRING(1000), field: 'payos_checkout_url' },
  payosInvoiceId: { type: DataTypes.STRING(255), field: 'payos_invoice_id', unique: true },
  webhookPayload: { type: DataTypes.TEXT, field: 'webhook_payload' },
  paidAt: { type: DataTypes.DATE, field: 'paid_at' }
}, { tableName: 'transactions', timestamps: true, createdAt: 'created_at', updatedAt: 'updated_at' })

export default TransactionSQL
