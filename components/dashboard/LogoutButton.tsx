"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/supabase/client";

export default function LogoutButton() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  const handleLogout = async () => {
    setLoading(true);

    const supabase = createClient();
    await supabase.auth.signOut();

    router.push("/login");
    router.refresh();
  };

  return (
    <button
      onClick={handleLogout}
      disabled={loading}
      className="
        px-4 py-2 text-sm font-medium text-gray-700 
        bg-gray-100 hover:bg-gray-200 
        rounded-lg transition-colors
        disabled:opacity-50 disabled:cursor-not-allowed
      "
    >
      {loading ? "Odhlasujem..." : "Odhlásiť sa"}
    </button>
  );
}