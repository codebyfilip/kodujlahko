"use client";

import { useState } from "react";
import { createClient } from "@/supabase/client";

export default function EmailVerificationBanner({ email }: { email: string }) {
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState("");

  const resendEmail = async () => {
    setSending(true);
    setError("");

    try {
      const supabase = createClient();
      
      const { error } = await supabase.auth.resend({
        type: "signup",
        email: email,
        options: {
          emailRedirectTo: `${location.origin}/auth/callback`,
        },
      });

      if (error) {
        if (error.message.includes("rate limit")) {
          setError("Počkaj chvíľu pred ďalším odoslaním.");
        } else {
          setError(error.message);
        }
        return;
      }

      setSent(true);
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="bg-amber-50 border-b border-amber-200">
      <div className="max-w-7xl mx-auto px-6 py-3">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
          <div className="flex items-center gap-2">
            <span className="text-amber-600">📧</span>
            <p className="text-sm text-amber-800">
              <strong>Potvrď svoj email</strong> na {email} pre plný prístup k funkciám.
            </p>
          </div>
          
          <div className="flex items-center gap-3">
            {error && (
              <span className="text-xs text-red-600">{error}</span>
            )}
            
            {sent ? (
              <span className="text-sm text-green-600 font-medium">
                ✓ Email odoslaný!
              </span>
            ) : (
              <button
                onClick={resendEmail}
                disabled={sending}
                className="
                  text-sm font-medium text-amber-700 
                  hover:text-amber-900 underline
                  disabled:opacity-50 disabled:cursor-not-allowed
                "
              >
                {sending ? "Odosielam..." : "Poslať znova"}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}