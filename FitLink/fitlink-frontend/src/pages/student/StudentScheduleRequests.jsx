import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { getStudentScheduleRequests } from '@/services/studentBookingService'

const statusLabels = { pending: 'Đang chờ PT', approved: 'Đã chấp nhận', rejected: 'Đã từ chối', expired: 'Đã hết hạn' }

export default function StudentScheduleRequests() {
  const [requests, setRequests] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const response = await getStudentScheduleRequests()
      setRequests(response.data?.data || [])
    } catch (err) {
      setError(err.response?.data?.message || 'Không tải được yêu cầu đổi lịch.')
    } finally {
      setLoading(false)
    }
  }, [])
  useEffect(() => { load() }, [load])

  return <main className="min-h-screen bg-slate-950 px-4 py-10 text-white">
    <div className="mx-auto max-w-4xl">
      <div className="mb-6 flex items-center justify-between gap-4">
        <div><h1 className="text-3xl font-bold">Yêu cầu đổi lịch</h1><p className="mt-2 text-slate-400">Theo dõi trạng thái các yêu cầu đổi lịch đã gửi cho PT.</p></div>
        <button onClick={load} className="rounded-lg border border-slate-700 px-4 py-2">Tải lại</button>
      </div>
      <Link to="/training-calendar" className="mb-5 inline-block text-orange-400">← Quay lại lịch tập</Link>
      {error && <p className="mb-4 rounded-lg bg-red-950 p-3 text-red-200">{error}</p>}
      {loading ? <p className="text-slate-400">Đang tải...</p> : requests.length === 0 ? <p className="rounded-xl border border-slate-800 p-6 text-slate-300">Bạn chưa gửi yêu cầu đổi lịch nào.</p> : <div className="space-y-3">
        {requests.map(request => <article key={request.id} className="rounded-xl border border-slate-800 bg-slate-900 p-5">
          <div className="flex flex-wrap items-start justify-between gap-3"><h2 className="font-semibold">Đổi lịch buổi tập</h2><span className="rounded-full bg-slate-800 px-3 py-1 text-sm">{statusLabels[request.status] || request.status}</span></div>
          <p className="mt-3 text-sm text-slate-300">Thời gian đề xuất: {new Date(request.newStartTime).toLocaleString('vi-VN')} – {new Date(request.newEndTime).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })}</p>
          <p className="mt-2 text-sm text-slate-400">Lý do: {request.reason}</p>
          {request.rejectReason && <p className="mt-2 text-sm text-red-300">Lý do từ chối: {request.rejectReason}</p>}
          <p className="mt-2 text-xs text-slate-500">Gửi lúc {new Date(request.created_at).toLocaleString('vi-VN')}</p>
        </article>)}
      </div>}
    </div>
  </main>
}
