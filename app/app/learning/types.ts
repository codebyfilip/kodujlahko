export type TrackId = "html" | "css" | "javascript";

export interface Track {
  id: TrackId;
  title: string;
  description: string;
  icon: string;
  color: string;
  progress: number;
  totalLessons: number;
  completedLessons: number;
  lastLessonTitle?: string;
  href: string;
}

export interface UserProgress {
  userId: string;
  trackId: TrackId;
  completedLessons: number;
  lastLessonId?: string;
  progressPercent: number;
  updatedAt: Date;
}
