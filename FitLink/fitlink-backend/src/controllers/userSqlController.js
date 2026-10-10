import User from '~/models/sql/User.js'
import bcrypt from 'bcrypt'
import { storeImage } from '../services/imageStorage.js'

const publicUser = (record) => { const data = record.toJSON ? record.toJSON() : record; data.hasPassword = Boolean(data.password); delete data.password; delete data.refreshToken; data._id = data.id; data.address = data.homeAddress || ''; return data }
const getProfile = async (req, res) => { try { const user = await User.findByPk(req.user._id); if (!user) return res.status(404).json({ message: 'Không tìm thấy người dùng' }); return res.json(publicUser(user)) } catch (error) { return res.status(500).json({ message: error.message }) } }
const getUserProfile = getProfile
const uploadAvatar = async (req, res) => {
  let stored
  try {
    if (!req.file) return res.status(400).json({ message: 'Chưa chọn ảnh.' })
    const user = await User.findByPk(req.user._id)
    if (!user) return res.status(404).json({ message: 'Không tìm thấy người dùng' })
    stored = await storeImage(req.file, process.env.PUBLIC_API_URL || req.protocol + '://' + req.get('host'))
    await user.update({ avatar: stored.url })
    return res.json({ url: stored.url })
  } catch (error) {
    if (stored) await stored.discard().catch(() => {})
    return res.status(error.statusCode || 500).json({ message: error.statusCode === 400 ? error.message : 'Không thể lưu ảnh. Vui lòng thử lại.' })
  }
}
const updateProfile = async (req, res) => {
  let stored
  try {
    const { name, email, gender, address, dob, avatar } = req.body
    if (name && (name.length < 2 || name.length > 30)) return res.status(400).json({ message: 'Tên phải từ 2-30 ký tự' })
    if (gender && !['male', 'female', 'other'].includes(gender)) return res.status(400).json({ message: 'Giới tính không hợp lệ' })
    const user = await User.findByPk(req.user._id)
    if (!user) return res.status(404).json({ message: 'Không tìm thấy người dùng' })

    let avatarUrl = avatar
    if (req.file) {
      stored = await storeImage(req.file, process.env.PUBLIC_API_URL || req.protocol + '://' + req.get('host'))
      avatarUrl = stored.url
    }

    const changes = { name, email, gender, homeAddress: address, dob, avatar: avatarUrl }
    const providedChanges = Object.fromEntries(Object.entries(changes).filter(([, value]) => value !== undefined))
    await user.update(providedChanges)
    return res.json({ message: 'Cập nhật thông tin thành công', user: publicUser(user) })
  } catch (error) {
    if (stored) await stored.discard().catch(() => {})
    return res.status(error.statusCode || 500).json({ message: error.statusCode === 400 ? error.message : 'Không thể lưu hồ sơ hoặc ảnh. Vui lòng thử lại.' })
  }
}
const changePassword = async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body
    const user = await User.findByPk(req.user._id)
    if (!user) return res.status(404).json({ message: 'Không tìm thấy người dùng' })
    if (!user.password) return res.status(400).json({ message: 'Tài khoản này chưa có mật khẩu FitLink. Nếu đăng nhập bằng Google, hãy tiếp tục dùng Google; mật khẩu Google được quản lý trong tài khoản Google.' })
    if (!(await bcrypt.compare(currentPassword, user.password))) return res.status(401).json({ message: 'Mật khẩu hiện tại không đúng' })
    await user.update({ password: await bcrypt.hash(newPassword, 10) })
    return res.json({ message: 'Đổi mật khẩu thành công' })
  } catch (error) {
    return res.status(500).json({ message: error.message })
  }
}
export const userSqlController = { getProfile, getUserProfile, uploadAvatar, updateProfile, changePassword }
