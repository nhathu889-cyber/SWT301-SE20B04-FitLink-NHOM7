import { Op } from 'sequelize'
import { sequelize } from '../config/sql.js'
import User from '../models/sql/User.js'
import Notification from '../models/sql/Notification.js'

const audiences = ['individual', 'students', 'pts', 'all']
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const recipientWhere = audience => ({ isActive: true, role: audience === 'students' ? 'student' : audience === 'pts' ? 'pt' : { [Op.in]: ['student', 'pt'] } })

export const getRecipients = async (req, res) => {
  const audience = req.query.audience || 'individual'
  if (!audiences.includes(audience)) return res.status(400).json({ message: 'Invalid recipient group' })
  try {
    const where = recipientWhere(audience)
    const query = String(req.query.q || '').trim().slice(0, 100)
    if (audience === 'individual' && query) where[Op.or] = ['name', 'phone', 'email'].map(field => ({ [field]: { [Op.like]: `%${query}%` } }))
    const total = await User.count({ where })
    const items = audience === 'individual' ? await User.findAll({ where, attributes: ['id', 'name', 'phone', 'role'], order: [['name', 'ASC'], ['id', 'ASC']], limit: 50 }) : []
    return res.json({ items, total })
  } catch { return res.status(500).json({ message: 'Unable to load recipients' }) }
}

export const sendNotification = async (req, res) => {
  const { audience, userId, title, message } = req.body
  if (!audiences.includes(audience) || typeof title !== 'string' || !title.trim() || title.trim().length > 255 ||
    typeof message !== 'string' || !message.trim() || message.trim().length > 2000 ||
    (audience === 'individual' && (typeof userId !== 'string' || !uuid.test(userId)))) {
    return res.status(400).json({ message: 'Select valid recipients and enter a title (255 characters) and message (2,000 characters)' })
  }
  try {
    const notifications = await sequelize.transaction(async transaction => {
      const where = recipientWhere(audience)
      if (audience === 'individual') where.id = userId
      const users = await User.findAll({ where, attributes: ['id'], transaction })
      const records = []
      for (let offset = 0; offset < users.length; offset += 100) {
        records.push(...await Notification.bulkCreate(users.slice(offset, offset + 100).map(user => ({
          userId: user.id, title: title.trim(), message: message.trim(), type: 'system', read: false,
          meta: JSON.stringify({ senderId: req.user._id, source: 'admin', audience })
        })), { transaction }))
      }
      return records
    })
    if (!notifications.length) return res.status(400).json({ message: 'No active recipients found. Choose another recipient or group.' })
    // Delivery happens after commit; offline users still receive the saved notification.
    for (const notification of notifications) {
      try { global.sendNotificationToUser?.(notification.userId, notification) } catch { /* Saved notifications remain available through the inbox. */ }
    }
    return res.status(201).json({ success: true, sentCount: notifications.length, message: 'Notification sent' })
  } catch { return res.status(500).json({ message: 'Unable to send notification. No notifications were saved.' }) }
}
