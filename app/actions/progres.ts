'use server';

import { createClient } from '@/supabase/server';
import { revalidatePath } from 'next/cache';

async function getUser() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  return { supabase, user };
}

function courseSlugFromLesson(lessonId: string): string {
  const match = lessonId.match(/^lesson-([a-z]+)-/);
  return match?.[1] ?? 'html';
}

async function recalcAndSaveXp(
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

export async function saveQuizAttempt({
  lessonId,
}: {
  lessonId: string;
  quizId?: string;
}) {
  const { supabase, user } = await getUser();
  if (!user) return { error: 'Not authenticated' };

  const courseSlug = courseSlugFromLesson(lessonId);

  await supabase
    .from('user_lesson_progress')
    .upsert(
      {
        user_id: user.id,
        course_slug: courseSlug,
        lesson_id: lessonId,
        quiz_passed: true,
        last_opened_at: new Date().toISOString(),
      },
      { onConflict: 'user_id,course_slug,lesson_id' },
    );

  return { error: null };
}

export async function saveTaskSubmission({
  lessonId,
  taskId,
  code,
  passed,
  score,
  feedback,
  xpEarned = 0,
}: {
  lessonId: string;
  taskId: string;
  code: string;
  passed: boolean;
  score: number;
  feedback: string;
  xpEarned?: number;
}) {
  const { supabase, user } = await getUser();
  if (!user) return { error: 'Not authenticated', submissionId: null };

  const courseSlug = courseSlugFromLesson(lessonId);
  const status = passed ? 'passed' : score >= 40 ? 'partial' : 'failed';

  const { data: sub } = await supabase
    .from('task_submissions')
    .insert({
      user_id: user.id,
      course_slug: courseSlug,
      lesson_id: lessonId,
      task_id: taskId,
      submission_code: code,
      status,
      score_percent: score,
      xp_earned: xpEarned,
      feedback,
    })
    .select('id')
    .single();

  const { data: existing } = await supabase
    .from('user_task_progress')
    .select('best_score_percent, status, xp_earned')
    .eq('user_id', user.id)
    .eq('course_slug', courseSlug)
    .eq('lesson_id', lessonId)
    .eq('task_id', taskId)
    .maybeSingle();

  const newBest      = Math.max(score, existing?.best_score_percent ?? 0);
  const newStatus    = passed || existing?.status === 'passed' ? 'passed' : 'attempted';
  const newXpEarned  = Math.max(xpEarned, existing?.xp_earned ?? 0);

  await supabase
    .from('user_task_progress')
    .upsert(
      {
        user_id: user.id,
        course_slug: courseSlug,
        lesson_id: lessonId,
        task_id: taskId,
        status: newStatus,
        best_score_percent: newBest,
        xp_earned: newXpEarned,
        last_submission_at: new Date().toISOString(),
      },
      { onConflict: 'user_id,course_slug,lesson_id,task_id' },
    );

  await supabase
    .from('user_lesson_progress')
    .upsert(
      {
        user_id: user.id,
        course_slug: courseSlug,
        lesson_id: lessonId,
        last_opened_at: new Date().toISOString(),
      },
      { onConflict: 'user_id,course_slug,lesson_id' },
    );

  return { error: null, submissionId: sub?.id ?? null };
}

export async function markLessonComplete(lessonId: string, xpReward: number = 0) {
  const { supabase, user } = await getUser();
  if (!user) return { error: 'Not authenticated' };

  const courseSlug = courseSlugFromLesson(lessonId);

  const { data: existing } = await supabase
    .from('user_lesson_progress')
    .select('status, xp_earned')
    .eq('user_id', user.id)
    .eq('course_slug', courseSlug)
    .eq('lesson_id', lessonId)
    .maybeSingle();

  const alreadyCompleted = existing?.status === 'completed';

  await supabase
    .from('user_lesson_progress')
    .upsert(
      {
        user_id: user.id,
        course_slug: courseSlug,
        lesson_id: lessonId,
        status: 'completed',
        xp_earned: xpReward,
        completed_at: new Date().toISOString(),
        last_opened_at: new Date().toISOString(),
      },
      { onConflict: 'user_id,course_slug,lesson_id' },
    );

  if (xpReward > 0) {
    await supabase.from('xp_events').insert({
      user_id: user.id,
      source_type: 'lesson_complete',
      source_id: lessonId,
      xp_amount: xpReward,
      reason: alreadyCompleted ? 'lesson_improved' : 'lesson_complete',
    });

    await recalcAndSaveXp(supabase, user.id);
  }

  revalidatePath('/app/learning');
  revalidatePath('/app/learning/html');
  revalidatePath('/app/learning/css');
  revalidatePath('/app/learning/javascript');

  return { error: null, xpAwarded: xpReward };
}

export async function getUserXp() {
  const { supabase, user } = await getUser();
  if (!user) return { xp: 0 };

  const { data } = await supabase
    .from('profile_stats')
    .select('total_xp')
    .eq('user_id', user.id)
    .maybeSingle();

  return { xp: data?.total_xp ?? 0 };
}

export async function getLessonProgress(lessonId: string) {
  const { supabase, user } = await getUser();
  if (!user) return null;

  const courseSlug = courseSlugFromLesson(lessonId);
  const taskId     = lessonId.replace('lesson-', 'task-');

  const [{ data: lp }, { data: tp }] = await Promise.all([
    supabase
      .from('user_lesson_progress')
      .select('status, xp_earned, completed_at, quiz_passed')
      .eq('user_id', user.id)
      .eq('course_slug', courseSlug)
      .eq('lesson_id', lessonId)
      .maybeSingle(),
    supabase
      .from('user_task_progress')
      .select('status, best_score_percent')
      .eq('user_id', user.id)
      .eq('course_slug', courseSlug)
      .eq('lesson_id', lessonId)
      .eq('task_id', taskId)
      .maybeSingle(),
  ]);

  if (!lp && !tp) return null;

  return {
    quiz_passed:     lp?.quiz_passed ?? false,
    task_passed:     tp?.status === 'passed',
    task_best_score: tp?.best_score_percent ?? null,
    completed:       lp?.status === 'completed',
    completed_at:    lp?.completed_at ?? null,
    xp_awarded:      lp?.xp_earned ?? 0,
  };
}

export async function getTaskSubmission(lessonId: string, taskId: string) {
  const { supabase, user } = await getUser();
  if (!user) return null;

  const courseSlug = courseSlugFromLesson(lessonId);

  const { data, error } = await supabase
    .from('task_submissions')
    .select('submission_code, feedback, status, score_percent, created_at')
    .eq('user_id', user.id)
    .eq('course_slug', courseSlug)
    .eq('lesson_id', lessonId)
    .eq('task_id', taskId)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) { console.error('getTaskSubmission error:', error); return null; }
  if (!data) return null;

  return {
    code:       data.submission_code,
    feedback:   data.feedback,
    passed:     data.status === 'passed',
    score:      data.score_percent,
    created_at: data.created_at,
  };
}

export async function updateStreak() {
  const { supabase, user } = await getUser();
  if (!user) return;

  const today = new Date().toISOString().split('T')[0];

  const { data: stats } = await supabase
    .from('profile_stats')
    .select('current_streak, longest_streak, last_activity_date')
    .eq('user_id', user.id)
    .maybeSingle();

  const last    = stats?.last_activity_date;
  const current = stats?.current_streak ?? 0;
  const longest = stats?.longest_streak ?? 0;

  if (last === today) return { streak: current };

  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  const yesterdayStr = yesterday.toISOString().split('T')[0];

  const newStreak  = last === yesterdayStr ? current + 1 : 1;
  const newLongest = Math.max(newStreak, longest);

  await supabase
    .from('profile_stats')
    .upsert(
      {
        user_id:            user.id,
        current_streak:     newStreak,
        longest_streak:     newLongest,
        last_activity_date: today,
        updated_at:         new Date().toISOString(),
      },
      { onConflict: 'user_id' },
    );

  return { streak: newStreak, isNewRecord: newStreak > longest };
}