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
  Zap, BookOpen, Users, Trophy, ChevronRight,
  Play, RotateCcw, TrendingUp, Code2, Globe, Palette,
  Flame, BarChart3, ArrowRight,
} from 'lucide-react';

interface Lesson { lesson_id: string; order: number; slug: string; title: string; xp: number; }
interface ProgressRow { lesson_id: string; course_slug: string; status: string; xp_earned: number | null; completed_at?: string | null; }

const COURSES = [
  { slug: 'html', title: 'HTML',       Icon: Globe,   accent: '#DC2626', bg: '#FFF4F0', border: '#FECACA', href: '/app/learning/html',       lessons: htmlData.lessons as Lesson[], desc: 'Základ každej webstránky' },
  { slug: 'css',  title: 'CSS',        Icon: Palette, accent: '#2563EB', bg: '#EFF6FF', border: '#BFDBFE', href: '/app/learning/css',        lessons: cssData.lessons  as Lesson[], desc: 'Štýl, farby a animácie' },
  { slug: 'js',   title: 'JavaScript', Icon: Code2,   accent: '#D97706', bg: '#FFFBEB', border: '#FDE68A', href: '/app/learning/javascript', lessons: jsData.lessons   as Lesson[], desc: 'Logika a interaktivita' },
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

  // 7 dní dozadu pre xp_events filter
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();

  const [
    { data: progressRows },
    { data: profileStats },
    { data: challengeRows },
    { data: xpEventRows },
  ] = await Promise.all([
    supabase
      .from('user_lesson_progress')
      .select('lesson_id, course_slug, status, xp_earned, completed_at')
      .eq('user_id', user.id),
    supabase
      .from('profile_stats')
      .select('total_xp, current_streak, longest_streak, last_activity_date')
      .eq('user_id', user.id)
      .maybeSingle(),
    supabase
      .from('user_challenge_progress')
      .select('xp_earned')
      .eq('user_id', user.id),
    supabase
      .from('xp_events')
      .select('source_type, xp_amount, created_at')
      .eq('user_id', user.id)
      .gte('created_at', sevenDaysAgo),
  ]);

  const progress = (progressRows ?? []) as ProgressRow[];
  const progressMap = new Map(progress.map(p => [p.lesson_id, p]));
  const totalCompleted = progress.filter(p => p.status === 'completed').length;

  // XP: profile_stats je kanonický zdroj (zahŕňa lekcie aj výzvy).
  // Fallback: sum z lekciových záznamov + challenge záznamy.
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

  // Striktné poradie HTML → CSS → JS: prvý kurz ktorý nie je 100% dokončený
  const continueTarget = courseStats.find(c => c.completed < c.course.lessons.length) ?? null;

  // Denné dáta: lekcie + challenge XP events za posledných 7 dní
  const challengeEvents = (xpEventRows ?? [])
    .filter(e => (e as { source_type: string }).source_type === 'challenge' && (e as { created_at: string }).created_at)
    .map(e => ({ created_at: (e as { created_at: string }).created_at, xp: (e as { xp_amount: number }).xp_amount ?? 0 }));
  const dailyData = buildDailyBuckets(progress, challengeEvents, 7);
  const weekXP = dailyData.reduce((s, d) => s + d.xp, 0);
  const weekLessons = dailyData.reduce((s, d) => s + d.lessons, 0);

  // Low XP lekcie
  const lowXpLessons: { title: string; href: string; xpEarned: number; xpMax: number; Icon: typeof Code2; accent: string }[] = [];
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

  // Skupina
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
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap');
        .hp { font-family:'Inter',sans-serif; min-height:100vh; background:#ffffff; padding-top:72px; color:#0F172A; }
        .hp *,.hp *::before,.hp *::after { box-sizing:border-box; }
        .hw { max-width:1080px; margin:0 auto; padding:0 24px 80px; }
        .card { background:#fff; border:1px solid #E2E8F0; border-radius:16px; padding:24px; }
        .page-grid { display:grid; grid-template-columns:1fr 300px; gap:16px; align-items:start; }
        .col { display:flex; flex-direction:column; gap:16px; }
        .ql-link { display:flex; align-items:center; gap:10px; padding:8px 10px; border-radius:8px; color:#334155; text-decoration:none; font-size:13px; font-weight:500; transition:background .12s; }
        .ql-link:hover { background:#F5F3FF; }
        .course-row { display:flex; align-items:center; gap:12px; padding:12px 14px; border-radius:12px; border:1px solid #F1F5F9; background:#FAFAFA; transition:border-color .12s, background .12s; }
        .course-row:hover { background:#F5F3FF; border-color:#DDD6FE; }
        @media(max-width:860px) { .page-grid { grid-template-columns:1fr; } }
        @media(max-width:640px) { .hw { padding:0 16px 60px; } }
      `}</style>

      <Navbar user={userData} />
      {!isOnboardingDone && <HomeOnboarding name={firstName} />}

      <div className="hp">
        <div className="hw">

          {/* HERO */}
          <div style={{ padding: '32px 0 20px' }}>
            <h1 style={{ fontSize: 'clamp(20px,3vw,28px)', fontWeight: 800, color: '#0F172A', margin: '0 0 16px', letterSpacing: '-0.4px' }}>
              {isNewToday ? `Vitaj, ${firstName}` : `Vitaj späť, ${firstName}`}
            </h1>
            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, background: '#fff', border: '1px solid #E2E8F0', borderRadius: 12, padding: '10px 16px' }}>
                <div style={{ width: 32, height: 32, borderRadius: 8, background: '#F5F3FF', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Zap size={15} color="#7C3AED" />
                </div>
                <div>
                  <div style={{ fontSize: 18, fontWeight: 800, color: '#0F172A', lineHeight: 1 }}>{totalXP}</div>
                  <div style={{ fontSize: 11, color: '#94A3B8', marginTop: 2 }}>XP celkovo</div>
                </div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, background: '#fff', border: '1px solid #E2E8F0', borderRadius: 12, padding: '10px 16px' }}>
                <div style={{ width: 32, height: 32, borderRadius: 8, background: '#F0FDF4', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <BookOpen size={15} color="#16A34A" />
                </div>
                <div>
                  <div style={{ fontSize: 18, fontWeight: 800, color: '#0F172A', lineHeight: 1 }}>{totalCompleted}</div>
                  <div style={{ fontSize: 11, color: '#94A3B8', marginTop: 2 }}>Lekcií hotových</div>
                </div>
              </div>
              {myStreak != null && myStreak > 0 && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, background: '#fff', border: '1px solid #E2E8F0', borderRadius: 12, padding: '10px 16px' }}>
                  <div style={{ width: 32, height: 32, borderRadius: 8, background: '#FFF7ED', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <Flame size={15} color="#EA580C" />
                  </div>
                  <div>
                    <div style={{ fontSize: 18, fontWeight: 800, color: '#0F172A', lineHeight: 1 }}>{myStreak}</div>
                    <div style={{ fontSize: 11, color: '#94A3B8', marginTop: 2 }}>Dní streak</div>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* POKRAČUJ */}
          {continueTarget?.nextLesson && (
            <Link href={`${continueTarget.course.href}/${continueTarget.nextLesson.slug}`} style={{ textDecoration: 'none', display: 'block', marginBottom: 16 }}>
              <div style={{ background: 'linear-gradient(135deg,#7C3AED 0%,#4F46E5 100%)', borderRadius: 16, padding: '18px 22px', display: 'flex', alignItems: 'center', gap: 14, cursor: 'pointer' }}>
                <div style={{ width: 42, height: 42, borderRadius: 12, background: 'rgba(255,255,255,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <Play size={18} color="#fff" fill="#fff" />
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 11, fontWeight: 600, color: 'rgba(255,255,255,0.6)', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 3 }}>
                    {totalCompleted > 0 ? 'Pokračuj kde si skončil' : 'Začni tu'} · {continueTarget.course.title}
                  </div>
                  <div style={{ fontSize: 16, fontWeight: 700, color: '#fff', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {continueTarget.nextLesson.title}
                  </div>
                </div>
                <ArrowRight size={18} color="rgba(255,255,255,0.6)" style={{ flexShrink: 0 }} />
              </div>
            </Link>
          )}

          <div className="page-grid">
            {/* ĽAVÝ STĹPEC */}
            <div className="col">

              {/* Kurzy */}
              <div className="card">
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 18 }}>
                  <TrendingUp size={15} color="#7C3AED" />
                  <span style={{ fontSize: 13, fontWeight: 700, color: '#0F172A' }}>Postup v kurzoch</span>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                  {courseStats.map(({ course, completed, xpEarned }) => {
                    const pct = course.lessons.length > 0 ? Math.round((completed / course.lessons.length) * 100) : 0;
                    return (
                      <Link key={course.slug} href={course.href} style={{ textDecoration: 'none', display: 'block' }}>
                        <div className="course-row">
                          <div style={{ width: 38, height: 38, borderRadius: 10, background: course.bg, border: `1px solid ${course.border}`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                            <course.Icon size={18} color={course.accent} />
                          </div>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 7 }}>
                              <span style={{ fontSize: 13, fontWeight: 600, color: '#0F172A' }}>{course.title}</span>
                              <span style={{ fontSize: 11, color: '#94A3B8' }}>{completed}/{course.lessons.length} lekcií · {xpEarned} XP</span>
                            </div>
                            <div style={{ height: 5, background: '#E2E8F0', borderRadius: 100, overflow: 'hidden' }}>
                              <div style={{ height: '100%', width: `${pct}%`, background: pct === 100 ? 'linear-gradient(90deg,#10B981,#34D399)' : `linear-gradient(90deg,${course.accent}CC,${course.accent}88)`, borderRadius: 100, transition: 'width 0.6s ease' }} />
                            </div>
                          </div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 4, flexShrink: 0, marginLeft: 4 }}>
                            <span style={{ fontSize: 12, fontWeight: 700, color: pct === 100 ? '#10B981' : '#7C3AED' }}>{pct}%</span>
                            <ChevronRight size={14} color="#CBD5E1" />
                          </div>
                        </div>
                      </Link>
                    );
                  })}
                </div>
              </div>

              {/* Low XP lekcie */}
              {lowXpLessons.length > 0 && (
                <div className="card">
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                    <RotateCcw size={15} color="#D97706" />
                    <span style={{ fontSize: 13, fontWeight: 700, color: '#0F172A' }}>Zlepši svoje skóre</span>
                  </div>
                  <p style={{ fontSize: 12, color: '#94A3B8', margin: '0 0 14px' }}>Tieto lekcie si dokončil s nízkym XP — vráť sa a získaj maximum.</p>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    {lowXpLessons.map(l => {
                      const pct = Math.round((l.xpEarned / l.xpMax) * 100);
                      return (
                        <Link key={l.href} href={l.href} style={{ textDecoration: 'none', display: 'flex', alignItems: 'center', gap: 12, padding: '12px 14px', borderRadius: 12, background: '#FFFBEB', border: '1px solid #FDE68A', transition: 'border-color .12s' }}>
                          <div style={{ width: 34, height: 34, borderRadius: 9, background: '#FEF3C7', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                            <l.Icon size={15} color={l.accent} />
                          </div>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ fontSize: 13, fontWeight: 600, color: '#0F172A', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', marginBottom: 5 }}>{l.title}</div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                              <div style={{ flex: 1, height: 4, background: '#FDE68A', borderRadius: 100, overflow: 'hidden' }}>
                                <div style={{ height: '100%', width: `${pct}%`, background: '#D97706', borderRadius: 100 }} />
                              </div>
                              <span style={{ fontSize: 11, fontWeight: 600, color: '#92400E', flexShrink: 0 }}>{l.xpEarned}/{l.xpMax} XP</span>
                            </div>
                          </div>
                          <ChevronRight size={15} color="#D97706" style={{ flexShrink: 0 }} />
                        </Link>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>

            {/* PRAVÝ STĹPEC */}
            <div className="col">

              {/* Týždenné štatistiky */}
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
                      <Trophy size={15} color="#D97706" />
                      <div>
                        <div style={{ fontSize: 13, fontWeight: 700, color: '#0F172A' }}>{groupName ?? 'Skupina'}</div>
                        <div style={{ fontSize: 11, color: '#94A3B8' }}>Leaderboard</div>
                      </div>
                    </div>
                    <Link href="/app/group" style={{ fontSize: 12, fontWeight: 600, color: '#7C3AED', textDecoration: 'none', display: 'flex', alignItems: 'center', gap: 2 }}>
                      Celý <ChevronRight size={13} />
                    </Link>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                    {groupLeaderboard.map((entry, idx) => {
                      const isMe = entry.user_id === user.id;
                      const name = entry.display_name ?? 'Neznámy';
                      const rankColor = idx === 0 ? '#D97706' : idx === 1 ? '#94A3B8' : idx === 2 ? '#B45309' : '#CBD5E1';
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
                            <Zap size={10} color="#7C3AED" />
                            <span style={{ fontSize: 12, fontWeight: 700, color: '#0F172A' }}>{entry.total_xp}</span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ) : (
                <Link href="/app/group" style={{ textDecoration: 'none' }}>
                  <div className="card" style={{ cursor: 'pointer', transition: 'border-color .15s' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
                      <div style={{ width: 38, height: 38, borderRadius: 10, background: '#F5F3FF', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <Users size={18} color="#7C3AED" />
                      </div>
                      <span style={{ fontSize: 13, fontWeight: 700, color: '#0F172A' }}>Pridaj sa do skupiny</span>
                    </div>
                    <p style={{ fontSize: 12, color: '#64748B', margin: '0 0 12px', lineHeight: 1.5 }}>
                      Súťaž s kamarátmi, porovnávaj XP a sleduj leaderboard.
                    </p>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 12, fontWeight: 600, color: '#7C3AED' }}>
                      Pozrieť skupiny <ChevronRight size={13} />
                    </div>
                  </div>
                </Link>
              )}

              {/* Quick links */}
              <div className="card">
                <div style={{ fontSize: 11, fontWeight: 700, color: '#94A3B8', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 8 }}>Rýchly prístup</div>
                {COURSES.map(c => (
                  <Link key={c.slug} href={c.href} className="ql-link">
                    <c.Icon size={14} color={c.accent} />
                    <span>{c.title}</span>
                    <span style={{ marginLeft: 'auto', fontSize: 11, color: '#94A3B8' }}>
                      {courseStats.find(s => s.course.slug === c.slug)?.completed ?? 0}/{c.lessons.length}
                    </span>
                  </Link>
                ))}
                <Link href="/app/group" className="ql-link">
                  <Users size={14} color="#7C3AED" />
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
