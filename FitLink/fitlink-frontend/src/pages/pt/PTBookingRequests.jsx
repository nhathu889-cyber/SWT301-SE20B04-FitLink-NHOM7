import { useCallback, useEffect, useState } from 'react'
import PTMainLayout from '@/layouts/pt/PTMainLayout'
import { approveBooking, getPTBookings, rejectBooking } from '@/services/bookingManagementService'

export default function PTBookingRequests() {
  const [bookings, setBookings] = useState([])
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState('')
  const [error, setError] = useState('')
  const load = useCallback(async () => {
    setLoading(true); setError('')
    try { setBookings((await getPTBookings()).data?.data || []) }
    catch (e) { setError(e.response?.data?.message || 'Không tải được yêu cầu đặt lịch.') }
    finally { setLoading(false) }
  }, [])
  useEffect(() => { load() }, [load])

  const decide = async (booking, action) => {
    setBusy(booking.id); setError('')
    try {
      if (action === 'reject' && !window.confirm('Từ chối yêu cầu đặt lịch này?')) return
      if (action === 'approve') await approveBooking(booking.id)
      else await rejectBooking(booking.id)
      await load()
    } catch (e) { setError(e.response?.data?.message || 'Không cập nhật được yêu cầu.') }
    finally { setBusy('') }
  }

  return <PTMainLayout><main className="min-h-screen bg-slate-950 px-4 py-8 text-white"><div className="mx-auto max-w-5xl">
    <div className="mb-6 flex items-center justify-between"><div><h1 className="text-2xl font-bold">Yêu cầu đặt lịch</h1><p className="mt-1 text-slate-400">Duyệt yêu cầu trước khi học viên thanh toán.</p></div><button onClick={load} className="rounded-lg border border-slate-700 px-4 py-2">Tải lại</button></div>
    {error && <p className="mb-4 rounded-lg bg-red-950 p-3 text-red-200">{error}</p>}
    {loading ? <p className="text-slate-400">Đang tải...</p> : bookings.length === 0 ? <p className="rounded-xl border border-slate-800 p-6 text-slate-400">Chưa có yêu cầu đặt lịch.</p> : <div className="space-y-3">{bookings.map(booking => {
      const pkg = (() => { try { return JSON.parse(booking.packageSnapshot || '{}') } catch { return {} } })()
      const slot = (() => { try { return JSON.parse(booking.slot || '{}') } catch { return {} } })()
      const expired = booking.expiresAt && new Date(booking.expiresAt) <= new Date()
      return <article key={booking.id} className="rounded-xl border border-slate-800 bg-slate-900 p-5"><div className="flex flex-wrap justify-between gap-3"><div><h2 className="font-semibold">{pkg.name || 'Gói PT'}</h2><p className="mt-1 text-sm text-slate-400">Học viên: {booking.student?.name || booking.studentId}</p><p className="mt-1 text-sm text-slate-300">{booking.startDate ? new Date(booking.startDate).toLocaleDateString('vi-VN') : '—'} · {slot.start || '--:--'}–{slot.end || '--:--'} · {booking.pattern}</p></div><span className="text-sm text-slate-300">{expired && booking.status === 'PENDING_APPROVAL' ? 'EXPIRED' : booking.status}</span></div>
        {booking.status === 'PENDING_APPROVAL' && !expired && <div className="mt-4 flex gap-2"><button disabled={busy === booking.id} onClick={() => decide(booking, 'approve')} className="rounded-lg bg-emerald-600 px-4 py-2 disabled:opacity-50">Duyệt</button><button disabled={busy === booking.id} onClick={() => decide(booking, 'reject')} className="rounded-lg border border-red-700 px-4 py-2 text-red-300 disabled:opacity-50">Từ chối</button></div>}
      </article>
    })}</div>}
  </div></main></PTMainLayout>
}
