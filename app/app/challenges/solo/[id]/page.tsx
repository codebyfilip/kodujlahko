import { notFound, redirect } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@/supabase/server';
import Navbar from '@/components/dashboard/NavBar';
import challengesData from '../../solo-vyzvy-v2.json';
import type { Challenge, ChallengeProgress } from '../page';
import ChallengeDetailClient from './ChallengeDetailClient';

interface PageProps { params: Promise<{ id: string }> }

export default async function ChallengeDetailPage({ params }: PageProps) {
  const { id } = await params;

  const challenge = (challengesData.challenges as Challenge[]).find(c => c.id === id);
  if (!challenge) notFound();

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

  // Progress tohto usera pre túto výzvu
  const { data: progressRow } = await supabase
    .from('user_challenge_progress')
    .select('challenge_id, status, best_score, xp_earned, best_time_seconds, attempts')
    .eq('user_id', user.id)
    .eq('challenge_id', id)
    .maybeSingle();

  const progress = progressRow as ChallengeProgress | null;

  // Skupina + leaderboard pre túto výzvu
  const { data: membershipRaw } = await supabase
    .from('group_members')
    .select('group_id, groups(name)')
    .eq('user_id', user.id)
    .eq('status', 'active')
    .maybeSingle();

  let groupName: string | null = null;
  let groupLeaderboard: { user_id: string; display_name: string | null; best_score: number; best_time_seconds: number | null }[] = [];

  if (membershipRaw) {
    groupName = (membershipRaw.groups as unknown as { name: string } | null)?.name ?? null;

    const { data: lb } = await supabase
      .from('group_challenge_leaderboard')
      .select('user_id, display_name, best_score, best_time_seconds')
      .eq('group_id', membershipRaw.group_id)
      .eq('challenge_id', id)
      .order('best_score', { ascending: false })
      .order('best_time_seconds', { ascending: true })
      .limit(5);

    groupLeaderboard = (lb ?? []) as typeof groupLeaderboard;
  }

  const groupAvgScore = groupLeaderboard.length > 0
    ? Math.round(groupLeaderboard.reduce((s, e) => s + e.best_score, 0) / groupLeaderboard.length)
    : null;

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Nunito:wght@400;600;700;800;900&family=Sora:wght@300;400;500;600&display=swap');
        :root {
          --brand:#7361FF; --brand-2:#8C78FF; --brand-light:#EDE9FF; --brand-mid:#C4B5FD;
          --success:#10B981; --warn:#F59E0B;
          --bg:#F7F7FB; --surface:#FFFFFF; --border:#E8E6F0;
          --text:#111118; --muted:#6B7280; --faint:#9CA3AF;
        }
        .dp { font-family:'Sora',sans-serif; min-height:100vh; background:var(--bg); padding-top:80px; color:var(--text); }
        .dp *,.dp *::before,.dp *::after { box-sizing:border-box; }
        .dw { max-width:1100px; margin:0 auto; padding:0 24px 100px; }
      `}</style>

      <Navbar user={userData} />
      <div className="dp">
        <div className="dw">
          <ChallengeDetailClient
            challenge={challenge}
            progress={progress}
            userId={user.id}
            groupName={groupName}
            groupLeaderboard={groupLeaderboard}
            groupAvgScore={groupAvgScore}
          />
        </div>
      </div>
    </>
  );
}
