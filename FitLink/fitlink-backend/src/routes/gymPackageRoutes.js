import express from 'express'
import { authMiddleware as auth } from '../middlewares/authMiddleware.js'
import * as controller from '../controllers/gymPackageController.js'

const router = express.Router()
router.use(auth.authenTokenCookie)
router.get('/', controller.list)
router.post('/', auth.isAdmin, controller.save)
router.put('/:id', auth.isAdmin, controller.save)
router.post('/tickets/:id/use', auth.isAdmin, controller.useVisit)
router.post('/:id/checkout', auth.isStudent, controller.checkout)
export default router
