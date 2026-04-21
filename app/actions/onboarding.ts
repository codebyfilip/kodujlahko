'use server';

import { createClient } from '@/supabase/server';

export async function markOnboardingDone(): Promise<void> {
  const supabase = await createClient();
  await supabase.auth.updateUser({ data: { onboarding_done: true } });
}
