import { useEffect, useState } from 'react'
import axios from '@/api/axiosClient'
import MainLayout from '@/layouts/MainLayout'
import { payTransaction } from '@/services/paymentService'
import { toast } from 'react-toastify'
import { ArrowUpRight, CalendarDays, Check, Dumbbell } from 'lucide-react'

const emptyForm = { name: '', description: '', price: '', durationDays: 1, totalSessions: 1, gymName: '', gymAddress: '', isActive: true }
const idOf = item => item.id || item._id

export default function GymPackagesPage({ admin = false }) {
  const [packages, setPackages] = useState([])
  const [enrollments, setEnrollments] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [editing, setEditing] = useState(null)
  const [form, setForm] = useState(emptyForm)
  const [selectedPackage, setSelectedPackage] = useState(null)
  const [ticket, setTicket] = useState('')
  const [ticketResult, setTicketResult] = useState('')

  useEffect(() => {
    if (!selectedPackage) return
    const closeOnEscape = event => {
      if (event.key === 'Escape' && !busy) setSelectedPackage(null)
    }
    window.addEventListener('keydown', closeOnEscape)
    return () => window.removeEventListener('keydown', closeOnEscape)
  }, [selectedPackage, busy])

  async function load() {
    setLoading(true)
    setError('')
    try {
      const { data } = await axios.get('/gym-packages')
      setPackages([...data.data].sort((a, b) => Number(a.price) - Number(b.price)))
      setEnrollments(data.enrollments || [])
    } catch { setError('Unable to load gym packages. Please try again.') }
    finally { setLoading(false) }
  }
  useEffect(() => { load() }, [])

  async function useVisit(event) {
    event.preventDefault()
    setBusy(true)
    setTicketResult('')
    try {
      await axios.post(`/gym-packages/tickets/${ticket.trim()}/use`)
      setTicketResult('One gym visit recorded.')
      await load()
    } catch { /* The API client displays the error. */ }
    finally { setBusy(false) }
  }
  async function save(event) {
    event.preventDefault()
    setBusy(true)
    try {
      if (editing) await axios.put(`/gym-packages/${editing}`, form)
      else await axios.post('/gym-packages', form)
      setForm(emptyForm)
      setEditing(null)
      toast.success('Gym package saved')
      await load()
    } catch { /* The API client displays the error. */ }
    finally { setBusy(false) }
  }
  async function buy(pkg) {
    setBusy(true)
    try {
      const { data } = await axios.post(`/gym-packages/${idOf(pkg)}/checkout`)
      const payment = await payTransaction(data.data.transactionId)
      window.location.assign(payment.data.checkoutUrl)
    } catch { /* The API client displays the error. */ }
    finally { setBusy(false) }
  }

  const inputClass = 'w-full rounded-lg border border-slate-300 bg-white p-3 text-slate-900'
  const buttonClass = 'rounded-lg bg-orange-600 px-4 py-2 font-semibold text-white hover:bg-orange-700 disabled:opacity-50'
  const content = <div className="mx-auto max-w-7xl px-5 pb-8 pt-12 text-slate-900 md:pt-16">
    <div className="mb-9 flex items-end justify-between gap-6">
      <div><p className="mb-3 text-xs font-bold uppercase tracking-[0.25em] text-orange-600">Your gym. Your pace.</p>
      <h1 className="font-display text-4xl font-bold tracking-tight sm:text-5xl">{admin ? 'Manage gym packages' : <>Show up. <span className="text-orange-600">Get stronger.</span></>}</h1>
      <p className="mt-3 text-sm text-slate-500">Choose a package and train your way.</p></div>
      <div className="hidden rotate-[-12deg] rounded-3xl border border-white bg-white/60 p-5 text-orange-500 shadow-sm sm:block"><Dumbbell size={42} strokeWidth={1.5} /></div>
    </div>
    {admin && <form onSubmit={useVisit} className="mb-8 rounded-2xl border bg-white p-6">
      <label className="block font-semibold">Record a gym visit<input required pattern="[0-9a-fA-F-]{36}" placeholder="Enter the member's pass ID" className={inputClass} value={ticket} onChange={e => setTicket(e.target.value)} /></label>
      <button disabled={busy} className={`${buttonClass} mt-3`}>Confirm one visit</button>
      {ticketResult && <p role="status" className="mt-3 text-green-700">{ticketResult}</p>}
    </form>}
    {admin && <form onSubmit={save} className="mb-10 space-y-4 rounded-2xl border bg-white p-6 shadow-sm">
      <h2 className="text-xl font-bold">{editing ? 'Edit package' : 'Create gym package'}</h2>
      <label className="block">Package name<input required maxLength={80} className={inputClass} value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} /></label>
      <label className="block">Public description<textarea maxLength={1000} className={inputClass} value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} /></label>
      <div className="grid gap-4 sm:grid-cols-3">
        {[['price', 'Price (VND)'], ['durationDays', 'Validity (days)'], ['totalSessions', 'Number of visits']].map(([key, label]) => <label key={key}>{label}<input required type="number" min="1" step="1" max={key === 'price' ? undefined : 3650} className={inputClass} value={form[key]} onChange={e => setForm({ ...form, [key]: e.target.value })} /></label>)}
      </div>
      <label className="block">Gym name<input required maxLength={120} className={inputClass} value={form.gymName || ''} onChange={e => setForm({ ...form, gymName: e.target.value })} /></label>
      <label className="block">Gym address<input required maxLength={500} className={inputClass} value={form.gymAddress || ''} onChange={e => setForm({ ...form, gymAddress: e.target.value })} /></label>
      <label className="flex items-center gap-2"><input type="checkbox" checked={form.isActive} onChange={e => setForm({ ...form, isActive: e.target.checked })} /> Available for purchase</label>
      <div className="flex gap-3"><button disabled={busy} className={buttonClass}>Save package</button>{editing && <button type="button" onClick={() => { setEditing(null); setForm(emptyForm) }}>Cancel editing</button>}</div>
    </form>}
    {loading ? <p>Loading gym packages…</p> : error ? <div role="alert">{error} <button onClick={load} className="underline">Try again</button></div> : packages.length === 0 ? <p>No gym packages are currently available.</p> : <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-4">
      {packages.map(pkg => {
        const owned = enrollments.find(item => String(item.packageId).toLowerCase() === String(idOf(pkg)).toLowerCase() && item.status === 'active' && Number(item.remainingSessions) > 0 && new Date(item.endDate) > new Date())
        const featured = Number(pkg.totalSessions) === 10
        return <article key={idOf(pkg)} className={`relative flex flex-col overflow-hidden rounded-[26px] border p-6 transition duration-200 hover:-translate-y-1 ${featured ? 'border-orange-400 bg-slate-900 text-white shadow-[0_16px_40px_rgba(15,23,42,0.16)]' : 'border-white bg-white/90 shadow-[0_12px_35px_rgba(120,72,25,0.05)] hover:shadow-lg'}`}>
          <div className="mb-6 flex items-center justify-between gap-2">
            <span className={`rounded-xl p-2.5 ${featured ? 'bg-white/10 text-orange-400' : 'bg-orange-50 text-orange-600'}`}><Dumbbell size={21} /></span>
          <span className={`rounded-full px-3 py-1 text-[10px] font-bold uppercase tracking-widest ${featured ? 'bg-orange-500 text-white' : 'bg-slate-100 text-slate-500'}`}>{!pkg.isActive ? 'Unavailable' : featured ? 'Flex plan' : Number(pkg.totalSessions) === 1 ? '1-visit package' : 'Multi-visit package'}</span>
          </div>
          <h2 className={`mb-3 text-sm font-semibold ${featured ? 'text-slate-300' : 'text-slate-500'}`}>{pkg.name}</h2>
          <p className="flex items-baseline gap-2"><span className="font-display text-6xl font-bold tracking-tighter" style={{ color: 'inherit' }}>{pkg.totalSessions}</span><span className={`text-sm ${featured ? 'text-slate-400' : 'text-slate-500'}`}>{Number(pkg.totalSessions) === 1 ? 'visit' : 'visits'}</span></p>
          <p className={`mt-4 flex items-center gap-2 text-xs ${featured ? 'text-slate-300' : 'text-slate-500'}`}><CalendarDays size={14} /> Valid for {pkg.durationDays} {Number(pkg.durationDays) === 1 ? 'day' : 'days'}</p>
          <div className={`my-6 border-t pt-5 ${featured ? 'border-white/10' : 'border-slate-100'}`}>
            <p className="text-3xl font-bold tracking-tight">{Number(pkg.price).toLocaleString('en-US')} <span className={`text-xs font-medium ${featured ? 'text-slate-400' : 'text-slate-400'}`}>VND</span></p>
            <p className={`mt-1 text-xs ${featured ? 'text-slate-400' : 'text-slate-400'}`}>{Math.round(Number(pkg.price) / Math.max(1, Number(pkg.totalSessions))).toLocaleString('en-US')} VND / visit</p>
          </div>
          {owned && <details className="mb-4 rounded-xl bg-green-50 p-3 text-xs text-green-800"><summary className="cursor-pointer font-semibold">{owned.remainingSessions} visits left · View pass</summary><p className="mt-2">Expires {new Date(owned.endDate).toLocaleDateString('en-GB')}</p><p className="mt-2 break-all">Pass ID: <strong>{idOf(owned)}</strong></p></details>}
          <div className="mt-auto">
            {admin ? <button disabled={busy} className={`${buttonClass} w-full`} onClick={() => { setEditing(idOf(pkg)); setForm({ ...emptyForm, ...pkg }) }}>Edit</button> : owned ? <span className="flex items-center justify-center gap-2 rounded-xl bg-green-50 p-3 text-sm font-semibold text-green-700"><Check size={17} /> Package registered</span> : <button disabled={busy || !pkg.isActive || pkg.visibility !== 'public'} className="flex w-full items-center justify-between rounded-xl bg-orange-600 px-4 py-3 text-sm font-semibold text-white transition hover:bg-orange-500 disabled:opacity-50" onClick={() => setSelectedPackage(pkg)}>{pkg.isActive && pkg.visibility === 'public' ? 'Register package' : 'Unavailable'}<ArrowUpRight size={17} /></button>}
            <details className={`mt-4 text-xs ${featured ? 'text-slate-400' : 'text-slate-500'}`}><summary className="cursor-pointer text-center">Gym details</summary><div className="mt-3 space-y-2 leading-5"><p className="font-semibold">{pkg.gymName || 'Gym details pending'}</p><p>{pkg.gymAddress}</p><p>{pkg.description}</p></div></details>
          </div>
        </article>
      })}
    </div>}
    {selectedPackage && <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 p-4" onMouseDown={event => { if (event.target === event.currentTarget && !busy) setSelectedPackage(null) }}>
      <section role="dialog" aria-modal="true" aria-labelledby="gym-package-detail-title" className="w-full max-w-xl overflow-hidden rounded-2xl bg-white shadow-2xl">
        <div className="flex items-start justify-between gap-4 border-b border-slate-100 px-6 py-5">
          <div><p className="text-xs font-bold uppercase tracking-widest text-orange-600">Package details</p><h2 id="gym-package-detail-title" className="mt-1 text-2xl font-bold text-slate-900">{selectedPackage.name}</h2></div>
          <button type="button" aria-label="Close package details" disabled={busy} onClick={() => setSelectedPackage(null)} className="rounded-lg px-2 py-1 text-2xl leading-none text-slate-400 hover:bg-slate-100 disabled:opacity-50">×</button>
        </div>
        <div className="max-h-[65vh] space-y-5 overflow-y-auto px-6 py-5 text-slate-700">
          <p className="whitespace-pre-line text-sm leading-6">{selectedPackage.description || 'No package description provided.'}</p>
          <div className="grid grid-cols-2 gap-3 rounded-xl bg-slate-50 p-4 text-sm">
            <div><p className="text-xs text-slate-500">Visits included</p><p className="mt-1 font-semibold">{selectedPackage.totalSessions} {Number(selectedPackage.totalSessions) === 1 ? 'visit' : 'visits'}</p></div>
            <div><p className="text-xs text-slate-500">Validity</p><p className="mt-1 font-semibold">{selectedPackage.durationDays} {Number(selectedPackage.durationDays) === 1 ? 'day' : 'days'}</p></div>
            <div><p className="text-xs text-slate-500">Gym</p><p className="mt-1 font-semibold">{selectedPackage.gymName || 'Gym details pending'}</p></div>
            <div><p className="text-xs text-slate-500">Address</p><p className="mt-1 font-semibold">{selectedPackage.gymAddress || 'Not provided'}</p></div>
          </div>
          <div className="flex items-end justify-between gap-4 border-t border-slate-100 pt-4">
            <div><p className="text-xs text-slate-500">Total price</p><p className="mt-1 text-2xl font-bold text-slate-900">{Number(selectedPackage.price).toLocaleString('en-US')} VND</p></div>
            <p className="text-right text-xs text-slate-500">{Math.round(Number(selectedPackage.price) / Math.max(1, Number(selectedPackage.totalSessions))).toLocaleString('en-US')} VND / visit</p>
          </div>
        </div>
        <div className="flex flex-col-reverse gap-3 border-t border-slate-100 px-6 py-4 sm:flex-row sm:justify-end">
          <button type="button" disabled={busy} onClick={() => setSelectedPackage(null)} className="rounded-lg border border-slate-300 px-5 py-3 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50">Back to packages</button>
          <button type="button" disabled={busy} onClick={() => buy(selectedPackage)} className="rounded-lg bg-orange-600 px-5 py-3 text-sm font-semibold text-white hover:bg-orange-700 disabled:opacity-50">{busy ? 'Preparing payment…' : 'Continue to payment'}</button>
        </div>
      </section>
    </div>}
  </div>
  return admin ? content : <MainLayout>{content}</MainLayout>
}
