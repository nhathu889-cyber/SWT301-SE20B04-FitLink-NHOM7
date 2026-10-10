const assert = require('node:assert/strict')
const { randomUUID, randomInt } = require('node:crypto')
const bcrypt = require('bcrypt')
const User = require('../build/src/models/sql/User.js').default
const { sequelize } = require('../build/src/config/sql.js')

const base = process.env.TEST_DEV_URL || 'http://127.0.0.1:5173'
const fixtures = []
let passed = 0
const check = (name) => { passed++; console.log(`PASS ${name}`) }
const request = (path, options = {}) => fetch(`${base}/api${path}`, {
  ...options, signal: AbortSignal.timeout(10000)
})
const login = (phone, password) => request('/auth/login', {
  method: 'POST', headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ phone, password })
})

async function run() {
  try {
    assert.equal((await request('/auth/me')).status, 401)
    check('anonymous profile is rejected')
    assert.equal((await request('/admin/stats/users?year=2026')).status, 401)
    check('anonymous admin statistics are rejected')
    const password = `Test-${randomUUID()}`
    const hash = await bcrypt.hash(password, 10)
    for (const role of ['student', 'pt', 'admin']) {
      const id = randomUUID()
      let phone
      do { phone = `09${String(randomInt(100000000)).padStart(8, '0')}` }
      while (await User.count({ where: { phone } }))
      // Separate temporary users; existing accounts are never changed.
      fixtures.push(id)
      await User.create({ id, phone, password: hash, role, name: 'Auth use case', isActive: true })
      const wrong = await login(phone, 'incorrect-password')
      assert.equal(wrong.status, 401)
      check(`${role}: wrong password rejected`)
      const response = await login(phone, password)
      assert.equal(response.status, 200, await response.clone().text())
      const setCookie = response.headers.get('set-cookie')
      assert.match(setCookie || '', /HttpOnly/i)
      const cookie = setCookie.split(';')[0]
      const profile = await request('/auth/me', { headers: { Cookie: cookie } })
      assert.equal(profile.status, 200)
      const body = await profile.json()
      assert.equal(body._id.toLowerCase(), id.toLowerCase())
      assert.equal(body.role, role)
      assert.equal(body.password, undefined)
      check(`${role}: login cookie and profile through Vite proxy`)
      const admin = await request('/admin/stats/users?year=2026', { headers: { Cookie: cookie } })
      assert.equal(admin.status, role === 'admin' ? 200 : 403)
      check(`${role}: admin permission enforced`)
      const logout = await request('/auth/logout', { method: 'POST', headers: { Cookie: cookie } })
      assert.equal(logout.status, 200)
      assert.match(logout.headers.get('set-cookie') || '', /token=;/)
      assert.equal((await request('/auth/me')).status, 401)
      check(`${role}: logout clears cookie`)
      await User.update({ isActive: false }, { where: { id } })
      assert.equal((await login(phone, password)).status, 403)
      check(`${role}: locked account rejected`)
    }
    console.log(`Auth use cases: ${passed}/${passed} passed`)
  } finally {
    try {
      for (const id of fixtures) await User.destroy({ where: { id } })
      for (const id of fixtures) assert.equal(await User.count({ where: { id } }), 0)
      console.log('Temporary accounts removed')
    } finally { await sequelize.close() }
  }
}
run().catch(error => { console.error(error); process.exitCode = 1 })
