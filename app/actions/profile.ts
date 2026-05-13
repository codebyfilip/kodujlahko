'use server';

import { createClient } from '@/supabase/server';
import { revalidatePath } from 'next/cache';

export async function updateDisplayName(name: string) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: 'Nie si prihlásený' };

  const trimmed = name.trim();
  if (!trimmed || trimmed.length < 2) return { error: 'Meno musí mať aspoň 2 znaky' };
  if (trimmed.length > 50) return { error: 'Meno môže mať max. 50 znakov' };

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
