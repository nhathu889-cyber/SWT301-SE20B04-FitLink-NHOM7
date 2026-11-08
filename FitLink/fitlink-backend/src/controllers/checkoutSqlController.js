import { StatusCodes } from 'http-status-codes'
import { manualPayment, transferDetails } from '../config/manualPayment.js'
import PayOS from '@payos/node'
import { Op } from 'sequelize'
import { sequelize } from '~/config/sql.js'
import Package from '~/models/sql/Package.js'
import Booking from '~/models/sql/Booking.js'
import Transaction from '~/models/sql/Transaction.js'
import StudentProfile from '~/models/sql/StudentProfile.js'
import PTProfile from '~/models/sql/PTProfile.js'
import Slot from '~/models/sql/Slot.js'
import StudentPackage from '~/models/sql/StudentPackage.js'
import Notification from '~/models/sql/Notification.js'
import { env } from '~/config/environment.js'
import { calcBookingPricing } from '~/utils/pricingUtils.js'
import { creditPTWalletSQL } from '~/services/sqlWalletService.js'
import { validateBookingSelection, acquireScheduleLock, reserveBookingSlots, releaseBookingSlots, createSlotsAndSessionsForBooking } from '../services/bookingSchedule.js'

const payOS = new PayOS(env.PAYOS_CLIENT_ID, env.PAYOS_API_KEY, env.PAYOS_CHECKSUM_KEY)

const parseJson = (value, fallback) => {
  try {
    return value ? JSON.parse(value) : fallback
  } catch {
    return fallback
  }
}

const routeDistanceKm = async (ptProfile, mode, clientAddress, otherGymAddress) => {
  const gym = parseJson(ptProfile.primaryGym, {})
  const origin = gym?.location?.coordinates
  if (mode === 'atPtGym') {
    if (!gym?.address && !gym?.name) { const error = new Error('PT chưa khai báo địa điểm tập tại gym.'); error.statusCode = StatusCodes.BAD_REQUEST; throw error }
    return 0
  }
  const destinationAddress = mode === 'atClient' ? clientAddress : otherGymAddress
  const destination = destinationAddress?.location
  const lng = Number(destination?.lng); const lat = Number(destination?.lat)
  if (!Array.isArray(origin) || origin.length !== 2 || !Number.isFinite(Number(origin[0])) || Math.abs(Number(origin[0])) > 180 || !Number.isFinite(Number(origin[1])) || Math.abs(Number(origin[1])) > 90 || !Number.isFinite(lng) || Math.abs(lng) > 180 || !Number.isFinite(lat) || Math.abs(lat) > 90) {
    const error = new Error('Địa chỉ tập chưa có tọa độ hợp lệ.')
    error.statusCode = StatusCodes.BAD_REQUEST
    throw error
  }
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 6000)
  try {
    const coords = `${Number(origin[0])},${Number(origin[1])};${lng},${lat}`
    const response = await fetch(`https://router.project-osrm.org/route/v1/driving/${coords}?overview=false`, { signal: controller.signal })
    if (!response.ok) throw new Error('Route service unavailable')
    const route = (await response.json())?.routes?.[0]
    if (!Number.isFinite(route?.distance)) throw new Error('No valid route')
    return route.distance / 1000
  } catch {
    const error = new Error('Không thể xác định quãng đường để tính phí. Vui lòng thử lại.')
    error.statusCode = StatusCodes.SERVICE_UNAVAILABLE
    throw error
  } finally { clearTimeout(timeout) }
}

