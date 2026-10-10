import cloudinary from '../config/cloudinary.js'
import PTProfile from '~/models/sql/PTProfile.js'
import User from '~/models/sql/User.js'
import { StatusCodes } from 'http-status-codes'

const parse = (value, fallback = {}) => { try { return value ? JSON.parse(value) : fallback } catch { return fallback } }
const serialize = (record) => { const data = record.toJSON(); return { ...data, _id: data.id, user: data.userId, primaryGym: parse(data.primaryGym), deliveryModes: parse(data.deliveryModes), travelPolicy: parse(data.travelPolicy), specialties: parse(data.specialties, []), certificates: parse(data.certificates, []), workingHours: parse(data.workingHours, []) } }
const clean = (body) => ({ coverImage: body.coverImage, bio: body.bio, specialties: JSON.stringify(body.specialties || []), certificates: JSON.stringify(body.certificates || []), workingHours: JSON.stringify(body.workingHours || []), primaryGym: JSON.stringify(body.primaryGym || {}), deliveryModes: JSON.stringify(body.deliveryModes || {}), travelPolicy: JSON.stringify(body.travelPolicy || {}), yearsExperience: body.yearsExperience, defaultBreakMin: body.defaultBreakMin, areaNote: body.areaNote, availableForNewClients: body.availableForNewClients, videoIntroUrl: body.videoIntroUrl })
const getMyProfile = async (req, res) => { try { const [profile] = await PTProfile.findOrCreate({ where: { userId: req.user._id }, defaults: { userId: req.user._id } }); return res.json({ success: true, data: serialize(profile) }) } catch (error) { return res.status(500).json({ success: false, message: error.message }) } }
const upsertMyProfile = async (req, res) => { try { const [profile] = await PTProfile.findOrCreate({ where: { userId: req.user._id }, defaults: { userId: req.user._id } }); await profile.update(clean(req.body)); return res.json({ success: true, data: serialize(profile) }) } catch (error) { return res.status(400).json({ success: false, message: error.message }) } }
const getPTProfilePublic = async (req, res) => { try { const profile = await PTProfile.findOne({ where: { userId: req.params.ptId } }); if (!profile) return res.status(404).json({ success: false, message: 'Không tìm thấy PT' }); const user = await User.findByPk(req.params.ptId, { attributes: ['id', 'name', 'email', 'avatar', 'phone'] }); return res.json({ success: true, data: { ...serialize(profile), user } }) } catch (error) { return res.status(500).json({ message: error.message }) } }
const deleteMyProfile = async (req, res) => { await PTProfile.destroy({ where: { userId: req.user._id } }); return res.json({ success: true }) }
const getMyAccount = async (req, res) => { const user = await User.findByPk(req.user._id); return user ? res.json({ success: true, data: user }) : res.status(404).json({ message: 'User not found' }) }
const getAllPTProfilesPublic = async (req, res) => { const rows = await PTProfile.findAll({ where: { verified: true, availableForNewClients: true } }); return res.json({ success: true, data: rows.map(serialize) }) }
const getPTDetailPublic = async (req, res) => {
  try {
    const profile = await PTProfile.findOne({ where: { userId: req.params.id } }) || await PTProfile.findByPk(req.params.id)
    if (!profile) return res.status(StatusCodes.NOT_FOUND).json({ success: false, message: 'Không tìm thấy PT' })
    const user = await User.findByPk(profile.userId, { attributes: ['id', 'name', 'email', 'avatar', 'phone', 'role', 'isActive'] })
    if (!user || !user.isActive || user.role !== 'pt') return res.status(StatusCodes.NOT_FOUND).json({ success: false, message: 'Không tìm thấy PT' })
    return res.json({ success: true, data: { ...serialize(profile), user: { ...user.toJSON(), _id: user.id } } })
  } catch (error) { return res.status(500).json({ success: false, message: error.message }) }
}
const uploadCoverImage = async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ message: 'No file uploaded' })
    const profile = await PTProfile.findOne({ where: { userId: req.user._id } })
    if (!profile) return res.status(404).json({ message: 'Profile not found' })
    const result = await new Promise((resolve, reject) => cloudinary.uploader.upload_stream({ resource_type: 'image' }, (error, value) => error ? reject(error) : resolve(value)).end(req.file.buffer))
    if (!result?.secure_url) throw new Error('Image upload did not return a URL')
    await profile.update({ coverImage: result.secure_url })
    return res.json({ url: result.secure_url })
  } catch (error) { return res.status(500).json({ message: error.message }) }
}
export const ptProfileSqlController = { getMyProfile, upsertMyProfile, getPTProfilePublic, deleteMyProfile, uploadCoverImage, getMyAccount, getAllPTProfilesPublic, getPTDetailPublic }
