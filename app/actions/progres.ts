'use server';

import { createClient } from '@/supabase/server';
import { revalidatePath } from 'next/cache';

async function getUser() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  return { supabase, user };
}

// ─────────────────────────────────────────────────────────────────────────────
// saveQuizAttempt — keď user dokončí self_check (všetky otázky zodpovedané)
// ─────────────────────────────────────────────────────────────────────────────
export async function saveQuizAttempt({
  lessonId,
  quizId,
  score,
  passed,
  answers,
}: {
  lessonId: string;
  quizId: string;
  score: number;
  passed: boolean;
  answers: Record<number, string>;
}) {
  const { supabase, user } = await getUser();
  if (!user) return { error: 'Not authenticated' };

  await supabase.from('user_quiz_attempts').insert({
    user_id: user.id,
    lesson_id: lessonId,
    quiz_id: quizId,
    score,
    passed,
    answers,
  });

  const quizCompleted = true;

  const { error: upsertErr } = await supabase
    .from('user_lesson_progress')
    .upsert(
      { user_id: user.id, lesson_id: lessonId, quiz_id: quizId, quiz_passed: quizCompleted, quiz_best_score: score },
      { onConflict: 'user_id,lesson_id' }
    );

  if (upsertErr) {
    await supabase
      .from('user_lesson_progress')
      .update({ quiz_id: quizId, quiz_best_score: score, quiz_passed: quizCompleted })
      .eq('user_id', user.id)
      .eq('lesson_id', lessonId);
  }

  return { error: null };
}

// ─────────────────────────────────────────────────────────────────────────────
// saveTaskSubmission — po každom "Vyhodnotiť"
// ─────────────────────────────────────────────────────────────────────────────
export async function saveTaskSubmission({
  lessonId,
  taskId,
  code,
  passed,
  score,
  checks,
  feedback,
}: {
  lessonId: string;
  taskId: string;
  code: string;
  passed: boolean;
  score: number;
  checks: Array<{ label: string; ok: boolean; hint?: string }>;
  feedback: string;
}) {
  const { supabase, user } = await getUser();
  if (!user) return { error: 'Not authenticated', submissionId: null };

  const { data: sub } = await supabase
    .from('user_task_submissions')
    .insert({ user_id: user.id, lesson_id: lessonId, task_id: taskId, code, passed, score, checks, feedback })
    .select('id')
    .single();

  const { data: existing } = await supabase
    .from('user_task_progress')
    .select('best_score, passed')
    .eq('user_id', user.id)
    .eq('task_id', taskId)
    .maybeSingle();

  const newBest = Math.max(score, existing?.best_score ?? 0);
  const newPassed = passed || (existing?.passed ?? false);

  await supabase.from('user_task_progress').upsert(
    { user_id: user.id, task_id: taskId, lesson_id: lessonId, best_score: newBest, passed: newPassed, last_submission_id: sub?.id ?? null },
    { onConflict: 'user_id,task_id' }
  );

  const { error: lpErr } = await supabase
    .from('user_lesson_progress')
    .upsert(
      { user_id: user.id, lesson_id: lessonId, task_id: taskId, task_passed: newPassed, task_best_score: newBest },
      { onConflict: 'user_id,lesson_id' }
    );

  if (lpErr) {
    await supabase
      .from('user_lesson_progress')
      .update({ task_id: taskId, task_best_score: newBest, ...(newPassed ? { task_passed: true } : {}) })
      .eq('user_id', user.id)
      .eq('lesson_id', lessonId);
  }

  return { error: null, submissionId: sub?.id ?? null };
}

// ─────────────────────────────────────────────────────────────────────────────
// markLessonComplete — user klikol "Ďalšia lekcia" + priradí XP
// ─────────────────────────────────────────────────────────────────────────────
export async function markLessonComplete(lessonId: string, xpReward: number = 0) {
  const { supabase, user } = await getUser();
  if (!user) return { error: 'Not authenticated' };

  // 1. Skontroluj či lekcia už bola dokončená (aby sme nedali XP 2x)
  const { data: existing } = await supabase
    .from('user_lesson_progress')
    .select('completed')
    .eq('user_id', user.id)
    .eq('lesson_id', lessonId)
    .maybeSingle();

  const alreadyCompleted = existing?.completed === true;

  // 2. Označ lekciu ako dokončenú
  const { error } = await supabase
    .from('user_lesson_progress')
    .upsert(
      { user_id: user.id, lesson_id: lessonId, marked_complete: true, completed: true, completed_at: new Date().toISOString() },
      { onConflict: 'user_id,lesson_id' }
    );

  if (error) {
    await supabase
      .from('user_lesson_progress')
      .update({ marked_complete: true, completed: true, completed_at: new Date().toISOString() })
      .eq('user_id', user.id)
      .eq('lesson_id', lessonId);
  }

  // 3. Pridaj XP iba ak nebola lekcia predtým dokončená
  if (!alreadyCompleted && xpReward > 0) {
    await awardXp(user.id, xpReward, lessonId);
  }

  revalidatePath('/app/learning');
  revalidatePath('/app/learning/html');

  return { error: null, xpAwarded: !alreadyCompleted ? xpReward : 0 };
}

