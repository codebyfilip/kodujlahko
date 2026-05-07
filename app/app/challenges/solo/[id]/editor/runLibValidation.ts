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

const VISUAL_CATEGORIES = new Set(['html+css', 'html+css+js']);

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

async function computeVisualScore(
  html: string,
  css: string,
  js: string,
  target: { html: string; css: string; js: string },
  category: string,
  selectors: string[],
): Promise<{ simPct: number; error?: string }> {
  if (!VISUAL_CATEGORIES.has(category)) {
    return { simPct: 0, error: 'Vizuálne porovnanie nie je podporované pre túto kategóriu.' };
  }

  try {
    const res = await fetch('/api/visual-compare', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        userHtml: html,
        userCss: css,
        userJs: js,
        targetHtml: target.html,
        targetCss: target.css,
        targetJs: target.js,
        category,
        selectors,
      }),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: 'Neznáma chyba' }));
      return { simPct: 0, error: err.error ?? 'API chyba' };
    }

    const data = await res.json();
    return { simPct: Math.round(data.visualScore ?? 0) };
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Sieťová chyba';
    return { simPct: 0, error: msg };
  }
}

export async function runLibValidation(
  config: ChallengeValidationConfig,
  html: string,
  css: string,
  js: string,
  targetPreview?: { html: string; css: string; js: string } | null,
  category = 'html+css',
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

  // ─── Vizuálne porovnanie (Playwright screenshot) ──────────────────────────────
  // Spúšťa sa len pre html+css a html+css+js kategórie
  if (config.css_battle && targetPreview && VISUAL_CATEGORIES.has(category)) {
    const battlePoints = config.css_battle_points ?? 40;
    const { simPct, error } = await computeVisualScore(html, css, js, targetPreview, category, config.css_battle_selectors ?? []);
    const passed = simPct >= 60;
    const earned = Math.round((simPct / 100) * battlePoints);

    allChecks.push({
      id: 'css_battle',
      label: `Vizuálna zhoda s cieľom (${simPct}%)`,
      passed,
      points: battlePoints,
      earned,
      hint: error
        ? `Vizuálne porovnanie zlyhalo: ${error}`
        : passed
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
      if (r.points < 0) continue;
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
