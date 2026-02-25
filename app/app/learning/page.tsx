import { redirect } from "next/navigation";
import { createClient } from '@/supabase/server';
import { getUserProgress, getUserStats, mergeTracksWithProgress, getCurrentLearning, updateStreak } from "./utils";
import TrackCard from "../../../components/learning/TrackCard";
import Navbar from "../../../components/dashboard/NavBar";

// Server Component
export default async function LearningPage() {
  const supabase = await createClient();
  
  const { data: { user } } = await supabase.auth.getUser();
  
  if (!user) {
    redirect('/login');
  }

  const [userProgress, stats] = await Promise.all([
    getUserProgress(user.id),
    getUserStats(user.id)
  ]);

  try {
    await updateStreak(user.id);
  } catch (err) {
    console.error('Failed to update streak:', err);
  }

  const tracks = mergeTracksWithProgress(userProgress);


  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Nunito:wght@400;600;700;800;900&family=DM+Sans:wght@400;500;600&display=swap');

        .learning-page {
          font-family: 'DM Sans', sans-serif;
          min-height: 100vh;
          background: #ffffff;
          padding-top: 80px;
        }

        .learning-page * {
          box-sizing: border-box;
        }

        /* ── Hero ── */
        .hero-section {
          padding: 64px 0 48px;
        }

        .hero-label {
          display: inline-flex;
          align-items: center;
          gap: 8px;
          background: linear-gradient(135deg, #EDE9FF 0%, #F3E8FF 100%);
          border: 1px solid #D8B4FE;
          border-radius: 100px;
          padding: 6px 14px;
          font-size: 12px;
          font-weight: 700;
          color: #7361FF;
          letter-spacing: 0.05em;
          text-transform: uppercase;
          margin-bottom: 20px;
          font-family: 'Nunito', sans-serif;
        }

        .hero-title {
          font-family: 'Nunito', sans-serif;
          font-size: clamp(32px, 5vw, 56px);
          font-weight: 900;
          color: #111;
          line-height: 1.1;
          letter-spacing: -0.03em;
          margin: 0 0 16px;
        }

        .hero-title .gradient-text {
          background: linear-gradient(135deg, #7361FF 0%, #A855F7 50%, #EC4899 100%);
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
          background-clip: text;
        }

        .hero-subtitle {
          font-size: 16px;
          color: #6B7280;
          line-height: 1.7;
          max-width: 440px;
          margin: 0;
        }

        /* ── Track path visual connector ── */
        .path-indicator {
          display: flex;
          align-items: center;
          gap: 0;
          margin-bottom: 56px;
          overflow-x: auto;
          padding-bottom: 4px;
          scrollbar-width: none;
        }
        .path-indicator::-webkit-scrollbar { display: none; }

        .path-step {
          display: flex;
          align-items: center;
          gap: 0;
          flex-shrink: 0;
        }

        .path-dot {
          width: 36px;
          height: 36px;
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 14px;
          font-weight: 800;
          font-family: 'Nunito', sans-serif;
          position: relative;
          transition: transform 0.2s;
          flex-shrink: 0;
        }

        .path-dot:hover { transform: scale(1.1); }

        .path-dot.active {
          background: linear-gradient(135deg, #7361FF, #A855F7);
          color: white;
          box-shadow: 0 4px 16px rgba(115, 97, 255, 0.4);
        }

        .path-dot.completed {
          background: linear-gradient(135deg, #10B981, #34D399);
          color: white;
        }

        .path-dot.locked {
          background: #F3F4F6;
          color: #D1D5DB;
          border: 2px solid #E5E7EB;
        }

        .path-label {
          font-size: 11px;
          font-weight: 700;
          color: #9CA3AF;
          text-align: center;
          margin-top: 8px;
          font-family: 'Nunito', sans-serif;
          white-space: nowrap;
        }

        .path-label.active-label { color: #7361FF; }
        .path-label.completed-label { color: #10B981; }

        .path-line {
          width: 48px;
          height: 2px;
          background: linear-gradient(90deg, #E5E7EB 0%, #E5E7EB 100%);
          flex-shrink: 0;
          margin-bottom: 20px;
        }

        .path-line.completed-line {
          background: linear-gradient(90deg, #10B981, #34D399);
        }

        /* ── Section header ── */
        .section-header {
          display: flex;
          align-items: flex-end;
          justify-content: space-between;
          margin-bottom: 28px;
        }

        .section-title {
          font-family: 'Nunito', sans-serif;
          font-size: 22px;
          font-weight: 900;
          color: #111;
          margin: 0 0 4px;
          letter-spacing: -0.02em;
        }

        .section-sub {
          font-size: 13px;
          color: #9CA3AF;
          margin: 0;
          font-weight: 500;
        }

        /* ── Track cards grid ── */
        .tracks-grid {
          display: grid;
          gap: 20px;
          grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
        }

        /* ── Track card (custom, overrides component if needed) ── */
        .track-card-wrapper {
          position: relative;
        }

        /* ── Info strip at bottom ── */
        .info-strip {
          margin-top: 64px;
          background: linear-gradient(135deg, #F5F3FF 0%, #FDF4FF 100%);
          border: 1px solid #EDE9FF;
          border-radius: 24px;
          padding: 32px 36px;
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 24px;
          flex-wrap: wrap;
        }

        .info-strip-text h3 {
          font-family: 'Nunito', sans-serif;
          font-size: 18px;
          font-weight: 800;
          color: #111;
          margin: 0 0 6px;
        }

        .info-strip-text p {
          font-size: 14px;
          color: #6B7280;
          margin: 0;
          line-height: 1.6;
        }

        .info-strip-badges {
          display: flex;
          gap: 10px;
          flex-wrap: wrap;
        }

        .badge {
          display: flex;
          align-items: center;
          gap: 6px;
          background: white;
          border: 1px solid #E5E7EB;
          border-radius: 100px;
          padding: 8px 16px;
          font-size: 13px;
          font-weight: 600;
          color: #374151;
          font-family: 'Nunito', sans-serif;
          white-space: nowrap;
        }

        .badge-dot {
          width: 8px;
          height: 8px;
          border-radius: 50%;
        }


        .content-wrapper {
          position: relative;
          z-index: 1;
          max-width: 1152px;
          margin: 0 auto;
          padding: 0 24px 80px;
        }

        @media (max-width: 640px) {
          .hero-section { padding: 40px 0 32px; }
          .info-strip { padding: 24px; }
          .tracks-grid { grid-template-columns: 1fr; }
        }
      `}</style>

      <div className="learning-page">
        {/* Background glow - rovnaký ako app/page.tsx */}
        <div className="pointer-events-none fixed inset-0 -z-10">
          <div className="absolute -top-32 left-1/2 h-[420px] w-[820px] -translate-x-1/2 rounded-full bg-gradient-to-r from-[#7361FF]/18 to-[#8C78FF]/18 blur-3xl" />
          <div className="absolute -bottom-40 left-10 h-[380px] w-[520px] rounded-full bg-[#7361FF]/10 blur-3xl" />
          <div className="absolute -bottom-40 right-10 h-[380px] w-[520px] rounded-full bg-[#8C78FF]/10 blur-3xl" />
        </div>

        <Navbar user={{
          name: (user.user_metadata?.full_name as string | undefined) ||
            (user.user_metadata?.name as string | undefined) ||
            (user.user_metadata?.username as string | undefined) ||
            (user.email ? user.email.split("@")[0] : "Používateľ"),
          email: user.email ?? "",
          avatar: (user.user_metadata?.avatar_url as string | undefined) || undefined,
        }} />

        <div className="content-wrapper">

          {/* ── Hero ── */}
          <div className="hero-section">
            <div className="hero-label">
              <span>🎓</span> Tvoja učebná cesta
            </div>
            <h1 className="hero-title">
              Vyber si, čo sa<br />
              <span className="gradient-text">chceš naučiť</span>
            </h1>
            <p className="hero-subtitle">
              Každý track je navrhnutý krok po kroku — od základov až po reálne projekty. Stačí vybrať a začať.
            </p>
          </div>

          {/* ── Learning path visual ── */}
          <div className="path-indicator">
            {[
              { label: "HTML", icon: "🏗️", state: "completed" },
              { label: "CSS", icon: "🎨", state: "active" },
              { label: "JS", icon: "⚡", state: "locked" },
            ].map((step, i, arr) => (
              <div key={step.label} className="path-step">
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                  <div className={`path-dot ${step.state === 'completed' ? 'completed' : step.state === 'active' ? 'active' : 'locked'}`}>
                    {step.state === 'completed' ? '✓' : step.icon}
                  </div>
                  <div className={`path-label ${step.state === 'active' ? 'active-label' : step.state === 'completed' ? 'completed-label' : ''}`}>
                    {step.label}
                  </div>
                </div>
                {i < arr.length - 1 && (
                  <div className={`path-line ${step.state === 'completed' ? 'completed-line' : ''}`} />
                )}
              </div>
            ))}
          </div>

          {/* ── Tracks ── */}
          <div style={{ marginBottom: '80px' }}>
            <div className="section-header">
              <div>
                <h2 className="section-title">Technológie</h2>
                <p className="section-sub">3 tracky · začni hocikde</p>
              </div>
            </div>

            <div className="tracks-grid">
              {tracks.map((track) => (
                <div key={track.id} className="track-card-wrapper">
                  <TrackCard track={track} />
                </div>
              ))}
            </div>
          </div>

          {/* ── Info strip ── */}
          <div className="info-strip">
            <div className="info-strip-text">
              <h3>Nie si si istý kde začať?</h3>
              <p>Odporúčame začať s HTML — je to základ každej webovej stránky. CSS a JavaScript neskôr pridajú krásu a interaktivitu.</p>
            </div>
            <div className="info-strip-badges">
              <div className="badge">
                <div className="badge-dot" style={{ background: '#F97316' }} />
                HTML
              </div>
              <div className="badge">
                <div className="badge-dot" style={{ background: '#3B82F6' }} />
                CSS
              </div>
              <div className="badge">
                <div className="badge-dot" style={{ background: '#EAB308' }} />
                JavaScript
              </div>
            </div>
          </div>

        </div>
      </div>
    </>
  );
}

export const metadata = {
  title: 'Učenie | KóduĽahko',
  description: 'Interaktívne kurzy HTML, CSS a JavaScript. Nauč sa kódovať zábavnou formou.'
};