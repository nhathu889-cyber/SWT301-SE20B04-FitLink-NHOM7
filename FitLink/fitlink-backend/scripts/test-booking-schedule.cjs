const assert = require('node:assert/strict')
const { test, expect } = require('@jest/globals')
const { readFileSync } = require('node:fs')
const path = require('node:path')
const babel = require('@babel/core')

function load(file, dependencies) {
  const { code } = babel.transformSync(readFileSync(path.join(__dirname, '../src', file), 'utf8'), {
    babelrc: false, configFile: false, plugins: ['@babel/plugin-transform-modules-commonjs']
  })
  const exports = {}
  new Function('require', 'exports', code)(name => {
    assert.ok(name in dependencies, `Unexpected dependency: ${name}`)
    return dependencies[name]
  }, exports)
  return exports
}
const Op = { ne: Symbol('ne'), lt: Symbol('lt'), gt: Symbol('gt') }
const input = { pattern: [1, 3, 5], slot: { start: '06:00' }, startDate: '2026-09-28', totalSessions: 3, sessionDurationMin: 60 }
function service(slot = {}, session = {}) {
  return load('services/bookingSchedule.js', {
    sequelize: { Op }, '../models/sql/Slot.js': slot, '../models/sql/Session.js': session
  })
}
const { buildBookingSchedule } = service()
function checkout({ status = 'pending_transfer', scheduleError = false } = {}) {
  const calls = []
  const transaction = { id: '12345678-1234-1234-1234-123456789012', studentId: 'student', ptId: 'pt', packageId: 'pkg', bookingId: 'booking', amount: 5000, method: 'bank_transfer', status, update: async changes => Object.assign(transaction, changes) }
  const tx = { commit: async () => calls.push('commit'), rollback: async () => calls.push('rollback') }
  const enrollment = { id: 'enrollment' }
  const { checkoutSqlController: controller } = load('controllers/checkoutSqlController.js', {
    'http-status-codes': { StatusCodes: { OK: 200, CREATED: 201, BAD_REQUEST: 400, NOT_FOUND: 404, INTERNAL_SERVER_ERROR: 500 } },
    '@payos/node': class { async getPaymentLinkInformation() { throw Error('Unexpected PayOS call') } },
    sequelize: { Op }, '~/config/sql.js': { sequelize: { transaction: async () => tx } },
    '~/models/sql/Package.js': { findByPk: async () => ({ totalSessions: 8, durationDays: 30, sessionDurationMin: 60 }) },
    '~/models/sql/Booking.js': { update: async () => calls.push('booking'), findByPk: async () => ({ pattern: '[1,3,5]', slot: '{"start":"06:00","end":"07:00"}', startDate: new Date('2030-01-07') }) },
    '~/models/sql/Transaction.js': { findOne: async options => { calls.push(options.where); return transaction }, update: async () => { calls.push('claim'); return [1] } },
    '~/models/sql/StudentProfile.js': {},
    '~/models/sql/StudentPackage.js': { findOne: async () => null, create: async () => { calls.push('enrollment'); return enrollment } },
    '~/config/environment.js': { env: { PLATFORM_FEE_PERCENT: 20 } },
    '~/utils/pricingUtils.js': {},
    '~/services/sqlWalletService.js': { creditPTWalletSQL: async options => { assert.equal(options.amount, 4000); assert.equal(options.transaction, tx); calls.push('wallet') } },
    '../services/bookingSchedule.js': { createSlotsAndSessionsForBooking: async (...args) => { assert.equal(args[3], tx); calls.push('schedule'); if (scheduleError) throw Error('Slot conflict') } },
    '../config/manualPayment.js': { manualPayment: { enabled: true, amount: 5000 }, transferDetails: value => ({ amount: Number(value.amount), accountNumber: '01014941105' }) }
  })
  const res = { statusCode: 200, status(code) { this.statusCode = code; return this }, json(body) { this.body = body; return this } }
  return { controller, res, calls, transaction }
}
test('manual QR checkout uses local payment page and never calls PayOS', async () => {
  const { controller, res, transaction } = checkout({ status: 'initiated' })
  await controller.createPaymentLink({ user: { _id: 'student' }, params: { transactionId: transaction.id } }, res)
  expect(res.body.data.checkoutUrl).toBe(`/payment/transfer/${transaction.id}`)
  expect(res.body.data.transfer.amount).toBe(5000)
  expect(transaction.status).toBe('pending_transfer')
})
test('admin confirmation creates enrollment, schedule and wallet atomically', async () => {
  const { controller, res, calls, transaction } = checkout()
  await controller.confirmPayment({ user: { _id: 'admin', role: 'admin' }, params: { transactionId: transaction.id }, body: {} }, res)
  expect(res.body.data.status).toBe('paid')
  expect(calls).toContain('enrollment')
  expect(calls).toContain('schedule')
  expect(calls).toContain('wallet')
  expect(calls.at(-1)).toBe('commit')
})
test('already confirmed manual payment does not create duplicate sessions or wallet credit', async () => {
  const { controller, res, calls, transaction } = checkout({ status: 'paid' })
  await controller.confirmPayment({ user: { _id: 'admin', role: 'admin' }, params: { transactionId: transaction.id }, body: {} }, res)
  expect(res.body.data.status).toBe('paid')
  expect(calls).not.toContain('claim')
  expect(calls).not.toContain('wallet')
})
test('schedule conflict rolls back manual payment without wallet credit', async () => {
  const { controller, res, calls, transaction } = checkout({ scheduleError: true })
  await controller.confirmPayment({ user: { _id: 'admin', role: 'admin' }, params: { transactionId: transaction.id }, body: {} }, res)
  expect(res.statusCode).toBe(500)
  expect(calls.at(-1)).toBe('rollback')
  expect(calls).not.toContain('wallet')
})

