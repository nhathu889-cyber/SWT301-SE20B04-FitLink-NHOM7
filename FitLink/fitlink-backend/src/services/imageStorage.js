import { mkdir, writeFile, unlink } from 'node:fs/promises'
import path from 'node:path'
import { randomUUID } from 'node:crypto'
import cloudinary from '../config/cloudinary.js'

export const imageDirectory = path.resolve('uploads/images')

const imageExtension = (buffer) => {
  if (buffer.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))) return 'png'
  if (buffer[0] === 255 && buffer[1] === 216 && buffer[2] === 255) return 'jpg'
  if (['GIF87a', 'GIF89a'].includes(buffer.subarray(0, 6).toString())) return 'gif'
  if (buffer.subarray(0, 4).toString() === 'RIFF' && buffer.subarray(8, 12).toString() === 'WEBP') return 'webp'
  return null
}

export const storeImage = async (file, origin) => {
  const buffer = file?.buffer
  const extension = Buffer.isBuffer(buffer) ? imageExtension(buffer) : null
  if (!extension) throw Object.assign(new Error('Chỉ hỗ trợ ảnh PNG, JPG, GIF hoặc WebP.'), { statusCode: 400 })
  if (buffer.length > 10 * 1024 * 1024) throw Object.assign(new Error('Ảnh không được vượt quá 10MB.'), { statusCode: 400 })
  const storage = process.env.IMAGE_STORAGE || (process.env.NODE_ENV === 'production' ? 'cloudinary' : 'local')
  if (storage === 'cloudinary') {
    const result = await new Promise((resolve, reject) => cloudinary.uploader.upload_stream({ resource_type: 'image', timeout: 15000 }, (error, value) => error ? reject(error) : resolve(value)).end(buffer))
    if (!result?.secure_url) throw new Error('Dịch vụ ảnh không trả về URL.')
    return { url: result.secure_url, discard: () => cloudinary.uploader.destroy(result.public_id) }
  }
  if (storage !== 'local') throw new Error('IMAGE_STORAGE không hợp lệ.')
  const name = `${randomUUID()}.${extension}`
  await mkdir(imageDirectory, { recursive: true })
  const filePath = path.join(imageDirectory, name)
  await writeFile(filePath, buffer, { flag: 'wx' })
  return { url: `${origin}/uploads/images/${name}`, discard: () => unlink(filePath) }
}