const initBookingAndTransaction = async (req, res) => {
  try {
    const studentId = req.user._id
    const { pt, package: packageId, pattern, slot, startDate, mode } = req.body
    const { clientAddress, ptGymAddress, otherGymAddress, notes } = req.body

    if (!pt || !packageId || !Array.isArray(pattern) || !slot?.start || !slot?.end || !startDate) {
      return res.status(StatusCodes.BAD_REQUEST).json({ success: false, message: 'Thiếu pt/package/pattern/slot/startDate' })
    }

    const [pkg, studentProfile, ptProfile] = await Promise.all([
      Package.findByPk(packageId),
      StudentProfile.findOne({ where: { userId: studentId } }),
      PTProfile.findOne({ where: { userId: pt } })
    ])
    if (!pkg || !pkg.isActive) return res.status(StatusCodes.NOT_FOUND).json({ success: false, message: 'Gói không khả dụng' })
    if (pkg.ptId !== pt || pkg.visibility !== 'public') return res.status(StatusCodes.FORBIDDEN).json({ success: false, message: 'Gói này không bán công khai' })

    let occurrences
    try { occurrences = validateBookingSelection({ ptProfile, pkg, pattern, slot, startDate, mode }) }
    catch (error) { error.statusCode ||= StatusCodes.BAD_REQUEST; throw error }

    const pkgData = pkg.toJSON()
    const serverPtGymAddress = parseJson(ptProfile.primaryGym, {})
    const savedLocation = parseJson(studentProfile?.defaultLocation, null)
    const effectiveClientAddress = clientAddress || (savedLocation?.type === 'Point' && Array.isArray(savedLocation.coordinates)
      ? { location: { lng: Number(savedLocation.coordinates[0]), lat: Number(savedLocation.coordinates[1]) } }
      : null)
    const packageSnapshot = {
      name: pkgData.name,
      price: Number(pkgData.price) || 0,
      currency: 'VND',
      totalSessions: pkgData.totalSessions,
      sessionDurationMin: pkgData.sessionDurationMin
    }
    const serverTravelPolicy = { freeRadiusKm: 5, maxTravelKm: 15, feePerKm: 10000, ...parseJson(ptProfile.travelPolicy, {}) }
    const safeDistance = await routeDistanceKm(ptProfile, mode, effectiveClientAddress, otherGymAddress)
    if (mode !== 'atPtGym' && safeDistance > (Number(serverTravelPolicy.maxTravelKm) || 20)) {
      return res.status(StatusCodes.BAD_REQUEST).json({ success: false, message: 'Địa điểm tập vượt quá phạm vi PT hỗ trợ.' })
    }
    const pricing = calcBookingPricing({ mode, base: Number(pkgData.price) || 0, tax: 0, discount: 0, travelDistanceKm: safeDistance, travelPolicy: serverTravelPolicy })
    const transaction = await sequelize.transaction()
    try {
      const expiresAt = new Date(Date.now() + 48 * 60 * 60 * 1000)
      const booking = await Booking.create({
        studentId,
        ptId: pkgData.ptId,
        packageId: pkgData.id,
        pattern: JSON.stringify(pattern),
        slot: JSON.stringify(slot),
        patternKey: [...pattern].sort((a, b) => a - b).join('-'),
        slotKey: `${slot.start}-${slot.end}`,
        startDate: new Date(`${startDate}T00:00:00`),
        mode,
        clientAddress: JSON.stringify(effectiveClientAddress),
        ptGymAddress: JSON.stringify(mode === 'atPtGym' ? serverPtGymAddress : null),
        otherGymAddress: JSON.stringify(otherGymAddress || null),
        travelPolicy: JSON.stringify(serverTravelPolicy),
        travelDistanceKm: safeDistance,
        travelFee: pricing.travel,
        inRange: safeDistance <= (Number(serverTravelPolicy.freeRadiusKm) || 0),
        exceededByKm: 0,
        packageSnapshot: JSON.stringify(packageSnapshot),
        pricing: JSON.stringify(pricing),
        amount: pricing.total,
        currency: 'VND',
        status: 'PENDING_APPROVAL',
        expiresAt,
        notes: notes || null
      }, { transaction })
      const createdTransaction = await Transaction.create({
        studentId,
        ptId: pkgData.ptId,
        packageId: pkgData.id,
        bookingId: booking.id,
        amount: booking.amount,
        method: manualPayment.enabled ? 'bank_transfer' : 'payos',
        status: 'initiated'
      }, { transaction })
      await booking.update({ transactionId: createdTransaction.id }, { transaction })
      await reserveBookingSlots({ booking, pkg, occurrences, expiresAt, transaction })
      const notification = await Notification.create({ userId: pt, type: 'booking', title: 'Yêu cầu đặt lịch mới', message: 'Bạn có yêu cầu đặt lịch PT mới cần xem xét.', meta: JSON.stringify({ bookingId: booking.id, studentId }) }, { transaction })
      await transaction.commit()
      try { global.sendNotificationToUser?.(pt, notification) } catch {}
      return res.status(StatusCodes.CREATED).json({ success: true, data: { bookingId: booking.id, transactionId: createdTransaction.id, status: createdTransaction.status, amount: createdTransaction.amount, currency: booking.currency, package: { id: pkgData.id, name: pkgData.name, price: pkgData.price, totalSessions: pkgData.totalSessions, durationDays: pkgData.durationDays } } })
    } catch (error) {
      await transaction.rollback()
      throw error
    }
  } catch (error) {
    const conflict = /already reserved|already has a session|đã được giữ|đã có buổi tập/i.test(error.message || '')
    const invalid = /không có|không hợp lệ|không khớp|không thuộc|phải nằm|không hỗ trợ/i.test(error.message || '')
    return res.status(error.statusCode || (conflict ? StatusCodes.CONFLICT : invalid ? StatusCodes.BAD_REQUEST : StatusCodes.INTERNAL_SERVER_ERROR)).json({ success: false, message: error.message })
  }
}

