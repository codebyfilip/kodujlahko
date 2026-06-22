"use client";

import { useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { Mail, ArrowLeft, CheckCircle } from "lucide-react";
import { createClient } from "@/supabase/client";

export default function ForgotPassword() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.includes("@")) {
      setError("Zadaj platný email.");
      return;
    }

    setLoading(true);
    setError("");

    try {
      const supabase = createClient();
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${location.origin}/auth/callback?next=/reset-password`,
      });

      if (error) {
        setError("Nastala chyba. Skús to znova.");
        return;
      }

      setSent(true);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen grid md:grid-cols-2 bg-white">

      {/* LEFT SIDE – FORM */}
      <div className="flex items-center justify-center p-6 sm:p-10">
        <div className="w-full max-w-md">

          <Link
            href="/login"
            className="inline-flex items-center gap-2 text-sm text-gray-500 hover:text-[#7361FF] nunito mb-8 transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            Späť na prihlásenie
          </Link>

          {sent ? (
            <div className="text-center">
              <div className="flex justify-center mb-4">
                <CheckCircle className="w-16 h-16 text-[#7361FF]" />
              </div>
              <h2
                className="text-3xl font-semibold text-gray-900 mb-3 tracking-tight"
                style={{ fontFamily: "'Momo Trust Display', sans-serif" }}
              >
                Email odoslaný!
              </h2>
              <p className="text-gray-500 nunito mb-2">
                Poslali sme ti odkaz na obnovenie hesla na
              </p>
              <p className="font-semibold text-gray-800 nunito mb-6">{email}</p>
              <p className="text-gray-400 text-sm nunito">
                Skontroluj aj priečinok so spamom, ak email nenájdeš.
              </p>
            </div>
          ) : (
            <>
              <h2
                className="text-4xl font-semibold text-gray-900 mb-2 tracking-tight"
                style={{ fontFamily: "'Momo Trust Display', sans-serif" }}
              >
                Zabudnuté heslo
              </h2>
              <p className="text-gray-500 nunito mb-8">
                Zadaj svoj email a pošleme ti odkaz na obnovenie hesla.
              </p>

              <form onSubmit={handleSubmit} className="space-y-6">
                <div>
                  <div className="relative mt-1">
                    <Mail className="absolute left-4 top-4 text-gray-400 w-4 h-4" />
                    <input
                      type="email"
                      value={email}
                      onChange={(e) => {
                        setEmail(e.target.value);
                        setError("");
                      }}
                      className="
                        w-full pl-12 pr-4 py-3 rounded-xl
                        bg-gray-100 border border-gray-300
                        focus:border-[#7361FF] focus:ring-2 focus:ring-[#7361FF]/40
                        outline-none transition-all
                        text-gray-700 nunito
                      "
                      placeholder="Email"
                    />
                  </div>
                  {error && (
                    <p className="text-red-500 text-sm mt-1">{error}</p>
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
                    {loading ? "Odosielam..." : "Odoslať odkaz"}
                  </span>
                  <span className="absolute inset-0 bg-white opacity-0 hover:opacity-[0.08] transition-opacity duration-300 rounded-2xl" />
                </button>
              </form>
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
            Nevadí, stáva sa to!
          </h3>
          <p className="text-white/80 nunito text-lg">
            Pošleme ti email s odkazom na obnovenie hesla. Celý proces trvá len pár sekúnd.
          </p>
        </div>
      </div>
    </div>
  );
}
