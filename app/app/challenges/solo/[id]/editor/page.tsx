import { notFound, redirect } from 'next/navigation';
import { createClient } from '@/supabase/server';
import challengesData from '../../../solo-vyzvy-v2.json';
import type { Challenge } from '../../page';
import ChallengeEditorClient from './ChallengeEditorClient';

interface PageProps { params: Promise<{ id: string }> }

export default async function ChallengeEditorPage({ params }: PageProps) {
  const { id } = await params;

  const challenge = (challengesData.challenges as Challenge[]).find(c => c.id === id);
  if (!challenge) notFound();

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const { data: progressRow } = await supabase
    .from('user_challenge_progress')
    .select('challenge_id, status, best_score, xp_earned, best_time_seconds, attempts')
    .eq('user_id', user.id)
    .eq('challenge_id', id)
    .maybeSingle();

  return (
    <ChallengeEditorClient
      challenge={challenge}
      userId={user.id}
      existingProgress={progressRow ?? null}
    />
  );
}
