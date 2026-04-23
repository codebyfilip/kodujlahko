// Deterministický JavaScript validátor — žiadna AI, čisté pravidlá

export type JsRuleType =
  | 'has_variable'           // premenná je deklarovaná (let/const/var meno)
  | 'has_const'              // const meno je deklarovaná
  | 'has_let'                // let meno je deklarovaná
  | 'has_function_decl'      // funkcia je deklarovaná (function name alebo arrow)
  | 'has_function_call'      // funkcia je zavolaná (name())
  | 'has_method_call'        // metóda je zavolaná na objekte (obj.method())
  | 'has_console_log'        // console.log() je použité
  | 'console_log_contains'   // console.log() obsahuje konkrétnu hodnotu/text
  | 'has_dom_method'         // DOM metóda je použitá (getElementById, querySelector...)
  | 'has_event_listener'     // addEventListener je použité
  | 'has_property_set'       // vlastnosť je nastavená (.textContent = , .innerHTML = ...)
  | 'has_property_read'      // vlastnosť je čítaná (.value, .length...)
  | 'has_condition'          // if/else je použité
  | 'has_loop'               // for/while/forEach/map je použité
  | 'has_return'             // return je použité
  | 'has_string_value'       // konkrétny string sa nachádza v kóde
  | 'has_number'             // číslo sa nachádza v kóde
  | 'has_array_literal'      // pole [] je definované
  | 'has_object_literal'     // objekt {} je definovaný
  | 'has_class'              // class je definovaná
  | 'has_import'             // import statement existuje
  | 'has_template_literal'   // template literal `...` je použitý
  | 'has_ternary'            // ternárny operátor ? : je použitý
  | 'has_arrow_function'     // arrow funkcia => je použitá
  | 'min_line_count'         // aspoň N neprázdnych riadkov
  | 'not_identical_to_starter' // kód sa líši od starterového kódu
  | 'code_similarity_check'  // kód nie je príliš podobný ukážke (Jaccard)
  | 'raw_regex'              // ľubovoľný regex na celom kóde
  | 'raw_not_regex'          // regex nesmie matchovať
  | 'raw_min_regex_count';   // regex musí matchovať aspoň N-krát

export interface JsBlockerRule {
  type: 'non_empty' | 'not_starter' | 'syntax_hint' | 'raw_not_regex';
  feedback: string;
  starterCode?: string;
  pattern?: string;
  flags?: string;
}

export interface JsValidationRule {
  id: string;
  type: JsRuleType;
  points: number;
  feedback: string;
  successLabel?: string;

  // Názvy (premenné, funkcie, metódy)
  name?: string;        // napr. "nadpis", "klikni", "fetch"
  objectName?: string;  // napr. "document", "arr", "window"
  methodName?: string;  // napr. "getElementById", "push", "forEach"
  property?: string;    // napr. "textContent", "innerHTML", "value"
  eventType?: string;   // napr. "click", "input", "submit"

  // Hodnoty
  value?: string;       // obsahuje-match (case-insensitive)

  // Regex
  pattern?: string;
  flags?: string;

  // Počítanie
  minCount?: number;

  // Similarity
  maxSimilarity?: number;
  similarityTarget?: string;
}

export interface JsValidationConfig {
  passThreshold: number;
  fullPassThreshold: number;
  starterCode?: string;
  exampleCode?: string;
  blockers?: JsBlockerRule[];
  rules: JsValidationRule[];
}

export interface JsCheckResult {
  id: string;
  label: string;
  ok: boolean;
  points: number;
  earned: number;
  hint?: string;
  isPenalty?: boolean;
}

export interface JsValidationResult {
  result: 'fail' | 'partial' | 'full';
  passed: boolean;
  score: number;
  checks: JsCheckResult[];
  feedback: string;
}

// ─── Normalizácia ─────────────────────────────────────────────────────────────

