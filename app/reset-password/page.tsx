"use client";

import { useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { Lock, Eye, EyeOff, CheckCircle } from "lucide-react";
import { createClient } from "@/supabase/client";

export default function ResetPassword() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [form, setForm] = useState({ password: "", confirm: "" });
  const [errors, setErrors] = useState({ password: "", confirm: "" });

  const validate = () => {
    const newErrors: { password: string; confirm: string } = { password: "", confirm: "" };
    if (form.password.length < 6) newErrors.password = "Heslo musí mať aspoň 6 znakov.";
    if (form.password !== form.confirm) newErrors.confirm = "Heslá sa nezhodujú.";
    setErrors(newErrors);
    return !newErrors.password && !newErrors.confirm;
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setForm({ ...form, [e.target.name]: e.target.value });
    setErrors({ ...errors, [e.target.name]: "" });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate() || loading) return;

    setLoading(true);

    try {
      const supabase = createClient();
      const { error } = await supabase.auth.updateUser({ password: form.password });

      if (error) {
        setErrors({ password: "", confirm: error.message });
        return;
      }

      setDone(true);
      setTimeout(() => router.push("/app"), 2500);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen grid md:grid-cols-2 bg-white">

      {/* LEFT SIDE – FORM */}
      <div className="flex items-center justify-center p-6 sm:p-10">
        <div className="w-full max-w-md">

          {done ? (
            <div className="text-center">
              <div className="flex justify-center mb-4">
                <CheckCircle className="w-16 h-16 text-[#7361FF]" />
              </div>
              <h2
                className="text-3xl font-semibold text-gray-900 mb-3 tracking-tight"
                style={{ fontFamily: "'Momo Trust Display', sans-serif" }}
              >
                Heslo zmenené!
              </h2>
              <p className="text-gray-500 nunito">
                Tvoje heslo bolo úspešne zmenené. Presmerúvam ťa...
              </p>
            </div>
          ) : (
            <>
              <h2
                className="text-4xl font-semibold text-gray-900 mb-2 tracking-tight"
                style={{ fontFamily: "'Momo Trust Display', sans-serif" }}
              >
                Nové heslo
              </h2>
              <p className="text-gray-500 nunito mb-8">
                Zadaj svoje nové heslo pre účet KódujĽahko.
              </p>

              <form onSubmit={handleSubmit} className="space-y-6">

                {/* NEW PASSWORD */}
                <div>
                  <div className="relative mt-1">
                    <Lock className="absolute left-4 top-4 text-gray-400 w-4 h-4" />
                    <input
                      type={showPassword ? "text" : "password"}
                      name="password"
                      value={form.password}
                      onChange={handleChange}
                      className="
                        w-full pl-12 pr-12 py-3 rounded-xl
                        bg-gray-100 border border-gray-300
                        focus:border-[#7361FF] focus:ring-2 focus:ring-[#7361FF]/40
                        outline-none transition-all
                        text-gray-700 nunito
                      "
                      placeholder="Nové heslo"
                    />
                    {showPassword ? (
                      <EyeOff
                        onClick={() => setShowPassword(false)}
                        className="absolute right-4 top-4 text-gray-500 w-4 h-4 cursor-pointer hover:text-[#7361FF] transition"
                      />
                    ) : (
                      <Eye
                        onClick={() => setShowPassword(true)}
                        className="absolute right-4 top-4 text-gray-500 w-4 h-4 cursor-pointer hover:text-[#7361FF] transition"
                      />
                    )}
                  </div>
                  {errors.password && (
                    <p className="text-red-500 text-sm mt-1">{errors.password}</p>
                  )}
                </div>

                {/* CONFIRM PASSWORD */}
                <div>
                  <div className="relative mt-1">
                    <Lock className="absolute left-4 top-4 text-gray-400 w-4 h-4" />
                    <input
                      type={showConfirm ? "text" : "password"}
                      name="confirm"
                      value={form.confirm}
                      onChange={handleChange}
                      className="
                        w-full pl-12 pr-12 py-3 rounded-xl
                        bg-gray-100 border border-gray-300
                        focus:border-[#7361FF] focus:ring-2 focus:ring-[#7361FF]/40
                        outline-none transition-all
                        text-gray-700 nunito
                      "
                      placeholder="Zopakuj heslo"
                    />
                    {showConfirm ? (
                      <EyeOff
                        onClick={() => setShowConfirm(false)}
                        className="absolute right-4 top-4 text-gray-500 w-4 h-4 cursor-pointer hover:text-[#7361FF] transition"
                      />
                    ) : (
                      <Eye
                        onClick={() => setShowConfirm(true)}
                        className="absolute right-4 top-4 text-gray-500 w-4 h-4 cursor-pointer hover:text-[#7361FF] transition"
                      />
                    )}
                  </div>
                  {errors.confirm && (
                    <p className="text-red-500 text-sm mt-1">{errors.confirm}</p>
                  )}
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="
                    relative w-full nunito inline-flex items-center justify-center
                    px-9 py-3 mt-2 overflow-hidden font-medium text-white rounded-2xl
                    bg-gradient-to-r from-[#7361FF] to-[#8C78FF]
                    transition-all duration-300
                    hover:shadow-[0_4px_15px_rgba(115,97,255,0.3)]
                    hover:scale-[1.03] active:scale-[0.98]
                    cursor-pointer
                    disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100
                  "
                >
                  <span className="relative z-10">
                    {loading ? "Ukladám..." : "Uložiť nové heslo"}
                  </span>
                  <span className="absolute inset-0 bg-white opacity-0 hover:opacity-[0.08] transition-opacity duration-300 rounded-2xl" />
                </button>
              </form>

              <p className="nunito text-gray-600 text-center mt-6 text-sm">
                Spomínaš si na heslo?{" "}
                <Link href="/login" className="text-[#7361FF] font-semibold hover:underline hover:text-[#8C78FF] transition">
                  Prihlásiť sa
                </Link>
              </p>
            </>
          )}
        </div>
      </div>

      {/* RIGHT SIDE – GRADIENT */}
      <div className="relative hidden md:flex items-center justify-center p-10 overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-[#7361FF] to-[#8C78FF]" />
        <div className="absolute -bottom-16 -left-10 w-96 h-96 bg-white/10 blur-3xl rounded-full" />
        <div className="absolute -top-10 right-0 w-72 h-72 bg-white/10 blur-2xl rounded-full" />

        <div className="absolute top-10 left-10 flex items-center gap-3 z-20">
          <Image src="/logo.png" width={30} height={30} alt="KodujLahko Logo" />
          <h3
            className="text-xl font-semibold text-white"
            style={{ fontFamily: "'Momo Trust Display', sans-serif" }}
          >
            KódujĽahko
          </h3>
        </div>

        <div className="relative z-10 text-center text-white px-8">
          <h3
            className="text-3xl font-semibold mb-4"
            style={{ fontFamily: "'Momo Trust Display', sans-serif" }}
          >
            Takmer hotovo!
          </h3>
          <p className="text-white/80 nunito text-lg">
            Nastav si nové heslo a pokračuj v učení tam, kde si skončil.
          </p>
        </div>
      </div>
    </div>
  );
}
