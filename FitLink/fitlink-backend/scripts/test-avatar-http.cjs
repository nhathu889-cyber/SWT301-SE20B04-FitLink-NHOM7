const assert = require('node:assert/strict')
const { once } = require('node:events')
const { randomUUID } = require('node:crypto')
const { unlink } = require('node:fs/promises')
const path = require('node:path')
const jwt = require('jsonwebtoken')
process.env.APP_HOST = '127.0.0.1'
process.env.APP_PORT = '0'
process.env.IMAGE_STORAGE = 'local'
process.env.ACCESS_TOKEN_SECRET = randomUUID()
const { startServer } = require('../build/src/server.js')
const { sequelize } = require('../build/src/config/sql.js')
const User = require('../build/src/models/sql/User.js').default

async function run() {
  let server, user, imagePath
  try {
    server = await startServer()
    if (!server.listening) await once(server, 'listening')
    const base = `http://127.0.0.1:${server.address().port}`
    user = await User.create({ name: 'Avatar test', role: 'student' })
    const cookie = `token=${jwt.sign({ _id: user.id, role: 'student' }, process.env.ACCESS_TOKEN_SECRET, { expiresIn: '2m' })}`
    const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII=', 'base64')
    const form = new FormData()
    form.append('name', 'Avatar saved')
    form.append('avatar', new Blob([png], { type: 'image/png' }), 'avatar.png')
    const response = await fetch(`${base}/api/auth/profile`, { method: 'PUT', headers: { Cookie: cookie }, body: form })
    const body = await response.json()
    assert.equal(response.status, 200, JSON.stringify(body))
    const url = body.user.avatar
    imagePath = path.resolve('uploads/images', path.basename(new URL(url).pathname))
    await user.reload()
    assert.equal(user.avatar, url)
    assert.equal(user.name, 'Avatar saved')
    const image = await fetch(url)
    assert.equal(image.status, 200)
    assert.deepEqual(Buffer.from(await image.arrayBuffer()), png)
    const profile = await fetch(`${base}/api/auth/me`, { headers: { Cookie: cookie } })
    assert.equal((await profile.json()).avatar, url)
    const invalid = new FormData()
    invalid.append('avatar', new Blob(['not an image'], { type: 'image/png' }), 'fake.png')
    const rejected = await fetch(`${base}/api/auth/upload-avatar`, { method: 'POST', headers: { Cookie: cookie }, body: invalid })
    assert.equal(rejected.status, 400)
    await user.reload()
    assert.equal(user.avatar, url)
    console.log('PASS: multipart upload, SQL persistence, image retrieval, profile reload, invalid-file rejection.')
  } finally {
    if (user) await user.destroy()
    if (imagePath) await unlink(imagePath)
    if (server) await new Promise(resolve => server.close(resolve))
    await sequelize.close()
  }
}
run().catch(error => { console.error(error.message); process.exitCode = 1 })
