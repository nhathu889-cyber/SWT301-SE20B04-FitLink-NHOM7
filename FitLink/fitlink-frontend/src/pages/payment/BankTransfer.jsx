import { useEffect, useState } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { getTransaction } from '@/services/paymentService';
import MainLayout from '@/layouts/MainLayout';
import { ArrowLeft, ArrowUpRight, Check, CheckCircle2, Clock3, Copy, Loader2, QrCode } from 'lucide-react';

function TransferField({ label, value, highlight = false }) {
  const [copied, setCopied] = useState(false);
  const [copyError, setCopyError] = useState(false);
  useEffect(() => {
    if (!copied) return;
    const timer = setTimeout(() => setCopied(false), 2000);
    return () => clearTimeout(timer);
  }, [copied]);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(String(value));
      setCopied(true);
      setCopyError(false);
    } catch { setCopyError(true); }
  };
  return <div className={`rounded-2xl border p-4 ${highlight ? 'border-orange-200 bg-orange-50/80' : 'border-slate-100 bg-slate-50/70'}`}>
    <p className="mb-1.5 text-xs font-semibold uppercase tracking-wider text-slate-500">{label}</p>
    <div className="flex items-start justify-between gap-3">
      <span className={`min-w-0 break-all font-semibold ${highlight ? 'text-orange-800' : 'text-slate-800'}`}>{value}</span>
      <button type="button" onClick={copy} aria-label={`Copy ${label.toLowerCase()}`} className="shrink-0 rounded-lg p-1.5 text-slate-500 transition hover:bg-white hover:text-orange-600 focus-visible:outline focus-visible:outline-2 focus-visible:outline-orange-500">
        {copied ? <Check size={17} className="text-green-600" /> : <Copy size={17} />}
      </button>
    </div>
    <span role="status" className="text-xs text-slate-500">{copied ? 'Copied to clipboard' : copyError ? 'Please select and copy the text manually.' : ''}</span>
  </div>;
}