const createPaymentLink = async (req, res) => {
  try {
    const transaction = await Transaction.findOne({ where: { id: req.params.transactionId, studentId: req.user._id } })
    const booking = transaction?.bookingId ? await Booking.findByPk(transaction.bookingId) : null
    if (transaction?.bookingId && (!booking || booking.status !== 'PENDING_PAYMENT' || (booking.expiresAt && new Date(booking.expiresAt) <= new Date()))) return res.status(StatusCodes.CONFLICT).json({ success: false, message: 'Booking expired or no longer active.' })
    if (!transaction) return res.status(StatusCodes.NOT_FOUND).json({ success: false, message: 'Không tìm thấy giao dịch' })
    if (transaction.method === 'bank_transfer') {
      if (!['initiated', 'pending_transfer'].includes(transaction.status)) return res.status(400).json({ success: false, message: 'Trạng thái giao dịch không hợp lệ' })
      const holdTx = await sequelize.transaction()
      try {
        if (booking) {
          await acquireScheduleLock(booking.ptId, holdTx)
          const locked = await Booking.findByPk(booking.id, { transaction: holdTx, lock: holdTx.LOCK.UPDATE })
          if (!locked || locked.status !== 'PENDING_PAYMENT' || (locked.expiresAt && new Date(locked.expiresAt) <= new Date())) {
            await holdTx.rollback()
            return res.status(StatusCodes.CONFLICT).json({ success: false, message: 'Booking expired or no longer active.' })
          }
          await locked.update({ expiresAt: null }, { transaction: holdTx })
          await Slot.update({ expiresAt: null }, { where: { bookedByBookingId: locked.id, status: 'BOOKED' }, transaction: holdTx })
        }
        await transaction.update({ status: 'pending_transfer' }, { transaction: holdTx })
        await holdTx.commit()
      } catch (error) { if (!holdTx.finished) await holdTx.rollback(); throw error }
      return res.json({ success: true, data: { transactionId: transaction.id, checkoutUrl: `/payment/transfer/${transaction.id}`, status: transaction.status, transfer: transferDetails(transaction) } })
    }
    if (transaction.status !== 'initiated') return res.status(StatusCodes.BAD_REQUEST).json({ success: false, message: 'Trạng thái giao dịch không hợp lệ' })
    const claimTx = await sequelize.transaction()
    try {
      if (booking) await acquireScheduleLock(booking.ptId, claimTx)
      const lockedTransaction = await Transaction.findByPk(transaction.id, { transaction: claimTx, lock: claimTx.LOCK.UPDATE })
      const lockedBooking = booking ? await Booking.findByPk(booking.id, { transaction: claimTx, lock: claimTx.LOCK.UPDATE }) : null
      if (!lockedTransaction || lockedTransaction.status !== 'initiated' || (booking && (!lockedBooking || lockedBooking.status !== 'PENDING_PAYMENT' || (lockedBooking.expiresAt && new Date(lockedBooking.expiresAt) <= new Date())))) {
        await claimTx.rollback()
        return res.status(StatusCodes.CONFLICT).json({ success: false, message: 'Booking or transaction is no longer active.' })
      }
      await lockedTransaction.update({ status: 'pending_gateway' }, { transaction: claimTx })
      await claimTx.commit()
    } catch (error) { if (!claimTx.finished) await claimTx.rollback(); throw error }
    const pkg = await Package.findByPk(transaction.packageId)
    const orderCode = Number(String(Date.now()).slice(-10))
    const clientUrl = (env.CLIENT_URL || 'http://localhost:5173').replace(/\/$/, '')
    let payment
    try { payment = await payOS.createPaymentLink({
      orderCode,
      amount: Number(transaction.amount),
      description: String(pkg?.name || 'Gói tập PT').slice(0, 25),
      items: [{ name: String(pkg?.name || 'Gói tập PT').slice(0, 25), quantity: 1, price: Number(transaction.amount) }],
      returnUrl: `${clientUrl}/payment/result?payment=success&orderCode=${orderCode}`,
      cancelUrl: `${clientUrl}/payment/result?payment=cancelled&orderCode=${orderCode}`,
      expiredAt: booking?.expiresAt ? Math.floor(new Date(booking.expiresAt).getTime() / 1000) : undefined
    }) } catch (error) {
      await Transaction.update({ status: 'initiated' }, { where: { id: transaction.id, status: 'pending_gateway' } })
      throw error
    }
    await transaction.update({ status: 'pending_gateway', payosOrderCode: orderCode, payosCheckoutUrl: payment.checkoutUrl })
    return res.status(StatusCodes.OK).json({ success: true, data: { transactionId: transaction.id, orderCode, checkoutUrl: payment.checkoutUrl, status: transaction.status } })
  } catch (error) {
    return res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({ success: false, message: error.message })
  }
}

