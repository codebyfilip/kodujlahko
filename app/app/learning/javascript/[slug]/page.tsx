'use client';

import { useCallback, useEffect, useRef, useState, KeyboardEvent } from 'react';
import { createPortal } from 'react-dom';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@/supabase/client';
import CodeMirror, { ReactCodeMirrorRef } from '@uiw/react-codemirror';
import { html as htmlLang } from '@codemirror/lang-html';
import { css as cssLang } from '@codemirror/lang-css';
import { javascript } from '@codemirror/lang-javascript';
import { EditorView } from '@codemirror/view';
import { HighlightStyle, syntaxHighlighting } from '@codemirror/language';
import { tags } from '@lezer/highlight';
import trackData from '../js.json';
import { runJsValidation, type JsValidationConfig } from '../../../../lib/jsValidator';
import {
  saveQuizAttempt,
  saveTaskSubmission,
  markLessonComplete,
  getLessonProgress,
  getTaskSubmission,
  updateStreak,
} from '../../../../actions/progres';
import GroupLessonPanel from '@/components/GroupLessonPanel';
import GroupLessonMenu from '@/components/GroupLessonMenu';

// ─── Types ─────────────────────────────────────────────────────────────────────
interface CodeData { language: string; value: string; }
interface Question {
  q: string; options: string[]; answer: string; why: string;
  question?: string; correctAnswer?: string; explanation?: string;
}
interface AiEvaluation {
  enabled: boolean; criteria: string[]; xpReward: number; feedbackType: string;
}
interface DragBlock { id: string; code: string; }
interface DragChallenge {
  description: string; blocks: DragBlock[]; correctOrder: string[];
  distractors?: DragBlock[]; successMessage: string;
}
interface TabData {
  label: string; language: string; value: string; editable?: boolean;
}
interface Section {
  type: string; title: string; content?: string[]; items?: unknown[];
  steps?: string[]; expectedOutput?: string[]; explanation?: string[];
  code?: CodeData; questions?: Question[];
  mission?: { goal?: string; options?: string[]; correctAnswer?: string; successMessage?: string; };
  subtitle?: string; instructions?: string[];
  starterCode?: CodeData; aiEvaluation?: AiEvaluation;
  validationConfig?: JsValidationConfig;
  xpReward?: number; challenge?: DragChallenge; requiredToComplete?: boolean;
  tabs?: TabData[]; previewCombined?: boolean; activeTabOnLoad?: number;
}
interface Lesson {
  id: string; lesson_id: string; quiz_id: string; task_id: string;
  order: number; slug: string; title: string; summary: string;
  estimatedMinutes: number; xp: number; sections: Section[];
  completionCriteria?: { requiredSections: string[]; minimumCorrectAnswers: number; totalXp: number; };
}
interface HistoryEntry { id: string; question: string; answer: string; selectedCode: string; }
interface BubblePos { top: number; left: number; }

// ─── Section meta ──────────────────────────────────────────────────────────────
const SECTION_META: Record<string, { icon: string; label: string; color: string }> = {
  intro:          { icon: '💡', label: 'Úvod',          color: '#7C3AED' },
  concept:        { icon: '📖', label: 'Pojmy',          color: '#2563EB' },
  example:        { icon: '💻', label: 'Ukážka kódu',   color: '#059669' },
  mentor_tip:     { icon: '🎯', label: 'Mentor tip',     color: '#D97706' },
  common_mistakes:{ icon: '⚠️', label: 'Časté chyby',   color: '#DC2626' },
  mini_task:      { icon: '✏️', label: 'Mini úloha',    color: '#7361FF' },
  self_check:     { icon: '✅', label: 'Skontroluj sa',  color: '#059669' },
  recap:          { icon: '🔁', label: 'Zhrnutie',       color: '#374151' },
  task:           { icon: '✏️', label: 'Úloha',          color: '#7361FF' },
  live_task:      { icon: '✏️', label: 'Úloha',          color: '#7361FF' },
  tip:            { icon: '💬', label: 'Tip',             color: '#D97706' },
  warning:        { icon: '⚠️', label: 'Pozor',          color: '#DC2626' },
  drag_and_drop:  { icon: '🧩', label: 'Drag & Drop',    color: '#7361FF' },
  tabbed_example: { icon: '💻', label: 'Ukážka kódu',    color: '#059669' },
  tabbed_task:    { icon: '✏️', label: 'Úloha',          color: '#7361FF' },
};

// ─── Language Colors ───────────────────────────────────────────────────────────
const LANG_COLOR: Record<string, string> = {
  html: '#E44D26', css: '#264DE4', javascript: '#F7DF1E', js: '#F7DF1E',
};

// ─── Utilities ─────────────────────────────────────────────────────────────────
function normalizeQuestions(section: Section): Question[] {
  const mapped: Question[] = [];
  if (section.questions?.length) {
    for (const q of section.questions) {
      if (q.q && q.answer && q.options?.length) {
        mapped.push({ q: q.q, options: q.options, answer: q.answer, why: q.why ?? '' });
        continue;
      }
      if (q.question && q.correctAnswer && q.options?.length) {
        const options = q.options.map((opt, i) => String.fromCharCode(65 + i) + ') ' + opt);
        const idx = q.options.findIndex(opt => opt === q.correctAnswer);
        mapped.push({ q: q.question, options, answer: String.fromCharCode(65 + (idx >= 0 ? idx : 0)), why: q.explanation ?? '' });
      }
    }
  }
  const rawItems = Array.isArray(section.items) ? section.items : [];
  for (const item of rawItems) {
    if (!item || typeof item !== 'object') continue;
    const it = item as Question;
    if (it.question && it.correctAnswer && it.options?.length) {
      const options = it.options.map((opt, i) => String.fromCharCode(65 + i) + ') ' + opt);
      const idx = it.options.findIndex(opt => opt === it.correctAnswer);
      mapped.push({ q: it.question, options, answer: String.fromCharCode(65 + (idx >= 0 ? idx : 0)), why: it.explanation ?? '' });
    }
  }
  if (section.type === 'interactive_check' && section.mission?.options?.length && section.mission.correctAnswer) {
    const options = section.mission.options.map((opt, i) => String.fromCharCode(65 + i) + ') ' + opt);
    const idx = section.mission.options.findIndex(opt => opt === section.mission?.correctAnswer);
    mapped.push({ q: section.mission.goal ?? section.title, options, answer: String.fromCharCode(65 + (idx >= 0 ? idx : 0)), why: section.mission.successMessage ?? '' });
  }
  return mapped;
}

