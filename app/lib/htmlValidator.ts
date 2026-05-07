// Deterministický HTML validátor — žiadna AI, čisté pravidlá

export type RuleType =
  | 'non_empty'
  | 'min_text_length'
  | 'max_text_length'
  | 'required_tag'
  | 'no_selector'
  | 'min_count'
  | 'max_count'
  | 'exact_count'
  | 'required_attr'
  | 'all_match_have_attr'
  | 'all_match_nonempty_attr'
  | 'all_match_attr_not_in'
  | 'forbidden_text'
  | 'text_includes'
  | 'attr_equals'
  | 'attr_includes'
  | 'attr_matches_regex'
  | 'attr_length_between'
  | 'not_identical_to_example'
  | 'similarity_check'
  | 'code_similarity_check'
  | 'labels_for_controls'
  | 'form_controls_have_name'
  | 'heading_hierarchy'
  | 'anchor_targets_exist'
  | 'external_link_secure'
  | 'same_attr_value'
  | 'min_distinct_attr_values'
  | 'select_first_option_empty'
  | 'table_rectangular'
  | 'raw_regex'
  | 'raw_not_regex'
  | 'raw_min_regex_count';

export interface BlockerRule {
  type: 'has_doctype' | 'has_tag';
  selector?: string;
  feedback: string;
}

export interface ValidationRule {
  id: string;
  type: RuleType;
  selector?: string;
  points: number;
  feedback: string;

  successLabel?: string;

  minLength?: number;
  maxLength?: number;
  minCount?: number;
  maxCount?: number;

  attr?: string;

  forbiddenTexts?: string[];
  requiredTexts?: string[];

  exampleValue?: string;
  expectedValue?: string;

  maxSimilarity?: number;
  similarityTarget?: string;

  caseInsensitive?: boolean;

  pattern?: string;
  flags?: string;

  minDistinct?: number;
}

export interface ValidationConfig {
  passThreshold: number;
  fullPassThreshold: number;
  exampleCode?: string;
  starterCode?: string;
  blockers?: BlockerRule[];
  rules: ValidationRule[];
}

export interface CheckResult {
  id: string;
  label: string;
  ok: boolean;
  points: number;
  earned: number;
  hint?: string;
  isPenalty?: boolean;
}

export interface ValidationResult {
  result: 'fail' | 'partial' | 'full';
  passed: boolean;
  score: number;
  checks: CheckResult[];
  feedback: string;
}

function normalizeWhitespace(value: string): string {
  return value.replace(/\s+/g, ' ').trim();
}

function normalizeCode(value: string): string {
  return value
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(/\s+/g, ' ')
    .replace(/>\s+</g, '><')
    .trim()
    .toLowerCase();
}

function jaccardSimilarity(a: string, b: string): number {
  const words = (s: string) =>
    new Set(
      s
        .toLowerCase()
        .split(/[^a-z0-9áäčďéěíĺľňóôŕšťúýž_-]+/i)
        .filter(w => w.length > 2),
    );

  const sa = words(a);
  const sb = words(b);
  const intersection = [...sa].filter(w => sb.has(w)).length;
  const union = new Set([...sa, ...sb]).size;

  if (union === 0) return 0;
  return intersection / union;
}

function getTextContent(doc: Document, selector?: string): string {
  if (!selector) return doc.body?.textContent ?? '';
  return doc.querySelector(selector)?.textContent ?? '';
}

function countRegexMatches(value: string, pattern: string, flags = 'gi'): number {
  try {
    const regex = new RegExp(pattern, flags.includes('g') ? flags : `${flags}g`);
    const matches = value.match(regex);
    return matches ? matches.length : 0;
  } catch {
    return 0;
  }
}

function hasAssociatedLabel(doc: Document, element: Element): boolean {
  if (element.closest('label')) return true;

  const id = element.getAttribute('id');
  if (!id) return false;

  return Array.from(doc.querySelectorAll('label')).some(
    label => label.getAttribute('for') === id,
  );
}

function headingHierarchyIsValid(doc: Document): boolean {
  const headings = Array.from(
    doc.querySelectorAll('h1, h2, h3, h4, h5, h6'),
  ) as HTMLElement[];

  if (headings.length === 0) return false;

  let previousLevel = Number(headings[0].tagName[1]);

  for (let i = 1; i < headings.length; i += 1) {
    const currentLevel = Number(headings[i].tagName[1]);
    if (currentLevel > previousLevel + 1) return false;
    previousLevel = currentLevel;
  }

  return true;
}

