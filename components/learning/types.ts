export type TrackId = "html" | "css" | "javascript";

export interface Track {
  id: TrackId;
  title: string;
  description: string;
  icon?: string;
  color?: string;
  totalLessons: number;
  completedLessons: number;
  progress: number;
  lastLessonTitle?: string;
  href: string;
}
