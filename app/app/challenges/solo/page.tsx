import { redirect } from 'next/navigation';
import { createClient } from '@/supabase/server';
import Navbar from '@/components/dashboard/NavBar';
import challengesData from '../solo-vyzvy-v2.json';
import SoloChallengesClient from './SoloChallengesClient';

export interface Challenge {
  id: string;
  category: 'html' | 'html+css' | 'html+css+js' | 'javascript';
  order: number;
  difficulty: 'easy' | 'medium' | 'hard';
  xp_reward: number;
  estimated_minutes: number;
  title: string;
  description: string;
  instructions: string[];
  starter_code: { html: string; css: string; js: string };
  target_preview: { html: string; css: string; js: string } | null;
  validation: {
    min_score_to_pass: number;
    css_battle?: boolean;
    css_battle_selectors?: string[];
    css_battle_properties?: string[];
    css_battle_points?: number;
    html?: Record<string, unknown>;
    css?: Record<string, unknown>;
    js?: Record<string, unknown>;
  };
}

export interface ChallengeProgress {
  challenge_id: string;
  status: 'started' | 'completed';
  best_score: number;
  xp_earned: number;
  best_time_seconds: number | null;
  attempts: number;
}

export default async function SoloChallengesPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const userData = {
    name:
      (user.user_metadata?.full_name as string | undefined) ||
      (user.user_metadata?.name as string | undefined) ||
      (user.email ? user.email.split('@')[0] : 'Používateľ'),
    email: user.email ?? '',
    avatar: (user.user_metadata?.avatar_url as string | undefined) || undefined,
  };

  const challenges = challengesData.challenges as Challenge[];

  // Fetch progress — gracefully handle missing table
  const { data: progressRows } = await supabase
    .from('user_challenge_progress')
    .select('challenge_id, status, best_score, xp_earned, best_time_seconds, attempts')
    .eq('user_id', user.id);

  const progressMap = new Map<string, ChallengeProgress>(
    (progressRows ?? []).map(r => [r.challenge_id, r as ChallengeProgress])
  );

  // Stats
  const completed = challenges.filter(c => progressMap.get(c.id)?.status === 'completed').length;
  const totalXP = Array.from(progressMap.values()).reduce((s, p) => s + (p.xp_earned ?? 0), 0);

  const progressData = Object.fromEntries(progressMap);

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Nunito:wght@400;600;700;800;900&family=Sora:wght@300;400;500;600&display=swap');
        :root {
          --brand:#7361FF; --brand-2:#8C78FF; --brand-light:#EDE9FF; --brand-mid:#C4B5FD;
          --success:#10B981; --warn:#F59E0B; --danger:#EF4444;
          --bg:#F7F7FB; --surface:#FFFFFF; --border:#E8E6F0;
          --text:#111118; --muted:#6B7280; --faint:#9CA3AF;
        }
        .sp { font-family:'Sora',sans-serif; min-height:100vh; background:var(--bg); padding-top:80px; color:var(--text); }
        .sp *,.sp *::before,.sp *::after { box-sizing:border-box; }
        .sw { max-width:1100px; margin:0 auto; padding:0 24px 100px; }
      `}</style>

      <Navbar user={userData} />

      <div className="sp">
        <div className="sw">
          <SoloChallengesClient
            challenges={challenges}
            progressData={progressData}
            completed={completed}
            totalXP={totalXP}
            totalCount={challenges.length}
          />
        </div>
      </div>
    </>
  );
}

export const metadata = { title: 'Sólo výzvy | KódujĽahko' };
