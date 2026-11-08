import { useEffect, useState } from "react";
import axios from "@/api/axiosClient";

const emptyMonths = Array(12).fill(0);
const monthLabels = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

export default function StudentProgressPanel() {
  const [data, setData] = useState({ stats: null, bmi: [], months: emptyMonths, upcoming: [] });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    const year = new Date().getFullYear();
    Promise.all([
      axios.get("/student-stats/dashboard"),
      axios.get("/student/bmi/history"),
      axios.get("/student-stats/sessions-completed", { params: { year } }),
      axios.get("/student-stats/history", { params: { full: 1 } }),
    ]).then(([statsResponse, bmiResponse, sessionsResponse, historyResponse]) => {
      if (!active) return;
      const now = Date.now();
      const upcoming = (historyResponse.data?.sessions || [])
        .filter(session => session.status === "scheduled" && new Date(session.startTime).getTime() >= now)
        .sort((a, b) => new Date(a.startTime) - new Date(b.startTime))
        .slice(0, 3);
      setData({
        stats: statsResponse.data,
        bmi: Array.isArray(bmiResponse.data) ? [...bmiResponse.data].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)) : [],
        months: Array.isArray(sessionsResponse.data?.completed) ? sessionsResponse.data.completed : emptyMonths,
        upcoming,
      });
      setError("");
    }).catch(() => {
      if (active) setError("Không thể tải dữ liệu tiến độ. Vui lòng thử lại sau.");
    }).finally(() => {
      if (active) setLoading(false);
    });
    return () => { active = false; };
  }, []);

  if (loading) return <div className="py-12 text-center text-gray-500">Đang tải tiến độ tập luyện…</div>;
  if (error) return <div role="alert" className="rounded-lg bg-red-50 p-4 text-sm text-red-700">{error}</div>;

  const stats = data.stats || {};
  const maxMonth = Math.max(...data.months, 1);

  return <div className="space-y-6">
    <section>
      <h2 className="mb-4 text-xl font-bold text-gray-800">Tổng quan tập luyện</h2>
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {[
          ["Buổi đã hoàn thành", stats.completed || 0],
          ["Buổi còn lại trong gói", stats.remaining || 0],
          ["Buổi đã hủy", stats.cancelled || 0],
          ["Tổng chi tiêu", `${Number(stats.totalPaid || 0).toLocaleString("vi-VN")} đ`],
        ].map(([label, value]) => <div key={label} className="rounded-xl border border-orange-100 bg-orange-50/60 p-4">
          <p className="text-sm text-gray-500">{label}</p><p className="mt-1 text-2xl font-bold text-gray-900">{value}</p>
        </div>)}
      </div>
    </section>

    <section className="rounded-xl border border-gray-200 p-4 sm:p-5">
      <div className="mb-4 flex items-baseline justify-between gap-3">
        <h2 className="text-lg font-bold text-gray-800">Buổi tập hoàn thành theo tháng</h2>
        <span className="text-sm text-gray-500">{new Date().getFullYear()}</span>
      </div>
      <div className="grid h-36 grid-cols-12 items-end gap-2" role="img" aria-label="Biểu đồ số buổi tập hoàn thành theo tháng">
        {data.months.map((count, index) => <div key={index} className="flex h-full flex-col items-center justify-end gap-1">
          <span className="text-[10px] text-gray-500">{count || ""}</span>
          <div className="w-full rounded-t bg-orange-500" style={{ height: `${Math.max(5, (Number(count) / maxMonth) * 100)}%` }} title={`${count} buổi`} />
          <span className="text-[9px] text-gray-500 sm:text-[10px]">{monthLabels[index]}</span>
        </div>)}
      </div>
    </section>

    <div className="grid gap-6 lg:grid-cols-2">
      <section className="rounded-xl border border-gray-200 p-4 sm:p-5">
        <h2 className="mb-3 text-lg font-bold text-gray-800">Lịch tập sắp tới</h2>
        {data.upcoming.length ? <ul className="space-y-3">{data.upcoming.map(session => <li key={session.id} className="rounded-lg bg-gray-50 p-3">
          <p className="font-semibold text-gray-800">{session.title || "Buổi tập với PT"}</p>
          <p className="mt-1 text-sm text-gray-500">{new Date(session.startTime).toLocaleString("vi-VN", { dateStyle: "medium", timeStyle: "short" })}</p>
          {session.pt?.name && <p className="mt-1 text-xs text-gray-500">PT: {session.pt.name}</p>}
        </li>)}</ul> : <p className="text-sm text-gray-500">Chưa có buổi tập nào được lên lịch.</p>}
      </section>

      <section className="rounded-xl border border-gray-200 p-4 sm:p-5">
        <h2 className="mb-3 text-lg font-bold text-gray-800">Lịch sử BMI</h2>
        {data.bmi.length ? <div className="space-y-2">{data.bmi.slice(0, 5).map((entry, index) => <div key={`${entry.session || entry.createdAt}-${index}`} className="flex items-center justify-between gap-3 border-b border-gray-100 pb-2 text-sm last:border-0">
          <div><p className="font-semibold text-gray-800">BMI {Number(entry.bmi).toFixed(1)}</p><p className="text-xs text-gray-500">{new Date(entry.createdAt).toLocaleDateString("vi-VN")} · {entry.weightKg} kg</p></div>
          {entry.note && <p className="max-w-[55%] truncate text-xs text-gray-500" title={entry.note}>{entry.note}</p>}
        </div>)}</div> : <p className="text-sm text-gray-500">Chưa có dữ liệu BMI. Ghi lại chỉ số sau buổi tập để theo dõi thay đổi.</p>}
      </section>
    </div>
  </div>;
}
