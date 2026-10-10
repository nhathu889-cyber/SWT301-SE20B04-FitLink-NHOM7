import express from 'express'
import { authController } from '~/controllers/authController'
import { authMiddleware } from '~/middlewares/authMiddleware'
import { authValidation } from '~/validations/authValidation'
import { userSqlController as userController } from '~/controllers/userSqlController.js'
import multer from 'multer'

const router = express.Router()
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024, files: 1 } })
const avatarUpload = (req, res, next) => upload.single('avatar')(req, res, error => {
  if (error) return res.status(400).json({ message: error.code === 'LIMIT_FILE_SIZE' ? 'Ảnh không được vượt quá 10MB.' : 'Không thể nhận file ảnh.' })
  next()
})

router.post('/login', authValidation.login, authController.login)
router.post('/logout', authController.logout)
router.get('/me', authMiddleware.authenTokenCookie, userController.getProfile)
router.get('/user-profile', authMiddleware.authenTokenCookie, userController.getUserProfile)
router.put('/profile', authMiddleware.authenTokenCookie, avatarUpload, authValidation.updateProfile, userController.updateProfile)
router.post('/upload-avatar', authMiddleware.authenTokenCookie, avatarUpload, userController.uploadAvatar)
router.put('/change-password', authValidation.changePassword, authMiddleware.authenTokenCookie, userController.changePassword)
router.post('/forgot-password', authValidation.forgotPassword, authController.forgotPassword)
router.post('/reset-password/:token', authValidation.resetPassword, authController.resetPassword)
router.post('/google', authController.loginWithGoogle)
router.post('/register/start', authController.registerByPhoneStart)
router.get('/register/confirm', authController.registerByPhoneConfirm)

export default router