function parseInline(text: string) {
  const parts: React.ReactNode[] = [];
  const regex = /`([^`]+)`|\*\*([^*]+)\*\*|::([^:]+)::|~~([^~]+)~~|\[([^\]]+)\]\(([^)]+)\)|_([^_]+)_/g;
  let last = 0, match: RegExpExecArray | null;
  while ((match = regex.exec(text)) !== null) {
    if (match.index > last) parts.push(text.slice(last, match.index));
    if (match[1]) parts.push(<code key={match.index} style={{ fontFamily: '"JetBrains Mono",monospace', fontSize: '0.88em', background: '#1A1A2E', color: '#CDD6F4', padding: '2px 6px', borderRadius: '5px', border: '1px solid #2D2D3F' }}>{match[1]}</code>);
    else if (match[2]) parts.push(<strong key={match.index} style={{ fontWeight: 700 }}>{match[2]}</strong>);
    else if (match[3]) parts.push(<span key={match.index} style={{ color: '#7361FF', fontWeight: 600 }}>{match[3]}</span>);
    else if (match[4]) parts.push(<span key={match.index} style={{ textDecoration: 'line-through', color: '#7361FF' }}>{match[4]}</span>);
    else if (match[5] && match[6]) parts.push(<a key={match.index} href={match[6]} target="_blank" rel="noopener noreferrer" style={{ color: '#7361FF', textDecoration: 'underline' }}>{match[5]}</a>);
    else if (match[7]) parts.push(<em key={match.index} style={{ fontStyle: 'italic' }}>{match[7]}</em>);
    last = regex.lastIndex;
  }
  if (last < text.length) parts.push(text.slice(last));
  return parts;
}

const vsCodeHighlight = syntaxHighlighting(HighlightStyle.define([
  // Comments
  { tag: tags.comment,                    color: '#6A9955', fontStyle: 'italic' },
  { tag: tags.lineComment,                color: '#6A9955', fontStyle: 'italic' },
  { tag: tags.blockComment,               color: '#6A9955', fontStyle: 'italic' },
  // Keywords
  { tag: tags.keyword,                    color: '#569CD6' },
  { tag: tags.controlKeyword,             color: '#C586C0' },
  { tag: tags.moduleKeyword,              color: '#569CD6' },
  { tag: tags.operatorKeyword,            color: '#569CD6' },
  // Strings
  { tag: tags.string,                     color: '#CE9178' },
  { tag: tags.special(tags.string),       color: '#CE9178' },
  { tag: tags.regexp,                     color: '#D16969' },
  // Numbers & booleans
  { tag: tags.number,                     color: '#B5CEA8' },
  { tag: tags.bool,                       color: '#569CD6' },
  { tag: tags.null,                       color: '#569CD6' },
  // Functions
  { tag: tags.function(tags.variableName), color: '#DCDCAA' },
  { tag: tags.function(tags.propertyName), color: '#DCDCAA' },
  // Types & classes
  { tag: tags.typeName,                   color: '#4EC9B0' },
  { tag: tags.className,                  color: '#4EC9B0' },
  { tag: tags.definition(tags.typeName),  color: '#4EC9B0' },
  // Variables & parameters
  { tag: tags.variableName,               color: '#9CDCFE' },
  { tag: tags.definition(tags.variableName), color: '#9CDCFE' },
  { tag: tags.local(tags.variableName),   color: '#9CDCFE' },
  { tag: tags.special(tags.variableName), color: '#9CDCFE' },
  // Properties
  { tag: tags.propertyName,               color: '#9CDCFE' },
  // Operators & punctuation
  { tag: tags.operator,                   color: '#D4D4D4' },
  { tag: tags.punctuation,                color: '#D4D4D4' },
  { tag: tags.bracket,                    color: '#D4D4D4' },
  // HTML tags & attributes
  { tag: tags.tagName,                    color: '#569CD6' },
  { tag: tags.attributeName,              color: '#9CDCFE' },
  { tag: tags.attributeValue,             color: '#CE9178' },
  { tag: tags.angleBracket,               color: '#808080' },
  { tag: tags.meta,                       color: '#808080' },
  // CSS
  { tag: tags.atom,                       color: '#D4D4D4' },
  { tag: tags.unit,                       color: '#B5CEA8' },
  { tag: tags.color,                      color: '#CE9178' },
  { tag: tags.self,                       color: '#569CD6' },
]));

const cmDarkTheme = EditorView.theme({
  '&': { fontSize: '13.5px', fontFamily: '"JetBrains Mono",monospace', backgroundColor: '#1A1A2E', color: '#CDD6F4' },
  '.cm-content': { padding: '16px 20px', minHeight: '140px' },
  '.cm-focused': { outline: 'none' },
  '.cm-line': { lineHeight: '1.7' },
  '.cm-cursor': { borderLeftColor: '#7361FF', borderLeftWidth: '2px' },
  '.cm-selectionBackground, &.cm-focused .cm-selectionBackground': { backgroundColor: 'rgba(115,97,255,0.35) !important' },
  '.cm-gutters': { backgroundColor: '#14142A', borderRight: '1px solid #2D2D3F', color: '#555570' },
  '.cm-activeLineGutter': { backgroundColor: '#1E1E38' },
  '.cm-activeLine': { backgroundColor: 'rgba(115,97,255,0.06)' },
  '.cm-scroller': { overflow: 'auto' },
});

function getLang(lang: string) {
  if (lang === 'css') return [cssLang(), vsCodeHighlight];
  if (lang === 'js' || lang === 'javascript') return [javascript(), vsCodeHighlight];
  return [htmlLang(), vsCodeHighlight];
}

// ─── TaskResult helpers ────────────────────────────────────────────────────────
type TaskResult = 'none' | 'fail' | 'partial' | 'full';

function getLessonAwardXp(taskResult: TaskResult, fullXp: number, score: number = 0) {
  if (taskResult === 'none' || taskResult === 'fail') return 0;
  if (taskResult === 'full') return fullXp;
  return score >= 50 ? 10 : 0;
}

function extractAwardedXp(source: unknown, fallback: number | null = null): number | null {
  if (!source || typeof source !== 'object') return fallback;
  const s = source as Record<string, unknown>;
  const candidates = [s.xpAwarded, s.awardedXp, s.xp_awarded, s.awarded_xp];
  for (const v of candidates) {
    if (typeof v === 'number' && Number.isFinite(v)) return v;
  }
  return fallback;
}

// ─── evaluateCode ──────────────────────────────────────────────────────────────
function evaluateCode(code: string, criteria: string[]): { passed: boolean; score: number; message: string } {
  if (!code || code.trim().length < 3) {
    return { passed: false, score: 0, message: '📝 Odovzdal si prázdne riešenie. Napíš kód podľa zadania a skús znovu!' };
  }

  const hasVar = (name: string) => new RegExp(`(const|let|var)\\s+${name}\\s*=`).test(code);
  const hasGetById = (id: string) => code.includes(`getElementById('${id}')`) || code.includes(`getElementById("${id}")`);
  const hasOnclick = () => code.includes('.onclick') || code.includes('addEventListener') || code.toLowerCase().includes('onclick');
  const hasTextContent = () => code.includes('.textContent') || code.includes('.innerText') || code.includes('.innerHTML');
  const jsHasText = (text: string) => code.includes(`'${text}'`) || code.includes(`"${text}"`);

  type CR = { label: string; ok: boolean; hint: string };
  const results: CR[] = criteria.map((criterion) => {
    const c = criterion.toLowerCase();

    // — premenna nadpis
    if (c.includes('premenn') && c.includes('nadpis')) return {
      label: criterion, hint: "Vytvor premennú `nadpis` pomocou `document.getElementById('nadpis')`.",
      ok: hasVar('nadpis') && hasGetById('nadpis'),
    };
    // — premenna sprava
    if (c.includes('premenn') && c.includes('sprava')) return {
      label: criterion, hint: "Vytvor premennú `sprava` pomocou `document.getElementById('sprava')`.",
      ok: hasVar('sprava') && hasGetById('sprava'),
    };
    // — premenna btn
    if (c.includes('premenn') && c.includes('btn')) return {
      label: criterion, hint: "Vytvor premennú `btn` pomocou `document.getElementById('btn')`.",
      ok: hasVar('btn') && hasGetById('btn'),
    };
    // — onclick / addEventListener
    if (c.includes('onclick') || c.includes('addeventlistener') || c.includes('click')) return {
      label: criterion, hint: 'Prirad `btn.onclick = function() { ... }` alebo `btn.addEventListener("click", ...)`.',
      ok: hasOnclick(),
    };
    // — textContent zmena
    if (c.includes('textcontent') || (c.includes('men') && c.includes('text'))) return {
      label: criterion, hint: 'Zmeň `.textContent` alebo `.innerText` elementu.',
      ok: hasTextContent(),
    };
    // — konkrétne texty
    if (c.includes('javascript ma ozivil') || c.includes('javascript ma oživil')) return {
      label: criterion, hint: "Text musí byť presne: `'JavaScript ma oživil!'`",
      ok: jsHasText('JavaScript ma ozivil!') || jsHasText('JavaScript ma oživil!'),
    };
    if (c.includes('funguje to')) return {
      label: criterion, hint: "Nový text musí byť presne: `'Funguje to!'`",
      ok: jsHasText('Funguje to!'),
    };
    if (c.includes('ahoj, javascript')) return {
      label: criterion, hint: "Text musí byť: `'Ahoj, JavaScript!'`",
      ok: jsHasText('Ahoj, JavaScript!'),
    };

    // — HTML fallback
    const parser = new DOMParser();
    const doc = parser.parseFromString(code, 'text/html');
    const hasTag = (tag: string) => code.toLowerCase().includes(`<${tag}`);
    const hasNonEmptyEl = (sel: string) => { const el = doc.querySelector(sel); return !!el && (el.textContent?.trim().length ?? 0) > 0; };
    if (c.includes('doctype')) return { label: criterion, hint: 'Pridaj <!DOCTYPE html>.', ok: /^\s*<!doctype\s+html/i.test(code) };
    if (c.includes('title')) return { label: criterion, hint: 'Pridaj <title> s textom.', ok: hasNonEmptyEl('title') };
    if (c.includes('charset')) return { label: criterion, hint: 'Pridaj <meta charset="UTF-8">.', ok: code.toLowerCase().includes('charset=') };
    const hMatch = c.match(/<h([1-6])>/) || c.match(/\bh([1-6])\b/);
    if (hMatch) return { label: criterion, hint: `Pridaj <h${hMatch[1]}> s textom.`, ok: hasNonEmptyEl(`h${hMatch[1]}`) };
    if (c.includes('<p>') || c.includes('odsek')) return { label: criterion, hint: 'Pridaj <p> tag s textom.', ok: Array.from(doc.querySelectorAll('p')).some(p => p.textContent!.trim().length > 0) };
    const tagMatches = [...criterion.matchAll(/<([a-zA-Z][a-zA-Z0-9]*)/g)].map(m => m[1].toLowerCase());
    if (tagMatches.length > 0) return { label: criterion, hint: `Skontroluj tagy: ${tagMatches.map(t => `<${t}>`).join(', ')}`, ok: tagMatches.every(tag => hasTag(tag)) };
    return { label: criterion, hint: `Skontroluj: ${criterion}`, ok: true };
  });

  const passedCount = results.filter(r => r.ok).length;
  const total = results.length;
  const score = total > 0 ? Math.round((passedCount / total) * 100) : 100;
  const allPassed = passedCount === total;

  let message: string;
  if (allPassed) {
    message = `🎉 Výborne! Všetky podmienky splnené.\n\n${results.map(r => `✅ ${r.label}`).join('\n')}`;
  } else {
    const failed = results.filter(r => !r.ok);
    const passed = results.filter(r => r.ok);
    message = `Splnené ${passedCount} z ${total} podmienok.\n\n`;
    if (passed.length) message += `✅ OK:\n${passed.map(r => `  • ${r.label}`).join('\n')}\n\n`;
    message += `❌ Chýba:\n${failed.map(r => `  • ${r.hint}`).join('\n')}`;
  }
  return { passed: allPassed, score, message };
}

// ─── buildCombinedDoc ─────────────────────────────────────────────────────────
const JS_INTERCEPTOR = `const _s=v=>typeof v==='object'?JSON.stringify(v,null,2):String(v);const _p=(t,...a)=>window.parent.postMessage({t,d:a.map(_s).join(' ')},'*');console.log=(...a)=>_p('log',...a);console.warn=(...a)=>_p('warn',...a);console.error=(...a)=>_p('err',...a);window.alert=m=>_p('alert',String(m));`;

function buildCombinedDoc(tabs: TabData[]): string {
  const htmlTab = tabs.find(t => t.language === 'html');
  const cssTab  = tabs.find(t => t.language === 'css');
  const jsTab   = tabs.find(t => t.language === 'javascript' || t.language === 'js');
  if (!htmlTab) {
    if (!jsTab) return '';
    return `<!doctype html><html><head><meta charset="UTF-8"></head><body><script>${JS_INTERCEPTOR}try{\n${jsTab.value}\n}catch(e){}<\/script></body></html>`;
  }
  let src = htmlTab.value;
  if (cssTab?.value) src = src.replace('</head>', `<style>\n${cssTab.value}\n</style>\n</head>`);
  if (jsTab?.value?.trim()) src = src.replace('</body>', `<script>${JS_INTERCEPTOR}try{\n${jsTab.value}\n}catch(e){}<\/script>\n</body>`);
  return src;
}

// ─── LivePreviewPane ──────────────────────────────────────────────────────────
function LivePreviewPane({ doc, hasJs = false, jsOnly = false }: { doc: string; hasJs?: boolean; jsOnly?: boolean }) {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [consoleLines, setConsoleLines] = useState<Array<{ t: string; text: string }>>([]);
  const [flashKey, setFlashKey] = useState(0);
  const isFirstRender = useRef(true);

  useEffect(() => {
    const iframe = iframeRef.current;
    if (!iframe) return;
    if (hasJs) setConsoleLines([]);
    if (!doc) return;
    iframe.srcdoc = doc;
    if (!isFirstRender.current) setFlashKey(k => k + 1);
    isFirstRender.current = false;
  }, [doc, hasJs]);

  useEffect(() => {
    if (!hasJs) return;
    const handler = (e: MessageEvent) => {
      try { if (!iframeRef.current || e.source !== iframeRef.current.contentWindow) return; } catch { return; }
      const { t, d } = e.data ?? {};
      if (t === 'log' || t === 'warn' || t === 'err' || t === 'alert') setConsoleLines(prev => [...prev, { t, text: String(d) }]);
    };
    window.addEventListener('message', handler);
    return () => window.removeEventListener('message', handler);
  }, [hasJs]);

  const consolePanelJsx = (
    <div className="js-console">
      <div className="js-console-bar">
        <span className="js-console-title">▶ Console</span>
        <button className="js-console-clear" onClick={() => setConsoleLines([])}>Clear</button>
      </div>
      <div className="js-console-output">
        {consoleLines.length === 0 && <div className="js-console-empty">{'// výstup console.log sa objaví tu'}</div>}
        {consoleLines.map((line, i) => (
          <div key={i} className={`js-console-line js-console-${line.t}`}>
            {line.t === 'alert' && <span className="js-console-tag">alert</span>}
            {line.t === 'warn' && <span className="js-console-icon">⚠</span>}
            {line.t === 'err' && <span className="js-console-icon">✕</span>}
            {line.text}
          </div>
        ))}
      </div>
    </div>
  );

  if (jsOnly) {
    return (
      <div className="cm-preview-chrome">
        {consolePanelJsx}
        <iframe ref={iframeRef} sandbox="allow-scripts" style={{ display: 'none' }} title="JS executor" />
      </div>
    );
  }

  return (
    <div className="cm-preview-chrome">
      <div key={flashKey} className="cm-preview-bar cm-preview-bar-flash">
        <div className="cm-preview-dots">
          <div className="cm-dot" style={{ background: '#FF5F57', opacity: 0.35 }} />
          <div className="cm-dot" style={{ background: '#FFBD2E', opacity: 0.35 }} />
          <div className="cm-dot" style={{ background: '#28C840', opacity: 0.35 }} />
        </div>
        <div className="cm-preview-address">
          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ color: '#10B981', flexShrink: 0 }}><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
          <span>náhľad</span>
        </div>
        <div className="cm-live-badge"><div className="cm-live-dot" /><span>Live</span></div>
      </div>
      <iframe ref={iframeRef} className="cm-preview-iframe" sandbox="allow-scripts" title="Live preview" />
    </div>
  );
}

// ─── TabbedCodeBlock (editable, tabbed_example) ───────────────────────────────
function TabbedCodeBlock({ section }: { section: Section }) {
  const tabs = section.tabs ?? [];
  const [activeTab, setActiveTab] = useState(0);
  const [tabValues, setTabValues] = useState<string[]>(tabs.map(t => t.value));
  const liveTabs: TabData[] = tabs.map((t, i) => ({ ...t, value: tabValues[i] }));
  const combinedDoc = buildCombinedDoc(liveTabs);
  const hasJs = tabs.some(t => t.language === 'javascript' || t.language === 'js');
  const jsOnly = hasJs && !tabs.some(t => t.language === 'html');

  return (
    <div className="tabs-root">
      <div className="tabs-header">
        <div className="tabs-nav">
          {tabs.map((tab, i) => (
            <button key={i} className={`tab-btn ${activeTab === i ? 'tab-btn-active' : ''}`} onClick={() => setActiveTab(i)}>
              <span className="tab-dot" style={{ background: LANG_COLOR[tab.language] ?? '#888' }} />
              {tab.label}
            </button>
          ))}
        </div>
        <span className="tabs-hint">Prepínaj záložky — náhľad kombinuje všetky</span>
      </div>

      <div className="tabs-body">
        <div className="tabs-editor-pane">
          <div className="tabs-editor-bar">
            <div className="cm-dots">
              <div className="cm-dot" style={{ background: '#FF5F57' }} />
              <div className="cm-dot" style={{ background: '#FFBD2E' }} />
              <div className="cm-dot" style={{ background: '#28C840' }} />
            </div>
            <span className="cm-lang-badge" style={{ color: LANG_COLOR[tabs[activeTab]?.language] ?? '#7C6AF7' }}>
              {tabs[activeTab]?.language.toUpperCase()}
            </span>
            <span className="tab-filename">
              {tabs[activeTab]?.language === 'html' ? 'index.html' : tabs[activeTab]?.language === 'css' ? 'style.css' : 'script.js'}
            </span>
          </div>
          {tabs.map((tab, i) => (
            <div key={i} style={{ display: activeTab === i ? 'block' : 'none' }}>
              <CodeMirror value={tabValues[i]} onChange={v => setTabValues(vals => { const n = [...vals]; n[i] = v; return n; })}
                extensions={[getLang(tab.language), cmDarkTheme]} theme="none"
                height="280px" basicSetup={{ lineNumbers: true, highlightActiveLine: true, autocompletion: false, foldGutter: false }} />
            </div>
          ))}
        </div>
        <div className="tabs-preview-pane">
          <LivePreviewPane doc={combinedDoc} hasJs={hasJs} jsOnly={jsOnly} />
        </div>
      </div>

      {section.explanation && section.explanation.length > 0 && (
        <div className="tabs-explanation">
          {section.explanation.map((e, i) => (
            <div key={i} className="expl-item"><span className="expl-arrow">→</span><span>{parseInline(e)}</span></div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── TabbedTaskBlock (editable JS tab, tabbed_task) ──────────────────────────
function TabbedTaskBlock({ section, lessonId, taskId, lessonXp, onPassed, onAttempted }: {
  section: Section; lessonId: string; taskId: string; lessonXp?: number;
  onPassed?: (result: Exclude<TaskResult, 'none'>, score?: number) => void; onAttempted?: () => void;
}) {
  const tabs = section.tabs ?? [];
  const [activeTab, setActiveTab] = useState(section.activeTabOnLoad ?? 2);
  const [tabValues, setTabValues] = useState<string[]>(tabs.map(t => t.value));
  const [evalState, setEvalState] = useState<'idle' | 'loading' | 'done'>('idle');
  const [evalResult, setEvalResult] = useState<{ ok: boolean; message: string } | null>(null);
  const [isPassed, setIsPassed] = useState(false);
  const [showRetry, setShowRetry] = useState(false);
  const [earnedResult, setEarnedResult] = useState<Exclude<TaskResult, 'none'> | null>(null);
  const passedRef = useRef(false);
  const attemptedRef = useRef(false);

  const jsTabIdx = tabs.findIndex(t => t.language === 'javascript' || t.language === 'js');
  const jsCode = jsTabIdx >= 0 ? tabValues[jsTabIdx] : '';

  // Combined doc for live preview
  const liveTabs: TabData[] = tabs.map((t, i) => ({ ...t, value: tabValues[i] }));
  const combinedDoc = buildCombinedDoc(liveTabs);
  const hasJs = tabs.some(t => t.language === 'javascript' || t.language === 'js');
  const jsOnly = hasJs && !tabs.some(t => t.language === 'html');

  useEffect(() => {
    if (!lessonId || !taskId) return;
    getTaskSubmission(lessonId, taskId).then((sub) => {
      if (!sub) return;
      const subResult: Exclude<TaskResult, 'none'> = sub.passed ? 'full' : (sub.score ?? 0) >= 40 ? 'partial' : 'fail';
      if (!attemptedRef.current) { attemptedRef.current = true; onAttempted?.(); }
      onPassed?.(subResult, sub.score ?? 0);
      setEarnedResult(subResult);
      if (jsTabIdx >= 0) {
        const newVals = [...tabs.map(t => t.value)];
        newVals[jsTabIdx] = sub.code;
        setTabValues(newVals);
      }
      setEvalResult({ ok: sub.passed, message: sub.feedback });
      setEvalState('done');
      if (sub.passed) {
        passedRef.current = true;
        setIsPassed(true);
      }
    });
  }, [lessonId, taskId]);

  const handleEvaluate = async () => {
    setEvalState('loading');
    setEvalResult(null);
    await new Promise(r => setTimeout(r, 700));
    let passed: boolean, score: number, message: string;
    let taskResult: Exclude<TaskResult, 'none'>;
    if (section.validationConfig) {
      const res = runJsValidation(jsCode, section.validationConfig);
      taskResult = res.result === 'full' ? 'full' : res.result === 'partial' ? 'partial' : 'fail';
      passed = taskResult === 'full';
      score = res.score; message = res.feedback;
    } else {
      ({ passed, score, message } = evaluateCode(jsCode, section.aiEvaluation?.criteria ?? []));
      taskResult = passed ? 'full' : score >= 40 ? 'partial' : 'fail';
    }
    const xpEarned = getLessonAwardXp(taskResult, lessonXp ?? 0, score);
    await saveTaskSubmission({ lessonId, taskId, code: jsCode, passed, score, feedback: message, xpEarned });
    if (!attemptedRef.current) { attemptedRef.current = true; onAttempted?.(); }
    onPassed?.(taskResult, score);
    setEarnedResult(taskResult);
    setEvalResult({ ok: passed, message });
    setEvalState('done');
    if (passed) {
      setIsPassed(true);
      setShowRetry(false);
      passedRef.current = true;
    }
  };

  if (isPassed && !showRetry) {
    return (
      <div className="ttask-root">
        <div className="ttask-success-banner">
          <div className="ttask-success-left">
            <span className="ttask-success-emoji">🎉</span>
            <div>
              <div className="ttask-success-title">Úloha splnená!</div>
              <div className="ttask-success-sub">+{earnedResult === 'full' ? (lessonXp ?? section.aiEvaluation?.xpReward ?? 0) : 10} XP získané</div>
            </div>
          </div>
          <button className="ttask-retry-btn" onClick={() => { setShowRetry(true); setEvalState('idle'); setEvalResult(null); }}>
            ↺ Skúsiť znovu
          </button>
        </div>

        <div className="tabs-root" style={{ marginTop: 0 }}>
          <div className="tabs-header">
            <div className="tabs-nav">
              {tabs.map((tab, i) => (
                <button key={i} className={`tab-btn ${activeTab === i ? 'tab-btn-active' : ''}`} onClick={() => setActiveTab(i)}>
                  <span className="tab-dot" style={{ background: LANG_COLOR[tab.language] ?? '#888' }} />
                  {tab.label}
                  <span className="tab-lock-badge">{tab.editable ? '✏️' : '🔒'}</span>
                </button>
              ))}
            </div>
          </div>
          <div className="tabs-body">
            <div className="tabs-editor-pane">
              <div className="tabs-editor-bar">
                <div className="cm-dots"><div className="cm-dot" style={{ background: '#FF5F57' }}/><div className="cm-dot" style={{ background: '#FFBD2E' }}/><div className="cm-dot" style={{ background: '#28C840' }}/></div>
                <span className="cm-lang-badge" style={{ color: LANG_COLOR[tabs[activeTab]?.language] ?? '#7C6AF7' }}>{tabs[activeTab]?.language.toUpperCase()}</span>
                <span className="tab-filename">{tabs[activeTab]?.language === 'html' ? 'index.html' : tabs[activeTab]?.language === 'css' ? 'style.css' : 'script.js'}</span>
                <span style={{ marginLeft: 'auto', fontSize: '11px', fontWeight: 700, color: '#10B981', fontFamily: 'Nunito,sans-serif' }}>✓ Splnené</span>
              </div>
              {tabs.map((tab, i) => (
                <div key={i} style={{ display: activeTab === i ? 'block' : 'none' }}>
                  <CodeMirror value={tabValues[i]} editable={false} extensions={[getLang(tab.language), cmDarkTheme]} theme="none"
                    height="260px" basicSetup={{ lineNumbers: true, highlightActiveLine: false, autocompletion: false, foldGutter: false }} />
                </div>
              ))}
            </div>
            <div className="tabs-preview-pane"><LivePreviewPane doc={combinedDoc} hasJs={hasJs} jsOnly={jsOnly} /></div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="ttask-root">
      {section.instructions && section.instructions.length > 0 && (
        <div className="ttask-instructions">
          <div className="ttask-instr-label">📋 Zadanie</div>
          <ol className="ttask-instr-list">
            {section.instructions.map((instr, i) => (
              <li key={i} className="ttask-instr-item">
                <span className="ttask-instr-num">{i + 1}</span>
                <span>{parseInline(instr)}</span>
              </li>
            ))}
          </ol>
        </div>
      )}

      <div className="tabs-root" style={{ marginTop: section.instructions ? 20 : 0 }}>
        <div className="tabs-header">
          <div className="tabs-nav">
            {tabs.map((tab, i) => (
              <button key={i} className={`tab-btn ${activeTab === i ? 'tab-btn-active' : ''}`} onClick={() => setActiveTab(i)}>
                <span className="tab-dot" style={{ background: LANG_COLOR[tab.language] ?? '#888' }} />
                {tab.label}
                <span className="tab-lock-badge">{tab.editable ? '✏️ Sem píš' : '🔒'}</span>
              </button>
            ))}
          </div>
          <span className="tabs-hint">JavaScript záložka je editovateľná</span>
        </div>

        <div className="tabs-body">
          <div className="tabs-editor-pane">
            <div className="tabs-editor-bar">
              <div className="cm-dots"><div className="cm-dot" style={{ background: '#FF5F57' }}/><div className="cm-dot" style={{ background: '#FFBD2E' }}/><div className="cm-dot" style={{ background: '#28C840' }}/></div>
              <span className="cm-lang-badge" style={{ color: LANG_COLOR[tabs[activeTab]?.language] ?? '#7C6AF7' }}>{tabs[activeTab]?.language.toUpperCase()}</span>
              <span className="tab-filename">{tabs[activeTab]?.language === 'html' ? 'index.html' : tabs[activeTab]?.language === 'css' ? 'style.css' : 'script.js'}</span>
              {tabs[activeTab]?.editable && (
                <span style={{ marginLeft: 'auto', fontSize: '11px', fontWeight: 700, color: '#F7DF1E', fontFamily: 'Nunito,sans-serif', background: 'rgba(247,223,30,0.1)', padding: '2px 8px', borderRadius: '6px' }}>✏️ Editovateľné</span>
              )}
              {!tabs[activeTab]?.editable && (
                <span style={{ marginLeft: 'auto', fontSize: '11px', fontWeight: 700, color: '#555570', fontFamily: 'Nunito,sans-serif' }}>🔒 Len na čítanie</span>
              )}
            </div>

            {tabs.map((tab, i) => (
              <div key={i} style={{ display: activeTab === i ? 'block' : 'none' }}>
                <CodeMirror
                  value={tabValues[i]}
                  editable={tab.editable !== false ? (tab.editable ?? false) : false}
                  onChange={(val) => {
                    if (!tab.editable) return;
                    const newVals = [...tabValues];
                    newVals[i] = val;
                    setTabValues(newVals);
                    if (evalState === 'done') setEvalState('idle');
                  }}
                  extensions={[getLang(tab.language), cmDarkTheme]}
                  theme="none"
                  height="300px"
                  basicSetup={{ lineNumbers: true, highlightActiveLine: tab.editable ?? false, autocompletion: false, foldGutter: false }}
                />
              </div>
            ))}
          </div>
          <div className="tabs-preview-pane"><LivePreviewPane doc={combinedDoc} hasJs={hasJs} jsOnly={jsOnly} /></div>
        </div>
      </div>

      {/* Eval footer */}
      <div className="task-footer">
        <button className="task-eval-btn" onClick={handleEvaluate} disabled={evalState === 'loading'}>
          {evalState === 'loading'
            ? <span className="task-eval-loading"><span className="ld"/><span className="ld"/><span className="ld"/> Vyhodnocujem...</span>
            : '✨ Vyhodnotiť'}
        </button>
      </div>

      {evalState === 'done' && evalResult && (
        <div className={`ttask-result ${evalResult.ok ? 'ttask-result-ok' : 'ttask-result-fail'}`}>
          <span className="ttask-result-icon">{evalResult.ok ? '🎉' : '💡'}</span>
          <div className="ttask-result-text" style={{ whiteSpace: 'pre-line' }}>{evalResult.message}</div>
        </div>
      )}
    </div>
  );
}

// ─── DragAndDropBlock ─────────────────────────────────────────────────────────
function DragAndDropBlock({ section, lessonId, quizId, onDone }: { section: Section; lessonId: string; quizId: string; onDone?: () => void; }) {
  const challenge = section.challenge;
  if (!challenge) return null;
  const allBlocks: DragBlock[] = [...challenge.blocks, ...(challenge.distractors ?? [])];
  const [pool, setPool] = useState<DragBlock[]>(allBlocks);
  const [shuffled, setShuffled] = useState(false);
  useEffect(() => {
    if (shuffled) return;
    setPool(arr => { const a = [...arr]; for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; });
    setShuffled(true);
  }, [shuffled]);
  const [dropped, setDropped] = useState<DragBlock[]>([]);
  const [dragItem, setDragItem] = useState<{ id: string; from: 'pool' | 'dropped'; index: number } | null>(null);
  const [dragOver, setDragOver] = useState<{ zone: 'pool' | 'dropped'; index: number } | null>(null);
  const [result, setResult] = useState<'idle' | 'correct' | 'wrong'>('idle');
  const [shake, setShake] = useState(false);
  const doneFired = useRef(false);

  const handleDropOnZone = (zone: 'pool' | 'dropped', index?: number) => {
    if (!dragItem) return;
    const insertAt = index ?? (zone === 'dropped' ? dropped.length : pool.length);
    if (dragItem.from === 'pool' && zone === 'dropped') {
      const block = pool[dragItem.index]; const np = pool.filter((_, i) => i !== dragItem.index); const nd = [...dropped]; nd.splice(insertAt, 0, block); setPool(np); setDropped(nd);
    } else if (dragItem.from === 'dropped' && zone === 'pool') {
      const block = dropped[dragItem.index]; const nd = dropped.filter((_, i) => i !== dragItem.index); const np = [...pool]; np.splice(insertAt, 0, block); setDropped(nd); setPool(np);
    } else if (dragItem.from === 'dropped' && zone === 'dropped') {
      const nd = [...dropped]; const [moved] = nd.splice(dragItem.index, 1); const actual = insertAt > dragItem.index ? insertAt - 1 : insertAt; nd.splice(actual, 0, moved); setDropped(nd);
    } else if (dragItem.from === 'pool' && zone === 'pool') {
      const np = [...pool]; const [moved] = np.splice(dragItem.index, 1); const actual = insertAt > dragItem.index ? insertAt - 1 : insertAt; np.splice(actual, 0, moved); setPool(np);
    }
    setDragItem(null); setDragOver(null); setResult('idle');
  };

  const handleCheck = () => {
    const ok = dropped.length === challenge.correctOrder.length && dropped.every((b, i) => b.id === challenge.correctOrder[i]);
    if (ok) {
      setResult('correct');
      if (!doneFired.current) {
        doneFired.current = true;
        saveQuizAttempt({ lessonId, quizId });
        onDone?.();
      }
    }
    else { setResult('wrong'); setShake(true); setTimeout(() => setShake(false), 600); }
  };

  const handleReset = () => {
    const arr = [...allBlocks]; for (let i = arr.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [arr[i], arr[j]] = [arr[j], arr[i]]; }
    setPool(arr); setDropped([]); setResult('idle'); doneFired.current = false;
  };

  const isCorrect = result === 'correct';

  return (
    <div className="dnd-root">
      {section.subtitle && <p className="dnd-subtitle">{section.subtitle}</p>}
      {challenge.description && (
        <div className="dnd-mission"><span>🎯</span><span>{challenge.description}</span></div>
      )}
      <div className="dnd-layout">
        <div className="dnd-col">
          <div className="dnd-col-label">Dostupné bloky</div>
          <div className={`dnd-zone dnd-pool ${dragOver?.zone === 'pool' ? 'dnd-zone-over' : ''}`}
            onDragOver={e => { e.preventDefault(); if (dragOver?.zone !== 'pool') setDragOver({ zone: 'pool', index: pool.length }); }}
            onDrop={() => handleDropOnZone('pool')} onDragLeave={e => { if (!e.currentTarget.contains(e.relatedTarget as Node)) setDragOver(null); }}>
            {pool.length === 0 && <div className="dnd-empty">Všetky bloky sú použité 👏</div>}
            {pool.map((block, i) => (
              <div key={block.id} className={`dnd-block dnd-block-pool ${dragItem?.id === block.id ? 'dnd-block-dragging' : ''} ${dragOver?.zone === 'pool' && dragOver.index === i ? 'dnd-block-insert-before' : ''} ${dragOver?.zone === 'pool' && dragOver.index === i + 1 && i === pool.length - 1 ? 'dnd-block-insert-after' : ''}`}
                draggable onDragStart={() => setDragItem({ id: block.id, from: 'pool', index: i })}
                onDragOver={e => { e.preventDefault(); e.stopPropagation(); const r = e.currentTarget.getBoundingClientRect(); const insertIdx = e.clientY < r.top + r.height / 2 ? i : i + 1; setDragOver({ zone: 'pool', index: insertIdx }); }}
                onDrop={e => { e.stopPropagation(); const r = e.currentTarget.getBoundingClientRect(); const insertIdx = e.clientY < r.top + r.height / 2 ? i : i + 1; handleDropOnZone('pool', insertIdx); }}>
                <span className="dnd-handle">⠿</span>
                <code className="dnd-code">{block.code}</code>
              </div>
            ))}
          </div>
        </div>
        <div className="dnd-arrow-col">→</div>
        <div className="dnd-col">
          <div className="dnd-col-label">Tvoje riešenie (v poradí)</div>
          <div className={`dnd-zone dnd-dropzone ${isCorrect ? 'dnd-zone-correct' : ''} ${shake ? 'dnd-shake' : ''} ${dragOver?.zone === 'dropped' && dropped.length === 0 ? 'dnd-zone-over' : ''}`}
            onDragOver={e => { e.preventDefault(); if (dropped.length === 0) setDragOver({ zone: 'dropped', index: 0 }); }}
            onDrop={() => { if (dropped.length === 0) handleDropOnZone('dropped', 0); else { const idx = dragOver?.zone === 'dropped' ? dragOver.index : dropped.length; handleDropOnZone('dropped', idx); } }}
            onDragLeave={e => { if (!e.currentTarget.contains(e.relatedTarget as Node)) setDragOver(null); }}>
            {dropped.length === 0 && <div className="dnd-placeholder"><span>⬆️</span><span>Presuň sem bloky v správnom poradí</span></div>}
            {dropped.map((block, i) => (
              <div key={block.id}
                className={`dnd-block dnd-block-dropped ${isCorrect ? 'dnd-block-correct' : ''} ${dragItem?.id === block.id ? 'dnd-block-dragging' : ''} ${dragOver?.zone === 'dropped' && dragOver.index === i ? 'dnd-block-insert-before' : ''} ${dragOver?.zone === 'dropped' && dragOver.index === i + 1 && i === dropped.length - 1 ? 'dnd-block-insert-after' : ''}`}
                draggable={!isCorrect} onDragStart={() => !isCorrect && setDragItem({ id: block.id, from: 'dropped', index: i })}
                onDragOver={e => { e.preventDefault(); e.stopPropagation(); const r = e.currentTarget.getBoundingClientRect(); const insertIdx = e.clientY < r.top + r.height / 2 ? i : i + 1; setDragOver({ zone: 'dropped', index: insertIdx }); }}
                onDrop={e => { e.stopPropagation(); const r = e.currentTarget.getBoundingClientRect(); const insertIdx = e.clientY < r.top + r.height / 2 ? i : i + 1; handleDropOnZone('dropped', insertIdx); }}>
                <span className="dnd-num">{i + 1}</span>
                <code className="dnd-code">{block.code}</code>
                {isCorrect && <span className="dnd-ok">✓</span>}
                {!isCorrect && <button className="dnd-remove" onClick={() => { setDropped(d => d.filter((_, di) => di !== i)); setPool(p => [...p, block]); setResult('idle'); }}>×</button>}
              </div>
            ))}
          </div>
        </div>
      </div>

      {!isCorrect && (
        <div className="dnd-actions">
          <button className="dnd-btn-check" onClick={handleCheck} disabled={dropped.length === 0}>✅ Skontrolovať</button>
          <button className="dnd-btn-reset" onClick={handleReset}>↺ Resetovať</button>
        </div>
      )}
      {result === 'wrong' && <div className="dnd-result dnd-result-wrong"><span>❌</span><span>Poradie nie je správne. Skontroluj každý riadok a skús znovu.</span></div>}
      {result === 'correct' && (
        <div className="dnd-result dnd-result-correct">
          <div className="dnd-result-top"><span>🎉</span><span>{challenge.successMessage}</span></div>
          <button className="dnd-btn-reset" style={{ marginTop: 10 }} onClick={handleReset}>↺ Skúsiť znovu</button>
        </div>
      )}
    </div>
  );
}

// ─── SelfCheck ────────────────────────────────────────────────────────────────
function SelfCheck({ questions, lessonId, quizId, onDone }: {
  questions: Question[]; lessonId: string; quizId: string; onDone?: (n: number) => void;
}) {
  const [answers, setAnswers] = useState<Record<number, string>>({});
  const [revealed, setRevealed] = useState<Record<number, boolean>>({});
  const savedRef = useRef(false);

  const pick = (qi: number, opt: string) => {
    if (revealed[qi]) return;
    const na = { ...answers, [qi]: opt };
    const nr = { ...revealed, [qi]: true };
    setAnswers(na); setRevealed(nr);
    if (Object.keys(nr).length === questions.length && !savedRef.current) {
      savedRef.current = true;
      const correct = questions.filter((q, i) => na[i]?.[0] === q.answer).length;
      saveQuizAttempt({ lessonId, quizId });
      onDone?.(correct);
    }
  };

  return (
    <div className="quiz-wrap">
      {questions.map((q, qi) => {
        const chosen = answers[qi]; const isRevealed = revealed[qi]; const isCorrect = chosen?.[0] === q.answer;
        return (
          <div key={qi} className="quiz-question">
            <p className="quiz-q">{qi + 1}. {q.q}</p>
            <div className="quiz-options">
              {q.options.map((opt, oi) => {
                const letter = opt[0]; const isThis = chosen === opt; const isCorrectOpt = letter === q.answer;
                let cls = 'quiz-opt';
                if (isRevealed) { if (isCorrectOpt) cls += ' opt-correct'; else if (isThis && !isCorrect) cls += ' opt-wrong'; else cls += ' opt-dim'; }
                return (
                  <button key={oi} className={cls} onClick={() => pick(qi, opt)} disabled={isRevealed}>
                    <span className="opt-letter">{letter}</span><span>{opt.slice(3)}</span>
                  </button>
                );
              })}
            </div>
            {isRevealed && (
              <div className={`quiz-feedback ${isCorrect ? 'fb-correct' : 'fb-wrong'}`}>
                <span>{isCorrect ? '🎉 Správne!' : '❌ Nie celkom.'}</span>
                <span>{q.why}</span>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

// ─── CodeBlock (single editor + AI Pomocník) ────────────────────────────────────
function CodeBlock({ code }: { code: CodeData }) {
  const cmRef = useRef<ReactCodeMirrorRef>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const iframeRef = useRef<HTMLIFrameElement>(null);

  const [val, setVal] = useState(code.value);
  const [bubblePos, setBubblePos] = useState<BubblePos | null>(null);
  const [selectedText, setSelectedText] = useState('');
  const [showBubble, setShowBubble] = useState(false);
  const [showPanel, setShowPanel] = useState(false);
  const [question, setQuestion] = useState('');
  const [loading, setLoading] = useState(false);
  const [answer, setAnswer] = useState('');
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [showHistory, setShowHistory] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(true);
  const [mounted, setMounted] = useState(false);
  const [consoleLines, setConsoleLines] = useState<Array<{ t: string; text: string }>>([]);
  const [aiUsed, setAiUsed] = useState<number | null>(null);
  const lang = code.language.toLowerCase();
  const isJs = lang === 'js' || lang === 'javascript';

  useEffect(() => { setMounted(true); }, []);
  useEffect(() => { document.body.style.overflow = showPanel ? 'hidden' : ''; return () => { document.body.style.overflow = ''; }; }, [showPanel]);
  useEffect(() => {
    if (showPanel && aiUsed === null) {
      fetch('/api/ai/usage').then(r => r.json()).then(d => setAiUsed(d.used));
    }
  }, [showPanel, aiUsed]);

  const canPreview = lang === 'html' || lang === 'css' || lang === 'js' || lang === 'javascript';

  const buildDoc = useCallback((src: string) => {
    if (lang === 'css') return `<!doctype html><html><head><meta charset="UTF-8"><style>body{font-family:-apple-system,sans-serif;padding:24px;color:#111;}h1{font-size:22px;}p{color:#555;line-height:1.6;}button{padding:8px 16px;border-radius:8px;border:1px solid #ccc;cursor:pointer;}${src}</style></head><body><h1>Nadpis stránky</h1><p>Toto je odsek textu na ukážku CSS štýlovania.</p><button>Tlačidlo</button></body></html>`;
    if (isJs) return `<!doctype html><html><head><meta charset="UTF-8"></head><body><script>const _s=v=>typeof v==='object'?JSON.stringify(v,null,2):String(v);const _p=(t,...a)=>window.parent.postMessage({t,d:a.map(_s).join(' ')},'*');console.log=(...a)=>_p('log',...a);console.warn=(...a)=>_p('warn',...a);console.error=(...a)=>_p('err',...a);window.alert=m=>_p('alert',String(m));try{${src}}catch(e){}<\/script></body></html>`;
    return src;
  }, [lang, isJs]);

  useEffect(() => {
    const iframe = iframeRef.current; if (!iframe) return;
    if (isJs) setConsoleLines([]);
    iframe.srcdoc = buildDoc(val);
  }, [val, buildDoc, isJs]);

  useEffect(() => {
    const handler = (e: MessageEvent) => {
      try { if (!iframeRef.current || e.source !== iframeRef.current.contentWindow) return; } catch { return; }
      const { t, d } = e.data ?? {};
      if (t === 'log' || t === 'warn' || t === 'err' || t === 'alert') {
        setConsoleLines(prev => [...prev, { t, text: String(d) }]);
      }
    };
    window.addEventListener('message', handler);
    return () => window.removeEventListener('message', handler);
  }, []);

  const checkSelection = useCallback(() => {
    const view = cmRef.current?.view; if (!view) return;
    const sel = view.state.selection.main;
    if (sel.empty) { setShowBubble(false); setSelectedText(''); return; }
    const text = view.state.sliceDoc(sel.from, sel.to);
    if (!text.trim()) { setShowBubble(false); return; }
    setSelectedText(text);
    const coords = view.coordsAtPos(sel.to) ?? view.coordsAtPos(sel.from);
    if (!coords || !containerRef.current) { setBubblePos({ top: 8, left: 0 }); setShowBubble(true); return; }
    const rect = containerRef.current.getBoundingClientRect();
    setBubblePos({ top: coords.top - rect.top - 52, left: Math.max(0, Math.min(coords.left - rect.left, (containerRef.current.offsetWidth ?? 600) - 250)) });
    setShowBubble(true);
  }, []);

  const onCreateEditor = useCallback((view: EditorView) => {
    const check = () => setTimeout(checkSelection, 50);
    view.dom.addEventListener('mouseup', check);
    view.dom.addEventListener('keyup', check);
  }, [checkSelection]);

  const openPanel = useCallback((prefill = '') => { setAnswer(''); setQuestion(prefill); setShowPanel(true); setShowBubble(false); setShowHistory(false); setTimeout(() => textareaRef.current?.focus(), 80); }, []);
  const closePanel = () => { setShowPanel(false); setAnswer(''); setQuestion(''); };

  const submit = async () => {
    if (!question.trim()) return;
    setLoading(true); setAnswer('');
    try {
      const res = await fetch('/api/ai/chat', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ code: selectedText, question, language: code.language }) });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setLoading(false);
        setAnswer(data.error ?? 'Chyba pri komunikácii s AI. Skús znovu.');
        return;
      }
      if (!res.body) throw new Error('API error');
      const reader = res.body.getReader(); const decoder = new TextDecoder();
      let full = ''; setLoading(false);
      while (true) { const { done, value } = await reader.read(); if (done) break; full += decoder.decode(value, { stream: true }); setAnswer(full); }
      setHistory(h => [{ id: Date.now().toString(), question, answer: full, selectedCode: selectedText }, ...h].slice(0, 3));
      setAiUsed(u => (u ?? 0) + 1);
    } catch { setLoading(false); setAnswer('Chyba pri komunikácii s AI. Skús znovu.'); }
  };
  const onKey = (e: KeyboardEvent<HTMLTextAreaElement>) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); submit(); } };

  useEffect(() => {
    const h = (e: globalThis.KeyboardEvent) => {
      if (e.key === 'Escape') { setShowPanel(false); setShowBubble(false); }
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') { e.preventDefault(); if (selectedText.trim()) openPanel(); }
    };
    window.addEventListener('keydown', h); return () => window.removeEventListener('keydown', h);
  }, [selectedText, openPanel]);

  return (
    <div className="cm-tutor-root w-full" ref={containerRef}>
      <div className={`cm-shell ${canPreview && previewOpen ? 'cm-shell-split' : ''}`}>
        <div className="cm-editor-pane">
          <div className="cm-chrome">
            <div className="cm-topbar">
              <div className="cm-dots"><div className="cm-dot" style={{ background: '#FF5F57' }}/><div className="cm-dot" style={{ background: '#FFBD2E' }}/><div className="cm-dot" style={{ background: '#28C840' }}/></div>
              <span className="cm-lang-badge">{code.language.toUpperCase()}</span>
              <div className="cm-topbar-right">
                <div className="cm-hint">Označ text a spytaj sa AI</div>
                {canPreview && <button className={`cm-toggle ${previewOpen ? 'cm-toggle-on' : ''}`} onClick={() => setPreviewOpen(p => !p)}><span>{previewOpen ? '◧' : '◨'}</span><span>Náhľad</span></button>}
              </div>
            </div>
            <CodeMirror ref={cmRef} value={val} onChange={setVal} extensions={[getLang(code.language), cmDarkTheme]} onCreateEditor={onCreateEditor} theme="none" height="300px" basicSetup={{ lineNumbers: true, highlightActiveLine: true, autocompletion: false, foldGutter: false }} />
          </div>
        </div>
        {canPreview && (
          <div className="cm-preview-pane" style={{ opacity: previewOpen ? 1 : 0, visibility: previewOpen ? 'visible' : 'hidden', width: previewOpen ? undefined : 0, overflow: previewOpen ? undefined : 'hidden', transition: 'opacity 0.28s ease, width 0.3s ease' }}>
            {isJs ? (
              <>
                <div className="js-console">
                  <div className="js-console-bar">
                    <span className="js-console-title">▶ Console</span>
                    <button className="js-console-clear" onClick={() => setConsoleLines([])}>Clear</button>
                  </div>
                  <div className="js-console-output">
                    {consoleLines.length === 0 && <div className="js-console-empty">{'// výstup console.log sa objaví tu'}</div>}
                    {consoleLines.map((line, i) => (
                      <div key={i} className={`js-console-line js-console-${line.t}`}>
                        {line.t === 'alert' && <span className="js-console-tag">alert</span>}
                        {line.t === 'warn' && <span className="js-console-icon">⚠</span>}
                        {line.t === 'err' && <span className="js-console-icon">✕</span>}
                        {line.text}
                      </div>
                    ))}
                  </div>
                </div>
                <iframe ref={iframeRef} sandbox="allow-scripts" style={{ display: 'none' }} title="JS executor" />
              </>
            ) : (
              <div className="cm-preview-chrome">
                <div className="cm-preview-bar">
                  <div className="cm-preview-dots"><div className="cm-dot" style={{ background: '#FF5F57', opacity: 0.35 }}/><div className="cm-dot" style={{ background: '#FFBD2E', opacity: 0.35 }}/><div className="cm-dot" style={{ background: '#28C840', opacity: 0.35 }}/></div>
                  <div className="cm-preview-address"><svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ color: '#10B981', flexShrink: 0 }}><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg><span>náhľad</span></div>
                  <div className="cm-live-badge"><div className="cm-live-dot" /><span>Live</span></div>
                </div>
                <iframe ref={iframeRef} className="cm-preview-iframe" sandbox="allow-scripts" title="Live preview" />
              </div>
            )}
          </div>
        )}
      </div>

      {showBubble && bubblePos && (
        <div className="ai-bubble" style={{ top: bubblePos.top, left: bubblePos.left }}>
          <button className="bubble-primary" onClick={() => openPanel()}>✨ Spýtaj sa</button>
          <div className="bubble-sep" />
          <button className="bubble-ghost" onClick={() => openPanel('Vysvetli mi tento kód.')}>Vysvetli</button>
          <div className="bubble-sep" />
          <button className="bubble-x" onClick={() => setShowBubble(false)}>×</button>
        </div>
      )}

      {mounted && showPanel && createPortal(
        <div className="ai-overlay" onClick={e => { if (e.target === e.currentTarget) closePanel(); }}>
          <div className="ai-panel">
            <div className="ap-header">
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div className="ap-icon">✨</div>
                <div><p className="ap-title">AI Pomocník</p><p className="ap-sub">Spýtaj sa na označený kód</p></div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                {aiUsed !== null && (
                  <span style={{ fontSize: 12, fontWeight: 600, color: aiUsed >= 20 ? '#DC2626' : aiUsed >= 16 ? '#EA580C' : '#64748B', background: aiUsed >= 20 ? '#FEE2E2' : aiUsed >= 16 ? '#FFF7ED' : '#F1F5F9', borderRadius: 8, padding: '2px 8px' }}>
                    {aiUsed}/20 dnes
                  </span>
                )}
                {history.length > 0 && <button className="ap-hist-btn" onClick={() => setShowHistory(h => !h)}>🕐 História ({history.length})</button>}
                <button className="ap-close-btn" onClick={closePanel}>×</button>
              </div>
            </div>
            {showHistory && (
              <div className="ap-history">
                <div className="ap-hist-label">Posledné otázky</div>
                {history.map(h => <div key={h.id} className="ap-hist-item" onClick={() => { setQuestion(h.question); setAnswer(h.answer); setShowHistory(false); }}><div className="ap-hist-q">❓ {h.question}</div><div className="ap-hist-a">{h.answer}</div></div>)}
              </div>
            )}
            <div className="ap-body">
              <div><span className="ap-field-label">Označený kód</span><div className="ap-code-preview"><div className="ap-code-header"><span className="ap-code-lang">{code.language} · {selectedText.split('\n').length} riadok</span></div><pre className="ap-code-pre">{selectedText || '(žiadny text)'}</pre></div></div>
              <div><label className="ap-field-label" htmlFor="ai-q">Tvoja otázka</label><textarea id="ai-q" ref={textareaRef} className="ap-textarea" placeholder="Napr. Prečo tu používame const a nie let?" value={question} onChange={e => setQuestion(e.target.value)} onKeyDown={onKey} rows={3} /><div className="ap-hint"><kbd>Enter</kbd> odoslať · <kbd>Shift+Enter</kbd> nový riadok</div></div>
            </div>
            {(loading || answer) && (
              <div className="ap-answer"><div className="ap-answer-header">✨ AI odpoveď</div>
                {loading ? <div className="ap-loading"><span className="ld"/><span className="ld"/><span className="ld"/></div> : <div className="ap-answer-text">{answer.split('\n').map((line, i) => <p key={i} style={{ margin: i === 0 ? 0 : '8px 0 0' }}>{parseInline(line)}</p>)}</div>}
              </div>
            )}
            <div className="ap-actions">
              <button className="ap-btn-primary" onClick={submit} disabled={loading || !question.trim()}>{loading ? '⏳ Generujem...' : '✨ Odoslať'}</button>
              <button className="ap-btn-ghost" onClick={closePanel}>Zrušiť</button>
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}

// ─── TaskBlock (legacy single-editor task) ────────────────────────────────────
function TaskBlock({ section, lessonId, taskId, onPassed, onAttempted }: {
  section: Section; lessonId: string; taskId: string;
  onPassed?: (result: Exclude<TaskResult, 'none'>, score?: number) => void; onAttempted?: () => void;
}) {
  const [val, setVal] = useState(section.starterCode?.value ?? '');
  const [evalState, setEvalState] = useState<'idle' | 'loading' | 'done'>('idle');
  const [evalResult, setEvalResult] = useState<{ ok: boolean; message: string } | null>(null);
  const iframeRef = useRef<HTMLIFrameElement>(null);

  const passedRef = useRef(false);
  const attemptedRef = useRef(false);

  useEffect(() => {
    if (!lessonId || !taskId) return;
    getTaskSubmission(lessonId, taskId).then((sub) => {
      if (!sub) return;
      const subResult: Exclude<TaskResult, 'none'> = sub.passed ? 'full' : (sub.score ?? 0) >= 40 ? 'partial' : 'fail';
      if (!attemptedRef.current) { attemptedRef.current = true; onAttempted?.(); }
      onPassed?.(subResult, sub.score ?? 0);
      setVal(sub.code);
      setEvalResult({ ok: sub.passed, message: sub.feedback });
      setEvalState('done');
      if (sub.passed) { passedRef.current = true; }
    });
  }, [lessonId, taskId]);

  useEffect(() => {
    const iframe = iframeRef.current; if (!iframe) return;
    iframe.srcdoc = val;
  }, [val]);

  const handleEvaluate = async () => {
    setEvalState('loading'); setEvalResult(null);
    await new Promise(r => setTimeout(r, 600));
    let passed: boolean, score: number, message: string;
    let taskResult: Exclude<TaskResult, 'none'>;
    if (section.validationConfig) {
      const res = runJsValidation(val, section.validationConfig);
      taskResult = res.result === 'full' ? 'full' : res.result === 'partial' ? 'partial' : 'fail';
      passed = taskResult === 'full';
      score = res.score; message = res.feedback;
    } else {
      ({ passed, score, message } = evaluateCode(val, section.aiEvaluation?.criteria ?? []));
      taskResult = passed ? 'full' : score >= 40 ? 'partial' : 'fail';
    }
    const xpEarned = getLessonAwardXp(taskResult, section.aiEvaluation?.xpReward ?? 0, score);
    await saveTaskSubmission({ lessonId, taskId, code: val, passed, score, feedback: message, xpEarned });
    if (!attemptedRef.current) { attemptedRef.current = true; onAttempted?.(); }
    onPassed?.(taskResult, score);
    setEvalResult({ ok: passed, message }); setEvalState('done');
    if (passed) { passedRef.current = true; }
  };

  return (
    <div className="task-block">
      {section.instructions && section.instructions.length > 0 && (
        <div className="ttask-instructions" style={{ margin: '0 0 16px' }}>
          <div className="ttask-instr-label">📋 Zadanie</div>
          <ol className="ttask-instr-list">
            {section.instructions.map((instr, i) => (
              <li key={i} className="ttask-instr-item"><span className="ttask-instr-num">{i + 1}</span><span>{parseInline(instr)}</span></li>
            ))}
          </ol>
        </div>
      )}
      <div className="task-editor-wrap">
        <div className="task-editor-shell">
          <div className="tabs-editor-bar"><div className="cm-dots"><div className="cm-dot" style={{ background: '#FF5F57' }}/><div className="cm-dot" style={{ background: '#FFBD2E' }}/><div className="cm-dot" style={{ background: '#28C840' }}/></div><span className="cm-lang-badge">{(section.starterCode?.language ?? 'html').toUpperCase()}</span></div>
          <CodeMirror value={val} onChange={v => { setVal(v); if (evalState === 'done') setEvalState('idle'); }} extensions={[getLang(section.starterCode?.language ?? 'html'), cmDarkTheme]} theme="none" height="300px" basicSetup={{ lineNumbers: true, highlightActiveLine: true, autocompletion: false, foldGutter: false }} />
        </div>
        <div className="tabs-preview-pane">
          <LivePreviewPane doc={val} />
        </div>
      </div>
      <div className="task-footer">
        <button className="task-eval-btn" onClick={handleEvaluate} disabled={evalState === 'loading'}>
          {evalState === 'loading' ? <span className="task-eval-loading"><span className="ld"/><span className="ld"/><span className="ld"/> Vyhodnocujem...</span> : '✨ Vyhodnotiť'}
        </button>
      </div>
      {evalState === 'done' && evalResult && (
        <div className={`ttask-result ${evalResult.ok ? 'ttask-result-ok' : 'ttask-result-fail'}`}>
          <span className="ttask-result-icon">{evalResult.ok ? '🎉' : '💡'}</span>
          <div className="ttask-result-text" style={{ whiteSpace: 'pre-line' }}>{evalResult.message}</div>
        </div>
      )}
    </div>
  );
}

// ─── SectionBlock ─────────────────────────────────────────────────────────────
function SectionBlock({ section, lessonId, quizId, taskId, lessonXp, onTaskPassed, onTaskAttempted, onQuizDone, onDragDropDone }: {
  section: Section; lessonId: string; quizId: string; taskId: string; lessonXp?: number;
  onTaskPassed?: (result: Exclude<TaskResult, 'none'>, score?: number) => void; onTaskAttempted?: () => void;
  onQuizDone?: (n: number) => void; onDragDropDone?: () => void;
}) {
  const meta = SECTION_META[section.type] || { icon: '•', label: section.type, color: '#6B7280' };
  const normalizedQuestions = normalizeQuestions(section);

  if (section.type === 'tabbed_task') {
    return (
      <div className="section-block" data-type="tabbed_task">
        <div className="section-label" style={{ color: meta.color }}><span>{meta.icon}</span><span>{meta.label}</span></div>
        <h2 className="section-title">{section.title}</h2>
        {section.subtitle && <p className="content-p" style={{ marginBottom: 20 }}>{parseInline(section.subtitle)}</p>}
        <TabbedTaskBlock section={section} lessonId={lessonId} taskId={taskId} lessonXp={lessonXp} onPassed={onTaskPassed} onAttempted={onTaskAttempted} />
      </div>
    );
  }

  if (section.type === 'tabbed_example') {
    return (
      <div className="section-block" data-type="tabbed_example">
        <div className="section-label" style={{ color: meta.color }}><span>{meta.icon}</span><span>{meta.label}</span></div>
        <h2 className="section-title">{section.title}</h2>
        {section.subtitle && <p className="content-p" style={{ marginBottom: 20 }}>{parseInline(section.subtitle)}</p>}
        <TabbedCodeBlock section={section} />
      </div>
    );
  }

  if (section.type === 'drag_and_drop') {
    return (
      <div className="section-block" data-type="drag_and_drop">
        <div className="section-label" style={{ color: meta.color }}><span>{meta.icon}</span><span>{meta.label}</span></div>
        <h2 className="section-title">{section.title}</h2>
        <DragAndDropBlock section={section} lessonId={lessonId} quizId={quizId} onDone={onDragDropDone} />
      </div>
    );
  }

  if (section.type === 'task' || section.type === 'live_task') {
    return (
      <div className="section-block" data-type={section.type}>
        <div className="section-label" style={{ color: meta.color }}><span>{meta.icon}</span><span>{meta.label}</span></div>
        <h2 className="section-title">{section.title}</h2>
        {section.subtitle && <p className="content-p" style={{ marginBottom: 16 }}>{parseInline(section.subtitle)}</p>}
        <TaskBlock section={section} lessonId={lessonId} taskId={taskId} onPassed={onTaskPassed} onAttempted={onTaskAttempted} />
      </div>
    );
  }

  return (
    <div className="section-block" data-type={section.type}>
      <div className="section-label" style={{ color: meta.color }}><span>{meta.icon}</span><span>{meta.label}</span></div>
      <h2 className="section-title">{section.title}</h2>
      {section.content && <div className="content-list">{section.content.map((c, i) => <p key={i} className="content-p">{parseInline(c)}</p>)}</div>}
      {Array.isArray(section.items) && section.items.filter((it): it is string => typeof it === 'string').length > 0 && (
        <ul className="items-list">{section.items.filter((it): it is string => typeof it === 'string').map((item, i) => <li key={i} className="item-li"><span className="item-dot" style={{ background: meta.color }} /><span>{item}</span></li>)}</ul>
      )}
      {section.code && <CodeBlock code={section.code} />}
      {section.explanation && <div className="explanation-list">{section.explanation.map((e, i) => <div key={i} className="explanation-item"><span className="expl-arrow">→</span><span>{parseInline(e)}</span></div>)}</div>}
      {normalizedQuestions.length > 0 && <SelfCheck questions={normalizedQuestions} lessonId={lessonId} quizId={quizId} onDone={onQuizDone} />}
    </div>
  );
}

// ─── CompletionBanner ─────────────────────────────────────────────────────────
function CompletionBanner({ xp, nextLesson }: { xp: number; nextLesson: Lesson | null }) {
  return (
    <div style={{ background: 'linear-gradient(135deg,#F0FDF4,#ECFDF5)', border: '2px solid #10B981', borderRadius: 20, padding: '28px 32px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 20, flexWrap: 'wrap', marginBottom: 32, animation: 'fadeUp 0.4s ease both' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
        <span style={{ fontSize: 36 }}>🎉</span>
        <div>
          <div style={{ fontFamily: 'Nunito,sans-serif', fontWeight: 900, fontSize: 18, color: '#166534', marginBottom: 4 }}>Lekcia dokončená!</div>
          <div style={{ fontSize: 14, color: '#166534', opacity: 0.8 }}>Získal si +{xp} XP · Skvelá práca!</div>
        </div>
      </div>
      {nextLesson && (
        <Link href={`/app/learning/javascript/${nextLesson.slug}`} style={{ display: 'inline-flex', alignItems: 'center', gap: 8, background: 'linear-gradient(135deg,#7361FF,#8C78FF)', color: 'white', borderRadius: 12, padding: '12px 20px', fontFamily: 'Nunito,sans-serif', fontWeight: 800, fontSize: 14, textDecoration: 'none', boxShadow: '0 4px 16px rgba(115,97,255,0.3)' }}>
          Ďalšia lekcia →
        </Link>
      )}
    </div>
  );
}

// ─── LessonPage ───────────────────────────────────────────────────────────────
export default function LessonPage() {
  const params = useParams();
  const router = useRouter();
  const slug = Array.isArray(params.slug) ? params.slug[0] : params.slug ?? '';
  const lessons = trackData.lessons as Lesson[];
  const lesson = lessons.find(l => l.slug === slug);
  const lessonIndex = lessons.findIndex(l => l.slug === slug);

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) router.replace('/login');
    });
  }, [router]);
  const prevLesson = lessonIndex > 0 ? lessons[lessonIndex - 1] : null;
  const nextLesson = lessonIndex < lessons.length - 1 ? lessons[lessonIndex + 1] : null;

  const hasTaskGate    = lesson ? lesson.sections.some(s => s.type === 'task' || s.type === 'live_task' || s.type === 'tabbed_task') : false;
  const hasQuizGate    = lesson ? lesson.sections.some(s => normalizeQuestions(s).length > 0) : false;
  const hasDragDropGate= lesson ? lesson.sections.some(s => s.type === 'drag_and_drop' && s.requiredToComplete) : false;

  const [completedSections, setCompletedSections] = useState<Set<number>>(new Set());
  const [activeSection, setActiveSection] = useState(0);
  const sectionRefs = useRef<(HTMLDivElement | null)[]>([]);

  const [taskResult, setTaskResult] = useState<TaskResult>('none');
  const [taskScore, setTaskScore] = useState<number>(0);
  const [quizDone, setQuizDone] = useState(false);
  const [dragDropDone, setDragDropDone] = useState(false);
  const [lessonCompleted, setLessonCompleted] = useState(false);
  const [showLockModal, setShowLockModal] = useState(false);
  const [showGroupMenu, setShowGroupMenu] = useState(false);
  const [xpToast, setXpToast] = useState<number | null>(null);
  const [awardedXp, setAwardedXp] = useState<number | null>(null);
  const syncedAwardXpRef = useRef<number | null>(null);
  const syncInFlightRef = useRef(false);

  useEffect(() => {
    if (!lesson) return;
    updateStreak();
    getLessonProgress(lesson.lesson_id).then(p => {
      if (!p) return;
      let loaded: TaskResult = 'none';
      if (p.task_passed) loaded = 'full';
      else if (p.task_best_score !== null && p.task_best_score !== undefined)
        loaded = (p.task_best_score as number) >= 40 ? 'partial' : 'fail';
      if (loaded !== 'none') {
        setTaskResult(loaded);
        setTaskScore(p.task_passed ? 100 : (p.task_best_score as number ?? 0));
      }
      if (p.quiz_passed) { setQuizDone(true); setDragDropDone(true); }
      const restoredScore = p.task_passed ? 100 : (p.task_best_score as number ?? 0);
      if (p.completed) {
        const storedXp = extractAwardedXp(p, getLessonAwardXp(loaded, lesson.xp, restoredScore));
        syncedAwardXpRef.current = storedXp;
        setAwardedXp(storedXp);
        setLessonCompleted(true);
      }
    });
  }, [lesson?.lesson_id]);

  useEffect(() => {
    if (!lesson) return;
    if (!hasQuizGate) setQuizDone(true);
    if (!hasDragDropGate) setDragDropDone(true);
  }, [lesson?.lesson_id, hasQuizGate, hasDragDropGate]);

  const taskAttempted = taskResult !== 'none';
  const quizOk = (!hasQuizGate || quizDone) && (!hasDragDropGate || dragDropDone);
  const canProceed = (!hasTaskGate || taskAttempted) && quizOk;
  const computedAwardXp = getLessonAwardXp(taskResult, lesson?.xp ?? 0, taskScore);
  const displayedXp = awardedXp ?? (taskAttempted ? computedAwardXp : lesson?.xp ?? 0);

  // Auto-dokončenie lekcie keď sú splnené podmienky
  useEffect(() => {
    if (!lesson || !canProceed) return;
    if (computedAwardXp <= 0) return;
    if (syncInFlightRef.current) return;
    if (syncedAwardXpRef.current === computedAwardXp) {
      setLessonCompleted(true);
      if (awardedXp == null) setAwardedXp(computedAwardXp);
      return;
    }
    let cancelled = false;
    (async () => {
      syncInFlightRef.current = true;
      try {
        const result = await markLessonComplete(lesson.lesson_id, computedAwardXp);
        if (cancelled) return;
        const storedXp = extractAwardedXp(result, computedAwardXp) ?? computedAwardXp;
        syncedAwardXpRef.current = storedXp;
        setLessonCompleted(true);
        setAwardedXp(storedXp);
        if (storedXp > 0) { setXpToast(storedXp); setTimeout(() => setXpToast(null), 3500); }
      } finally { syncInFlightRef.current = false; }
    })();
    return () => { cancelled = true; };
  }, [lesson, canProceed, computedAwardXp, awardedXp]);

  useEffect(() => {
    if (!lesson) return;
    const TOPBAR = 56;
    const update = () => {
      const atBottom = window.innerHeight + window.scrollY >= document.body.scrollHeight - 80;
      let newActive = 0; const toComplete: number[] = [];
      sectionRefs.current.forEach((ref, idx) => {
        if (!ref) return;
        const rect = ref.getBoundingClientRect();
        if (rect.bottom < TOPBAR + 32) toComplete.push(idx);
        if (rect.top <= window.innerHeight * 0.55 && rect.bottom > TOPBAR) newActive = idx;
      });
      if (atBottom) { lesson.sections.forEach((_, i) => toComplete.push(i)); newActive = lesson.sections.length - 1; }
      if (toComplete.length > 0) setCompletedSections(prev => { const next = new Set(prev); toComplete.forEach(i => next.add(i)); return next.size === prev.size ? prev : next; });
      setActiveSection(newActive);
    };
    window.addEventListener('scroll', update, { passive: true }); update();
    return () => window.removeEventListener('scroll', update);
  }, [lesson]);

  const scrollToSection = (idx: number) => sectionRefs.current[idx]?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  const progress = lessonCompleted ? 100 : Math.round((completedSections.size / (lesson?.sections.length ?? 1)) * 100);

  const handleNextLesson = (href: string) => {
    if (!canProceed) { setShowLockModal(true); return; }
    window.location.href = href;
  };

  if (!lesson) {
    return (
      <div style={{ padding: 40, fontFamily: 'monospace' }}>
        <h2>Lekcia nenájdená — slug: &quot;{slug}&quot;</h2>
        <ul>{lessons.map(l => <li key={l.id}>{l.slug}</li>)}</ul>
        <Link href="/app/learning/javascript">← Späť</Link>
      </div>
    );
  }

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Nunito:wght@400;600;700;800;900&family=Sora:wght@300;400;500;600&family=JetBrains+Mono:wght@400;500&display=swap');
        :root {
          --brand:#7361FF; --brand-2:#8C78FF; --brand-light:#EDE9FF; --brand-mid:#C4B5FD;
          --success:#059669; --error:#DC2626; --surface:#FFFFFF; --bg:#F7F7FB;
          --border:#E8E6F0; --text:#111118; --muted:#6B7280; --faint:#9CA3AF;
          --sidebar-w:280px; --topbar-h:56px;
        }
        *{box-sizing:border-box;margin:0;padding:0;}
        body{background:var(--bg);}

        /* ── Layout ── */
        .lesson-root{font-family:'Sora',sans-serif;min-height:100vh;display:flex;flex-direction:column;}
        .topbar{position:fixed;top:0;left:0;right:0;height:var(--topbar-h);background:rgba(255,255,255,0.97);backdrop-filter:blur(12px);border-bottom:1px solid var(--border);display:flex;align-items:center;justify-content:space-between;padding:0 20px;z-index:100;gap:16px;}
        .topbar-left{display:flex;align-items:center;gap:12px;min-width:0;flex:1;}
        .back-link{display:flex;align-items:center;gap:6px;color:var(--muted);text-decoration:none;font-size:13px;font-weight:600;font-family:'Nunito',sans-serif;white-space:nowrap;transition:color 0.15s;}
        .back-link:hover{color:var(--brand);}
        .topbar-divider{width:1px;height:20px;background:var(--border);flex-shrink:0;}
        .topbar-title{font-family:'Nunito',sans-serif;font-size:14px;font-weight:800;color:var(--text);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}
        .topbar-right{display:flex;align-items:center;gap:12px;flex-shrink:0;}
        .progress-wrap{display:flex;align-items:center;gap:8px;}
        .progress-bar-outer{width:120px;height:6px;background:var(--border);border-radius:100px;overflow:hidden;}
        .progress-bar-inner{height:100%;background:linear-gradient(90deg,var(--brand),var(--brand-2));border-radius:100px;transition:width 0.4s ease;}
        .progress-pct{font-family:'Nunito',sans-serif;font-size:12px;font-weight:800;color:var(--brand);min-width:30px;}
        .xp-pill{background:linear-gradient(135deg,#FEF3C7,#FDE68A);color:#92400E;border-radius:100px;padding:4px 10px;font-size:12px;font-weight:800;font-family:'Nunito',sans-serif;}
        .lesson-layout{display:flex;margin-top:var(--topbar-h);min-height:calc(100vh - var(--topbar-h));}
        .sidebar{width:var(--sidebar-w);flex-shrink:0;position:sticky;top:var(--topbar-h);height:calc(100vh - var(--topbar-h));overflow-y:auto;background:var(--surface);border-right:1px solid var(--border);padding:24px 0 40px;scrollbar-width:thin;scrollbar-color:var(--border) transparent;}
        .sidebar-inner{padding:0 16px;}
        .sidebar-lesson-info{margin-bottom:24px;padding-bottom:20px;border-bottom:1px solid var(--border);}
        .sidebar-order{font-size:11px;font-weight:700;color:var(--brand);font-family:'Nunito',sans-serif;text-transform:uppercase;letter-spacing:0.06em;margin-bottom:6px;}
        .sidebar-lesson-title{font-family:'Nunito',sans-serif;font-size:15px;font-weight:900;color:var(--text);line-height:1.3;margin-bottom:12px;}
        .sidebar-meta{display:flex;gap:12px;}
        .sidebar-meta-item{font-size:12px;color:var(--muted);font-weight:500;display:flex;align-items:center;gap:4px;}
        .sidebar-sections-label{font-size:11px;font-weight:700;color:var(--faint);text-transform:uppercase;letter-spacing:0.06em;font-family:'Nunito',sans-serif;margin-bottom:8px;padding:0 4px;}
        .sidebar-section-btn{display:flex;align-items:center;gap:10px;width:100%;padding:10px 12px;border-radius:12px;border:none;background:transparent;cursor:pointer;text-align:left;transition:background 0.15s;margin-bottom:2px;}
        .sidebar-section-btn:hover{background:var(--bg);}
        .sidebar-section-btn.active{background:var(--brand-light);}
        .sidebar-check{width:22px;height:22px;border-radius:50%;border:2px solid var(--border);display:flex;align-items:center;justify-content:center;flex-shrink:0;font-size:11px;transition:all 0.2s;background:white;}
        .sidebar-section-btn.completed .sidebar-check{background:var(--success);border-color:var(--success);color:white;}
        .sidebar-section-btn.active .sidebar-check{border-color:var(--brand);box-shadow:0 0 0 3px var(--brand-light);}
        .sidebar-section-text{flex:1;min-width:0;}
        .sidebar-section-name{font-family:'Nunito',sans-serif;font-size:13px;font-weight:700;color:var(--text);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}
        .sidebar-section-btn.active .sidebar-section-name{color:var(--brand);}
        .sidebar-section-type{font-size:11px;color:var(--faint);font-weight:500;}
        .sidebar-section-icon{font-size:14px;flex-shrink:0;}
        .lesson-content{flex:1;min-width:0;padding:48px 56px 100px;max-width:1300px;}
        .section-block{margin-bottom:64px;scroll-margin-top:calc(var(--topbar-h) + 24px);animation:fadeUp 0.4s ease both;}
        @keyframes fadeUp{from{opacity:0;transform:translateY(16px);}to{opacity:1;transform:translateY(0);}}
        .section-label{display:flex;align-items:center;gap:6px;font-size:12px;font-weight:700;font-family:'Nunito',sans-serif;text-transform:uppercase;letter-spacing:0.06em;margin-bottom:10px;}
        .section-title{font-family:'Nunito',sans-serif;font-size:24px;font-weight:900;letter-spacing:-0.02em;color:var(--text);margin-bottom:20px;line-height:1.2;}
        .content-list{display:flex;flex-direction:column;gap:12px;}
        .content-p{font-size:15px;line-height:1.75;color:#374151;}
        .items-list{list-style:none;display:flex;flex-direction:column;gap:12px;}
        .item-li{display:flex;align-items:flex-start;gap:12px;font-size:15px;line-height:1.6;color:#374151;}
        .item-dot{width:8px;height:8px;border-radius:50%;flex-shrink:0;margin-top:7px;}
        .explanation-list{display:flex;flex-direction:column;gap:10px;margin-top:16px;padding:16px 20px;background:#F0FDF4;border-left:3px solid #10B981;border-radius:0 12px 12px 0;}
        .explanation-item{display:flex;align-items:flex-start;gap:10px;font-size:14px;color:#065F46;line-height:1.6;}
        .expl-arrow{color:#10B981;font-weight:700;flex-shrink:0;margin-top:1px;}
        .lesson-nav{display:flex;align-items:center;justify-content:space-between;gap:16px;padding:32px 0 0;border-top:1px solid var(--border);margin-top:16px;}
        .nav-btn{display:flex;align-items:center;gap:10px;padding:14px 20px;border-radius:14px;text-decoration:none;font-family:'Nunito',sans-serif;font-weight:800;font-size:14px;transition:transform 0.18s,box-shadow 0.18s;border:1.5px solid var(--border);background:white;color:var(--text);max-width:220px;cursor:pointer;}
        .nav-btn:hover{transform:translateY(-2px);box-shadow:0 4px 16px rgba(0,0,0,0.08);}
        .nav-btn-next{background:linear-gradient(135deg,var(--brand),var(--brand-2));color:white;border-color:transparent;box-shadow:0 4px 16px rgba(115,97,255,0.3);}
        .nav-btn-next:hover{box-shadow:0 8px 24px rgba(115,97,255,0.4);}
        .nav-btn-label{font-size:11px;font-weight:600;opacity:0.65;display:block;margin-bottom:2px;}
        .nav-btn-title{font-size:13px;font-weight:800;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}
        .nav-btn-spacer{flex:1;}

        /* ── Quiz ── */
        .quiz-wrap{display:flex;flex-direction:column;gap:32px;}
        .quiz-q{font-family:'Nunito',sans-serif;font-size:16px;font-weight:800;color:var(--text);margin-bottom:14px;line-height:1.4;}
        .quiz-options{display:flex;flex-direction:column;gap:8px;}
        .quiz-opt{display:flex;align-items:flex-start;gap:12px;padding:14px 16px;border-radius:12px;border:1.5px solid var(--border);background:white;cursor:pointer;text-align:left;font-size:14px;color:#374151;line-height:1.5;transition:border-color 0.15s,background 0.15s,transform 0.1s;width:100%;}
        .quiz-opt:hover:not(:disabled){border-color:var(--brand-mid);background:var(--brand-light);transform:translateX(2px);}
        .quiz-opt:disabled{cursor:default;}
        .quiz-opt.opt-correct{border-color:#10B981;background:#F0FDF4;color:#065F46;}
        .quiz-opt.opt-wrong{border-color:#EF4444;background:#FEF2F2;color:#991B1B;}
        .quiz-opt.opt-dim{opacity:0.45;}
        .opt-letter{width:24px;height:24px;border-radius:8px;background:var(--bg);display:flex;align-items:center;justify-content:center;font-family:'Nunito',sans-serif;font-weight:800;font-size:13px;flex-shrink:0;color:var(--muted);}
        .opt-correct .opt-letter{background:#10B981;color:white;}
        .opt-wrong .opt-letter{background:#EF4444;color:white;}
        .quiz-feedback{display:flex;flex-direction:column;gap:4px;margin-top:12px;padding:12px 16px;border-radius:10px;font-size:13px;line-height:1.5;animation:fadeUp 0.25s ease both;}
        .fb-correct{background:#F0FDF4;border:1px solid #A7F3D0;color:#065F46;}
        .fb-wrong{background:#FEF2F2;border:1px solid #FECACA;color:#991B1B;}
        .fb-correct span:first-child,.fb-wrong span:first-child{font-family:'Nunito',sans-serif;font-weight:800;font-size:14px;display:block;margin-bottom:3px;}

        /* ── Shared Editor Primitives ── */
        .cm-dots{display:flex;gap:6px;}
        .cm-dot{width:12px;height:12px;border-radius:50%;flex-shrink:0;}
        .cm-lang-badge{font-family:'JetBrains Mono',monospace;font-size:11px;letter-spacing:0.08em;text-transform:uppercase;color:#7C6AF7;}
        .cm-topbar{background:#14142A;padding:10px 16px;display:flex;align-items:center;gap:10px;border-bottom:1px solid #2D2D3F;flex-shrink:0;}
        .cm-topbar-right{margin-left:auto;display:flex;align-items:center;gap:10px;}
        .cm-hint{font-size:11px;color:#555570;font-weight:500;}
        .cm-toggle{display:inline-flex;align-items:center;gap:6px;border:1px solid rgba(255,255,255,0.1);border-radius:8px;background:rgba(255,255,255,0.05);padding:5px 11px;font-family:'Nunito',sans-serif;font-size:12px;font-weight:800;color:#6B6B8A;cursor:pointer;transition:all 0.18s;white-space:nowrap;}
        .cm-toggle:hover{background:rgba(255,255,255,0.1);color:#CDD6F4;}
        .cm-toggle.cm-toggle-on{background:rgba(115,97,255,0.18);border-color:rgba(115,97,255,0.45);color:#A89FFF;}

        /* ── Live Preview ── */
        .cm-preview-chrome{display:flex;flex-direction:column;height:100%;background:white;}
        .cm-preview-bar{background:#F2F2F7;padding:9px 14px;display:flex;align-items:center;gap:10px;border-bottom:1px solid #E5E5EA;flex-shrink:0;}
        .cm-preview-dots{display:flex;gap:5px;}
        .cm-preview-address{flex:1;background:white;border:1px solid #D1D1D6;border-radius:7px;padding:4px 10px;display:flex;align-items:center;gap:6px;font-size:11px;color:#8E8E93;max-width:200px;margin:0 auto;}
        .cm-live-badge{display:flex;align-items:center;gap:5px;font-size:11px;font-weight:700;color:#10B981;font-family:'Nunito',sans-serif;}
        .cm-live-dot{width:7px;height:7px;border-radius:50%;background:#10B981;animation:livePulse 2.4s ease infinite;}
        @keyframes livePulse{0%,100%{opacity:1;transform:scale(1);}50%{opacity:0.5;transform:scale(0.75);}}
        @keyframes previewFlash{0%{background:#D1FAE5;border-bottom-color:#6EE7B7;}100%{background:#F2F2F7;border-bottom-color:#E5E5EA;}}
        .cm-preview-bar-flash{animation:previewFlash 0.6s ease-out;}
        .cm-preview-iframe{flex:1;width:100%;border:none;background:white;min-height:240px;}
        .js-console{display:flex;flex-direction:column;height:100%;background:#1E1E1E;font-family:'JetBrains Mono',monospace;min-height:240px;}
        .js-console-bar{background:#2D2D2D;padding:7px 14px;display:flex;align-items:center;justify-content:space-between;border-bottom:1px solid #3C3C3C;flex-shrink:0;}
        .js-console-title{font-family:'Nunito',sans-serif;font-size:12px;font-weight:800;color:#9CDCFE;letter-spacing:0.02em;}
        .js-console-clear{font-size:11px;background:transparent;border:1px solid #3C3C3C;border-radius:5px;color:#6B6B8A;cursor:pointer;padding:2px 8px;font-family:'Nunito',sans-serif;font-weight:700;transition:border-color 0.15s,color 0.15s;}
        .js-console-clear:hover{border-color:#555570;color:#9CA3AF;}
        .js-console-output{flex:1;overflow-y:auto;padding:6px 0;}
        .js-console-empty{padding:12px 16px;font-size:12px;color:#3C3C4C;font-style:italic;}
        .js-console-line{padding:4px 16px;font-size:12.5px;line-height:1.65;border-bottom:1px solid rgba(255,255,255,0.03);white-space:pre-wrap;word-break:break-all;display:flex;align-items:flex-start;gap:6px;}
        .js-console-log{color:#D4D4D4;}
        .js-console-warn{color:#DDB66E;background:rgba(221,182,110,0.05);}
        .js-console-err{color:#F48771;background:rgba(244,135,113,0.05);}
        .js-console-alert{color:#B5CEA8;border-left:2px solid #569CD6;padding-left:14px;}
        .js-console-tag{font-size:10px;background:#569CD6;color:#1E1E1E;border-radius:3px;padding:1px 5px;font-weight:800;font-family:'Nunito',sans-serif;flex-shrink:0;margin-top:2px;}
        .js-console-icon{flex-shrink:0;margin-top:1px;}

        /* ── Tabs Shell ── */
        .tabs-root{border-radius:16px;overflow:hidden;border:1px solid #2D2D3F;box-shadow:0 4px 24px rgba(0,0,0,0.2);}
        .tabs-header{background:#14142A;padding:0 16px;display:flex;align-items:center;justify-content:space-between;border-bottom:1px solid #2D2D3F;gap:12px;flex-wrap:wrap;min-height:48px;}
        .tabs-nav{display:flex;gap:0;}
        .tab-btn{display:flex;align-items:center;gap:7px;padding:12px 18px;border:none;border-bottom:2px solid transparent;background:transparent;color:#555570;font-family:'Nunito',sans-serif;font-size:13px;font-weight:700;cursor:pointer;transition:color 0.15s,border-color 0.15s;white-space:nowrap;}
        .tab-btn:hover{color:#CDD6F4;}
        .tab-btn-active{color:#CDD6F4 !important;border-bottom-color:#7361FF;}
        .tab-dot{width:9px;height:9px;border-radius:50%;flex-shrink:0;}
        .tab-lock-badge{font-size:10px;opacity:0.65;margin-left:2px;}
        .tabs-hint{font-size:11px;color:#444460;font-weight:500;padding:8px 0;white-space:nowrap;}
        .tab-filename{font-family:'JetBrains Mono',monospace;font-size:11px;color:#444460;margin-left:4px;}
        .tabs-body{display:flex;align-items:stretch;background:#1A1A2E;}
        @media(max-width:800px){.tabs-body{flex-direction:column;}}
        .tabs-editor-pane{flex:1;min-width:0;display:flex;flex-direction:column;}
        .tabs-editor-bar{display:flex;align-items:center;gap:8px;padding:8px 16px;background:#0F0F20;border-bottom:1px solid #2D2D3F;}
        .tabs-preview-pane{width:46%;flex-shrink:0;border-left:1px solid #2D2D3F;display:flex;flex-direction:column;background:white;}
        @media(max-width:800px){.tabs-preview-pane{width:100%;border-left:none;border-top:1px solid #2D2D3F;}}
        .tabs-explanation{background:#0F0F20;border-top:1px solid #2D2D3F;padding:16px 20px;display:flex;flex-direction:column;gap:10px;}
        .tabs-explanation .expl-item{display:flex;align-items:flex-start;gap:10px;font-size:14px;color:#8899AA;line-height:1.6;}
        .tabs-explanation .expl-arrow{color:#7361FF;}

        /* ── TabbedTask ── */
        .ttask-root{}
        .ttask-instructions{background:#F5F3FF;border:1px solid #DDD6FE;border-radius:16px;padding:20px 24px;}
        .ttask-instr-label{font-family:'Nunito',sans-serif;font-size:11px;font-weight:800;text-transform:uppercase;letter-spacing:0.08em;color:var(--brand);margin-bottom:12px;}
        .ttask-instr-list{list-style:none;padding:0;margin:0;display:flex;flex-direction:column;gap:10px;}
        .ttask-instr-item{display:flex;align-items:flex-start;gap:12px;font-size:14px;color:#374151;line-height:1.5;}
        .ttask-instr-num{flex-shrink:0;width:24px;height:24px;background:linear-gradient(135deg,#7361FF,#8C78FF);color:white;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:12px;font-weight:800;font-family:'Nunito',sans-serif;margin-top:1px;}
        .task-footer{padding:16px 28px;display:flex;justify-content:flex-end;background:#FAFAFA;border-bottom:1.5px solid #F3F0FF;}
        .task-eval-btn{padding:12px 28px;border-radius:12px;border:none;font-family:'Nunito',sans-serif;font-weight:800;font-size:15px;background:linear-gradient(135deg,#7361FF,#8C78FF);color:white;cursor:pointer;box-shadow:0 4px 16px rgba(115,97,255,0.3);}
        .task-eval-btn:disabled{opacity:0.6;cursor:not-allowed;}
        .task-eval-loading{display:flex;align-items:center;gap:6px;}
        .ttask-result{display:flex;align-items:flex-start;gap:14px;padding:20px 24px;animation:fadeUp 0.25s ease both;}
        .ttask-result-ok{background:linear-gradient(135deg,#F0FDF4,#ECFDF5);}
        .ttask-result-fail{background:linear-gradient(135deg,#FFF7ED,#FFFBEB);}
        .ttask-result-icon{font-size:24px;flex-shrink:0;margin-top:2px;}
        .ttask-result-text{font-size:14px;line-height:1.7;color:#374151;}
        .ttask-result-ok .ttask-result-text{color:#166534;}
        .ttask-result-fail .ttask-result-text{color:#92400E;}
        .ttask-success-banner{display:flex;align-items:center;justify-content:space-between;gap:16px;flex-wrap:wrap;padding:20px 24px;background:linear-gradient(135deg,#F0FDF4,#DCFCE7);border:2px solid #10B981;border-radius:16px;margin-bottom:16px;}
        .ttask-success-left{display:flex;align-items:center;gap:14px;}
        .ttask-success-emoji{font-size:36px;line-height:1;}
        .ttask-success-title{font-family:'Nunito',sans-serif;font-weight:900;font-size:17px;color:#166534;margin-bottom:3px;}
        .ttask-success-sub{font-size:13px;color:#166534;opacity:0.8;}
        .ttask-retry-btn{padding:9px 18px;border-radius:10px;border:1.5px solid #10B981;background:white;color:#059669;font-family:'Nunito',sans-serif;font-weight:800;font-size:13px;cursor:pointer;transition:background 0.15s,transform 0.15s;flex-shrink:0;}
        .ttask-retry-btn:hover{background:#F0FDF4;transform:translateY(-1px);}

        /* ── Legacy TaskBlock (single editor) ── */
        .task-block{background:#1A1A2E;border:1px solid #2D2D3F;border-radius:16px;overflow:hidden;}
        .task-editor-wrap{display:grid;grid-template-columns:1fr 1fr;}
        @media(max-width:800px){.task-editor-wrap{grid-template-columns:1fr;}}
        .task-editor-shell{border-right:1.5px solid #2D2D3F;}

        /* ── Drag & Drop ── */
        .dnd-root{margin-top:8px;}
        .dnd-subtitle{font-size:14px;color:var(--muted);margin-bottom:16px;line-height:1.5;}
        .dnd-mission{display:flex;align-items:flex-start;gap:10px;background:#F5F3FF;border:1px solid #DDD6FE;border-radius:14px;padding:14px 18px;margin-bottom:24px;font-size:14px;color:#4C1D95;line-height:1.6;}
        .dnd-layout{display:grid;grid-template-columns:1fr auto 1fr;gap:16px;align-items:start;margin-bottom:20px;}
        @media(max-width:700px){.dnd-layout{grid-template-columns:1fr;}.dnd-arrow-col{display:none;}}
        .dnd-col{display:flex;flex-direction:column;gap:8px;}
        .dnd-col-label{font-family:'Nunito',sans-serif;font-size:11px;font-weight:800;text-transform:uppercase;letter-spacing:0.06em;color:var(--faint);}
        .dnd-arrow-col{display:flex;align-items:center;justify-content:center;font-size:24px;color:var(--brand-mid);padding-top:28px;user-select:none;}
        .dnd-zone{min-height:120px;border-radius:16px;border:2px dashed var(--border);padding:12px;display:flex;flex-direction:column;gap:8px;transition:border-color 0.15s,background 0.15s;}
        .dnd-pool{background:#FAFAFA;}
        .dnd-dropzone{background:#F8F7FF;border-color:#C4B5FD;}
        .dnd-zone-over{border-color:var(--brand);background:var(--brand-light);}
        .dnd-zone-correct{border-color:#10B981;background:#F0FDF4;border-style:solid;}
        .dnd-empty{text-align:center;font-size:13px;color:var(--faint);padding:20px 0;font-style:italic;}
        .dnd-placeholder{display:flex;flex-direction:column;align-items:center;gap:8px;padding:28px 16px;color:var(--faint);font-size:13px;text-align:center;}
        .dnd-block{display:flex;align-items:center;gap:10px;padding:10px 14px;border-radius:10px;border:1.5px solid var(--border);background:white;cursor:grab;transition:transform 0.12s,box-shadow 0.12s,border-color 0.15s,margin 0.12s;user-select:none;}
        .dnd-block:active{cursor:grabbing;}
        .dnd-block-pool{border-color:#DDD6FE;background:#F5F3FF;}
        .dnd-block-pool:hover{transform:translateY(-1px);box-shadow:0 4px 14px rgba(115,97,255,0.15);border-color:var(--brand);}
        .dnd-block-dropped{border-color:#C4B5FD;background:white;}
        .dnd-block-correct{border-color:#10B981 !important;background:#F0FDF4 !important;cursor:default;}
        .dnd-block-dragging{opacity:0.4;transform:scale(0.97);}
        .dnd-block-insert-before{border-top:3px solid var(--brand);margin-top:6px;}
        .dnd-block-insert-after{border-bottom:3px solid var(--brand);margin-bottom:6px;}
        .dnd-handle{color:var(--faint);font-size:14px;cursor:grab;flex-shrink:0;}
        .dnd-num{width:22px;height:22px;border-radius:7px;background:var(--brand-light);color:var(--brand);display:flex;align-items:center;justify-content:center;font-family:'Nunito',sans-serif;font-size:12px;font-weight:800;flex-shrink:0;}
        .dnd-code{font-family:'JetBrains Mono',monospace;font-size:12.5px;color:#1e293b;flex:1;white-space:pre;overflow:hidden;text-overflow:ellipsis;}
        .dnd-block-correct .dnd-code{color:#166534;}
        .dnd-ok{color:#10B981;font-size:14px;font-weight:700;flex-shrink:0;margin-left:auto;}
        .dnd-remove{flex-shrink:0;width:20px;height:20px;border-radius:50%;border:none;background:#FEE2E2;color:#DC2626;font-size:14px;cursor:pointer;display:flex;align-items:center;justify-content:center;line-height:1;margin-left:auto;transition:background 0.12s;}
        .dnd-remove:hover{background:#FECACA;}
        .dnd-actions{display:flex;gap:10px;margin-bottom:16px;}
        .dnd-btn-check{padding:11px 24px;border-radius:12px;border:none;font-family:'Nunito',sans-serif;font-weight:800;font-size:14px;background:linear-gradient(135deg,var(--brand),var(--brand-2));color:white;cursor:pointer;box-shadow:0 4px 14px rgba(115,97,255,0.3);transition:opacity 0.15s,transform 0.12s;}
        .dnd-btn-check:disabled{opacity:0.45;cursor:not-allowed;}
        .dnd-btn-check:not(:disabled):hover{transform:translateY(-1px);}
        .dnd-btn-reset{padding:11px 20px;border-radius:12px;border:1.5px solid var(--border);background:white;font-family:'Nunito',sans-serif;font-weight:800;font-size:13px;color:var(--muted);cursor:pointer;transition:background 0.12s;}
        .dnd-btn-reset:hover{background:var(--bg);}
        .dnd-result{display:flex;align-items:flex-start;gap:12px;padding:16px 20px;border-radius:14px;font-size:14px;line-height:1.6;animation:fadeUp 0.25s ease both;}
        .dnd-result-correct{flex-direction:column;background:#F0FDF4;border:1.5px solid #A7F3D0;color:#166534;}
        .dnd-result-wrong{background:#FEF2F2;border:1.5px solid #FECACA;color:#991B1B;}
        .dnd-result-top{display:flex;align-items:flex-start;gap:12px;}
        @keyframes dndShake{0%,100%{transform:translateX(0);}20%,60%{transform:translateX(-6px);}40%,80%{transform:translateX(6px);}}
        .dnd-shake{animation:dndShake 0.5s ease both;}

        /* ── Single CodeBlock + AI Pomocník ── */
        .cm-tutor-root{position:relative;}
        .cm-shell{margin:20px 0;border-radius:16px;overflow:hidden;border:1px solid #2D2D3F;box-shadow:0 4px 24px rgba(0,0,0,0.22);background:#1A1A2E;display:flex;align-items:stretch;width:100%;}
        .cm-editor-pane{flex:1;min-width:0;display:flex;flex-direction:column;}
        .cm-chrome{display:flex;flex-direction:column;height:100%;}
        .cm-preview-pane{flex-shrink:0;width:48%;min-width:0;border-left:1px solid #2D2D3F;display:flex;flex-direction:column;background:white;}
        @media(max-width:900px){.cm-shell{flex-direction:column;}.cm-preview-pane{width:100% !important;border-left:none;border-top:1px solid #2D2D3F;}}
        .ai-bubble{position:absolute;z-index:50;display:flex;align-items:center;gap:4px;background:white;border:1.5px solid #E8E6F0;border-radius:100px;padding:5px 6px;box-shadow:0 4px 20px rgba(115,97,255,0.18);animation:bubblePop 0.15s cubic-bezier(0.34,1.56,0.64,1) both;}
        @keyframes bubblePop{from{opacity:0;transform:scale(0.8) translateY(4px);}to{opacity:1;transform:scale(1) translateY(0);}}
        .bubble-primary{display:flex;align-items:center;gap:5px;border:none;border-radius:100px;padding:5px 12px;font-family:'Nunito',sans-serif;font-size:12px;font-weight:800;background:linear-gradient(135deg,#7361FF,#8C78FF);color:white;cursor:pointer;}
        .bubble-ghost{border:none;border-radius:100px;padding:5px 11px;font-family:'Nunito',sans-serif;font-size:12px;font-weight:800;background:#F5F3FF;color:#7361FF;cursor:pointer;}
        .bubble-sep{width:1px;height:18px;background:#E8E6F0;margin:0 2px;}
        .bubble-x{width:24px;height:24px;border-radius:50%;border:none;background:transparent;color:#9CA3AF;font-size:16px;cursor:pointer;display:flex;align-items:center;justify-content:center;}
        .ai-overlay{position:fixed;inset:0;z-index:200;display:flex;align-items:center;justify-content:center;background:rgba(17,17,24,0.45);backdrop-filter:blur(4px);animation:aiOverlayIn 0.15s ease both;padding:20px;}
        @keyframes aiOverlayIn{from{opacity:0;}to{opacity:1;}}
        .ai-panel{background:white;border-radius:24px;box-shadow:0 24px 64px rgba(0,0,0,0.18);width:100%;max-width:520px;overflow:hidden;animation:panelIn 0.2s cubic-bezier(0.34,1.2,0.64,1) both;}
        @keyframes panelIn{from{opacity:0;transform:translateY(12px) scale(0.97);}to{opacity:1;transform:translateY(0) scale(1);}}
        .ap-header{display:flex;align-items:center;justify-content:space-between;padding:20px 24px 16px;border-bottom:1px solid #F3F4F6;}
        .ap-icon{width:36px;height:36px;border-radius:12px;background:linear-gradient(135deg,#7361FF,#8C78FF);display:flex;align-items:center;justify-content:center;font-size:16px;}
        .ap-title{font-family:'Nunito',sans-serif;font-size:16px;font-weight:900;color:#111118;margin:0;}
        .ap-sub{font-size:12px;color:#9CA3AF;margin:0;}
        .ap-hist-btn{display:flex;align-items:center;gap:5px;border:1px solid #E8E6F0;border-radius:8px;background:white;padding:5px 10px;font-size:12px;font-weight:700;font-family:'Nunito',sans-serif;color:#6B7280;cursor:pointer;}
        .ap-close-btn{width:32px;height:32px;border-radius:10px;border:1px solid #E8E6F0;background:white;color:#9CA3AF;font-size:18px;cursor:pointer;display:flex;align-items:center;justify-content:center;}
        .ap-history{border-top:1px solid #F3F4F6;}
        .ap-hist-label{padding:12px 24px;font-family:'Nunito',sans-serif;font-size:11px;font-weight:800;color:#9CA3AF;text-transform:uppercase;letter-spacing:0.06em;}
        .ap-hist-item{padding:12px 24px;border-top:1px solid #F9FAFB;cursor:pointer;}
        .ap-hist-q{font-size:13px;font-weight:600;color:#374151;margin-bottom:3px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}
        .ap-hist-a{font-size:12px;color:#9CA3AF;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}
        .ap-body{padding:20px 24px;display:flex;flex-direction:column;gap:16px;}
        .ap-field-label{display:block;font-family:'Nunito',sans-serif;font-size:12px;font-weight:800;color:#374151;text-transform:uppercase;letter-spacing:0.05em;margin-bottom:6px;}
        .ap-code-preview{background:#1A1A2E;border-radius:12px;overflow:hidden;}
        .ap-code-header{padding:8px 12px;background:#14142A;border-bottom:1px solid #2D2D3F;}
        .ap-code-lang{font-size:11px;font-family:'JetBrains Mono',monospace;color:#7C6AF7;letter-spacing:0.06em;text-transform:uppercase;}
        .ap-code-pre{padding:12px 14px;font-family:'JetBrains Mono',monospace;font-size:12px;color:#CDD6F4;line-height:1.6;white-space:pre-wrap;word-break:break-all;max-height:100px;overflow-y:auto;margin:0;}
        .ap-textarea{width:100%;border:1.5px solid #E8E6F0;border-radius:12px;padding:12px 14px;font-family:'Sora',sans-serif;font-size:14px;color:#111118;background:white;resize:none;min-height:72px;outline:none;transition:border-color 0.15s,box-shadow 0.15s;line-height:1.5;}
        .ap-textarea:focus{border-color:#7361FF;box-shadow:0 0 0 3px rgba(115,97,255,0.12);}
        .ap-hint{font-size:11px;color:#9CA3AF;margin-top:4px;}
        .ap-answer{margin:0 24px 20px;border-radius:14px;overflow:hidden;border:1px solid #E8E6F0;}
        .ap-answer-header{padding:10px 14px;background:linear-gradient(135deg,#F5F3FF,#FDF4FF);border-bottom:1px solid #EDE9FF;font-family:'Nunito',sans-serif;font-size:12px;font-weight:800;color:#7361FF;text-transform:uppercase;letter-spacing:0.05em;}
        .ap-answer-text{padding:14px;font-size:14px;color:#374151;line-height:1.7;background:white;}
        .ap-loading{display:flex;align-items:center;gap:5px;padding:20px 14px;background:white;}
        .ld{width:7px;height:7px;border-radius:50%;background:#7361FF;animation:ldBounce 0.9s infinite ease-in-out both;display:inline-block;}
        .ld:nth-child(2){animation-delay:0.15s;}.ld:nth-child(3){animation-delay:0.3s;}
        @keyframes ldBounce{0%,80%,100%{transform:scale(0.6);opacity:0.4;}40%{transform:scale(1);opacity:1;}}
        .ap-actions{display:flex;gap:8px;padding:0 24px 20px;}
        .ap-btn-primary{flex:1;padding:12px;border-radius:12px;border:none;font-family:'Nunito',sans-serif;font-weight:800;font-size:14px;background:linear-gradient(135deg,#7361FF,#8C78FF);color:white;cursor:pointer;box-shadow:0 4px 14px rgba(115,97,255,0.3);}
        .ap-btn-primary:disabled{opacity:0.55;cursor:not-allowed;}
        .ap-btn-ghost{flex:1;padding:12px;border-radius:12px;background:#F9FAFB;border:1.5px solid #E8E6F0;color:#6B7280;font-family:'Nunito',sans-serif;font-weight:800;font-size:14px;cursor:pointer;}

        /* ── Lock modal ── */
        .lock-overlay{position:fixed;inset:0;z-index:300;display:flex;align-items:center;justify-content:center;background:rgba(17,17,24,0.55);backdrop-filter:blur(6px);animation:aiOverlayIn 0.18s ease both;padding:20px;}
        .lock-box{background:white;border-radius:24px;box-shadow:0 24px 64px rgba(0,0,0,0.2);width:100%;max-width:440px;overflow:hidden;animation:panelIn 0.22s cubic-bezier(0.34,1.2,0.64,1) both;}
        .lock-header{padding:28px 28px 0;text-align:center;}
        .lock-icon{font-size:44px;margin-bottom:12px;line-height:1;}
        .lock-title{font-family:'Nunito',sans-serif;font-size:20px;font-weight:900;color:#111118;margin-bottom:6px;}
        .lock-sub{font-size:14px;color:#6B7280;line-height:1.6;}
        .lock-items{margin:20px 28px;display:flex;flex-direction:column;gap:10px;}
        .lock-item{display:flex;align-items:center;gap:12px;padding:14px 16px;border-radius:14px;border:1.5px solid;font-family:'Nunito',sans-serif;font-size:14px;font-weight:700;}
        .lock-item.ok{border-color:#A7F3D0;background:#F0FDF4;color:#166534;}
        .lock-item.missing{border-color:#FECACA;background:#FEF2F2;color:#991B1B;}
        .lock-item-icon{font-size:18px;flex-shrink:0;}
        .lock-item-label{font-size:12px;font-weight:600;opacity:0.7;display:block;margin-bottom:2px;text-transform:uppercase;letter-spacing:0.04em;}
        .lock-footer{padding:0 28px 28px;display:flex;flex-direction:column;gap:10px;}
        .lock-close-btn{width:100%;padding:13px;border-radius:12px;border:none;font-family:'Nunito',sans-serif;font-weight:800;font-size:15px;background:linear-gradient(135deg,#7361FF,#8C78FF);color:white;cursor:pointer;}
        .lock-hint{font-size:12px;color:#9CA3AF;text-align:center;line-height:1.5;}

        @media(max-width:900px){.sidebar{display:none;}.lesson-content{padding:32px 24px 80px;}}
        @media(max-width:600px){.lesson-content{padding:24px 16px 80px;}.section-title{font-size:20px;}.progress-bar-outer{width:80px;}}
      `}</style>

      <div className="lesson-root">
        {xpToast !== null && (
          <div style={{ position: 'fixed', bottom: 32, right: 32, zIndex: 999, background: 'linear-gradient(135deg,#7361FF,#8C78FF)', color: 'white', borderRadius: 16, padding: '16px 24px', boxShadow: '0 8px 32px rgba(115,97,255,0.4)', fontFamily: 'Nunito,sans-serif', fontWeight: 900, fontSize: 18, display: 'flex', alignItems: 'center', gap: 10, animation: 'fadeUp 0.4s ease both' }}>
            <span style={{ fontSize: 24 }}>⚡</span>
            <div><div>+{xpToast} XP získané!</div><div style={{ fontSize: 12, fontWeight: 600, opacity: 0.8 }}>Lekcia dokončená 🎉</div></div>
          </div>
        )}

        {/* Topbar */}
        <div className="topbar">
          <div className="topbar-left">
            <Link href="/app/learning/javascript" className="back-link">← JavaScript kurz</Link>
            <div className="topbar-divider" />
            <span className="topbar-title">{lesson.order}. {lesson.title}</span>
          </div>
          <div className="topbar-right">
            {lessonCompleted && (
              <div style={{ background: 'linear-gradient(135deg,#F0FDF4,#DCFCE7)', border: '1px solid #10B981', borderRadius: 100, padding: '4px 12px', fontSize: 12, fontWeight: 800, fontFamily: 'Nunito,sans-serif', color: '#166534', display: 'flex', alignItems: 'center', gap: 5 }}>✓ Dokončené</div>
            )}
            <button
              onClick={() => setShowGroupMenu(true)}
              style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'linear-gradient(135deg,#7361FF,#8C78FF)', color: 'white', border: 'none', borderRadius: 100, padding: '4px 12px', fontSize: 12, fontWeight: 800, fontFamily: 'Nunito,sans-serif', cursor: 'pointer', boxShadow: '0 2px 8px rgba(115,97,255,0.3)' }}
            >
              👥 Skupina
            </button>
            {canProceed && !lessonCompleted && (
              <div style={{ background: 'linear-gradient(135deg,#FEF9C3,#FEF08A)', border: '1px solid #EAB308', borderRadius: 100, padding: '4px 12px', fontSize: 12, fontWeight: 800, fontFamily: 'Nunito,sans-serif', color: '#713F12', display: 'flex', alignItems: 'center', gap: 5 }}>🎯 Pripravené</div>
            )}
            <div className="progress-wrap">
              <div className="progress-bar-outer"><div className="progress-bar-inner" style={{ width: `${progress}%` }} /></div>
              <span className="progress-pct">{progress}%</span>
            </div>
            <div className="xp-pill">⚡ {displayedXp} XP</div>
          </div>
        </div>

        <div className="lesson-layout">
          {/* Sidebar */}
          <aside className="sidebar">
            <div className="sidebar-inner">
              <div className="sidebar-lesson-info">
                <div className="sidebar-order">Lekcia {lesson.order} / {lessons.length}</div>
                <div className="sidebar-lesson-title">{lesson.title}</div>
                <div className="sidebar-meta">
                  <div className="sidebar-meta-item">⏱️ {lesson.estimatedMinutes} min</div>
                  <div className="sidebar-meta-item">⚡ {lesson.xp} XP</div>
                </div>
              </div>
              <div className="sidebar-sections-label">Sekcie</div>
              {lesson.sections.map((section, idx) => {
                const meta = SECTION_META[section.type] || { icon: '•', label: section.type, color: '#6B7280' };
                const isCompleted = lessonCompleted || completedSections.has(idx);
                const isActive = !lessonCompleted && activeSection === idx;
                return (
                  <button key={idx} className={`sidebar-section-btn ${isCompleted ? 'completed' : ''} ${isActive ? 'active' : ''}`} onClick={() => scrollToSection(idx)}>
                    <div className="sidebar-check">{isCompleted ? '✓' : ''}</div>
                    <div className="sidebar-section-text">
                      <div className="sidebar-section-name">{section.title}</div>
                      <div className="sidebar-section-type">{meta.label}</div>
                    </div>
                    <span className="sidebar-section-icon">{meta.icon}</span>
                  </button>
                );
              })}
              <GroupLessonPanel lessonId={lesson.lesson_id} />
            </div>
          </aside>

          {/* Main content */}
          <main className="lesson-content">
            {lessonCompleted && <CompletionBanner xp={lesson.xp} nextLesson={nextLesson} />}

            {lesson.sections.map((section, idx) => (
              <div key={idx} ref={el => { sectionRefs.current[idx] = el; }}>
                <SectionBlock
                  section={section}
                  lessonId={lesson.lesson_id}
                  quizId={lesson.quiz_id}
                  taskId={lesson.task_id}
                  lessonXp={lesson.xp}
                  onTaskPassed={(result, score = 0) => { setTaskResult(result); setTaskScore(score); }}
                  onTaskAttempted={() => setTaskResult(prev => prev === 'none' ? 'fail' : prev)}
                  onQuizDone={() => setQuizDone(true)}
                  onDragDropDone={() => setDragDropDone(true)}
                />
              </div>
            ))}

            <nav className="lesson-nav">
              {prevLesson ? (
                <Link href={`/app/learning/javascript/${prevLesson.slug}`} className="nav-btn">
                  <span>←</span>
                  <div><span className="nav-btn-label">Predchádzajúca</span><div className="nav-btn-title">{prevLesson.title}</div></div>
                </Link>
              ) : <div className="nav-btn-spacer" />}

              {nextLesson ? (
                <button className="nav-btn nav-btn-next" onClick={() => handleNextLesson(`/app/learning/javascript/${nextLesson.slug}`)}>
                  <div style={{ textAlign: 'right' }}><span className="nav-btn-label">Ďalšia lekcia</span><div className="nav-btn-title">{nextLesson.title}</div></div>
                  <span>→</span>
                </button>
              ) : (
                <button className="nav-btn nav-btn-next" onClick={() => handleNextLesson('/app/learning/javascript')}>
                  <div style={{ textAlign: 'right' }}><span className="nav-btn-label">Kurz dokončený!</span><div className="nav-btn-title">Späť na prehľad 🎉</div></div>
                  <span>→</span>
                </button>
              )}
            </nav>
          </main>
        </div>
      </div>

      <GroupLessonMenu lessonId={lesson.lesson_id} lessonTitle={lesson.title} open={showGroupMenu} onClose={() => setShowGroupMenu(false)} />

      {/* Lock modal */}
      {showLockModal && (
        <div className="lock-overlay" onClick={() => setShowLockModal(false)}>
          <div className="lock-box" onClick={e => e.stopPropagation()}>
            <div className="lock-header">
              <div className="lock-icon">🔒</div>
              <div className="lock-title">Najprv dokonči lekciu</div>
              <div className="lock-sub">Pred pokračovaním musíš splniť tieto podmienky:</div>
            </div>
            <div className="lock-items">
              {hasQuizGate && (
                <div className={`lock-item ${quizDone ? 'ok' : 'missing'}`}>
                  <span className="lock-item-icon">{quizDone ? '✅' : '📝'}</span>
                  <div><span className="lock-item-label">Kvíz</span>{quizDone ? 'Kvíz dokončený' : 'Odpovedz na všetky otázky'}</div>
                </div>
              )}
              {hasTaskGate && (
                <div className={`lock-item ${taskAttempted ? 'ok' : 'missing'}`}>
                  <span className="lock-item-icon">{taskAttempted ? '✅' : '✏️'}</span>
                  <div><span className="lock-item-label">Zadanie</span>{taskAttempted ? 'Zadanie odovzdané' : 'Klikni na Vyhodnotiť aspoň raz'}</div>
                </div>
              )}
              {hasDragDropGate && (
                <div className={`lock-item ${dragDropDone ? 'ok' : 'missing'}`}>
                  <span className="lock-item-icon">{dragDropDone ? '✅' : '🧩'}</span>
                  <div><span className="lock-item-label">Drag & Drop</span>{dragDropDone ? 'Výzva splnená' : 'Poskladaj funkciu správne'}</div>
                </div>
              )}
            </div>
            <div className="lock-footer">
              <button className="lock-close-btn" onClick={() => setShowLockModal(false)}>Rozumiem, vrátim sa k lekcii</button>
              <p className="lock-hint">Výsledok nevadí — dôležité je že to skúsiš 💪</p>
            </div>
          </div>
        </div>
      )}
    </>
  );
}