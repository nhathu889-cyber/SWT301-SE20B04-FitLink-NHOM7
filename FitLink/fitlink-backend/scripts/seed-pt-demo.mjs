import { pathToFileURL } from 'node:url'
import bcrypt from 'bcrypt'
import { sequelize } from '../src/config/sql.js'
import User from '../src/models/sql/User.js'
import PTProfile from '../src/models/sql/PTProfile.js'
import Package from '../src/models/sql/Package.js'
import { demoPTs, workingHours } from './pt-demo-data.mjs'

// Reruns preserve existing credentials and never duplicate demo accounts/packages.
export const seedDemoPTs = async (transaction, accounts = demoPTs) => {
  const passwordHash = await bcrypt.hash(process.env.DEMO_PT_PASSWORD || 'Fitlink123!', 10)
    for (const pt of accounts) {
      const [user] = await User.findOrCreate({
        where: { email: pt.email },
        defaults: { name: pt.name, phone: pt.phone, gender: pt.gender, avatar: pt.avatar, role: 'pt', password: passwordHash, isActive: true },
        transaction
      })
      if (user.role !== 'pt') throw new Error(`Demo email belongs to a non-PT account: ${pt.email}`)
      const values = {
        primaryGym: JSON.stringify(pt.primaryGym),
        deliveryModes: JSON.stringify({ atPtGym: true, atClient: true, atOtherGym: false }),
        travelPolicy: JSON.stringify({ enabled: true, freeRadiusKm: 5, maxTravelKm: 15, feePerKm: 10000 }),
        coverImage: pt.coverImage, bio: pt.bio, specialties: JSON.stringify(pt.specialties),
        yearsExperience: pt.yearsExperience,
        certificates: JSON.stringify([{ name: 'Certified Personal Trainer', issuer: 'FitLink Academy', year: 2023, url: '' }]),
        workingHours: JSON.stringify(workingHours), defaultBreakMin: 15, areaNote: pt.areaNote,
        availableForNewClients: true, verified: true
      }
      await PTProfile.findOrCreate({ where: { userId: user.id }, defaults: { userId: user.id, ...values }, transaction })
      for (const pkg of pt.packages) {
        await Package.findOrCreate({
          where: { ptId: user.id, name: pkg.name },
          defaults: { ...pkg, ptId: user.id, recurrence: JSON.stringify({ daysOfWeek: [[1, 3, 5]] }), tags: JSON.stringify(pkg.tags), isActive: true, visibility: 'public', supports: values.deliveryModes, travelPricing: JSON.stringify({ enabled: false, freeRadiusKm: 5, maxTravelKm: 15, feePerKm: 10000 }) },
          transaction
        })
      }
    }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
try {
  await sequelize.authenticate()
  await sequelize.transaction(transaction => seedDemoPTs(transaction))
  console.log(JSON.stringify({ message: 'SQL Server demo PT seed completed', accounts: demoPTs.map(({ name, email, phone }) => ({ name, email, phone })) }, null, 2))
} catch (error) {
  console.error(error.message)
  process.exitCode = 1
} finally {
  await sequelize.close()
}

}
