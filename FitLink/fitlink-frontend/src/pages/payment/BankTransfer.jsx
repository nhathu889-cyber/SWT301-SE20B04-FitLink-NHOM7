import { useEffect, useState } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { getTransaction } from '@/services/paymentService';

export default function BankTransfer() {
  const { transactionId } = useParams();
  const navigate = useNavigate();
  const [payment, setPayment] = useState(null);
  const [error, setError] = useState('');
  useEffect(() => {
    let active = true;
    const refresh = async () => {
      try {
        const result = await getTransaction(transactionId);
        if (active) {
          setPayment(result.data);
          setError('');
          if (result.data?.status === 'paid') navigate('/training-calendar', { replace: true });
        }
      } catch { if (active) setError('Không tải được giao dịch. Vui lòng đăng nhập lại hoặc thử lại.'); }
    };
    refresh();
    const timer = setInterval(refresh, 5000);
    return () => { active = false; clearInterval(timer); };
  }, [transactionId, navigate]);
  const transfer = payment?.transfer;
  return <main className="min-h-screen bg-neutral-950 text-white p-8 flex flex-col items-center gap-4">
    <h1 className="text-2xl font-bold">Chuyển khoản đặt gói tập</h1>
    {error && <p role="alert">{error}</p>}
    {!payment && !error && <p>Đang tải…</p>}
    {payment?.status === 'paid' ? <>
      <p>Admin đã xác nhận thanh toán. Gói và lịch tập đã được kích hoạt.</p>
      <Link to="/training-calendar" className="bg-orange-500 rounded px-4 py-2">Xem lịch tập</Link>
    </> : transfer && <>
      <img src={transfer.qrUrl} alt="QR chuyển khoản MB" className="w-80 rounded bg-white" />
      <p>{transfer.bank} · {transfer.accountNumber}</p>
      <p>{transfer.accountName}</p>
      <p className="text-xl font-bold">{transfer.amount.toLocaleString('vi-VN')} đ</p>
      <p>Nội dung: <strong>{transfer.reference}</strong></p>
      <p>Đang chờ admin xác nhận đã nhận tiền. Sau xác nhận, bạn sẽ tự chuyển sang lịch tập trong khoảng 5 giây.</p>
    </>}
    <Link to="/home">Về trang chủ</Link>
  </main>;
}
