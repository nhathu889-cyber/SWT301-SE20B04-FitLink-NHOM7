import { pathToFileURL } from 'node:url'
import { sequelize } from '../src/config/sql.js'
import Package from '../src/models/sql/Package.js'
import Transaction from '../src/models/sql/Transaction.js'
import { Op } from 'sequelize'

const packages = [
  {
    name: 'Single Visit Pass', price: 30000, totalSessions: 1, durationDays: 1,
    description: 'One visit. Full gym access.'
  },
  {
    name: '5-Visit Starter Pack', price: 120000, totalSessions: 5, durationDays: 14,
    description: 'Start your routine. Five flexible visits.'
  },
  {
    name: '10-Visit Flex Pack', price: 220000, totalSessions: 10, durationDays: 30,
    description: 'Your pace. Ten visits over thirty days.'
  },
  {
    name: '30-Visit Fitness Pack', price: 550000, totalSessions: 30, durationDays: 60,
    description: 'Keep showing up. Thirty visits, more value.'
  }
]

export const seedGymPackages = async (transaction, refreshDemo = false) => {
  const results = []
  for (const pkg of packages) {
    const [record, created] = await Package.findOrCreate({
      where: { ptId: null, name: pkg.name },
      defaults: {
        ...pkg, ptId: null, sessionDurationMin: 0, isActive: true, visibility: 'public',
        gymName: 'FitLink Demo Gym',
        gymAddress: 'Demo location - replace with your actual gym address before accepting purchases.',
        supports: JSON.stringify({ atPtGym: false, atClient: false, atOtherGym: false }),
        tags: JSON.stringify(['gym-access', 'demo'])
      },
      transaction
    })
    if (!created && refreshDemo && record.gymName === 'FitLink Demo Gym' && JSON.parse(record.tags || '[]').includes('demo')) {
      const previousPrice = Number(record.price)
      await record.update({ price: pkg.price, description: pkg.description }, { transaction })
      // Existing unpaid bank transfers must display the same reduced price as the listing.
      await Transaction.update({ amount: pkg.price }, {
        where: { packageId: record.id, method: 'bank_transfer', status: { [Op.in]: ['initiated', 'pending_transfer'] }, amount: previousPrice }, transaction
      })
    }
    results.push({ name: record.name, price: Number(record.price), visits: record.totalSessions, validityDays: record.durationDays, created })
  }
  return results
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    await sequelize.authenticate()
    const results = await sequelize.transaction(transaction => seedGymPackages(transaction, process.argv.includes('--refresh-demo')))
    console.log(JSON.stringify(results, null, 2))
  } catch (error) {
    console.error(error.message)
    process.exitCode = 1
  } finally {
    await sequelize.close()
  }
}
