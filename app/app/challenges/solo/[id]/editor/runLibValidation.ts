'use client';

import { runHtmlValidation, type ValidationConfig } from '@/app/lib/htmlValidator';
import { runCssValidation, type CssValidationConfig } from '@/app/lib/cssValidator';
import { runJsValidation, type JsValidationConfig } from '@/app/lib/jsValidator';

export type LibCheckResult = {
  id: string;
  label: string;
  passed: boolean;
  points: number;
  earned: number;
  hint?: string;
  isPenalty?: boolean;
};

export type LibValidationResult = {
  checks: LibCheckResult[];
  score: number;
  passed: boolean;
};

export type ChallengeValidationConfig = {
  min_score_to_pass: number;
  css_battle?: boolean;
  css_battle_selectors?: string[];
  css_battle_properties?: string[];
  css_battle_points?: number;
  html?: ValidationConfig;
  css?: CssValidationConfig;
  js?: JsValidationConfig;
};

function buildFullDoc(html: string, css: string, js = ''): string {
  const t = html.trim();
  const isFullDoc = /^<!doctype\s+html/i.test(t) || /^<html[\s>]/i.test(t);
  if (isFullDoc) {
    let doc = html;
    if (css) {
      doc = doc.includes('</head>')
        ? doc.replace('</head>', `<style>${css}</style></head>`)
        : `<style>${css}</style>` + doc;
    }
    if (js) {
      doc = doc.includes('</body>')
        ? doc.replace('</body>', `<script>${js}<\/script></body>`)
        : doc + `<script>${js}<\/script>`;
    }
    return doc;
  }
  return `<!doctype html><html lang="sk"><head><meta charset="UTF-8"><style>${css}</style></head><body>${html}<script>${js}<\/script></body></html>`;
}

function loadIframeForComparison(docHtml: string): Promise<HTMLIFrameElement> {
  return new Promise((resolve, reject) => {
    const iframe = document.createElement('iframe');
    iframe.style.cssText =
      'position:fixed;left:-9999px;top:-9999px;width:1280px;height:900px;visibility:hidden;pointer-events:none;';
    iframe.setAttribute('sandbox', 'allow-scripts allow-same-origin');
    document.body.appendChild(iframe);
    const timeout = setTimeout(() => reject(new Error('iframe timeout')), 6000);
    iframe.onload = () => { clearTimeout(timeout); resolve(iframe); };
    iframe.onerror = () => { clearTimeout(timeout); reject(new Error('iframe error')); };
    const blob = new Blob([docHtml], { type: 'text/html;charset=utf-8' });
    iframe.src = URL.createObjectURL(blob);
  });
}

const BATTLE_PROPS = [
  'background-color',
  'border-radius',
  'width',
  'height',
  'min-height',
  'max-width',
  'padding-top', 'padding-right', 'padding-bottom', 'padding-left',
  'margin-top', 'margin-right', 'margin-bottom', 'margin-left',
  'box-shadow',
  'border-top-width', 'border-bottom-width', 'border-left-width', 'border-right-width',
  'border-color',
  'opacity',
];

const LAYOUT_PROPS = [
  'display',
  'flex-direction',
  'justify-content',
  'align-items',
  'gap',
  'grid-template-columns',
  'place-items',
];

const BROWSER_DEFAULTS = new Set([
  'rgb(0, 0, 0)', 'rgba(0, 0, 0, 0)', 'row', 'start',
  '400', '16px', 'inline', 'visible', 'separate', 'clip',
]);