// ─────────────────────────────────────────────────────────────────────────────
// awardXp — interná funkcia, pridá XP do user_profiles
// ─────────────────────────────────────────────────────────────────────────────
async function awardXp(userId: string, amount: number, sourceId: string) {
  const supabase = await createClient();

  // 1. Zapíš XP transakciu
  await supabase.from('user_xp_transactions').insert({
    user_id: userId,
    amount,
    source: 'lesson_complete',
    source_id: sourceId,
  });

  // 2. Prepočítaj total priamo z transakcií (spoľahlivý zdroj pravdy)
  const { data: transactions } = await supabase
    .from('user_xp_transactions')
    .select('amount, source_id')
    .eq('user_id', userId)
    .eq('source', 'lesson_complete');

  const seen = new Set<string>();
  const totalXp = (transactions ?? []).reduce((sum, t) => {
    const key = t.source_id ?? '';
    if (key && seen.has(key)) return sum;
    if (key) seen.add(key);
    return sum + (t.amount ?? 0);
  }, 0);

  // 3. Prepíš user_profiles.xp prepočítanou hodnotou
  await supabase
    .from('user_profiles')
    .upsert(
      { user_id: userId, xp: totalXp, updated_at: new Date().toISOString() },
      { onConflict: 'user_id' }
    );
}

// ─────────────────────────────────────────────────────────────────────────────
// getUserXp — načíta aktuálne XP usera
// ─────────────────────────────────────────────────────────────────────────────
export async function getUserXp() {
  const { supabase, user } = await getUser();
  if (!user) return { xp: 0 };

  const { data } = await supabase
    .from('user_profiles')
    .select('xp')
    .eq('user_id', user.id)
    .maybeSingle();

  return { xp: data?.xp ?? 0 };
}

// ─────────────────────────────────────────────────────────────────────────────
// getLessonProgress — načíta stav pri otvorení lekcie
// ─────────────────────────────────────────────────────────────────────────────
export async function getLessonProgress(lessonId: string) {
  const { supabase, user } = await getUser();
  if (!user) return null;

  const { data } = await supabase
    .from('user_lesson_progress')
    .select('quiz_passed, quiz_best_score, task_passed, task_best_score, marked_complete, completed, completed_at')
    .eq('user_id', user.id)
    .eq('lesson_id', lessonId)
    .maybeSingle();

  return data;
}

// ─────────────────────────────────────────────────────────────────────────────
// getTaskSubmission — načíta posledné odovzdanie úlohy
// ─────────────────────────────────────────────────────────────────────────────
export async function getTaskSubmission(lessonId: string, taskId: string) {
  const { supabase, user } = await getUser();
  if (!user) return null;

  const { data, error } = await supabase
    .from('user_task_submissions')
    .select('code, feedback, passed, score, created_at')
    .eq('user_id', user.id)
    .eq('lesson_id', lessonId)
    .eq('task_id', taskId)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) { console.error('getTaskSubmission error:', error); return null; }
  return data;
}

export async function updateStreak() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return;

  const today = new Date().toISOString().split('T')[0]; // "2025-03-02"

  const { data: profile } = await supabase
    .from('user_profiles')
    .select('streak_current, streak_longest, streak_last_date')
    .eq('user_id', user.id)
    .single();

  const last = profile?.streak_last_date;
  const current = profile?.streak_current ?? 0;
  const longest = profile?.streak_longest ?? 0;

  // Ak dnes už počítame — nič nerob
  if (last === today) return { streak: current };

  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  const yesterdayStr = yesterday.toISOString().split('T')[0];

  // Ak posledný deň bol včera → streak pokračuje
  // Ak bol skôr → streak sa resetuje na 1
  const newStreak = last === yesterdayStr ? current + 1 : 1;
  const newLongest = Math.max(newStreak, longest);

  await supabase
    .from('user_profiles')
    .upsert({
      user_id: user.id,
      streak_current: newStreak,
      streak_longest: newLongest,
      streak_last_date: today,
    }, { onConflict: 'user_id' });

  return { streak: newStreak, isNewRecord: newStreak > longest };
}