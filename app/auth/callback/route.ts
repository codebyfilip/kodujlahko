import { createClient } from "@/supabase/server";
import { NextResponse } from "next/server";

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const rawNext = searchParams.get("next") ?? "/app";
  // only allow relative paths to prevent open redirect attacks
  const next = rawNext.startsWith("/") && !rawNext.startsWith("//") ? rawNext : "/app";

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);

    if (!error) {
      const { data: { user } } = await supabase.auth.getUser();
      const identities = user?.identities ?? [];

      const emailIdentity = identities.find((i) => i.provider === 'email');
      const googleIdentity = identities.find((i) => i.provider === 'google');

      // User originally registered with email and now tried Google — block it
      if (emailIdentity && googleIdentity) {
        const emailFirst = new Date(emailIdentity.created_at ?? 0) <= new Date(googleIdentity.created_at ?? 0);
        if (emailFirst) {
          await supabase.auth.signOut();
          return NextResponse.redirect(`${origin}/login?error=use_email`);
        }
      }

      const forwardedHost = request.headers.get("x-forwarded-host");
      const isLocal = process.env.NODE_ENV === "development";

      if (isLocal) {
        return NextResponse.redirect(`${origin}${next}`);
      } else if (forwardedHost) {
        return NextResponse.redirect(`https://${forwardedHost}${next}`);
      } else {
        return NextResponse.redirect(`${origin}${next}`);
      }
    }
  }

  return NextResponse.redirect(`${origin}/login?error=auth_failed`);
}