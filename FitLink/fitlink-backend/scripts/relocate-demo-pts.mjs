import { sequelize } from '../src/config/sql.js'
import User from '../src/models/sql/User.js'
import PTProfile from '../src/models/sql/PTProfile.js'
import { demoPTs } from './pt-demo-data.mjs'

try {
  await sequelize.transaction(async transaction => {
    for (const account of demoPTs) {
      const user = await User.findOne({ where: { email: account.email, role: 'pt' }, transaction })
      if (!user) throw new Error(`Missing demo PT: ${account.email}`)
      await PTProfile.update({
        primaryGym: JSON.stringify({ name: 'FitLink Đà Nẵng Studio', address: '88 Bạch Đằng, Hải Châu, Đà Nẵng', location: { type: 'Point', coordinates: [108.2242, 16.0718] } }),
        areaNote: 'Hai Chau, Son Tra, Da Nang, Đà Nẵng',
        bio: `PT mẫu tại Đà Nẵng: ${account.specialties.join(', ')}.`,
      }, { where: { userId: user.id }, transaction })
    }
  })
  console.log('Updated 3 demo PT locations to Da Nang; accounts and packages preserved.')
} finally { await sequelize.close() }
