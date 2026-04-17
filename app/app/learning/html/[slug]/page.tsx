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
import trackData from '../html.json';
import { saveQuizAttempt, saveTaskSubmission, markLessonComplete, getLessonProgress, getTaskSubmission, updateStreak } from '../../../../actions/progres';
import { runHtmlValidation } from '../../../../lib/htmlValidator';
import type { ValidationConfig } from '../../../../lib/htmlValidator';

// ─── Types ────────────────────────────────────────────────────────────────────
interface CodeData { language: string; value: string; }
interface Question { q: string; options: string[]; answer: string; why: string; }

interface AiEvaluation {
  enabled: boolean;
  criteria: string[];
  xpReward: number;
  feedbackType: string;
}

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
  validationConfig?: ValidationConfig;
  xpReward?: number;
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
type TaskResult = 'none' | 'fail' | 'partial' | 'full';

function getLessonAwardXp(taskResult: TaskResult, fullXp: number) {
  if (taskResult === 'none') return 0;
  return taskResult === 'full' ? fullXp : 10;
}

function extractAwardedXp(source: any, fallback: number | null = null) {
  if (!source) return fallback;
  const candidates = [
    source?.xpAwarded,
    source?.awardedXp,
    source?.xp_awarded,
    source?.awarded_xp,
    source?.lessonXpAwarded,
    source?.lesson_xp_awarded,
  ];

  for (const value of candidates) {
    if (typeof value === 'number' && Number.isFinite(value)) return value;
  }

  return fallback;
}

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

