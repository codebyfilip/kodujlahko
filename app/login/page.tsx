"use client";

import { useState, useEffect, Suspense } from "react";
import Link from "next/link";
import Image from "next/image";
import { useRouter, useSearchParams } from "next/navigation";
import { Mail, Lock, Eye, EyeOff } from "lucide-react";
import { createClient } from "@/supabase/client";

export default function LoginPage() {
  return (
    <Suspense>
      <Login />
    </Suspense>
  );
}

function Login() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [globalError, setGlobalError] = useState("");

  useEffect(() => {
    const error = searchParams.get("error");
    if (error === "use_email") {
      setGlobalError("Tento účet je zaregistrovaný cez email a heslo. Prihlás sa formulárom nižšie.");
    } else if (error === "auth_failed") {
      setGlobalError("Prihlásenie zlyhalo. Skús to znova.");
    }
  }, [searchParams]);

  const [form, setForm] = useState({
    email: "",
    password: "",
  });

  const [errors, setErrors] = useState({
    email: "",
    password: "",
  });

  const handleChange = (e: any) => {
    setForm({ ...form, [e.target.name]: e.target.value });
    // Vymaž error keď user píše
    setErrors({ ...errors, [e.target.name]: "" });
  };

  const validate = () => {
    let newErrors: any = {};

    if (!form.email.includes("@")) newErrors.email = "Email musí byť platný.";
    if (form.password.length < 6)
      newErrors.password = "Heslo musí mať aspoň 6 znakov.";

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const loginUser = async (e: any) => {
    e.preventDefault();
    if (!validate() || loading) return;

    setLoading(true);

    try {
      const supabase = createClient();

      const { error } = await supabase.auth.signInWithPassword({
        email: form.email,
        password: form.password,
      });

      if (error) {
        if (error.message.includes("Invalid login credentials")) {
          setErrors({ email: "", password: "Nesprávny email alebo heslo." });
        } else if (error.message.includes("Email not confirmed")) {
          setErrors({ email: "Email ešte nebol potvrdený.", password: "" });
        } else {
          setErrors({ email: "", password: error.message });
        }
        return;
      }

      router.push("/app");
      router.refresh();
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleSignIn = async () => {
    setGoogleLoading(true);

    const supabase = createClient();

    await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: `${location.origin}/auth/callback`,
      },
    });
  };

  return (
    <div className="min-h-screen grid md:grid-cols-2 bg-white">

      {/* LEFT SIDE – LOGIN FORM */}
      <div className="flex items-center justify-center p-6 sm:p-10">
        <div className="w-full max-w-md">

          {/* Title */}
          <h2
            className="text-4xl font-semibold text-gray-900 mb-2 tracking-tight"
            style={{ fontFamily: "'Momo Trust Display', sans-serif" }}
          >
            Prihlásenie
          </h2>
          <p className="text-gray-500 nunito mb-8">
            Vitaj späť! Pokračuj tam, kde si prestal. 👋
          </p>

          {globalError && (
            <div className="flex items-start gap-3 bg-amber-50 border border-amber-200 text-amber-800 rounded-xl px-4 py-3 mb-6 text-sm">
              <span className="mt-0.5">⚠️</span>
              <span>{globalError}</span>
            </div>
          )}

          {/* 🔥 GOOGLE BUTTON */}
          <button
            onClick={handleGoogleSignIn}
            disabled={googleLoading || loading}
            className="w-full flex items-center justify-center gap-3 px-4 py-3 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
          >
            {googleLoading ? (
              <span className="text-gray-600">Presmerovávam...</span>
            ) : (
              <>
                <svg className="w-5 h-5" viewBox="0 0 24 24">
                  <path
                    fill="#4285F4"
                    d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                  />
                  <path
                    fill="#34A853"
                    d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                  />
                  <path
                    fill="#FBBC05"
                    d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                  />
                  <path
                    fill="#EA4335"
                    d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                  />
                </svg>
                <span className="text-gray-700 font-medium">
                  Pokračovať s Google
                </span>
              </>
            )}
          </button>

          {/* Divider */}
          <div className="flex items-center my-6">
            <div className="flex-1 h-px bg-gray-300"></div>
            <span className="px-4 text-gray-400 nunito">alebo</span>
            <div className="flex-1 h-px bg-gray-300"></div>
          </div>

          {/* FORM */}
          <form onSubmit={loginUser} className="space-y-6">

            {/* EMAIL */}
            <div>
              <div className="relative mt-1">
                <Mail className="absolute left-4 top-4 text-gray-400 w-4 h-4" />

                <input
                  type="email"
                  name="email"
                  onChange={handleChange}
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
              {errors.email && (
                <p className="text-red-500 text-sm mt-1">{errors.email}</p>
              )}
            </div>

            {/* PASSWORD */}
            <div>
              <div className="relative mt-1">
                <Lock className="absolute left-4 top-4 text-gray-400 w-4 h-4" />

                <input
                  type={showPassword ? "text" : "password"}
                  name="password"
                  onChange={handleChange}
                  className="
                    w-full pl-12 pr-12 py-3 rounded-xl 
                    bg-gray-100 border border-gray-300
                    focus:border-[#7361FF] focus:ring-2 focus:ring-[#7361FF]/40
                    outline-none transition-all
                    text-gray-700 nunito
                  "
                  placeholder="Heslo"
                />

                {!showPassword ? (
                  <EyeOff
                    onClick={() => setShowPassword(true)}
                    className="absolute right-4 top-4 text-gray-500 w-4 h-4 cursor-pointer hover:text-[#7361FF] transition"
                  />
                ) : (
                  <Eye
                    onClick={() => setShowPassword(false)}
                    className="absolute right-4 top-4 text-gray-500 w-4 h-4 cursor-pointer hover:text-[#7361FF] transition"
                  />
                )}
              </div>

              {errors.password && (
                <p className="text-red-500 text-sm mt-1">{errors.password}</p>
              )}
            </div>

            {/* SUBMIT BUTTON */}
            <button
              type="submit"
              disabled={loading || googleLoading}
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
                {loading ? "Prihlasujem..." : "Prihlásiť sa"}
              </span>
              <span className="absolute inset-0 bg-white opacity-0 hover:opacity-[0.08] transition-opacity duration-300 rounded-2xl" />
            </button>

          </form>

          {/* Forgot password */}
          <div className="text-right mt-4">
            <Link
              href="/forgot-password"
              className="text-sm text-[#7361FF] hover:text-[#8C78FF] nunito"
            >
              Zabudol si heslo?
            </Link>
          </div>

          {/* Register link */}
          <p className="nunito text-gray-600 text-center mt-6">
            Nemáš účet?{" "}
            <Link
              href="/signup"
              className="text-[#7361FF] font-semibold hover:underline hover:text-[#8C78FF] transition"
            >
              Vytvoriť účet
            </Link>
          </p>
        </div>
      </div>

      {/* RIGHT SIDE – IMAGE & GRADIENT */}
      <div className="relative hidden md:flex items-center justify-center p-10 overflow-hidden">

        {/* Gradient background */}
        <div className="absolute inset-0 bg-gradient-to-br from-[#7361FF] to-[#8C78FF]" />

        {/* Glow shapes */}
        <div className="absolute -bottom-16 -left-10 w-96 h-96 bg-white/10 blur-3xl rounded-full"></div>
        <div className="absolute -top-10 right-0 w-72 h-72 bg-white/10 blur-2xl rounded-full"></div>

        {/* Logo */}
        <div className="absolute top-10 left-10 flex items-center gap-3 z-20">
          <Image
            src="/logo.png"
            width={30}
            height={30}
            alt="KodujLahko Logo"
          />
          <h3
            className="text-xl font-semibold text-white"
            style={{ fontFamily: "'Momo Trust Display', sans-serif" }}
          >
             KódujĽahko
          </h3>
        </div>

        {/* Main image */}
        <div className="relative z-10">
          <Image
            src="/loginbg.png"
            alt="Coding illustration"
            width={400}
            height={400}
          />
        </div>

      </div>
    </div>
  );
}