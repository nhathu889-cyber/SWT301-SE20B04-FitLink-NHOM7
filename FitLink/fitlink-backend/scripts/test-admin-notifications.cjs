const assert = require('node:assert/strict')
const { randomUUID } = require('node:crypto')
const { once } = require('node:events')
const jwt = require('jsonwebtoken')

process.env.APP_HOST = '127.0.0.1'
process.env.APP_PORT = '0'
process.env.ACCESS_TOKEN_SECRET = randomUUID()
const { startServer } = require('../build/src/server.js')
const { sequelize } = require('../build/src/config/sql.js')
const User = require('../build/src/models/sql/User.js').default
const Notification = require('../build/src/models/sql/Notification.js').default
const ids = []

async function run() {
  let server
  try {
    const identities = {}
    for (const role of ['admin', 'student', 'pt']) {
      const id = randomUUID()
      ids.push(id)
      await User.create({ id, role, name: 'Notification test', isActive: true })
      identities[role] = jwt.sign({ _id: id, role }, process.env.ACCESS_TOKEN_SECRET, { expiresIn: '5m' })
    }
    server = await startServer()
    if (!server.listening) await once(server, 'listening')
    const base = `http://127.0.0.1:${server.address().port}`
    const request = async (path, role, body) => {
      const response = await fetch(`${base}/api${path}`, {
        method: body ? 'POST' : 'GET', headers: { 'Content-Type': 'application/json', ...(role ? { Cookie: `token=${identities[role]}` } : {}) },
        ...(body ? { body: JSON.stringify(body) } : {}), signal: AbortSignal.timeout(10000)
      })
      return { status: response.status, body: await response.json() }
    }
    const payload = { audience: 'individual', userId: ids[1], title: 'Test announcement', message: 'For a temporary test account only.' }
    assert.equal((await request('/admin/notifications', null, payload)).status, 401)
    for (const role of ['student', 'pt']) {
      assert.equal((await request('/admin/notifications', role, payload)).status, 403)
      assert.equal((await request('/admin/notifications/recipients', role)).status, 403)
    }
    for (const invalid of [{ title: '' }, { title: 'a'.repeat(256) }, { message: ' ' }, { message: 'x'.repeat(2001) }, { userId: 'not-a-uuid' }, { audience: 'admins' }]) {
      assert.equal((await request('/admin/notifications', 'admin', { ...payload, ...invalid })).status, 400)
    }
    assert.equal(await Notification.count({ where: { userId: ids[1] } }), 0)
    for (const audience of ['students', 'pts', 'all']) {
      const response = await request(`/admin/notifications/recipients?audience=${audience}`, 'admin')
      assert.equal(response.status, 200)
      assert.ok(response.body.total > 0)
      assert.deepEqual(response.body.items, [])
    }
    const recipients = await request('/admin/notifications/recipients?q=Notification%20test', 'admin')
    assert.equal(recipients.status, 200)
    assert.ok(recipients.body.items.some(user => user.id.toLowerCase() === ids[1].toLowerCase()))
    assert.ok(recipients.body.items.every(user => ['student', 'pt'].includes(user.role)))
    assert.doesNotMatch(JSON.stringify(recipients.body), /"(?:password|refreshToken|email)":/)
    const delivered = []
    global.sendNotificationToUser = (id, notification) => { delivered.push(id); assert.ok(notification.id) }
    const sent = await request('/admin/notifications', 'admin', payload)
    assert.equal(sent.status, 201, JSON.stringify(sent.body))
    assert.equal(sent.body.sentCount, 1)
    assert.deepEqual(delivered.map(id => id.toLowerCase()), [ids[1].toLowerCase()])
    const inbox = await request('/notifications', 'student')
    assert.equal(inbox.body.items.length, 1)
    assert.equal(inbox.body.items[0].title, payload.title)
    assert.equal(inbox.body.items[0].message, payload.message)
    assert.equal(inbox.body.totalUnread, 1)
    assert.equal((await request('/notifications', 'pt')).body.items.length, 0)
    await User.update({ isActive: false }, { where: { id: ids[1] } })
    assert.equal((await request('/admin/notifications', 'admin', payload)).status, 400)
    assert.equal(await Notification.count({ where: { userId: ids[1] } }), 1)
    assert.equal((await request('/admin/notifications', 'admin', { ...payload, userId: ids[0] })).status, 400)
    console.log('PASS: admin authorization, validation, audience counts, safe recipient search, targeted persistence, unread inbox, realtime dispatch, locked-account exclusion')
  } finally {
    await Notification.destroy({ where: { userId: ids } })
    await User.destroy({ where: { id: ids } })
    if (server) {
      server.closeAllConnections()
      await new Promise(resolve => server.close(resolve))
    }
    await sequelize.close()
    console.log('Temporary users and notifications removed; no real users were notified')
  }
}
run().catch(error => { console.error(error); process.exitCode = 1 })
