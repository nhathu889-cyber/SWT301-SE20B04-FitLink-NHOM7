import { Op } from 'sequelize'
import Session from '../models/sql/Session.js'
import Notification from '../models/sql/Notification.js'

const REMINDER_INTERVAL_MS = 5 * 60 * 1000
const REMINDER_WINDOWS = [
  { key: '24h', min: 23 * 60 * 60 * 1000, max: 24 * 60 * 60 * 1000, label: '24 giờ' },
  { key: '1h', min: 55 * 60 * 1000, max: 60 * 60 * 1000, label: '1 giờ' },
]

async function sendReminder(session, userId, audience, window) {
  const reminderKey = `session:${session.id}:${new Date(session.startTime).getTime()}:${window.key}:${audience}`
  const exists = await Notification.findOne({
    where: { userId, type: 'session', meta: { [Op.like]: `%${reminderKey}%` } },
    attributes: ['id'],
  })
  if (exists) return

  const startTime = new Date(session.startTime)
  const notification = await Notification.create({
    userId,
    type: 'session',
    title: 'Nhắc lịch tập',
    message: `Buổi tập "${session.title || 'với PT'}" sẽ bắt đầu trong khoảng ${window.label}, lúc ${startTime.toLocaleString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' })}.`,
    meta: JSON.stringify({ sessionId: session.id, reminderKey, startTime: session.startTime }),
  })
  global.sendNotificationToUser?.(userId, notification)
}

export function startSessionReminderWorker() {
  let running = false
  const checkUpcomingSessions = async () => {
    if (running) return
    running = true
    try {
      const now = new Date()
      const latestWindow = Math.max(...REMINDER_WINDOWS.map(window => window.max))
      const until = new Date(now.getTime() + latestWindow)
      const sessions = await Session.findAll({
        where: { status: 'scheduled', startTime: { [Op.gt]: now, [Op.lte]: until } },
        attributes: ['id', 'studentId', 'ptId', 'title', 'startTime'],
      })
      for (const session of sessions) {
        const timeUntilStart = new Date(session.startTime).getTime() - now.getTime()
        const window = REMINDER_WINDOWS.find(item => timeUntilStart >= item.min && timeUntilStart <= item.max)
        if (!window) continue
        await sendReminder(session, session.studentId, 'student', window)
        await sendReminder(session, session.ptId, 'pt', window)
      }
    } catch (error) {
      console.error('Upcoming session reminder check failed:', error.message)
    } finally {
      running = false
    }
  }

  void checkUpcomingSessions()
  const timer = setInterval(checkUpcomingSessions, REMINDER_INTERVAL_MS)
  timer.unref?.()
  return timer
}
