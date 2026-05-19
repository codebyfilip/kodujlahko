'use server';

import { createClient } from '@/supabase/server';
import { createAdminClient } from '@/supabase/admin';
import { revalidatePath } from 'next/cache';

async function isUsernameTaken(username: string, excludeUserId: string): Promise<boolean> {
  const admin = createAdminClient();
  let page = 1;
  while (true) {
    const { data } = await admin.auth.admin.listUsers({ page, perPage: 1000 });
    if (!data?.users?.length) break;
    const taken = data.users.some((u) => {
      if (u.id === excludeUserId) return false;
      const uName =
        (u.user_metadata?.username as string | undefined) ||
        (u.user_metadata?.full_name as string | undefined) ||
        '';
      return uName.toLowerCase() === username.toLowerCase();
    });
    if (taken) return true;
    if (data.users.length < 1000) break;
    page++;
  }
  return false;
}

export async function updateDisplayName(name: string) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: 'Nie si prihlásený' };

  const trimmed = name.trim();
  if (!trimmed || trimmed.length < 2) return { error: 'Meno musí mať aspoň 2 znaky' };
  if (trimmed.length > 50) return { error: 'Meno môže mať max. 50 znakov' };

  if (await isUsernameTaken(trimmed, user.id)) {
    return { error: 'Toto meno je už obsadené, vyber iné.' };
  }

  const { error } = await supabase.auth.updateUser({
    data: { full_name: trimmed },
  });

  if (error) return { error: error.message };

  revalidatePath('/app');
  revalidatePath('/app/profile');
  return { error: null };
}

export async function updatePassword(newPassword: string) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: 'Nie si prihlásený' };

  const isGoogleUser = user.identities?.some((i) => i.provider === 'google') ?? false;
  if (isGoogleUser) return { error: 'Google účet nemôže meniť heslo tu. Zmeň ho v nastaveniach Google.' };

  if (newPassword.length < 8) return { error: 'Heslo musí mať aspoň 8 znakov' };

  const { error } = await supabase.auth.updateUser({ password: newPassword });

  if (error) return { error: error.message };

  return { error: null };
}
