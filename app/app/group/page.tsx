import { redirect } from 'next/navigation';
import { createClient } from '@/supabase/server';
import Navbar from '@/components/dashboard/NavBar';
import GroupEmptyState from './GroupEmptyState';
import GroupDashboard from './GroupDashboard';
import { getPublicGroups } from '@/app/actions/groups';
import type { GroupRow, MembershipRow } from '@/app/actions/groups';

export const metadata = {
  title: 'Skupina | KóduĽahko',
  description: 'Uč sa spolu s ostatnými. Vytvor skupinu alebo sa pripoj ku kamarátom.',
};

export default async function GroupPage({
  searchParams,
}: {
  searchParams: Promise<{ code?: string }>;
}) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const params = await searchParams;
  // Sanitize: only allow join code charset chars
  const rawCode = params.code?.toUpperCase().replace(/[^ABCDEFGHJKLMNPQRSTUVWXYZ23456789]/g, '') ?? '';
  const inviteCode = rawCode.length === 6 ? rawCode : null;

  const displayName =
    (user.user_metadata?.full_name as string | undefined) ||
    (user.user_metadata?.name as string | undefined) ||
    (user.user_metadata?.username as string | undefined) ||
    (user.email ? user.email.split('@')[0] : 'Používateľ');

  // Skontroluj členstvo
  const { data: membershipRaw } = await supabase
    .from('group_members')
    .select(`
      id, group_id, user_id, role, status, joined_at, left_at,
      group:groups(id, name, description, rules, join_code, owner_id, type, privacy, max_members, status, created_at)
    `)
    .eq('user_id', user.id)
    .eq('status', 'active')
    .maybeSingle();

  const membership = membershipRaw as (MembershipRow & { group: GroupRow }) | null;

  // Ak je v skupine, načítaj leaderboard; inak verejné skupiny
  let leaderboard: unknown[] = [];
  let publicGroups: Awaited<ReturnType<typeof getPublicGroups>> = [];

  if (membership) {
    const { data: lb } = await supabase
      .from('group_leaderboard')
      .select('*')
      .eq('group_id', membership.group_id)
      .order('total_xp', { ascending: false });
    leaderboard = lb ?? [];
  } else {
    publicGroups = await getPublicGroups();
  }

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
        {!membership ? (
          <GroupEmptyState prefillCode={inviteCode} publicGroups={publicGroups} />
        ) : (
          <GroupDashboard
            membership={membership}
            currentUserId={user.id}
            leaderboard={leaderboard as Parameters<typeof GroupDashboard>[0]['leaderboard']}
          />
        )}
      </div>
    </div>
  );
}
