import { redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/supabase/server";
import Navbar from "../../../../components/dashboard/NavBar";
import GroupTrackPanel from "@/components/GroupTrackPanel";
import trackData from "./css.json";
import { FiBookOpen, FiClock, FiZap, FiPlay, FiAward, FiCheck } from 'react-icons/fi';

// ─── Types ────────────────────────────────────────────────────────────────────
interface Lesson {
  id: string;
  lesson_id: string;
  order: number;
  slug: string;
  title: string;
  summary: string;
  estimatedMinutes: number;
  xp: number;
  sections: { type: string }[];
}

interface LessonProgressRow {
  lesson_id: string;
  status: string | null;
  quiz_passed: boolean | null;
  xp_earned: number | null;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
function totalXP(lessons: Lesson[]) {
  return lessons.reduce((s, l) => s + l.xp, 0);
}
function totalMinutes(lessons: Lesson[]) {
  return lessons.reduce((s, l) => s + l.estimatedMinutes, 0);
}


// ─── Server Component ─────────────────────────────────────────────────────────
export default async function CSSTrackPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { track, lessons } = trackData;
  const typedLessons = lessons as Lesson[];

  const userData = {
    name: user.user_metadata?.full_name || user.email?.split("@")[0] || "User",
    email: user.email || "",
    avatar: user.user_metadata?.avatar_url,
  };

  // ── Fetch progress zo Supabase ──
  const { data: progressRows } = await supabase
    .from("user_lesson_progress")
    .select("lesson_id, status, quiz_passed, xp_earned")
    .eq("user_id", user.id)
    .eq("course_slug", "css")
    .in("lesson_id", typedLessons.map(l => l.lesson_id));

  const progressMap = new Map<string, LessonProgressRow>(
    (progressRows ?? []).map(r => [r.lesson_id, r])
  );

  const completedCount = typedLessons.filter(l => progressMap.get(l.lesson_id)?.status === 'completed').length;
  const startedCount = progressRows?.length ?? 0;
  const hasStarted = startedCount > 0;
  const isFinished = completedCount === typedLessons.length;

  // Ďalšia lekcia na ktorú má user ísť
  const lastLesson = (() => {
    // 1. Prvá lekcia, ktorú user začal ale nedokončil (in progress)
    const inProgress = typedLessons.find(l => {
      const p = progressMap.get(l.lesson_id);
      return p && p.status !== 'completed';
    });
    if (inProgress) return inProgress;

    // 2. Prvá lekcia, ktorú user ešte vôbec nezačal (nasleduje po dokončených)
    const notStarted = typedLessons.find(l => !progressMap.has(l.lesson_id));
    if (notStarted) return notStarted;

    // 3. Všetky dokončené — vráť poslednú (kurz hotový)
    return typedLessons[typedLessons.length - 1];
  })();

  const xpTotal = totalXP(typedLessons);
  const minutesTotal = totalMinutes(typedLessons);
  const xpEarned = typedLessons.reduce((s, l) => {
    const p = progressMap.get(l.lesson_id);
    return p?.status === 'completed' ? s + (p.xp_earned ?? 0) : s;
  }, 0);
  const progressPct = typedLessons.length > 0 ? Math.round((completedCount / typedLessons.length) * 100) : 0;

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Nunito:wght@400;600;700;800;900&family=Sora:wght@300;400;500;600&display=swap');

        :root {
          --brand: #7361FF;
          --brand-2: #8C78FF;
          --brand-light: #EDE9FF;
          --brand-mid: #C4B5FD;
          --success: #10B981;
          --warn: #F59E0B;
          --surface: #FFFFFF;
          --bg: #F7F7FB;
          --border: #E8E6F0;
          --text: #111118;
          --muted: #6B7280;
          --faint: #9CA3AF;
        }

        .track-page {
          font-family: 'Sora', sans-serif;
          min-height: 100vh;
          background: var(--bg);
          padding-top: 80px;
          color: var(--text);
        }
        .track-page *, .track-page *::before, .track-page *::after { box-sizing: border-box; }

        .wrap { max-width: 1100px; margin: 0 auto; padding: 0 24px 100px; }

        /* ── Hero ── */
        .hero { position: relative; padding: 56px 0 48px; }
        .hero-inner { position: relative; display: flex; align-items: flex-start; gap: 48px; flex-wrap: wrap; }
        .hero-left { flex: 1; min-width: 280px; }

        .hero-breadcrumb { display: flex; align-items: center; gap: 8px; font-size: 13px; color: var(--muted); margin-bottom: 20px; font-family: 'Nunito', sans-serif; font-weight: 600; }
        .hero-breadcrumb a { color: var(--brand); text-decoration: none; }
        .hero-breadcrumb a:hover { text-decoration: underline; }

        .hero-icon-wrap { display: inline-flex; align-items: center; justify-content: center; width: 64px; height: 64px; border-radius: 18px; background: linear-gradient(135deg, var(--brand) 0%, var(--brand-2) 100%); font-size: 28px; margin-bottom: 20px; box-shadow: 0 8px 24px rgba(115,97,255,0.3); }

        .hero-title { font-family: 'Nunito', sans-serif; font-size: clamp(28px, 4vw, 44px); font-weight: 900; letter-spacing: -0.03em; color: var(--text); margin: 0 0 12px; line-height: 1.1; }
        .hero-subtitle { font-size: 15px; color: var(--muted); line-height: 1.7; margin: 0 0 28px; max-width: 480px; }

        .hero-stats { display: flex; gap: 24px; flex-wrap: wrap; margin-bottom: 0; }
        .stat-item { display: flex; align-items: center; gap: 8px; font-size: 13px; color: var(--muted); font-weight: 500; }
        .stat-icon { width: 32px; height: 32px; border-radius: 10px; background: var(--brand-light); display: flex; align-items: center; justify-content: center; font-size: 15px; }
        .stat-value { font-family: 'Nunito', sans-serif; font-weight: 800; font-size: 15px; color: var(--text); }

        /* ── Progress card (pravá strana) ── */
        .progress-card {
          background: white;
          border: 1px solid var(--border);
          border-radius: 24px;
          padding: 28px;
          min-width: 280px;
          max-width: 320px;
          box-shadow: 0 4px 24px rgba(115,97,255,0.07);
          flex-shrink: 0;
        }

        /* Pred začatím — outcomes */
        .outcomes-title { font-family: 'Nunito', sans-serif; font-size: 13px; font-weight: 800; text-transform: uppercase; letter-spacing: 0.06em; color: var(--brand); margin: 0 0 16px; }
        .outcome-item { display: flex; align-items: flex-start; gap: 10px; margin-bottom: 12px; font-size: 13px; color: #374151; line-height: 1.5; }
        .outcome-check { width: 18px; height: 18px; border-radius: 50%; background: linear-gradient(135deg, var(--success), #34D399); display: flex; align-items: center; justify-content: center; flex-shrink: 0; margin-top: 1px; font-size: 10px; color: white; font-weight: 800; }

        /* Po začatí — progress widget */
        .prog-header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 16px; }
        .prog-label { font-family: 'Nunito', sans-serif; font-size: 13px; font-weight: 800; text-transform: uppercase; letter-spacing: 0.06em; color: var(--brand); }
        .prog-pct { font-family: 'Nunito', sans-serif; font-size: 22px; font-weight: 900; color: var(--text); }

        .prog-bar-outer { width: 100%; height: 10px; background: var(--brand-light); border-radius: 100px; overflow: hidden; margin-bottom: 16px; }
        .prog-bar-inner { height: 100%; border-radius: 100px; background: linear-gradient(90deg, var(--brand), var(--brand-2)); transition: width 0.6s ease; }

        .prog-stats { display: flex; gap: 0; margin-bottom: 20px; border: 1px solid var(--border); border-radius: 14px; overflow: hidden; }
        .prog-stat { flex: 1; padding: 12px 14px; text-align: center; border-right: 1px solid var(--border); }
        .prog-stat:last-child { border-right: none; }
        .prog-stat-val { font-family: 'Nunito', sans-serif; font-size: 18px; font-weight: 900; color: var(--text); display: block; }
        .prog-stat-lab { font-size: 11px; color: var(--faint); font-weight: 500; }

        /* CTA tlačidlá */
        .start-btn {
          display: inline-flex; align-items: center; justify-content: center; gap: 8px; width: 100%;
          background: linear-gradient(135deg, var(--brand) 0%, var(--brand-2) 100%);
          color: white; border-radius: 14px; padding: 14px 20px;
          font-family: 'Nunito', sans-serif; font-weight: 800; font-size: 15px;
          text-decoration: none; margin-top: 4px;
          transition: transform 0.18s, box-shadow 0.18s;
          box-shadow: 0 4px 16px rgba(115,97,255,0.35);
        }
        .start-btn:hover { transform: translateY(-2px); box-shadow: 0 8px 24px rgba(115,97,255,0.45); }

        .continue-btn {
          display: inline-flex; align-items: center; gap: 10px; width: 100%;
          background: linear-gradient(135deg, var(--brand) 0%, var(--brand-2) 100%);
          color: white; border-radius: 14px; padding: 14px 18px;
          font-family: 'Nunito', sans-serif; font-weight: 800; font-size: 14px;
          text-decoration: none; transition: transform 0.18s, box-shadow 0.18s;
          box-shadow: 0 4px 16px rgba(115,97,255,0.35);
        }
        .continue-btn:hover { transform: translateY(-2px); box-shadow: 0 8px 24px rgba(115,97,255,0.45); }
        .continue-btn-inner { flex: 1; min-width: 0; }
        .continue-btn-label { font-size: 11px; font-weight: 600; opacity: 0.75; display: block; margin-bottom: 2px; }
        .continue-btn-title { font-size: 13px; font-weight: 800; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }

        .finished-badge {
          display: flex; align-items: center; gap: 10px;
          background: linear-gradient(135deg, #F0FDF4, #DCFCE7);
          border: 1.5px solid #10B981;
          border-radius: 14px; padding: 14px 18px; margin-top: 4px;
        }
        .finished-badge-icon { font-size: 22px; flex-shrink: 0; }
        .finished-badge-text { font-family: 'Nunito', sans-serif; font-size: 14px; font-weight: 800; color: #166534; }
        .finished-badge-sub { font-size: 12px; color: #166534; opacity: 0.75; }

        /* ── Divider ── */
        .divider { border: none; border-top: 1px solid var(--border); margin: 0 0 48px; }

        /* ── Section header ── */
        .section-hd { display: flex; align-items: flex-end; justify-content: space-between; margin-bottom: 24px; }
        .section-hd-title { font-family: 'Nunito', sans-serif; font-size: 20px; font-weight: 900; letter-spacing: -0.02em; color: var(--text); margin: 0 0 3px; }
        .section-hd-sub { font-size: 13px; color: var(--faint); margin: 0; }
        .section-hd-count { font-family: 'Nunito', sans-serif; font-size: 13px; font-weight: 700; color: var(--brand); background: var(--brand-light); border-radius: 100px; padding: 4px 12px; }

        /* ── Lesson list ── */
        .lessons-list { display: flex; flex-direction: column; gap: 10px; margin-bottom: 56px; }

        .lesson-card {
          display: flex; align-items: center; gap: 16px;
          background: white; border: 1.5px solid var(--border);
          border-radius: 18px; padding: 18px 20px;
          text-decoration: none; color: inherit;
          transition: border-color 0.2s, box-shadow 0.2s, transform 0.2s;
          position: relative; overflow: hidden;
        }
        .lesson-card:hover { border-color: var(--brand-mid); box-shadow: 0 4px 20px rgba(115,97,255,0.10); transform: translateY(-1px); }

        /* Status variants */
        .lesson-card.lc-completed { border-color: #A7F3D0; background: #F0FDF4; }
        .lesson-card.lc-active { border-color: var(--brand-mid); background: #FAFAFF; box-shadow: 0 0 0 3px rgba(115,97,255,0.07); }

        .lesson-num {
          flex-shrink: 0; width: 42px; height: 42px; border-radius: 13px;
          background: var(--brand-light); display: flex; align-items: center; justify-content: center;
          font-family: 'Nunito', sans-serif; font-weight: 900; font-size: 15px; color: var(--brand);
          position: relative; z-index: 1;
        }
        .lc-completed .lesson-num { background: #D1FAE5; color: #059669; }
        .lc-active .lesson-num { background: linear-gradient(135deg, var(--brand), var(--brand-2)); color: white; box-shadow: 0 4px 12px rgba(115,97,255,0.35); }

        /* Check icon pre completed */
        .lesson-check {
          flex-shrink: 0; width: 22px; height: 22px; border-radius: 50%;
          background: #10B981; color: white;
          display: flex; align-items: center; justify-content: center;
          font-size: 11px; font-weight: 800; position: relative; z-index: 1;
        }

        .lesson-body { flex: 1; min-width: 0; position: relative; z-index: 1; }
        .lesson-title { font-family: 'Nunito', sans-serif; font-size: 15px; font-weight: 800; color: var(--text); margin: 0 0 3px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
        .lc-completed .lesson-title { color: #065F46; }
        .lesson-summary { font-size: 13px; color: var(--muted); margin: 0; line-height: 1.4; display: -webkit-box; -webkit-line-clamp: 1; -webkit-box-orient: vertical; overflow: hidden; }

        .lesson-meta { display: flex; align-items: center; gap: 12px; flex-shrink: 0; position: relative; z-index: 1; }
        .lesson-badge { display: flex; align-items: center; gap: 4px; font-size: 12px; font-weight: 600; font-family: 'Nunito', sans-serif; color: var(--muted); white-space: nowrap; }
        .xp-badge { background: linear-gradient(135deg, #FEF3C7, #FDE68A); color: #92400E; border-radius: 100px; padding: 3px 9px; font-size: 11px; font-weight: 800; font-family: 'Nunito', sans-serif; white-space: nowrap; }
        .xp-badge-full { background: linear-gradient(135deg, #D1FAE5, #A7F3D0); color: #065F46; }
        .xp-badge-partial { background: linear-gradient(135deg, #FEF3C7, #FDE68A); color: #92400E; }
        .arrow-icon { color: var(--brand-mid); font-size: 18px; transition: transform 0.2s, color 0.2s; }
        .lesson-card:hover .arrow-icon { transform: translateX(3px); color: var(--brand); }

        /* Active badge */
        .active-badge {
          display: inline-flex; align-items: center; gap: 5px;
          background: linear-gradient(135deg, var(--brand), var(--brand-2));
          color: white; border-radius: 100px; padding: 2px 8px;
          font-size: 10px; font-weight: 800; font-family: 'Nunito', sans-serif;
          letter-spacing: 0.04em; text-transform: uppercase;
          flex-shrink: 0;
        }

        /* ── Sticky CTA ── */
        .sticky-cta { position: fixed; bottom: 0; left: 0; right: 0; z-index: 50; background: rgba(255,255,255,0.95); backdrop-filter: blur(12px); border-top: 1px solid var(--border); padding: 14px 24px; display: flex; align-items: center; justify-content: space-between; gap: 16px; }
        .sticky-cta-info { display: flex; align-items: center; gap: 12px; }
        .sticky-cta-title { font-family: 'Nunito', sans-serif; font-size: 15px; font-weight: 800; color: var(--text); margin: 0; }
        .sticky-cta-sub { font-size: 12px; color: var(--muted); margin: 0; }
        .sticky-btn { display: inline-flex; align-items: center; gap: 8px; background: linear-gradient(135deg, var(--brand) 0%, var(--brand-2) 100%); color: white; border-radius: 12px; padding: 11px 22px; font-family: 'Nunito', sans-serif; font-weight: 800; font-size: 14px; text-decoration: none; white-space: nowrap; transition: transform 0.18s, box-shadow 0.18s; box-shadow: 0 4px 16px rgba(115,97,255,0.3); }
        .sticky-btn:hover { transform: translateY(-1px); box-shadow: 0 6px 20px rgba(115,97,255,0.4); }

        /* ── Progress bar in sticky ── */
        .sticky-prog { display: flex; align-items: center; gap: 8px; }
        .sticky-prog-bar { width: 100px; height: 6px; background: var(--border); border-radius: 100px; overflow: hidden; }
        .sticky-prog-fill { height: 100%; border-radius: 100px; background: linear-gradient(90deg, var(--brand), var(--brand-2)); }
        .sticky-prog-pct { font-family: 'Nunito', sans-serif; font-size: 12px; font-weight: 800; color: var(--brand); }

        @media (max-width: 768px) {
          .hero-inner { flex-direction: column; }
          .progress-card { max-width: 100%; width: 100%; }
          .lesson-meta { display: none; }
          .sticky-cta-info { display: none; }
        }
        @media (max-width: 480px) {
          .hero { padding: 32px 0 28px; }
          .wrap { padding: 0 16px 120px; }
        }
      `}</style>

      <Navbar user={userData} />

      <div className="track-page">
        <div className="wrap">
          {/* ── Hero ── */}
          <div className="hero">
            <div className="hero-inner">

              {/* ── Ľavá strana ── */}
              <div className="hero-left">
                <div className="hero-breadcrumb">
                  <Link href="/app/learning">Učenie</Link>
                  <span>›</span>
                  <span style={{ color: "var(--text)" }}>{track.title}</span>
                </div>

                <h1 className="hero-title">{track.title}</h1>
                <p className="hero-subtitle">{track.description}</p>

                <div className="hero-stats">
                  <div className="stat-item">
                    <div className="stat-icon"><FiBookOpen size={16} color="#7361FF" /></div>
                    <div>
                      <div className="stat-value">{typedLessons.length} lekcií</div>
                      <div style={{ fontSize: 12 }}>obsah kurzu</div>
                    </div>
                  </div>
                  <div className="stat-item">
                    <div className="stat-icon"><FiClock size={16} color="#7361FF" /></div>
                    <div>
                      <div className="stat-value">{minutesTotal} min</div>
                      <div style={{ fontSize: 12 }}>odhadovaný čas</div>
                    </div>
                  </div>
                  <div className="stat-item">
                    <div className="stat-icon"><FiZap size={16} color="#7361FF" /></div>
                    <div>
                      <div className="stat-value">{xpTotal} XP</div>
                      <div style={{ fontSize: 12 }}>celkové body</div>
                    </div>
                  </div>
                </div>
              </div>

              {/* ── Pravá strana — progress card ── */}
              <div className="progress-card">

                {!hasStarted ? (
                  // ── NEZAČATÉ — ukáž outcomes ──
                  <>
                    <p className="outcomes-title">Čo sa naučíš</p>
                    {track.outcomes.map((o: string, i: number) => (
                      <div key={i} className="outcome-item">
                        <div className="outcome-check">✓</div>
                        <span>{o}</span>
                      </div>
                    ))}
                    <Link href={`/app/learning/css/${typedLessons[0].slug}`} className="start-btn">
                      Začať kurz →
                    </Link>
                  </>
                ) : (
                  // ── ZAČATÉ — ukáž progress ──
                  <>
                    <div className="prog-header">
                      <span className="prog-label">Tvoj postup</span>
                      <span className="prog-pct">{progressPct}%</span>
                    </div>

                    <div className="prog-bar-outer">
                      <div className="prog-bar-inner" style={{ width: `${progressPct}%` }} />
                    </div>

                    <div className="prog-stats">
                      <div className="prog-stat">
                        <span className="prog-stat-val">{completedCount}</span>
                        <span className="prog-stat-lab">dokončené</span>
                      </div>
                      <div className="prog-stat">
                        <span className="prog-stat-val">{typedLessons.length - completedCount}</span>
                        <span className="prog-stat-lab">zostatok</span>
                      </div>
                      <div className="prog-stat">
                        <span className="prog-stat-val" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 3 }}><FiZap size={14} color="#7361FF" />{xpEarned}</span>
                        <span className="prog-stat-lab">XP získané</span>
                      </div>
                    </div>

                    {isFinished ? (
                      // Kurz hotový
                      <div className="finished-badge">
                        <div className="finished-badge-icon" style={{ display: 'flex', alignItems: 'center' }}><FiAward size={22} color="#166534" /></div>
                        <div>
                          <div className="finished-badge-text">Kurz dokončený!</div>
                          <div className="finished-badge-sub">Všetkých {typedLessons.length} lekcií splnených</div>
                        </div>
                      </div>
                    ) : (
                      // Pokračuj
                      <Link href={`/app/learning/css/${lastLesson.slug}`} className="continue-btn">
                        <FiPlay size={18} style={{ flexShrink: 0 }} />
                        <div className="continue-btn-inner">
                          <span className="continue-btn-label">Pokračovať v kurze</span>
                          <div className="continue-btn-title">{lastLesson.title}</div>
                        </div>
                      </Link>
                    )}
                  </>
                )}
              </div>
            </div>
          </div>

          <hr className="divider" />

          {/* ── Zoznam lekcií ── */}
          <div className="section-hd">
            <div>
              <h2 className="section-hd-title">Lekcie</h2>
              <p className="section-hd-sub">
                {hasStarted
                  ? `${completedCount} z ${typedLessons.length} dokončených`
                  : "Odporúčame ísť v poradí"
                }
              </p>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <GroupTrackPanel courseSlug="css" totalLessons={typedLessons.length} />
              <span className="section-hd-count">{typedLessons.length} lekcií</span>
            </div>
          </div>

          <div className="lessons-list">
            {typedLessons.map((lesson, idx) => {
              const p = progressMap.get(lesson.lesson_id);
              const isCompleted = p?.status === 'completed';
              const isActive = !isCompleted && lesson.lesson_id === lastLesson?.lesson_id && hasStarted;

              let cardClass = "lesson-card";
              if (isCompleted) cardClass += " lc-completed";
              else if (isActive) cardClass += " lc-active";

              return (
                <Link
                  key={lesson.id}
                  href={`/app/learning/css/${lesson.slug}`}
                  className={cardClass}
                >
                  {/* Číslo / check */}
                  {isCompleted ? (
                    <div className="lesson-check"><FiCheck size={12} /></div>
                  ) : (
                    <div className="lesson-num">{lesson.order}</div>
                  )}

                  {/* Body */}
                  <div className="lesson-body">
                    <div className="lesson-title">{lesson.title}</div>
                    <div className="lesson-summary">{lesson.summary}</div>
                  </div>

                  {/* Active badge */}
                  {isActive && (
                    <div className="active-badge" style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}><FiPlay size={9} /> Pokračuj</div>
                  )}

                  {/* Meta */}
                  <div className="lesson-meta">
                    <div className="lesson-badge" style={{ display: 'flex', alignItems: 'center', gap: 4 }}><FiClock size={12} /> {lesson.estimatedMinutes} min</div>
                    {isCompleted && p ? (
                      <div className={`xp-badge ${(p.xp_earned ?? 0) >= lesson.xp ? 'xp-badge-full' : 'xp-badge-partial'}`} style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
                        <FiZap size={10} /> {p.xp_earned ?? 0} / {lesson.xp} XP
                      </div>
                    ) : (
                      <div className="xp-badge" style={{ display: 'flex', alignItems: 'center', gap: 3 }}><FiZap size={10} /> {lesson.xp} XP</div>
                    )}
                    <span className="arrow-icon">›</span>
                  </div>
                </Link>
              );
            })}
          </div>
        </div>

        {/* ── Sticky CTA ── */}
        <div className="sticky-cta">
          <div className="sticky-cta-info">
            <div>
              <p className="sticky-cta-title">CSS - {typedLessons.length} lekcií</p>
              <p className="sticky-cta-sub">{minutesTotal} min · {xpTotal} XP celkovo</p>
            </div>
          </div>

          {hasStarted && (
            <div className="sticky-prog">
              <div className="sticky-prog-bar">
                <div className="sticky-prog-fill" style={{ width: `${progressPct}%` }} />
              </div>
              <span className="sticky-prog-pct">{progressPct}%</span>
            </div>
          )}

          <Link
            href={`/app/learning/css/${hasStarted ? lastLesson.slug : typedLessons[0].slug}`}
            className="sticky-btn"
          >
            {isFinished ? "Zopakovať kurz →" : hasStarted ? "Pokračovať →" : "Začať kurz →"}
          </Link>
        </div>
      </div>
    </>
  );
}

export const metadata = {
  title: "CSS kurz | KódujĽahko",
  description: "Nauč sa CSS od základov. Interaktívne lekcie, okamžitá spätná väzba.",
};