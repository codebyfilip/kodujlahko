'use server';

import { randomBytes } from 'crypto';
import { createClient } from '@/supabase/server';
import { createAdminClient } from '@/supabase/admin';
import { revalidatePath } from 'next/cache';

const JOIN_CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const JOIN_CODE_RE = /^[ABCDEFGHJKLMNPQRSTUVWXYZ23456789]{6}$/;
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function generateJoinCode(): string {
  const bytes = randomBytes(6);
  return Array.from(bytes, b => JOIN_CODE_CHARS[b % JOIN_CODE_CHARS.length]).join('');
}

function isUUID(s: string): boolean {
  return UUID_RE.test(s);
}

async function getUser() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  return { supabase, user };
}

// ─── Typy ────────────────────────────────────────────────────────────────────

export type GroupType    = 'public' | 'invite_only';
export type GroupPrivacy = 'aggregate_only' | 'full_detail';

export interface GroupRow {
  id:          string;
  name:        string;
  description: string | null;
  rules:       string | null;
  join_code:   string;
  owner_id:    string;
  type:        GroupType;
  privacy:     GroupPrivacy;
  max_members: number;
  status:      'active' | 'deleted';
  created_at:  string;
}

export interface MembershipRow {
  id:        string;
  group_id:  string;
  user_id:   string;
  role:      'owner' | 'member';
  status:    'active' | 'left' | 'removed';
  joined_at: string;
  left_at:   string | null;
}

// ─── Pomocné ─────────────────────────────────────────────────────────────────

/** Vráti aktívne členstvo aktuálneho usera (ak existuje) */
export async function getMyGroup(): Promise<{
  membership: MembershipRow & { group: GroupRow } | null;
  error: string | null;
}> {
  const { supabase, user } = await getUser();
  if (!user) return { membership: null, error: 'Nie si prihlásený.' };

  const { data, error } = await supabase
    .from('group_members')
    .select(`
      id, group_id, user_id, role, status, joined_at, left_at,
      group:groups(id, name, description, rules, join_code, owner_id, type, privacy, max_members, status, created_at)
    `)
    .eq('user_id', user.id)
    .eq('status', 'active')
    .maybeSingle();

  if (error) return { membership: null, error: error.message };

  return {
    membership: data as (MembershipRow & { group: GroupRow }) | null,
    error: null,
  };
}

// ─── Vytvorenie skupiny ───────────────────────────────────────────────────────

export async function createGroup(formData: {
  name:        string;
  description: string;
  rules:       string;
  type:        GroupType;
  privacy:     GroupPrivacy;
  maxMembers:  number;
}): Promise<{ groupId: string | null; joinCode: string | null; error: string | null }> {
  const { supabase, user } = await getUser();
  if (!user) return { groupId: null, joinCode: null, error: 'Nie si prihlásený.' };

  // Overiť že user nie je v inej skupiny
  const { data: existing } = await supabase
    .from('group_members')
    .select('id')
    .eq('user_id', user.id)
    .eq('status', 'active')
    .maybeSingle();

  if (existing) {
    return { groupId: null, joinCode: null, error: 'Už si členom skupiny. Najprv ju opusti.' };
  }

  // Validácia
  const name = formData.name.trim();
  if (!name || name.length < 2 || name.length > 50) {
    return { groupId: null, joinCode: null, error: 'Názov skupiny musí mať 2–50 znakov.' };
  }
  if (formData.description && formData.description.length > 200) {
    return { groupId: null, joinCode: null, error: 'Popis môže mať najviac 200 znakov.' };
  }
  if (formData.rules && formData.rules.length > 500) {
    return { groupId: null, joinCode: null, error: 'Pravidlá môžu mať najviac 500 znakov.' };
  }
  if (!['public', 'invite_only'].includes(formData.type)) {
    return { groupId: null, joinCode: null, error: 'Neplatný typ skupiny.' };
  }
  if (!['aggregate_only', 'full_detail'].includes(formData.privacy)) {
    return { groupId: null, joinCode: null, error: 'Neplatné nastavenie súkromia.' };
  }
  if (formData.maxMembers < 2 || formData.maxMembers > 50) {
    return { groupId: null, joinCode: null, error: 'Maximálny počet členov musí byť 2–50.' };
  }

  // Vygenerovať unikátny join_code
  const joinCode = generateJoinCode();

  // Vytvoriť skupinu
  const { data: group, error: groupError } = await supabase
    .from('groups')
    .insert({
      name,
      description: formData.description.trim() || null,
      rules:       formData.rules.trim() || null,
      join_code:   joinCode,
      owner_id:    user.id,
      type:        formData.type,
      privacy:     formData.privacy,
      max_members: formData.maxMembers,
    })
    .select('id')
    .single();

  if (groupError || !group) {
    return { groupId: null, joinCode: null, error: groupError?.message ?? 'Nepodarilo sa vytvoriť skupinu.' };
  }

  // Pridať zakladateľa ako ownera
  const { error: memberError } = await supabase
    .from('group_members')
    .insert({
      group_id: group.id,
      user_id:  user.id,
      role:     'owner',
    });

  if (memberError) {
    // Rollback skupinu
    await supabase.from('groups').delete().eq('id', group.id);
    return { groupId: null, joinCode: null, error: 'Nepodarilo sa pripojiť k skupine.' };
  }

  // Bez revalidatePath — GroupCreateForm naviguje cez router.push a /app/group načíta čerstvé dáta samo
  return { groupId: group.id, joinCode, error: null };
}

