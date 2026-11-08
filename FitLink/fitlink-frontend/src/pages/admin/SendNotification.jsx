import { useEffect, useRef, useState } from 'react'
import { Bell, Send, Users } from 'lucide-react'
import axios from '@/api/axiosClient'

const audienceLabels = { individual: 'One person', students: 'All students', pts: 'All trainers', all: 'All students & trainers' }

export default function SendNotification() {
  const [audience, setAudience] = useState('individual')
  const [query, setQuery] = useState('')
  const [recipients, setRecipients] = useState([])
  const [total, setTotal] = useState(0)
  const [userId, setUserId] = useState('')
  const [title, setTitle] = useState('')
  const [message, setMessage] = useState('')
  const [loading, setLoading] = useState(false)
  const [sending, setSending] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [retry, setRetry] = useState(0)
  const submitting = useRef(false)

  useEffect(() => {
    let active = true
    const controller = new AbortController()
    setLoading(true)
    setError('')
    const timer = setTimeout(async () => {
      try {
        const { data } = await axios.get('/admin/notifications/recipients', { params: { audience, q: query }, signal: controller.signal, skipErrorToast: true })
        if (active) { setRecipients(data.items); setTotal(data.total) }
      } catch (err) {
        if (active && err.code !== 'ERR_CANCELED') { setRecipients([]); setTotal(0); setError(err.response?.data?.message || 'Unable to load recipients. Please try again.') }
      } finally { if (active) setLoading(false) }
    }, 250)
    return () => { active = false; clearTimeout(timer); controller.abort() }
  }, [audience, query, retry])

  const selected = recipients.find(item => item.id === userId)
  const recipientCount = audience === 'individual' ? (selected ? 1 : 0) : total
  const send = async event => {
    event.preventDefault()
    if (submitting.current || loading || !recipientCount) return
    const target = audience === 'individual' ? selected.name || selected.phone : `${recipientCount} people (${audienceLabels[audience]})`
    if (!window.confirm(`Send “${title.trim()}” to ${target}?`)) return
    submitting.current = true
    setSending(true)
    setError('')
    setSuccess('')
    try {
      const { data } = await axios.post('/admin/notifications', { audience, ...(audience === 'individual' ? { userId } : {}), title, message }, { skipErrorToast: true })
      setSuccess(`Sent to ${data.sentCount} ${data.sentCount === 1 ? 'person' : 'people'}.`)
      setTitle('')
      setMessage('')
    } catch (err) { setError(err.response?.data?.message || 'Unable to send. Check your connection before retrying.') }
    finally { submitting.current = false; setSending(false) }
  }
  const inputClass = 'mt-2 w-full rounded-xl border border-slate-600 bg-slate-800 p-3 text-sm text-slate-100 placeholder:text-slate-500'
  return <div className="mx-auto max-w-5xl text-slate-200">
    <h1 className="text-3xl font-bold text-orange-400">Send Notification</h1>
    <p className="mb-8 mt-3 text-sm text-slate-400">Send an announcement to a person or a group.</p>
    {error && <div role="alert" className="mb-5 rounded-xl border border-red-800 bg-red-950/40 p-4 text-sm text-red-200">{error} <button type="button" className="underline" onClick={() => setRetry(value => value + 1)}>Reload recipients</button></div>}
    {success && <p role="status" className="mb-5 rounded-xl border border-green-800 bg-green-950/40 p-4 text-green-200">{success}</p>}
    <div className="grid gap-6 lg:grid-cols-[1.4fr_1fr]">
      <form onSubmit={send} className="space-y-5 rounded-2xl border border-slate-700 bg-slate-900 p-6">
        <fieldset disabled={sending} className="space-y-5 disabled:opacity-70">
          <label className="block text-sm font-semibold">Recipients<select className={inputClass} value={audience} onChange={event => { setAudience(event.target.value); setUserId(''); setQuery(''); setSuccess('') }}>{Object.entries(audienceLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
          {audience === 'individual' && <div>
            <label className="block text-sm font-semibold">Search users<input className={inputClass} maxLength={100} placeholder="Name, phone or email" value={query} onChange={event => { setQuery(event.target.value); setUserId('') }} /></label>
            <label className="mt-3 block text-sm font-semibold">Choose a recipient<select required className={inputClass} disabled={loading} value={userId} onChange={event => setUserId(event.target.value)}><option value="">{loading ? 'Loading…' : 'Select a person'}</option>{recipients.map(user => <option key={user.id} value={user.id}>{user.name || 'Unnamed user'} · {user.phone || user.id} · {user.role === 'pt' ? 'Trainer' : 'Student'}</option>)}</select></label>
            {!loading && total > 50 && <p className="mt-2 text-xs text-slate-400">Showing 50 results. Search to narrow the list.</p>}
          </div>}
          <p className="flex items-center gap-2 text-xs text-slate-400"><Users size={15} />{loading ? 'Loading recipients…' : `${recipientCount} selected · Active accounts only`}</p>
          <label className="block text-sm font-semibold">Title<input required maxLength={255} className={inputClass} placeholder="Your announcement title" value={title} onChange={event => setTitle(event.target.value)} /></label>
          <label className="block text-sm font-semibold">Message<textarea required maxLength={2000} rows={6} className={inputClass} placeholder="Write your message…" value={message} onChange={event => setMessage(event.target.value)} /><span className="mt-1 block text-right text-xs font-normal text-slate-500">{message.length}/2,000</span></label>
          <button disabled={loading || !recipientCount || !title.trim() || !message.trim()} className="flex w-full items-center justify-center gap-2 rounded-xl bg-orange-600 px-5 py-3 font-semibold text-white hover:bg-orange-500 disabled:opacity-40"><Send size={17} />{sending ? 'Sending…' : 'Send notification'}</button>
        </fieldset>
      </form>
      <aside className="h-fit rounded-2xl border border-slate-700 bg-slate-800/50 p-6">
        <p className="mb-5 text-xs font-semibold uppercase tracking-widest text-slate-400">Preview</p>
        <div className="flex gap-3 rounded-xl border border-slate-700 bg-slate-900 p-4"><Bell size={20} className="mt-1 shrink-0 text-orange-400" /><div className="min-w-0"><p className="text-xs text-orange-400">FitLink Admin</p><h2 className="mt-2 break-words text-base font-semibold text-slate-100">{title.trim() || 'Announcement title'}</h2><p className="mt-2 whitespace-pre-wrap break-words text-sm leading-6 text-slate-300">{message.trim() || 'Your message will appear here.'}</p></div></div>
        <p className="mt-4 text-xs leading-5 text-slate-400">Delivered to the notification bell and saved in the recipient’s inbox.</p>
      </aside>
    </div>
  </div>
}
