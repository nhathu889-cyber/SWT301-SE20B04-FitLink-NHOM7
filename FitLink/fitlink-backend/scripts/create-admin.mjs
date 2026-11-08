import { randomBytes } from 'node:crypto'
import bcrypt from 'bcrypt'
import { Op } from 'sequelize'
import { sequelize } from '../src/config/sql.js'
import User from '../src/models/sql/User.js'

// Explicit provisioning only; never promotes or resets an existing account.
try {
  const phone = String(process.env.ADMIN_PHONE || '0999999999').trim().replace(/[\s.-]/g, '').replace(/^(\+84|84)/, '0')
  const email = String(process.env.ADMIN_EMAIL || 'admin@fitlink.local').trim().toLowerCase()
  const password = process.env.ADMIN_PASSWORD || randomBytes(18).toString('base64url')
  if (!/^0\d{9}$/.test(phone)) throw new Error('ADMIN_PHONE must be a valid 10-digit Vietnamese phone number')
  if (password.length < 12) throw new Error('ADMIN_PASSWORD must have at least 12 characters')
  await sequelize.authenticate()
  const existing = await User.findOne({ where: { [Op.or]: [{ phone }, { email }] } })
  if (existing) {
    throw new Error('Phone or email already exists. No account or password was changed. Choose another ADMIN_PHONE and ADMIN_EMAIL.')
  }
  await User.create({ phone, email, name: 'FitLink Admin', role: 'admin', isActive: true, password: await bcrypt.hash(password, 12) })
  console.log(JSON.stringify({ message: 'Admin created. Save these credentials securely.', phone, password, role: 'admin' }, null, 2))
} catch (error) {
  console.error(error.message)
  process.exitCode = 1
} finally {
  await sequelize.close()
}
