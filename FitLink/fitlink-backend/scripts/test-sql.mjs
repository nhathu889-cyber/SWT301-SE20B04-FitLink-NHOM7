import assert from 'node:assert/strict'
import { test, after } from 'node:test'
import { readdirSync, readFileSync } from 'node:fs'
import { randomUUID } from 'node:crypto'
import { sequelize } from '../src/config/sql.js'
import User from '../src/models/sql/User.js'
import Package from '../src/models/sql/Package.js'
import Booking from '../src/models/sql/Booking.js'
import StudentPackage from '../src/models/sql/StudentPackage.js'
import Session from '../src/models/sql/Session.js'
import Slot from '../src/models/sql/Slot.js'
import PTWallet from '../src/models/sql/PTWallet.js'
import Feedback from '../src/models/sql/Feedback.js'
import Chat from '../src/models/sql/Chat.js'
import Message from '../src/models/sql/Message.js'
import { sqlResponse } from '../src/utils/sqlResponse.js'
import { parseChatRoom } from '../src/utils/chatRoom.js'
import { buildBookingSchedule, createSlotsAndSessionsForBooking } from '../src/services/bookingSchedule.js'
import { hydrateStudentPackages, hydrateSessions, hydrateFeedbacks } from '../src/services/sqlRelations.js'
import { creditPTWalletSQL } from '../src/services/sqlWalletService.js'
import { updateSessionRecord } from '../src/services/sqlSessionService.js'
import { searchPTs } from '../src/services/sqlSearchService.js'
import { seedDemoPTs } from './seed-pt-demo.mjs'
import { demoPTs } from './pt-demo-data.mjs'

after(() => sequelize.close())

test('runtime source has no legacy database dependencies or in-memory database fallback', () => {
  const scan = dir => readdirSync(dir, { withFileTypes: true }).flatMap(item => item.isDirectory() ? scan(`${dir}/${item.name}`) : [`${dir}/${item.name}`])
  for (const file of scan('src').filter(file => file.endsWith('.js'))) {
    assert.doesNotMatch(readFileSync(file, 'utf8'), /mongoose|mongodb|MONGODB|__FITLINK_USE_DEMO_DB__|models\/(?!sql)[A-Z]/, file)
  }
  const pkg = JSON.parse(readFileSync('package.json', 'utf8'))
  assert.equal(pkg.dependencies.mongoose, undefined)
  assert.equal(pkg.dependencies.mongodb, undefined)
})

test('UUID chat room keeps both complete user keys', () => {
  const a = randomUUID(), b = randomUUID()
  assert.deepEqual(parseChatRoom(`${a}-${b}`), [a, b])
  assert.deepEqual(parseChatRoom(`${a.toUpperCase()}-${b}`), [a, b])
  assert.throws(() => parseChatRoom(`${a}-${a}`))
  assert.throws(() => parseChatRoom('invalid-room'))
})

test('SQL response preserves IDs, JSON and timestamps and removes credentials', () => {
  const row = sqlResponse({ id: 'uuid', ptId: 'pt', created_at: new Date(0), meta: '{"feedbackSent":true}', password: 'secret', nested: { refreshToken: 'secret' }, slot: '{"start":"06:00"}' })
  assert.equal(row._id, 'uuid')
  assert.equal(row.pt, 'pt')
  assert.equal(row.createdAt.getTime(), 0)
  assert.equal(row.meta.feedbackSent, true)
  assert.equal(row.slot.start, '06:00')
  assert.equal(row.password, undefined)
  assert.equal(row.nested.refreshToken, undefined)
})

test('booking schedule uses Vietnam time and rejects invalid/unbounded input', () => {
  const input = { pattern: [1, 3, 5], slot: { start: '06:00' }, startDate: '2026-09-28', totalSessions: 3, sessionDurationMin: 60 }
  const result = buildBookingSchedule(input)
  assert.equal(result.length, 3)
  assert.equal(result[0].startTime.toISOString(), '2026-09-27T23:00:00.000Z')
  assert.equal(result[2].endTime.toISOString(), '2026-10-02T00:00:00.000Z')
  for (const change of [{ pattern: [] }, { pattern: [7] }, { slot: { start: '25:00' } }, { totalSessions: Infinity }, { startDate: 'invalid' }]) assert.throws(() => buildBookingSchedule({ ...input, ...change }))
})

test('all SQL models match the live SQL Server schema', async () => {
  await sequelize.authenticate()
  const files = readdirSync(new URL('../src/models/sql/', import.meta.url)).filter(file => file.endsWith('.js'))
  assert.equal(files.length, 20)
  for (const file of files) {
    const { default: model } = await import(`../src/models/sql/${file}`)
    await model.findAll({ limit: 1 })
  }
})

