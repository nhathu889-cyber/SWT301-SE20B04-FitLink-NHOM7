const { test, expect } = require('@jest/globals')
const { readFileSync } = require('node:fs')
const path = require('node:path')
const babel = require('@babel/core')
const jwt = require('jsonwebtoken')
const status = require('http-status-codes')
function load(file, mocks) {
  const { code } = babel.transformSync(readFileSync(path.join(__dirname, '../src', file), 'utf8'), { babelrc: false, configFile: false, plugins: ['@babel/plugin-transform-modules-commonjs'] })
  const exports = {}
  new Function('require', 'exports', code)(name => {
    if (!(name in mocks)) throw Error(`Unexpected dependency ${name}`)
    return mocks[name]
  }, exports)
  return exports
}
const response = () => ({ statusCode: 200, status(code) { this.statusCode = code; return this }, json(body) { this.body = body; return this }, cookie: jest.fn(), set() { return this } })
const validation = load('validations/authValidation.js', { joi: require('joi'), 'http-status-codes': status }).authValidation
const middleware = load('middlewares/authMiddleware.js', { 'http-status-codes': status, jsonwebtoken: jwt, '~/config/environment': { env: { ACCESS_TOKEN_SECRET: 'unit-test-secret' } } }).authMiddleware
function auth(user) {
  return load('controllers/authController.js', {
    bcrypt: require('bcrypt'), '~/models/sql/User.js': { findOne: async () => user },
    'http-status-codes': status, '~/utils/genarateTokens': { genarateAccessToken: payload => jwt.sign(payload, 'unit-test-secret') },
    '../utils/mailer': {}, '../utils/genarateTokens': {}, crypto: require('node:crypto'), nodemailer: {},
    'google-auth-library': { OAuth2Client: class {} }, '~/config/environment': { env: { ACCESS_TOKEN_SECRET: 'unit-test-secret' } },
    '~/models/sql/PendingRegistration.js': {}, sequelize: { Op: require('sequelize').Op }, '~/domain/enums': { Roles: { STUDENT: 'student', PT: 'pt' } }
  }).authController
}
test.todo('TC_AUTH_001 registration requires email confirmation; complete lifecycle not executed')
test('TC_AUTH_002 invalid registration inputs are rejected by validation', async () => {
  const valid = { phone: '0912345678', name: 'Unit User', email: 'unit@gmail.com', password: 'Strong123!' }
  for (const change of [{ email: undefined }, { email: 'bad' }, { password: '' }, { password: '123' }]) {
    const res = response(), next = jest.fn()
    await validation.registerByPhone({ body: { ...valid, ...change } }, res, next)
    expect(res.statusCode).toBe(422)
    expect(next).not.toHaveBeenCalled()
  }
})
test('TC_AUTH_003 duplicate email is rejected before registration writes', async () => {
  const res = response()
  await auth({ id: 'existing' }).registerByPhoneStart({ body: { phone: '0912345678', name: 'Unit User', email: 'unit@gmail.com', password: 'Strong123!' } }, res)
  expect(res.statusCode).toBe(409)
})
test('TC_AUTH_004 valid phone/password issues HttpOnly session without password', async () => {
  const user = { id: 'user', role: 'student', isActive: true, phone: '0912345678', password: await require('bcrypt').hash('Strong123!', 4) }
  const res = response()
  await auth(user).login({ body: { phone: user.phone, password: 'Strong123!' } }, res)
  expect(res.statusCode).toBe(200)
  expect(res.cookie.mock.calls[0][0]).toBe('token')
  expect(res.cookie.mock.calls[0][2].httpOnly).toBe(true)
  expect(res.body.user._id).toBe('user')
  expect(res.body.user.password).toBeUndefined()
})
test('TC_AUTH_005 wrong password and invalid phone/missing password issue no session', async () => {
  const user = { id: 'user', isActive: true, password: await require('bcrypt').hash('Strong123!', 4) }
  const res = response()
  await auth(user).login({ body: { phone: '0912345678', password: 'Wrong123!' } }, res)
  expect(res.statusCode).toBe(401)
  expect(res.cookie).not.toHaveBeenCalled()
  for (const body of [{ phone: 'bad', password: 'Strong123!' }, { phone: '0912345678' }]) {
    const invalid = response(), next = jest.fn()
    await validation.login({ body }, invalid, next)
    expect(invalid.statusCode).toBe(422)
    expect(next).not.toHaveBeenCalled()
  }
})
test.todo('TC_AUTH_006 full profile request covered by separate API tests; not mapped to this unit run')
test('TC_AUTH_007 missing session is 401 and wrong role is 403', () => {
  const res = response(), next = jest.fn()
  middleware.authenTokenCookie({ cookies: {} }, res, next)
  expect(res.statusCode).toBe(401)
  middleware.isAdmin({ user: { role: 'student' } }, res, next)
  expect(res.statusCode).toBe(403)
  expect(next).not.toHaveBeenCalled()
})
test('TC_AUTH_008 malformed and expired tokens cannot access protected data', () => {
  for (const token of ['malformed', jwt.sign({ _id: 'user' }, 'unit-test-secret', { expiresIn: -1 })]) {
    const res = response(), next = jest.fn()
    middleware.authenTokenCookie({ cookies: { token } }, res, next)
    expect(res.statusCode).toBe(403)
    expect(next).not.toHaveBeenCalled()
  }
})
const pkg = { id: 'package', ptId: 'pt', name: 'Test', totalSessions: 2, sessionDurationMin: 60 }
const validBooking = { pt: 'pt', packageId: 'package', pattern: [1,3,5], slot: { start: '06:00', end: '07:00' }, startDate: '2030-01-07' }
function booking() {
  const saved = [], slots = []
  const tx = { commit: jest.fn(), rollback: jest.fn() }
  const schedule = load('services/bookingSchedule.js', { sequelize: { Op: require('sequelize').Op }, '../models/sql/Slot.js': {}, '../models/sql/Session.js': {} })
  const controller = load('controllers/bookingSqlController.js', {
    '~/config/sql.js': { sequelize: { transaction: async () => tx } }, '~/models/sql/PTProfile.js': {}, '~/models/sql/StudentPackage.js': {},
    '~/models/sql/Package.js': { findOne: async () => pkg },
    '~/models/sql/Booking.js': { create: async data => { const row = { id: `booking-${saved.length}`, ...data }; saved.push(row); return row } },
    '~/models/sql/Slot.js': { bulkCreate: async data => { slots.push(...data); return data.map((item, i) => ({ id: `slot-${i}`, ...item })) } },
    '../services/bookingSchedule.js': schedule
  })
  return { controller, saved, slots, tx }
}
test('TC_BOOK_001 create booking stores owner, package and requested schedule', async () => {
  const { controller, saved, slots, tx } = booking(), res = response()
  await controller.createBookingAndGenerateSlots({ user: { _id: 'student' }, body: validBooking }, res)
  expect(res.body.ok).toBe(true)
  expect(saved[0]).toMatchObject({ studentId: 'student', ptId: 'pt', packageId: 'package' })
  expect(JSON.parse(saved[0].pattern)).toEqual([1,3,5])
  expect(slots).toHaveLength(2)
  expect(tx.commit).toHaveBeenCalledTimes(1)
})
test('TC_BOOK_002 missing or malformed booking fields do not persist', async () => {
  for (const change of [{ pt: null }, { packageId: null }, { pattern: [] }, { slot: { start: '25:00' } }, { startDate: 'invalid' }]) {
    const { controller, saved, tx } = booking(), res = response()
    await controller.createBookingAndGenerateSlots({ user: { _id: 'student' }, body: { ...validBooking, ...change } }, res)
    expect(res.statusCode).toBe(400)
    expect(saved).toHaveLength(0)
    expect(tx.rollback).toHaveBeenCalledTimes(1)
  }
})
test('TC_BOOK_003 second booking for same exclusive slot must be rejected', async () => {
  const { controller, saved } = booking()
  await controller.createBookingAndGenerateSlots({ user: { _id: 'student' }, body: validBooking }, response())
  const res = response()
  await controller.createBookingAndGenerateSlots({ user: { _id: 'other-student' }, body: validBooking }, res)
  expect(res.statusCode).toBeGreaterThanOrEqual(400)
  expect(saved).toHaveLength(1)
})
for (const id of ['004','005','006','007','008']) test.todo(`TC_BOOK_${id} booking read/update/cancel API not implemented`)
function schedule() {
  const inserted = []
  const controller = load('controllers/scheduleController.js', {
    'http-status-codes': status,
    '~/models/sql/PTProfile.js': { findOne: async () => ({ workingHours: [{ dayOfWeek: 1, intervals: [{ start: '08:00', end: '10:00' }] }], defaultBreakMin: 0 }) },
    '~/models/sql/Package.js': { findByPk: async () => ({ ...pkg, recurrence: { daysOfWeek: [[1]] } }) },
    '~/models/sql/Slot.js': { bulkCreate: async data => { inserted.push(...data); return data } }
  }).scheduleController
  return { controller, inserted }
}
test('TC_SCH_001 valid future schedule generates matching time ranges', async () => {
  const { controller, inserted } = schedule(), res = response()
  await controller.generateSchedule({ body: { packageId: 'package', startDate: '2030-01-07', carryForward: false } }, res)
  expect(res.statusCode).toBe(201)
  expect(inserted.length).toBeGreaterThan(0)
  expect(inserted.every(item => item.endTime - item.startTime === 3600000)).toBe(true)
})
test('TC_SCH_002 missing or invalid start date cannot create a schedule', async () => {
  for (const body of [{}]) {
    const { controller, inserted } = schedule(), res = response()
    await controller.generateSchedule({ body }, res)
    expect(res.statusCode).toBeGreaterThanOrEqual(400)
    expect(res.statusCode).toBeLessThan(500)
    expect(inserted).toHaveLength(0)
  }
  // Isolate the malformed-date probe: an unbounded generation loop must not
  // hang the entire test runner. The child never imports database models.
  const { code } = babel.transformSync(readFileSync(path.join(__dirname, '../src/controllers/scheduleController.js'), 'utf8'), { babelrc: false, configFile: false, plugins: ['@babel/plugin-transform-modules-commonjs'] })
  const script = `const exports={}; const mocks={
    'http-status-codes':{StatusCodes:{BAD_REQUEST:400,CREATED:201,INTERNAL_SERVER_ERROR:500}},
    '~/models/sql/PTProfile.js':{findOne:async()=>({workingHours:[{dayOfWeek:1,intervals:[{start:'08:00',end:'10:00'}]}]})},
    '~/models/sql/Package.js':{findByPk:async()=>({ptId:'pt',totalSessions:2,sessionDurationMin:60,recurrence:{daysOfWeek:[[1]]}})},
    '~/models/sql/Slot.js':{bulkCreate:async()=>{throw Error('Invalid schedule write')}}};
    new Function('require','exports',${JSON.stringify(code)})(name=>mocks[name],exports);
    const res={code:200,status(c){this.code=c;return this},json(){process.stdout.write('RESULT:'+this.code);return this}};
    exports.scheduleController.generateSchedule({body:{packageId:'pkg',startDate:'invalid',carryForward:false}},res);`
  const probe = require('node:child_process').spawnSync(process.execPath, ['-'], { input: script, encoding: 'utf8', timeout: 1500 })
  expect(probe.error?.code).not.toBe('ETIMEDOUT')
  expect(probe.status).toBe(0)
  expect(probe.stdout).toMatch(/RESULT:4\d\d/)
})
test('TC_SCH_003 booking schedule rejects end at/before start', () => {
  const { buildBookingSchedule } = load('services/bookingSchedule.js', { sequelize: { Op: require('sequelize').Op }, '../models/sql/Slot.js': {}, '../models/sql/Session.js': {} })
  for (const end of ['06:00', '05:00']) expect(() => buildBookingSchedule({ ...validBooking, slot: { start: '06:00', end }, totalSessions: 2, sessionDurationMin: 60 })).toThrow()
})
test('TC_SCH_004 generating past schedule with carryForward disabled must reject', async () => {
  const { controller, inserted } = schedule(), res = response()
  await controller.generateSchedule({ body: { packageId: 'package', startDate: '2000-01-03', carryForward: false } }, res)
  expect(res.statusCode).toBeGreaterThanOrEqual(400)
  expect(inserted).toHaveLength(0)
})
test('TC_SCH_005 overlapping generated schedule must reject, adjacent range remains valid', async () => {
  const { controller } = schedule()
  const req = { body: { packageId: 'package', startDate: '2030-01-07', carryForward: false } }
  await controller.generateSchedule(req, response())
  const res = response()
  await controller.generateSchedule(req, res)
  expect(res.statusCode).toBeGreaterThanOrEqual(400)
})
for (const id of ['006','007','008']) test.todo(`TC_SCH_${id} schedule time update/read contract is unavailable; status update is a different operation`)