export default function BankTransfer() {
  const { transactionId } = useParams();
  const navigate = useNavigate();
  const [payment, setPayment] = useState(null);
  const [error, setError] = useState('');
  const [qrFailed, setQrFailed] = useState(false);
  useEffect(() => { setPayment(null); setError(''); setQrFailed(false); }, [transactionId]);
  useEffect(() => {
    let active = true;
    const refresh = async () => {
      try {
        const result = await getTransaction(transactionId);
        if (active) {
          setPayment(result.data);
          setError('');
          if (result.data?.status === 'paid') navigate(result.data.destination || '/training-calendar', { replace: true });
        }
      } catch { if (active) setError('Unable to refresh your payment. Please check your connection or sign in again. We will retry automatically.'); }
    };
    refresh();
    const timer = setInterval(refresh, 5000);
    return () => { active = false; clearInterval(timer); };
  }, [transactionId, navigate]);
  const transfer = payment?.transfer;
  const paid = payment?.status === 'paid';
  const unavailable = ['cancelled', 'failed', 'refunded'].includes(payment?.status);
  const backTo = payment?.destination === '/gym-packages' ? '/gym-packages' : '/my-packages';
  return <MainLayout>
    <section className="mx-auto max-w-6xl px-4 py-8 text-slate-900 sm:px-6 sm:py-12">
      <Link to={backTo} className="mb-7 inline-flex items-center gap-2 text-sm font-medium text-slate-500 transition hover:text-orange-600"><ArrowLeft size={16} /> Back to packages</Link>
      <div className="mb-8 flex flex-col justify-between gap-5 sm:flex-row sm:items-end">
        <div>
          <p className="mb-3 text-xs font-bold uppercase tracking-[0.22em] text-orange-600">FitLink checkout</p>
          <h1 className="font-display text-3xl font-bold tracking-tight sm:text-4xl">{paid ? 'You’re ready to train.' : 'Complete your payment'}</h1>
          <p className="mt-3 max-w-xl text-sm leading-6 text-slate-500">{paid ? 'Your package has been activated. Enjoy your next workout.' : 'Scan the QR code with your banking app, or transfer using the details below.'}</p>
        </div>
        <span role="status" className={`inline-flex w-fit items-center gap-2 rounded-full border px-4 py-2 text-xs font-semibold ${paid ? 'border-green-200 bg-green-50 text-green-700' : unavailable ? 'border-slate-200 bg-slate-100 text-slate-600' : 'border-amber-200 bg-amber-50 text-amber-800'}`}>
          {paid ? <CheckCircle2 size={15} /> : <Clock3 size={15} />}{paid ? 'Payment confirmed' : unavailable ? 'Payment unavailable' : 'Awaiting confirmation'}
        </span>
      </div>
      {error && <div role="alert" className="mb-6 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">{error}</div>}
      {!payment && !error && <div role="status" className="flex min-h-72 items-center justify-center gap-3 rounded-3xl border border-white bg-white/70 text-slate-500"><Loader2 className="animate-spin" size={22} /> Loading payment details…</div>}
      {paid ? <div className="rounded-3xl border border-green-100 bg-white p-10 text-center shadow-sm">
        <CheckCircle2 size={44} className="mx-auto mb-5 text-green-600" />
        <h2 className="text-2xl font-bold">Payment successful</h2>
        <p className="mb-6 mt-3 text-slate-500">Your package is now active. Taking you there…</p>
        <Link to={payment.destination || '/training-calendar'} className="inline-flex items-center gap-2 rounded-xl bg-orange-600 px-5 py-3 font-semibold text-white">Open my package <ArrowUpRight size={18} /></Link>
      </div> : unavailable ? <div className="rounded-3xl border border-slate-200 bg-white p-10 text-center">
        <h2 className="text-xl font-bold">This payment is {payment.status}.</h2>
        <p className="mt-3 text-slate-500">Return to your packages to start a new checkout.</p>
        <Link to={backTo} className="mt-5 inline-block font-semibold text-orange-600">View packages →</Link>
      </div> : transfer ? <div className="grid gap-6 lg:grid-cols-[0.95fr_1.05fr]">
        <div className="relative overflow-hidden rounded-[28px] border border-orange-100 bg-white p-6 shadow-[0_20px_60px_rgba(120,72,25,0.07)] sm:p-8">
          <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-orange-400 via-amber-400 to-orange-600" />
          <div className="mb-6 flex items-center gap-3"><span className="rounded-xl bg-orange-50 p-2.5 text-orange-600"><QrCode size={23} /></span><div><h2 className="text-lg font-bold">Scan to pay</h2><p className="text-xs text-slate-500">Use any VietQR-supported banking app</p></div></div>
          <div className="mx-auto flex min-h-64 max-w-[300px] items-center justify-center overflow-hidden rounded-2xl border border-slate-100 bg-white p-3">
            {qrFailed ? <p role="status" className="p-6 text-center text-sm text-slate-500">The QR code could not load. You can still transfer using the bank details.</p> : <img src={transfer.qrUrl} alt={`VietQR bank transfer code for ${transfer.bank}`} className="h-auto w-full" onError={() => setQrFailed(true)} />}
          </div>
          <div className="mt-6 text-center"><p className="text-xs font-medium uppercase tracking-widest text-slate-400">Total amount</p><p className="mt-2 text-4xl font-bold tracking-tight text-slate-900">{Number(transfer.amount).toLocaleString('en-US')} <span className="text-base font-medium text-slate-400">VND</span></p></div>
          <p className="mt-5 text-center text-xs leading-5 text-slate-500">The QR code includes your amount and payment reference.</p>
        </div>
        <div className="flex flex-col rounded-[28px] border border-white bg-white/85 p-6 shadow-[0_20px_60px_rgba(120,72,25,0.05)] sm:p-8">
          <div className="mb-6"><h2 className="text-lg font-bold">Bank transfer details</h2><p className="mt-1 text-sm text-slate-500">Prefer a manual transfer? Use these exact details.</p></div>
          <div className="mb-5 flex items-center gap-3"><span className="flex h-11 w-11 items-center justify-center rounded-xl bg-slate-900 text-sm font-bold text-white">{transfer.bank}</span><div><p className="font-semibold text-slate-800">{transfer.bank} Bank</p><p className="text-xs text-slate-500">Domestic transfer · VND</p></div></div>
          <div className="space-y-3">
            <TransferField label="Account number" value={transfer.accountNumber} />
            <TransferField label="Account holder" value={transfer.accountName} />
            <TransferField label="Payment reference" value={transfer.reference} highlight />
          </div>
          <p className="mt-3 text-xs leading-5 text-orange-700">Include the full payment reference so we can match your transfer.</p>
          <div className="mt-6 flex items-start gap-3 rounded-2xl border border-amber-100 bg-amber-50/70 p-4">
            <Clock3 size={19} className="mt-0.5 shrink-0 text-amber-600" /><div><p className="text-sm font-semibold text-slate-800">Waiting for payment confirmation</p><p className="mt-1 text-xs leading-5 text-slate-500">After your transfer is confirmed, your package will open automatically. This page checks for updates every 5 seconds.</p></div>
          </div>
        </div>
      </div> : payment && <div className="rounded-3xl border bg-white p-8 text-slate-600">Bank transfer details are unavailable. <Link to={backTo} className="font-semibold text-orange-600">Return to packages</Link></div>}
      <p className="mt-7 text-center text-xs leading-5 text-slate-500">Need a hand? <Link to="/contact" className="font-semibold text-orange-700 hover:underline">Contact FitLink support</Link></p>
    </section>
  </MainLayout>;
}