test('SQL lifecycle: enrollment, schedule, wallet, relations and chat persist; rollback leaves no fixtures', async () => {
  const tx = await sequelize.transaction()
  let ptId
  try {
    const pt = await User.create({ name: 'SQL test PT', role: 'pt' }, { transaction: tx })
    const student = await User.create({ name: 'SQL test student', role: 'student' }, { transaction: tx })
    ptId = pt.id
    const pkg = await Package.create({ ptId, name: 'SQL test package', totalSessions: 3, sessionDurationMin: 60, durationDays: 30 }, { transaction: tx })
    const booking = await Booking.create({ ptId, studentId: student.id, packageId: pkg.id, pattern: '[1,3,5]', slot: '{"start":"06:00","end":"07:00"}', startDate: new Date('2026-09-28T00:00:00+07:00') }, { transaction: tx })
    const enrollment = await StudentPackage.create({ ptId, studentId: student.id, packageId: pkg.id, bookingId: booking.id, totalSessions: 3, remainingSessions: 3 }, { transaction: tx })
    assert.deepEqual(await createSlotsAndSessionsForBooking(booking, enrollment, pkg, tx), { createdSlots: 3, createdSessions: 3 })
    assert.deepEqual(await createSlotsAndSessionsForBooking(booking, enrollment, pkg, tx), { createdSlots: 0, createdSessions: 0 })
    assert.equal(await Slot.count({ where: { ptId }, transaction: tx }), 3)
    const sessions = await Session.findAll({ where: { ptId }, transaction: tx })
    assert.equal(sessions.length, 3)
    const options = { transaction: tx }
    const [hydrated] = sqlResponse(await hydrateStudentPackages([enrollment], options))
    assert.equal(hydrated.student.name, student.name)
    assert.equal(hydrated.package.name, pkg.name)
    assert.equal(hydrated.sessions.length, 3)
    assert.equal(sqlResponse(await hydrateSessions(sessions, options))[0].pt._id.toLowerCase(), ptId.toLowerCase())
    let completionRequests = 0
    for (const session of sessions) {
      const notifications = await updateSessionRecord(session, { status: 'completed' }, tx)
      completionRequests += notifications.filter(item => JSON.parse(item.meta).feedbackRequest).length
    }
    assert.equal(completionRequests, 1)
    assert.equal((await updateSessionRecord(sessions[0], { status: 'completed' }, tx)).length, 1)
    await enrollment.reload(options)
    assert.equal(enrollment.status, 'completed')
    assert.equal(enrollment.remainingSessions, 0)
    const feedback = await Feedback.create({ studentPackageId: enrollment.id, ptId, studentId: student.id, rating: 5 }, options)
    assert.equal((await hydrateFeedbacks([feedback], options))[0].studentPackage.package.name, pkg.name)
    const ref = randomUUID()
    assert.equal((await creditPTWalletSQL({ ptId, amount: 80000, transactionId: ref, transaction: tx })).duplicated, false)
    assert.equal((await creditPTWalletSQL({ ptId, amount: 80000, transactionId: ref, transaction: tx })).duplicated, true)
    assert.equal(Number((await PTWallet.findOne({ where: { ptId }, transaction: tx })).available), 80000)
    const chat = await Chat.create({ participants: JSON.stringify([ptId, student.id]) }, options)
    const message = await Message.create({ chatId: chat.id, senderId: student.id, text: 'SQL chat test', attachments: '[]' }, options)
    const saved = sqlResponse(await Message.findByPk(message.id, options))
    assert.equal(saved.sender.toLowerCase(), student.id.toLowerCase())
    assert.deepEqual(saved.attachments, [])
  } finally {
    await tx.rollback()
  }
  assert.equal(await User.findByPk(ptId), null)
})

test('SQL demo seed can run twice without duplicating records or resetting passwords', async () => {
  const tx = await sequelize.transaction()
  try {
    const account = { ...demoPTs[0], name: `SQL Search ${randomUUID().slice(0, 8)}`, email: `${randomUUID()}@seed.test`, phone: null }
    await seedDemoPTs(tx, [account])
    const user = await User.findOne({ where: { email: account.email }, transaction: tx })
    await user.update({ password: 'preserved-password-hash' }, { transaction: tx })
    await seedDemoPTs(tx, [account])
    await user.reload({ transaction: tx })
    assert.equal(user.password, 'preserved-password-hash')
    assert.equal(await User.count({ where: { email: account.email }, transaction: tx }), 1)
    assert.equal(await Package.count({ where: { ptId: user.id }, transaction: tx }), account.packages.length)
    const search = await searchPTs({ name: account.name, area: 'Ho Chi Minh', specialty: 'weight_loss', modes: ['atClient'], sortBy: 'price' }, { transaction: tx })
    assert.equal(search.total, 1)
    assert.equal(search.items[0].userInfo.name, account.name)
    assert.equal(search.items[0].lowestPricePerSession, 320000)
    assert.equal(search.items[0].packages.length, 2)
    assert.equal((await searchPTs({ name: account.name, area: 'Ha Noi' }, { transaction: tx })).total, 0)
    assert.equal((await searchPTs({ name: account.name, coords: '10.7746,106.7021', packageTime: 'long' }, { transaction: tx })).items[0].packages.length, 1)
    assert.equal((await searchPTs({ name: account.name, availableAt: '2030-01-01T06:30:00+07:00' }, { transaction: tx })).total, 0)
  } finally {
    await tx.rollback()
  }
})
