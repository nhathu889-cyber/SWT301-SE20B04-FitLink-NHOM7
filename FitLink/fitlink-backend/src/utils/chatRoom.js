const uuid = '[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}'
const roomPattern = new RegExp(`^(${uuid})-(${uuid})$`, 'i')

// UUIDs contain hyphens themselves; splitting on '-' truncates both user IDs.
export const parseChatRoom = (room) => {
  const match = String(room || '').match(roomPattern)
  if (!match || match[1].toLowerCase() === match[2].toLowerCase()) throw new Error('Invalid chat room')
  return [match[1].toLowerCase(), match[2].toLowerCase()]
}
