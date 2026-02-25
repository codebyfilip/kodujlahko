import { createClient } from '@/supabase/server';
import { Track, UserProgress } from "./types";
import { TRACKS_DATA } from "./constants";

/**
 * Načíta progress usera z Supabase
 */
export async function getUserProgress(userId: string): Promise<UserProgress[]> {
  const supabase = await createClient();
  
  const { data, error } = await supabase
    .from('user_progress')
    .select('*')
    .eq('user_id', userId);

  if (error) {
    console.error('Error fetching user progress:', error);
    // Fallback na prázdny progress
    return TRACKS_DATA.map(track => ({
      userId,
      trackId: track.id,
      completedLessons: 0,
      progressPercent: 0,
      updatedAt: new Date()
    }));
  }

  return data.map(row => ({
    userId: row.user_id,
    trackId: row.track_id as "html" | "css" | "javascript",
    completedLessons: row.completed_lessons,
    lastLessonId: row.last_lesson_id,
    progressPercent: row.progress_percent,
    updatedAt: new Date(row.updated_at)
  }));
}

/**
 * Načíta user stats (streak, XP)
 */
export async function getUserStats(userId: string) {
  const supabase = await createClient();
  
  const { data, error } = await supabase
    .from('user_stats')
    .select('streak_days, total_xp')
    .eq('user_id', userId)
    .single();

  if (error || !data) {
    return { streak: 0, xp: 0 };
  }

  return {
    streak: data.streak_days,
    xp: data.total_xp
  };
}

/**
 * Zmerguje tracks s user progress
 */
export function mergeTracksWithProgress(progress: UserProgress[]): Track[] {
  return TRACKS_DATA.map(track => {
    const userProgress = progress.find(p => p.trackId === track.id);

    return {
      ...track,
      progress: userProgress?.progressPercent || 0,
      completedLessons: userProgress?.completedLessons || 0,
      lastLessonTitle: userProgress?.completedLessons
        ? `Lekcia ${userProgress.completedLessons}`
        : undefined
    };
  });
}

/**
 * Nájde aktuálne rozpracovaný track
 */
export function getCurrentLearning(tracks: Track[]) {
  const inProgress = tracks.find(t => t.progress > 0 && t.progress < 100);
  
  if (!inProgress) return null;

  return {
    trackTitle: inProgress.title,
    lessonTitle: inProgress.lastLessonTitle || "Lekcia 1",
    lessonNumber: inProgress.completedLessons + 1,
    totalLessons: inProgress.totalLessons,
    href: `${inProgress.href}/lesson/${inProgress.completedLessons + 1}`
  };
}

/**
 * Update progress po dokončení lekcie
 */
export async function updateLessonProgress(
  userId: string,
  trackId: string,
  lessonNumber: number,
  totalLessons: number
) {
  const supabase = await createClient();
  
  const progressPercent = Math.round((lessonNumber / totalLessons) * 100);
  
  const { error } = await supabase
    .from('user_progress')
    .update({
      completed_lessons: lessonNumber,
      last_lesson_id: `${trackId}-${lessonNumber}`,
      progress_percent: progressPercent,
      updated_at: new Date().toISOString()
    })
    .eq('user_id', userId)
    .eq('track_id', trackId);

  if (error) {
    console.error('Error updating progress:', error);
    throw error;
  }

  return { success: true };
}

/**
 * Pridaj XP userovi
 */
export async function addXP(userId: string, xpAmount: number) {
  const supabase = await createClient();
  
  // Najprv získaj aktuálne XP
  const { data: currentStats } = await supabase
    .from('user_stats')
    .select('total_xp')
    .eq('user_id', userId)
    .single();

  const newXP = (currentStats?.total_xp || 0) + xpAmount;

  const { error } = await supabase
    .from('user_stats')
    .update({ 
      total_xp: newXP,
      updated_at: new Date().toISOString()
    })
    .eq('user_id', userId);

  if (error) {
    console.error('Error adding XP:', error);
    throw error;
  }

  return { newXP };
}

/**
 * Update streak (volať každý deň pri prvej aktivite)
 */
export async function updateStreak(userId: string) {
  const supabase = await createClient();
  
  const { data: stats } = await supabase
    .from('user_stats')
    .select('last_activity_date, streak_days')
    .eq('user_id', userId)
    .single();

  if (!stats) return;

  const today = new Date().toISOString().split('T')[0];
  const lastActivity = stats.last_activity_date;

  // Ak je dnes prvá aktivita
  if (lastActivity !== today) {
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const yesterdayStr = yesterday.toISOString().split('T')[0];

    let newStreak = stats.streak_days;

    if (lastActivity === yesterdayStr) {
      // Pokračuje streak
      newStreak += 1;
    } else if (lastActivity !== today) {
      // Zlomil streak
      newStreak = 1;
    }

    await supabase
      .from('user_stats')
      .update({
        streak_days: newStreak,
        last_activity_date: today,
        updated_at: new Date().toISOString()
      })
      .eq('user_id', userId);
  }
}