// ─── Pripojenie cez kód ───────────────────────────────────────────────────────

export async function joinGroup(
  joinCode: string,
): Promise<{ groupId: string | null; error: string | null }> {
  const { supabase, user } = await getUser();
  if (!user) return { groupId: null, error: 'Nie si prihlásený.' };

  const code = joinCode.trim().toUpperCase().replace(/\s/g, '');
  if (!JOIN_CODE_RE.test(code)) return { groupId: null, error: 'Neplatný kód skupiny. Skontroluj 6 znakov.' };

  // Skontrolovať aktívne členstvo
  const { data: existing } = await supabase
    .from('group_members')
    .select('id')
    .eq('user_id', user.id)
    .eq('status', 'active')
    .maybeSingle();

  if (existing) {
    return { groupId: null, error: 'Už si členom skupiny. Najprv ju opusti.' };
  }

  // Nájsť skupinu podľa kódu
  const { data: group } = await supabase
    .from('groups')
    .select('id, name, type, max_members')
    .eq('join_code', code)
    .eq('status', 'active')
    .maybeSingle();

  if (!group) return { groupId: null, error: 'Skupina s týmto kódom neexistuje.' };

  // Skontrolovať počet aktívnych členov
  const { count } = await supabase
    .from('group_members')
    .select('id', { count: 'exact', head: true })
    .eq('group_id', group.id)
    .eq('status', 'active');

  if ((count ?? 0) >= group.max_members) {
    return { groupId: null, error: `Skupina "${group.name}" je plná.` };
  }

  // Pripojiť
  const { error: insertError } = await supabase
    .from('group_members')
    .insert({
      group_id: group.id,
      user_id:  user.id,
      role:     'member',
    });

  if (insertError) {
    // unique index zlyhal = user je v inej skupine (race condition)
    if (insertError.code === '23P01' || insertError.message.includes('unique')) {
      return { groupId: null, error: 'Už si členom inej skupiny.' };
    }
    return { groupId: null, error: 'Nepodarilo sa pripojiť k skupine.' };
  }

  revalidatePath('/app/group');
  return { groupId: group.id, error: null };
}

// ─── Opustenie skupiny ────────────────────────────────────────────────────────