async function computeCssBattleScore(
  userDoc: string,
  targetDoc: string,
  selectors: string[],
  extraProps: string[],
): Promise<number> {
  const props = [...new Set([...BATTLE_PROPS, ...LAYOUT_PROPS, ...extraProps])];
  let userIframe: HTMLIFrameElement | null = null;
  let targetIframe: HTMLIFrameElement | null = null;

  try {
    [userIframe, targetIframe] = await Promise.all([
      loadIframeForComparison(userDoc),
      loadIframeForComparison(targetDoc),
    ]);

    const uDoc = userIframe.contentDocument!;
    const uWin = userIframe.contentWindow!;
    const tDoc = targetIframe.contentDocument!;
    const tWin = targetIframe.contentWindow!;

    let matches = 0;
    let total = 0;

    const IFRAME_W = 1280;
    const IFRAME_H = 900;
    const POS_TOLERANCE = 12;

    for (const sel of selectors) {
      const uEl = uDoc.querySelector(sel);
      const tEl = tDoc.querySelector(sel);
      if (!uEl || !tEl) continue;

      // ── CSS vlastnosti ──────────────────────────────────────────────────────
      const uStyle = uWin.getComputedStyle(uEl);
      const tStyle = tWin.getComputedStyle(tEl);

      for (const prop of props) {
        const uVal = uStyle.getPropertyValue(prop).trim();
        const tVal = tStyle.getPropertyValue(prop).trim();
        if (!tVal || tVal === 'none' || tVal === 'normal' || tVal === '0px' || tVal === 'auto') continue;
        if (BROWSER_DEFAULTS.has(tVal)) continue;
        total++;
        if (uVal === tVal) matches++;
      }

      // ── Poloha elementu (getBoundingClientRect) ─────────────────────────────
      const uRect = (uEl as HTMLElement).getBoundingClientRect();
      const tRect = (tEl as HTMLElement).getBoundingClientRect();

      // absolútna poloha
      const posChecks: [number, number][] = [
        [uRect.left,   tRect.left],
        [uRect.top,    tRect.top],
        [uRect.right,  tRect.right],
        [uRect.bottom, tRect.bottom],
        [uRect.width,  tRect.width],
        [uRect.height, tRect.height],
      ];

      // relatívne centrovanie — vzdialenosť stredu od stredu iframu
      const uCx = uRect.left + uRect.width  / 2;
      const uCy = uRect.top  + uRect.height / 2;
      const tCx = tRect.left + tRect.width  / 2;
      const tCy = tRect.top  + tRect.height / 2;
      // normalizujeme na percentá šírky/výšky aby sme porovnávali relatívne
      const uCxPct = uCx / IFRAME_W;
      const uCyPct = uCy / IFRAME_H;
      const tCxPct = tCx / IFRAME_W;
      const tCyPct = tCy / IFRAME_H;

      posChecks.forEach(([uVal, tVal]) => {
        total++;
        if (Math.abs(uVal - tVal) <= POS_TOLERANCE) matches++;
      });

      // centrovanie — s toleranciou 2% šírky/výšky
      total += 2;
      if (Math.abs(uCxPct - tCxPct) <= 0.02) matches++;
      if (Math.abs(uCyPct - tCyPct) <= 0.02) matches++;
    }

    return total > 0 ? (matches / total) * 100 : 0;
  } catch {
    return 0;
  } finally {
    if (userIframe) { URL.revokeObjectURL(userIframe.src); userIframe.remove(); }
    if (targetIframe) { URL.revokeObjectURL(targetIframe.src); targetIframe.remove(); }
  }
}

