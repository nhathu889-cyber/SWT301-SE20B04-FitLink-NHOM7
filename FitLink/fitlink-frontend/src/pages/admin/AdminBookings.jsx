import { useCallback, useEffect, useState } from 'react'
import AdminLayout from '@/layouts/AdminLayout'
import { getAllBookings } from '@/services/bookingManagementService'

export default function AdminBookings() {
  const [filters, setFilters] = useState({ search: '', status: '', from: '', to: '' })
  const [bookings, setBookings] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const load = useCallback(async () => {
    setLoading(true); setError('')
    try { setBookings((await getAllBookings(Object.fromEntries(Object.entries(filters).filter(([, value]) => value)))).data?.data || []) }
    catch (e) { setError(e.response?.data?.message || 'Không tải được booking.') }
    finally { setLoading(false) }
  }, [filters])
  useEffect(() => { load() }, [load])

  return <AdminLayout><main className="min-h-screen bg-slate-950 p-6 text-white"><div className="mx-auto max-w-7xl">
    <h1 className="mb-5 text-2xl font-bold">Quản lý booking</h1>
    <form onSubmit={e => { e.preventDefault(); load() }} className="mb-5 grid gap-3 rounded-xl border border-slate-800 bg-slate-900 p-4 md:grid-cols-5">
      <input value={filters.search} onChange={e => setFilters(f => ({ ...f, search: e.target.value }))} placeholder="Mã booking / ghi chú" className="rounded-lg bg-slate-800 px-3 py-2" />
      <select value={filters.status} onChange={e => setFilters(f => ({ ...f, status: e.target.value }))} className="rounded-lg bg-slate-800 px-3 py-2"><option value="">Mọi trạng thái</option>{['PENDING_APPROVAL','PENDING_PAYMENT','PAID','REJECTED','CANCELLED','EXPIRED'].map(s => <option key={s}>{s}</option>)}</select>
      <input type="date" value={filters.from} onChange={e => setFilters(f => ({ ...f, from: e.target.value }))} className="rounded-lg bg-slate-800 px-3 py-2" />
      <input type="date" value={filters.to} onChange={e => setFilters(f => ({ ...f, to: e.target.value }))} className="rounded-lg bg-slate-800 px-3 py-2" />
      <button className="rounded-lg bg-orange-600 px-4 py-2 font-semibold">Lọc</button>
    </form>
    {error && <p className="mb-3 rounded bg-red-950 p-3 text-red-200">{error}</p>}
    <div className="overflow-x-auto rounded-xl border border-slate-800"><table className="w-full text-left text-sm"><thead className="bg-slate-900 text-slate-300"><tr>{['Booking','Student','PT','Package','Ngày tạo','Số tiền','Trạng thái'].map(label => <th key={label} className="p-3">{label}</th>)}</tr></thead><tbody>{bookings.map(b => { let pkg = {}; try { pkg = JSON.parse(b.packageSnapshot || '{}') } catch {} return <tr key={b.id} className="border-t border-slate-800"><td className="max-w-48 truncate p-3" title={b.id}>{b.id}</td><td className="p-3">{b.student?.name || b.studentId}</td><td className="p-3">{b.pt?.name || b.ptId}</td><td className="p-3">{pkg.name || b.packageId}</td><td className="p-3">{b.createdAt ? new Date(b.createdAt).toLocaleDateString('vi-VN') : '—'}</td><td className="p-3">{Number(b.amount || 0).toLocaleString('vi-VN')} {b.currency}</td><td className="p-3">{b.status}</td></tr> })}</tbody></table></div>
    {loading && <p className="mt-3 text-slate-400">Đang tải...</p>}{!loading && bookings.length === 0 && <p className="p-5 text-slate-400">Không có booking khớp bộ lọc.</p>}
  </div></main></AdminLayout>
}
