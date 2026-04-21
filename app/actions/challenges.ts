'use server';

import { createClient } from '@/supabase/server';

async function recalcProfileXp(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string,
) {
  const { data: events } = await supabase
    .from('xp_events')
    .select('source_type, source_id, xp_amount')
    .eq('user_id', userId);

  const maxByKey = new Map<string, number>();
  for (const e of (events ?? [])) {
    const key = `${e.source_type}::${e.source_id}`;
    maxByKey.set(key, Math.max(maxByKey.get(key) ?? 0, e.xp_amount ?? 0));
  }
  const totalXp = Array.from(maxByKey.values()).reduce((a, b) => a + b, 0);

  await supabase
    .from('profile_stats')
    .upsert(
      { user_id: userId, total_xp: totalXp, updated_at: new Date().toISOString() },
      { onConflict: 'user_id' },
    );

  return totalXp;
}

export interface SubmitChallengeArgs {
  challengeId: string;
  score: number;
  passed: boolean;
  xpReward: number;
  timeSeconds: number;
  existingBestScore: number;
  existingAttempts: number;
  existingXpEarned: number;
  existingBestTime: number | null;
}

export interface SubmitChallengeResult {
  error: string | null;
  isNewBest: boolean;
  xpAwarded: number;
  totalXp: number;
}

export async function submitChallengeAttempt(
  args: SubmitChallengeArgs,
): Promise<SubmitChallengeResult> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: 'Not authenticated', isNewBest: false, xpAwarded: 0, totalXp: 0 };

  const {
    challengeId, score, passed, xpReward,
    timeSeconds, existingBestScore, existingAttempts,
    existingXpEarned, existingBestTime,
  } = args;

  const isNewBest = score > existingBestScore;
  const xpAwarded = passed ? xpReward : Math.round(xpReward * 0.3);
  const bestScore = isNewBest ? score : existingBestScore;
  const bestTime = isNewBest ? timeSeconds : (existingBestTime ?? timeSeconds);
  const earnedXp = isNewBest ? xpAwarded : existingXpEarned;

  const { error: progressError } = await supabase
    .from('user_challenge_progress')
    .upsert(
      {
        user_id: user.id,
        challenge_id: challengeId,
        status: passed ? 'completed' : 'started',
        best_score: bestScore,
        xp_earned: earnedXp,
        best_time_seconds: bestTime,
        attempts: existingAttempts + 1,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'user_id,challenge_id' },
    );

  if (progressError) {
    return { error: progressError.message, isNewBest: false, xpAwarded: 0, totalXp: 0 };
  }

  let totalXp = 0;
  if (isNewBest) {
    await supabase.from('xp_events').insert({
      user_id: user.id,
      source_type: 'challenge',
      source_id: challengeId,
      xp_amount: xpAwarded,
    });
    totalXp = await recalcProfileXp(supabase, user.id);
  }

  return { error: null, isNewBest, xpAwarded: isNewBest ? xpAwarded : 0, totalXp };
}

export interface LeaderboardEntry {
  user_id: string;
  display_name: string | null;
  best_score: number;
  best_time_seconds: number | null;
}

export interface GroupLeaderboardResult {
  groupName: string | null;
  entries: LeaderboardEntry[];
  myRank: number | null;
}

export async function getGroupChallengeLeaderboard(
  challengeId: string,
): Promise<GroupLeaderboardResult> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { groupName: null, entries: [], myRank: null };

  const { data: membership } = await supabase
    .from('group_members')
    .select('group_id, groups(name)')
    .eq('user_id', user.id)
    .eq('status', 'active')
    .maybeSingle();

  if (!membership) return { groupName: null, entries: [], myRank: null };

  const groupName = (membership.groups as unknown as { name: string } | null)?.name ?? null;

  const { data: lb } = await supabase
    .from('group_challenge_leaderboard')
    .select('user_id, display_name, best_score, best_time_seconds')
    .eq('group_id', membership.group_id)
    .eq('challenge_id', challengeId)
    .order('best_score', { ascending: false })
    .order('best_time_seconds', { ascending: true })
    .limit(10);

  const entries = (lb ?? []) as LeaderboardEntry[];

  const myRank = entries.findIndex(e => e.user_id === user.id);

  return {
    groupName,
    entries: entries.slice(0, 5),
    myRank: myRank >= 0 ? myRank + 1 : null,
  };
}
