import { StatusCodes } from 'http-status-codes'
import { manualPayment, transferDetails } from '../config/manualPayment.js'
import PayOS from '@payos/node'
import { Op } from 'sequelize'
import { sequelize } from '~/config/sql.js'
import Package from '~/models/sql/Package.js'
import Booking from '~/models/sql/Booking.js'
import Transaction from '~/models/sql/Transaction.js'
import StudentProfile from '~/models/sql/StudentProfile.js'
import StudentPackage from '~/models/sql/StudentPackage.js'
import { env } from '~/config/environment.js'
import { calcBookingPricing } from '~/utils/pricingUtils.js'
import { creditPTWalletSQL } from '~/services/sqlWalletService.js'
import { buildBookingSchedule, createSlotsAndSessionsForBooking } from '../services/bookingSchedule.js'

const payOS = new PayOS(env.PAYOS_CLIENT_ID, env.PAYOS_API_KEY, env.PAYOS_CHECKSUM_KEY)

const parseJson = (value, fallback) => {
  try {
    return value ? JSON.parse(value) : fallback
  } catch {
    return fallback
  }
}

const initBookingAndTransaction = async (req, res) => {
  try {
    const studentId = req.user._id
    const { pt, package: packageId, pattern, slot, startDate, mode } = req.body
    const { clientAddress, ptGymAddress, otherGymAddress, travelPolicy, travelDistanceKm, inRange, exceededByKm, packageSnapshot: packageSnapshotInput, amount, currency, notes } = req.body

    if (!pt || !packageId || !Array.isArray(pattern) || !slot?.start || !slot?.end || !startDate) {
      return res.status(StatusCodes.BAD_REQUEST).json({ success: false, message: 'Thiếu pt/package/pattern/slot/startDate' })
    }

    const [pkg, studentProfile] = await Promise.all([
      Package.findByPk(packageId),
      StudentProfile.findOne({ where: { userId: studentId } })
    ])
    if (!pkg || !pkg.isActive) return res.status(StatusCodes.NOT_FOUND).json({ success: false, message: 'Gói không khả dụng' })
    if (pkg.ptId !== pt || pkg.visibility !== 'public') return res.status(StatusCodes.FORBIDDEN).json({ success: false, message: 'Gói này không bán công khai' })

    buildBookingSchedule({ pattern, slot, startDate, totalSessions: pkg.totalSessions, sessionDurationMin: pkg.sessionDurationMin })

    const pkgData = pkg.toJSON()
    const packageSnapshot = packageSnapshotInput || {
      name: pkgData.name,
      price: pkgData.price || 0,
      currency: 'VND',
      totalSessions: pkgData.totalSessions,
      sessionDurationMin: pkgData.sessionDurationMin
    }
    const pricing = calcBookingPricing({
      mode,
      base: packageSnapshot.price || 0,
      tax: 0,
      discount: 0,
      travelDistanceKm: Number.isFinite(travelDistanceKm) ? travelDistanceKm : 0,
      travelPolicy: travelPolicy || { freeRadiusKm: 6, maxTravelKm: 20, feePerKm: 1000 }
    })
    const transaction = await sequelize.transaction()
    try {
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
        clientAddress: JSON.stringify(clientAddress || parseJson(studentProfile?.defaultLocation, null)),
        ptGymAddress: JSON.stringify(ptGymAddress || null),
        otherGymAddress: JSON.stringify(otherGymAddress || null),
        travelPolicy: JSON.stringify(travelPolicy || {}),
        travelDistanceKm: Number.isFinite(travelDistanceKm) ? travelDistanceKm : 0,
        travelFee: pricing.travel,
        inRange: inRange ?? true,
        exceededByKm: exceededByKm ?? 0,
        packageSnapshot: JSON.stringify(packageSnapshot),
        pricing: JSON.stringify(pricing),
        amount: manualPayment.enabled ? manualPayment.amount : pricing.total,
        currency: currency || packageSnapshot.currency || 'VND',
        status: 'PENDING_PAYMENT',
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
      await transaction.commit()
      return res.status(StatusCodes.CREATED).json({ success: true, data: { bookingId: booking.id, transactionId: createdTransaction.id, status: createdTransaction.status, amount: createdTransaction.amount, currency: booking.currency, package: { id: pkgData.id, name: pkgData.name, price: pkgData.price, totalSessions: pkgData.totalSessions, durationDays: pkgData.durationDays } } })
    } catch (error) {
      await transaction.rollback()
      throw error
    }
  } catch (error) {
    return res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({ success: false, message: error.message })
  }
}

