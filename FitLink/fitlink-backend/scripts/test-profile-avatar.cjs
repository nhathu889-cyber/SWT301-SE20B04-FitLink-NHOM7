const assert = require('node:assert/strict')
const { readFileSync } = require('node:fs')
const path = require('node:path')
const { test } = require('node:test')
const babel = require('@babel/core')

const source = readFileSync(path.join(__dirname, '../src/controllers/userSqlController.js'), 'utf8')
const { code } = babel.transformSync(source, {
  babelrc: false,
  configFile: false,
  plugins: ['@babel/plugin-transform-modules-commonjs']
})

function setup({ uploadError, missingUser = false, password = 'private' } = {}) {
  const record = { id: 'user-1', avatar: 'https://example.com/old.jpg', password: 'private' }
  const writes = []
  record.password = password
  const uploads = []
  const user = {
    get password() { return record.password },
    toJSON: () => ({ ...record }),
    update: async (changes) => { writes.push(changes); Object.assign(record, changes) }
  }
  const mocks = {
    '~/models/sql/User.js': { findByPk: async () => missingUser ? null : user },
    bcrypt: require('bcrypt'),
    '../services/imageStorage.js': {
      storeImage: async (file) => {
        uploads.push({ buffer: file.buffer })
        if (uploadError) throw uploadError
        return { url: 'https://example.com/new.jpg', discard: async () => {} }
      }
    }
  }

  const exports = {}
  new Function('require', 'exports', code)((name) => {
    assert.ok(name in mocks, `Unexpected dependency: ${name}`)
    return mocks[name]
  }, exports)
  const res = {
    statusCode: 200,
    status(value) { this.statusCode = value; return this },
    json(value) { this.body = value; return this }
  }
  return { controller: Object.fromEntries(Object.entries(exports.userSqlController).map(([name, fn]) => [name, (req, res) => fn({ protocol: 'http', get: () => 'localhost:3000', ...req }, res)])), res, writes, uploads, record }
}

test('profile update uploads the selected file and persists its URL', async () => {
  const { controller, res, writes, uploads } = setup()
  const buffer = Buffer.from('selected image')
  await controller.updateProfile({ user: { _id: 'user-1' }, body: { name: 'New Name', avatar: 'https://example.com/old.jpg' }, file: { buffer } }, res)
  assert.equal(res.statusCode, 200)
  assert.equal(uploads[0].buffer, buffer)
  assert.equal(writes[0].avatar, 'https://example.com/new.jpg')
  assert.equal(res.body.user.avatar, 'https://example.com/new.jpg')
  assert.equal(res.body.user.password, undefined)
})

test('Google account without a password returns a clear error without changing credentials', async () => {
  const { controller, res, writes } = setup({ password: null })
  await controller.changePassword({ user: { _id: 'user-1' }, body: { currentPassword: 'example', newPassword: 'replacement' } }, res)
  assert.equal(res.statusCode, 400)
  assert.match(res.body.message, /Google/)
  assert.equal(writes.length, 0)
})

test('password accounts require the old password and store a new hash', async () => {
  const bcrypt = require('bcrypt')
  const { controller, res, writes, record } = setup({ password: await bcrypt.hash('old-password', 10) })
  await controller.changePassword({ user: { _id: 'user-1' }, body: { currentPassword: 'wrong', newPassword: 'new-password' } }, res)
  assert.equal(res.statusCode, 401)
  assert.equal(writes.length, 0)
  res.statusCode = 200
  await controller.changePassword({ user: { _id: 'user-1' }, body: { currentPassword: 'old-password', newPassword: 'new-password' } }, res)
  assert.equal(res.statusCode, 200)
  assert.equal(await bcrypt.compare('new-password', record.password), true)
})

test('editing profile without an image preserves the existing avatar', async () => {
  const { controller, res, writes, uploads } = setup()
  await controller.updateProfile({ user: { _id: 'user-1' }, body: { name: 'New Name' } }, res)
  assert.equal(res.statusCode, 200)
  assert.equal(uploads.length, 0)
  assert.equal(Object.hasOwn(writes[0], 'avatar'), false)
  assert.equal(res.body.user.avatar, 'https://example.com/old.jpg')
})

test('upload failure reports an error without saving or losing the old avatar', async () => {
  const { controller, res, writes, record } = setup({ uploadError: new Error('Upload failed') })
  await controller.updateProfile({ user: { _id: 'user-1' }, body: {}, file: { buffer: Buffer.from('image') } }, res)
  assert.equal(res.statusCode, 500)
  assert.equal(res.body.message, 'Không thể lưu hồ sơ hoặc ảnh. Vui lòng thử lại.')
  assert.equal(writes.length, 0)
  assert.equal(record.avatar, 'https://example.com/old.jpg')
})

test('missing user does not upload an image', async () => {
  const { controller, res, uploads } = setup({ missingUser: true })
  await controller.updateProfile({ user: { _id: 'missing' }, body: {}, file: { buffer: Buffer.from('image') } }, res)
  assert.equal(res.statusCode, 404)
  assert.equal(uploads.length, 0)
})
