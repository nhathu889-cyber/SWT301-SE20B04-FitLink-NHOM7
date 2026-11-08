import { parseChatRoom } from '../utils/chatRoom.js'
import Chat from '~/models/sql/Chat.js'
import Message from '~/models/sql/Message.js'
import User from '~/models/sql/User.js'
import StudentPackage from '~/models/sql/StudentPackage.js'
import { createNotification } from '~/services/notificationService.js'

const parse = (value, fallback = []) => { try { return value ? JSON.parse(value) : fallback } catch { return fallback } }
const findChat = async (id1, id2) => { const rows = await Chat.findAll(); return rows.find((row) => { const users = parse(row.participants).map(id => String(id).toLowerCase()); return users.includes(id1) && users.includes(id2) }) }
export const getMyPTs = async (req, res) => {
  try {
    const userId = String(req.user._id).toLowerCase()
    const [rows, packages] = await Promise.all([
      Chat.findAll({ order: [['updated_at', 'DESC']] }),
      StudentPackage.findAll({ where: { studentId: req.user._id, status: 'active' }, attributes: ['ptId'] })
    ])
    const ids = new Set(packages.map(row => String(row.ptId).toLowerCase()))
    rows.forEach(row => {
      const participants = parse(row.participants).map(id => String(id).toLowerCase())
      if (participants.includes(userId)) {
        participants.filter(id => id !== userId).forEach(id => ids.add(id))
      }
    })
    const users = ids.size ? await User.findAll({
      where: { id: [...ids], role: 'pt' },
      attributes: ['id', 'name', 'avatar', 'email', 'role']
    }) : []
    return res.json({ success: true, data: users.map(user => ({ ...user.toJSON(), _id: user.id })) })
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message })
  }
}
export const getMessagesByChat = async (req, res) => { try { const [id1, id2] = parseChatRoom(req.params.chatId); const chat = await findChat(id1, id2); if (!chat) return res.json({ success: true, data: [] }); const messages = await Message.findAll({ where: { chatId: chat.id }, order: [['created_at', 'ASC']] }); return res.json({ success: true, data: messages }) } catch (error) { return res.status(500).json({ success: false, message: error.message }) } }
export const createMessage = async (req, res) => { try { const { chat, sender, text, attachments = [] } = req.body; if (!chat || !sender || !text) return res.status(400).json({ success: false, message: 'Thiếu dữ liệu bắt buộc' }); const [id1, id2] = parseChatRoom(chat); let chatDoc = await findChat(id1, id2); if (!chatDoc) chatDoc = await Chat.create({ participants: JSON.stringify([id1, id2]) }); const message = await Message.create({ chatId: chatDoc.id, senderId: sender, text, attachments: JSON.stringify(attachments) }); await chatDoc.update({ lastMessage: JSON.stringify({ sender, text, timestamp: new Date() }) }); const receiverId = String(sender).toLowerCase() === id1 ? id2 : id1; await createNotification({ user: receiverId, title: 'Tin nhắn mới', message: text, type: 'message', meta: { chatId: chat } }); return res.status(201).json({ success: true, data: message }) } catch (error) { return res.status(500).json({ success: false, message: error.message }) } }
