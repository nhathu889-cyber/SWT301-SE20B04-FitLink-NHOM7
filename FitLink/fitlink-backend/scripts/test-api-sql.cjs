const assert = require('node:assert/strict')
const { randomUUID } = require('node:crypto')
const { once } = require('node:events')
const jwt = require('jsonwebtoken')

process.env.APP_HOST = '127.0.0.1'
process.env.APP_PORT = '0'
// This short-lived server has its own signing key; no real session is reused.
process.env.ACCESS_TOKEN_SECRET = randomUUID()
const { startServer } = require('../build/src/server.js')
const { sequelize } = require('../build/src/config/sql.js')

const run = async () => {
  let server
  try {
    server = await startServer()
    if (!server.listening) await once(server, 'listening')
    const base = `http://127.0.0.1:${server.address().port}`
    const identities = {}
    for (const role of ['student', 'pt', 'admin']) {
      const [rows] = await sequelize.query('SELECT TOP 1 id FROM users WHERE role = :role', { replacements: { role } })
      identities[role] = { _id: rows[0]?.id || randomUUID(), role }
    }
    const cases = [
      ['student', '/api/search/pts'],
      ['student', '/api/pt/public/list'],
      ['student', '/api/student-packages/my-packages'],
      ['student', '/api/notifications'],
      ['student', '/api/messages/my-pts'],
      ['student', `/api/messages/${identities.student._id}-${identities.pt._id}`],
      ['student', `/api/training-sessions?role=student&userId=${identities.student._id}`],
      ...['dashboard', 'payment', 'sessions-completed', 'progress', 'history'].map(path => ['student', `/api/student-stats/${path}`]),
      ...['me/verification-status', 'me/students', 'me/packages', 'me/dashboard', 'packages', 'students', 'materials', 'requests'].map(path => ['pt', `/api/pt/${path}`]),
      ...['revenue', 'users', 'sessions-completed', 'cancel-rate', 'rating'].map(path => ['pt', `/api/pt/stats/${path}`]),
      ['pt', '/api/feedbacks/me'],
      ['pt', '/api/payouts/pt/my-requests'],
      ...['revenue', 'users', 'booking-trends', 'top-pt'].map(path => ['admin', `/api/admin/stats/${path}?year=${new Date().getFullYear()}`]),
      ['admin', '/api/payouts/admin']
    ]
    for (const [role, path] of cases) {
      const token = jwt.sign(identities[role], process.env.ACCESS_TOKEN_SECRET, { expiresIn: '2m' })
      const response = await fetch(`${base}${path}`, { headers: { Cookie: `token=${token}` }, signal: AbortSignal.timeout(10000) })
      const body = await response.json()
      assert.equal(response.status, 200, `${path}: ${body.message || body.error || response.status}`)
      assert.doesNotMatch(JSON.stringify(body), /"(?:password|passwordHash|refreshToken|resetPasswordToken)":/, path)
    }
    const search = await (await fetch(`${base}/api/search/pts`)).json()
    for (const pt of search.items) {
      for (const id of [pt.userId, pt._id]) {
        const response = await fetch(`${base}/api/pt/public/${id}`)
        assert.equal(response.status, 200, `PT detail for ${id}`)
        const body = await response.json()
        assert.equal(body.data.user._id.toLowerCase(), pt.userId.toLowerCase())
        assert.equal(typeof body.data.user.name, 'string')
        assert.equal(body.data.user.password, undefined)
      }
      const response = await fetch(`${base}/api/pt/${pt.userId}/packages`)
      assert.equal(response.status, 200)
      const body = await response.json()
      assert.ok(Array.isArray(body.data))
      assert.equal(body.data.length, pt.packages.length)
    }
    console.log(`PT detail regression: ${search.items.length} trainers, user/profile IDs and packages passed.`)
    console.log(`SQL API smoke: ${cases.length}/${cases.length} endpoints passed; read-only checks, no external payments or email.`)
  } finally {
    if (server) await new Promise(resolve => server.close(resolve))
    await sequelize.close()
  }
}
run().catch(error => { console.error(error.message); process.exitCode = 1 })
