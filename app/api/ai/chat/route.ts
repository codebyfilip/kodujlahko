import { NextRequest } from 'next/server';
import OpenAI from 'openai';
import { createClient } from '@/supabase/server';
import { createAdminClient } from '@/supabase/admin';

const openai = new OpenAI({
  apiKey: process.env.OPEN_AI_API_KEY,
});

const DAILY_LIMIT = 20;

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return new Response(JSON.stringify({ error: 'Nie si prihlásený.' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const today = new Date().toISOString().split('T')[0];
  const admin = createAdminClient();

  const { data: usage } = await admin
    .from('ai_usage')
    .select('count')
    .eq('user_id', user.id)
    .eq('date', today)
    .maybeSingle();

  const currentCount = usage?.count ?? 0;

  if (currentCount >= DAILY_LIMIT) {
    return new Response(
      JSON.stringify({ error: 'Dosiahol si denný limit 20 otázok pre AI. Limit sa obnoví zajtra.' }),
      { status: 429, headers: { 'Content-Type': 'application/json' } },
    );
  }

  await admin
    .from('ai_usage')
    .upsert(
      { user_id: user.id, date: today, count: currentCount + 1 },
      { onConflict: 'user_id,date' },
    );

  const { code, question, language } = await req.json();

  if (!question?.trim()) {
    return new Response(JSON.stringify({ error: 'Question is required' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const systemPrompt = `Si AI Pomocník pre začiatočníkov v programovaní. Pomáhaš žiakom pochopiť ${language ?? 'HTML/CSS/JS'} kód.
Odpovedaj v slovenčine. Buď stručný, priateľský a zrozumiteľný – max 3–4 vety.
Ak je to vhodné, použi \`backtick\` pre kód a **tučné** pre dôležité pojmy.
Nikdy nedávaj dlhé prednášky – iba jadro veci.`;

  const userMessage = code?.trim()
    ? `Označený kód:\n\`\`\`${language ?? 'html'}\n${code}\n\`\`\`\n\nOtázka: ${question}`
    : `Otázka: ${question}`;

  if (!process.env.OPEN_AI_API_KEY) {
    console.error('[ai/chat] OPEN_AI_API_KEY is not set');
    return new Response(JSON.stringify({ error: 'AI nie je nakonfigurovaná. Kontaktuj administrátora.' }), {
      status: 503,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  try {
    const stream = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userMessage },
      ],
      max_tokens: 300,
      temperature: 0.7,
      stream: true,
    });

    const encoder = new TextEncoder();
    const readable = new ReadableStream({
      async start(controller) {
        for await (const chunk of stream) {
          const delta = chunk.choices[0]?.delta?.content;
          if (delta) {
            controller.enqueue(encoder.encode(delta));
          }
        }
        controller.close();
      },
    });

    return new Response(readable, {
      headers: {
        'Content-Type': 'text/plain; charset=utf-8',
        'Transfer-Encoding': 'chunked',
        'Cache-Control': 'no-cache',
      },
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Neznáma chyba';
    console.error('[ai/chat] OpenAI error:', msg);
    return new Response(JSON.stringify({ error: `AI chyba: ${msg}` }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}
