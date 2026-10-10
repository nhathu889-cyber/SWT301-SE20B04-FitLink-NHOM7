import Session from '../models/sql/Session.js'
import { Op } from 'sequelize'
import { hydrateSessions } from '../services/sqlRelations.js'

// ✅ API lấy danh sách lịch tập (lọc theo user, vai trò, gói, thời gian)
export const getTrainingSessions = async (req, res) => {
  try {
    const { userId, role, type, packageId } = req.query
    const now = new Date()

    // 🧠 Cơ sở lọc theo role
    const where = role === 'pt' ? { ptId: userId } : { studentId: userId }

    // 🧩 Nếu có packageId → chỉ lấy lịch của gói đó
    if (packageId) {
      where.studentPackageId = packageId
    }

    // ⏱️ Lọc theo loại thời gian
    switch (type) {
    case 'upcoming':
      where.startTime = { [Op.gt]: now }
      break
    case 'ongoing':
      where.startTime = { [Op.lte]: now }
      where.endTime = { [Op.gte]: now }
      break
    case 'history':
      where.endTime = { [Op.lt]: now }
      break
    default:
      break
    }

    const filter = where

    // console.log('📥 Query filter:', filter)
    if (!(req.query.role === 'student' && req.query.packageId)) {
      console.log('📥 Query filter:', filter)
    }
    const sessions = await Session.findAll({ where: filter, order: [['start_time', 'ASC']] })

    res.status(200).json({
      success: true,
      message: `Fetched ${type || 'all'} training sessions successfully`,
      sessions: await hydrateSessions(sessions)
    })
  } catch (err) {
    console.error('❌ Lỗi khi lấy training sessions:', err)
    res.status(500).json({
      success: false,
      message: 'Error fetching training sessions',
      error: err.message
    })
  }
}