export async function leaveGroup(
  groupId: string,
): Promise<{ error: string | null }> {
  if (!isUUID(groupId)) return { error: 'Neplatný identifikátor skupiny.' };
  const { supabase, user } = await getUser();
  if (!user) return { error: 'Nie si prihlásený.' };

  // Skontrolovať rolu
  const { data: membership } = await supabase
    .from('group_members')
    .select('id, role')
    .eq('group_id', groupId)
    .eq('user_id', user.id)
    .eq('status', 'active')
    .maybeSingle();

  if (!membership) return { error: 'Nie si členom tejto skupiny.' };

  // Owner nemôže odísť ak sú ďalší členovia — musí preniesť ownership
  if (membership.role === 'owner') {
    const { count } = await supabase
      .from('group_members')
      .select('id', { count: 'exact', head: true })
      .eq('group_id', groupId)
      .eq('status', 'active');

    if ((count ?? 0) > 1) {
      return { error: 'Si owner skupiny. Pred odchodom preveď skupinu na iného člena.' };
    }

    // Posledný člen = vymazať skupinu
    await supabase
      .from('groups')
      .update({ status: 'deleted' })
      .eq('id', groupId);
  }

  await supabase
    .from('group_members')
    .update({ status: 'left', left_at: new Date().toISOString() })
    .eq('id', membership.id);

  revalidatePath('/app/group');
  return { error: null };
}

// ─── Prenos ownera ────────────────────────────────────────────────────────────

export async function transferOwnership(
  groupId: string,
  newOwnerId: string,
): Promise<{ error: string | null }> {
  if (!isUUID(groupId) || !isUUID(newOwnerId)) return { error: 'Neplatný identifikátor.' };
  const { supabase, user } = await getUser();
  if (!user) return { error: 'Nie si prihlásený.' };

  // Overiť že volajúci je owner
  const { data: myMembership } = await supabase
    .from('group_members')
    .select('id, role')
    .eq('group_id', groupId)
    .eq('user_id', user.id)
    .eq('status', 'active')
    .maybeSingle();

  if (!myMembership || myMembership.role !== 'owner') {
    return { error: 'Nemáš oprávnenie preniesť skupinu.' };
  }

  // Overiť nového ownera
  const { data: newMembership } = await supabase
    .from('group_members')
    .select('id')
    .eq('group_id', groupId)
    .eq('user_id', newOwnerId)
    .eq('status', 'active')
    .maybeSingle();

  if (!newMembership) {
    return { error: 'Vybraný používateľ nie je členom skupiny.' };
  }

  // Prenos
  await supabase
    .from('group_members')
    .update({ role: 'member' })
    .eq('id', myMembership.id);

  await supabase
    .from('group_members')
    .update({ role: 'owner' })
    .eq('id', newMembership.id);

  await supabase
    .from('groups')
    .update({ owner_id: newOwnerId })
    .eq('id', groupId);

  revalidatePath('/app/group');
  return { error: null };
}

// ─── Vykopnutie člena (owner) ─────────────────────────────────────────────────

export async function removeMember(
  groupId: string,
  targetUserId: string,
): Promise<{ error: string | null }> {
  if (!isUUID(groupId) || !isUUID(targetUserId)) return { error: 'Neplatný identifikátor.' };
  const { supabase, user } = await getUser();
  if (!user) return { error: 'Nie si prihlásený.' };

  // Overiť že volajúci je owner
  const { data: myMembership } = await supabase
    .from('group_members')
    .select('role')
    .eq('group_id', groupId)
    .eq('user_id', user.id)
    .eq('status', 'active')
    .maybeSingle();

  if (!myMembership || myMembership.role !== 'owner') {
    return { error: 'Nemáš oprávnenie odstraňovať členov.' };
  }

  if (targetUserId === user.id) {
    return { error: 'Nemôžeš odstrániť sám seba.' };
  }

  const admin = createAdminClient();
  const { error: updateError } = await admin
    .from('group_members')
    .update({ status: 'removed', left_at: new Date().toISOString() })
    .eq('group_id', groupId)
    .eq('user_id', targetUserId)
    .eq('status', 'active');

  if (updateError) return { error: updateError.message };

  revalidatePath('/app/group');
  return { error: null };
}

// ─── Editácia skupiny (owner) ─────────────────────────────────────────────────

