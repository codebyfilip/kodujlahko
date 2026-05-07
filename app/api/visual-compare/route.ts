import { NextRequest, NextResponse } from 'next/server';
import { PNG } from 'pngjs';

const VIEWPORT = { width: 400, height: 300 };
const TIMEOUT_MS = 8000;
const VISUAL_CATEGORIES = new Set(['html+css', 'html+css+js']);

function buildDoc(html: string, css: string, js: string): string {
  return `<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8">
<style>
*, *::before, *::after { box-sizing: border-box; }
html, body {
  margin: 0; padding: 0; overflow: hidden;
  width: ${VIEWPORT.width}px; height: ${VIEWPORT.height}px;
  font-family: Arial, sans-serif;
}
${css}
</style>
</head>
<body>
${html}
${js ? `<script>
try { ${js} } catch(e) { console.error('JS error:', e.message); }
</script>` : ''}
</body>
</html>`;
}

async function getLauncher() {
  if (process.env.VERCEL) {
    const chromium = (await import('@sparticuz/chromium')).default;
    const { chromium: pw } = await import('playwright-core');
    return { pw, args: chromium.args, executablePath: await chromium.executablePath() };
  }
  const { chromium: pw } = await import('playwright-core');
  return {
    pw,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'],
    executablePath: process.env.CHROMIUM_PATH ?? undefined,
  };
}

