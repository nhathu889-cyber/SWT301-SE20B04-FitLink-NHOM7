import React, { useEffect } from "react";
import { useForm } from "react-hook-form";
import { yupResolver } from "@hookform/resolvers/yup";
import * as yup from "yup";
import { login, loginWithGoogle } from "@/services/authService";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthProvider";
import { toast } from "react-toastify";
import { GoogleLogin } from "@react-oauth/google";

const normalizePhone = (phone) =>
  String(phone || "")
    .trim()
    .replace(/[\s.-]/g, "")
    .replace(/^(\+84|84)/, "0");

const rememberedPhoneKey = 'fitlink.rememberedPhone';
const rememberedLogin = () => {
  try {
    const phone = localStorage.getItem(rememberedPhoneKey) || '';
    return { phone: /^0\d{9}$/.test(phone) ? phone : '', password: '', rememberMe: /^0\d{9}$/.test(phone) };
  } catch { return { phone: '', password: '', rememberMe: false }; }
};

const loginErrorMessage = (error, fallback) => {
  if (error?.request && !error.response) {
    return "Không thể kết nối máy chủ. Vui lòng thử lại sau.";
  }
  return error?.response?.data?.message || fallback;
};

const schema = yup.object().shape({
  rememberMe: yup.boolean().default(false),
  phone: yup
    .string()
    .transform((value) => normalizePhone(value))
    .required("Số điện thoại là bắt buộc")
    .matches(/^0\d{9}$/, "Số điện thoại không đúng định dạng"),
  password: yup
    .string()
    .required("Mật khẩu là bắt buộc")
    .min(6, "Mật khẩu ít nhất 6 ký tự"),
});

