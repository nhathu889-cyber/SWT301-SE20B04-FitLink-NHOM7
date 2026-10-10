// src/services/notificationService.js
import Notification from '../models/sql/Notification.js'

export const createNotification = async ({ user, title, message, type = 'system', meta = {} }) => {
  const notification = await Notification.create({ userId: user, title, message, type, meta: JSON.stringify(meta), read: false })
  return notification
}

export const getUserNotifications = async (userId, limit = 20) => {
  const [items, totalUnread] = await Promise.all([
    Notification.findAll({ where: { userId }, order: [['created_at', 'DESC']], limit }),
    Notification.count({ where: { userId, read: false } })
  ])
  return { items, totalUnread }
}

export const markNotificationAsRead = async (notificationId) => {
  const notification = await Notification.findByPk(notificationId)
  if (!notification) return null
  await notification.update({ read: true })
  return notification
}

export const markAllNotificationsAsRead = async (userId) => {
  await Notification.update({ read: true }, { where: { userId, read: false } })
  const totalUnread = await Notification.count({ where: { userId, read: false } })
  return { ok: true, totalUnread }
}
