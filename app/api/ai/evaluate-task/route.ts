import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';

const openai = new OpenAI({
  apiKey: process.env.OPEN_AI_API_KEY,
});

export async function POST(req: NextRequest) {
  try {
    const { code, criteria, language, taskTitle } = await req.json();

    if (!code || code.trim().length < 10) {
      return NextResponse.json({
        passed: false,
        message: 'Odovzdal si prázdne riešenie. Skús napísať kód podľa zadania a potom to vyhodnoť znovu. 💪',
        score: 0,
      });
    }

    const criteriaText = Array.isArray(criteria) && criteria.length > 0
      ? criteria.map((c: string, i: number) => `${i + 1}. ${c}`).join('\n')
      : 'Kód musí byť syntakticky správny a splniť zadanie.';

    const systemPrompt = `Si prísny, ale spravodlivý lektor programovania na platforme KóduĽahko, ktorá učí začiatočníkov HTML, CSS a JavaScript po slovensky.
Tvoja úloha: vyhodnotiť kód žiaka podľa zadaných kritérií.

Odpoveď MUSÍŠ vrátiť ako validný JSON v tomto tvare (nič iné, žiadny Markdown ani vysvetlivky navyše):
{
  "passed": true alebo false,
  "score": číslo 0-100,
  "message": "Správa pre žiaka v slovenčine"
}

Pravidlá hodnotenia:
- passed = true IBA ak sú VŠETKY kritériá splnené
- passed = false ak čokoľvek chýba alebo je nesprávne
- score = percentuálne hodnotenie splnenia kritérií (0-100)
- message musí byť v slovenčine, priateľská ale konkrétna
- Ak passed = true: pochváľ žiaka, povedz čo urobil dobre
- Ak passed = false: povedz KONKRÉTNE čo chýba alebo čo je zlé, podaj nápovedu ako to opraviť
- Ak je kód prázdny alebo nezmyselný: message musí byť povzbudzujúca výzva skúsiť znovu
- Nepoužívaj anglické termíny ak existuje slovenský ekvivalent`;

    const userMessage = `Úloha: ${taskTitle || 'Cvičenie'}
Jazyk: ${language || 'html'}

Kritériá hodnotenia:
${criteriaText}

Kód žiaka:
\`\`\`${language || 'html'}
${code}
\`\`\``;

    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userMessage },
      ],
      response_format: { type: 'json_object' },
      max_tokens: 512,
      temperature: 0.3,
    });

    const raw = response.choices[0].message.content ?? '{}';
    const result = JSON.parse(raw);

    return NextResponse.json({
      passed: Boolean(result.passed),
      score: typeof result.score === 'number' ? result.score : result.passed ? 100 : 0,
      message: typeof result.message === 'string' ? result.message : 'Vyhodnotenie dokončené.',
    });
  } catch (err) {
    console.error('evaluate-task error:', err);
    return NextResponse.json(
      { passed: false, score: 0, message: 'Chyba pri AI vyhodnotení. Skús znovu.' },
      { status: 500 }
    );
  }
}
