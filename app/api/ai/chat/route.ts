import { NextRequest } from 'next/server';
import OpenAI from 'openai';

const openai = new OpenAI({
  apiKey: process.env.OPEN_AI_API_KEY,
});

export async function POST(req: NextRequest) {
  const { code, question, language } = await req.json();

  if (!question?.trim()) {
    return new Response(JSON.stringify({ error: 'Question is required' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const systemPrompt = `Si AI tutor pre začiatočníkov v programovaní. Pomáhaš žiakom pochopiť ${language ?? 'HTML/CSS/JS'} kód.
Odpovedaj v slovenčine. Buď stručný, priateľský a zrozumiteľný – max 3–4 vety.
Ak je to vhodné, použi \`backtick\` pre kód a **tučné** pre dôležité pojmy.
Nikdy nedávaj dlhé prednášky – iba jadro veci.`;

  const userMessage = code?.trim()
    ? `Označený kód:\n\`\`\`${language ?? 'html'}\n${code}\n\`\`\`\n\nOtázka: ${question}`
    : `Otázka: ${question}`;

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
}