async function renderAndCapture(html: string, css: string, js: string): Promise<Buffer> {
  const { pw, args, executablePath } = await getLauncher();
  const browser = await pw.launch({ headless: true, args, executablePath });

  try {
    const page = await browser.newPage();
    await page.setViewportSize(VIEWPORT);

    await page.route('**/*', (route: { request: () => { url: () => string }; abort: () => void; continue: () => void }) => {
      const url = route.request().url();
      if (url.startsWith('data:') || url === 'about:blank' || url.startsWith('blob:')) {
        route.continue();
      } else {
        route.abort();
      }
    });

    const doc = buildDoc(html, css, js);
    await page.setContent(doc, { timeout: TIMEOUT_MS, waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(300);

    const buf = await page.screenshot({ type: 'png', clip: { x: 0, y: 0, ...VIEWPORT } });
    await page.close();
    return buf;
  } finally {
    await browser.close();
  }
}

function normalizeToSameSize(a: ReturnType<typeof PNG.sync.read>, b: ReturnType<typeof PNG.sync.read>): [ReturnType<typeof PNG.sync.read>, ReturnType<typeof PNG.sync.read>] {
  if (a.width === b.width && a.height === b.height) return [a, b];

  const w = Math.max(a.width, b.width);
  const h = Math.max(a.height, b.height);

  const expand = (src: ReturnType<typeof PNG.sync.read>): ReturnType<typeof PNG.sync.read> => {
    const out = new PNG({ width: w, height: h });
    for (let i = 0; i < out.data.length; i += 4) {
      out.data[i] = 255; out.data[i+1] = 255; out.data[i+2] = 255; out.data[i+3] = 255;
    }
    PNG.bitblt(src, out, 0, 0, src.width, src.height, 0, 0);
    return out as unknown as ReturnType<typeof PNG.sync.read>;
  };

  return [expand(a), expand(b)];
}

const BG_THRESHOLD = 30;
const SHAPE_CREDIT = 0.5;

function getBgColor(png: ReturnType<typeof PNG.sync.read>): [number, number, number] {
  const corners = [
    0,
    (png.width - 1) * 4,
    (png.height - 1) * png.width * 4,
    ((png.height - 1) * png.width + png.width - 1) * 4,
  ];
  const r = corners.reduce((s, i) => s + png.data[i], 0) / 4;
  const g = corners.reduce((s, i) => s + png.data[i + 1], 0) / 4;
  const b = corners.reduce((s, i) => s + png.data[i + 2], 0) / 4;
  return [Math.round(r), Math.round(g), Math.round(b)];
}

function isBg(r: number, g: number, b: number, bg: [number, number, number]): boolean {
  return Math.abs(r - bg[0]) + Math.abs(g - bg[1]) + Math.abs(b - bg[2]) < BG_THRESHOLD;
}

function compareImages(
  userBuf: Buffer,
  targetBuf: Buffer,
): { visualScore: number; diffPixels: number; totalPixels: number } {
  let userPng = PNG.sync.read(userBuf);
  let targetPng = PNG.sync.read(targetBuf);

  [userPng, targetPng] = normalizeToSameSize(userPng, targetPng);

  const { width, height } = targetPng;
  const totalPixels = width * height;
  const targetBgColor = getBgColor(targetPng);
  const userBgColor = getBgColor(userPng);

  let contentCount = 0;
  let overlapScore = 0;
  let userContentPixels = 0;

  for (let i = 0; i < totalPixels * 4; i += 4) {
    const tR = targetPng.data[i], tG = targetPng.data[i + 1], tB = targetPng.data[i + 2];
    const uR = userPng.data[i], uG = userPng.data[i + 1], uB = userPng.data[i + 2];

    const targetIsContent = !isBg(tR, tG, tB, targetBgColor);
    const userIsContent = !isBg(uR, uG, uB, userBgColor);

    if (userIsContent) userContentPixels++;
    if (!targetIsContent) continue;

    contentCount++;
    if (!userIsContent) continue;

    const colorSim = 1 - (Math.abs(tR - uR) + Math.abs(tG - uG) + Math.abs(tB - uB)) / (3 * 255);
    overlapScore += SHAPE_CREDIT + (1 - SHAPE_CREDIT) * colorSim;
  }

  // Background color similarity — penalizes wrong background color
  const bgColorSim = 1 - (
    Math.abs(targetBgColor[0] - userBgColor[0]) +
    Math.abs(targetBgColor[1] - userBgColor[1]) +
    Math.abs(targetBgColor[2] - userBgColor[2])
  ) / (3 * 255);

  console.log('[visual-compare] targetBg:', targetBgColor, 'userBg:', userBgColor, 'bgColorSim:', (bgColorSim * 100).toFixed(1) + '%');
  console.log('[visual-compare] contentCount:', contentCount, 'userContentPixels:', userContentPixels, 'overlapScore:', overlapScore.toFixed(0));

  if (contentCount === 0) {
    // Target has no detectable non-background content → full pixel comparison
    let match = 0;
    for (let j = 0; j < totalPixels * 4; j += 4) {
      const dr = Math.abs(targetPng.data[j] - userPng.data[j]);
      const dg = Math.abs(targetPng.data[j + 1] - userPng.data[j + 1]);
      const db = Math.abs(targetPng.data[j + 2] - userPng.data[j + 2]);
      if (dr + dg + db < BG_THRESHOLD) match++;
    }
    const score = Math.round((match / totalPixels) * 10000) / 100;
    console.log('[visual-compare] contentCount=0 fallback → score:', score);
    return { visualScore: score, diffPixels: totalPixels - match, totalPixels };
  }

  // 80% from content (position + color), 20% from background color match
  const contentAreaScore = overlapScore / contentCount;
  const presenceRatio = Math.min(1, userContentPixels / contentCount);
  const contentScore = 0.85 * contentAreaScore + 0.15 * presenceRatio;
  const raw = 0.8 * contentScore + 0.2 * bgColorSim;
  const visualScore = Math.round(raw * 10000) / 100;
  const diffPixels = Math.round((1 - raw) * contentCount);
  console.log('[visual-compare] contentScore:', (contentScore * 100).toFixed(1) + '%', 'bgColorSim:', (bgColorSim * 100).toFixed(1) + '%', '→ visualScore:', visualScore);
  return { visualScore, diffPixels, totalPixels };
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const {
      userHtml, userCss, userJs,
      targetHtml, targetCss, targetJs,
      category,
    } = body as {
      userHtml?: string; userCss?: string; userJs?: string;
      targetHtml?: string; targetCss?: string; targetJs?: string;
      category?: string;
    };

    if (!category || !VISUAL_CATEGORIES.has(category)) {
      return NextResponse.json(
        { error: `Vizuálne porovnanie nie je podporované pre kategóriu: ${category ?? 'neznáma'}` },
        { status: 400 },
      );
    }

    if (!targetHtml && !targetCss) {
      return NextResponse.json(
        { error: 'Chýba referenčný HTML/CSS pre vizuálne porovnanie.' },
        { status: 400 },
      );
    }

    const includeJs = category === 'html+css+js';

    const [userBuf, targetBuf] = await Promise.all([
      renderAndCapture(userHtml ?? '', userCss ?? '', includeJs ? (userJs ?? '') : ''),
      renderAndCapture(targetHtml ?? '', targetCss ?? '', includeJs ? (targetJs ?? '') : ''),
    ]);

    const { visualScore, diffPixels, totalPixels } = compareImages(userBuf, targetBuf);

    return NextResponse.json({
      visualScore,
      diffPixels,
      totalPixels,
      message: `Riešenie sa vizuálne zhoduje s predlohou na ${visualScore.toFixed(2)} %.`,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Neznáma chyba';
    console.error('[visual-compare]', message);
    return NextResponse.json({ error: `Screenshot zlyhal: ${message}` }, { status: 500 });
  }
}
