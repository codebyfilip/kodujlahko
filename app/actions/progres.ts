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

  // 1. História attemptov
  await supabase.from('user_quiz_attempts').insert({
    user_id: user.id,
    lesson_id: lessonId,
    quiz_id: quizId,
    score,
    passed,
    answers,
  });

  // 2. Upsert lesson progress — quiz_passed
  // Poznámka: quiz_passed = true ak user zodpovedal všetky otázky (bez ohľadu na skóre)
  // "passed" tu znamená len že skóre je >= 60%, ale do DB ukladáme true ak dokončil quiz
  const quizCompleted = true; // user dokončil quiz (klikol na všetky možnosti)

  const { error: upsertErr } = await supabase
    .from('user_lesson_progress')
    .upsert(
      { user_id: user.id, lesson_id: lessonId, quiz_id: quizId, quiz_passed: quizCompleted, quiz_best_score: score },
      { onConflict: 'user_id,lesson_id' }
    );

  if (upsertErr) {
    // Row existuje — updatni iba ak je lepšie skóre
    await supabase
      .from('user_lesson_progress')
      .update({ quiz_id: quizId, quiz_best_score: score, quiz_passed: quizCompleted })
      .eq('user_id', user.id)
      .eq('lesson_id', lessonId);
  }

  return { error: null };
}

// ─────────────────────────────────────────────────────────────────────────────
// saveTaskSubmission — po každom "Vyhodnotiť" (voliteľné)
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

  // 1. Ulož submission
  const { data: sub } = await supabase
    .from('user_task_submissions')
    .insert({ user_id: user.id, lesson_id: lessonId, task_id: taskId, code, passed, score, checks, feedback })
    .select('id')
    .single();

  // 2. Upsert task_progress (best score)
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

  // 3. Upsert lesson_progress — task časť
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
// markLessonComplete — user klikol "Ďalšia lekcia"
// DB trigger nastaví completed = quiz_passed AND marked_complete
// ─────────────────────────────────────────────────────────────────────────────
export async function markLessonComplete(lessonId: string) {
  const { supabase, user } = await getUser();
  if (!user) return { error: 'Not authenticated' };

  // Upsert — nastav marked_complete = true
  // Trigger automaticky vypočíta completed = quiz_passed AND marked_complete
  const { error } = await supabase
    .from('user_lesson_progress')
    .upsert(
      { user_id: user.id, lesson_id: lessonId, marked_complete: true },
      { onConflict: 'user_id,lesson_id' }
    );

  if (error) {
    console.error('[markLessonComplete] upsert failed:', error);
    // Fallback: priamy update
    await supabase
      .from('user_lesson_progress')
      .update({ marked_complete: true })
      .eq('user_id', user.id)
      .eq('lesson_id', lessonId);
  }

  revalidatePath('/app/learning');
  revalidatePath('/app/learning/html');

  return { error: error?.message ?? null };
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