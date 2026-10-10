import StudentProfile from '~/models/sql/StudentProfile.js'
import Session from '~/models/sql/Session.js'
import { StatusCodes } from 'http-status-codes'

const parseHistory = (value) => {
  try { return value ? JSON.parse(value) : [] } catch { return [] }
}

const getBMIBySession = async (req, res) => {
  try {
    const profile = await StudentProfile.findOne({ where: { userId: req.user?._id } })
    const item = parseHistory(profile?.bmiHistory).find((entry) => String(entry.session) === String(req.params.sessionId))
    return res.json(item ? { exists: true, data: item } : { exists: false })
  } catch (error) { return res.status(500).json({ message: error.message }) }
}

const updateBMIBySession = async (req, res) => {
  try {
    const { sessionId, heightCm, weightKg, note } = req.body
    if (!sessionId || !heightCm || !weightKg || heightCm <= 0 || weightKg <= 0) return res.status(StatusCodes.BAD_REQUEST).json({ message: 'Thiếu dữ liệu BMI hợp lệ' })
    const session = await Session.findByPk(sessionId)
    if (!session) return res.status(StatusCodes.NOT_FOUND).json({ message: 'Không tìm thấy session' })
    if (String(session.studentId) !== String(req.user?._id)) return res.status(StatusCodes.FORBIDDEN).json({ message: 'Session không thuộc về user này' })
    const [profile] = await StudentProfile.findOrCreate({ where: { userId: req.user._id }, defaults: { userId: req.user._id } })
    const history = parseHistory(profile.bmiHistory)
    if (history.some((entry) => String(entry.session) === String(sessionId))) return res.status(StatusCodes.CONFLICT).json({ message: 'Buổi tập này đã được nhập BMI trước đó' })
    const bmi = Number((weightKg / Math.pow(heightCm / 100, 2)).toFixed(2))
    history.push({ session: sessionId, heightCm, weightKg, bmi, note: note || '', createdAt: new Date() })
    await profile.update({ bmiHistory: JSON.stringify(history), heightCm, weightKg, bmi })
    return res.json({ success: true, message: 'Đã lưu BMI thành công cho buổi tập', data: history[history.length - 1] })
  } catch (error) { return res.status(500).json({ message: 'Lỗi server', error: error.message }) }
}

const getBMIHistory = async (req, res) => {
  try {
    const profile = await StudentProfile.findOne({ where: { userId: req.user._id } })
    return res.json(parseHistory(profile?.bmiHistory))
  } catch (error) { return res.status(500).json({ message: error.message }) }
}

export { getBMIBySession, updateBMIBySession, getBMIHistory }
