// routes/chatRoutes.js
import express from 'express'
import StudentPackage from '../models/sql/StudentPackage.js'
import User from '../models/sql/User.js'

const router = express.Router()

// Lấy danh sách học viên của PT
router.get('/students', async (req, res) => {
  try {
    const ptId = req.user._id // lấy từ token (sau khi đăng nhập với role=pt)
    const packages = await StudentPackage.findAll({ where: { ptId, status: 'active' }, attributes: ['studentId'] })
    const students = await User.findAll({ where: { id: packages.map((item) => item.studentId) }, attributes: ['id', 'name', 'avatar', 'email'] })
    res.json(students)
  } catch (err) {
    console.error('Lỗi lấy danh sách học viên:', err)
    res.status(500).json({ message: 'Lỗi server' })
  }
})

export default router
