import express from 'express'
import { authMiddleware } from '~/middlewares/authMiddleware'
import { checkoutSqlController } from '~/controllers/checkoutSqlController.js'

const router = express.Router()

// 1) Init transaction cho 1 package
router.post(
  '/packages/checkout/init',
  authMiddleware.authenTokenCookie,
  authMiddleware.isStudent,
  checkoutSqlController.initBookingAndTransaction
)

// 2) Tạo PayOS link (QR) cho transaction đã init
router.post(
  '/transactions/:transactionId/pay',
  authMiddleware.authenTokenCookie,
  authMiddleware.isStudent,
  checkoutSqlController.createPaymentLink
)

// 3) FE confirm sau redirect
router.post(
  '/payment/confirm',
  authMiddleware.authenTokenCookie,
  authMiddleware.isStudent,
  checkoutSqlController.confirmPayment
)

// (tuỳ chọn) polling transaction status
router.get(
  '/transactions/:transactionId',
  authMiddleware.authenTokenCookie,
  authMiddleware.isStudent,
  checkoutSqlController.getTransactionStatus
)

export default router
