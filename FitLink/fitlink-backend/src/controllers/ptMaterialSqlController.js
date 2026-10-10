import PTMaterial from '~/models/sql/PTMaterial.js'
import fs from 'fs'
import path from 'path'

const parse = (value, fallback = []) => { try { return value ? JSON.parse(value) : fallback } catch { return fallback } }
const serialize = (record) => { const data = record.toJSON(); return { ...data, _id: data.id, pt: data.ptId, tags: parse(data.tags), sharedWithPackages: parse(data.sharedWithPackages) } }

const uploadFile = async (req, res) => {
  if (!req.file) return res.status(400).json({ message: 'No file uploaded' })
  return res.json({ url: `${req.protocol}://${req.get('host')}/uploads/materials/${req.file.filename}` })
}
const getMyMaterials = async (req, res) => {
  try { const rows = await PTMaterial.findAll({ where: { ptId: req.user._id }, order: [['updated_at', 'DESC']] }); return res.json({ data: rows.map(serialize) }) } catch (error) { return res.status(500).json({ message: error.message }) }
}
const createMaterial = async (req, res) => {
  try { const body = req.body; const material = await PTMaterial.create({ ...body, ptId: req.user._id, tags: JSON.stringify(body.tags || []), sharedWithPackages: JSON.stringify(body.sharedWithPackages || []) }); return res.json({ data: serialize(material) }) } catch (error) { return res.status(400).json({ message: error.message }) }
}
const updateMaterial = async (req, res) => {
  try { const material = await PTMaterial.findOne({ where: { id: req.params.id, ptId: req.user._id } }); if (!material) return res.status(404).json({ message: 'Material not found' }); const body = { ...req.body }; if (body.tags) body.tags = JSON.stringify(body.tags); if (body.sharedWithPackages) body.sharedWithPackages = JSON.stringify(body.sharedWithPackages); await material.update(body); return res.json({ data: serialize(material) }) } catch (error) { return res.status(400).json({ message: error.message }) }
}
const deleteMaterial = async (req, res) => {
  try { const material = await PTMaterial.findOne({ where: { id: req.params.id, ptId: req.user._id } }); if (!material) return res.status(404).json({ message: 'Material not found' }); if (material.url?.includes('/uploads/materials/')) { const filePath = path.join('uploads', 'materials', path.basename(material.url)); if (fs.existsSync(filePath)) fs.unlinkSync(filePath) } await material.destroy(); return res.json({ message: 'Material deleted' }) } catch (error) { return res.status(400).json({ message: error.message }) }
}
const shareMaterial = async (req, res) => {
  try { const material = await PTMaterial.findOne({ where: { id: req.params.id, ptId: req.user._id } }); if (!material) return res.status(404).json({ message: 'Material not found' }); await material.update({ sharedWithPackages: JSON.stringify(req.body.packageIds || []) }); return res.json({ message: 'Shared successfully' }) } catch (error) { return res.status(400).json({ message: error.message }) }
}
export const ptMaterialSqlController = { uploadFile, getMyMaterials, createMaterial, updateMaterial, deleteMaterial, shareMaterial }
