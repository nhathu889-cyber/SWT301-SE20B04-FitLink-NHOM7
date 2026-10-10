import express from 'express'
import { authMiddleware } from '~/middlewares/authMiddleware'
import PTMaterial from '~/models/sql/PTMaterial.js'

const router = express.Router()

// GET /api/student/materials/:packageId
router.get(
  '/materials/:packageId',
  authMiddleware.authenTokenCookie,
  authMiddleware.isStudent,
  async (req, res) => {
    try {
      const rows = await PTMaterial.findAll()
      const mats = rows.filter((item) => {
        try { return JSON.parse(item.sharedWithPackages || '[]').includes(req.params.packageId) } catch { return false }
      })

      return res.json({ data: mats })
    } catch (err) {
      console.error(err)
      return res.status(500).json({ message: 'Failed to load materials' })
    }
  }
)

export default router