export default function LoginPage() {
  const {
    register,
    handleSubmit,
    setValue,
    getValues,
    formState: { errors, isSubmitting },
  } = useForm({ resolver: yupResolver(schema), defaultValues: rememberedLogin() });

  const navigate = useNavigate();
  const { setUser, refreshUser } = useAuth();
  const supportsSavedPasswords = typeof window !== 'undefined' && 'PasswordCredential' in window && !!navigator.credentials;

  useEffect(() => {
    if (!supportsSavedPasswords || !getValues('rememberMe')) return;
    let active = true;
    const initialPhone = getValues('phone');
    navigator.credentials.get({ password: true, mediation: 'silent' }).then(credential => {
      if (active && getValues('rememberMe') && credential?.type === 'password' && normalizePhone(credential.id) === initialPhone && getValues('phone') === initialPhone && !getValues('password')) {
        setValue('password', credential.password);
      }
    }).catch(() => { /* Native autofill remains available when silent access is blocked. */ });
    return () => { active = false; };
  }, [supportsSavedPasswords, getValues, setValue]);

  const useSavedPassword = async () => {
    try {
      const credential = await navigator.credentials.get({ password: true, mediation: 'required' });
      if (credential?.type === 'password' && /^0\d{9}$/.test(normalizePhone(credential.id))) {
        setValue('phone', normalizePhone(credential.id), { shouldValidate: true });
        setValue('password', credential.password, { shouldValidate: true });
        setValue('rememberMe', true);
      } else if (credential) toast.info('Please choose a saved login that uses your phone number.');
      else toast.info('No saved login selected. Sign in once and save your password in the browser.');
    } catch { toast.info('Use the browser’s password manager to select your saved login.'); }
  };

  const onSubmit = async ({ phone, password, rememberMe }) => {
    try {
      await login(phone, password, rememberMe);
      if (rememberMe && supportsSavedPasswords) {
        try {
          await navigator.credentials.store(new window.PasswordCredential({ id: normalizePhone(phone), password }));
        } catch { /* Declining password storage must not prevent successful login. */ }
      }
      try {
        if (rememberMe) localStorage.setItem(rememberedPhoneKey, normalizePhone(phone));
        else localStorage.removeItem(rememberedPhoneKey);
      } catch { /* Browser storage restrictions must not prevent sign-in. */ }
      const profile = await refreshUser();
      setUser(profile);
      toast.success("Đăng nhập thành công!");
      switch (profile.role) {
        case "admin":
          navigate("/admin");
          break;
        case "pt":
          navigate("/pt");
          break;
        case "student":
          navigate("/home");
          break;
        default:
          break;
      }
    } catch (err) {
      toast.error(loginErrorMessage(err, "Đăng nhập thất bại"));
    }
  };

  const handleSuccess = async (credentialResponse) => {
    try {
      const idToken = credentialResponse.credential;
      await loginWithGoogle(idToken);
      const profile = await refreshUser();
      setUser(profile);
      toast.success("Đăng nhập Google thành công!");
      switch (profile.role) {
        case "admin":
          navigate("/admin");
          break;
        case "pt":
          navigate("/pt");
          break;
        case "student":
          navigate("/home");
          break;
        default:
          break;
      }
    } catch (err) {
      toast.error(loginErrorMessage(err, "Đăng nhập Google thất bại"));
    }
  };

  const handleError = () => toast.error("Không thể kết nối Google. Hãy kiểm tra cấu hình OAuth và thử lại.");

  return (
    <div className="min-h-screen bg-[#0e0e0e] text-white font-sans">
      {/* Header */}
      <header className="max-w-6xl mx-auto px-6 py-6 flex items-center justify-between">
        <Link
          to="/"
          className="text-2xl font-extrabold tracking-wide text-[#ff4d00]"
        >
          FITLINK
        </Link>
      </header>

      {/* Content */}
      <main className="max-w-6xl mx-auto px-6 pb-20">
        <div className="grid grid-cols-1 md:grid-cols-2 rounded-2xl overflow-hidden shadow-2xl border border-[#1a1a1a]">
          {/* Left image section */}
          <div className="relative hidden md:block bg-[#111]">
            <img
              src="/poster.jpg"
              alt="Gym"
              className="absolute inset-0 w-full h-full object-cover opacity-60"
            />
            <div className="relative h-full w-full flex flex-col justify-end p-10 bg-gradient-to-t from-black/70 to-transparent">
              <h1 className="text-4xl font-bold text-white leading-tight">
                Make Your <span className="text-[#ff4d00]">Body Shape</span>
              </h1>
              <p className="mt-3 text-gray-300 max-w-md">
                Join our fitness community and achieve your goals with
                professional trainers and custom programs.
              </p>
              <Link
                to="/register"
                className="mt-6 inline-flex items-center justify-center rounded-lg bg-[#ff4d00] px-6 py-3 font-semibold text-white hover:bg-[#ff661a] transition"
              >
                Join Now
              </Link>
            </div>
          </div>

          {/* Right form section */}
          <div className="bg-[#1a1a1a] p-8 md:p-12">
            <h2 className="text-3xl font-bold text-[#ff4d00]">Sign In</h2>
            <p className="mt-2 text-sm text-gray-400">
              Welcome back! Please enter your details below.
            </p>

            <form
              id="fitlink-login"
              autoComplete="on"
              className="mt-8 flex flex-col space-y-5"
              onSubmit={handleSubmit(onSubmit)}
            >
              <div>
                <label htmlFor="login-phone" className="block text-sm font-medium mb-2 text-gray-300">
                  Phone number
                </label>
                <input
                  id="login-phone"
                  type="tel"
                  inputMode="tel"
                  autoComplete="username"
                  placeholder="0xxxxxxxxx"
                  {...register("phone")}
                  className="w-full rounded-lg border border-[#333] bg-[#0e0e0e] px-4 py-3 text-white placeholder-gray-500 focus:ring-2 focus:ring-[#ff4d00] outline-none"
                />
                {errors.phone && (
                  <p className="mt-1 text-sm text-red-500">
                    {errors.phone.message}
                  </p>
                )}
              </div>

              <div>
                <label htmlFor="login-password" className="block text-sm font-medium mb-2 text-gray-300">
                  Password
                </label>
                <input
                  id="login-password"
                  type="password"
                  autoComplete="current-password"
                  placeholder="••••••"
                  {...register("password")}
                  className="w-full rounded-lg border border-[#333] bg-[#0e0e0e] px-4 py-3 text-white placeholder-gray-500 focus:ring-2 focus:ring-[#ff4d00] outline-none"
                />
                {errors.password && (
                  <p className="mt-1 text-sm text-red-500">
                    {errors.password.message}
                  </p>
                )}
              </div>

              <div className="flex items-center justify-between text-sm text-gray-400">
                <label className="inline-flex items-center gap-2">
                  <input
                    type="checkbox"
                    {...register("rememberMe", { onChange: event => {
                      if (!event.target.checked) {
                        try { localStorage.removeItem(rememberedPhoneKey); } catch { /* Storage may be disabled. */ }
                      }
                    } })}
                    className="rounded border-gray-500 bg-transparent"
                  />
                  Remember me
                </label>
                <Link
                  to="/forgot-password"
                  className="text-[#ff4d00] hover:underline"
                >
                  Forgot password?
                </Link>
              </div>

              <button
                type="submit"
                disabled={isSubmitting}
                className="rounded-lg bg-[#ff4d00] py-3 font-semibold text-white hover:bg-[#ff661a] transition disabled:opacity-60"
              >
                {isSubmitting ? "Signing in..." : "Sign in"}
              </button>

              {supportsSavedPasswords && <button type="button" disabled={isSubmitting} onClick={useSavedPassword} className="text-sm text-orange-400 hover:underline disabled:opacity-50">Use saved password</button>}

              {/* Divider */}
              <div className="flex items-center gap-4">
                <div className="h-px flex-1 bg-gray-700" />
                <span className="text-gray-400 text-xs uppercase">or</span>
                <div className="h-px flex-1 bg-gray-700" />
              </div>

              <GoogleLogin onSuccess={handleSuccess} onError={handleError} />

              <p className="text-center text-sm text-gray-400">
                Don’t have an account?{" "}
                <Link
                  to="/register"
                  className="text-[#ff4d00] hover:underline font-medium"
                >
                  Create one
                </Link>
              </p>
            </form>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-[#222]">
        <div className="max-w-6xl mx-auto px-6 py-8 text-sm text-gray-500 text-center">
          © {new Date().getFullYear()} Fitnase. All rights reserved.
        </div>
      </footer>
    </div>
  );
}
