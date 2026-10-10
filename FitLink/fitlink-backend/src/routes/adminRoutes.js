import express from 'express'
import { userAdminSqlController as userAdminController } from '../controllers/adminSqlController.js'
import { authMiddleware } from '../middlewares/authMiddleware.js'
import PTProfile from '../models/sql/PTProfile.js'
import Booking from '../models/sql/Booking.js'
import User from '../models/sql/User.js'
import { getAllStudents } from '../controllers/studentSqlController.js'
import { getAllPTs } from '../controllers/ptSqlController.js'


const router = express.Router()

// USER
// Lấy danh sách user
router.get(
  '/users',
  authMiddleware.authenTokenCookie,
  authMiddleware.isAdmin,
  userAdminController.getAllUsers
)
// Block user
router.patch(
  '/users/:id/block',
  authMiddleware.authenTokenCookie,
  authMiddleware.isAdmin,
  userAdminController.blockUser
)
// Unlock user
router.patch(
  '/users/:id/unlock',
  authMiddleware.authenTokenCookie,
  authMiddleware.isAdmin,
  userAdminController.unlockUser
)
// Đếm số lượng khách hàng (role customer)
router.get('/users/count', authMiddleware.authenTokenCookie, authMiddleware.isAdmin, userAdminController.countCustomers)
// ADMIN OVERVIEW ROUTE
router.get('/overview', authMiddleware.authenTokenCookie, authMiddleware.isAdmin, async (req, res) => {
  try {
    // Tổng số PT (tất cả)
    const totalPTs = await PTProfile.count()

    // Tổng số học viên (tất cả user có role student)
    const totalStudents = await User.count({ where: { role: 'student' } })

    // Tổng số booking
    const totalBookings = await Booking.count()

    // Danh sách PT (tất cả)
    const approvedPTs = await PTProfile.findAll()

    res.json({
      totalPTs,
      totalStudents,
      totalBookings,
      approvedPTs
    })
  } catch (error) {
    console.error(error)
    res.status(500).send('Server error')
  }
})
router.get('/students', authMiddleware.authenTokenCookie, authMiddleware.isAdmin, getAllStudents)
router.get('/pts', authMiddleware.authenTokenCookie, authMiddleware.isAdmin, getAllPTs)
router.get(
  '/users/count',
  authMiddleware.authenTokenCookie,
  authMiddleware.isAdmin,
  userAdminController.countCustomers
)

// ✅ Thêm mới các route duyệt PT
router.get(
  '/pt-requests',
  authMiddleware.authenTokenCookie,
  authMiddleware.isAdmin,
  userAdminController.getAllPTRequests
)
router.get(
  '/pt-requests/:id',
  authMiddleware.authenTokenCookie,
  authMiddleware.isAdmin,
  userAdminController.getPTRequestDetail
)
router.post(
  '/pt-requests/:id/review',
  authMiddleware.authenTokenCookie,
  authMiddleware.isAdmin,
  userAdminController.reviewPTRequest
)
export default router
