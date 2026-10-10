// Preserve the public API shape while SQL stores UUID keys and JSON as NVARCHAR.
const jsonFields = new Set([
  'primaryGym', 'deliveryModes', 'travelPolicy', 'specialties', 'certificates',
  'workingHours', 'goals', 'defaultLocation', 'bmiHistory', 'recurrence', 'supports',
  'travelPricing', 'tags', 'pattern', 'slot', 'clientAddress', 'ptGymAddress',
  'otherGymAddress', 'packageSnapshot', 'pricing', 'modes', 'hold', 'meta',
  'participants', 'lastMessage', 'unreadCount', 'attachments', 'readBy',
  'sharedWithPackages', 'bankInfo', 'sessions', 'logs', 'documents', 'snapshot', 'submittedProfile'
])
const privateFields = new Set(['password', 'passwordHash', 'refreshToken', 'resetPasswordToken', 'resetTokenExpires'])
const aliases = { userId: 'user', studentId: 'student', ptId: 'pt', packageId: 'package', studentPackageId: 'studentPackage', transactionId: 'transaction', bookingId: 'booking', slotId: 'slot', chatId: 'chat', senderId: 'sender', created_at: 'createdAt', updated_at: 'updatedAt' }

export const sqlResponse = (input) => {
  if (input === null || input === undefined || typeof input !== 'object' || input instanceof Date) return input
  if (Array.isArray(input)) return input.map(sqlResponse)
  const source = typeof input.toJSON === 'function' ? input.toJSON() : input
  const result = {}
  for (const [key, raw] of Object.entries(source)) {
    if (privateFields.has(key)) continue
    let value = raw
    if (jsonFields.has(key) && typeof value === 'string') {
      try { value = JSON.parse(value) } catch { /* Leave non-JSON values intact. */ }
    }
    result[key] = sqlResponse(value)
  }
  if (source.id !== undefined && source._id === undefined) result._id = source.id
  for (const [key, alias] of Object.entries(aliases)) {
    if (source[key] !== undefined && source[alias] === undefined) result[alias] = result[key]
  }
  return result
}

export const sqlResponseMiddleware = (_req, res, next) => {
  const json = res.json.bind(res)
  res.json = (body) => json(sqlResponse(body))
  next()
}
