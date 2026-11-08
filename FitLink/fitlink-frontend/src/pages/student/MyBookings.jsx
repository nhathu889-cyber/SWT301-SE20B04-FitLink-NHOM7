import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { cancelBooking, getMyBookings } from '@/services/bookingManagementService'
import { payTransaction } from '@/services/paymentService'

const labels = {
  PENDING_APPROVAL: 'Đang chờ PT duyệt',
  PENDING_PAYMENT: 'Đã duyệt, chờ thanh toán',
  PAID: 'Đã thanh toán',
  REJECTED: 'PT đã từ chối',
  CANCELLED: 'Đã hủy',
  EXPIRED: 'Đã hết hạn',
}

export default function MyBookings() {
  const [bookings, setBookings] = useState([])
  const [loading, setLoading] = useState(true)
  const [busyId, setBusyId] = useState('')
  const [error, setError] = useState('')
  const load = useCallback(async () => {
    setLoading(true); setError('')
    try { setBookings((await getMyBookings()).data?.data || []) }
    catch (e) { setError(e.response?.data?.message || 'Không tải được lịch đã đặt.') }
    finally { setLoading(false) }
  }, [])
  useEffect(() => { load() }, [load])

  const pay = async booking => {
    setBusyId(booking.id); setError('')
    try {
      const response = await payTransaction(booking.transactionId)
      const url = response.data?.checkoutUrl
      if (!url) throw new Error('Không tạo được đường dẫn thanh toán.')
      window.location.assign(url)
    } catch (e) { setError(e.response?.data?.message || e.message || 'Không thể thanh toán.') }
    finally { setBusyId('') }
  }

  const cancel = async booking => {
    if (!window.confirm('Bạn muốn hủy yêu cầu đặt lịch này?')) return
    setBusyId(booking.id); setError('')
    try { await cancelBooking(booking.id); await load() }
    catch (e) { setError(e.response?.data?.message || 'Không thể hủy booking.') }
    finally { setBusyId('') }
  }

  return <main className="min-h-screen bg-slate-950 px-4 py-10 text-white"><div className="mx-auto max-w-5xl">
    <div className="mb-6 flex items-center justify-between"><div><h1 className="text-3xl font-bold">Lịch PT của tôi</h1><p className="mt-2 text-slate-400">Theo dõi yêu cầu, thanh toán và trạng thái các gói tập.</p></div><button onClick={load} className="rounded-lg border border-slate-700 px-4 py-2">Tải lại</button></div>
    {error && <p className="mb-4 rounded-lg bg-red-950 p-3 text-red-200">{error}</p>}
    {loading ? <p className="text-slate-400">Đang tải...</p> : bookings.length === 0 ? <div className="rounded-xl border border-slate-800 p-6 text-slate-300">Bạn chưa có yêu cầu đặt lịch nào. <Link className="text-orange-400" to="/list-pt">Tìm PT</Link></div> : <div className="space-y-4">{bookings.map(booking => {
      const pkg = (() => { try { return JSON.parse(booking.packageSnapshot || '{}') } catch { return {} } })()
      const slot = (() => { try { return JSON.parse(booking.slot || '{}') } catch { return {} } })()
      const expired = ['PENDING_APPROVAL', 'PENDING_PAYMENT'].includes(booking.status) && booking.expiresAt && new Date(booking.expiresAt) <= new Date()
      const displayStatus = expired ? 'EXPIRED' : booking.status
      return <article key={booking.id} className="rounded-xl border border-slate-800 bg-slate-900 p-5">
        <div className="flex flex-wrap items-start justify-between gap-3"><div><h2 className="text-lg font-semibold">{pkg.name || 'Gói tập PT'}</h2><p className="mt-1 text-sm text-slate-400">Mã booking: {booking.id}</p></div><span className="rounded-full bg-slate-800 px-3 py-1 text-sm">{labels[displayStatus] || displayStatus}</span></div>
        <p className="mt-3 text-sm text-slate-300">Lịch: {booking.pattern || '—'} · {slot.start || '--:--'}–{slot.end || '--:--'} · Bắt đầu {booking.startDate ? new Date(booking.startDate).toLocaleDateString('vi-VN') : '—'}</p>
        <p className="mt-1 text-sm text-slate-300">Số tiền: {Number(booking.amount || 0).toLocaleString('vi-VN')} {booking.currency || 'VND'}</p>
        {booking.status === 'PENDING_PAYMENT' && !expired && <button disabled={busyId === booking.id} onClick={() => pay(booking)} className="mt-4 rounded-lg bg-orange-600 px-4 py-2 font-semibold disabled:opacity-50">{busyId === booking.id ? 'Đang xử lý...' : 'Thanh toán'}</button>}
        {['PENDING_APPROVAL', 'PENDING_PAYMENT'].includes(booking.status) && !expired && ['initiated', 'cancelled', null].includes(booking.transactionStatus) && <button disabled={busyId === booking.id} onClick={() => cancel(booking)} className="ml-2 mt-4 rounded-lg border border-slate-600 px-4 py-2 disabled:opacity-50">Hủy yêu cầu</button>}
      </article>
    })}</div>}
  </div></main>
}
