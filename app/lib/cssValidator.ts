// Deterministický CSS validátor — žiadna AI, čisté pravidlá

export type CssRuleType =
  | 'has_rule'              // selektor { } existuje
  | 'has_property'          // selektor má property (akákoľvek hodnota)
  | 'has_value'             // selektor má property: value (contains match)
  | 'has_any_property'      // selektor má aspoň jednu z vlastností (properties[])
  | 'has_property_anywhere' // property existuje kdekoľvek v CSS
  | 'keyframes_exists'      // @keyframes s daným názvom existuje
  | 'css_var_defined'       // :root má --premennú
  | 'css_var_used'          // var(--premenna) je použitá kdekoľvek
  | 'has_media_query'       // @media query existuje
  | 'min_rule_count'        // aspoň N CSS pravidiel
  | 'has_html_tag'          // HTML tag existuje (pre zmiešané HTML+CSS úlohy)
  | 'has_html_tag_in'       // HTML tag je vnorený v rodičovi
  | 'html_attr_equals'      // HTML atribút má presnú hodnotu
  | 'not_identical_to_starter' // kód sa líši od starterového kódu
  | 'code_similarity_check' // kód nie je príliš podobný ukážke
  | 'raw_regex'             // ľubovoľný regex na celom kóde
  | 'raw_not_regex';        // regex nesmie matchovať

export interface CssBlockerRule {
  type: 'non_empty' | 'not_starter';
  feedback: string;
  starterCode?: string;
}

export interface CssValidationRule {
  id: string;
  type: CssRuleType;
  points: number;
  feedback: string;
  successLabel?: string;

  // CSS pravidlá
  selector?: string;      // napr. "h1", ".box", "#id", "h1:hover", ":root"
  property?: string;      // napr. "color", "font-size"
  value?: string;         // očakávaná hodnota (contains match, case-insensitive)
  properties?: string[];  // pre has_any_property — aspoň jedna z nich

  // @keyframes
  keyframeName?: string;  // napr. "fadeIn"

  // CSS premenné
  varName?: string;       // napr. "--primary"

  // HTML kontroly (pre úlohy s HTML+CSS)
  attr?: string;          // napr. "rel", "href"
  expectedValue?: string; // presná hodnota atribútu
  parent?: string;        // rodičský selektor, napr. "head"

  // min rule count
  minCount?: number;

  // similarity / raw
  pattern?: string;
  flags?: string;
  maxSimilarity?: number;
  similarityTarget?: string;
}

export interface CssValidationConfig {
  passThreshold: number;
  fullPassThreshold: number;
  starterCode?: string;
  exampleCode?: string;
  blockers?: CssBlockerRule[];
  rules: CssValidationRule[];
}

export interface CssCheckResult {
  id: string;
  label: string;
  ok: boolean;
  points: number;
  earned: number;
  hint?: string;
  isPenalty?: boolean;
}

export interface CssValidationResult {
  result: 'fail' | 'partial' | 'full';
  passed: boolean;
  score: number;
  checks: CssCheckResult[];
  feedback: string;
}

// ─── Pomocná funkcia: extrahuj CSS zo <style> tagu ────────────────────────────

function extractCssFromHtml(html: string): string {
  const match = html.match(/<style[^>]*>([\s\S]*?)<\/style>/i);
  return match ? match[1] : html;
}

// ─── CSS Parser ───────────────────────────────────────────────────────────────

interface CssRule {
  selectors: string[];            // každý selektor lowercase, trimmed
  props: Record<string, string>;  // property → value (lowercase prop, trimmed val)
}

interface ParsedCss {
  rules: CssRule[];
  keyframes: Set<string>;   // názvy @keyframes (lowercase)
  hasMediaQuery: boolean;
}

