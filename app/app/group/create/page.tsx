import { redirect } from 'next/navigation';
import { createClient } from '@/supabase/server';
import Navbar from '@/components/dashboard/NavBar';
import GroupCreateForm from './GroupCreateForm';

export const metadata = {
  title: 'Vytvoriť skupinu | KóduĽahko',
};

export default async function GroupCreatePage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  // Ak je už v skupine, presmeruj na group dashboard
  const { data: membership } = await supabase
    .from('group_members')
    .select('id')
    .eq('user_id', user.id)
    .eq('status', 'active')
    .maybeSingle();

  if (membership) redirect('/app/group');

  const displayName =
    (user.user_metadata?.full_name as string | undefined) ||
    (user.user_metadata?.name as string | undefined) ||
    (user.user_metadata?.username as string | undefined) ||
    (user.email ? user.email.split('@')[0] : 'Používateľ');

  return (
    <div className="min-h-screen bg-white">
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

      <div style={{ paddingTop: '88px' }}>
        <GroupCreateForm />
      </div>
    </div>
  );
}
