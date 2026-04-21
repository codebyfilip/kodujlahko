import { redirect } from 'next/navigation';
import { createClient } from '@/supabase/server';
import Navbar from '@/components/dashboard/NavBar';
import WelcomeBanner from './WelcomeBanner';
import { Target, Swords } from 'lucide-react';
import Link from 'next/link';

export default async function ChallengesPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const displayName =
    (user.user_metadata?.full_name as string | undefined) ||
    (user.user_metadata?.name as string | undefined) ||
    (user.user_metadata?.username as string | undefined) ||
    (user.email ? user.email.split('@')[0] : 'Používateľ');

  const userData = {
    name: displayName,
    email: user.email ?? '',
    avatar: (user.user_metadata?.avatar_url as string | undefined) || undefined,
  };

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap');
        .cp { font-family:'Inter',sans-serif; min-height:100vh; background:#ffffff; padding-top:72px; color:#0F172A; }
        .cw { max-width:1080px; margin:0 auto; padding:0 24px 80px; }
      `}</style>

      <Navbar user={userData} />

      <div className="cp">
        <div className="cw">

          {/* Header */}
          <div style={{ padding: '32px 0 24px' }}>
            <h1 style={{ fontSize: 'clamp(20px,3vw,28px)', fontWeight: 800, color: '#0F172A', margin: '0 0 4px', letterSpacing: '-0.4px' }}>
              Výzvy
            </h1>
            <p style={{ fontSize: 14, color: '#64748B', margin: 0 }}>
              Testuj znalosti, súťaž s kamarátmi, posúvaj hranice.
            </p>
          </div>

          {/* First-visit banner */}
          <WelcomeBanner />

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <Link href="/app/challenges/solo" style={{ textDecoration: 'none' }}>
              <div style={{ background: '#fff', border: '1px solid #E2E8F0', borderRadius: 16, padding: 28, display: 'flex', flexDirection: 'column', gap: 12, cursor: 'pointer', height: '100%' }}>
                <div style={{ width: 42, height: 42, borderRadius: 12, background: '#F5F3FF', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Target size={20} color="#7C3AED" />
                </div>
                <div style={{ fontSize: 16, fontWeight: 700, color: '#0F172A' }}>Sólo výzvy</div>
                <div style={{ fontSize: 13, color: '#64748B', lineHeight: 1.5 }}>
                  Vyber si výzvu podľa kategórie a precvič si HTML, CSS alebo JavaScript vlastným tempom.
                </div>
                <div style={{ marginTop: 4, fontSize: 12, fontWeight: 600, color: '#7C3AED' }}>Otvoriť →</div>
              </div>
            </Link>
            <div style={{ background: '#fff', border: '1px solid #E2E8F0', borderRadius: 16, padding: 28, display: 'flex', flexDirection: 'column', gap: 12, opacity: 0.6 }}>
              <div style={{ width: 42, height: 42, borderRadius: 12, background: '#FFF7ED', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Swords size={20} color="#EA580C" />
              </div>
              <div style={{ fontSize: 16, fontWeight: 700, color: '#0F172A' }}>Súboje</div>
              <div style={{ fontSize: 13, color: '#64748B', lineHeight: 1.5 }}>
                Vyzvi spoluhráča zo svojej skupiny na súboj. Kto vyriešuje úlohu rýchlejšie a lepšie?
              </div>
              <div style={{ marginTop: 4, fontSize: 12, fontWeight: 600, color: '#EA580C' }}>Čoskoro dostupné</div>
            </div>
          </div>

        </div>
      </div>
    </>
  );
}

export const metadata = { title: 'Výzvy | KóduLahko' };