function parseCss(cssText: string): ParsedCss {
  const noComments = cssText.replace(/\/\*[\s\S]*?\*\//g, '');
  const rules: CssRule[] = [];
  const keyframes = new Set<string>();
  let hasMediaQuery = false;

  function parseBlock(src: string): void {
    let i = 0;
    while (i < src.length) {
      const openBrace = src.indexOf('{', i);
      if (openBrace === -1) break;

      const selectorPart = src.slice(i, openBrace).trim();

      // Nájdi uzatváraciu zátvorku s ohľadom na hĺbku
      let depth = 1;
      let j = openBrace + 1;
      while (j < src.length && depth > 0) {
        if (src[j] === '{') depth++;
        else if (src[j] === '}') depth--;
        j++;
      }

      const blockContent = src.slice(openBrace + 1, j - 1);
      i = j;

      // @keyframes — ulož názov, ignoruj obsah
      const kfMatch = selectorPart.match(/^@keyframes\s+(\S+)/i);
      if (kfMatch) {
        keyframes.add(kfMatch[1].toLowerCase());
        continue;
      }

      // @media, @supports — rekurzívne spracuj vnútorný obsah
      if (/^@media/i.test(selectorPart)) {
        hasMediaQuery = true;
        parseBlock(blockContent);
        continue;
      }

      // Ostatné @-pravidlá (napr. @supports, @layer)
      if (/^@/.test(selectorPart)) {
        parseBlock(blockContent);
        continue;
      }

      // Regulárne CSS pravidlo
      const selectors = selectorPart
        .split(',')
        .map(s => s.trim().toLowerCase())
        .filter(Boolean);

      if (selectors.length === 0) continue;

      const props: Record<string, string> = {};
      blockContent.split(';').forEach(decl => {
        const ci = decl.indexOf(':');
        if (ci === -1) return;
        const prop = decl.slice(0, ci).trim().toLowerCase();
        const val = decl.slice(ci + 1).trim();
        if (prop) props[prop] = val;
      });

      rules.push({ selectors, props });
    }
  }

  parseBlock(noComments);
  return { rules, keyframes, hasMediaQuery };
}

// ─── Pomocné funkcie pre kontroly ────────────────────────────────────────────

function matchesSelector(ruleSels: string[], target: string): boolean {
  const t = target.trim().toLowerCase();
  return ruleSels.some(s => s === t);
}

function rulesForSelector(rules: CssRule[], selector: string): CssRule[] {
  return rules.filter(r => matchesSelector(r.selectors, selector));
}

function cssHasRule(rules: CssRule[], selector: string): boolean {
  return rulesForSelector(rules, selector).length > 0;
}

function cssHasProperty(rules: CssRule[], selector: string, prop: string): boolean {
  return rulesForSelector(rules, selector).some(r => prop in r.props);
}

function cssHasValue(rules: CssRule[], selector: string, prop: string, val: string): boolean {
  const v = val.toLowerCase();
  return rulesForSelector(rules, selector).some(r => {
    const pv = r.props[prop]?.toLowerCase();
    return pv !== undefined && pv.includes(v);
  });
}

function cssHasAnyProperty(rules: CssRule[], selector: string, props: string[]): boolean {
  return props.some(p => cssHasProperty(rules, selector, p));
}

function cssHasPropertyAnywhere(rules: CssRule[], prop: string): boolean {
  return rules.some(r => prop in r.props);
}

function cssVarDefined(rules: CssRule[], varName: string): boolean {
  // CSS premenné sú v :root alebo html, property name je "--premenna"
  const vn = varName.toLowerCase();
  return rules.some(r =>
    r.selectors.some(s => s === ':root' || s === 'html') &&
    vn in r.props,
  );
}

function cssVarUsed(rules: CssRule[], varName: string): boolean {
  const needle = `var(${varName.toLowerCase()})`;
  return rules.some(r =>
    Object.values(r.props).some(v => v.toLowerCase().includes(needle)),
  );
}

// ─── Jaccard similarity (rovnaká ako v htmlValidator) ─────────────────────────

function jaccardSimilarity(a: string, b: string): number {
  const words = (s: string) =>
    new Set(
      s
        .toLowerCase()
        .replace(/\/\*[\s\S]*?\*\//g, '')
        .split(/[^a-z0-9_-]+/i)
        .filter(w => w.length > 2),
    );

  const sa = words(a);
  const sb = words(b);
  const intersection = [...sa].filter(w => sb.has(w)).length;
  const union = new Set([...sa, ...sb]).size;
  if (union === 0) return 0;
  return intersection / union;
}

function normalizeCode(value: string): string {
  return value
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
}

// ─── Label pre výpis výsledkov ────────────────────────────────────────────────

function prettyRuleLabel(rule: CssValidationRule): string {
  if (rule.successLabel?.trim()) return rule.successLabel.trim();
  return rule.id.replace(/_/g, ' ').replace(/\s+/g, ' ').trim();
}

// ─── Hlavná validačná funkcia ─────────────────────────────────────────────────

export function runCssValidation(
  code: string,
  config: CssValidationConfig,
): CssValidationResult {
  const quickFail = (feedback: string): CssValidationResult => ({
    result: 'fail',
    passed: false,
    score: 0,
    checks: [],
    feedback,
  });

  if (!code || code.replace(/\s/g, '').length < 5) {
    return quickFail('Odovzdal si prázdne riešenie. Napíš kód podľa zadania a skús znovu!');
  }

  // Porovnávaj len CSS časť (extrahuj zo <style> tagu ak je kód HTML)
  const cssOnly = (s: string) => /<html|<!doctype/i.test(s) ? extractCssFromHtml(s) : s;

  if (
    config.starterCode &&
    normalizeCode(cssOnly(code)) === normalizeCode(cssOnly(config.starterCode))
  ) {
    return quickFail(
      'Kód si nezmenil — editor stále obsahuje iba starterový kód. Doplň vlastné CSS podľa zadania.',
    );
  }

  if (
    config.exampleCode &&
    normalizeCode(cssOnly(code)) === normalizeCode(cssOnly(config.exampleCode))
  ) {
    return quickFail(
      'Riešenie je identické s ukážkou z lekcie. Napíš vlastnú verziu zadania.',
    );
  }

  // Parsuj len CSS (nie celý HTML dokument — oprava pre správne zistenie selektorov)
  const parsed = parseCss(cssOnly(code));
  const { rules, keyframes, hasMediaQuery } = parsed;

  // Pre HTML+CSS úlohy — parsuj aj ako HTML dokument (pre has_html_tag atď.)
  let htmlDoc: Document | null = null;
  if (/<html|<!doctype/i.test(code)) {
    try {
      htmlDoc = new DOMParser().parseFromString(code, 'text/html');
    } catch {
      htmlDoc = null;
    }
  }

  const maxPoints = config.rules.reduce((sum, r) => sum + Math.max(0, r.points), 0);
  const checks: CssCheckResult[] = [];
  let earned = 0;

  for (const rule of config.rules) {
    let ok = false;

    try {
      switch (rule.type) {
        case 'has_rule':
          ok = cssHasRule(rules, rule.selector!);
          break;

        case 'has_property':
          ok = cssHasProperty(rules, rule.selector!, rule.property!);
          break;

        case 'has_value':
          ok = cssHasValue(rules, rule.selector!, rule.property!, rule.value!);
          break;

        case 'has_any_property':
          ok = cssHasAnyProperty(rules, rule.selector!, rule.properties ?? []);
          break;

        case 'has_property_anywhere':
          ok = cssHasPropertyAnywhere(rules, rule.property!);
          break;

        case 'keyframes_exists':
          ok = keyframes.has((rule.keyframeName ?? '').toLowerCase());
          break;

        case 'css_var_defined':
          ok = cssVarDefined(rules, rule.varName!);
          break;

        case 'css_var_used':
          ok = cssVarUsed(rules, rule.varName!);
          break;

        case 'has_media_query':
          ok = hasMediaQuery;
          break;

        case 'min_rule_count':
          ok = rules.length >= (rule.minCount ?? 1);
          break;

        case 'has_html_tag':
          ok = !!htmlDoc?.querySelector(rule.selector!);
          break;

        case 'has_html_tag_in': {
          const parent = htmlDoc?.querySelector(rule.parent!);
          ok = !!parent && !!parent.querySelector(rule.selector!);
          break;
        }

        case 'html_attr_equals': {
          const el = htmlDoc?.querySelector(rule.selector!);
          ok = !!el && (el.getAttribute(rule.attr!) ?? '') === (rule.expectedValue ?? '');
          break;
        }

        case 'not_identical_to_starter':
          ok = !config.starterCode ||
            normalizeCode(code) !== normalizeCode(config.starterCode);
          break;

        case 'code_similarity_check': {
          const target = rule.similarityTarget ?? config.exampleCode ?? '';
          const sim = jaccardSimilarity(normalizeCode(code), normalizeCode(target));
          ok = sim < (rule.maxSimilarity ?? 0.9);
          break;
        }

        case 'raw_regex':
          ok = new RegExp(rule.pattern ?? '', rule.flags ?? 'i').test(code);
          break;

        case 'raw_not_regex':
          ok = !new RegExp(rule.pattern ?? '', rule.flags ?? 'i').test(code);
          break;

        default:
          ok = false;
      }
    } catch {
      ok = false;
    }

    const pointsEarned =
      rule.points < 0
        ? ok ? 0 : rule.points   // penalta: 0 ak ok, záporné ak nie ok
        : ok ? rule.points : 0;  // pozitívne: body ak ok, 0 ak nie

    earned += pointsEarned;

    checks.push({
      id: rule.id,
      label: prettyRuleLabel(rule),
      ok,
      points: rule.points,
      earned: pointsEarned,
      hint: ok ? undefined : rule.feedback,
      isPenalty: rule.points < 0,
    });
  }

  const score =
    maxPoints > 0
      ? Math.min(100, Math.max(0, Math.round((Math.max(0, earned) / maxPoints) * 100)))
      : 0;

  const result: 'fail' | 'partial' | 'full' =
    score >= config.fullPassThreshold
      ? 'full'
      : score >= config.passThreshold
        ? 'partial'
        : 'fail';

  const passedChecks = checks.filter(c => c.ok && c.points > 0);
  const failedChecks = checks.filter(c => !c.ok && c.points > 0);
  const penaltyChecks = checks.filter(c => !c.ok && c.points < 0);

  let feedback = result === 'full'
    ? `Výborne! Zadanie je splnené (${score} %).`
    : `Zadanie ešte nie je hotové na 100 % (${score} %).`;

  if (passedChecks.length > 0) {
    feedback += `\n\n✅ Splnené:\n${passedChecks.map(c => `• ${c.label}`).join('\n')}`;
  }
  if (failedChecks.length > 0) {
    feedback += `\n\n❌ Nesplnené:\n${failedChecks.map(c => `• ${c.hint ?? c.label}`).join('\n')}`;
  }
  if (penaltyChecks.length > 0) {
    feedback += `\n\n⚠️ Pozor:\n${penaltyChecks.map(c => `• ${c.hint ?? c.label}`).join('\n')}`;
  }

  return { result, passed: result !== 'fail', score, checks, feedback };
}
