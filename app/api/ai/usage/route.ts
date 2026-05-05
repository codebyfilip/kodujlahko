import { createClient } from '@/supabase/server';
import { createAdminClient } from '@/supabase/admin';

const DAILY_LIMIT = 20;

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return Response.json({ used: 0, remaining: DAILY_LIMIT, limit: DAILY_LIMIT });
  }

  const today = new Date().toISOString().split('T')[0];
  const admin = createAdminClient();

  const { data } = await admin
    .from('ai_usage')
    .select('count')
    .eq('user_id', user.id)
    .eq('date', today)
    .maybeSingle();

  const used = data?.count ?? 0;

  return Response.json({ used, remaining: DAILY_LIMIT - used, limit: DAILY_LIMIT });
}