test('schedule starts on selected weekday and uses UTC+7', () => {
  const items = buildBookingSchedule(input)
  assert.deepEqual(items.map(item => item.startTime.toISOString()), [
    '2026-09-27T23:00:00.000Z', '2026-09-29T23:00:00.000Z', '2026-10-01T23:00:00.000Z'
  ])
  assert.ok(items.every(item => item.endTime - item.startTime === 3600000))
})
test('schedule skips days before the first matching weekday', () => {
  const items = buildBookingSchedule({ ...input, startDate: '2026-09-29', totalSessions: 1 })
  assert.equal(items[0].startTime.toISOString(), '2026-09-29T23:00:00.000Z')
})
test('unordered and duplicate weekdays produce chronological unique sessions', () => {
  assert.deepEqual(buildBookingSchedule({ ...input, pattern: [5, 1, 3, 1] }), buildBookingSchedule(input))
})
test('Sunday is weekday zero and recurrence crosses year boundaries', () => {
  const items = buildBookingSchedule({ ...input, pattern: [0], startDate: '2026-12-31', totalSessions: 2 })
  assert.deepEqual(items.map(item => item.startTime.toISOString()), ['2027-01-02T23:00:00.000Z', '2027-01-09T23:00:00.000Z'])
})
test('JSON database fields and numeric strings are accepted', () => {
  assert.deepEqual(buildBookingSchedule({ ...input, pattern: '[1,3,5]', slot: '{"start":"06:00"}', totalSessions: '3', sessionDurationMin: '60' }), buildBookingSchedule(input))
})
test('start date uses Vietnam calendar day even near UTC midnight', () => {
  const items = buildBookingSchedule({ ...input, startDate: '2026-09-27T18:00:00Z', totalSessions: 1 })
  assert.equal(items[0].startTime.toISOString(), '2026-09-27T23:00:00.000Z')
})
test('session duration may cross midnight', () => {
  const [item] = buildBookingSchedule({ ...input, slot: { start: '23:30' }, totalSessions: 1, sessionDurationMin: 90 })
  assert.equal(item.endTime.toISOString(), '2026-09-28T18:00:00.000Z')
})
test('schedule does not mutate caller data', () => {
  const original = structuredClone(input)
  buildBookingSchedule(input)
  expect(input).toEqual(original)
})
for (const [name, changes] of [
  ['empty pattern', { pattern: [] }], ['weekday outside range', { pattern: [7] }],
  ['fractional weekday', { pattern: [1.5] }], ['string weekday', { pattern: ['1'] }],
  ['invalid JSON', { pattern: '[' }], ['missing slot', { slot: null }],
  ['invalid hour', { slot: { start: '24:00' } }], ['invalid minute', { slot: { start: '12:60' } }],
  ['zero sessions', { totalSessions: 0 }], ['too many sessions', { totalSessions: 1001 }],
  ['infinite sessions', { totalSessions: Infinity }], ['fractional sessions', { totalSessions: 1.5 }],
  ['zero duration', { sessionDurationMin: 0 }], ['unbounded duration', { sessionDurationMin: 1441 }],
  ['invalid date', { startDate: 'invalid' }]
]) test(`schedule rejects ${name}`, () => assert.throws(() => buildBookingSchedule({ ...input, ...changes })))

