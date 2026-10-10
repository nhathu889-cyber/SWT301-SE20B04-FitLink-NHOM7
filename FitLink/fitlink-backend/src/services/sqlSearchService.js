import { Op } from 'sequelize'
import PTProfile from '../models/sql/PTProfile.js'
import User from '../models/sql/User.js'
import Package from '../models/sql/Package.js'
import Slot from '../models/sql/Slot.js'
import { sqlResponse } from '../utils/sqlResponse.js'

const text = value => String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/đ/g, 'd').toLowerCase()
const list = value => Array.isArray(value) ? value : String(value || '').split(',').filter(Boolean)
const key = value => String(value).toLowerCase()
const distanceKm = (lat1, lon1, lat2, lon2) => {
  const rad = value => value * Math.PI / 180
  const a = Math.sin(rad(lat2 - lat1) / 2) ** 2 + Math.cos(rad(lat1)) * Math.cos(rad(lat2)) * Math.sin(rad(lon2 - lon1) / 2) ** 2
  return 6371 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(Math.max(0, 1 - a)))
}

export const searchPTs = async (query, options = {}) => {
  const profiles = sqlResponse(await PTProfile.findAll({ where: { verified: true, availableForNewClients: true }, ...options }))
  const ids = profiles.map(row => row.userId)
  const [users, packages] = await Promise.all([
    User.findAll({ where: { id: ids, isActive: true }, attributes: ['id', 'name', 'email', 'phone', 'avatar', 'role'], ...options }),
    Package.findAll({ where: { ptId: ids, isActive: true, visibility: 'public' }, order: [['price', 'ASC']], ...options })
  ])
  const userMap = new Map(sqlResponse(users).map(row => [key(row.id), row]))
  const byPT = new Map()
  for (const pkg of sqlResponse(packages)) {
    if (query.packageTime === 'short' && pkg.durationDays >= 7) continue
    if (query.packageTime === 'medium' && (pkg.durationDays < 7 || pkg.durationDays > 30)) continue
    if (query.packageTime === 'long' && pkg.durationDays <= 30) continue
    const id = key(pkg.ptId)
    if (!byPT.has(id)) byPT.set(id, [])
    byPT.get(id).push(pkg)
  }
  let available
  if (query.availableAt) {
    const at = new Date(query.availableAt)
    if (!Number.isFinite(at.getTime())) throw new Error('Invalid availability time')
    available = new Set((await Slot.findAll({ where: { ptId: ids, status: 'OPEN', startTime: { [Op.lte]: at }, endTime: { [Op.gt]: at } }, ...options })).map(row => key(row.ptId)))
  }
  const coords = query.coords ? String(query.coords).split(',').map(Number) : null
  if (coords && (coords.length !== 2 || !coords.every(Number.isFinite) || Math.abs(coords[0]) > 90 || Math.abs(coords[1]) > 180)) throw new Error('Invalid coordinates')
  const modes = list(query.modes).filter(mode => mode !== 'all')
  const goals = [query.specialty, ...list(query.goals)].filter(Boolean).map(text)
  let items = profiles.flatMap(profile => {
    const id = key(profile.userId), user = userMap.get(id), offers = byPT.get(id) || []
    if (!user || (query.name && !text(user.name).includes(text(query.name)))) return []
    if (query.packageTime && !offers.length) return []
    if (available && !available.has(id)) return []
    if (query.mode && query.mode !== 'all' && !profile.deliveryModes?.[query.mode]) return []
    if (modes.length && !modes.some(mode => profile.deliveryModes?.[mode])) return []
    const specialties = [...(profile.specialties || []), ...offers.flatMap(pkg => pkg.tags || [])].map(text)
    if (goals.length && !goals.some(goal => specialties.some(specialty => specialty.includes(goal)))) return []
    let distance
    if (coords) {
      const gym = profile.primaryGym?.location?.coordinates
      if (!Array.isArray(gym) || gym.length !== 2) return []
      distance = distanceKm(coords[0], coords[1], Number(gym[1]), Number(gym[0]))
      if (!Number.isFinite(distance) || distance > 5) return []
    } else if (query.area && !text(`${profile.areaNote} ${profile.primaryGym?.address}`).includes(text(query.area))) return []
    return [{ ...profile, user, userInfo: user, packages: offers, featuredPackage: offers[0] || null, lowestPricePerSession: offers.length ? Number(offers[0].price) : null, ...(distance !== undefined ? { distanceKm: distance } : {}) }]
  })
  const price = item => item.lowestPricePerSession ?? Infinity
  items.sort((a, b) => query.sortBy === 'price' ? price(a) - price(b) : query.sortBy === 'distance' ? (a.distanceKm ?? Infinity) - (b.distanceKm ?? Infinity) : Number(b.ratingAvg) - Number(a.ratingAvg) || price(a) - price(b))
  const page = Math.max(1, parseInt(query.page, 10) || 1)
  const limit = Math.min(100, Math.max(1, parseInt(query.limit, 10) || 12))
  const total = items.length
  items = items.slice((page - 1) * limit, page * limit)
  return { success: true, page, limit, total, items }
}
