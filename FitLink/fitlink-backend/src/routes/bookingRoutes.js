import express from 'express'
import { authMiddleware } from '../middlewares/authMiddleware.js'
import { getBlocksSimple, createBookingAndGenerateSlots } from '../controllers/bookingSqlController.js'

const router = express.Router()

router.get(
  '/:ptId/blocks-simple',
  authMiddleware.authenTokenCookie,
  getBlocksSimple
)
// FE đẩy full payload ở body
router.post('/create-slots', authMiddleware.authenTokenCookie, authMiddleware.isStudent, createBookingAndGenerateSlots)

export default router