const confirmPayment = async (req, res) => {
  const isManualAdmin = req.user.role === 'admin' && Boolean(req.params.transactionId)
  const orderCode = Number(req.body.orderCode)
  if (!isManualAdmin && !Number.isFinite(orderCode)) return res.status(StatusCodes.BAD_REQUEST).json({ success: false, message: 'orderCode không hợp lệ' })
  try {
    const transaction = await Transaction.findOne({ where: isManualAdmin ? { id: req.params.transactionId, method: 'bank_transfer' } : { payosOrderCode: orderCode, studentId: req.user._id, method: 'payos' } })
    if (!transaction) return res.status(StatusCodes.NOT_FOUND).json({ success: false, message: 'Không tìm thấy giao dịch' })
    if (transaction.status === 'paid') return res.status(StatusCodes.OK).json({ success: true, data: { status: 'paid', destination: !transaction.ptId && !transaction.bookingId ? '/gym-packages' : '/training-calendar' } })
    if (isManualAdmin && transaction.status !== 'pending_transfer') return res.status(400).json({ success: false, message: 'Giao dịch không chờ chuyển khoản' })
    if (!isManualAdmin && transaction.status !== 'pending_gateway') return res.status(StatusCodes.CONFLICT).json({ success: false, message: 'Payment is not awaiting gateway confirmation.' })
    const paymentInfo = isManualAdmin ? { status: 'PAID', transactions: [{ transactionId: `admin:${req.user._id}` }] } : await payOS.getPaymentLinkInformation(orderCode)
    const gatewayStatus = String(paymentInfo?.status || '').toUpperCase()
    if (gatewayStatus === 'CANCELLED') {
      const cancelTx = await sequelize.transaction()
      try {
        if (transaction.bookingId && transaction.ptId) await acquireScheduleLock(transaction.ptId, cancelTx)
        await transaction.update({ status: 'cancelled' }, { transaction: cancelTx })
        if (transaction.bookingId) {
          await Booking.update({ status: 'CANCELLED' }, { where: { id: transaction.bookingId, status: 'PENDING_PAYMENT' }, transaction: cancelTx })
          await releaseBookingSlots(transaction.bookingId, cancelTx)
        }
        await cancelTx.commit()
      } catch (error) { await cancelTx.rollback(); throw error }
      return res.status(StatusCodes.OK).json({ success: true, data: { status: 'cancelled' } })
    }
    if (gatewayStatus !== 'PAID') return res.status(StatusCodes.BAD_REQUEST).json({ success: false, message: 'Thanh toán chưa được PayOS xác nhận' })

    const isGymPackage = !transaction.ptId && !transaction.bookingId
    const platformFee = isGymPackage ? Number(transaction.amount) : Math.floor(Number(transaction.amount) * Number(env.PLATFORM_FEE_PERCENT || 20) / 100)
    const tx = await sequelize.transaction()
    try {
      if (transaction.bookingId && transaction.ptId) await acquireScheduleLock(transaction.ptId, tx)
      const lockedBooking = transaction.bookingId ? await Booking.findByPk(transaction.bookingId, { transaction: tx, lock: tx.LOCK.UPDATE }) : null
      if (transaction.bookingId && (!lockedBooking || lockedBooking.status !== 'PENDING_PAYMENT' || (lockedBooking.expiresAt && new Date(lockedBooking.expiresAt) <= new Date()))) {
        await tx.rollback()
        return res.status(StatusCodes.CONFLICT).json({ success: false, message: 'Booking expired or no longer active.' })
      }
      const [claimed] = await Transaction.update({ status: 'paid', paidAt: new Date(), platformFee, ptEarning: Number(transaction.amount) - platformFee, gatewayTxnId: paymentInfo?.transactions?.[0]?.transactionId }, { where: { id: transaction.id, status: { [Op.ne]: 'paid' } }, transaction: tx })
      if (!claimed) {
        await tx.commit()
        return res.json({ success: true, data: { transactionId: transaction.id, status: 'paid', destination: isGymPackage ? '/gym-packages' : '/training-calendar' } })
      }
      if (isGymPackage) {
        const pkg = await Package.findByPk(transaction.packageId, { transaction: tx })
        if (!pkg || pkg.ptId) throw new Error('Không tìm thấy gói tập gym đã mua')
        const startDate = new Date()
        await StudentPackage.create({ studentId: transaction.studentId, ptId: null, packageId: pkg.id, transactionId: transaction.id, bookingId: null, startDate, endDate: new Date(startDate.getTime() + Number(pkg.durationDays) * 86400000), totalSessions: pkg.totalSessions, remainingSessions: pkg.totalSessions, status: 'active' }, { transaction: tx })
        await tx.commit()
        return res.json({ success: true, message: 'Đã kích hoạt gói tập gym', data: { transactionId: transaction.id, status: 'paid', destination: '/gym-packages' } })
      }
      await Booking.update({ status: 'PAID', transactionId: transaction.id }, { where: { id: transaction.bookingId }, transaction: tx })
      const [booking, pkg] = await Promise.all([Booking.findByPk(transaction.bookingId, { transaction: tx }), Package.findByPk(transaction.packageId, { transaction: tx })])
      let existing = await StudentPackage.findOne({ where: { transactionId: transaction.id }, transaction: tx })
      if (!existing) {
        const pattern = JSON.parse(booking?.pattern || '[]')
        const slot = JSON.parse(booking?.slot || '{}')
        const startDate = booking?.startDate || new Date()
        existing = await StudentPackage.create({ studentId: transaction.studentId, ptId: transaction.ptId, packageId: transaction.packageId, transactionId: transaction.id, bookingId: transaction.bookingId, startDate, endDate: new Date(startDate.getTime() + Number(pkg?.durationDays || 30) * 86400000), totalSessions: pkg?.totalSessions, remainingSessions: pkg?.totalSessions, pattern: JSON.stringify(pattern), slot: JSON.stringify(slot), patternKey: pattern.sort((a, b) => a - b).join('-'), slotKey: slot.start && slot.end ? `${slot.start}-${slot.end}` : null }, { transaction: tx })
      }
      if (!booking || !pkg) throw new Error('Payment booking/package not found')
      await createSlotsAndSessionsForBooking(booking, existing, pkg, tx)
      await creditPTWalletSQL({ ptId: transaction.ptId, amount: Number(transaction.amount) - platformFee, transactionId: transaction.id, transaction: tx })
      await tx.commit()
    } catch (error) {
      await tx.rollback()
      throw error
    }
    return res.status(StatusCodes.OK).json({ success: true, message: 'Thanh toán thành công', data: { transactionId: transaction.id, status: 'paid' } })
  } catch (error) {
    return res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({ success: false, message: error.message })
  }
}

