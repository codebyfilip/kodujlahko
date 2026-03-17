import { redirect } from 'next/navigation';
import { createClient } from '@/supabase/server';
import Navbar from '@/components/dashboard/NavBar';
import ProfileForms from './ProfileForms';
import htmlData from '../learning/html/html.json';

// Mapa lesson_id → xp zo všetkých trackov
const LESSON_XP_MAP: Record<string, number> = {};
for (const lesson of (htmlData as { lessons: { lesson_id: string; xp: number }[] }).lessons) {
  LESSON_XP_MAP[lesson.lesson_id] = lesson.xp;
}

export default async function ProfilePage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect('/login');

  // Streak z user_profiles
  const { data: profileData } = await supabase
    .from('user_profiles')
    .select('streak_current')
    .eq('user_id', user.id)
    .maybeSingle();

  const streak = profileData?.streak_current ?? 0;

  // Načítaj dokončené lekcie z DB
  const { data: completedRows } = await supabase
    .from('user_lesson_progress')
    .select('lesson_id')
    .eq('user_id', user.id)
    .eq('completed', true);

  // Vypočítaj XP: každá dokončená lekcia × jej xp hodnota z JSON
  const realXp = (completedRows ?? []).reduce((sum, row) => {
    return sum + (LESSON_XP_MAP[row.lesson_id] ?? 0);
  }, 0);

  // Syncni do user_profiles.xp
  await supabase
    .from('user_profiles')
    .upsert(
      { user_id: user.id, xp: realXp, updated_at: new Date().toISOString() },
      { onConflict: 'user_id' }
    );

  const displayName =
    (user.user_metadata?.full_name as string | undefined) ||
    (user.user_metadata?.name as string | undefined) ||
    (user.user_metadata?.username as string | undefined) ||
    (user.email ? user.email.split('@')[0] : 'Používateľ');

  const isGoogleUser = user.app_metadata?.provider === 'google';

  const joinedDate = new Date(user.created_at).toLocaleDateString('sk-SK', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });

  return (
    <div className="min-h-screen bg-white">
      {/* Background glow */}
      <div className="pointer-events-none fixed inset-0 -z-10">
        <div className="absolute -top-32 left-1/2 h-[420px] w-[820px] -translate-x-1/2 rounded-full bg-gradient-to-r from-[#7361FF]/18 to-[#8C78FF]/18 blur-3xl" />
        <div className="absolute -bottom-40 left-10 h-[380px] w-[520px] rounded-full bg-[#7361FF]/10 blur-3xl" />
        <div className="absolute -bottom-40 right-10 h-[380px] w-[520px] rounded-full bg-[#8C78FF]/10 blur-3xl" />
      </div>

      <Navbar
        user={{
          name: displayName,
          email: user.email ?? '',
          avatar: (user.user_metadata?.avatar_url as string | undefined) || undefined,
        }}
      />

      <div style={{ paddingTop: '80px' }}>
        <ProfileForms
          displayName={displayName}
          email={user.email ?? ''}
          avatar={(user.user_metadata?.avatar_url as string | undefined) || undefined}
          isGoogleUser={isGoogleUser}
          joinedDate={joinedDate}
          stats={{
            streak: streak,
            xp: realXp,
            completedLessons: completedRows?.length ?? 0,
          }}
        />
      </div>
    </div>
  );
}

export const metadata = {
  title: 'Profil | KóduĽahko',
  description: 'Spravuj svoj profil, zmeň meno alebo heslo.',
};
