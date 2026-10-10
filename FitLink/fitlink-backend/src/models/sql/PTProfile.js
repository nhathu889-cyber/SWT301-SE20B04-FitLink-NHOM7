import { DataTypes } from 'sequelize'
import { sequelize } from '../../config/sql.js'

const PTProfileSQL = sequelize.define('PTProfileSQL', {
  id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
  userId: { type: DataTypes.UUID, field: 'user_id', allowNull: false, unique: true },
  primaryGym: { type: DataTypes.TEXT, field: 'primary_gym', defaultValue: '{}' },
  deliveryModes: { type: DataTypes.TEXT, field: 'delivery_modes', defaultValue: '{"atPtGym":true,"atClient":false,"atOtherGym":false}' },
  travelPolicy: { type: DataTypes.TEXT, field: 'travel_policy', defaultValue: '{}' },
  coverImage: { type: DataTypes.STRING(500), field: 'cover_image', defaultValue: '' },
  bio: { type: DataTypes.TEXT, defaultValue: '' },
  specialties: { type: DataTypes.TEXT, defaultValue: '[]' },
  yearsExperience: { type: DataTypes.INTEGER, field: 'years_experience', defaultValue: 0 },
  certificates: { type: DataTypes.TEXT, defaultValue: '[]' },
  workingHours: { type: DataTypes.TEXT, field: 'working_hours', defaultValue: '[]' },
  defaultBreakMin: { type: DataTypes.INTEGER, field: 'default_break_min', defaultValue: 0 },
  areaNote: { type: DataTypes.STRING(500), field: 'area_note', defaultValue: '' },
  availableForNewClients: { type: DataTypes.BOOLEAN, field: 'available_for_new_clients', defaultValue: true },
  verified: { type: DataTypes.BOOLEAN, defaultValue: false },
  ratingAvg: { type: DataTypes.DECIMAL(3, 2), field: 'rating_avg', defaultValue: 0 },
  ratingCount: { type: DataTypes.INTEGER, field: 'rating_count', defaultValue: 0 },
  videoIntroUrl: { type: DataTypes.STRING(500), field: 'video_intro_url', defaultValue: '' }
}, { tableName: 'pt_profiles', timestamps: true, createdAt: 'created_at', updatedAt: 'updated_at' })

export default PTProfileSQL