function persistence({ existing = false, reserved = false, conflict = false } = {}) {
  const calls = []
  const tx = { tag: 'transaction' }
  const slot = {
    findOne: async options => { calls.push(['slot.find', options]); return existing || reserved ? { id: 'slot', bookedByBookingId: reserved ? 'another-booking' : 'BOOKING' } : null },
    create: async (data, options) => { calls.push(['slot.create', data, options]); return { id: 'slot' } }
  }
  const session = {
    findOne: async options => { calls.push(['session.find', options]); return options.where.slotId ? (existing ? { id: 'session' } : null) : (conflict ? { id: 'other-session' } : null) },
    create: async (data, options) => { calls.push(['session.create', data, options]); return { id: 'session' } }
  }
  const enrollment = { id: 'enrollment', totalSessions: 1, update: async (data, options) => calls.push(['enrollment.update', data, options]) }
  const booking = { id: 'booking', ptId: 'pt', studentId: 'student', ...input }
  const pkg = { id: 'package', name: 'Training', sessionDurationMin: 60 }
  return { calls, tx, run: () => service(slot, session).createSlotsAndSessionsForBooking(booking, enrollment, pkg, tx) }
}
test('booking creates linked slot and session and forwards the caller transaction', async () => {
  const { calls, tx, run } = persistence()
  assert.deepEqual(await run(), { createdSlots: 1, createdSessions: 1 })
  for (const call of calls) assert.equal(call.at(-1).transaction, tx)
  const slot = calls.find(call => call[0] === 'slot.create')[1]
  assert.equal(slot.bookedByBookingId, 'booking')
  assert.equal(slot.status, 'BOOKED')
  const session = calls.find(call => call[0] === 'session.create')[1]
  assert.equal(session.slotId, 'slot')
  assert.equal(session.studentPackageId, 'enrollment')
  assert.equal(session.studentId, 'student')
  assert.equal(session.status, 'scheduled')
  assert.deepEqual(JSON.parse(calls.at(-1)[1].sessions), ['session'])
})
test('booking rerun reuses slots and sessions including case-insensitive booking IDs', async () => {
  const { calls, run } = persistence({ existing: true })
  assert.deepEqual(await run(), { createdSlots: 0, createdSessions: 0 })
  assert.ok(!calls.some(call => call[0].endsWith('.create')))
})
test('another booking reservation prevents any writes', async () => {
  const { calls, run } = persistence({ reserved: true })
  await assert.rejects(run(), /already reserved/)
  assert.equal(calls.length, 1)
})
test('overlapping session prevents creation and excludes cancelled/same-enrollment sessions', async () => {
  const { calls, run } = persistence({ conflict: true })
  await assert.rejects(run(), /overlapping session/)
  assert.ok(!calls.some(call => call[0].endsWith('.create') || call[0].endsWith('.update')))
  const where = calls.find(call => call[0] === 'session.find')[1].where
  assert.equal(where.status[Op.ne], 'cancelled')
  assert.equal(where.studentPackageId[Op.ne], 'enrollment')
  assert.equal(where.startTime[Op.lt].toISOString(), '2026-09-28T00:00:00.000Z')
  assert.equal(where.endTime[Op.gt].toISOString(), '2026-09-27T23:00:00.000Z')
})

function preview(pkg, pt) {
  const { scheduleController } = load('controllers/scheduleController.js', {
    'http-status-codes': { StatusCodes: { OK: 200, BAD_REQUEST: 400, NOT_FOUND: 404, INTERNAL_SERVER_ERROR: 500 } },
    '~/models/sql/PTProfile.js': { findOne: async () => pt },
    '~/models/sql/Package.js': { findByPk: async () => pkg }, '~/models/sql/Slot.js': {}
  })
  const res = { statusCode: 200, status(code) { this.statusCode = code; return this }, json(body) { this.body = body; return this }, set() { return this } }
  return { res, run: query => scheduleController.previewSchedule({ query }, res) }
}
test('preview requires package ID', async () => {
  const { res, run } = preview(null, null)
  await run({})
  assert.equal(res.statusCode, 400)
})
test('preview rejects nonexistent package', async () => {
  const { res, run } = preview(null, null)
  await run({ packageId: 'missing' })
  assert.equal(res.statusCode, 404)
})
test('preview rejects missing PT profile', async () => {
  const { res, run } = preview({ ptId: 'pt' }, null)
  await run({ packageId: 'package' })
  assert.equal(res.statusCode, 400)
})
test('preview respects working hours, breaks, session length and unavailable weekdays', async () => {
  const { res, run } = preview({ ptId: 'pt', totalSessions: 2, sessionDurationMin: 60, recurrence: '{"daysOfWeek":[[1,3]]}' }, {
    workingHours: '[{"dayOfWeek":1,"intervals":[{"start":"08:00","end":"10:30"}]}]', defaultBreakMin: 30
  })
  await run({ packageId: 'package', startDate: '2030-01-07', carryForward: 'false' })
  assert.equal(res.statusCode, 200)
  assert.deepEqual(res.body.slots.map(item => [item.date, item.start, item.end]), [
    ['2030-01-07', '08:00', '09:00'], ['2030-01-07', '09:30', '10:30']
  ])
})