export async function updateGroup(
  groupId: string,
  updates: {
    name?:        string;
    description?: string;
    rules?:       string;
    type?:        GroupType;
    privacy?:     GroupPrivacy;
    maxMembers?:  number;
  },
): Promise<{ error: string | null }> {
  const { supabase, user } = await getUser();
  if (!user) return { error: 'Nie si prihlásený.' };

  const { data: group } = await supabase
    .from('groups')
    .select('owner_id')
    .eq('id', groupId)
    .maybeSingle();

  if (!group || group.owner_id !== user.id) {
    return { error: 'Nemáš oprávnenie upravovať túto skupinu.' };
  }

  const payload: Record<string, unknown> = {};
  if (updates.name !== undefined)        payload.name        = updates.name.trim();
  if (updates.description !== undefined) payload.description = updates.description.trim() || null;
  if (updates.rules !== undefined)       payload.rules       = updates.rules.trim() || null;
  if (updates.type !== undefined)        payload.type        = updates.type;
  if (updates.privacy !== undefined)     payload.privacy     = updates.privacy;
  if (updates.maxMembers !== undefined)  payload.max_members = updates.maxMembers;

  const { error } = await supabase
    .from('groups')
    .update(payload)
    .eq('id', groupId);

  if (error) return { error: 'Nepodarilo sa uložiť zmeny.' };

  revalidatePath('/app/group');
  return { error: null };
}

// ─── Vymazanie skupiny (owner) ────────────────────────────────────────────────

export async function deleteGroup(
  groupId: string,
): Promise<{ error: string | null }> {
  if (!isUUID(groupId)) return { error: 'Neplatný identifikátor skupiny.' };

  const { supabase, user } = await getUser();
  if (!user) return { error: 'Nie si prihlásený.' };

  // Overiť že volajúci je owner
  const { data: group } = await supabase
    .from('groups')
    .select('owner_id')
    .eq('id', groupId)
    .maybeSingle();

  if (!group || group.owner_id !== user.id) {
    return { error: 'Nemáš oprávnenie vymazať túto skupinu.' };
  }

  const admin = createAdminClient();

  // Najprv vymazať všetkých členov
  const { error: membersError } = await admin
    .from('group_members')
    .delete()
    .eq('group_id', groupId);

  if (membersError) return { error: 'Nepodarilo sa vymazať členov skupiny.' };

  // Potom vymazať skupinu
  const { error: groupError } = await admin
    .from('groups')
    .delete()
    .eq('id', groupId);

  if (groupError) return { error: 'Nepodarilo sa vymazať skupinu.' };

  revalidatePath('/app/group');
  return { error: null };
}

// ─── Leaderboard ──────────────────────────────────────────────────────────────

export async function getGroupLeaderboard(groupId: string) {
  const { supabase, user } = await getUser();
  if (!user) return { data: null, error: 'Nie si prihlásený.' };

  // Overiť členstvo
  const { data: membership } = await supabase
    .from('group_members')
    .select('id')
    .eq('group_id', groupId)
    .eq('user_id', user.id)
    .eq('status', 'active')
    .maybeSingle();

  if (!membership) return { data: null, error: 'Nie si členom tejto skupiny.' };

  const { data, error } = await supabase
    .from('group_leaderboard')
    .select('*')
    .eq('group_id', groupId)
    .order('total_xp', { ascending: false });

  if (error) return { data: null, error: error.message };
  return { data, error: null };
}

// ─── Lesson panel stats ───────────────────────────────────────────────────────

export async function getGroupLessonStats(groupId: string, lessonId: string) {
  const { supabase, user } = await getUser();
  if (!user) return null;

  // Overiť členstvo
  const { data: membership } = await supabase
    .from('group_members')
    .select('id')
    .eq('group_id', groupId)
    .eq('user_id', user.id)
    .eq('status', 'active')
    .maybeSingle();

  if (!membership) return null;

  // Aktívni členovia skupiny
  const { data: members } = await supabase
    .from('group_members')
    .select('user_id')
    .eq('group_id', groupId)
    .eq('status', 'active');

  if (!members || members.length < 2) return null;

  const memberIds = members.map(m => m.user_id);

  // Progres v danej lekcii — admin client obíde RLS (vidíme všetkých členov)
  const admin = createAdminClient();
  const { data: progress } = await admin
    .from('user_lesson_progress')
    .select('user_id, status, xp_earned')
    .eq('lesson_id', lessonId)
    .in('user_id', memberIds);

  const progressMap = new Map((progress ?? []).map(p => [p.user_id, p]));

  let fullCount    = 0;
  let partialCount = 0;
  let notStarted   = 0;

  for (const memberId of memberIds) {
    if (memberId === user.id) continue; // seba nezapočítavaj
    const p = progressMap.get(memberId);
    if (!p) {
      notStarted++;
    } else if (p.status === 'completed' && (p.xp_earned ?? 0) > 10) {
      fullCount++;
    } else {
      partialCount++;
    }
  }

  return { fullCount, partialCount, notStarted, totalMembers: memberIds.length - 1 };
}