function externalLinkIsSecure(anchor: Element): boolean {
  const href = anchor.getAttribute('href') ?? '';
  if (!/^https?:\/\//i.test(href)) return false;
  if ((anchor.getAttribute('target') ?? '') !== '_blank') return false;

  const rel = (anchor.getAttribute('rel') ?? '').toLowerCase();
  return rel.includes('noopener') && rel.includes('noreferrer');
}

function tableIsRectangular(doc: Document, selector?: string): boolean {
  const table = (selector
    ? doc.querySelector(selector)
    : doc.querySelector('table')) as HTMLTableElement | null;

  if (!table) return false;

  const rows = Array.from(table.querySelectorAll('tr'));
  if (rows.length === 0) return false;

  const effectiveWidth = (row: Element) =>
    Array.from(row.children).reduce((sum, cell) => {
      const colspan = Number(cell.getAttribute('colspan') ?? '1');
      return sum + (Number.isFinite(colspan) && colspan > 0 ? colspan : 1);
    }, 0);

  const widths = rows.map(effectiveWidth).filter(Boolean);
  if (widths.length === 0) return false;

  return widths.every(w => w === widths[0]);
}

function prettyRuleLabel(rule: ValidationRule): string {
  if (rule.successLabel?.trim()) return rule.successLabel.trim();

  const map: Record<string, string> = {
    html_lang: 'element <html> má atribút lang',
    charset_meta: 'stránka obsahuje <meta charset>',
    viewport_meta: 'stránka obsahuje viewport meta tag',
    title_nonempty: 'tag <title> je vyplnený',
    title_min_length: 'title má dostatočnú dĺžku',
    h1_nonempty: 'tag <h1> je vyplnený',
    h1_min_length: 'nadpis h1 má dostatočnú dĺžku',
    p_nonempty: 'tag <p> je vyplnený',
    p_min_length: 'odsek má dostatočnú dĺžku',
    footer_nonempty: 'tag <footer> je vyplnený',
    name_nonempty: 'atribút name je vyplnený',
    main_has_id: 'element <main> má atribút id',
    circle_nonempty_css: 'kruh má nastavený obsah',
  };

  if (map[rule.id]) return map[rule.id];

  return rule.id
    .replace(/_/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function runHtmlValidation(
  code: string,
  config: ValidationConfig,
): ValidationResult {
  const quickFail = (feedback: string): ValidationResult => ({
    result: 'fail',
    passed: false,
    score: 0,
    checks: [],
    feedback,
  });

  if (!code || code.replace(/\s/g, '').length < 5) {
    return quickFail(
      'Odovzdal si prázdne riešenie. Napíš kód podľa zadania a skús znovu!',
    );
  }

  if (
    config.starterCode &&
    normalizeCode(code) === normalizeCode(config.starterCode)
  ) {
    return quickFail(
      'Kód si nezmenil — editor stále obsahuje iba starterový kód. Doplň vlastný obsah podľa zadania.',
    );
  }

  if (
    config.exampleCode &&
    normalizeCode(code) === normalizeCode(config.exampleCode)
  ) {
    return quickFail(
      'Riešenie je identické s ukážkou. Napíš vlastný obsah a vlastnú verziu zadania.',
    );
  }

  const parser = new DOMParser();
  const doc = parser.parseFromString(code, 'text/html');

  for (const blocker of config.blockers ?? []) {
    let ok = true;

    if (blocker.type === 'has_doctype') {
      ok = /^\s*<!doctype\s+html/i.test(code);
    } else if (blocker.type === 'has_tag' && blocker.selector) {
      ok = doc.querySelector(blocker.selector) !== null;
    }

    if (!ok) return quickFail(blocker.feedback);
  }

  const maxPoints = config.rules.reduce(
    (sum, rule) => sum + Math.max(0, rule.points),
    0,
  );

  const checks: CheckResult[] = [];
  let earned = 0;

  for (const rule of config.rules) {
    let ok = false;

    try {
      switch (rule.type) {
        case 'non_empty': {
          const el = doc.querySelector(rule.selector!);
          ok = !!el && (el.textContent?.trim().length ?? 0) > 0;
          break;
        }

        case 'min_text_length': {
          const els = doc.querySelectorAll(rule.selector!);
          ok = Array.from(els).some(
            el => (el.textContent?.trim().length ?? 0) >= (rule.minLength ?? 1),
          );
          break;
        }

        case 'max_text_length': {
          const el = doc.querySelector(rule.selector!);
          ok =
            !!el &&
            (el.textContent?.trim().length ?? 0) <= (rule.maxLength ?? Infinity);
          break;
        }

        case 'required_tag': {
          ok = doc.querySelector(rule.selector!) !== null;
          break;
        }

        case 'no_selector': {
          ok = doc.querySelector(rule.selector!) === null;
          break;
        }

        case 'min_count': {
          ok = doc.querySelectorAll(rule.selector!).length >= (rule.minCount ?? 1);
          break;
        }

        case 'max_count': {
          ok = doc.querySelectorAll(rule.selector!).length <= (rule.maxCount ?? 0);
          break;
        }

        case 'exact_count': {
          ok = doc.querySelectorAll(rule.selector!).length === (rule.minCount ?? 0);
          break;
        }

        case 'required_attr': {
          const el = doc.querySelector(rule.selector!);
          ok = !!el && el.hasAttribute(rule.attr!);
          break;
        }

        case 'all_match_have_attr': {
          const els = Array.from(doc.querySelectorAll(rule.selector!));
          ok = els.length > 0 && els.every(el => el.hasAttribute(rule.attr!));
          break;
        }

        case 'all_match_nonempty_attr': {
          const els = Array.from(doc.querySelectorAll(rule.selector!));
          ok =
            els.length > 0 &&
            els.every(el => (el.getAttribute(rule.attr!) ?? '').trim().length > 0);
          break;
        }

        case 'all_match_attr_not_in': {
          const els = Array.from(doc.querySelectorAll(rule.selector!));
          const forbidden = (rule.forbiddenTexts ?? []).map(value =>
            rule.caseInsensitive ? value.toLowerCase() : value,
          );

          ok =
            els.length > 0 &&
            els.every(el => {
              const raw = (el.getAttribute(rule.attr!) ?? '').trim();
              const value = rule.caseInsensitive ? raw.toLowerCase() : raw;
              return !forbidden.includes(value);
            });
          break;
        }

        case 'forbidden_text': {
          const text = getTextContent(doc, rule.selector).toLowerCase();
          ok = !(rule.forbiddenTexts ?? []).some(f =>
            text.includes(f.toLowerCase()),
          );
          break;
        }

        case 'text_includes': {
          const haystack = normalizeWhitespace(getTextContent(doc, rule.selector));
          ok =
            (rule.requiredTexts ?? []).length > 0 &&
            (rule.requiredTexts ?? []).every(text =>
              haystack.toLowerCase().includes(text.toLowerCase()),
            );
          break;
        }

        case 'attr_equals': {
          const el = doc.querySelector(rule.selector!);
          ok =
            !!el &&
            (el.getAttribute(rule.attr!) ?? '') === (rule.expectedValue ?? '');
          break;
        }

        case 'attr_includes': {
          const el = doc.querySelector(rule.selector!);
          const attrValue = el?.getAttribute(rule.attr!) ?? '';
          ok =
            !!el &&
            (rule.requiredTexts ?? []).every(text =>
              attrValue.toLowerCase().includes(text.toLowerCase()),
            );
          break;
        }

        case 'attr_matches_regex': {
          const el = doc.querySelector(rule.selector!);
          const attrValue = el?.getAttribute(rule.attr!) ?? '';
          ok =
            !!el && new RegExp(rule.pattern ?? '', rule.flags ?? '').test(attrValue);
          break;
        }

        case 'attr_length_between': {
          const el = doc.querySelector(rule.selector!);
          const value = (el?.getAttribute(rule.attr!) ?? '').trim();
          ok =
            !!el &&
            value.length >= (rule.minLength ?? 0) &&
            value.length <= (rule.maxLength ?? Infinity);
          break;
        }

        case 'not_identical_to_example': {
          const el = doc.querySelector(rule.selector!);
          const userText = (
            rule.caseInsensitive
              ? el?.textContent?.trim().toLowerCase()
              : el?.textContent?.trim()
          ) ?? '';

          const exampleText = rule.caseInsensitive
            ? (rule.exampleValue?.toLowerCase() ?? '')
            : (rule.exampleValue ?? '');

          ok = userText !== exampleText;
          break;
        }

        case 'similarity_check': {
          const bodyText = getTextContent(doc, rule.selector);
          const sim = jaccardSimilarity(bodyText, rule.similarityTarget ?? '');
          ok = sim < (rule.maxSimilarity ?? 0.7);
          break;
        }

        case 'code_similarity_check': {
          const sim = jaccardSimilarity(
            normalizeCode(code),
            normalizeCode(rule.similarityTarget ?? config.exampleCode ?? ''),
          );
          ok = sim < (rule.maxSimilarity ?? 0.9);
          break;
        }

        case 'labels_for_controls': {
          const els = Array.from(doc.querySelectorAll(rule.selector!));
          ok = els.length > 0 && els.every(el => hasAssociatedLabel(doc, el));
          break;
        }

        case 'form_controls_have_name': {
          const els = Array.from(doc.querySelectorAll(rule.selector!));
          ok =
            els.length > 0 &&
            els.every(el => (el.getAttribute('name') ?? '').trim().length > 0);
          break;
        }

        case 'heading_hierarchy': {
          ok = headingHierarchyIsValid(doc);
          break;
        }

        case 'anchor_targets_exist': {
          const els = Array.from(
            doc.querySelectorAll(rule.selector ?? 'a[href^="#"]'),
          );

          ok =
            els.length > 0 &&
            els.every(anchor => {
              const href = anchor.getAttribute('href') ?? '';
              if (href === '#' || !href.startsWith('#')) return false;

              const targetId = href.slice(1);
              return targetId.length > 0 && doc.getElementById(targetId) !== null;
            });
          break;
        }

        case 'external_link_secure': {
          const els = Array.from(
            doc.querySelectorAll(rule.selector ?? 'a[href^="http"]'),
          );
          ok = els.length > 0 && els.every(anchor => externalLinkIsSecure(anchor));
          break;
        }

        case 'same_attr_value': {
          const els = Array.from(doc.querySelectorAll(rule.selector!));
          const values = els
            .map(el => (el.getAttribute(rule.attr!) ?? '').trim())
            .filter(Boolean);

          ok = values.length >= (rule.minCount ?? 2) && new Set(values).size === 1;
          break;
        }

        case 'min_distinct_attr_values': {
          const els = Array.from(doc.querySelectorAll(rule.selector!));
          const values = els
            .map(el => (el.getAttribute(rule.attr!) ?? '').trim())
            .filter(Boolean);

          ok = new Set(values).size >= (rule.minDistinct ?? 1);
          break;
        }

        case 'select_first_option_empty': {
          const select = doc.querySelector(
            rule.selector ?? 'select',
          ) as HTMLSelectElement | null;

          const first = select?.querySelector('option');

          if (!select || !first) {
            ok = false;
            break;
          }

          const value = (first.getAttribute('value') ?? '').trim();
          ok = value === '';
          break;
        }

        case 'table_rectangular': {
          ok = tableIsRectangular(doc, rule.selector);
          break;
        }

        case 'raw_regex': {
          ok = new RegExp(rule.pattern ?? '', rule.flags ?? 'i').test(code);
          break;
        }

        case 'raw_not_regex': {
          ok = !new RegExp(rule.pattern ?? '', rule.flags ?? 'i').test(code);
          break;
        }

        case 'raw_min_regex_count': {
          ok =
            countRegexMatches(code, rule.pattern ?? '', rule.flags ?? 'gi') >=
            (rule.minCount ?? 1);
          break;
        }

        default: {
          ok = false;
          break;
        }
      }
    } catch {
      ok = false;
    }

    const pointsEarned = rule.points < 0
      ? (ok ? 0 : rule.points)   // penalty: 0 ak ok (nepotrestaný), záporné ak nie ok (potrestaný)
      : (ok ? rule.points : 0);  // pozitívne: body ak ok, 0 ak nie ok
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
      ? Math.min(
          100,
          Math.max(0, Math.round((Math.max(0, earned) / maxPoints) * 100)),
        )
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

  let feedback = '';

  if (result === 'full') {
    feedback = `Výborne! Zadanie je splnené (${score} %).`;
  } else {
    feedback = `Zadanie ešte nie je hotové na 100 % (${score} %).`;
  }

  if (passedChecks.length > 0) {
    feedback += `\n\n✅ Splnené:\n${passedChecks
      .map(c => `• ${c.label}`)
      .join('\n')}`;
  }

  if (failedChecks.length > 0) {
    feedback += `\n\n❌ Nesplnené:\n${failedChecks
      .map(c => `• ${c.hint ?? c.label}`)
      .join('\n')}`;
  }

  if (penaltyChecks.length > 0) {
    feedback += `\n\n⚠️ Pozor:\n${penaltyChecks
      .map(c => `• ${c.hint ?? c.label}`)
      .join('\n')}`;
  }

  return {
    result,
    passed: result !== 'fail',
    score,
    checks,
    feedback,
  };
}