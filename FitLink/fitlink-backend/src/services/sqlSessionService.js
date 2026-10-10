import Session from '../models/sql/Session.js'
import StudentPackage from '../models/sql/StudentPackage.js'
import Notification from '../models/sql/Notification.js'

export const updateSessionRecord = async (session, updates, transaction) => {
  await session.update(updates, { transaction })
  const notification = await Notification.create({ userId: session.studentId, type: 'session', title: 'Session Update', message: `The session "${session.title}" has been updated: ${session.status}.`, meta: JSON.stringify({ sessionId: session.id, status: session.status, ptNote: session.ptNote }) }, { transaction })
  const notifications = [notification]
  const enrollment = await StudentPackage.findByPk(session.studentPackageId, { transaction })
  if (enrollment) {
    const completed = await Session.count({ where: { studentPackageId: enrollment.id, status: 'completed' }, transaction })
    const remainingSessions = Math.max(0, Number(enrollment.totalSessions) - completed)
    const finished = Number(enrollment.totalSessions) > 0 && remainingSessions === 0
    const firstCompletion = finished && enrollment.status !== 'completed'
    await enrollment.update({ remainingSessions, ...(finished ? { status: 'completed' } : enrollment.status === 'completed' ? { status: 'active' } : {}) }, { transaction })
    if (firstCompletion) notifications.push(await Notification.create({
      userId: session.studentId, type: 'session', title: 'Training Package Completed',
      message: 'You have completed your training package. Please leave feedback for your trainer.',
      meta: JSON.stringify({ ptId: session.ptId, studentPackageId: enrollment.id, feedbackRequest: true })
    }, { transaction }))
  }
  return notifications
}