// ─── Progres skupiny pre celý kurz ───────────────────────────────────────────

export interface MemberCourseProgress {
  user_id: string;
  display_name: string;
  completed_count: number;
  xp_earned: number;
  is_me: boolean;
}

export async function getGroupCourseProgress(courseSlug: string): Promise<{
  groupName: string;
  members: MemberCourseProgress[];
} | null> {
  const { supabase, user } = await getUser();
  if (!user) return null;

  const { data: membership } = await supabase
    .from('group_members')
    .select('group_id, groups(name)')
    .eq('user_id', user.id)
    .eq('status', 'active')
    .maybeSingle();

  if (!membership) return null;

  const groupId = membership.group_id;
  const groupName = (membership.groups as unknown as { name: string } | null)?.name ?? 'Skupina';

  const { data: leaderboard } = await supabase
    .from('group_leaderboard')
    .select('user_id, display_name')
    .eq('group_id', groupId);

  if (!leaderboard || leaderboard.length === 0) return null;

  const memberIds = leaderboard.map(m => m.user_id);

  const admin = createAdminClient();
  const { data: progress } = await admin
    .from('user_lesson_progress')
    .select('user_id, xp_earned')
    .eq('course_slug', courseSlug)
    .eq('status', 'completed')
    .in('user_id', memberIds);

  const xpMap = new Map<string, { count: number; xp: number }>();
  for (const row of progress ?? []) {
    const cur = xpMap.get(row.user_id) ?? { count: 0, xp: 0 };
    xpMap.set(row.user_id, { count: cur.count + 1, xp: cur.xp + (row.xp_earned ?? 0) });
  }

  const members: MemberCourseProgress[] = leaderboard.map(m => {
    const stats = xpMap.get(m.user_id) ?? { count: 0, xp: 0 };
    return {
      user_id: m.user_id,
      display_name: m.display_name ?? 'Neznámy',
      completed_count: stats.count,
      xp_earned: stats.xp,
      is_me: m.user_id === user.id,
    };
  }).sort((a, b) => {
    if (a.is_me) return -1;
    if (b.is_me) return 1;
    return b.completed_count - a.completed_count;
  });

  return { groupName, members };
}

// ─── Detailné výsledky skupiny pre lekciu ─────────────────────────────────────

export interface LessonMemberResult {
  user_id: string;
  display_name: string;
  status: 'completed' | 'partial' | 'not_started';
  xp_earned: number;
  completed: boolean;
  isMe: boolean;
}