function normalizeCode(code: string): string {
  return code
    .replace(/\/\/[^\n]*/g, '')        // odstráň jednoriadkové komentáre
    .replace(/\/\*[\s\S]*?\*\//g, '')  // odstráň blokové komentáre
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
}

function stripComments(code: string): string {
  return code
    .replace(/\/\/[^\n]*/g, '')
    .replace(/\/\*[\s\S]*?\*\//g, '');
}

function countNonEmptyLines(code: string): number {
  return code
    .split('\n')
    .filter(line => line.trim().length > 0)
    .length;
}

// ─── Jaccard similarity ───────────────────────────────────────────────────────

function jaccardSimilarity(a: string, b: string): number {
  const words = (s: string) =>
    new Set(
      s
        .toLowerCase()
        .replace(/\/\/[^\n]*/g, '')
        .replace(/\/\*[\s\S]*?\*\//g, '')
        .split(/[^a-z0-9_$]+/i)
        .filter(w => w.length > 1),
    );

  const sa = words(a);
  const sb = words(b);
  const intersection = [...sa].filter(w => sb.has(w)).length;
  const union = new Set([...sa, ...sb]).size;
  if (union === 0) return 0;
  return intersection / union;
}

// ─── Pomocné funkcie ──────────────────────────────────────────────────────────

/** Premenná je deklarovaná s daným kľúčovým slovom */
function hasDeclaration(code: string, keyword: 'let' | 'const' | 'var', name?: string): boolean {
  const stripped = stripComments(code);
  if (!name) {
    return new RegExp(`\\b${keyword}\\s+\\w`, 'i').test(stripped);
  }
  // const/let/var meno = ... (aj destructuring)
  return new RegExp(`\\b${keyword}\\s+(?:\\{[^}]*\\b${name}\\b[^}]*\\}|\\[.*?\\]|${name})\\s*[=,;\\)]`, 'i').test(stripped);
}

/** Akákoľvek deklarácia premennej (let/const/var) */
function hasVariable(code: string, name?: string): boolean {
  return (
    hasDeclaration(code, 'let', name) ||
    hasDeclaration(code, 'const', name) ||
    hasDeclaration(code, 'var', name)
  );
}

/** Funkcia je deklarovaná — function name() alebo const name = () => alebo const name = function */
function hasFunctionDecl(code: string, name?: string): boolean {
  const stripped = stripComments(code);
  if (!name) {
    return (
      /\bfunction\s+\w+\s*\(/.test(stripped) ||
      /\b(?:const|let|var)\s+\w+\s*=\s*(?:async\s*)?\(.*?\)\s*=>/.test(stripped) ||
      /\b(?:const|let|var)\s+\w+\s*=\s*(?:async\s*)?function\b/.test(stripped)
    );
  }
  return (
    new RegExp(`\\bfunction\\s+${name}\\s*\\(`, 'i').test(stripped) ||
    new RegExp(`\\b(?:const|let|var)\\s+${name}\\s*=\\s*(?:async\\s*)?(?:\\(.*?\\)|\\w+)\\s*=>`, 'i').test(stripped) ||
    new RegExp(`\\b(?:const|let|var)\\s+${name}\\s*=\\s*(?:async\\s*)?function\\b`, 'i').test(stripped)
  );
}

/** Funkcia je zavolaná — name(...) */
function hasFunctionCall(code: string, name: string): boolean {
  const stripped = stripComments(code);
  return new RegExp(`\\b${name}\\s*\\(`, 'i').test(stripped);
}

/** Metóda je zavolaná — [objectName.]methodName(...) */
function hasMethodCall(code: string, methodName: string, objectName?: string): boolean {
  const stripped = stripComments(code);
  if (objectName) {
    return new RegExp(`\\b${objectName}\\s*\\.\\s*${methodName}\\s*\\(`, 'i').test(stripped);
  }
  return new RegExp(`\\.\\s*${methodName}\\s*\\(`, 'i').test(stripped);
}

/** console.log() je použité */
function hasConsoleLog(code: string): boolean {
  return hasMethodCall(code, 'log', 'console');
}

/** console.log() obsahuje konkrétnu hodnotu — kontroluje runtime výstup aj source */
function consoleLogContains(code: string, value: string): boolean {
  const escaped = value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const stripped = stripComments(code);
  const isNumeric = /^\d+(\.\d+)?$/.test(value);

  // Pre čísla: zamietni ak je číslo natvrdo ako jediný argument — musí byť vypočítané
  if (isNumeric) {
    const isLiteralOnly = new RegExp(`console\\s*\\.\\s*log\\s*\\(\\s*(?:'${escaped}'|"${escaped}"|${escaped})\\s*\\)`, 'i');
    if (isLiteralOnly.test(stripped)) return false;
  }

  // Spusti kód a skontroluj skutočný výstup
  try {
    const outputs: string[] = [];
    const orig = console.log;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (console as any).log = (...args: unknown[]) => outputs.push(args.map(a => String(a)).join(' '));
    try {
      // eslint-disable-next-line no-new-func
      new Function(code)();
    } finally {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (console as any).log = orig;
    }
    const valueLower = value.toLowerCase();
    if (outputs.some(o => o.toLowerCase().includes(valueLower))) return true;
  } catch { /* fallback na statickú kontrolu */ }

  // Fallback: statická kontrola zdrojového kódu
  const matches = stripped.match(/console\s*\.\s*log\s*\(([\s\S]*?)\)/gi);
  if (!matches) return false;
  const v = value.toLowerCase();
  return matches.some(m => m.toLowerCase().includes(v));
}

/** DOM metóda je použitá */
const DOM_METHODS = [
  'getElementById', 'querySelector', 'querySelectorAll',
  'getElementsByClassName', 'getElementsByTagName',
  'createElement', 'appendChild', 'removeChild', 'insertBefore',
  'setAttribute', 'getAttribute', 'removeAttribute',
  'addEventListener', 'removeEventListener',
  'classList', 'style',
];

function hasDomMethod(code: string, methodName?: string): boolean {
  const stripped = stripComments(code);
  const methods = methodName ? [methodName] : DOM_METHODS;
  return methods.some(m => new RegExp(`\\.\\s*${m}\\b`, 'i').test(stripped));
}

/** addEventListener je použité */
function hasEventListener(code: string, eventType?: string): boolean {
  const stripped = stripComments(code);
  if (!eventType) {
    return /\.addEventListener\s*\(/i.test(stripped);
  }
  return new RegExp(`\\.addEventListener\\s*\\(\\s*['"\`]${eventType}['"\`]`, 'i').test(stripped);
}

/** Vlastnosť je nastavená — .property = */
function hasPropertySet(code: string, property: string): boolean {
  const stripped = stripComments(code);
  return new RegExp(`\\.\\s*${property}\\s*=(?!=)`, 'i').test(stripped);
}

/** Vlastnosť je čítaná — .property (bez priradenia za ňou) */
function hasPropertyRead(code: string, property: string): boolean {
  const stripped = stripComments(code);
  return new RegExp(`\\.\\s*${property}\\b`, 'i').test(stripped);
}

/** if alebo switch je použitý */
function hasCondition(code: string): boolean {
  const stripped = stripComments(code);
  return /\bif\s*\(/.test(stripped) || /\bswitch\s*\(/.test(stripped);
}

/** for, while, forEach, map, filter, reduce je použitý */
function hasLoop(code: string): boolean {
  const stripped = stripComments(code);
  return (
    /\bfor\s*\(/.test(stripped) ||
    /\bwhile\s*\(/.test(stripped) ||
    /\bdo\s*\{/.test(stripped) ||
    /\.forEach\s*\(/.test(stripped) ||
    /\.map\s*\(/.test(stripped) ||
    /\.filter\s*\(/.test(stripped) ||
    /\.reduce\s*\(/.test(stripped)
  );
}

/** return je použitý */
function hasReturn(code: string): boolean {
  return /\breturn\b/.test(stripComments(code));
}

/** Konkrétny string sa nachádza v kóde (v reťazci alebo kdekoľvek) */
function hasStringValue(code: string, value: string): boolean {
  const stripped = stripComments(code);
  const v = value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); // escape regex
  return new RegExp(`['"\`][^'"\`]*${v}[^'"\`]*['"\`]`, 'i').test(stripped);
}

/** Číslo sa nachádza v kóde */
function hasNumber(code: string, value?: string): boolean {
  const stripped = stripComments(code);
  if (value !== undefined) {
    return new RegExp(`\\b${value}\\b`).test(stripped);
  }
  return /\b\d+(\.\d+)?\b/.test(stripped);
}

/** Pole [] je definované */
function hasArrayLiteral(code: string): boolean {
  return /=\s*\[/.test(stripComments(code));
}

/** Objekt {} je definovaný (nie blok kódu) */
function hasObjectLiteral(code: string): boolean {
  // Hľadáme = { ... } alebo return { alebo ({ alebo [{ — signály objektu
  const stripped = stripComments(code);
  return /=\s*\{/.test(stripped) || /return\s*\{/.test(stripped) || /\(\s*\{/.test(stripped);
}

/** class je definovaná */
function hasClass(code: string, name?: string): boolean {
  const stripped = stripComments(code);
  if (!name) return /\bclass\s+\w+/.test(stripped);
  return new RegExp(`\\bclass\\s+${name}\\b`, 'i').test(stripped);
}

/** import statement existuje */
function hasImport(code: string): boolean {
  return /\bimport\b/.test(stripComments(code));
}

/** Template literal `...` je použitý */
function hasTemplateLiteral(code: string): boolean {
  return /`[^`]*`/.test(stripComments(code));
}

/** Ternárny operátor ? : */
function hasTernary(code: string): boolean {
  return /\?\s*[^:]+\s*:/.test(stripComments(code));
}

/** Arrow funkcia => */
function hasArrowFunction(code: string): boolean {
  return /=>/.test(stripComments(code));
}

/** Počet regex matchov */
function countRegexMatches(code: string, pattern: string, flags = 'gi'): number {
  try {
    const regex = new RegExp(pattern, flags.includes('g') ? flags : `${flags}g`);
    return (code.match(regex) ?? []).length;
  } catch {
    return 0;
  }
}

// ─── Label pre výpis výsledkov ────────────────────────────────────────────────

function prettyRuleLabel(rule: JsValidationRule): string {
  if (rule.successLabel?.trim()) return rule.successLabel.trim();
  return rule.id.replace(/_/g, ' ').replace(/\s+/g, ' ').trim();
}

// ─── Hlavná validačná funkcia ─────────────────────────────────────────────────

export function runJsValidation(
  code: string,
  config: JsValidationConfig,
): JsValidationResult {
  const quickFail = (feedback: string): JsValidationResult => ({
    result: 'fail',
    passed: false,
    score: 0,
    checks: [],
    feedback,
  });

  const onlyComments = code.replace(/\/\/[^\n]*/g, '').replace(/\/\*[\s\S]*?\*\//g, '').trim();
  if (!code || onlyComments.replace(/\s/g, '').length < 3) {
    return quickFail('Odovzdal si prázdne riešenie - editor neobsahuje žiadny kód. Napíš JavaScript podľa zadania.');
  }

  if (
    config.starterCode &&
    normalizeCode(code) === normalizeCode(config.starterCode)
  ) {
    return quickFail(
      'Nič si nezmenil - editor stále obsahuje iba starterový kód. Doplň vlastný JavaScript podľa zadania.',
    );
  }

  if (
    config.exampleCode &&
    normalizeCode(code) === normalizeCode(config.exampleCode)
  ) {
    return quickFail(
      'Riešenie je identické s ukážkou - napíš vlastnú verziu, nekopíruj ukážku.',
    );
  }

  // Syntax check — odhalí chyby ako chýbajúce závorky, nesprávne tokeny atď.
  try {
    // eslint-disable-next-line no-new-func
    new Function(code);
  } catch (e) {
    if (e instanceof SyntaxError) {
      return quickFail(`Kód obsahuje syntaktickú chybu - ${(e as SyntaxError).message}. Skontroluj závorky, úvodzovky a kľúčové slová.`);
    }
  }

  // Globálna kontrola: prázdne stringy v console volaniach
  if (/console\.(log|warn|error)\s*\(\s*['"]\s*['"]\s*\)/i.test(stripComments(code))) {
    return quickFail('Niektoré console volanie má prázdny string - vlož do zátvork skutočný text, nie len \'\' alebo "".');
  }

  // Blocker pravidlá — okamžité zlyhanie pred bodovaním
  if (config.blockers) {
    for (const blocker of config.blockers) {
      if (blocker.type === 'raw_not_regex' && blocker.pattern) {
        try {
          const regex = new RegExp(blocker.pattern, blocker.flags ?? 'i');
          if (regex.test(stripComments(code))) {
            return quickFail(blocker.feedback);
          }
        } catch { /* invalid regex — skip */ }
      }
    }
  }

  const maxPoints = config.rules.reduce((sum, r) => sum + Math.max(0, r.points), 0);
  const checks: JsCheckResult[] = [];
  let earned = 0;

  for (const rule of config.rules) {
    let ok = false;

    try {
      switch (rule.type) {
        case 'has_variable':
          ok = hasVariable(code, rule.name);
          break;

        case 'has_const':
          ok = hasDeclaration(code, 'const', rule.name);
          break;

        case 'has_let':
          ok = hasDeclaration(code, 'let', rule.name);
          break;

        case 'has_function_decl':
          ok = hasFunctionDecl(code, rule.name);
          break;

        case 'has_function_call':
          ok = hasFunctionCall(code, rule.name!);
          break;

        case 'has_method_call':
          ok = hasMethodCall(code, rule.methodName!, rule.objectName);
          break;

        case 'has_console_log':
          ok = hasConsoleLog(code);
          break;

        case 'console_log_contains':
          ok = consoleLogContains(code, rule.value!);
          break;

        case 'has_dom_method':
          ok = hasDomMethod(code, rule.methodName);
          break;

        case 'has_event_listener':
          ok = hasEventListener(code, rule.eventType);
          break;

        case 'has_property_set':
          ok = hasPropertySet(code, rule.property!);
          break;

        case 'has_property_read':
          ok = hasPropertyRead(code, rule.property!);
          break;

        case 'has_condition':
          ok = hasCondition(code);
          break;

        case 'has_loop':
          ok = hasLoop(code);
          break;

        case 'has_return':
          ok = hasReturn(code);
          break;

        case 'has_string_value':
          ok = hasStringValue(code, rule.value!);
          break;

        case 'has_number':
          ok = hasNumber(code, rule.value);
          break;

        case 'has_array_literal':
          ok = hasArrayLiteral(code);
          break;

        case 'has_object_literal':
          ok = hasObjectLiteral(code);
          break;

        case 'has_class':
          ok = hasClass(code, rule.name);
          break;

        case 'has_import':
          ok = hasImport(code);
          break;

        case 'has_template_literal':
          ok = hasTemplateLiteral(code);
          break;

        case 'has_ternary':
          ok = hasTernary(code);
          break;

        case 'has_arrow_function':
          ok = hasArrowFunction(code);
          break;

        case 'min_line_count':
          ok = countNonEmptyLines(code) >= (rule.minCount ?? 1);
          break;

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

        case 'raw_min_regex_count':
          ok = countRegexMatches(code, rule.pattern ?? '', rule.flags ?? 'gi') >= (rule.minCount ?? 1);
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
