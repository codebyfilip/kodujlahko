import { redirect } from 'next/navigation';
import { createClient } from '@/supabase/server';
import Navbar from '@/components/dashboard/NavBar';
import ProfileForms from './ProfileForms';

export default async function ProfilePage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect('/login');

  // Načítaj streak aj XP z profile_stats — tam ich ukladá progres.ts
  const { data: profileData } = await supabase
    .from('profile_stats')
    .select('current_streak, total_xp')
    .eq('user_id', user.id)
    .maybeSingle();

  const streak = profileData?.current_streak ?? 0;
  const xp = profileData?.total_xp ?? 0;

  // Počet dokončených lekcií (status = 'completed')
  const { count: completedCount } = await supabase
    .from('user_lesson_progress')
    .select('lesson_id', { count: 'exact', head: true })
    .eq('user_id', user.id)
    .eq('status', 'completed');

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
            streak,
            xp,
            completedLessons: completedCount ?? 0,
          }}
        />
      </div>
    </div>
  );
}

export const metadata = {
  title: 'Profil | KódujĽahko',
  description: 'Spravuj svoj profil, zmeň meno alebo heslo.',
};