const createPaymentLink = async (req, res) => {
  try {
    const transaction = await Transaction.findOne({ where: { id: req.params.transactionId, studentId: req.user._id } })
    if (!transaction) return res.status(StatusCodes.NOT_FOUND).json({ success: false, message: 'Không tìm thấy giao dịch' })
    if (transaction.method === 'bank_transfer') {
      if (!['initiated', 'pending_transfer'].includes(transaction.status)) return res.status(400).json({ success: false, message: 'Trạng thái giao dịch không hợp lệ' })
      await transaction.update({ status: 'pending_transfer' })
      return res.json({ success: true, data: { transactionId: transaction.id, checkoutUrl: `/payment/transfer/${transaction.id}`, status: transaction.status, transfer: transferDetails(transaction) } })
    }
    if (transaction.status !== 'initiated') return res.status(StatusCodes.BAD_REQUEST).json({ success: false, message: 'Trạng thái giao dịch không hợp lệ' })
    const pkg = await Package.findByPk(transaction.packageId)
    const orderCode = Number(String(Date.now()).slice(-10))
    const clientUrl = (env.CLIENT_URL || 'http://localhost:5173').replace(/\/$/, '')
    const payment = await payOS.createPaymentLink({
      orderCode,
      amount: Number(transaction.amount),
      description: String(pkg?.name || 'Gói tập PT').slice(0, 25),
      items: [{ name: String(pkg?.name || 'Gói tập PT').slice(0, 25), quantity: 1, price: Number(transaction.amount) }],
      returnUrl: `${clientUrl}/payment/result?payment=success&orderCode=${orderCode}`,
      cancelUrl: `${clientUrl}/payment/result?payment=cancelled&orderCode=${orderCode}`
    })
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
    if (transaction.status === 'paid') return res.status(StatusCodes.OK).json({ success: true, data: { status: 'paid' } })
    if (isManualAdmin && transaction.status !== 'pending_transfer') return res.status(400).json({ success: false, message: 'Giao dịch không chờ chuyển khoản' })
    const paymentInfo = isManualAdmin ? { status: 'PAID', transactions: [{ transactionId: `admin:${req.user._id}` }] } : await payOS.getPaymentLinkInformation(orderCode)
    const gatewayStatus = String(paymentInfo?.status || '').toUpperCase()
    if (gatewayStatus === 'CANCELLED') {
      await transaction.update({ status: 'cancelled' })
      await Booking.update({ status: 'CANCELLED' }, { where: { id: transaction.bookingId } })
      return res.status(StatusCodes.OK).json({ success: true, data: { status: 'cancelled' } })
    }
    if (gatewayStatus !== 'PAID') return res.status(StatusCodes.BAD_REQUEST).json({ success: false, message: 'Thanh toán chưa được PayOS xác nhận' })

    const platformFee = Math.floor(Number(transaction.amount) * Number(env.PLATFORM_FEE_PERCENT || 20) / 100)
    const tx = await sequelize.transaction()
    try {
      const [claimed] = await Transaction.update({ status: 'paid', paidAt: new Date(), platformFee, ptEarning: Number(transaction.amount) - platformFee, gatewayTxnId: paymentInfo?.transactions?.[0]?.transactionId }, { where: { id: transaction.id, status: { [Op.ne]: 'paid' } }, transaction: tx })
      if (!claimed) {
        await tx.commit()
        return res.json({ success: true, data: { transactionId: transaction.id, status: 'paid' } })
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
    const transaction = await Transaction.findOne({ where: { id: req.params.transactionId, studentId: req.user._id }, attributes: ['id', 'status', 'payosOrderCode', 'method', 'amount'] })
    if (!transaction) return res.status(StatusCodes.NOT_FOUND).json({ success: false, message: 'Không tìm thấy' })
    return res.status(StatusCodes.OK).json({ success: true, data: { status: transaction.status, transfer: transaction.method === 'bank_transfer' ? transferDetails(transaction) : null } })
  } catch (error) {
    return res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({ success: false, message: error.message })
  }
}

export const checkoutSqlController = { initBookingAndTransaction, createPaymentLink, confirmPayment, getTransactionStatus }
