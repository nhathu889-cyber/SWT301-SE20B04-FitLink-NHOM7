import express from 'express'
import { authMiddleware } from '../middlewares/authMiddleware.js'
import { getBlocksSimple, listBookings, cancelMyBooking, approveBooking, rejectBooking } from '../controllers/bookingSqlController.js'

const router = express.Router()

router.get(
  '/mine',
  authMiddleware.authenTokenCookie,
  authMiddleware.isStudent,
  listBookings
)
router.get('/pt/mine', authMiddleware.authenTokenCookie, authMiddleware.isPT, listBookings)
router.post('/:bookingId/approve', authMiddleware.authenTokenCookie, authMiddleware.isPT, approveBooking)
router.post('/:bookingId/reject', authMiddleware.authenTokenCookie, authMiddleware.isPT, rejectBooking)
router.get('/admin/all', authMiddleware.authenTokenCookie, authMiddleware.isAdmin, listBookings)
router.post('/:bookingId/cancel', authMiddleware.authenTokenCookie, authMiddleware.isStudent, cancelMyBooking)

router.get(
  '/:ptId/blocks-simple',
  authMiddleware.authenTokenCookie,
  getBlocksSimple
)
export default router