export async function getGroupLessonDetail(lessonId: string): Promise<{
  groupName: string;
  members: LessonMemberResult[];
} | null> {
  const { supabase, user } = await getUser();
  if (!user) return null;

  // Moje členstvo
  const { data: membership } = await supabase
    .from('group_members')
    .select('group_id, groups(name)')
    .eq('user_id', user.id)
    .eq('status', 'active')
    .maybeSingle();

  if (!membership) return null;

  const groupId = membership.group_id;
  const groupName = (membership.groups as unknown as { name: string } | null)?.name ?? 'Skupina';

  // Všetci aktívni členovia cez leaderboard view (má display_name)
  const { data: leaderboard } = await supabase
    .from('group_leaderboard')
    .select('user_id, display_name')
    .eq('group_id', groupId);

  if (!leaderboard || leaderboard.length === 0) return null;

  const memberIds = leaderboard.map(m => m.user_id);

  // Progres v tejto lekcii — admin client obíde RLS (vidíme všetkých členov)
  const admin = createAdminClient();
  const { data: progress } = await admin
    .from('user_lesson_progress')
    .select('user_id, status, xp_earned')
    .eq('lesson_id', lessonId)
    .in('user_id', memberIds);

  const progressMap = new Map((progress ?? []).map(p => [p.user_id, p]));

  const members: LessonMemberResult[] = leaderboard.map(m => {
    const p = progressMap.get(m.user_id);
    let status: LessonMemberResult['status'] = 'not_started';
    if (p) {
      status = p.status === 'completed' ? 'completed' : 'partial';
    }
    return {
      user_id: m.user_id,
      display_name: m.display_name ?? 'Neznámy',
      status,
      xp_earned: p?.xp_earned ?? 0,
      completed: p?.status === 'completed',
      isMe: m.user_id === user.id,
    };
  });

  // Zoraď: completed → partial → not_started, ja hore
  members.sort((a, b) => {
    if (a.isMe) return -1;
    if (b.isMe) return 1;
    const order = { completed: 0, partial: 1, not_started: 2 };
    return order[a.status] - order[b.status];
  });

  return { groupName, members };
}

// ─── Verejné skupiny (browse) ─────────────────────────────────────────────────

export interface PublicGroupEntry {
  id: string;
  name: string;
  description: string | null;
  rules: string | null;
  member_count: number;
  max_members: number;
}

export async function getPublicGroups(): Promise<PublicGroupEntry[]> {
  const { supabase, user } = await getUser();
  if (!user) return [];

  const { data: groups } = await supabase
    .from('groups')
    .select('id, name, description, rules, max_members')
    .eq('type', 'public')
    .eq('status', 'active')
    .order('created_at', { ascending: false })
    .limit(20);

  if (!groups || groups.length === 0) return [];

  const admin = createAdminClient();
  const { data: memberRows } = await admin
    .from('group_members')
    .select('group_id')
    .in('group_id', groups.map(g => g.id))
    .eq('status', 'active');

  const countMap = new Map<string, number>();
  for (const row of memberRows ?? []) {
    countMap.set(row.group_id, (countMap.get(row.group_id) ?? 0) + 1);
  }

  return groups
    .map(g => ({
      id: g.id,
      name: g.name,
      description: g.description,
      rules: g.rules,
      member_count: countMap.get(g.id) ?? 0,
      max_members: g.max_members,
    }))
    .filter(g => g.member_count < g.max_members);
}

export async function joinPublicGroup(
  groupId: string,
): Promise<{ error: string | null }> {
  if (!isUUID(groupId)) return { error: 'Neplatný identifikátor skupiny.' };

  const { supabase, user } = await getUser();
  if (!user) return { error: 'Nie si prihlásený.' };

  const { data: existing } = await supabase
    .from('group_members')
    .select('id')
    .eq('user_id', user.id)
    .eq('status', 'active')
    .maybeSingle();

  if (existing) return { error: 'Už si členom skupiny. Najprv ju opusti.' };

  const { data: group } = await supabase
    .from('groups')
    .select('id, name, type, max_members')
    .eq('id', groupId)
    .eq('type', 'public')
    .eq('status', 'active')
    .maybeSingle();

  if (!group) return { error: 'Skupina neexistuje alebo nie je verejná.' };

  const { count } = await supabase
    .from('group_members')
    .select('id', { count: 'exact', head: true })
    .eq('group_id', group.id)
    .eq('status', 'active');

  if ((count ?? 0) >= group.max_members) {
    return { error: `Skupina "${group.name}" je plná.` };
  }

  const { error: insertError } = await supabase
    .from('group_members')
    .insert({ group_id: group.id, user_id: user.id, role: 'member' });

  if (insertError) {
    if (insertError.code === '23P01' || insertError.message.includes('unique')) {
      return { error: 'Už si členom inej skupiny.' };
    }
    return { error: 'Nepodarilo sa pripojiť k skupine.' };
  }

  revalidatePath('/app/group');
  return { error: null };
}
