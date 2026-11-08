const assert = require('node:assert/strict')
const { randomUUID, randomInt } = require('node:crypto')
const bcrypt = require('bcrypt')
const User = require('../build/src/models/sql/User.js').default
const Package = require('../build/src/models/sql/Package.js').default
const Transaction = require('../build/src/models/sql/Transaction.js').default
const StudentPackage = require('../build/src/models/sql/StudentPackage.js').default
const Booking = require('../build/src/models/sql/Booking.js').default
const Session = require('../build/src/models/sql/Session.js').default
const { sequelize } = require('../build/src/config/sql.js')
const base = process.env.TEST_DEV_URL || 'http://localhost:5173'
const users = []
let packageId

async function request(path, cookie, body, method = body ? 'POST' : 'GET') {
  const response = await fetch(`${base}/api${path}`, {
    method, headers: { 'Content-Type': 'application/json', ...(cookie ? { Cookie: cookie } : {}) },
    ...(body ? { body: JSON.stringify(body) } : {}), signal: AbortSignal.timeout(10000)
  })
  return { status: response.status, data: await response.json(), cookie: response.headers.get('set-cookie')?.split(';')[0] }
}

async function run() {
  try {
    const password = `Test-${randomUUID()}`
    const hash = await bcrypt.hash(password, 10)
    const cookies = {}
    for (const role of ['admin', 'student']) {
      const id = randomUUID()
      const phone = `09${String(randomInt(100000000)).padStart(8, '0')}`
      users.push(id)
      await User.create({ id, phone, password: hash, role, name: 'Gym ticket test', isActive: true })
      const login = await request('/auth/login', null, { phone, password })
      assert.equal(login.status, 200)
      cookies[role] = login.cookie
    }
    const values = { name: `Gym ticket ${randomUUID()}`, description: 'Single gym entry', price: 45000, totalSessions: 1, durationDays: 1, gymName: 'Test Gym', gymAddress: 'Test address', isActive: true }
    assert.equal((await request('/gym-packages', cookies.student, values)).status, 403)
    const created = await request('/gym-packages', cookies.admin, values)
    assert.equal(created.status, 201, JSON.stringify(created.data))
    packageId = created.data.data.id
    const init = await request(`/gym-packages/${packageId}/checkout`, cookies.student, { amount: 1 })
    assert.equal(init.status, 201)
    assert.equal(Number(init.data.data.amount), 45000)
    const transactionId = init.data.data.transactionId
    assert.equal((await request(`/student/transactions/${transactionId}/pay`, cookies.student, {})).status, 200)
    const confirm = await request(`/admin/transactions/${transactionId}/confirm-transfer`, cookies.admin, {})
    assert.equal(confirm.status, 200, JSON.stringify(confirm.data))
    assert.equal(confirm.data.data.destination, '/gym-packages')
    const list = await request('/gym-packages', cookies.student)
    const ticket = list.data.enrollments.find(item => item.packageId.toLowerCase() === packageId.toLowerCase())
    assert.ok(ticket)
    assert.equal(ticket.remainingSessions, 1)
    assert.equal(ticket.ptId, null)
    assert.equal(await Booking.count({ where: { packageId } }), 0)
    assert.equal(await Session.count({ where: { studentPackageId: ticket.id } }), 0)
    assert.equal((await request(`/gym-packages/tickets/${ticket.id}/use`, cookies.student, {})).status, 403)
    assert.equal((await request(`/gym-packages/tickets/${ticket.id}/use`, cookies.admin, {})).status, 200)
    assert.equal((await request(`/gym-packages/tickets/${ticket.id}/use`, cookies.admin, {})).status, 409)
    const stored = await StudentPackage.findByPk(ticket.id)
    assert.equal(stored.remainingSessions, 0)
    const retry = await request(`/admin/transactions/${transactionId}/confirm-transfer`, cookies.admin, {})
    assert.equal(retry.status, 200)
    assert.equal(await StudentPackage.count({ where: { transactionId } }), 1)
    assert.equal((await request(`/gym-packages/${packageId}/checkout`, cookies.student, {})).status, 201)
    console.log('PASS gym ticket: admin creation, student purchase, correct price, payment activation, no PT schedule, admin-only entry, exhausted ticket rejection, idempotent confirmation and repurchase')
  } finally {
    if (packageId) {
      await StudentPackage.destroy({ where: { packageId } })
      await Transaction.destroy({ where: { packageId } })
      await Package.destroy({ where: { id: packageId } })
    }
    for (const id of users) await User.destroy({ where: { id } })
    await sequelize.close()
    console.log('Temporary test records removed')
  }
}
run().catch(error => { console.error(error); process.exitCode = 1 })
