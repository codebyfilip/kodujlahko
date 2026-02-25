import Image from "next/image";
import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/supabase/server";
import LogoutButton from "../../components/dashboard/LogoutButton";
import EmailVerificationBanner from "../../components/EmailVerificationBanner";
import Navbar from "@/components/dashboard/NavBar";

type DashboardSearchParams = Promise<{ welcome?: string }>;

function initials(name: string) {
  const parts = name.trim().split(" ").filter(Boolean);
  if (!parts.length) return "U";
  const a = parts[0]?.[0] ?? "U";
  const b = parts[1]?.[0] ?? "";
  return (a + b).toUpperCase();
}

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: DashboardSearchParams;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const params = await searchParams;
  const isNewUser = params.welcome === "true";
  const isEmailConfirmed = user.email_confirmed_at !== null;

  const displayName =
    user.user_metadata?.full_name ||
    user.user_metadata?.username ||
    user.email ||
    "Používateľ";

  const avatarText = initials(String(displayName));

  return (
    <div className="min-h-screen bg-white">
      {/* subtle background glow */}
      <div className="pointer-events-none fixed inset-0 -z-10">
        <div className="absolute -top-32 left-1/2 h-[420px] w-[820px] -translate-x-1/2 rounded-full bg-gradient-to-r from-[#7361FF]/18 to-[#8C78FF]/18 blur-3xl" />
        <div className="absolute -bottom-40 left-10 h-[380px] w-[520px] rounded-full bg-[#7361FF]/10 blur-3xl" />
        <div className="absolute -bottom-40 right-10 h-[380px] w-[520px] rounded-full bg-[#8C78FF]/10 blur-3xl" />
      </div>

      
      <Navbar  user={{name:
      (user.user_metadata?.full_name as string | undefined) ||
      (user.user_metadata?.name as string | undefined) ||
      (user.user_metadata?.username as string | undefined) ||
      (user.email ? user.email.split("@")[0] : "Používateľ"),
    email: user.email ?? "",
    avatar: (user.user_metadata?.avatar_url as string | undefined) || undefined,
  }} />


      {/* Email Verification Banner */}
      {!isEmailConfirmed && <EmailVerificationBanner email={user.email || ""} />}





    </div>
  );
}