const getTransactionStatus = async (req, res) => {
  try {
    const transaction = await Transaction.findOne({ where: { id: req.params.transactionId, studentId: req.user._id }, attributes: ['id', 'status', 'payosOrderCode', 'method', 'amount', 'ptId', 'bookingId'] })
    if (!transaction) return res.status(StatusCodes.NOT_FOUND).json({ success: false, message: 'Không tìm thấy' })
    return res.status(StatusCodes.OK).json({ success: true, data: { status: transaction.status, destination: !transaction.ptId && !transaction.bookingId ? '/gym-packages' : '/training-calendar', transfer: transaction.method === 'bank_transfer' ? transferDetails(transaction) : null } })
  } catch (error) {
    return res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({ success: false, message: error.message })
  }
}

const rejectBankTransfer = async (req, res) => {
  const initial = await Transaction.findOne({ where: { id: req.params.transactionId, method: 'bank_transfer' } })
  if (!initial) return res.status(StatusCodes.NOT_FOUND).json({ success: false, message: 'Không tìm thấy giao dịch.' })
  const tx = await sequelize.transaction()
  try {
    if (initial.bookingId && initial.ptId) await acquireScheduleLock(initial.ptId, tx)
    const transaction = await Transaction.findByPk(initial.id, { transaction: tx, lock: tx.LOCK.UPDATE })
    if (!transaction || transaction.status !== 'pending_transfer') { await tx.rollback(); return res.status(StatusCodes.CONFLICT).json({ success: false, message: 'Giao dịch không chờ xác nhận chuyển khoản.' }) }
    await transaction.update({ status: 'cancelled' }, { transaction: tx })
    if (transaction.bookingId) {
      await Booking.update({ status: 'CANCELLED' }, { where: { id: transaction.bookingId, status: 'PENDING_PAYMENT' }, transaction: tx })
      await releaseBookingSlots(transaction.bookingId, tx)
    }
    await tx.commit()
    return res.json({ success: true, data: { transactionId: transaction.id, status: 'cancelled' } })
  } catch (error) { if (!tx.finished) await tx.rollback(); return res.status(500).json({ success: false, message: error.message }) }
}

export const checkoutSqlController = { initBookingAndTransaction, createPaymentLink, confirmPayment, getTransactionStatus, rejectBankTransfer }
