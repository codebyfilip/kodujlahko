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
import { oneDark } from '@codemirror/theme-one-dark';
import trackData from '../css.json';
import { saveQuizAttempt, saveTaskSubmission, markLessonComplete, getLessonProgress, getTaskSubmission, updateStreak } from '../../../../actions/progres';
import GroupLessonMenu from '@/components/GroupLessonMenu';
import { runCssValidation, type CssValidationConfig } from '../../../../lib/cssValidator';

// ─── Types ────────────────────────────────────────────────────────────────────
interface CodeData { language: string; value: string; }
interface Question { q: string; options: string[]; answer: string; why: string; }

interface AiEvaluation {
  enabled: boolean;
  criteria: string[];
  xpReward: number;
  feedbackType: string;
}

interface TabData { label: string; language: string; value: string; editable?: boolean; }

interface Section {
  type: string;
  title: string;
  content?: string[];
  items?: string[];
  steps?: string[];
  expectedOutput?: string[];
  explanation?: string[];
  code?: CodeData;
  questions?: Question[];
  subtitle?: string;
  instructions?: string[];
  starterCode?: CodeData;
  aiEvaluation?: AiEvaluation;
  validationConfig?: CssValidationConfig;
  xpReward?: number;
  requiredToComplete?: boolean;
  tabs?: TabData[];
  activeTabOnLoad?: number;
  mission?: {
    goal: string;
    targetElement: string;
    targetStyles: Record<string, string>;
    allowedProperties: string[];
    successCriteria: string[];
    uiHint?: string;
  };
}

interface Lesson {
  id: string;
  lesson_id: string;  // "lesson-html-01"
  quiz_id: string;    // "quiz-html-01"
  task_id: string;    // "task-html-01"
  order: number;
  slug: string;
  title: string;
  summary: string;
  estimatedMinutes: number;
  xp: number;
  sections: Section[];
  completionCriteria?: {
    requiredSections: string[];
    minimumCorrectAnswers: number;
    totalXp: number;
  };
}

interface HistoryEntry { id: string; question: string; answer: string; selectedCode: string; }
interface BubblePos { top: number; left: number; }

// ─── Section meta ─────────────────────────────────────────────────────────────
const SECTION_META: Record<string, { icon: string; label: string; color: string }> = {
  intro:           { icon: '💡', label: 'Úvod',         color: '#7C3AED' },
  concept:         { icon: '📖', label: 'Pojmy',         color: '#2563EB' },
  example:         { icon: '💻', label: 'Ukážka kódu',  color: '#059669' },
  mentor_tip:      { icon: '🎯', label: 'Mentor tip',    color: '#D97706' },
  common_mistakes: { icon: '⚠️', label: 'Časté chyby',  color: '#DC2626' },
  mini_task:       { icon: '✏️', label: 'Mini úloha',   color: '#7361FF' },
  self_check:      { icon: '✅', label: 'Skontroluj sa', color: '#059669' },
  recap:           { icon: '🔁', label: 'Zhrnutie',      color: '#374151' },
  task:            { icon: '✏️', label: 'Úloha',          color: '#7361FF' },
  tip:             { icon: '💬', label: 'Tip',            color: '#D97706' },
  warning:         { icon: '⚠️', label: 'Pozor',         color: '#DC2626' },
};


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
    else if (match[5] && match[6]) parts.push(<a key={match.index} href={match[6]} target="_blank" rel="noopener noreferrer" style={{ color: '#7361FF', textDecoration: 'underline', cursor: 'pointer' }}>{match[5]}</a>);
    else if (match[7]) parts.push(<em key={match.index} style={{ fontStyle: 'italic' }}>{match[7]}</em>);
    last = regex.lastIndex;
  }
  if (last < text.length) parts.push(text.slice(last));
  return parts;
}

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
  if (lang === 'css') return cssLang();
  if (lang === 'js' || lang === 'javascript') return javascript();
  return htmlLang();
}