export async function runLibValidation(
  config: ChallengeValidationConfig,
  html: string,
  css: string,
  js: string,
  targetPreview?: { html: string; css: string; js: string } | null,
): Promise<LibValidationResult> {
  const allChecks: LibCheckResult[] = [];
  let totalPoints = 0;
  let earnedPoints = 0;

  // ─── HTML validator ───────────────────────────────────────────────────────────
  if (config.html) {
    const result = runHtmlValidation(html, config.html as ValidationConfig);
    for (const check of result.checks) {
      const earnedPts = check.earned;
      allChecks.push({
        id: `html_${check.id}`,
        label: check.label,
        passed: check.ok,
        points: check.points,
        earned: earnedPts,
        hint: check.ok ? undefined : check.hint,
        isPenalty: check.isPenalty,
      });
      totalPoints += Math.max(0, check.points);
      earnedPoints += earnedPts;
    }
  }

  // ─── CSS validator ────────────────────────────────────────────────────────────
  if (config.css) {
    const fullDoc = buildFullDoc(html, css);
    const result = runCssValidation(fullDoc, config.css as CssValidationConfig);
    for (const check of result.checks) {
      const earnedPts = check.earned;
      allChecks.push({
        id: `css_${check.id}`,
        label: check.label,
        passed: check.ok,
        points: check.points,
        earned: earnedPts,
        hint: check.ok ? undefined : check.hint,
        isPenalty: check.isPenalty,
      });
      totalPoints += Math.max(0, check.points);
      earnedPoints += earnedPts;
    }
  }

  // ─── JS validator ─────────────────────────────────────────────────────────────
  if (config.js) {
    const result = runJsValidation(js, config.js as JsValidationConfig);
    for (const check of result.checks) {
      const earnedPts = check.earned;
      allChecks.push({
        id: `js_${check.id}`,
        label: check.label,
        passed: check.ok,
        points: check.points,
        earned: earnedPts,
        hint: check.ok ? undefined : check.hint,
        isPenalty: check.isPenalty,
      });
      totalPoints += Math.max(0, check.points);
      earnedPoints += earnedPts;
    }
  }

  // ─── CSS battle ───────────────────────────────────────────────────────────────
  if (config.css_battle && targetPreview) {
    const battlePoints = config.css_battle_points ?? 40;
    const userDoc = buildFullDoc(html, css);
    const tgt = targetPreview;
    const targetDoc = buildFullDoc(tgt.html, tgt.css ?? '');
    const selectors = config.css_battle_selectors ?? ['body'];
    const extraProps = config.css_battle_properties ?? [];
    const similarity = await computeCssBattleScore(userDoc, targetDoc, selectors, extraProps);
    const simPct = Math.round(similarity);
    const passed = simPct >= 60;
    const earned = Math.round((simPct / 100) * battlePoints);

    allChecks.push({
      id: 'css_battle',
      label: `Vizuálna zhoda s cieľom (${simPct}%)`,
      passed,
      points: battlePoints,
      earned,
      hint: passed
        ? undefined
        : `Výsledok sa líši od referenčného preview (${simPct}% zhoda). Skontroluj farby, veľkosti a rozmiestnenie.`,
    });
    totalPoints += battlePoints;
    earnedPoints += earned;
  }

  const score =
    totalPoints > 0
      ? Math.min(100, Math.max(0, Math.round((earnedPoints / totalPoints) * 100)))
      : 0;
  const passed = score >= config.min_score_to_pass;

  return { checks: allChecks, score, passed };
}

/** Flat list of rule labels + points for the "Kritériá" panel (pre-validation). */
export function getValidationRuleSummary(
  config: ChallengeValidationConfig,
): { id: string; description: string; points: number }[] {
  const items: { id: string; description: string; points: number }[] = [];

  const addRules = (
    prefix: string,
    rules?: { id: string; feedback: string; successLabel?: string; points: number }[],
  ) => {
    for (const r of rules ?? []) {
      if (r.points < 0) continue; // skip penalties in display
      items.push({
        id: `${prefix}_${r.id}`,
        description: r.successLabel?.trim() || r.feedback,
        points: r.points,
      });
    }
  };

  addRules('html', (config.html as { rules?: { id: string; feedback: string; successLabel?: string; points: number }[] })?.rules);
  addRules('css', (config.css as { rules?: { id: string; feedback: string; successLabel?: string; points: number }[] })?.rules);
  addRules('js', (config.js as { rules?: { id: string; feedback: string; successLabel?: string; points: number }[] })?.rules);

  if (config.css_battle) {
    items.push({
      id: 'css_battle',
      description: 'Výsledok sa musí vizuálne podobať referenčnému preview.',
      points: config.css_battle_points ?? 40,
    });
  }

  return items;
}
