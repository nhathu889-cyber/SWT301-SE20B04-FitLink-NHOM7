import { searchPTs } from '../services/sqlSearchService.js'
import PTProfile from '~/models/sql/PTProfile.js'
import User from '~/models/sql/User.js'
import Package from '~/models/sql/Package.js'

const parse = (value, fallback = {}) => { try { return value ? JSON.parse(value) : fallback } catch { return fallback } }
const serializeProfile = (profile, user, packages = []) => { const data = profile.toJSON(); return { ...data, _id: data.id, user: user ? { _id: user.id, name: user.name, email: user.email, phone: user.phone, avatar: user.avatar, role: user.role } : null, primaryGym: parse(data.primaryGym), deliveryModes: parse(data.deliveryModes), travelPolicy: parse(data.travelPolicy), specialties: parse(data.specialties, []), certificates: parse(data.certificates, []), workingHours: parse(data.workingHours, []), packages } }
export const getPTsByAvailableSlot = async (req, res) => {
  try { return res.json(await searchPTs(req.query)) }
  catch (error) { return res.status(400).json({ success: false, message: error.message }) }
}
export const getPTById = async (req, res) => { try { const profile = await PTProfile.findByPk(req.params.id); if (!profile) return res.status(404).json({ message: 'PT profile not found' }); const user = await User.findByPk(profile.userId); const packages = await Package.findAll({ where: { ptId: profile.userId, isActive: true, visibility: 'public' } }); return res.json({ success: true, data: serializeProfile(profile, user, packages) }) } catch (error) { return res.status(500).json({ success: false, message: error.message }) } }
