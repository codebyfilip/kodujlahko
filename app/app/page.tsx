import Link from 'next/link';
import { redirect } from 'next/navigation';
import { createClient } from '@/supabase/server';
import Navbar from '@/components/dashboard/NavBar';
import HomeOnboarding from './HomeOnboarding';
import WeeklyStatsCard from './WeeklyStatsCard';
import jsData   from './learning/javascript/js.json';
import htmlData from './learning/html/html.json';
import cssData  from './learning/css/css.json';
import {
  FiZap, FiBookOpen, FiUsers, FiAward, FiChevronRight,
  FiPlay, FiRotateCcw, FiTrendingUp, FiCode, FiGlobe,
  FiLayers, FiArrowRight, FiTarget,
} from 'react-icons/fi';
import { RiFireFill } from 'react-icons/ri';

interface Lesson { lesson_id: string; order: number; slug: string; title: string; xp: number; }
interface ProgressRow { lesson_id: string; course_slug: string; status: string; xp_earned: number | null; completed_at?: string | null; }

const COURSES = [
  { slug: 'html', title: 'HTML',       Icon: FiGlobe,  accent: '#DC2626', light: '#FFF4F0', border: '#FECACA', href: '/app/learning/html',       lessons: htmlData.lessons as Lesson[], desc: 'Základ každej webstránky' },
  { slug: 'css',  title: 'CSS',        Icon: FiLayers, accent: '#2563EB', light: '#EFF6FF', border: '#BFDBFE', href: '/app/learning/css',        lessons: cssData.lessons  as Lesson[], desc: 'Štýl, farby a animácie' },
  { slug: 'js',   title: 'JavaScript', Icon: FiCode,   accent: '#059669', light: '#F0FDF4', border: '#A7F3D0', href: '/app/learning/javascript', lessons: jsData.lessons   as Lesson[], desc: 'Logika a interaktivita' },
];

