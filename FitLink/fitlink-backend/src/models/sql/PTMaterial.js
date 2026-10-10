import { DataTypes } from 'sequelize'
import { sequelize } from '../../config/sql.js'

const PTMaterialSQL = sequelize.define('PTMaterialSQL', {
  id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
  ptId: { type: DataTypes.UUID, field: 'pt_id', allowNull: false },
  title: { type: DataTypes.STRING(120), allowNull: false },
  description: { type: DataTypes.STRING(1000), defaultValue: '' },
  url: { type: DataTypes.STRING(1000), defaultValue: '' },
  type: { type: DataTypes.STRING(30), defaultValue: 'document' },
  tags: { type: DataTypes.TEXT, defaultValue: '[]' },
  sharedWithPackages: { type: DataTypes.TEXT, field: 'shared_with_packages', defaultValue: '[]' },
  visibility: { type: DataTypes.STRING(20), defaultValue: 'private' }
}, { tableName: 'pt_materials', timestamps: true, createdAt: 'created_at', updatedAt: 'updated_at' })

export default PTMaterialSQL
