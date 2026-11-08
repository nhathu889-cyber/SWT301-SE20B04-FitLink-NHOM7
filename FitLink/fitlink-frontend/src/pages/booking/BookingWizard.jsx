// src/pages/booking/BookingWizard.jsx
import React, { useEffect, useState } from "react";
import { useParams, useSearchParams, useNavigate } from "react-router-dom";
import { useBooking } from "@/contexts/BookingContext";
import { getPTDetailPublic } from "@/services/ptProfileService";
import { getPackagesByPTPublic } from "@/services/packageService";
import Stepper from "./Stepper";
import Step1SelectPackage from "./Step1SelectPackage";
import Step2Location from "./Step2Location";
import Step3Schedule from "./Step3Schedule";
import Step4StartDate from "./Step4StartDate";
import Step5Preview from "./Step5Preview";
import { useAuth } from "@/contexts/AuthProvider";

const STEPS = ["Chọn gói", "Địa điểm dạy", "Lịch cố định", "Ngày bắt đầu", "Preview & Xác nhận"];

export default function BookingWizard() {
  const { id: ptId } = useParams();
  const [sp] = useSearchParams();
  const navigate = useNavigate();
  const { set } = useBooking();
  const { user } = useAuth();

  const packageId = sp.get("packageId");
  const [pt, setPt] = useState(null);
  const [packages, setPackages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [step, setStep] = useState(packageId ? 1 : 0);

  useEffect(() => {
    (async () => {
      const [ptRes, pkRes] = await Promise.all([
        getPTDetailPublic(ptId),
        getPackagesByPTPublic(ptId),
      ]);

      const ptData = ptRes?.data?.data || ptRes?.data;
      const list = pkRes?.data?.data || pkRes?.data || [];

      setPt(ptData);
      setPackages(list);
      const selected = list.find((item) => item._id?.toLowerCase() === packageId?.toLowerCase());

      set({
        ptId,
        packageId: selected?._id || null,
        package: selected || null,
        packageSnapshot: selected ? { name: selected.name, price: selected.price, currency: 'VND', totalSessions: selected.totalSessions, sessionDurationMin: selected.sessionDurationMin } : {},
        pattern: [], slot: null, mode: null, distanceKm: null,
        travelPolicy: { freeRadiusKm: 5, maxTravelKm: 15, feePerKm: 10000, ...(ptData.travelPolicy || {}) },
      });
      if (packageId && !selected) setStep(0);

      setLoading(false);
    })();
  }, [ptId]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-neutral-950 text-neutral-400">
        Đang tải…
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-neutral-950 via-neutral-900 to-neutral-950 text-neutral-100">
      <div className="max-w-5xl mx-auto p-6 space-y-6">
        {/* Header */}
        <header className="flex items-center justify-between">
          <div className="space-y-1">
            <h1 className="text-2xl font-semibold tracking-tight text-white">Đặt lịch PT</h1>
            <p className="text-sm text-neutral-400">
              Hoàn tất 5 bước đơn giản để bắt đầu tập luyện.
            </p>
          </div>
          <button
            onClick={() => navigate(-1)}
            className="inline-flex items-center gap-2 rounded-xl border border-neutral-700 bg-neutral-800 px-3 py-2 text-sm text-neutral-300 hover:bg-red-600 hover:text-white transition"
          >
            ← Quay lại
          </button>
        </header>

        {/* Stepper */}
        <Stepper steps={STEPS} current={step} />

        {/* Main card */}
        <div className="rounded-2xl border border-neutral-800 bg-neutral-900/90 backdrop-blur-md p-5 md:p-6 shadow-[0_20px_60px_rgba(0,0,0,0.6)] ring-1 ring-black/20">
          {step === 0 && <Step1SelectPackage packages={packages} onNext={() => setStep(1)} />}
          {step === 1 && <Step2Location student={user} pt={pt} onBack={() => setStep(0)} onNext={() => setStep(2)} />}
          {step === 2 && <Step3Schedule pt={pt} onBack={() => setStep(1)} onNext={() => setStep(3)} />}
          {step === 3 && <Step4StartDate onBack={() => setStep(2)} onNext={() => setStep(4)} />}
          {step === 4 && (
            <Step5Preview
              student={user}
              onBack={() => setStep(3)}
            />
          )}
        </div>

      </div>
    </div>
  );
}