// ─── CodeBlock (ukážka s AI tutor) ───────────────────────────────────────────
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
  const lang = code.language.toLowerCase();

  

  useEffect(() => { setMounted(true); }, []);
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
      if (!res.ok || !res.body) throw new Error('API error');
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
    } catch {
      setLoading(false);
      setAnswer('Chyba pri komunikácii s AI. Skontroluj API kľúč alebo skús znovu.');
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
            <CodeMirror ref={cmRef} value={val} onChange={setVal} extensions={[getLang(code.language), cmDarkTheme]} onCreateEditor={onCreateEditor} theme="none" height='300px' basicSetup={{ lineNumbers: true, highlightActiveLine: true, autocompletion: false, foldGutter: false }} />
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
          <button className="bubble-btn-primary" onClick={() => openPanel()}>✨ Ask AI</button>
          <div className="bubble-sep" /><button className="bubble-btn-ghost" onClick={() => openPanel('Vysvetli mi tento kód.')}>Explain</button>
          <div className="bubble-sep" /><button className="bubble-x" onClick={() => setShowBubble(false)}>×</button>
        </div>
      )}

      {mounted && showPanel && createPortal(
        <div className="ai-overlay" onClick={e => { if (e.target === e.currentTarget) closePanel(); }}>
          <div className="ai-panel">
            <div className="ap-header">
              <div className="ap-title-row"><div className="ap-icon">✨</div><div><p className="ap-title">AI Tutor</p><p className="ap-sub">Spýtaj sa na označený kód</p></div></div>
              <div className="ap-header-actions">
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

    // Keď sú všetky otázky zodpovedané → ulož do Supabase (len fakt že quiz bol vyplnený)
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

// ─── TaskBlock — ukladá do Supabase ──────────────────────────────────────────
// ─── TaskBlock — AI vyhodnotenie + ukladá do Supabase ────────────────────────
// ─── TaskBlock — AI vyhodnotenie + ukladá do Supabase ────────────────────────
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
  onPassed?: (result: Exclude<TaskResult, 'none'>) => void;
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
  

  // Načítaj predchádzajúce odovzdanie pri otvorení
 useEffect(() => {
  if (!lessonId || !taskId) return;
  getTaskSubmission(lessonId, taskId).then((sub) => {
    if (!sub) return;

    // Akékoľvek submission = attempted (aj failed)
    if (!attemptedRef.current) {
      attemptedRef.current = true;
      onAttempted?.();
    }

    // Používame sub.passed (nie score >= 80) — full iba ak bolo 100 % splnené
    const prevResult: Exclude<TaskResult, 'none'> =
      sub.passed ? 'full' : sub.score >= 40 ? 'partial' : 'fail';

    setVal(sub.code ?? section.starterCode?.value ?? '');
    setEvalResult({ ok: prevResult === 'full', result: prevResult, message: sub.feedback ?? '' });
    setEvalState('done');
    onPassed?.(prevResult);

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
    const url = URL.createObjectURL(new Blob([val], { type: 'text/html;charset=utf-8' }));
    if (prevUrlRef.current) { const old = prevUrlRef.current; setTimeout(() => URL.revokeObjectURL(old), 2000); }
    prevUrlRef.current = url; iframe.src = url;
  }, [val]);

  const handleEvaluate = async () => {
    setEvalState('loading');
    setEvalResult(null);
    await new Promise(r => setTimeout(r, 400));

    let taskResult: 'fail' | 'partial' | 'full';
    let score: number;
    let message: string;
    let checks: Array<{ label: string; ok: boolean; hint?: string }> = [];

    if (section.validationConfig) {
      // ─── Deterministický validátor — full = 100 % ─────────────────
      const v = runHtmlValidation(val, { ...section.validationConfig, fullPassThreshold: 100 });
      taskResult = v.result;
      score = v.score;
      message = v.feedback;
      checks = v.checks.map(c => ({ label: c.label, ok: c.ok, hint: c.hint }));
    } else {
      // ─── Fallback na starý textový evaluátor (CSS / JS lekcie) ───────
      const fallback = evaluateCode(val, section.aiEvaluation?.criteria ?? []);
      taskResult = fallback.passed ? 'full' : 'fail';
      score = fallback.score;
      message = fallback.message;
    }

    const passed = taskResult === 'full';

    // Uložíme ak: ešte neprešiel, alebo ak nový výsledok je tiež 100% (nové lepšie riešenie)
    if (!passedRef.current || passed) {
      const xpEarned = getLessonAwardXp(taskResult, lessonXp);
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

    onPassed?.(taskResult);

    // XP za lekciu sa udelia cez markLessonComplete (pri kliknutí na Ďalšia lekcia
    // alebo automaticky cez useEffect) — tu NEsmieme volať awardTaskMinXp,
    // inak by sa 10 XP udelilo dvakrát (raz tu, raz pri markLessonComplete).

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
              extensions={[getLang(section.starterCode?.language ?? 'html'), cmDarkTheme]}
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
              extensions={[getLang(section.starterCode?.language ?? 'html'), cmDarkTheme]}
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
          <div className="task-result-icon">
            {evalResult.result === 'full' ? '🎉' : evalResult.result === 'partial' ? '⚠️' : '💡'}
          </div>
          <div className="task-result-text" style={{ whiteSpace: 'pre-line' }}>{evalResult.message}</div>
        </div>
      )}
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
  onTaskPassed,
  onTaskAttempted,
  onQuizDone,
}: {
  section: Section;
  lessonId: string;
  quizId: string;
  taskId: string;
  lessonXp: number;
  onTaskPassed?: (result: Exclude<TaskResult, 'none'>) => void;
  onTaskAttempted?: () => void;
  onQuizDone?: (count: number) => void;
}) {
  const meta = SECTION_META[section.type] || { icon: '', label: section.type, color: '#6B7280' };
  if (section.type === 'task') return <TaskBlock section={section} lessonId={lessonId} taskId={taskId} lessonXp={lessonXp} onPassed={onTaskPassed} onAttempted={onTaskAttempted} />;

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
        <Link href={`/app/learning/html/${nextLesson.slug}`} style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', background: 'linear-gradient(135deg,#7361FF,#8C78FF)', color: 'white', borderRadius: '12px', padding: '12px 20px', fontFamily: 'Nunito,sans-serif', fontWeight: 800, fontSize: '14px', textDecoration: 'none', boxShadow: '0 4px 16px rgba(115,97,255,0.3)' }}>
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

  const parser = new DOMParser();
  const doc = parser.parseFromString(code, 'text/html');
  const lower = code.toLowerCase();

  // Pomocné funkcie
  const hasTag = (tag: string) => lower.includes(`<${tag}`);
  const hasNonEmptyEl = (sel: string) => { const el = doc.querySelector(sel); return !!el && (el.textContent?.trim().length ?? 0) > 0; };
  const hasMeta = (attr: string, val: string) => !!doc.querySelector(`meta[${attr}="${val}"]`) || !!doc.querySelector(`meta[${attr}='${val}']`) || lower.includes(`${attr}="${val.toLowerCase()}"`) || lower.includes(`${attr}='${val.toLowerCase()}'`);

  type CheckResult = { label: string; ok: boolean; hint: string };
  const results: CheckResult[] = criteria.map((criterion) => {
    const c = criterion.toLowerCase();

    // ── DOCTYPE ──────────────────────────────────────────────────────────────
    if (c.includes('doctype')) return {
      label: criterion, hint: 'Pridaj <!DOCTYPE html> na prvý riadok.',
      ok: /^\s*<!doctype\s+html/i.test(code),
    };

    // ── Štruktúra (doctype + html + head + body spoločne) ────────────────────
    if (c.includes('štruktúra') || c.includes('struktura') || c.includes('kostra') ||
        (c.includes('doctype') && c.includes('html') && c.includes('head') && c.includes('body'))) return {
      label: criterion, hint: 'Skontroluj, či máš <!DOCTYPE html>, <html>, <head> a <body>.',
      ok: /<!doctype\s+html/i.test(code) && hasTag('html') && hasTag('head') && hasTag('body'),
    };

    // ── <html> element (s voliteľným lang) ───────────────────────────────────
    if (c.includes('<html') || (c.includes('html') && (c.includes('lang') || c.includes('koreň') || c.includes('root')) && !c.includes('doctype'))) {
      const needsLang = c.includes('lang');
      return {
        label: criterion, hint: 'Pridaj <html lang="sk"> element.',
        ok: hasTag('html') && (!needsLang || doc.documentElement.hasAttribute('lang')),
      };
    }

    // ── <head> element (s voliteľným charset + title) ────────────────────────
    if (c.includes('<head') || (c.includes('head') && !c.includes('header') && !c.includes('heading'))) {
      const needsCharset = c.includes('charset') || c.includes('meta');
      const needsTitle = c.includes('title');
      const headOk = hasTag('head');
      const charsetOk = !needsCharset || (!!doc.querySelector('meta[charset]') || lower.includes('charset='));
      const titleOk = !needsTitle || hasNonEmptyEl('title');
      return {
        label: criterion, hint: 'Pridaj <head> s <meta charset="UTF-8"> a <title>.',
        ok: headOk && charsetOk && titleOk,
      };
    }

    // ── <body> element (s voliteľným h1 + p) ─────────────────────────────────
    if (c.includes('<body') || c.includes('body')) {
      const needsH1 = c.match(/\bh1\b/);
      const needsP = c.includes('<p>') || c.match(/\bjedne[mn]\b.*\bp\b/) || c.match(/\bp\b.*\bobs/);
      const bodyOk = hasTag('body');
      const h1Ok = !needsH1 || hasNonEmptyEl('h1');
      const pOk = !needsP || (doc.querySelectorAll('p').length > 0 && Array.from(doc.querySelectorAll('p')).some(p => p.textContent!.trim().length > 0));
      return {
        label: criterion, hint: 'Pridaj <body> s obsahom (<h1>, <p>).',
        ok: bodyOk && h1Ok && pOk,
      };
    }

    // ── lang atribút ─────────────────────────────────────────────────────────
    if (c.includes('lang')) return {
      label: criterion, hint: 'Pridaj atribút lang na <html> tag, napr. lang="sk".',
      ok: doc.documentElement.hasAttribute('lang'),
    };

    // ── charset ──────────────────────────────────────────────────────────────
    if (c.includes('charset')) return {
      label: criterion, hint: 'Pridaj <meta charset="UTF-8"> do <head>.',
      ok: !!doc.querySelector('meta[charset]') || lower.includes('charset='),
    };

    // ── viewport ─────────────────────────────────────────────────────────────
    if (c.includes('viewport')) return {
      label: criterion, hint: 'Pridaj <meta name="viewport" content="width=device-width, initial-scale=1">.',
      ok: hasMeta('name', 'viewport') || lower.includes('viewport'),
    };

    // ── title ────────────────────────────────────────────────────────────────
    if (c.includes('<title') || c.includes('title')) return {
      label: criterion, hint: 'Pridaj <title>Názov stránky</title> do <head>.',
      ok: hasNonEmptyEl('title'),
    };

    // ── meta description ─────────────────────────────────────────────────────
    if (c.includes('description')) return {
      label: criterion, hint: 'Pridaj <meta name="description" content="...">.',
      ok: hasMeta('name', 'description') && (doc.querySelector('meta[name="description"]')?.getAttribute('content')?.trim().length ?? 0) > 0,
    };

    // ── headings h1–h6 ────────────────────────────────────────────────────────
    const hMatch = c.match(/<h([1-6])>/) || c.match(/\bh([1-6])\b/);
    if (hMatch) {
      const tag = `h${hMatch[1]}`;
      return { label: criterion, hint: `Pridaj <${tag}> s textom.`, ok: hasNonEmptyEl(tag) };
    }

    // ── paragraph <p> ────────────────────────────────────────────────────────
    if (c.includes('<p>') || c === 'odstavec' || c.includes('paragraph') || c.includes('odsek')) return {
      label: criterion, hint: 'Pridaj aspoň jeden <p> tag s textom.',
      ok: Array.from(doc.querySelectorAll('p')).some(p => p.textContent!.trim().length > 0),
    };

    // ── links <a> ────────────────────────────────────────────────────────────
    if (c.includes('<a>') || c.includes('odkaz') || c.includes('link') || c.includes('<a ')) return {
      label: criterion, hint: 'Pridaj <a href="...">text</a>.',
      ok: doc.querySelectorAll('a[href]').length > 0,
    };

    // ── image <img> ──────────────────────────────────────────────────────────
    if (c.includes('<img') || c.includes('obrázok') || c.includes('obrazok') || c.includes('image')) return {
      label: criterion, hint: 'Pridaj <img src="..." alt="...">.',
      ok: doc.querySelectorAll('img').length > 0,
    };

    // ── alt ───────────────────────────────────────────────────────────────────
    if (c.includes('alt')) {
      const imgs = Array.from(doc.querySelectorAll('img'));
      return { label: criterion, hint: 'Každý <img> musí mať atribút alt.', ok: imgs.length > 0 && imgs.every(img => img.hasAttribute('alt')) };
    }

    // ── list ─────────────────────────────────────────────────────────────────
    if (c.includes('<ul>') || c.includes('<ol>') || c.includes('zoznam') || c.includes('list') || c.includes('<li>')) return {
      label: criterion, hint: 'Pridaj <ul> alebo <ol> so <li> položkami.',
      ok: doc.querySelectorAll('ul li, ol li').length > 0,
    };

    // ── table ─────────────────────────────────────────────────────────────────
    if (c.includes('<table') || c.includes('tabuľka') || c.includes('tabulka')) return {
      label: criterion, hint: 'Pridaj <table> s <tr> a <td>.',
      ok: !!doc.querySelector('table tr'),
    };

    // ── form ──────────────────────────────────────────────────────────────────
    if (c.includes('<form') || c.includes('formulár') || c.includes('formular')) return {
      label: criterion, hint: 'Pridaj <form> element.',
      ok: !!doc.querySelector('form'),
    };

    // ── input ─────────────────────────────────────────────────────────────────
    if (c.includes('<input') || (c.includes('input') && !c.includes('label'))) return {
      label: criterion, hint: 'Pridaj <input> pole.',
      ok: doc.querySelectorAll('input').length > 0,
    };

    // ── label ─────────────────────────────────────────────────────────────────
    if (c.includes('<label') || c.includes('label')) return {
      label: criterion, hint: 'Pridaj <label> pre každý input.',
      ok: doc.querySelectorAll('label').length > 0,
    };

    // ── button ────────────────────────────────────────────────────────────────
    if (c.includes('<button') || c.includes('tlačidlo') || c.includes('button')) return {
      label: criterion, hint: 'Pridaj <button> element.',
      ok: doc.querySelectorAll('button').length > 0,
    };

    // ── nav ───────────────────────────────────────────────────────────────────
    if (c.includes('<nav>') || c.includes('navigácia') || c.includes('navigacia')) return {
      label: criterion, hint: 'Pridaj <nav> element.',
      ok: !!doc.querySelector('nav'),
    };

    // ── header / footer ───────────────────────────────────────────────────────
    if (c.includes('<header>') || (c.includes('header') && !c.includes('head'))) return { label: criterion, hint: 'Pridaj <header>.', ok: !!doc.querySelector('header') };
    if (c.includes('<footer>') || c.includes('footer')) return { label: criterion, hint: 'Pridaj <footer>.', ok: !!doc.querySelector('footer') };

    // ── section / article / main ──────────────────────────────────────────────
    if (c.includes('<section>') || c.includes('section')) return { label: criterion, hint: 'Pridaj <section>.', ok: !!doc.querySelector('section') };
    if (c.includes('<article>') || c.includes('article')) return { label: criterion, hint: 'Pridaj <article>.', ok: !!doc.querySelector('article') };
    if (c.includes('<main>') || c.includes('main'))       return { label: criterion, hint: 'Pridaj <main>.',    ok: !!doc.querySelector('main') };

    // ── class / id ────────────────────────────────────────────────────────────
    if (c.includes('class=')) return { label: criterion, hint: 'Pridaj class atribút.', ok: !!doc.querySelector('[class]') };
    if (c.includes('id='))    return { label: criterion, hint: 'Pridaj id atribút.',    ok: !!doc.querySelector('[id]') };

    // ── CSS v <style> ─────────────────────────────────────────────────────────
    if (c.includes('<style') || c.includes('css') || c.includes('štýl') || c.includes('styl')) return {
      label: criterion, hint: 'Pridaj <style> blok s CSS pravidlami.',
      ok: hasNonEmptyEl('style'),
    };

    // ── JavaScript ────────────────────────────────────────────────────────────
    if (c.includes('<script') || c.includes('javascript') || (c.includes('js') && !c.includes('css'))) return {
      label: criterion, hint: 'Pridaj <script> blok s JavaScriptom.',
      ok: hasNonEmptyEl('script'),
    };

    // ── Uzavreté tagy ─────────────────────────────────────────────────────────
    if (c.includes('uzatvor') || c.includes('zatvor') || c.includes('uzavret') || c.includes('closed')) {
      const opens = (lower.match(/<[a-z][a-z0-9]*[\s>]/g) || []).length;
      const closes = (lower.match(/<\/[a-z][a-z0-9]*>/g) || []).length;
      const selfClose = (lower.match(/<(?:meta|link|br|hr|img|input|area|base|col|embed|param|source|track|wbr)[^>]*\/?>/g) || []).length;
      return { label: criterion, hint: 'Skontroluj, či sú všetky tagy správne uzatvorené.', ok: Math.abs(opens - closes - selfClose) <= 2 };
    }

    // ── SMART FALLBACK ────────────────────────────────────────────────────────
    // 1. Extrahuj všetky HTML tagy z kritéria a skontroluj ich prítomnosť v kóde
    const tagMatches = [...criterion.matchAll(/<([a-zA-Z][a-zA-Z0-9]*)/g)].map(m => m[1].toLowerCase());
    if (tagMatches.length > 0) {
      return {
        label: criterion,
        hint: `Skontroluj, či máš: ${tagMatches.map(t => `<${t}>`).join(', ')}`,
        ok: tagMatches.every(tag => hasTag(tag)),
      };
    }

    // 2. Atribúty s hodnotou (name="...", type="...", etc.)
    const attrMatches = [...criterion.matchAll(/(\w+)="([^"]+)"/g)];
    if (attrMatches.length > 0) {
      return {
        label: criterion,
        hint: `Skontroluj atribúty: ${attrMatches.map(m => `${m[1]}="${m[2]}"`).join(', ')}`,
        ok: attrMatches.every(m => lower.includes(`${m[1].toLowerCase()}="${m[2].toLowerCase()}"`) || lower.includes(`${m[1].toLowerCase()}='${m[2].toLowerCase()}'`)),
      };
    }

    // Neznáme kritérium — bezpečne vrátime false (nechceme falošné ok: true)
    return { label: criterion, hint: `Skontroluj podmienku: ${criterion}`, ok: false };
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

  // Progress state
  // taskResult: 'none'=neodovzdal, 'fail'=nesplnené, 'partial'=čiastočné, 'full'=100%
  const [taskResult, setTaskResult] = useState<TaskResult>('none');
  const [quizDone, setQuizDone] = useState(false);
  const [lessonCompleted, setLessonCompleted] = useState(false);
  const [showLockModal, setShowLockModal] = useState(false);
  const [xpToast, setXpToast] = useState<number | null>(null);
  const [awardedXp, setAwardedXp] = useState<number | null>(null);
  const syncedAwardXpRef = useRef<number | null>(null);
  const syncInFlightRef = useRef(false);

  // Načítaj existujúci progress pri otvorení lekcie + aktualizuj streak
  useEffect(() => {
    if (!lesson) return;
    updateStreak();
    getLessonProgress(lesson.lesson_id).then(p => {
      if (!p) return;

      let loadedTaskResult: TaskResult = 'none';
      // task_passed je autoritatívny zdroj — full = 100 % splnené (nie len 80+)
      if (p.task_passed) {
        loadedTaskResult = 'full';
      } else if (p.task_best_score != null) {
        const s = p.task_best_score as number;
        loadedTaskResult = s >= 40 ? 'partial' : 'fail';
      }

      if (loadedTaskResult !== 'none') {
        setTaskResult(loadedTaskResult);
      }

      if (p.quiz_passed) setQuizDone(true);

      if (p.completed) {
        const storedXp = extractAwardedXp(p, getLessonAwardXp(loadedTaskResult, lesson.xp));
        syncedAwardXpRef.current = storedXp;
        setAwardedXp(storedXp);
        setLessonCompleted(true);
      }
    });
  }, [lesson]);

  // Môže pokračovať: úloha musí byť splnená na 100% + quiz dokončený
  const taskAttempted = taskResult !== 'none';
  const canProceed = taskAttempted && quizDone;
  const lessonReadyToComplete = canProceed;
  const computedAwardXp = getLessonAwardXp(taskResult, lesson?.xp ?? 0);
  const displayedXp = awardedXp ?? lesson?.xp ?? 0;

  useEffect(() => {
    if (!lesson || !lessonReadyToComplete) return;
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

    return () => {
      cancelled = true;
    };
  }, [lesson, lessonReadyToComplete, computedAwardXp, awardedXp]);

  if (!lesson) {
    return (
      <div style={{ padding: 40, fontFamily: 'monospace' }}>
        <h2>Lekcia nenájdená — slug: "{slug}"</h2>
        <ul>{lessons.map(l => <li key={l.id}>{l.slug}</li>)}</ul>
        <Link href="/app/learning/html">← Späť</Link>
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
      const xpToAward = getLessonAwardXp(taskResult, lesson.xp);

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
        .task-header{padding:24px 28px 20px;background:linear-gradient(135deg,#F5F3FF 0%,#FDF4FF 100%);border-bottom:1.5px solid #EDE9FF;}
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
        .task-editor-bar{display:flex;align-items:center;gap:8px;padding:8px 14px;background:#14142A;border-bottom:1px solid #2D2D3F;flex-shrink:0;}
        .task-preview-shell{display:flex;flex-direction:column;background:white;overflow:hidden;}
        .task-preview-iframe{flex:1;border:none;width:100%;background:white;}
        .task-footer{padding:16px 28px;display:flex;justify-content:flex-end;background:#FAFAFA;border-bottom:1.5px solid #F3F0FF;}
        .task-eval-btn{padding:12px 28px;border-radius:12px;border:none;font-family:'Nunito',sans-serif;font-weight:800;font-size:15px;background:linear-gradient(135deg,#7361FF,#8C78FF);color:white;cursor:pointer;box-shadow:0 4px 16px rgba(115,97,255,0.3);}
        .task-eval-btn:disabled{opacity:0.6;cursor:not-allowed;}
        .task-eval-loading{display:flex;align-items:center;gap:6px;}
        .task-result{padding:20px 28px;display:flex;align-items:flex-start;gap:14px;animation:fadeUp 0.25s ease both;}
        .task-result-ok{background:linear-gradient(135deg,#F0FDF4,#ECFDF5);}
        .task-result-partial{background:linear-gradient(135deg,#FFFBEB,#FEF3C7);border-top:1.5px solid #FDE68A;}
        .task-result-fail{background:linear-gradient(135deg,#FFF7ED,#FFFBEB);}
        .task-result-icon{font-size:24px;flex-shrink:0;margin-top:2px;}
        .task-result-text{font-family:'Sora',sans-serif;font-size:14px;line-height:1.7;color:#374151;}
        .task-result-ok .task-result-text{color:#166534;}
        .task-result-partial .task-result-text{color:#92400E;}
        .task-result-fail .task-result-text{color:#B45309;}

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
            <Link href="/app/learning/html" className="back-link">← HTML kurz</Link>
            <div className="topbar-divider" />
            <span className="topbar-title">{lesson.order}. {lesson.title}</span>
          </div>
          <div className="topbar-right">
            {lessonCompleted && (
              <div style={{ background: 'linear-gradient(135deg,#F0FDF4,#DCFCE7)', border: '1px solid #10B981', borderRadius: '100px', padding: '4px 12px', fontSize: '12px', fontWeight: 800, fontFamily: 'Nunito,sans-serif', color: '#166534', display: 'flex', alignItems: 'center', gap: '5px' }}>
                ✓ Dokončené
              </div>
            )}
            {lessonReadyToComplete && !lessonCompleted && (
              <div style={{ background: 'linear-gradient(135deg,#FEF9C3,#FEF08A)', border: '1px solid #EAB308', borderRadius: '100px', padding: '4px 12px', fontSize: '12px', fontWeight: 800, fontFamily: 'Nunito,sans-serif', color: '#713F12', display: 'flex', alignItems: 'center', gap: '5px' }}>
                🎯 Pripravené na dokončenie
              </div>
            )}
            <div className="progress-wrap">
              <div className="progress-bar-outer">
                <div className="progress-bar-inner" style={{ width: `${progress}%` }} />
              </div>
              <span className="progress-pct">{progress}%</span>
            </div>
            <div className="xp-pill">⚡ {displayedXp} XP {lessonCompleted ? 'získané' : 'max'}</div>
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
                  <div className="sidebar-meta-item">⚡ {displayedXp} XP</div>
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
            {lessonCompleted && <CompletionBanner xp={awardedXp ?? computedAwardXp} maxXp={lesson.xp} nextLesson={nextLesson} />}

            {lesson.sections.map((section, idx) => (
              <div key={idx} ref={el => { sectionRefs.current[idx] = el; }}>
                <SectionBlock
                  section={section}
                  lessonId={lesson.lesson_id}
                  quizId={lesson.quiz_id}
                  taskId={lesson.task_id}
                  lessonXp={lesson.xp}
                  onTaskPassed={(result) => {
                    setTaskResult(result);
                  }}
                  onTaskAttempted={() => setTaskResult(prev => prev === 'none' ? 'fail' : prev)}
                  onQuizDone={() => {
                    setQuizDone(true);
                  }}
                />
              </div>
            ))}

            {/* Nav */}
            <nav className="lesson-nav">
              {prevLesson ? (
                <Link href={`/app/learning/html/${prevLesson.slug}`} className="nav-btn">
                  <span>←</span>
                  <div><span className="nav-btn-label">Predchádzajúca</span><div className="nav-btn-title">{prevLesson.title}</div></div>
                </Link>
              ) : <div className="nav-btn-spacer" />}

              {nextLesson ? (
                <button
                  className="nav-btn nav-btn-next"
                  onClick={() => handleNextLesson(`/app/learning/html/${nextLesson.slug}`)}
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
                  onClick={() => handleNextLesson('/app/learning/html')}
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
              <div className={`lock-item ${quizDone ? 'ok' : 'missing'}`}>
                <span className="lock-item-icon">{quizDone ? '✅' : '📝'}</span>
                <div className="lock-item-text">
                  <span className="lock-item-label">Quiz</span>
                  {quizDone ? 'Kvíz dokončený' : 'Odpovedz na všetky otázky v kvíze'}
                </div>
              </div>
              <div className={`lock-item ${taskAttempted ? 'ok' : 'missing'}`}>
                <span className="lock-item-icon">{taskAttempted ? '✅' : '✏️'}</span>
                <div className="lock-item-text">
                  <span className="lock-item-label">Zadanie</span>
                  {taskResult === 'full'
                    ? 'Zadanie splnené na 100%'
                    : taskAttempted
                      ? 'Zadanie odovzdané (môžeš pokračovať)'
                      : 'Klikni na Vyhodnotiť a odovzdaj zadanie'}
                </div>
              </div>
            </div>

            <div className="lock-footer">
              <button className="lock-close-btn" onClick={() => setShowLockModal(false)}>
                Rozumiem, vrátim sa k lekcii
              </button>
              <p className="lock-hint">Na postup ďalej musíš odovzdať zadanie a dokončiť kvíz.</p>
            </div>
          </div>
        </div>
      )}
    </>
  );
}