// ─── CodeBlock (ukážka s AI Pomocník) ───────────────────────────────────────────
function CodeBlock({ code }: { code: CodeData }) {
  const cmRef = useRef<ReactCodeMirrorRef>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const prevUrlRef = useRef<string | null>(null);
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
  const [aiUsed, setAiUsed] = useState<number | null>(null);
  const lang = code.language.toLowerCase();

  

  useEffect(() => { setMounted(true); }, []);
  useEffect(() => {
    if (showPanel && aiUsed === null) {
      fetch('/api/ai/usage').then(r => r.json()).then(d => setAiUsed(d.used));
    }
  }, [showPanel, aiUsed]);
  useEffect(() => {
    document.body.style.overflow = showPanel ? 'hidden' : '';
    return () => { document.body.style.overflow = ''; };
  }, [showPanel]);
  const canPreview = lang === 'html' || lang === 'css' || lang === 'js' || lang === 'javascript';

  const buildDoc = useCallback((src: string) => {
    if (lang === 'css') return `<!doctype html><html><head><meta charset="UTF-8"><style>body{font-family:-apple-system,sans-serif;padding:24px;color:#111;}h1{font-size:22px;}p{color:#555;line-height:1.6;}a{margin-right:12px;}button{padding:8px 16px;border-radius:8px;border:1px solid #ccc;cursor:pointer;}${src}</style></head><body><h1>Nadpis stránky</h1><p>Toto je odsek textu na ukážku CSS štýlovania.</p><a href="#">Odkaz</a><button>Tlačidlo</button></body></html>`;
    if (lang === 'js' || lang === 'javascript') return `<!doctype html><html><head><meta charset="UTF-8"><style>body{font-family:-apple-system,sans-serif;padding:20px;font-size:14px;color:#111;}.out-line{padding:2px 0;border-bottom:1px solid #f0f0f0;}.out-err{color:#DC2626;font-weight:600;}</style></head><body><div id="out"></div><script>const _out=document.getElementById('out');const _log=console.log.bind(console);console.log=(...a)=>{_out.insertAdjacentHTML('beforeend','<div class="out-line">'+a.map(v=>typeof v==='object'?JSON.stringify(v,null,2):String(v)).join(' ')+'</div>');_log(...a);};try{${src}}catch(e){_out.insertAdjacentHTML('beforeend','<div class="out-err">❌ '+e.message+'</div>');}<\/script></body></html>`;
    return src;
  }, [lang]);

  useEffect(() => {
    const iframe = iframeRef.current; if (!iframe) return;
    const url = URL.createObjectURL(new Blob([buildDoc(val)], { type: 'text/html;charset=utf-8' }));
    if (prevUrlRef.current) { const old = prevUrlRef.current; setTimeout(() => URL.revokeObjectURL(old), 2000); }
    prevUrlRef.current = url; iframe.src = url;
  }, [val, buildDoc]);

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
      const res = await fetch('/api/ai/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: selectedText, question, language: code.language }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setLoading(false);
        setAnswer(data.error ?? 'Chyba pri komunikácii s AI. Skús znovu.');
        return;
      }
      if (!res.body) throw new Error('API error');
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let full = '';
      setLoading(false);
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        full += decoder.decode(value, { stream: true });
        setAnswer(full);
      }
      setHistory(h => [{ id: Date.now().toString(), question, answer: full, selectedCode: selectedText }, ...h].slice(0, 3));
      setAiUsed(u => (u ?? 0) + 1);
    } catch {
      setLoading(false);
      setAnswer('Chyba pri komunikácii s AI. Skús znovu.');
    }
  };
  const onKey = (e: KeyboardEvent<HTMLTextAreaElement>) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); submit(); } };

  useEffect(() => {
    const h = (e: globalThis.KeyboardEvent) => {
      if (e.key === 'Escape') { setShowPanel(false); setShowBubble(false); }
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') { e.preventDefault(); if (selectedText.trim()) openPanel(); }
    };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, [selectedText, openPanel]);

  return (
    <div className="cm-tutor-root w-full" ref={containerRef}>
      <div className={`cm-shell ${canPreview && previewOpen ? 'cm-shell-split' : ''}`}>
        <div className="cm-editor-pane">
          <div className="cm-chrome">
            <div className="cm-topbar">
              <div className="cm-dots"><div className="cm-dot" style={{ background: '#FF5F57' }} /><div className="cm-dot" style={{ background: '#FFBD2E' }} /><div className="cm-dot" style={{ background: '#28C840' }} /></div>
              <span className="cm-lang-badge">{code.language.toUpperCase()}</span>
              <div className="cm-topbar-right">
                <div className="cm-hint"><span>Označ text a spytaj sa AI</span></div>
                {canPreview && <button className={`cm-toggle ${previewOpen ? 'cm-toggle-on' : ''}`} onClick={() => setPreviewOpen(p => !p)}><span className="cm-toggle-icon">{previewOpen ? '◧' : '◨'}</span><span>Náhľad</span></button>}
              </div>
            </div>
            <CodeMirror ref={cmRef} value={val} onChange={setVal} extensions={[getLang(code.language), oneDark, cmDarkTheme]} onCreateEditor={onCreateEditor} theme="none" height='300px' basicSetup={{ lineNumbers: true, highlightActiveLine: true, autocompletion: false, foldGutter: false }} />
          </div>
        </div>
        {canPreview && (
          <div className="cm-preview-pane" style={{ opacity: previewOpen ? 1 : 0, visibility: previewOpen ? 'visible' : 'hidden', width: previewOpen ? undefined : 0, overflow: previewOpen ? undefined : 'hidden', transition: 'opacity 0.28s ease, width 0.3s ease' }}>
            <div className="cm-preview-chrome">
              <div className="cm-preview-bar">
                <div className="cm-preview-dots"><div className="cm-dot" style={{ background: '#FF5F57', opacity: 0.35 }} /><div className="cm-dot" style={{ background: '#FFBD2E', opacity: 0.35 }} /><div className="cm-dot" style={{ background: '#28C840', opacity: 0.35 }} /></div>
                <div className="cm-preview-address"><svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ color: '#10B981', flexShrink: 0 }}><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg><span>náhľad</span></div>
                <div className="cm-live-badge"><div className="cm-live-dot" /><span>Live</span></div>
              </div>
              <iframe ref={iframeRef} className="cm-preview-iframe" sandbox="allow-scripts" title="Live preview" />
            </div>
          </div>
        )}
      </div>

      {showBubble && bubblePos && (
        <div className="ai-bubble" style={{ top: bubblePos.top, left: bubblePos.left }}>
          <button className="bubble-btn-primary" onClick={() => openPanel()}>✨ Spýtaj sa</button>
          <div className="bubble-sep" /><button className="bubble-btn-ghost" onClick={() => openPanel('Vysvetli mi tento kód.')}>Vysvetli</button>
          <div className="bubble-sep" /><button className="bubble-x" onClick={() => setShowBubble(false)}>×</button>
        </div>
      )}

      {mounted && showPanel && createPortal(
        <div className="ai-overlay" onClick={e => { if (e.target === e.currentTarget) closePanel(); }}>
          <div className="ai-panel">
            <div className="ap-header">
              <div className="ap-title-row"><div className="ap-icon">✨</div><div><p className="ap-title">AI Pomocník</p><p className="ap-sub">Spýtaj sa na označený kód</p></div></div>
              <div className="ap-header-actions">
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
              <div><span className="ap-field-label">Označený kód</span><div className="ap-code-preview"><div className="ap-code-header"><span className="ap-code-lang">{code.language} · {selectedText.split('\n').length} riadok</span></div><pre className="ap-code-pre">{selectedText || '(žiadny text neoznačený)'}</pre></div></div>
              <div><label className="ap-field-label" htmlFor="ai-q">Tvoja otázka</label><textarea id="ai-q" ref={textareaRef} className="ap-textarea" placeholder="Napr. Prečo tento tag potrebuje atribút alt?" value={question} onChange={e => setQuestion(e.target.value)} onKeyDown={onKey} rows={3} /><div className="ap-hint"><kbd>Enter</kbd> odoslať · <kbd>Shift+Enter</kbd> nový riadok</div></div>
            </div>
            {(loading || answer) && (
              <div className="ap-answer"><div className="ap-answer-header">✨ AI odpoveď</div>
                {loading ? <div className="ap-loading"><div className="ld" /><div className="ld" /><div className="ld" /></div> : <div className="ap-answer-text">{answer.split('\n').map((line, i) => <p key={i} style={{ margin: i === 0 ? 0 : '8px 0 0' }}>{parseInline(line)}</p>)}</div>}
              </div>
            )}
            <div className="ap-actions"><button className="ap-btn-primary" onClick={submit} disabled={loading || !question.trim()}>{loading ? '⏳ Generujem...' : '✨ Odoslať'}</button><button className="ap-btn-ghost" onClick={closePanel}>Zrušiť</button></div>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}

// ─── SelfCheck — ukladá do Supabase ──────────────────────────────────────────
function SelfCheck({
  questions,
  lessonId,
  quizId,
  onDone,
}: {
  questions: Question[];
  lessonId: string;
  quizId: string;
  onDone?: (correctCount: number) => void;
}) {
  const [answers, setAnswers] = useState<Record<number, string>>({});
  const [revealed, setRevealed] = useState<Record<number, boolean>>({});
  const savedRef = useRef(false);

  const pick = (qi: number, opt: string) => {
    if (revealed[qi]) return;
    const newAnswers = { ...answers, [qi]: opt };
    const newRevealed = { ...revealed, [qi]: true };
    setAnswers(newAnswers);
    setRevealed(newRevealed);

    // Keď sú všetky otázky zodpovedané → ulož do Supabase
    if (Object.keys(newRevealed).length === questions.length && !savedRef.current) {
      savedRef.current = true;
      const correctCount = questions.filter((q, i) => newAnswers[i]?.[0] === q.answer).length;
      saveQuizAttempt({ lessonId, quizId });
      onDone?.(correctCount);
    }
  };

  return (
    <div className="quiz-wrap">
      {questions.map((q, qi) => {
        const chosen = answers[qi];
        const isRevealed = revealed[qi];
        const isCorrect = chosen?.[0] === q.answer;
        return (
          <div key={qi} className="quiz-question">
            <p className="quiz-q">{qi + 1}. {q.q}</p>
            <div className="quiz-options">
              {q.options.map((opt, oi) => {
                const letter = opt[0];
                const isThis = chosen === opt;
                const isCorrectOpt = letter === q.answer;
                let cls = 'quiz-opt';
                if (isRevealed) { if (isCorrectOpt) cls += ' opt-correct'; else if (isThis && !isCorrect) cls += ' opt-wrong'; else cls += ' opt-dim'; }
                return (
                  <button key={oi} className={cls} onClick={() => pick(qi, opt)} disabled={isRevealed}>
                    <span className="opt-letter">{letter}</span>
                    <span>{opt.slice(3)}</span>
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

// ─── TaskResult helpers ───────────────────────────────────────────────────────
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

// ─── TaskBlock — ukladá do Supabase (rovnaká logika ako HTML) ─────────────────
function TaskBlock({
  section,
  lessonId,
  taskId,
  lessonXp,
  onPassed,
  onAttempted,
}: {
  section: Section;
  lessonId: string;
  taskId: string;
  lessonXp: number;
  onPassed?: (result: Exclude<TaskResult, 'none'>, score?: number) => void;
  onAttempted?: () => void;
}) {
  const [val, setVal] = useState(section.starterCode?.value ?? '');
  const [evalState, setEvalState] = useState<'idle' | 'loading' | 'done'>('idle');
  const [evalResult, setEvalResult] = useState<{ ok: boolean; result: 'fail' | 'partial' | 'full'; message: string } | null>(null);
  const [isPassed, setIsPassed] = useState(false);
  const [showRetry, setShowRetry] = useState(false);
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const prevUrlRef = useRef<string | null>(null);
  const passedRef = useRef(false);
  const attemptedRef = useRef(false);

  const lang = section.starterCode?.language?.toLowerCase() ?? 'css';

  // Obal CSS do HTML dokumentu pre náhľad
  const buildPreview = useCallback((src: string) => {
    if (lang === 'css') return `<!doctype html><html><head><meta charset="UTF-8"><style>body{font-family:-apple-system,sans-serif;padding:24px;color:#111;}h1{font-size:22px;}p{color:#555;line-height:1.6;}a{margin-right:12px;}button{padding:8px 16px;border-radius:8px;border:1px solid #ccc;cursor:pointer;}${src}</style></head><body><h1>Nadpis stránky</h1><p>Toto je odsek textu na ukážku CSS štýlovania.</p><a href="#">Odkaz</a><button>Tlačidlo</button></body></html>`;
    return src;
  }, [lang]);

  // Načítaj predchádzajúce odovzdanie pri otvorení
  useEffect(() => {
    if (!lessonId || !taskId) return;
    getTaskSubmission(lessonId, taskId).then((sub) => {
      if (!sub) return;

      if (!attemptedRef.current) {
        attemptedRef.current = true;
        onAttempted?.();
      }

      const prevResult: Exclude<TaskResult, 'none'> =
        sub.passed ? 'full' : sub.score >= 40 ? 'partial' : 'fail';

      setVal(sub.code ?? section.starterCode?.value ?? '');
      setEvalResult({ ok: prevResult === 'full', result: prevResult, message: sub.feedback ?? '' });
      setEvalState('done');
      onPassed?.(prevResult, sub.score ?? 0);

      if (prevResult === 'full') {
        passedRef.current = true;
        setIsPassed(true);
      } else {
        passedRef.current = false;
        setIsPassed(false);
      }
    });
  }, [lessonId, taskId, onAttempted, onPassed, section.starterCode?.value]);

  useEffect(() => {
    const iframe = iframeRef.current; if (!iframe) return;
    const url = URL.createObjectURL(new Blob([buildPreview(val)], { type: 'text/html;charset=utf-8' }));
    if (prevUrlRef.current) { const old = prevUrlRef.current; setTimeout(() => URL.revokeObjectURL(old), 2000); }
    prevUrlRef.current = url; iframe.src = url;
  }, [val, buildPreview]);

  const handleEvaluate = async () => {
    setEvalState('loading');
    setEvalResult(null);
    await new Promise(r => setTimeout(r, 600));

    let passed: boolean;
    let score: number;
    let message: string;

    if (section.validationConfig) {
      const result = runCssValidation(val, section.validationConfig);
      passed = result.passed;
      score = result.score;
      message = result.feedback;
    } else {
      const legacy = evaluateCode(val, section.aiEvaluation?.criteria ?? []);
      passed = legacy.passed;
      score = legacy.score;
      message = legacy.message;
    }

    const taskResult: 'fail' | 'partial' | 'full' = passed ? 'full' : score >= 40 ? 'partial' : 'fail';

    // Ulož ak: ešte neprešiel, alebo ak nový výsledok je tiež 100%
    if (!passedRef.current || passed) {
      const xpEarned = getLessonAwardXp(taskResult, lessonXp, score);
      await saveTaskSubmission({
        lessonId,
        taskId,
        code: val,
        passed,
        score,
        feedback: message,
        xpEarned,
      });

      if (!attemptedRef.current) {
        attemptedRef.current = true;
        onAttempted?.();
      }
    }

    setEvalResult({ ok: passed, result: taskResult, message });
    setEvalState('done');
    onPassed?.(taskResult, score);

    if (taskResult === 'full') {
      setIsPassed(true);
      setShowRetry(false);
      passedRef.current = true;
    } else {
      setIsPassed(false);
      passedRef.current = false;
    }
  };

  // Ak je úloha splnená a user nechce retry — zobraz completion view
  if (isPassed && !showRetry) {
    return (
      <div className="task-block">
        <div className="task-header">
          <div className="task-badge">✏️ Úloha</div>
          <h2 className="task-title">{section.title}</h2>
          {section.subtitle && <p className="task-subtitle">{section.subtitle}</p>}
        </div>

        {/* Completion banner */}
        <div className="task-completed-banner">
          <div className="task-completed-left">
            <div className="task-completed-icon">🎉</div>
            <div>
              <div className="task-completed-title">Úloha splnená!</div>
              <div className="task-completed-sub">
                {evalResult?.message
                  ? evalResult.message.split('\n')[0]
                  : `Získal si +${section.aiEvaluation?.xpReward ?? 15} XP`}
              </div>
            </div>
          </div>
          <button
            className="task-retry-btn"
            onClick={() => setShowRetry(true)}
          >
            ↺ Skúsiť znovu
          </button>
        </div>

        {/* Posledný kód — read only */}
        <div className="task-completed-code">
          <div className="task-completed-code-label">Tvoje riešenie</div>
          <div className="task-editor-shell" style={{ borderRight: 'none' }}>
            <div className="task-editor-bar">
              <div className="cm-dots">
                <div className="cm-dot" style={{ background: '#FF5F57' }} />
                <div className="cm-dot" style={{ background: '#FFBD2E' }} />
                <div className="cm-dot" style={{ background: '#28C840' }} />
              </div>
              <span className="cm-lang-badge">{(section.starterCode?.language ?? 'html').toUpperCase()}</span>
              <span style={{ marginLeft: 'auto', fontSize: '11px', fontWeight: 700, color: '#10B981', fontFamily: 'Nunito,sans-serif' }}>✓ Splnené</span>
            </div>
            <CodeMirror
              value={val}
              editable={false}
              extensions={[getLang(section.starterCode?.language ?? 'html'), oneDark, cmDarkTheme]}
              theme="none"
              height="220px"
              basicSetup={{ lineNumbers: true, highlightActiveLine: false, autocompletion: false, foldGutter: false }}
            />
          </div>
        </div>
      </div>
    );
  }

  // Normálny editor (nový pokus alebo prvýkrát)
  return (
    <div className="task-block">
      <div className="task-header">
        <div className="task-badge">✏️ Úloha</div>
        <h2 className="task-title">{section.title}</h2>
        {section.subtitle && <p className="task-subtitle">{section.subtitle}</p>}
      </div>

      {section.instructions && section.instructions.length > 0 && (
        <div className="task-instructions">
          <div className="task-instr-label">Zadanie</div>
          <ol className="task-instr-list">
            {section.instructions.map((instr, i) => (
              <li key={i} className="task-instr-item">
                <span className="task-instr-num">{i + 1}</span>
                <span>{instr}</span>
              </li>
            ))}
          </ol>
        </div>
      )}

      <div className="task-editor-wrap">
        <div className="task-editor-shell">
          <div className="task-editor-bar">
            <div className="cm-dots">
              <div className="cm-dot" style={{ background: '#FF5F57' }} />
              <div className="cm-dot" style={{ background: '#FFBD2E' }} />
              <div className="cm-dot" style={{ background: '#28C840' }} />
            </div>
            <span className="cm-lang-badge">{(section.starterCode?.language ?? 'html').toUpperCase()}</span>
          </div>
          <div style={{ height: '300px', overflow: 'hidden', flexShrink: 0 }}>
            <CodeMirror
              value={val}
              onChange={setVal}
              extensions={[getLang(section.starterCode?.language ?? 'html'), oneDark, cmDarkTheme]}
              theme="none"
              height="300px"
              basicSetup={{ lineNumbers: true, highlightActiveLine: true, autocompletion: false, foldGutter: false }}
            />
          </div>
        </div>
        <div className="task-preview-shell">
          <div className="cm-preview-bar">
            <div className="cm-preview-dots">
              <div className="cm-dot" style={{ background: '#FF5F57', opacity: 0.35 }} />
              <div className="cm-dot" style={{ background: '#FFBD2E', opacity: 0.35 }} />
              <div className="cm-dot" style={{ background: '#28C840', opacity: 0.35 }} />
            </div>
            <div className="cm-preview-address">
              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ color: '#10B981', flexShrink: 0 }}>
                <rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>
              </svg>
              <span>náhľad</span>
            </div>
            <div className="cm-live-badge"><div className="cm-live-dot" /><span>Live</span></div>
          </div>
          <iframe ref={iframeRef} className="task-preview-iframe" sandbox="allow-scripts" title="Task preview" />
        </div>
      </div>

      <div className="task-footer">
        {showRetry && (
          <button
            className="task-retry-btn"
            style={{ marginRight: 'auto' }}
            onClick={() => { setShowRetry(false); setEvalState('idle'); setEvalResult(null); }}
          >
            ← Späť na splnené
          </button>
        )}
        <button className="task-eval-btn" onClick={handleEvaluate} disabled={evalState === 'loading'}>
          {evalState === 'loading'
            ? <span className="task-eval-loading"><span className="ld" /><span className="ld" /><span className="ld" /> Vyhodnocujem...</span>
            : '✨ Vyhodnotiť'}
        </button>
      </div>

      {evalState === 'done' && evalResult && (
        <div className={`task-result ${evalResult.result === 'full' ? 'task-result-ok' : evalResult.result === 'partial' ? 'task-result-partial' : 'task-result-fail'}`}>
          <div className="task-result-icon">{evalResult.result === 'full' ? '🎉' : evalResult.result === 'partial' ? '⚠️' : '💡'}</div>
          <div className="task-result-text" style={{ whiteSpace: 'pre-line' }}>{evalResult.message}</div>
        </div>
      )}
    </div>
  );
}


// ─── Spoločné utility pre tabový editor ──────────────────────────────────────
const TAB_LANG_COLOR: Record<string, string> = { html: '#E44D26', css: '#264DE4' };

function buildCombinedHtml(htmlVal: string, cssVal: string): string {
  return htmlVal.replace(/<style[^>]*>[\s\S]*?<\/style>/i, `<style>\n${cssVal}\n</style>`);
}

// ─── CssTabbedCodeBlock — ukážkový kód (tabbed_example) ──────────────────────
function CssTabbedCodeBlock({ section }: { section: Section }) {
  const tabs = section.tabs ?? [];
  const [activeTab, setActiveTab] = useState(section.activeTabOnLoad ?? 1);
  const activeTabRef = useRef(section.activeTabOnLoad ?? 1);
  const [tabValues, setTabValues] = useState<string[]>(tabs.map(t => t.value));
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const prevUrlRef = useRef<string | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const editorViews = useRef<(EditorView | null)[]>([]);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const [bubblePos, setBubblePos] = useState<BubblePos | null>(null);
  const [selectedText, setSelectedText] = useState('');
  const [showBubble, setShowBubble] = useState(false);
  const [showPanel, setShowPanel] = useState(false);
  const [question, setQuestion] = useState('');
  const [loading, setLoading] = useState(false);
  const [answer, setAnswer] = useState('');
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [showHistory, setShowHistory] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [aiUsed, setAiUsed] = useState<number | null>(null);

  const combined = buildCombinedHtml(tabValues[0] ?? '', tabValues[1] ?? '');

  useEffect(() => { setMounted(true); }, []);
  useEffect(() => {
    document.body.style.overflow = showPanel ? 'hidden' : '';
    return () => { document.body.style.overflow = ''; };
  }, [showPanel]);
  useEffect(() => {
    if (showPanel && aiUsed === null) {
      fetch('/api/ai/usage').then(r => r.json()).then(d => setAiUsed(d.used));
    }
  }, [showPanel, aiUsed]);

  useEffect(() => {
    const iframe = iframeRef.current; if (!iframe) return;
    const url = URL.createObjectURL(new Blob([combined], { type: 'text/html;charset=utf-8' }));
    if (prevUrlRef.current) { const old = prevUrlRef.current; setTimeout(() => URL.revokeObjectURL(old), 2000); }
    prevUrlRef.current = url; iframe.src = url;
  }, [combined]);

  const checkSelection = useCallback(() => {
    const view = editorViews.current[activeTabRef.current]; if (!view) return;
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

  const makeOnCreateEditor = useCallback((idx: number) => (view: EditorView) => {
    editorViews.current[idx] = view;
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
      const lang = tabs[activeTab]?.language ?? 'css';
      const res = await fetch('/api/ai/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: selectedText, question, language: lang }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setLoading(false);
        setAnswer(data.error ?? 'Chyba pri komunikácii s AI. Skús znovu.');
        return;
      }
      if (!res.body) throw new Error('API error');
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
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
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, [selectedText, openPanel]);

  const filename = (lang: string) => lang === 'html' ? 'index.html' : lang === 'css' ? 'style.css' : lang;

  return (
    <div className="tabs-root" ref={containerRef} style={{ position: 'relative' }}>
      <div className="tabs-header">
        <div className="tabs-nav">
          {tabs.map((tab, i) => (
            <button key={i} className={`tab-btn${activeTab === i ? ' tab-btn-active' : ''}`} onClick={() => { activeTabRef.current = i; setActiveTab(i); setShowBubble(false); }}>
              <span className="tab-dot" style={{ background: TAB_LANG_COLOR[tab.language] ?? '#888' }} />
              {tab.label}
            </button>
          ))}
        </div>
        <span className="tabs-hint">Označ kód a spýtaj sa AI · <kbd style={{fontSize:10,background:'#f1f5f9',borderRadius:4,padding:'1px 5px',border:'1px solid #e2e8f0'}}>⌘K</kbd></span>
      </div>
      <div className="tabs-body">
        <div className="tabs-editor-pane">
          <div className="tabs-editor-bar">
            <div className="cm-dots"><div className="cm-dot" style={{ background: '#FF5F57' }}/><div className="cm-dot" style={{ background: '#FFBD2E' }}/><div className="cm-dot" style={{ background: '#28C840' }}/></div>
            <span className="cm-lang-badge" style={{ color: TAB_LANG_COLOR[tabs[activeTab]?.language] ?? '#7C6AF7' }}>{tabs[activeTab]?.language?.toUpperCase()}</span>
            <span className="tab-filename">{filename(tabs[activeTab]?.language ?? '')}</span>
          </div>
          {tabs.map((tab, i) => (
            <div key={i} style={{ display: activeTab === i ? 'block' : 'none' }}>
              <CodeMirror value={tabValues[i]} onChange={v => setTabValues(vals => { const n = [...vals]; n[i] = v; return n; })}
                extensions={[getLang(tab.language), oneDark, cmDarkTheme]} theme="none" height="280px"
                onCreateEditor={makeOnCreateEditor(i)}
                basicSetup={{ lineNumbers: true, highlightActiveLine: true, autocompletion: false, foldGutter: false }} />
            </div>
          ))}
        </div>
        <div className="tabs-preview-pane">
          <div className="cm-preview-bar">
            <div className="cm-preview-dots"><div className="cm-dot" style={{ background: '#FF5F57', opacity: 0.35 }}/><div className="cm-dot" style={{ background: '#FFBD2E', opacity: 0.35 }}/><div className="cm-dot" style={{ background: '#28C840', opacity: 0.35 }}/></div>
            <div className="cm-preview-address"><svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ color: '#10B981', flexShrink: 0 }}><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg><span>náhľad</span></div>
            <div className="cm-live-badge"><div className="cm-live-dot" /><span>Live</span></div>
          </div>
          <iframe ref={iframeRef} style={{ flex: 1, border: 'none', width: '100%', background: 'white' }} sandbox="allow-scripts" title="Preview" />
        </div>
      </div>
      {section.explanation && section.explanation.length > 0 && (
        <div className="tabs-explanation">
          {section.explanation.map((e, i) => (
            <div key={i} className="expl-item"><span className="expl-arrow">→</span><span>{parseInline(e)}</span></div>
          ))}
        </div>
      )}

      {showBubble && bubblePos && (
        <div className="ai-bubble" style={{ top: bubblePos.top, left: bubblePos.left }}>
          <button className="bubble-btn-primary" onClick={() => openPanel()}>✨ Spýtaj sa</button>
          <div className="bubble-sep" /><button className="bubble-btn-ghost" onClick={() => openPanel('Vysvetli mi tento kód.')}>Vysvetli</button>
          <div className="bubble-sep" /><button className="bubble-x" onClick={() => setShowBubble(false)}>×</button>
        </div>
      )}

      {mounted && showPanel && createPortal(
        <div className="ai-overlay" onClick={e => { if (e.target === e.currentTarget) closePanel(); }}>
          <div className="ai-panel">
            <div className="ap-header">
              <div className="ap-title-row"><div className="ap-icon">✨</div><div><p className="ap-title">AI Pomocník</p><p className="ap-sub">Spýtaj sa na označený kód</p></div></div>
              <div className="ap-header-actions">
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
              <div><span className="ap-field-label">Označený kód</span><div className="ap-code-preview"><div className="ap-code-header"><span className="ap-code-lang">{tabs[activeTab]?.language} · {selectedText.split('\n').length} riadok</span></div><pre className="ap-code-pre">{selectedText || '(žiadny text neoznačený)'}</pre></div></div>
              <div><label className="ap-field-label" htmlFor="ai-q-tab">Tvoja otázka</label><textarea id="ai-q-tab" ref={textareaRef} className="ap-textarea" placeholder="Napr. Prečo tento selektor nefunguje?" value={question} onChange={e => setQuestion(e.target.value)} onKeyDown={onKey} rows={3} /><div className="ap-hint"><kbd>Enter</kbd> odoslať · <kbd>Shift+Enter</kbd> nový riadok</div></div>
            </div>
            {(loading || answer) && (
              <div className="ap-answer-wrap">
                {loading && <div className="ap-loading"><div className="ap-spinner" /><span>AI píše odpoveď…</span></div>}
                {answer && <div className="ap-answer">{answer}</div>}
              </div>
            )}
            <div className="ap-footer">
              <button className="ap-submit-btn" onClick={submit} disabled={loading || !question.trim()}>
                {loading ? 'Odosielam…' : '✨ Odoslať otázku'}
              </button>
            </div>
          </div>
        </div>,
        document.body,
      )}
    </div>
  );
}

// ─── CssTabbedTaskBlock — HTML + CSS záložky (úloha) ─────────────────────────
function CssTabbedTaskBlock({
  section, lessonId, taskId, lessonXp, onPassed, onAttempted,
}: {
  section: Section; lessonId: string; taskId: string; lessonXp: number;
  onPassed?: (result: Exclude<TaskResult, 'none'>, score?: number) => void;
  onAttempted?: () => void;
}) {
  const tabs = section.tabs ?? [];
  const [activeTab, setActiveTab] = useState(section.activeTabOnLoad ?? 1);
  const [tabValues, setTabValues] = useState<string[]>(tabs.map(t => t.value));
  const [evalState, setEvalState] = useState<'idle' | 'loading' | 'done'>('idle');
  const [evalResult, setEvalResult] = useState<{ ok: boolean; result: 'fail' | 'partial' | 'full'; message: string } | null>(null);
  const [isPassed, setIsPassed] = useState(false);
  const [showRetry, setShowRetry] = useState(false);
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const prevUrlRef = useRef<string | null>(null);
  const passedRef = useRef(false);
  const attemptedRef = useRef(false);

  const combinedHtml = buildCombinedHtml(tabValues[0] ?? '', tabValues[1] ?? '');
  const filename = (lang: string) => lang === 'html' ? 'index.html' : lang === 'css' ? 'style.css' : lang;

  useEffect(() => {
    const iframe = iframeRef.current; if (!iframe) return;
    const url = URL.createObjectURL(new Blob([combinedHtml], { type: 'text/html;charset=utf-8' }));
    if (prevUrlRef.current) { const old = prevUrlRef.current; setTimeout(() => URL.revokeObjectURL(old), 2000); }
    prevUrlRef.current = url; iframe.src = url;
  }, [combinedHtml]);

  useEffect(() => {
    if (!lessonId || !taskId) return;
    getTaskSubmission(lessonId, taskId).then((sub) => {
      if (!sub) return;
      if (!attemptedRef.current) { attemptedRef.current = true; onAttempted?.(); }
      const savedCss = /<html|<!doctype/i.test(sub.code ?? '')
        ? (sub.code ?? '').match(/<style[^>]*>([\s\S]*?)<\/style>/i)?.[1] ?? sub.code ?? ''
        : sub.code ?? '';
      const prevResult: Exclude<TaskResult, 'none'> = sub.passed ? 'full' : sub.score >= 40 ? 'partial' : 'fail';
      setTabValues(prev => [prev[0], savedCss]);
      setEvalResult({ ok: prevResult === 'full', result: prevResult, message: sub.feedback ?? '' });
      setEvalState('done');
      onPassed?.(prevResult, sub.score ?? 0);
      if (prevResult === 'full') { passedRef.current = true; setIsPassed(true); }
    });
  }, [lessonId, taskId, onAttempted, onPassed]);

  const handleEvaluate = async () => {
    setEvalState('loading'); setEvalResult(null);
    await new Promise(r => setTimeout(r, 600));
    let passed: boolean, score: number, message: string;
    if (section.validationConfig) {
      const res = runCssValidation(combinedHtml, section.validationConfig);
      passed = res.passed; score = res.score; message = res.feedback;
    } else {
      const legacy = evaluateCode(tabValues[1] ?? '', section.aiEvaluation?.criteria ?? []);
      passed = legacy.passed; score = legacy.score; message = legacy.message;
    }
    const taskResult: Exclude<TaskResult, 'none'> = passed ? 'full' : score >= 40 ? 'partial' : 'fail';
    if (!passedRef.current || passed) {
      const cssCode = tabValues[1] ?? '';
      const xpEarned = getLessonAwardXp(taskResult, lessonXp, score);
      await saveTaskSubmission({ lessonId, taskId, code: cssCode, passed, score, feedback: message, xpEarned });
      if (!attemptedRef.current) { attemptedRef.current = true; onAttempted?.(); }
    }
    setEvalResult({ ok: passed, result: taskResult, message });
    setEvalState('done');
    onPassed?.(taskResult, score);
    if (taskResult === 'full') { setIsPassed(true); setShowRetry(false); passedRef.current = true; }
    else { setIsPassed(false); passedRef.current = false; }
  };

  // ── Completion view ──
  if (isPassed && !showRetry) {
    return (
      <div className="ttask-root">
        <div className="task-header">
          <div className="task-badge">✏️ Úloha</div>
          <h2 className="task-title">{section.title}</h2>
          {section.subtitle && <p className="task-subtitle">{section.subtitle}</p>}
        </div>
        <div className="ttask-success-banner">
          <div className="ttask-success-left">
            <span className="ttask-success-emoji">🎉</span>
            <div>
              <div className="ttask-success-title">Úloha splnená!</div>
              <div className="ttask-success-sub">+{section.aiEvaluation?.xpReward ?? 15} XP získané</div>
            </div>
          </div>
          <button className="task-retry-btn" onClick={() => { setShowRetry(true); setEvalState('idle'); setEvalResult(null); }}>↺ Skúsiť znovu</button>
        </div>
        <div className="tabs-root" style={{ marginTop: 0, borderTopLeftRadius: 0, borderTopRightRadius: 0, borderTop: 'none' }}>
          <div className="tabs-header">
            <div className="tabs-nav">
              {tabs.map((tab, i) => (
                <button key={i} className={`tab-btn${activeTab === i ? ' tab-btn-active' : ''}`} onClick={() => setActiveTab(i)}>
                  <span className="tab-dot" style={{ background: TAB_LANG_COLOR[tab.language] ?? '#888' }} />
                  {tab.label}
                  <span className="tab-lock-badge">🔒</span>
                </button>
              ))}
            </div>
            <span style={{ fontSize: '11px', fontWeight: 700, color: '#10B981', fontFamily: 'Nunito,sans-serif', padding: '8px 0' }}>✓ Splnené</span>
          </div>
          <div className="tabs-body">
            <div className="tabs-editor-pane">
              <div className="tabs-editor-bar">
                <div className="cm-dots"><div className="cm-dot" style={{ background: '#FF5F57' }}/><div className="cm-dot" style={{ background: '#FFBD2E' }}/><div className="cm-dot" style={{ background: '#28C840' }}/></div>
                <span className="cm-lang-badge" style={{ color: TAB_LANG_COLOR[tabs[activeTab]?.language] ?? '#7C6AF7' }}>{tabs[activeTab]?.language?.toUpperCase()}</span>
                <span className="tab-filename">{filename(tabs[activeTab]?.language ?? '')}</span>
              </div>
              {tabs.map((tab, i) => (
                <div key={i} style={{ display: activeTab === i ? 'block' : 'none' }}>
                  <CodeMirror value={tabValues[i]} editable={false} extensions={[getLang(tab.language), oneDark, cmDarkTheme]} theme="none" height="260px" basicSetup={{ lineNumbers: true, highlightActiveLine: false, autocompletion: false, foldGutter: false }} />
                </div>
              ))}
            </div>
            <div className="tabs-preview-pane">
              <div className="cm-preview-bar">
                <div className="cm-preview-dots"><div className="cm-dot" style={{ background: '#FF5F57', opacity: 0.35 }}/><div className="cm-dot" style={{ background: '#FFBD2E', opacity: 0.35 }}/><div className="cm-dot" style={{ background: '#28C840', opacity: 0.35 }}/></div>
                <div className="cm-preview-address"><svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ color: '#10B981', flexShrink: 0 }}><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg><span>náhľad</span></div>
                <div className="cm-live-badge"><div className="cm-live-dot" /><span>Live</span></div>
              </div>
              <iframe ref={iframeRef} style={{ flex: 1, border: 'none', width: '100%', background: 'white' }} sandbox="allow-scripts" title="Preview" />
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ── Normal (edit) view ──
  return (
    <div className="ttask-root">
      <div className="task-header">
        <div className="task-badge">✏️ Úloha</div>
        <h2 className="task-title">{section.title}</h2>
        {section.subtitle && <p className="task-subtitle">{section.subtitle}</p>}
      </div>
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
      <div className="tabs-root" style={{ marginTop: 0, borderTopLeftRadius: 0, borderTopRightRadius: 0, borderTop: 'none' }}>
        <div className="tabs-header">
          <div className="tabs-nav">
            {tabs.map((tab, i) => (
              <button key={i} className={`tab-btn${activeTab === i ? ' tab-btn-active' : ''}`} onClick={() => setActiveTab(i)}>
                <span className="tab-dot" style={{ background: TAB_LANG_COLOR[tab.language] ?? '#888' }} />
                {tab.label}
              </button>
            ))}
          </div>
          <span className="tabs-hint">CSS záložka je primárna — HTML môžeš tiež meniť</span>
        </div>
        <div className="tabs-body">
          <div className="tabs-editor-pane">
            <div className="tabs-editor-bar">
              <div className="cm-dots"><div className="cm-dot" style={{ background: '#FF5F57' }}/><div className="cm-dot" style={{ background: '#FFBD2E' }}/><div className="cm-dot" style={{ background: '#28C840' }}/></div>
              <span className="cm-lang-badge" style={{ color: TAB_LANG_COLOR[tabs[activeTab]?.language] ?? '#7C6AF7' }}>{tabs[activeTab]?.language?.toUpperCase()}</span>
              <span className="tab-filename">{filename(tabs[activeTab]?.language ?? '')}</span>
            </div>
            {tabs.map((tab, i) => (
              <div key={i} style={{ display: activeTab === i ? 'block' : 'none' }}>
                <CodeMirror value={tabValues[i]} onChange={v => setTabValues(vals => { const n = [...vals]; n[i] = v; return n; })}
                  extensions={[getLang(tab.language), oneDark, cmDarkTheme]} theme="none" height="280px"
                  basicSetup={{ lineNumbers: true, highlightActiveLine: true, autocompletion: false, foldGutter: false }} />
              </div>
            ))}
          </div>
          <div className="tabs-preview-pane">
            <div className="cm-preview-bar">
              <div className="cm-preview-dots"><div className="cm-dot" style={{ background: '#FF5F57', opacity: 0.35 }}/><div className="cm-dot" style={{ background: '#FFBD2E', opacity: 0.35 }}/><div className="cm-dot" style={{ background: '#28C840', opacity: 0.35 }}/></div>
              <div className="cm-preview-address"><svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ color: '#10B981', flexShrink: 0 }}><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg><span>náhľad</span></div>
              <div className="cm-live-badge"><div className="cm-live-dot" /><span>Live</span></div>
            </div>
            <iframe ref={iframeRef} style={{ flex: 1, border: 'none', width: '100%', background: 'white' }} sandbox="allow-scripts" title="Preview" />
          </div>
        </div>
      </div>
      <div className="task-footer">
        {showRetry && <button className="task-retry-btn" style={{ marginRight: 'auto' }} onClick={() => { setShowRetry(false); setEvalState('idle'); setEvalResult(null); }}>← Späť na splnené</button>}
        <button className="task-eval-btn" onClick={handleEvaluate} disabled={evalState === 'loading'}>
          {evalState === 'loading' ? <span className="task-eval-loading"><span className="ld" /><span className="ld" /><span className="ld" /> Vyhodnocujem...</span> : '✨ Vyhodnotiť'}
        </button>
      </div>
      {evalState === 'done' && evalResult && (
        <div className={`task-result ${evalResult.result === 'full' ? 'task-result-ok' : evalResult.result === 'partial' ? 'task-result-partial' : 'task-result-fail'}`}>
          <div className="task-result-icon">{evalResult.result === 'full' ? '🎉' : evalResult.result === 'partial' ? '⚠️' : '💡'}</div>
          <div className="task-result-text" style={{ whiteSpace: 'pre-line' }}>{evalResult.message}</div>
        </div>
      )}
    </div>
  );
}

// ─── InteractiveCheckBlock ────────────────────────────────────────────────────
const CHIPS_OPTIONS: Record<string, string[]> = {
  'font-size':    ['12px', '14px', '16px', '20px', '24px', '32px'],
  'font-family':  ['Arial', 'Georgia', 'monospace', 'Verdana', 'Times New Roman', 'sans-serif'],
  'color':        ['#222222', '#ff0000', '#0000ff', '#555555', 'black', '#333333', '#7361FF', 'coral'],
  'font-weight':  ['300', '400', '500', '700', '900', 'bold', 'normal'],
  'font-style':   ['normal', 'italic', 'oblique'],
  'text-align':   ['left', 'center', 'right', 'justify'],
  'text-decoration': ['none', 'underline', 'line-through', 'overline'],
  'background-color': ['#ffffff', '#f0f0f0', '#7361FF', '#ffd700', 'transparent', '#222222'],
  'line-height':  ['1', '1.2', '1.5', '1.6', '1.8', '2'],
  'letter-spacing': ['0', '0.05em', '0.1em', '0.2em', '-0.02em'],
};

function strHash(s: string, seed: number): number {
  return s.split('').reduce((acc, c, i) => acc + c.charCodeAt(0) * (i + 1 + seed), 0);
}

function getChipOptions(prop: string, correctVal: string): string[] {
  const base = CHIPS_OPTIONS[prop] ?? ['auto', 'inherit', 'initial'];
  const seed = correctVal.split('').reduce((acc, c) => acc + c.charCodeAt(0), 0);

  // Pick 4 wrong distractors, shuffled deterministically
  const distractors = base
    .filter(v => v !== correctVal)
    .sort((a, b) => strHash(a, seed) % 17 - strHash(b, seed) % 17)
    .slice(0, 4);

  // Always include correct answer, then shuffle all 5
  return [...distractors, correctVal].sort(
    (a, b) => strHash(a, seed + 3) % 13 - strHash(b, seed + 3) % 13
  );
}

function InteractiveCheckBlock({
  section,
  lessonId,
  quizId,
  initialPassed,
  onPassed,
}: {
  section: Section;
  lessonId: string;
  quizId: string;
  initialPassed?: boolean;
  onPassed?: () => void;
}) {
  const mission = section.mission!;
  const target = mission.targetStyles;
  const props = mission.allowedProperties;

  // selected[prop] = chosen value or null
  const [selected, setSelected] = useState<Record<string, string | null>>(() =>
    Object.fromEntries(props.map(p => [p, null]))
  );
  const [passed, setPassed] = useState(initialPassed ?? false);
  const [showRetry, setShowRetry] = useState(false);
  const savedRef = useRef(initialPassed ?? false);

  const toReactProp = (p: string) => p.replace(/-([a-z])/g, (_, c: string) => c.toUpperCase());

  // Build live preview style
  const previewStyle: React.CSSProperties = {};
  props.forEach(prop => {
    const val = selected[prop];
    if (val) (previewStyle as Record<string, string>)[toReactProp(prop)] = val;
  });

  // Check correctness
  const allCorrect = props.every(p => selected[p] === target[p]);
  const correctCount = props.filter(p => selected[p] === target[p]).length;

  const handleChip = (prop: string, val: string) => {
    if (passed && !showRetry) return;
    const newSelected = { ...selected, [prop]: selected[prop] === val ? null : val };
    setSelected(newSelected);

    // Auto-check: keď sú všetky vlastnosti vybrané
    const allFilled = props.every(p => newSelected[p] !== null);
    if (allFilled) {
      const correctNow = props.filter(p => newSelected[p] === target[p]).length;
      const allCorrectNow = correctNow === props.length;
      if (allCorrectNow) {
        setPassed(true);
        setShowRetry(false);
        if (!savedRef.current) {
          savedRef.current = true;
          saveQuizAttempt({ lessonId, quizId });
          onPassed?.();
        }
      }
    }
  };


  const propertyLabel: Record<string, string> = {
    'color': 'Farba textu', 'font-size': 'Veľkosť písma', 'font-family': 'Typ písma',
    'font-weight': 'Hrúbka písma', 'font-style': 'Štýl písma', 'text-align': 'Zarovnanie',
    'text-decoration': 'Dekorácia textu', 'background-color': 'Farba pozadia',
    'line-height': 'Výška riadku', 'letter-spacing': 'Rozostup písmen',
  };

  return (
    <div className="ic-block">
      {/* Header */}
      <div className="ic-header">
        <div className="ic-badge">🎯 Mini výzva</div>
        <h2 className="ic-title">{section.title}</h2>
        {section.subtitle && <p className="ic-subtitle">{section.subtitle}</p>}
      </div>

      {/* Zadanie + Live preview vedľa seba */}
      <div className="ic-dual-preview">
        {/* Cieľ — zadanie */}
        <div className="ic-preview-col">
          <div className="ic-preview-label ic-label-target">🎯 Dosiahni tento výsledok</div>
          <div className="ic-preview-box ic-preview-box-target">
            <p className="ic-preview-text" style={Object.fromEntries(props.map(p => [toReactProp(p), target[p]])) as React.CSSProperties}>
              Toto je ukážkový text
            </p>
          </div>
          <div className="ic-preview-hint">Naklikaj správne hodnoty, aby sa tvoj text zhodoval</div>
        </div>

        {/* Tvoj výsledok — live preview */}
        <div className="ic-preview-col">
          <div className="ic-preview-label ic-label-yours">
            ✏️ Tvoj výsledok
            {correctCount > 0 && (
              <span className="ic-match-badge">{correctCount}/{props.length} ✓</span>
            )}
          </div>
          <div className={`ic-preview-box ${allCorrect ? 'ic-preview-box-done' : ''}`}>
            <p className="ic-preview-text" style={previewStyle}>
              Toto je ukážkový text
            </p>
            {allCorrect && <div className="ic-preview-match-indicator">🎯 Zhoda!</div>}
          </div>
          {/* Progress dots */}
          <div className="ic-progress-dots">
            {props.map(p => (
              <div
                key={p}
                className={`ic-dot ${selected[p] === target[p] ? 'ic-dot-ok' : selected[p] ? 'ic-dot-wrong' : 'ic-dot-empty'}`}
                title={p}
              />
            ))}
            <span className="ic-dots-label">{correctCount}/{props.length} správne</span>
          </div>
        </div>
      </div>

      {/* Chips per property */}
      <div className="ic-props">
        {props.map(prop => {
          const chips = getChipOptions(prop, target[prop]);
          const chosen = selected[prop];
          const isCorrect = chosen === target[prop];
          const isRevealed = passed && !showRetry;
          return (
            <div key={prop} className="ic-prop-row">
              <div className="ic-prop-label-wrap">
                <span className="ic-prop-name">{propertyLabel[prop] ?? prop}</span>
                <code className="ic-prop-code">{prop}</code>
                {isRevealed && (
                  <span className={`ic-prop-status ${isCorrect ? 'ic-status-ok' : 'ic-status-wrong'}`}>
                    {isCorrect ? '✓' : `→ ${target[prop]}`}
                  </span>
                )}
              </div>
              <div className="ic-chips">
                {chips.map(val => {
                  const isChosen = chosen === val;
                  const isCorrectChip = val === target[prop];
                  let chipClass = 'ic-chip';
                  if (isChosen && !isRevealed) chipClass += ' ic-chip-chosen';
                  if (isRevealed && isChosen && isCorrect) chipClass += ' ic-chip-correct';
                  if (isRevealed && isChosen && !isCorrect) chipClass += ' ic-chip-wrong';
                  if (isRevealed && !isChosen && isCorrectChip) chipClass += ' ic-chip-reveal';
                  return (
                    <button
                      key={val}
                      className={chipClass}
                      onClick={() => handleChip(prop, val)}
                      disabled={passed && !showRetry}
                    >
                      {val}
                      {isChosen && <span className="ic-chip-check">✓</span>}
                    </button>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>

      {/* Footer — bez submit buttonu, auto-check */}
      <div className="ic-footer">
        {passed && !showRetry ? (
          <div className="ic-success-row">
            <div className="ic-success-left">
              <span className="ic-success-icon">🎉</span>
              <div>
                <div className="ic-success-title">Výzva splnená!</div>
                <div className="ic-success-sub">Skvelá práca!</div>
              </div>
            </div>
            <button className="ic-retry-btn" onClick={() => { setShowRetry(true); setSelected(Object.fromEntries(props.map(p => [p, null]))); setPassed(false); }}>
              ↺ Skúsiť znovu
            </button>
          </div>
        ) : (
          <div className="ic-submit-row">
            <span className="ic-hint">
              {props.filter(p => !selected[p]).length > 0
                ? `Zostáva vybrať ${props.filter(p => !selected[p]).length} ${props.filter(p => !selected[p]).length === 1 ? 'vlastnosť' : 'vlastnosti'}`
                : allCorrect ? '🎉 Všetko správne!' : 'Skontroluj červené vlastnosti'
              }
            </span>
          </div>
        )}

        {!passed && correctCount > 0 && props.every(p => selected[p] !== null) && !allCorrect && (
          <div className="ic-result-fail">
            <span>💡</span>
            <span>Správne {correctCount} z {props.length}. Pozri sa na červené vlastnosti a skús znovu.</span>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── SectionBlock ─────────────────────────────────────────────────────────────
function SectionBlock({
  section,
  lessonId,
  quizId,
  taskId,
  lessonXp,
  interactiveCheckInitialPassed,
  onTaskPassed,
  onTaskAttempted,
  onQuizDone,
  onInteractiveCheckPassed,
}: {
  section: Section;
  lessonId: string;
  quizId: string;
  taskId: string;
  lessonXp: number;
  interactiveCheckInitialPassed?: boolean;
  onTaskPassed?: (result: Exclude<TaskResult, 'none'>, score?: number) => void;
  onTaskAttempted?: () => void;
  onQuizDone?: (count: number) => void;
  onInteractiveCheckPassed?: () => void;
}) {
  const meta = SECTION_META[section.type] || { icon: '', label: section.type, color: '#6B7280' };
  if (section.type === 'tabbed_example') return <CssTabbedCodeBlock section={section} />;
  if (section.type === 'task') {
    if (section.tabs && section.tabs.length >= 2)
      return <CssTabbedTaskBlock section={section} lessonId={lessonId} taskId={taskId} lessonXp={lessonXp} onPassed={onTaskPassed} onAttempted={onTaskAttempted} />;
    return <TaskBlock section={section} lessonId={lessonId} taskId={taskId} lessonXp={lessonXp} onPassed={onTaskPassed} onAttempted={onTaskAttempted} />;
  }
  if (section.type === 'interactive_check') return <InteractiveCheckBlock section={section} lessonId={lessonId} quizId={quizId} initialPassed={interactiveCheckInitialPassed} onPassed={onInteractiveCheckPassed} />;

  return (
    <div className="section-block" data-type={section.type}>
      <div className="section-label" style={{ color: meta.color }}><span>{meta.icon}</span><span>{meta.label}</span></div>
      <h2 className="section-title">{section.title}</h2>
      {section.content && <div className="content-list">{section.content.map((c, i) => <p key={i} className="content-p">{parseInline(c)}</p>)}</div>}
      {section.items && <ul className="items-list">{section.items.map((item, i) => <li key={i} className="item-li"><span className="item-dot" style={{ background: meta.color }} /><span>{item}</span></li>)}</ul>}
      {section.code && <CodeBlock code={section.code} />}
      {section.explanation && <div className="explanation-list">{section.explanation.map((e, i) => <div key={i} className="explanation-item"><span className="expl-arrow">→</span><span>{e}</span></div>)}</div>}
      {section.steps && (
        <div className="steps-wrap">
          <div className="steps-header">Kroky</div>
          {section.steps.map((step, i) => <div key={i} className="step-item"><div className="step-num" style={{ background: meta.color }}>{i + 1}</div><span>{step}</span></div>)}
          {section.expectedOutput && <div className="expected-wrap"><div className="expected-label">Očakávaný výsledok</div>{section.expectedOutput.map((o, i) => <div key={i} className="expected-item">✓ {o}</div>)}</div>}
        </div>
      )}
      {section.questions && <SelfCheck questions={section.questions} lessonId={lessonId} quizId={quizId} onDone={onQuizDone} />}
    </div>
  );
}

// ─── Completion Banner ────────────────────────────────────────────────────────
function CompletionBanner({ xp, maxXp, nextLesson }: { xp: number; maxXp: number; nextLesson: Lesson | null }) {
  const isFull = xp >= maxXp;
  return (
    <div style={{ background: isFull ? 'linear-gradient(135deg,#F0FDF4,#ECFDF5)' : 'linear-gradient(135deg,#FFFBEB,#FEF3C7)', border: `2px solid ${isFull ? '#10B981' : '#F59E0B'}`, borderRadius: '20px', padding: '28px 32px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '20px', flexWrap: 'wrap', marginBottom: '32px', animation: 'fadeUp 0.4s ease both' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
        <div style={{ fontSize: '36px' }}>{isFull ? '🎉' : '✅'}</div>
        <div>
          <div style={{ fontFamily: 'Nunito,sans-serif', fontWeight: 900, fontSize: '18px', color: isFull ? '#166534' : '#92400E', marginBottom: '4px' }}>Lekcia dokončená!</div>
          <div style={{ fontSize: '14px', color: isFull ? '#166534' : '#92400E', opacity: 0.85 }}>
            Získal si +{xp} XP{!isFull && ` z ${maxXp} XP`} · {isFull ? 'Skvelá práca!' : 'Skús vyriešiť úlohu naplno pre viac XP.'}
          </div>
        </div>
      </div>
      {nextLesson && (
        <Link href={`/app/learning/css/${nextLesson.slug}`} style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', background: 'linear-gradient(135deg,#7361FF,#8C78FF)', color: 'white', borderRadius: '12px', padding: '12px 20px', fontFamily: 'Nunito,sans-serif', fontWeight: 800, fontSize: '14px', textDecoration: 'none', boxShadow: '0 4px 16px rgba(115,97,255,0.3)' }}>
          Ďalšia lekcia →
        </Link>
      )}
    </div>
  );
}

// ─── Klientský evaluátor (zadarmo, žiadne API) ───────────────────────────────
// Vlož toto do page.tsx, namiesto volania /api/ai/evaluate-task

function evaluateCode(code: string, criteria: string[]): { passed: boolean; score: number; message: string } {
  if (!code || code.trim().length < 10) {
    return {
      passed: false,
      score: 0,
      message: '📝 Odovzdal si prázdne riešenie. Napíš kód podľa zadania a skús znovu!',
    };
  }

  const lower = code.toLowerCase();

  // ── CSS helpers ─────────────────────────────────────────────────────────────

  // Skontroluj či existuje CSS blok pre selector: "h1 {"
  const hasSelector = (sel: string) => {
    const escaped = sel.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    return new RegExp(escaped + '\\s*\\{', 'i').test(code);
  };

  // Skontroluj či existuje property kdekoľvek: "color:"
  const hasProperty = (prop: string) => {
    const escaped = prop.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    return new RegExp(escaped + '\\s*:', 'i').test(code);
  };

  // Skontroluj konkrétnu property:value dvojicu
  const hasPropertyValue = (prop: string, val: string) => {
    const ep = prop.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const ev = val.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    return new RegExp(ep + '\\s*:\\s*' + ev, 'i').test(code);
  };

  // Skontroluj property v konkrétnom bloku selektora
  const hasSelectorWithProperty = (sel: string, prop: string) => {
    const es = sel.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const ep = prop.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const blockRe = new RegExp(es + '\\s*\\{([^}]*)\\}', 'gi');
    let m;
    while ((m = blockRe.exec(code)) !== null) {
      if (new RegExp(ep + '\\s*:', 'i').test(m[1])) return true;
    }
    return false;
  };

  // Skontroluj property:value v konkrétnom bloku selektora
  const hasSelectorWithValue = (sel: string, prop: string, val: string) => {
    const es = sel.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const ep = prop.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const ev = val.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const blockRe = new RegExp(es + '\\s*\\{([^}]*)\\}', 'gi');
    let m;
    while ((m = blockRe.exec(code)) !== null) {
      if (new RegExp(ep + '\\s*:\\s*' + ev, 'i').test(m[1])) return true;
    }
    return false;
  };

  // Skontroluj či existuje aspoň jedno platné CSS pravidlo (selector + blok)
  const hasAnyCssRule = () => /[a-z#.*:\[][\w\s.#:*,[\]="'-]*\s*\{[^}]+\}/i.test(code);

  type CheckResult = { label: string; ok: boolean; hint: string };
  const results: CheckResult[] = criteria.map((criterion) => {
    const c = criterion.toLowerCase();

    // ── Existencia CSS pravidla pre selector ─────────────────────────────────
    // "V CSS existuje pravidlo pre selector h1"
    if (c.includes('pravidlo') && c.includes('selector')) {
      const selMatch = c.match(/selector\s+([^\s,]+)/);
      if (selMatch) {
        const sel = selMatch[1].replace(/['"]/g, '');
        return { label: criterion, hint: `Pridaj CSS pravidlo pre selektor "${sel}" — napr. ${sel} { }`, ok: hasSelector(sel) };
      }
    }

    // ── property na konkrétnom selektore ─────────────────────────────────────
    // "Nadpis h1 má nastavenú vlastnosť color"
    // "Odsek p má nastavenú vlastnosť font-size na 32px"
    const selectorKeywords: Record<string, string> = {
      'h1': 'h1', 'h2': 'h2', 'h3': 'h3', 'h4': 'h4', 'h5': 'h5', 'h6': 'h6',
      'odsek p': 'p', 'odsek': 'p', 'odstavec': 'p', 'paragraph': 'p',
      'body': 'body', 'html': 'html', 'div': 'div', 'span': 'span',
      'nav': 'nav', 'header': 'header', 'footer': 'footer', 'main': 'main',
      'section': 'section', 'article': 'article', 'button': 'button',
      'a': 'a', 'img': 'img', 'ul': 'ul', 'ol': 'ol', 'li': 'li',
      'input': 'input', 'form': 'form', 'table': 'table',
    };

    // Zisti selector z textu kritéria
    let detectedSelector: string | null = null;
    for (const [keyword, sel] of Object.entries(selectorKeywords)) {
      if (c.includes(keyword)) { detectedSelector = sel; break; }
    }
    // Fallback: hľadaj explicitné CSS selektory v tvare "pre X" alebo "#X" alebo ".X"
    if (!detectedSelector) {
      const classMatch = c.match(/\.([a-z][a-z0-9_-]*)/);
      const idMatch = c.match(/#([a-z][a-z0-9_-]*)/);
      if (classMatch) detectedSelector = '.' + classMatch[1];
      else if (idMatch) detectedSelector = '#' + idMatch[1];
    }

    // CSS property detection
    const cssProperties = [
      'color', 'background-color', 'background', 'font-size', 'font-family',
      'font-weight', 'font-style', 'text-align', 'text-decoration', 'line-height',
      'letter-spacing', 'margin', 'margin-top', 'margin-right', 'margin-bottom', 'margin-left',
      'padding', 'padding-top', 'padding-right', 'padding-bottom', 'padding-left',
      'border', 'border-radius', 'border-color', 'border-width', 'border-style',
      'width', 'height', 'max-width', 'min-width', 'max-height', 'min-height',
      'display', 'flex', 'flex-direction', 'flex-wrap', 'justify-content', 'align-items',
      'gap', 'grid', 'grid-template-columns', 'grid-template-rows',
      'position', 'top', 'right', 'bottom', 'left', 'z-index',
      'overflow', 'opacity', 'visibility', 'cursor', 'transition', 'transform',
      'box-shadow', 'text-shadow', 'list-style', 'outline', 'content',
    ];

    let detectedProperty: string | null = null;
    for (const prop of cssProperties) {
      if (c.includes(prop)) { detectedProperty = prop; break; }
    }
    // Fallback: vlastnosť / property keyword
    if (!detectedProperty && (c.includes('vlastnosť') || c.includes('property') || c.includes('vlastnost'))) {
      const propAfter = c.match(/vlastnosť\s+([a-z-]+)/) || c.match(/property\s+([a-z-]+)/);
      if (propAfter) detectedProperty = propAfter[1];
    }

    // Zisti value z kritéria (napr. "na 32px", "na blue", "na #555")
    const valueMatch = c.match(/\bna\s+([#\w%().,-]+)/) || c.match(/\bvalue\s+([#\w%().,-]+)/);
    const detectedValue = valueMatch ? valueMatch[1] : null;

    if (detectedSelector && detectedProperty && detectedValue) {
      return {
        label: criterion,
        hint: `Nastav ${detectedProperty}: ${detectedValue}; pre selektor ${detectedSelector}`,
        ok: hasSelectorWithValue(detectedSelector, detectedProperty, detectedValue),
      };
    }
    if (detectedSelector && detectedProperty) {
      return {
        label: criterion,
        hint: `Nastav vlastnosť ${detectedProperty} pre selektor ${detectedSelector}`,
        ok: hasSelectorWithProperty(detectedSelector, detectedProperty),
      };
    }
    if (detectedProperty && detectedValue) {
      return {
        label: criterion,
        hint: `Nastav ${detectedProperty}: ${detectedValue};`,
        ok: hasPropertyValue(detectedProperty, detectedValue),
      };
    }
    if (detectedSelector && !detectedProperty) {
      return {
        label: criterion,
        hint: `Pridaj CSS blok pre selektor ${detectedSelector} — napr. ${detectedSelector} { }`,
        ok: hasSelector(detectedSelector),
      };
    }
    if (detectedProperty && !detectedSelector) {
      return {
        label: criterion,
        hint: `Nastav CSS vlastnosť ${detectedProperty}`,
        ok: hasProperty(detectedProperty),
      };
    }

    // ── Špecifické kľúčové slová ──────────────────────────────────────────────

    // Existencia akéhokoľvek CSS pravidla
    if (c.includes('pravidlo') || c.includes('rule') || c.includes('štýl') || c.includes('styl') || c.includes('css')) {
      return { label: criterion, hint: 'Napíš aspoň jedno CSS pravidlo, napr. h1 { color: blue; }', ok: hasAnyCssRule() };
    }

    // Farba
    if (c.includes('farb') || c.includes('color')) {
      return { label: criterion, hint: 'Nastav vlastnosť color alebo background-color.', ok: hasProperty('color') || hasProperty('background-color') || hasProperty('background') };
    }

    // Veľkosť písma
    if (c.includes('veľkosť') || c.includes('velkost') || c.includes('font-size') || c.includes('písma') || c.includes('pisma')) {
      return { label: criterion, hint: 'Nastav vlastnosť font-size, napr. font-size: 16px;', ok: hasProperty('font-size') };
    }

    // Font / rodina písma
    if (c.includes('font') && (c.includes('rodina') || c.includes('family'))) {
      return { label: criterion, hint: 'Nastav vlastnosť font-family, napr. font-family: Arial;', ok: hasProperty('font-family') };
    }

    // Tučné písmo
    if (c.includes('tučn') || c.includes('bold') || c.includes('font-weight')) {
      return { label: criterion, hint: 'Nastav font-weight: bold; alebo font-weight: 700;', ok: hasPropertyValue('font-weight', 'bold') || hasPropertyValue('font-weight', '700') };
    }

    // Zarovnanie textu
    if (c.includes('zarovnan') || c.includes('align') || c.includes('text-align')) {
      return { label: criterion, hint: 'Nastav vlastnosť text-align, napr. text-align: center;', ok: hasProperty('text-align') };
    }

    // Odsadenie (margin / padding)
    if (c.includes('margin')) {
      return { label: criterion, hint: 'Nastav vlastnosť margin, napr. margin: 16px;', ok: hasProperty('margin') };
    }
    if (c.includes('padding') || c.includes('vnútorn')) {
      return { label: criterion, hint: 'Nastav vlastnosť padding, napr. padding: 16px;', ok: hasProperty('padding') };
    }

    // Border
    if (c.includes('border') || c.includes('rámik') || c.includes('ramik')) {
      return { label: criterion, hint: 'Nastav vlastnosť border, napr. border: 1px solid black;', ok: hasProperty('border') };
    }

    // Border-radius
    if (c.includes('zaoblen') || c.includes('border-radius') || c.includes('radius')) {
      return { label: criterion, hint: 'Nastav vlastnosť border-radius, napr. border-radius: 8px;', ok: hasProperty('border-radius') };
    }

    // Pozadie
    if (c.includes('pozadi') || c.includes('pozadie') || c.includes('background')) {
      return { label: criterion, hint: 'Nastav vlastnosť background-color alebo background.', ok: hasProperty('background-color') || hasProperty('background') };
    }

    // Display
    if (c.includes('display') || c.includes('zobrazenie')) {
      return { label: criterion, hint: 'Nastav vlastnosť display, napr. display: flex;', ok: hasProperty('display') };
    }

    // Flexbox
    if (c.includes('flex') && !c.includes('font')) {
      const flexOk = hasPropertyValue('display', 'flex') || lower.includes('flex-direction') || lower.includes('justify-content') || lower.includes('align-items');
      return { label: criterion, hint: 'Použij Flexbox — nastav display: flex; a ďalšie flex vlastnosti.', ok: flexOk };
    }

    // Grid
    if (c.includes('grid')) {
      return { label: criterion, hint: 'Použij CSS Grid — nastav display: grid;', ok: hasPropertyValue('display', 'grid') || lower.includes('grid-template') };
    }

    // Šírka / výška
    if (c.includes('šírk') || c.includes('sirk') || c.includes('width')) {
      return { label: criterion, hint: 'Nastav vlastnosť width, napr. width: 100%;', ok: hasProperty('width') };
    }
    if (c.includes('výšk') || c.includes('vysk') || c.includes('height')) {
      return { label: criterion, hint: 'Nastav vlastnosť height, napr. height: 200px;', ok: hasProperty('height') };
    }

    // Trieda (class selector)
    if (c.includes('trieda') || c.includes('class') || c.includes('.')) {
      return { label: criterion, hint: 'Nastyluj element pomocou triedy, napr. .moja-trieda { }', ok: /\.[a-z][a-z0-9_-]*\s*\{/i.test(code) };
    }

    // ID selector
    if (c.includes(' id') || c.includes('#')) {
      return { label: criterion, hint: 'Nastyluj element pomocou ID, napr. #moje-id { }', ok: /#[a-z][a-z0-9_-]*\s*\{/i.test(code) };
    }

    // Pseudo-trieda
    if (c.includes('hover') || c.includes('pseudo')) {
      return { label: criterion, hint: 'Pridaj pseudo-triedu, napr. a:hover { color: red; }', ok: /:hover/i.test(code) };
    }

    // Transition / animácia
    if (c.includes('transition') || c.includes('animáci') || c.includes('animaci')) {
      return { label: criterion, hint: 'Nastav vlastnosť transition, napr. transition: all 0.3s ease;', ok: hasProperty('transition') || hasProperty('animation') };
    }

    // Box-shadow / tieň
    if (c.includes('tieň') || c.includes('tien') || c.includes('shadow')) {
      return { label: criterion, hint: 'Nastav vlastnosť box-shadow alebo text-shadow.', ok: hasProperty('box-shadow') || hasProperty('text-shadow') };
    }

    // Position
    if (c.includes('position') || c.includes('poloha') || c.includes('umiestnenie')) {
      return { label: criterion, hint: 'Nastav vlastnosť position, napr. position: relative;', ok: hasProperty('position') };
    }

    // Link tag (externý CSS)
    if (c.includes('<link') || (c.includes('link') && c.includes('stylesheet'))) {
      return { label: criterion, hint: 'Pridaj <link rel="stylesheet" href="style.css"> do <head>.', ok: /rel\s*=\s*["']stylesheet["']/i.test(code) };
    }

    // Style tag (interný CSS)
    if (c.includes('<style') || c.includes('style tag')) {
      return { label: criterion, hint: 'Pridaj <style> blok do <head>.', ok: /<style[^>]*>/i.test(code) };
    }

    // SMART FALLBACK — hľadaj CSS property:value priamo v texte kritéria
    const inlinePropVal = criterion.match(/([a-z-]+)\s*:\s*([#\w%().,"' ]+)/i);
    if (inlinePropVal) {
      const prop = inlinePropVal[1].trim();
      const val = inlinePropVal[2].trim().replace(/['"]/g, '');
      return {
        label: criterion,
        hint: `Nastav ${prop}: ${val};`,
        ok: hasPropertyValue(prop, val.split(' ')[0]),
      };
    }

    // Posledná záchrana
    return { label: criterion, hint: `Skontroluj podmienku: ${criterion}`, ok: hasAnyCssRule() };
  });

  const passedCount = results.filter(r => r.ok).length;
  const total = results.length;
  const allPassed = passedCount === total;
  const score = total > 0 ? Math.round((passedCount / total) * 100) : 100;

  let message: string;
  if (allPassed) {
    message = `🎉 Výborne! Všetky podmienky splnené.\n\n✅ ${results.map(r => r.label).join('\n✅ ')}`;
  } else {
    const failed = results.filter(r => !r.ok);
    const passed = results.filter(r => r.ok);
    message = `Splnené ${passedCount} z ${total} podmienok.\n\n`;
    if (passed.length > 0) message += `✅ OK:\n${passed.map(r => `  • ${r.label}`).join('\n')}\n\n`;
    message += `❌ Chýba:\n${failed.map(r => `  • ${r.hint}`).join('\n')}`;
  }

  return { passed: allPassed, score, message };
}

// ─── Main LessonPage ──────────────────────────────────────────────────────────
export default function LessonPage() {
  const params = useParams();
  const router = useRouter();
  const slug = Array.isArray(params.slug) ? params.slug[0] : params.slug ?? '';
  const lessons = trackData.lessons as Lesson[];
  const lesson = lessons.find(l => l.slug === slug);

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) router.replace('/login');
    });
  }, [router]);
  const lessonIndex = lessons.findIndex(l => l.slug === slug);
  const prevLesson = lessonIndex > 0 ? lessons[lessonIndex - 1] : null;
  const nextLesson = lessonIndex < lessons.length - 1 ? lessons[lessonIndex + 1] : null;

  const [completedSections, setCompletedSections] = useState<Set<number>>(new Set());
  const [activeSection, setActiveSection] = useState(0);
  const sectionRefs = useRef<(HTMLDivElement | null)[]>([]);

  // ── Progress state (rovnaká logika ako HTML) ────────────────────────────────
  const [taskResult, setTaskResult] = useState<TaskResult>('none');
  const [taskScore, setTaskScore] = useState<number>(0);
  const [quizDone, setQuizDone] = useState(false);
  const [interactiveCheckDone, setInteractiveCheckDone] = useState(false);
  const [lessonCompleted, setLessonCompleted] = useState(false);
  const [showLockModal, setShowLockModal] = useState(false);
  const [showGroupMenu, setShowGroupMenu] = useState(false);
  const [xpToast, setXpToast] = useState<number | null>(null);
  const [awardedXp, setAwardedXp] = useState<number | null>(null);
  const syncedAwardXpRef = useRef<number | null>(null);
  const syncInFlightRef = useRef(false);

  const hasTaskSection = lesson?.sections.some(s => s.type === 'task') ?? false;
  const hasQuizSection = lesson?.sections.some(s => s.questions && s.questions.length > 0) ?? false;
  const hasInteractiveCheckSection = lesson?.sections.some(s => s.type === 'interactive_check') ?? false;

  // Načítaj existujúci progress pri otvorení lekcie + aktualizuj streak
  useEffect(() => {
    if (!lesson) return;
    updateStreak();

    getLessonProgress(lesson.lesson_id).then(p => {
      if (!p) return;

      let loadedTaskResult: TaskResult = 'none';
      if (p.task_passed) {
        loadedTaskResult = 'full';
      } else if (p.task_best_score != null) {
        loadedTaskResult = (p.task_best_score as number) >= 40 ? 'partial' : 'fail';
      }
      if (loadedTaskResult !== 'none') {
        setTaskResult(loadedTaskResult);
        setTaskScore(p.task_passed ? 100 : (p.task_best_score as number ?? 0));
      }
      if (p.quiz_passed) {
        if (hasInteractiveCheckSection) setInteractiveCheckDone(true);
        else setQuizDone(true);
      }

      const restoredScore = p.task_passed ? 100 : (p.task_best_score as number ?? 0);
      if (p.completed) {
        const storedXp = extractAwardedXp(p, getLessonAwardXp(loadedTaskResult, lesson.xp, restoredScore));
        syncedAwardXpRef.current = storedXp;
        setAwardedXp(storedXp);
        setLessonCompleted(true);
      }
    });
  }, [lesson?.lesson_id]);

  const taskAttempted = taskResult !== 'none';
  const quizOk = !hasQuizSection || quizDone;
  const interactiveCheckOk = !hasInteractiveCheckSection || interactiveCheckDone;
  const canProceed = (!hasTaskSection || taskAttempted) && quizOk && interactiveCheckOk;

  const computedAwardXp = getLessonAwardXp(taskResult, lesson?.xp ?? 0, taskScore);
  const displayedXp = awardedXp ?? (taskAttempted ? computedAwardXp : lesson?.xp ?? 0);

  const handleTaskPassed = useCallback((result: Exclude<TaskResult, 'none'>, score: number = 0) => {
    setTaskResult(result);
    setTaskScore(score);
  }, []);
  const handleTaskAttempted = useCallback(() => setTaskResult(prev => prev === 'none' ? 'fail' : prev), []);
  const handleQuizDone = useCallback(() => setQuizDone(true), []);
  const handleInteractiveCheckPassed = useCallback(() => setInteractiveCheckDone(true), []);

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
        if (storedXp > 0) {
          setXpToast(storedXp);
          setTimeout(() => setXpToast(null), 3500);
        }
      } finally {
        syncInFlightRef.current = false;
      }
    })();

    return () => { cancelled = true; };
  }, [lesson, canProceed, computedAwardXp, awardedXp]);

  if (!lesson) {
    return (
      <div style={{ padding: 40, fontFamily: 'monospace' }}>
        <h2>Lekcia nenájdená — slug: "{slug}"</h2>
        <ul>{lessons.map(l => <li key={l.id}>{l.slug}</li>)}</ul>
        <Link href="/app/learning/css">← Späť</Link>
      </div>
    );
  }

  // Scroll spy — presná scroll-based logika
  useEffect(() => {
    if (!lesson) return;
    const TOPBAR = 56;

    const update = () => {
      const atBottom = window.innerHeight + window.scrollY >= document.body.scrollHeight - 80;
      let newActive = 0;
      const toComplete: number[] = [];

      sectionRefs.current.forEach((ref, idx) => {
        if (!ref) return;
        const rect = ref.getBoundingClientRect();
        // Completed: spodok sekcie prešiel nad topbar
        if (rect.bottom < TOPBAR + 32) toComplete.push(idx);
        // Aktívna: prvá sekcia, ktorej vrchol je ešte vo viewporte
        if (rect.top <= window.innerHeight * 0.55 && rect.bottom > TOPBAR) newActive = idx;
      });

      // Na konci stránky → všetky sekcie completed
      if (atBottom) {
        lesson.sections.forEach((_, i) => toComplete.push(i));
        newActive = lesson.sections.length - 1;
      }

      if (toComplete.length > 0) {
        setCompletedSections(prev => {
          const next = new Set(prev);
          toComplete.forEach(i => next.add(i));
          return next.size === prev.size ? prev : next;
        });
      }
      setActiveSection(newActive);
    };

    window.addEventListener('scroll', update, { passive: true });
    update();
    return () => window.removeEventListener('scroll', update);
  }, [lesson]);

  const scrollToSection = (idx: number) => sectionRefs.current[idx]?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  const progress = lessonCompleted ? 100 : Math.round((completedSections.size / lesson.sections.length) * 100);

  // Keď user klikne na "Ďalšia lekcia"
  const handleNextLesson = async (href: string) => {
    if (!lessonCompleted && !canProceed) {
      setShowLockModal(true);
      return;
    }

    if (!lessonCompleted) {
      const xpToAward = computedAwardXp;
      const [result] = await Promise.all([
        markLessonComplete(lesson.lesson_id, xpToAward),
        updateStreak(),
      ]);
      const storedXp = extractAwardedXp(result, xpToAward) ?? xpToAward;
      syncedAwardXpRef.current = storedXp;
      setLessonCompleted(true);
      setAwardedXp(storedXp);
      if (storedXp > 0) {
        setXpToast(storedXp);
        setTimeout(() => setXpToast(null), 3500);
      }
    }

    window.location.href = href;
  };
  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Nunito:wght@400;600;700;800;900&family=Sora:wght@300;400;500;600&family=JetBrains+Mono:wght@400;500&display=swap');
        :root{--brand:#7361FF;--brand-2:#8C78FF;--brand-light:#EDE9FF;--brand-mid:#C4B5FD;--success:#059669;--error:#DC2626;--surface:#FFFFFF;--bg:#F7F7FB;--border:#E8E6F0;--text:#111118;--muted:#6B7280;--faint:#9CA3AF;--sidebar-w:280px;--topbar-h:56px;}
        *{box-sizing:border-box;margin:0;padding:0;}body{background:var(--bg);}
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
        .steps-wrap{background:#F5F3FF;border:1px solid #DDD6FE;border-radius:16px;padding:20px 24px;margin-top:8px;}
        .steps-header{font-family:'Nunito',sans-serif;font-size:12px;font-weight:800;text-transform:uppercase;letter-spacing:0.06em;color:var(--brand);margin-bottom:14px;}
        .step-item{display:flex;align-items:flex-start;gap:12px;margin-bottom:12px;font-size:14px;color:#374151;line-height:1.6;}
        .step-num{width:24px;height:24px;border-radius:50%;color:white;display:flex;align-items:center;justify-content:center;font-family:'Nunito',sans-serif;font-size:12px;font-weight:800;flex-shrink:0;margin-top:1px;}
        .expected-wrap{border-top:1px solid #DDD6FE;margin-top:16px;padding-top:14px;}
        .expected-label{font-family:'Nunito',sans-serif;font-size:11px;font-weight:800;text-transform:uppercase;letter-spacing:0.06em;color:var(--success);margin-bottom:8px;}
        .expected-item{font-size:13px;color:#065F46;margin-bottom:4px;line-height:1.5;}
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
        .lesson-nav{display:flex;align-items:center;justify-content:space-between;gap:16px;padding:32px 0 0;border-top:1px solid var(--border);margin-top:16px;}
        .nav-btn{display:flex;align-items:center;gap:10px;padding:14px 20px;border-radius:14px;text-decoration:none;font-family:'Nunito',sans-serif;font-weight:800;font-size:14px;transition:transform 0.18s,box-shadow 0.18s;border:1.5px solid var(--border);background:white;color:var(--text);max-width:220px;cursor:pointer;}
        .nav-btn:hover{transform:translateY(-2px);box-shadow:0 4px 16px rgba(0,0,0,0.08);}
        .nav-btn-next{background:linear-gradient(135deg,var(--brand),var(--brand-2));color:white;border-color:transparent;box-shadow:0 4px 16px rgba(115,97,255,0.3);}
        .nav-btn-next:hover{box-shadow:0 8px 24px rgba(115,97,255,0.4);}
        .nav-btn-label{font-size:11px;font-weight:600;opacity:0.65;display:block;margin-bottom:2px;}
        .nav-btn-title{font-size:13px;font-weight:800;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}
        .nav-btn-spacer{flex:1;}
        @media(max-width:900px){.sidebar{display:none;}.lesson-content{padding:32px 24px 80px;}}
        @media(max-width:600px){.lesson-content{padding:24px 16px 80px;}.section-title{font-size:20px;}.progress-bar-outer{width:80px;}}

        /* ── InteractiveCheck ── */
        .ic-block{background:white;border:2px solid #EDE9FF;border-radius:20px;overflow:hidden;margin:0 0 32px;box-shadow:0 4px 24px rgba(115,97,255,0.08);}
        .ic-dual-preview{display:grid;grid-template-columns:1fr 1fr;gap:0;border-bottom:1.5px solid #F3F0FF;}
        @media(max-width:700px){.ic-dual-preview{grid-template-columns:1fr;}}
        .ic-preview-col{padding:20px 24px;display:flex;flex-direction:column;gap:10px;}
        .ic-preview-col:first-child{border-right:1.5px solid #F3F0FF;background:#FAFFFE;}
        .ic-preview-col:last-child{background:#FAFAFA;}
        .ic-label-target{color:#059669 !important;display:flex;align-items:center;gap:8px;}
        .ic-label-yours{color:#7361FF !important;display:flex;align-items:center;gap:8px;}
        .ic-match-badge{margin-left:auto;background:linear-gradient(135deg,#7361FF,#8C78FF);color:white;border-radius:100px;padding:2px 9px;font-size:11px;font-weight:800;font-family:'Nunito',sans-serif;}
        .ic-preview-hint{font-size:12px;color:#9CA3AF;font-style:italic;text-align:center;font-family:'Sora',sans-serif;}
        .ic-preview-box-target{border-color:#A7F3D0 !important;background:linear-gradient(135deg,#F0FDF4,#ECFDF5) !important;position:relative;}
        .ic-preview-box-done{border-color:#10B981 !important;background:linear-gradient(135deg,#F0FDF4,#ECFDF5) !important;box-shadow:0 0 0 3px rgba(16,185,129,0.15) !important;transition:all 0.3s ease;}
        .ic-preview-match-indicator{position:absolute;top:8px;right:10px;font-size:12px;font-weight:800;font-family:'Nunito',sans-serif;color:#059669;animation:fadeUp 0.3s ease both;}
        .ic-header{padding:24px 28px 20px;background:linear-gradient(135deg,#F5F3FF 0%,#FDF4FF 100%);border-bottom:1.5px solid #EDE9FF;}
        .ic-badge{display:inline-flex;align-items:center;gap:6px;background:linear-gradient(135deg,#7361FF,#8C78FF);color:white;border-radius:20px;padding:4px 12px;font-size:12px;font-weight:800;font-family:'Nunito',sans-serif;letter-spacing:0.04em;margin-bottom:10px;}
        .ic-title{font-family:'Nunito',sans-serif;font-size:22px;font-weight:800;color:#111118;margin:0 0 6px;}
        .ic-subtitle{font-size:14px;color:#6B7280;margin:0 0 14px;line-height:1.5;}
        .ic-goal{display:flex;align-items:center;gap:8px;background:white;border:1.5px solid #DDD6FE;border-radius:12px;padding:10px 14px;font-size:14px;color:#5B21B6;font-weight:600;font-family:'Nunito',sans-serif;}
        .ic-goal-icon{font-size:16px;flex-shrink:0;}

        .ic-preview-wrap{padding:20px 24px;background:#FAFAFA;}
        .ic-preview-label{font-family:'Nunito',sans-serif;font-size:11px;font-weight:800;text-transform:uppercase;letter-spacing:0.08em;color:#7361FF;margin-bottom:10px;}
        .ic-preview-box{background:white;border:1.5px solid #E8E6F0;border-radius:14px;padding:24px 28px;min-height:80px;display:flex;align-items:center;justify-content:center;transition:all 0.2s ease;position:relative;}
        .ic-preview-text{margin:0;text-align:center;transition:all 0.18s ease;word-break:break-word;}
        .ic-progress-dots{display:flex;align-items:center;gap:6px;margin-top:12px;}
        .ic-dot{width:10px;height:10px;border-radius:50%;transition:all 0.2s ease;flex-shrink:0;}
        .ic-dot-empty{background:#E8E6F0;}
        .ic-dot-wrong{background:#FCA5A5;}
        .ic-dot-ok{background:#10B981;box-shadow:0 0 0 2px rgba(16,185,129,0.25);}
        .ic-dots-label{font-size:12px;font-weight:700;font-family:'Nunito',sans-serif;color:#6B7280;margin-left:4px;}

        .ic-props{padding:20px 28px;display:flex;flex-direction:column;gap:20px;border-bottom:1.5px solid #F3F0FF;}
        .ic-prop-row{display:flex;flex-direction:column;gap:10px;}
        .ic-prop-label-wrap{display:flex;align-items:center;gap:8px;flex-wrap:wrap;}
        .ic-prop-name{font-family:'Nunito',sans-serif;font-size:13px;font-weight:800;color:#374151;}
        .ic-prop-code{font-family:'JetBrains Mono',monospace;font-size:11px;background:#1A1A2E;color:#CDD6F4;padding:2px 8px;border-radius:6px;border:1px solid #2D2D3F;}
        .ic-prop-status{font-size:12px;font-weight:700;font-family:'Nunito',sans-serif;margin-left:4px;}
        .ic-status-ok{color:#10B981;}
        .ic-status-wrong{color:#EF4444;}

        .ic-chips{display:flex;flex-wrap:wrap;gap:8px;}
        .ic-chip{padding:8px 16px;border-radius:100px;border:2px solid #E8E6F0;background:white;font-family:'Nunito',sans-serif;font-size:13px;font-weight:700;color:#374151;cursor:pointer;transition:all 0.15s ease;display:flex;align-items:center;gap:5px;}
        .ic-chip:hover:not(:disabled){border-color:var(--brand-mid);background:var(--brand-light);color:var(--brand);transform:translateY(-1px);}
        .ic-chip:disabled{cursor:default;}
        .ic-chip-chosen{border-color:var(--brand);background:var(--brand-light);color:var(--brand);}
        .ic-chip-correct{border-color:#10B981 !important;background:#F0FDF4 !important;color:#065F46 !important;}
        .ic-chip-wrong{border-color:#EF4444 !important;background:#FEF2F2 !important;color:#991B1B !important;}
        .ic-chip-reveal{border-color:#10B981;background:#F0FDF4;color:#065F46;opacity:0.6;}
        .ic-chip-check{font-size:11px;font-weight:900;}

        .ic-footer{padding:16px 28px;background:#FAFAFA;}
        .ic-submit-row{display:flex;align-items:center;justify-content:space-between;gap:16px;flex-wrap:wrap;}
        .ic-hint{font-size:13px;color:#9CA3AF;font-family:'Nunito',sans-serif;font-weight:600;}
        .ic-hint-ready{color:#10B981;}
        .ic-submit-btn{padding:12px 28px;border-radius:12px;border:none;font-family:'Nunito',sans-serif;font-weight:800;font-size:15px;background:linear-gradient(135deg,#7361FF,#8C78FF);color:white;cursor:pointer;box-shadow:0 4px 16px rgba(115,97,255,0.3);transition:opacity 0.15s;}
        .ic-submit-btn:disabled{opacity:0.55;cursor:not-allowed;}
        .ic-result-fail{display:flex;align-items:center;gap:10px;margin-top:12px;padding:12px 16px;background:#FFF7ED;border:1px solid #FED7AA;border-radius:12px;font-size:13px;color:#92400E;font-family:'Nunito',sans-serif;font-weight:600;animation:fadeUp 0.25s ease both;}
        .ic-success-row{display:flex;align-items:center;justify-content:space-between;gap:16px;flex-wrap:wrap;}
        .ic-success-left{display:flex;align-items:center;gap:12px;}
        .ic-success-icon{font-size:32px;line-height:1;flex-shrink:0;}
        .ic-success-title{font-family:'Nunito',sans-serif;font-size:16px;font-weight:900;color:#166534;}
        .ic-success-sub{font-size:13px;color:#166534;opacity:0.75;}
        .ic-retry-btn{padding:8px 16px;border-radius:10px;border:1.5px solid #10B981;background:white;color:#059669;font-family:'Nunito',sans-serif;font-weight:800;font-size:13px;cursor:pointer;transition:background 0.15s;}
        .ic-retry-btn:hover{background:#F0FDF4;}


        /* CM + AI */
        .cm-tutor-root{position:relative;}
        .cm-shell{margin:20px 0;border-radius:16px;overflow:hidden;border:1px solid #2D2D3F;box-shadow:0 4px 24px rgba(0,0,0,0.22);background:#1A1A2E;display:flex;align-items:stretch;width:100%;}
        .cm-editor-pane{flex:1;min-width:0;display:flex;flex-direction:column;min-width:300px;}
        .cm-chrome{display:flex;flex-direction:column;height:100%;}
        .cm-preview-pane{flex-shrink:0;width:48%;min-width:0;border-left:1px solid #2D2D3F;display:flex;flex-direction:column;background:white;}
        .cm-topbar{background:#14142A;padding:10px 16px;display:flex;align-items:center;gap:10px;border-bottom:1px solid #2D2D3F;flex-shrink:0;}
        .cm-dots{display:flex;gap:6px;}
        .cm-dot{width:12px;height:12px;border-radius:50%;flex-shrink:0;}
        .cm-lang-badge{font-family:'JetBrains Mono',monospace;font-size:11px;color:#7C6AF7;letter-spacing:0.08em;text-transform:uppercase;}
        .cm-topbar-right{margin-left:auto;display:flex;align-items:center;gap:10px;}
        .cm-hint{font-size:11px;color:#555570;font-weight:500;}
        .cm-kbd{background:rgba(255,255,255,0.08);border:1px solid rgba(255,255,255,0.12);border-radius:5px;padding:1px 6px;font-family:'JetBrains Mono',monospace;font-size:10px;color:#8888AA;}
        .cm-toggle{display:inline-flex;align-items:center;gap:6px;border:1px solid rgba(255,255,255,0.1);border-radius:8px;background:rgba(255,255,255,0.05);padding:5px 11px;font-family:'Nunito',sans-serif;font-size:12px;font-weight:800;color:#6B6B8A;cursor:pointer;transition:all 0.18s;white-space:nowrap;}
        .cm-toggle:hover{background:rgba(255,255,255,0.1);color:#CDD6F4;}
        .cm-toggle.cm-toggle-on{background:rgba(115,97,255,0.18);border-color:rgba(115,97,255,0.45);color:#A89FFF;}
        .cm-toggle-icon{font-size:14px;line-height:1;}
        .cm-preview-chrome{display:flex;flex-direction:column;height:100%;background:white;}
        .cm-preview-bar{background:#F2F2F7;padding:9px 14px;display:flex;align-items:center;gap:10px;border-bottom:1px solid #E5E5EA;flex-shrink:0;}
        .cm-preview-dots{display:flex;gap:5px;}
        .cm-preview-address{flex:1;background:white;border:1px solid #D1D1D6;border-radius:7px;padding:4px 10px;display:flex;align-items:center;gap:6px;font-size:11px;color:#8E8E93;max-width:200px;margin:0 auto;}
        .cm-live-badge{display:flex;align-items:center;gap:5px;font-size:11px;font-weight:700;color:#10B981;font-family:'Nunito',sans-serif;}
        .cm-live-dot{width:7px;height:7px;border-radius:50%;background:#10B981;animation:livePulse 2.4s ease infinite;}
        @keyframes livePulse{0%,100%{opacity:1;transform:scale(1);}50%{opacity:0.5;transform:scale(0.75);}}
        .cm-preview-iframe{flex:1;width:100%;border:none;background:white;min-height:240px;}
        @media(max-width:900px){.cm-shell{flex-direction:column;}.cm-preview-pane{width:100% !important;border-left:none;border-top:1px solid #2D2D3F;}}
        .ai-bubble{position:absolute;z-index:50;display:flex;align-items:center;gap:4px;background:white;border:1.5px solid #E8E6F0;border-radius:100px;padding:5px 6px;box-shadow:0 4px 20px rgba(115,97,255,0.18);animation:bubblePop 0.15s cubic-bezier(0.34,1.56,0.64,1) both;}
        @keyframes bubblePop{from{opacity:0;transform:scale(0.8) translateY(4px);}to{opacity:1;transform:scale(1) translateY(0);}}
        .bubble-btn-primary{display:flex;align-items:center;gap:5px;border:none;border-radius:100px;padding:5px 12px;font-family:'Nunito',sans-serif;font-size:12px;font-weight:800;background:linear-gradient(135deg,#7361FF,#8C78FF);color:white;cursor:pointer;box-shadow:0 2px 10px rgba(115,97,255,0.35);}
        .bubble-btn-ghost{display:flex;align-items:center;gap:5px;border:none;border-radius:100px;padding:5px 11px;font-family:'Nunito',sans-serif;font-size:12px;font-weight:800;background:#F5F3FF;color:#7361FF;cursor:pointer;}
        .bubble-sep{width:1px;height:18px;background:#E8E6F0;margin:0 2px;}
        .bubble-x{width:24px;height:24px;border-radius:50%;border:none;background:transparent;color:#9CA3AF;font-size:16px;cursor:pointer;display:flex;align-items:center;justify-content:center;}
        .ai-overlay{position:fixed;inset:0;z-index:200;display:flex;align-items:center;justify-content:center;background:rgba(17,17,24,0.45);backdrop-filter:blur(4px);animation:aiOverlayIn 0.15s ease both;padding:20px;}
        @keyframes aiOverlayIn{from{opacity:0;}to{opacity:1;}}
        .ai-panel{background:white;border-radius:24px;box-shadow:0 24px 64px rgba(0,0,0,0.18);width:100%;max-width:520px;overflow:hidden;animation:panelIn 0.2s cubic-bezier(0.34,1.2,0.64,1) both;}
        @keyframes panelIn{from{opacity:0;transform:translateY(12px) scale(0.97);}to{opacity:1;transform:translateY(0) scale(1);}}
        .ap-header{display:flex;align-items:center;justify-content:space-between;padding:20px 24px 16px;border-bottom:1px solid #F3F4F6;}
        .ap-title-row{display:flex;align-items:center;gap:10px;}
        .ap-icon{width:36px;height:36px;border-radius:12px;background:linear-gradient(135deg,#7361FF,#8C78FF);display:flex;align-items:center;justify-content:center;font-size:16px;}
        .ap-title{font-family:'Nunito',sans-serif;font-size:16px;font-weight:900;color:#111118;margin:0;}
        .ap-sub{font-size:12px;color:#9CA3AF;margin:0;}
        .ap-header-actions{display:flex;align-items:center;gap:8px;}
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
        .ap-hint{font-size:11px;color:#9CA3AF;margin-top:4px;display:flex;align-items:center;gap:4px;flex-wrap:wrap;}
        .ap-answer{margin:0 24px 20px;border-radius:14px;overflow:hidden;border:1px solid #E8E6F0;}
        .ap-answer-header{padding:10px 14px;background:linear-gradient(135deg,#F5F3FF,#FDF4FF);border-bottom:1px solid #EDE9FF;font-family:'Nunito',sans-serif;font-size:12px;font-weight:800;color:#7361FF;text-transform:uppercase;letter-spacing:0.05em;}
        .ap-answer-text{padding:14px;font-size:14px;color:#374151;line-height:1.7;background:white;}
        .ap-loading{display:flex;align-items:center;gap:5px;padding:20px 14px;background:white;}
        .ld{width:7px;height:7px;border-radius:50%;background:#7361FF;animation:ldBounce 0.9s infinite ease-in-out both;}
        .ld:nth-child(2){animation-delay:0.15s;}.ld:nth-child(3){animation-delay:0.3s;}
        @keyframes ldBounce{0%,80%,100%{transform:scale(0.6);opacity:0.4;}40%{transform:scale(1);opacity:1;}}
        .ap-actions{display:flex;gap:8px;padding:0 24px 20px;}
        .ap-btn-primary{flex:1;padding:12px;border-radius:12px;border:none;font-family:'Nunito',sans-serif;font-weight:800;font-size:14px;background:linear-gradient(135deg,#7361FF,#8C78FF);color:white;cursor:pointer;box-shadow:0 4px 14px rgba(115,97,255,0.3);}
        .ap-btn-primary:disabled{opacity:0.55;cursor:not-allowed;}
        .ap-btn-ghost{flex:1;padding:12px;border-radius:12px;background:#F9FAFB;border:1.5px solid #E8E6F0;color:#6B7280;font-family:'Nunito',sans-serif;font-weight:800;font-size:14px;cursor:pointer;}

        /* Task */
        .task-block{background:white;border:2px solid #EDE9FF;border-radius:20px;overflow:hidden;margin:0 0 32px;box-shadow:0 4px 24px rgba(115,97,255,0.08);}
        .task-header{padding:28px 28px 24px;background:linear-gradient(135deg,#F5F3FF 0%,#FDF4FF 100%);border-bottom:1.5px solid #EDE9FF;}
        .task-badge{display:inline-flex;align-items:center;gap:6px;background:linear-gradient(135deg,#7361FF,#8C78FF);color:white;border-radius:20px;padding:4px 12px;font-size:12px;font-weight:800;font-family:'Nunito',sans-serif;letter-spacing:0.04em;margin-bottom:10px;}
        .task-title{font-family:'Nunito',sans-serif;font-size:22px;font-weight:800;color:#111118;margin:0 0 6px;}
        .task-subtitle{font-size:14px;color:#6B7280;margin:0;font-family:'Sora',sans-serif;line-height:1.5;}
        .task-instructions{padding:20px 28px;border-bottom:1.5px solid #F3F0FF;background:#FAFAFA;}
        .task-instr-label{font-family:'Nunito',sans-serif;font-weight:800;font-size:11px;text-transform:uppercase;letter-spacing:0.08em;color:#7361FF;margin-bottom:12px;}
        .task-instr-list{list-style:none;padding:0;margin:0;display:flex;flex-direction:column;gap:10px;}
        .task-instr-item{display:flex;align-items:flex-start;gap:12px;font-family:'Sora',sans-serif;font-size:14px;color:#374151;line-height:1.5;}
        .task-instr-num{flex-shrink:0;width:24px;height:24px;background:linear-gradient(135deg,#7361FF,#8C78FF);color:white;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:12px;font-weight:800;font-family:'Nunito',sans-serif;margin-top:1px;}
        .task-editor-wrap{display:grid;grid-template-columns:1fr 1fr;border-bottom:1.5px solid #F3F0FF;height:338px;overflow:hidden;}
        @media(max-width:800px){.task-editor-wrap{grid-template-columns:1fr;height:auto;overflow:visible;}}
        .task-editor-shell{border-right:1.5px solid #2D2D3F;display:flex;flex-direction:column;overflow:hidden;}
        /* ── Tabs UI (JS-style) ── */
        .tabs-root{border-radius:16px;overflow:hidden;}
        .tabs-header{background:#14142A;padding:0 16px;display:flex;align-items:center;justify-content:space-between;border-bottom:1px solid #2D2D3F;gap:12px;flex-wrap:wrap;min-height:48px;}
        .tabs-nav{display:flex;gap:0;}
        .tab-btn{display:flex;align-items:center;gap:7px;padding:12px 18px;border:none;border-bottom:2px solid transparent;background:transparent;color:#555570;font-family:'Nunito',sans-serif;font-size:13px;font-weight:700;cursor:pointer;transition:color 0.15s,border-color 0.15s;white-space:nowrap;}
        .tab-btn:hover{color:#CDD6F4;}
        .tab-btn-active{color:#CDD6F4!important;border-bottom-color:#7361FF;}
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
        .ttask-root{background:white;border:2px solid #EDE9FF;border-radius:20px;overflow:hidden;margin:60px 0 32px;box-shadow:0 4px 24px rgba(115,97,255,0.08);}
        .ttask-success-banner{display:flex;align-items:center;justify-content:space-between;gap:16px;background:linear-gradient(135deg,#F0FDF4,#DCFCE7);border-top:none;border-bottom:1.5px solid #10B981;padding:20px 24px;}
        .ttask-success-left{display:flex;align-items:center;gap:14px;}
        .ttask-success-emoji{font-size:32px;line-height:1;}
        .ttask-success-title{font-family:'Nunito',sans-serif;font-size:16px;font-weight:900;color:#166534;}
        .ttask-success-sub{font-size:13px;color:#166534;opacity:0.8;margin-top:2px;}
        .ttask-instructions{padding:24px 28px;border-bottom:1.5px solid #F3F0FF;background:#FAFAFA;}
        .ttask-instr-label{font-family:'Nunito',sans-serif;font-size:11px;font-weight:800;text-transform:uppercase;letter-spacing:0.08em;color:#7361FF;margin-bottom:12px;}
        .ttask-instr-list{list-style:none;padding:0;margin:0;display:flex;flex-direction:column;gap:10px;}
        .ttask-instr-item{display:flex;align-items:flex-start;gap:12px;font-size:14px;color:#374151;line-height:1.5;}
        .ttask-instr-num{flex-shrink:0;width:24px;height:24px;background:linear-gradient(135deg,#7361FF,#8C78FF);color:white;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:12px;font-weight:800;font-family:'Nunito',sans-serif;margin-top:1px;}
        .task-editor-bar{display:flex;align-items:center;gap:8px;padding:8px 14px;background:#14142A;border-bottom:1px solid #2D2D3F;}
        .task-preview-shell{display:flex;flex-direction:column;background:white;overflow:hidden;}
        .task-preview-iframe{flex:1;border:none;width:100%;background:white;}
        .task-footer{padding:16px 28px;display:flex;justify-content:flex-end;background:#FAFAFA;border-bottom:1.5px solid #F3F0FF;}
        .task-eval-btn{padding:12px 28px;border-radius:12px;border:none;font-family:'Nunito',sans-serif;font-weight:800;font-size:15px;background:linear-gradient(135deg,#7361FF,#8C78FF);color:white;cursor:pointer;box-shadow:0 4px 16px rgba(115,97,255,0.3);}
        .task-eval-btn:disabled{opacity:0.6;cursor:not-allowed;}
        .task-eval-loading{display:flex;align-items:center;gap:6px;}
        .task-result{padding:20px 28px;display:flex;align-items:flex-start;gap:14px;animation:fadeUp 0.25s ease both;}
        .task-result-ok{background:linear-gradient(135deg,#F0FDF4,#ECFDF5);}
        .task-result-partial{background:linear-gradient(135deg,#FFFBEB,#FEF3C7);}
        .task-result-fail{background:linear-gradient(135deg,#FFF7ED,#FFFBEB);}
        .task-result-icon{font-size:24px;flex-shrink:0;margin-top:2px;}
        .task-result-text{font-family:'Sora',sans-serif;font-size:14px;line-height:1.7;color:#374151;}
        .task-result-ok .task-result-text{color:#166534;}
        .task-result-partial .task-result-text{color:#92400E;}
        .task-result-fail .task-result-text{color:#92400E;}

.task-completed-banner{
  display:flex;align-items:center;justify-content:space-between;
  gap:16px;flex-wrap:wrap;
  padding:24px 28px;
  background:linear-gradient(135deg,#F0FDF4,#DCFCE7);
  border-bottom:1.5px solid #A7F3D0;
}
.task-completed-left{display:flex;align-items:center;gap:16px;}
.task-completed-icon{font-size:40px;line-height:1;flex-shrink:0;}
.task-completed-title{
  font-family:'Nunito',sans-serif;font-weight:900;font-size:18px;
  color:#166534;margin-bottom:4px;
}
.task-completed-sub{
  font-size:13px;color:#166534;opacity:0.8;
  font-family:'Sora',sans-serif;line-height:1.4;
  max-width:420px;
}
.task-retry-btn{
  flex-shrink:0;
  padding:9px 18px;border-radius:10px;
  border:1.5px solid #10B981;background:white;
  color:#059669;font-family:'Nunito',sans-serif;
  font-weight:800;font-size:13px;cursor:pointer;
  transition:background 0.15s,transform 0.15s;
}
.task-retry-btn:hover{background:#F0FDF4;transform:translateY(-1px);}

.task-completed-code{padding:20px 28px 24px;background:#FAFAFA;}
.task-completed-code-label{
  font-family:'Nunito',sans-serif;font-size:11px;font-weight:800;
  text-transform:uppercase;letter-spacing:0.08em;
  color:#6B7280;margin-bottom:10px;
}

        /* Lock modal */
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
        .lock-item-text{flex:1;}
        .lock-item-label{font-size:12px;font-weight:600;opacity:0.7;display:block;margin-bottom:2px;text-transform:uppercase;letter-spacing:0.04em;}
        .lock-footer{padding:0 28px 28px;display:flex;flex-direction:column;gap:10px;}
        .lock-close-btn{width:100%;padding:13px;border-radius:12px;border:none;font-family:'Nunito',sans-serif;font-weight:800;font-size:15px;background:linear-gradient(135deg,#7361FF,#8C78FF);color:white;cursor:pointer;box-shadow:0 4px 14px rgba(115,97,255,0.3);}
        .lock-hint{font-size:12px;color:#9CA3AF;text-align:center;line-height:1.5;}
      `}</style>

      <div className="lesson-root">
        {xpToast && (
  <div style={{
    position: 'fixed', bottom: 32, right: 32, zIndex: 999,
    background: 'linear-gradient(135deg,#7361FF,#8C78FF)',
    color: 'white', borderRadius: '16px', padding: '16px 24px',
    boxShadow: '0 8px 32px rgba(115,97,255,0.4)',
    fontFamily: 'Nunito,sans-serif', fontWeight: 900, fontSize: '18px',
    display: 'flex', alignItems: 'center', gap: '10px',
    animation: 'fadeUp 0.4s ease both',
  }}>
    <span style={{ fontSize: '24px' }}>⚡</span>
    <div>
      <div>+{xpToast} XP získané!</div>
      <div style={{ fontSize: '12px', fontWeight: 600, opacity: 0.8 }}>Lekcia dokončená 🎉</div>
    </div>
  </div>
)}
        {/* Topbar */}
        <div className="topbar">
          <div className="topbar-left">
            <Link href="/app/learning/css" className="back-link">← CSS kurz</Link>
            <div className="topbar-divider" />
            <span className="topbar-title">{lesson.order}. {lesson.title}</span>
          </div>
          <div className="topbar-right">
            {lessonCompleted && (
              <div style={{ background: 'linear-gradient(135deg,#F0FDF4,#DCFCE7)', border: '1px solid #10B981', borderRadius: '100px', padding: '4px 12px', fontSize: '12px', fontWeight: 800, fontFamily: 'Nunito,sans-serif', color: '#166534', display: 'flex', alignItems: 'center', gap: '5px' }}>
                ✓ Dokončené
              </div>
            )}
            <button
              onClick={() => setShowGroupMenu(true)}
              style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'linear-gradient(135deg,#7361FF,#8C78FF)', color: 'white', border: 'none', borderRadius: 100, padding: '4px 12px', fontSize: 12, fontWeight: 800, fontFamily: 'Nunito,sans-serif', cursor: 'pointer', boxShadow: '0 2px 8px rgba(115,97,255,0.3)' }}
            >
              👥 Skupina
            </button>

            <div className="progress-wrap">
              <div className="progress-bar-outer">
                <div className="progress-bar-inner" style={{ width: `${progress}%` }} />
              </div>
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
            </div>
          </aside>

          {/* Main */}
          <main className="lesson-content">
            {lessonCompleted && <CompletionBanner xp={displayedXp} maxXp={lesson.xp} nextLesson={nextLesson} />}

            {lesson.sections.map((section, idx) => (
              <div key={idx} ref={el => { sectionRefs.current[idx] = el; }}>
                <SectionBlock
                  section={section}
                  lessonId={lesson.lesson_id}
                  quizId={lesson.quiz_id}
                  taskId={lesson.task_id}
                  lessonXp={lesson.xp}
                  interactiveCheckInitialPassed={interactiveCheckDone}
                  onTaskPassed={handleTaskPassed}
                  onTaskAttempted={handleTaskAttempted}
                  onQuizDone={handleQuizDone}
                  onInteractiveCheckPassed={handleInteractiveCheckPassed}
                />
              </div>
            ))}

            {/* Nav */}
            <nav className="lesson-nav">
              {prevLesson ? (
                <Link href={`/app/learning/css/${prevLesson.slug}`} className="nav-btn">
                  <span>←</span>
                  <div><span className="nav-btn-label">Predchádzajúca</span><div className="nav-btn-title">{prevLesson.title}</div></div>
                </Link>
              ) : <div className="nav-btn-spacer" />}

              {nextLesson ? (
                <button
                  className="nav-btn nav-btn-next"
                  onClick={() => handleNextLesson(`/app/learning/css/${nextLesson.slug}`)}
                >
                  <div style={{ textAlign: 'right' }}>
                    <span className="nav-btn-label">Ďalšia lekcia</span>
                    <div className="nav-btn-title">{nextLesson.title}</div>
                  </div>
                  <span>→</span>
                </button>
              ) : (
                <button
                  className="nav-btn nav-btn-next"
                  onClick={() => handleNextLesson('/app/learning/css')}
                >
                  <div style={{ textAlign: 'right' }}>
                    <span className="nav-btn-label">Kurz dokončený!</span>
                    <div className="nav-btn-title">Späť na prehľad 🎉</div>
                  </div>
                  <span>→</span>
                </button>
              )}
            </nav>
          </main>
        </div>
      </div>

      <GroupLessonMenu lessonId={lesson.lesson_id} lessonTitle={lesson.title} open={showGroupMenu} onClose={() => setShowGroupMenu(false)} />

      {/* Lock modal — zobrazí sa keď user nemá splnené podmienky */}
      {showLockModal && (
        <div className="lock-overlay" onClick={() => setShowLockModal(false)}>
          <div className="lock-box" onClick={e => e.stopPropagation()}>
            <div className="lock-header">
              <div className="lock-icon">🔒</div>
              <div className="lock-title">Najprv dokonči lekciu</div>
              <div className="lock-sub">Pred pokračovaním musíš splniť tieto podmienky:</div>
            </div>

            <div className="lock-items">
              {hasTaskSection && (
                <div className={`lock-item ${taskAttempted ? 'ok' : 'missing'}`}>
                  <span className="lock-item-icon">{taskAttempted ? '✅' : '✏️'}</span>
                  <div className="lock-item-text">
                    <span className="lock-item-label">Zadanie</span>
                    {taskAttempted
                      ? taskResult === 'full' ? 'Zadanie odovzdané — skvelé!' : 'Zadanie odovzdané'
                      : 'Klikni na Vyhodnotiť aspoň raz (výsledok nevadí)'}
                  </div>
                </div>
              )}
              {hasInteractiveCheckSection && (
                <div className={`lock-item ${interactiveCheckDone ? 'ok' : 'missing'}`}>
                  <span className="lock-item-icon">{interactiveCheckDone ? '✅' : '🎯'}</span>
                  <div className="lock-item-text">
                    <span className="lock-item-label">Mini výzva</span>
                    {interactiveCheckDone
                      ? 'Mini výzva splnená — skvelé!'
                      : 'Naklikaj správne CSS vlastnosti v Mini výzve'}
                  </div>
                </div>
              )}
              {hasQuizSection && (
                <div className={`lock-item ${quizDone ? 'ok' : 'missing'}`}>
                  <span className="lock-item-icon">{quizDone ? '✅' : '❓'}</span>
                  <div className="lock-item-text">
                    <span className="lock-item-label">Kvíz</span>
                    {quizDone
                      ? 'Kvíz dokončený — skvelé!'
                      : 'Zodpovedaj otázky kvízu (správne aj nesprávne OK)'}
                  </div>
                </div>
              )}
            </div>

            <div className="lock-footer">
              <button className="lock-close-btn" onClick={() => setShowLockModal(false)}>
                Rozumiem, vrátim sa k lekcii
              </button>
              <p className="lock-hint">Výsledok nevadí — dôležité je že to skúsiš 💪</p>
            </div>
          </div>
        </div>
      )}
    </>
  );
}