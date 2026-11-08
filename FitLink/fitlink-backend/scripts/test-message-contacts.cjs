const assert = require('node:assert/strict')
const { readFileSync } = require('node:fs')
const path = require('node:path')
const babel = require('@babel/core')
const { test } = require('@jest/globals')

function controller(packages, chats, lookup) {
  const dependencies = {
    '../utils/chatRoom.js': {},
    '~/models/sql/Chat.js': { findAll: async () => chats },
    '~/models/sql/Message.js': {},
    '~/models/sql/User.js': { findAll: lookup },
    '~/models/sql/StudentPackage.js': { findAll: async options => {
      assert.deepEqual(options.where, { studentId: 'student', status: 'active' })
      return packages
    } },
    '~/services/notificationService.js': {}
  }
  const { code } = babel.transformSync(readFileSync(path.join(__dirname, '../src/controllers/messageSqlController.js'), 'utf8'), {
    babelrc: false, configFile: false, plugins: ['@babel/plugin-transform-modules-commonjs']
  })
  const exports = {}
  new Function('require', 'exports', code)(name => dependencies[name], exports)
  return exports.getMyPTs
}

test('includes enrolled PTs before first message and preserves existing PT chats without duplicates', async () => {
  const handler = controller([{ ptId: 'PT-NEW' }, { ptId: 'pt-new' }], [
    { participants: '["STUDENT","pt-old"]' },
    { participants: '["someone-else","pt-unrelated"]' }
  ], async options => {
    assert.deepEqual(new Set(options.where.id), new Set(['pt-new', 'pt-old']))
    assert.equal(options.where.role, 'pt')
    return options.where.id.map(id => ({ id, toJSON: () => ({ id, name: id }) }))
  })
  let result
  await handler({ user: { _id: 'student' } }, { json: data => { result = data }, status: () => { throw Error('Unexpected error') } })
  assert.equal(result.success, true)
  assert.deepEqual(result.data.map(pt => pt._id), ['pt-new', 'pt-old'])
})

test('returns an empty list when no enrollment or chat exists', async () => {
  const handler = controller([], [], async () => { throw Error('Unexpected lookup') })
  await handler({ user: { _id: 'student' } }, { json: data => assert.deepEqual(data, { success: true, data: [] }) })
})