export default async function AppHomePage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const displayName =
    (user.user_metadata?.full_name as string | undefined) ||
    (user.user_metadata?.name as string | undefined) ||
    (user.user_metadata?.username as string | undefined) ||
    (user.email ? user.email.split('@')[0] : 'Používateľ');
  const firstName = displayName.split(' ')[0];
  const isOnboardingDone = !!(user.user_metadata?.onboarding_done);

  const createdAt = user.created_at ? new Date(user.created_at) : null;
  const isNewToday = createdAt ? createdAt.toDateString() === new Date().toDateString() : false;

  const userData = { name: displayName, email: user.email ?? '', avatar: (user.user_metadata?.avatar_url as string | undefined) || undefined };

  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();

  const [
    { data: progressRows },
    { data: profileStats },
    { data: challengeRows },
    { data: xpEventRows },
  ] = await Promise.all([
    supabase.from('user_lesson_progress').select('lesson_id, course_slug, status, xp_earned, completed_at').eq('user_id', user.id),
    supabase.from('profile_stats').select('total_xp, current_streak, longest_streak, last_activity_date').eq('user_id', user.id).maybeSingle(),
    supabase.from('user_challenge_progress').select('xp_earned').eq('user_id', user.id),
    supabase.from('xp_events').select('source_type, xp_amount, created_at').eq('user_id', user.id).gte('created_at', sevenDaysAgo),
  ]);

  const progress = (progressRows ?? []) as ProgressRow[];
  const progressMap = new Map(progress.map(p => [p.lesson_id, p]));
  const totalCompleted = progress.filter(p => p.status === 'completed').length;

  const lessonXpFallback = progress.reduce((s, p) => p.status === 'completed' ? s + (p.xp_earned ?? 0) : s, 0);
  const challengeXpFallback = (challengeRows ?? []).reduce((s, c) => s + ((c as { xp_earned: number }).xp_earned ?? 0), 0);
  const totalXP = profileStats?.total_xp ?? (lessonXpFallback + challengeXpFallback);
  const myStreak = profileStats?.current_streak ?? null;

  const courseStats = COURSES.map(course => {
    const completed = course.lessons.filter(l => progressMap.get(l.lesson_id)?.status === 'completed').length;
    const xpEarned  = course.lessons.reduce((s, l) => { const p = progressMap.get(l.lesson_id); return p?.status === 'completed' ? s + (p.xp_earned ?? 0) : s; }, 0);
    const inProgress = course.lessons.find(l => { const p = progressMap.get(l.lesson_id); return p && p.status !== 'completed'; });
    const notStarted = course.lessons.find(l => !progressMap.has(l.lesson_id));
    const nextLesson = inProgress ?? notStarted ?? null;
    return { course, completed, xpEarned, nextLesson };
  });

  const continueTarget = courseStats.find(c => c.completed < c.course.lessons.length) ?? null;

  const challengeEvents = (xpEventRows ?? [])
    .filter(e => (e as { source_type: string }).source_type === 'challenge' && (e as { created_at: string }).created_at)
    .map(e => ({ created_at: (e as { created_at: string }).created_at, xp: (e as { xp_amount: number }).xp_amount ?? 0 }));
  const dailyData = buildDailyBuckets(progress, challengeEvents, 7);
  const weekXP = dailyData.reduce((s, d) => s + d.xp, 0);
  const weekLessons = dailyData.reduce((s, d) => s + d.lessons, 0);

  const hasChallengeAttempt = (challengeRows ?? []).length > 0;

  const lowXpLessons: { title: string; href: string; xpEarned: number; xpMax: number; Icon: typeof FiCode; accent: string }[] = [];
  for (const { course } of courseStats) {
    for (const lesson of course.lessons) {
      const p = progressMap.get(lesson.lesson_id);
      if (p?.status === 'completed' && (p.xp_earned ?? 0) < lesson.xp * 0.7) {
        lowXpLessons.push({ title: lesson.title, href: `${course.href}/${lesson.slug}`, xpEarned: p.xp_earned ?? 0, xpMax: lesson.xp, Icon: course.Icon, accent: course.accent });
        if (lowXpLessons.length >= 4) break;
      }
    }
    if (lowXpLessons.length >= 4) break;
  }

  const { data: membershipRaw } = await supabase
    .from('group_members')
    .select('group_id, groups(name)')
    .eq('user_id', user.id).eq('status', 'active').maybeSingle();

  let groupName: string | null = null;
  let groupLeaderboard: { user_id: string; display_name: string | null; total_xp: number }[] = [];

  if (membershipRaw) {
    groupName = (membershipRaw.groups as unknown as { name: string } | null)?.name ?? null;
    const { data: lb } = await supabase
      .from('group_leaderboard')
      .select('user_id, display_name, total_xp, current_streak')
      .eq('group_id', membershipRaw.group_id)
      .order('total_xp', { ascending: false })
      .limit(5);
    groupLeaderboard = (lb ?? []) as typeof groupLeaderboard;
  }

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&family=Nunito:wght@400;600;700;800;900&display=swap');
        .hp { font-family:'Inter',sans-serif; min-height:100vh; background:#F8F9FB; padding-top:72px; color:#0F172A; }
        .hp *,.hp *::before,.hp *::after { box-sizing:border-box; }
        .hw { max-width:1080px; margin:0 auto; padding:0 24px 80px; }
        .card { background:#fff; border:1px solid #E8ECF0; border-radius:18px; padding:22px; }
        .page-grid { display:grid; grid-template-columns:1fr 300px; gap:16px; align-items:start; }
        .col { display:flex; flex-direction:column; gap:16px; }
        .ql-link { display:flex; align-items:center; gap:10px; padding:9px 10px; border-radius:10px; color:#334155; text-decoration:none; font-size:13px; font-weight:500; transition:background .12s; }
        .ql-link:hover { background:#F5F3FF; color:#7C3AED; }
        .course-row { display:flex; align-items:center; gap:14px; padding:14px 16px; border-radius:14px; border:1px solid #F1F5F9; background:#FAFAFA; transition:all .2s; cursor:pointer; text-decoration:none; }
        .course-row:hover { background:#F5F3FF; border-color:#DDD6FE; transform:translateY(-1px); }
        @media(max-width:860px) { .page-grid { grid-template-columns:1fr; } }
        @media(max-width:640px) { .hw { padding:0 16px 60px; } }
      `}</style>

      <Navbar user={userData} />
      {!isOnboardingDone && <HomeOnboarding name={firstName} />}

      <div className="hp">
        <div className="hw">

          {/* HERO */}
          <div style={{ padding: '48px 0 28px' }}>
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, background: 'linear-gradient(135deg,#EDE9FF 0%,#F3E8FF 100%)', border: '1px solid #D8B4FE', borderRadius: 100, padding: '6px 14px', fontSize: 12, fontWeight: 700, color: '#7361FF', letterSpacing: '0.05em', textTransform: 'uppercase', marginBottom: 20, fontFamily: "'Nunito', sans-serif" }}>
              {isNewToday ? '👋 Vitaj' : '👋 Vitaj späť'}
            </div>
            <h1 style={{ fontFamily: "'Nunito', sans-serif", fontSize: 'clamp(32px,5vw,56px)', fontWeight: 900, color: '#111', lineHeight: 1.1, letterSpacing: '-0.03em', margin: '0 0 16px' }}>
              {isNewToday ? 'Vitaj, ' : 'Vitaj späť, '}
              <span style={{ background: 'linear-gradient(135deg,#7361FF 0%,#A855F7 50%,#EC4899 100%)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text' }}>
                {firstName}
              </span>
            </h1>
            <p style={{ fontFamily: "'Nunito', sans-serif", fontSize: 16, color: '#6B7280', lineHeight: 1.7, margin: '0 0 24px', maxWidth: 440 }}>
              Vyber si, čo sa chceš naučiť
            </p>
            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, background: '#fff', border: '1px solid #E8ECF0', borderRadius: 14, padding: '12px 18px', boxShadow: '0 1px 4px rgba(0,0,0,0.04)' }}>
                <div style={{ width: 36, height: 36, borderRadius: 10, background: 'linear-gradient(135deg,#7C3AED,#4F46E5)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <FiZap size={16} color="#fff" />
                </div>
                <div>
                  <div style={{ fontSize: 20, fontWeight: 800, color: '#0F172A', lineHeight: 1 }}>{totalXP}</div>
                  <div style={{ fontSize: 11, color: '#94A3B8', marginTop: 2 }}>XP celkovo</div>
                </div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, background: '#fff', border: '1px solid #E8ECF0', borderRadius: 14, padding: '12px 18px', boxShadow: '0 1px 4px rgba(0,0,0,0.04)' }}>
                <div style={{ width: 36, height: 36, borderRadius: 10, background: 'linear-gradient(135deg,#059669,#10B981)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <FiBookOpen size={16} color="#fff" />
                </div>
                <div>
                  <div style={{ fontSize: 20, fontWeight: 800, color: '#0F172A', lineHeight: 1 }}>{totalCompleted}</div>
                  <div style={{ fontSize: 11, color: '#94A3B8', marginTop: 2 }}>Lekcií hotových</div>
                </div>
              </div>
              {myStreak != null && myStreak > 0 && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, background: '#fff', border: '1px solid #E8ECF0', borderRadius: 14, padding: '12px 18px', boxShadow: '0 1px 4px rgba(0,0,0,0.04)' }}>
                  <div style={{ width: 36, height: 36, borderRadius: 10, background: 'linear-gradient(135deg,#EA580C,#F97316)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <RiFireFill size={16} color="#fff" />
                  </div>
                  <div>
                    <div style={{ fontSize: 20, fontWeight: 800, color: '#0F172A', lineHeight: 1 }}>{myStreak}</div>
                    <div style={{ fontSize: 11, color: '#94A3B8', marginTop: 2 }}>Dní streak</div>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* POKRAČUJ */}
          {continueTarget?.nextLesson && (
            <Link href={`${continueTarget.course.href}/${continueTarget.nextLesson.slug}`} style={{ textDecoration: 'none', display: 'block', marginBottom: 16 }}>
              <div style={{ background: 'linear-gradient(135deg,#7C3AED 0%,#4F46E5 100%)', borderRadius: 18, padding: '20px 24px', display: 'flex', alignItems: 'center', gap: 14, cursor: 'pointer', boxShadow: '0 6px 24px rgba(124,58,237,0.25)' }}>
                <div style={{ width: 46, height: 46, borderRadius: 13, background: 'rgba(255,255,255,0.18)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <FiPlay size={20} color="#fff" />
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 11, fontWeight: 600, color: 'rgba(255,255,255,0.6)', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 4 }}>
                    {totalCompleted > 0 ? 'Pokračuj kde si skončil' : 'Začni tu'} · {continueTarget.course.title}
                  </div>
                  <div style={{ fontSize: 17, fontWeight: 700, color: '#fff', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {continueTarget.nextLesson.title}
                  </div>
                </div>
                <FiArrowRight size={20} color="rgba(255,255,255,0.6)" style={{ flexShrink: 0 }} />
              </div>
            </Link>
          )}

          <div className="page-grid">
            {/* ĽAVÝ STĹPEC */}
            <div className="col">

              {/* Postup v kurzoch */}
              <div className="card">
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 20 }}>
                  <div style={{ width: 28, height: 28, borderRadius: 8, background: '#F5F3FF', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <FiTrendingUp size={14} color="#7C3AED" />
                  </div>
                  <span style={{ fontSize: 14, fontWeight: 700, color: '#0F172A' }}>Postup v kurzoch</span>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {courseStats.map(({ course, completed, xpEarned }) => {
                    const pct = course.lessons.length > 0 ? Math.round((completed / course.lessons.length) * 100) : 0;
                    return (
                      <Link key={course.slug} href={course.href} className="course-row">
                        <div style={{ width: 44, height: 44, borderRadius: 12, background: course.light, border: `1.5px solid ${course.border}`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                          <course.Icon size={20} color={course.accent} />
                        </div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 8 }}>
                            <div>
                              <span style={{ fontSize: 14, fontWeight: 700, color: '#0F172A' }}>{course.title}</span>
                              <span style={{ fontSize: 11, color: '#94A3B8', marginLeft: 8 }}>{course.desc}</span>
                            </div>
                            <span style={{ fontSize: 11, color: '#94A3B8', flexShrink: 0, marginLeft: 8 }}>{xpEarned} XP</span>
                          </div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                            <div style={{ flex: 1, height: 6, background: '#E8ECF0', borderRadius: 100, overflow: 'hidden' }}>
                              <div style={{ height: '100%', width: `${pct}%`, background: pct === 100 ? 'linear-gradient(90deg,#059669,#34D399)' : `linear-gradient(90deg,${course.accent},${course.accent}99)`, borderRadius: 100, transition: 'width 0.6s ease' }} />
                            </div>
                            <span style={{ fontSize: 11, color: '#64748B', flexShrink: 0 }}>{completed}/{course.lessons.length}</span>
                          </div>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 2, flexShrink: 0 }}>
                          <span style={{ fontSize: 13, fontWeight: 700, color: pct === 100 ? '#059669' : '#7C3AED' }}>{pct}%</span>
                          <FiChevronRight size={14} color="#CBD5E1" />
                        </div>
                      </Link>
                    );
                  })}
                </div>
              </div>

              {/* Výzvy CTA */}
              <Link href="/app/challenges" style={{ textDecoration: 'none', display: 'block' }}>
                <div style={{ background: 'linear-gradient(135deg,#0F172A 0%,#1E1B4B 60%,#312E81 100%)', borderRadius: 18, padding: '20px 22px', display: 'flex', alignItems: 'center', gap: 16, cursor: 'pointer', boxShadow: '0 6px 24px rgba(15,23,42,0.15)' }}>
                  <div style={{ width: 48, height: 48, borderRadius: 14, background: 'rgba(255,255,255,0.1)', border: '1px solid rgba(255,255,255,0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    <FiTarget size={22} color="#A78BFA" />
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 11, fontWeight: 600, color: 'rgba(255,255,255,0.45)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 3 }}>
                      {hasChallengeAttempt ? 'Pokračuj vo výzvach' : 'Pripravený na výzvu?'}
                    </div>
                    <div style={{ fontSize: 16, fontWeight: 800, color: '#fff', marginBottom: 2 }}>
                      {hasChallengeAttempt ? 'Máš rozrobenú výzvu' : 'Vyskúšaj si výzvy'}
                    </div>
                    <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.45)' }}>
                      {hasChallengeAttempt ? 'Vráť sa a dokonči ju' : 'Solo výzvy · Získaj extra XP'}
                    </div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '8px 14px', background: 'rgba(255,255,255,0.1)', borderRadius: 10, border: '1px solid rgba(255,255,255,0.12)', flexShrink: 0 }}>
                    <span style={{ fontSize: 12, fontWeight: 700, color: '#fff' }}>{hasChallengeAttempt ? 'Pokračovať' : 'Začať'}</span>
                    <FiArrowRight size={13} color="#A78BFA" />
                  </div>
                </div>
              </Link>

              {/* Zlepši svoje skóre */}
              {lowXpLessons.length > 0 && (
                <div className="card">
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                    <div style={{ width: 28, height: 28, borderRadius: 8, background: '#F5F3FF', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <FiRotateCcw size={14} color="#7C3AED" />
                    </div>
                    <span style={{ fontSize: 14, fontWeight: 700, color: '#0F172A' }}>Zlepši svoje skóre</span>
                  </div>
                  <p style={{ fontSize: 12, color: '#94A3B8', margin: '0 0 14px', lineHeight: 1.5 }}>Tieto lekcie si dokončil s nízkym XP — vráť sa a získaj maximum.</p>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    {lowXpLessons.map(l => {
                      const pct = Math.round((l.xpEarned / l.xpMax) * 100);
                      return (
                        <Link key={l.href} href={l.href} style={{ textDecoration: 'none', display: 'flex', alignItems: 'center', gap: 12, padding: '12px 14px', borderRadius: 12, background: '#F8F7FF', border: '1.5px solid #EDE9FE', transition: 'all .15s', cursor: 'pointer' }}>
                          <div style={{ width: 36, height: 36, borderRadius: 10, background: '#EDE9FE', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                            <l.Icon size={16} color={l.accent} />
                          </div>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ fontSize: 13, fontWeight: 600, color: '#0F172A', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', marginBottom: 6 }}>{l.title}</div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                              <div style={{ flex: 1, height: 4, background: '#DDD6FE', borderRadius: 100, overflow: 'hidden' }}>
                                <div style={{ height: '100%', width: `${pct}%`, background: 'linear-gradient(90deg,#7C3AED,#8B5CF6)', borderRadius: 100 }} />
                              </div>
                              <span style={{ fontSize: 11, fontWeight: 600, color: '#7C3AED', flexShrink: 0 }}>{l.xpEarned}/{l.xpMax} XP</span>
                            </div>
                          </div>
                          <FiChevronRight size={15} color="#A78BFA" style={{ flexShrink: 0 }} />
                        </Link>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>

            {/* PRAVÝ STĹPEC */}
            <div className="col">

              <WeeklyStatsCard
                dailyData={dailyData}
                weekXP={weekXP}
                weekLessons={weekLessons}
                streak={myStreak}
              />

              {/* Skupina */}
              {groupLeaderboard.length > 0 ? (
                <div className="card">
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <div style={{ width: 28, height: 28, borderRadius: 8, background: '#FFF7ED', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <FiAward size={14} color="#EA580C" />
                      </div>
                      <div>
                        <div style={{ fontSize: 13, fontWeight: 700, color: '#0F172A' }}>{groupName ?? 'Skupina'}</div>
                        <div style={{ fontSize: 11, color: '#94A3B8' }}>Leaderboard</div>
                      </div>
                    </div>
                    <Link href="/app/group" style={{ fontSize: 12, fontWeight: 600, color: '#7C3AED', textDecoration: 'none', display: 'flex', alignItems: 'center', gap: 2 }}>
                      Celý <FiChevronRight size={13} />
                    </Link>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                    {groupLeaderboard.map((entry, idx) => {
                      const isMe = entry.user_id === user.id;
                      const name = entry.display_name ?? 'Neznámy';
                      const rankColor = idx === 0 ? '#EA580C' : idx === 1 ? '#94A3B8' : idx === 2 ? '#B45309' : '#CBD5E1';
                      return (
                        <div key={entry.user_id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 10px', borderRadius: 10, background: isMe ? '#F5F3FF' : '#F8F9FB', border: `1px solid ${isMe ? '#DDD6FE' : 'transparent'}` }}>
                          <span style={{ fontSize: 11, width: 18, textAlign: 'center', fontWeight: 700, color: rankColor, flexShrink: 0 }}>{idx + 1}</span>
                          <div style={{ width: 26, height: 26, borderRadius: '50%', background: isMe ? 'linear-gradient(135deg,#7C3AED,#4F46E5)' : '#E2E8F0', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, fontWeight: 700, color: isMe ? '#fff' : '#64748B', flexShrink: 0 }}>
                            {name.charAt(0).toUpperCase()}
                          </div>
                          <span style={{ flex: 1, fontSize: 12, fontWeight: isMe ? 700 : 500, color: isMe ? '#7C3AED' : '#334155', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {name}
                          </span>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 3, flexShrink: 0 }}>
                            <FiZap size={10} color="#7C3AED" />
                            <span style={{ fontSize: 12, fontWeight: 700, color: '#0F172A' }}>{entry.total_xp}</span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ) : (
                <Link href="/app/group" style={{ textDecoration: 'none' }}>
                  <div className="card" style={{ cursor: 'pointer' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
                      <div style={{ width: 38, height: 38, borderRadius: 10, background: '#F5F3FF', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <FiUsers size={18} color="#7C3AED" />
                      </div>
                      <span style={{ fontSize: 13, fontWeight: 700, color: '#0F172A' }}>Pridaj sa do skupiny</span>
                    </div>
                    <p style={{ fontSize: 12, color: '#64748B', margin: '0 0 12px', lineHeight: 1.5 }}>
                      Súťaž s kamarátmi, porovnávaj XP a sleduj leaderboard.
                    </p>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 12, fontWeight: 600, color: '#7C3AED' }}>
                      Pozrieť skupiny <FiChevronRight size={13} />
                    </div>
                  </div>
                </Link>
              )}

              {/* Rýchly prístup */}
              <div className="card">
                <div style={{ fontSize: 11, fontWeight: 700, color: '#94A3B8', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 8 }}>Rýchly prístup</div>
                {COURSES.map(c => (
                  <Link key={c.slug} href={c.href} className="ql-link">
                    <div style={{ width: 24, height: 24, borderRadius: 6, background: c.light, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                      <c.Icon size={13} color={c.accent} />
                    </div>
                    <span>{c.title}</span>
                    <span style={{ marginLeft: 'auto', fontSize: 11, color: '#94A3B8' }}>
                      {courseStats.find(s => s.course.slug === c.slug)?.completed ?? 0}/{c.lessons.length}
                    </span>
                  </Link>
                ))}
                <Link href="/app/challenges" className="ql-link">
                  <div style={{ width: 24, height: 24, borderRadius: 6, background: '#F5F3FF', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    <FiTarget size={13} color="#7C3AED" />
                  </div>
                  <span>Výzvy</span>
                </Link>
                <Link href="/app/group" className="ql-link">
                  <div style={{ width: 24, height: 24, borderRadius: 6, background: '#F0FDF4', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    <FiUsers size={13} color="#059669" />
                  </div>
                  <span>Skupiny</span>
                </Link>
              </div>
            </div>
          </div>


        </div>
      </div>
    </>
  );
}

function buildDailyBuckets(
  progress: ProgressRow[],
  challengeEvents: { created_at: string; xp: number }[],
  days: number,
): { label: string; fullDate: string; xp: number; lessons: number }[] {
  const buckets = Array.from({ length: days }, (_, i) => {
    const d = new Date();
    d.setDate(d.getDate() - (days - 1 - i));
    d.setHours(0, 0, 0, 0);
    const end = new Date(d);
    end.setDate(d.getDate() + 1);
    const day = d.getDate();
    const month = d.getMonth() + 1;
    const weekdays = ['Ne', 'Po', 'Ut', 'St', 'Št', 'Pi', 'So'];
    return { label: weekdays[d.getDay()], fullDate: `${day}.${month}.`, xp: 0, lessons: 0, start: d, end };
  });

  for (const p of progress) {
    if (!p.completed_at || p.status !== 'completed') continue;
    const date = new Date(p.completed_at);
    for (const bucket of buckets) {
      if (date >= bucket.start && date < bucket.end) {
        bucket.xp += p.xp_earned ?? 0;
        bucket.lessons += 1;
        break;
      }
    }
  }

  for (const ev of challengeEvents) {
    const date = new Date(ev.created_at);
    for (const bucket of buckets) {
      if (date >= bucket.start && date < bucket.end) {
        bucket.xp += ev.xp;
        break;
      }
    }
  }

  return buckets.map(({ label, fullDate, xp, lessons }) => ({ label, fullDate, xp, lessons }));
}
