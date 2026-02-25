'use client';

import { useCallback, useEffect, useRef, useState, KeyboardEvent } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import CodeMirror, { ReactCodeMirrorRef } from '@uiw/react-codemirror';
import { html as htmlLang } from '@codemirror/lang-html';
import { css as cssLang } from '@codemirror/lang-css';
import { javascript } from '@codemirror/lang-javascript';
import { EditorView } from '@codemirror/view';
import trackData from '../html.json';
import { saveQuizAttempt, saveTaskSubmission, markLessonComplete, getLessonProgress } from '../../../../actions/progres';

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

// ─── Mock AI ──────────────────────────────────────────────────────────────────
const MOCK: Array<(c: string, q: string) => string> = [
  (c, q) => `Tento kód ${c.trim().startsWith('<') ? 'je HTML element' : 'je úsek kódu'}, ktorý ${q.toLowerCase().includes('prečo') ? 'definuje štruktúru obsahu stránky' : 'hovorí prehliadaču, ako má interpretovať daný obsah'}. Napríklad \`${c.split('\n')[0].trim().slice(0, 50)}\` je základný stavebný kameň HTML dokumentu.`,
  (c, q) => `Označený kód ukazuje ${c.includes('=') ? 'atribúty HTML elementu' : 'základnú HTML syntax'}. ${q.toLowerCase().includes('ako') ? 'Funguje tak, že prehliadač prečíta tagy zhora nadol a vykreslí zodpovedajúci obsah.' : 'Každý tag má otváraciu a zatváraciu variantu — obsah je medzi nimi.'}`,
  (c) => `Toto je príklad správnej HTML praxe — ${c.includes('alt') ? 'atribút alt zlepšuje prístupnosť' : c.includes('class') ? 'class atribút umožňuje CSS štýlovanie' : 'sémantické tagy zlepšujú SEO a prístupnosť'}. Odporúčam vždy používať takúto štruktúru.`,
];
function mockAnswer(code: string, q: string) {
  return MOCK[Math.floor(Math.random() * MOCK.length)](code, q);
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
  const lang = code.language.toLowerCase();
  const canPreview = lang === 'html' || lang === 'css' || lang === 'js' || lang === 'javascript';

  const buildDoc = useCallback((src: string) => {
    if (lang === 'css') return `<!doctype html><html><head><meta charset="UTF-8"><style>body{font-family:-apple-system,sans-serif;padding:24px;color:#111;}h1{font-size:22px;}p{color:#555;line-height:1.6;}a{margin-right:12px;}button{padding:8px 16px;border-radius:8px;border:1px solid #ccc;cursor:pointer;}${src}</style></head><body><h1>Nadpis stránky</h1><p>Toto je odsek textu na ukážku CSS štýlovania.</p><a href="#">Odkaz</a><button>Tlačidlo</button></body></html>`;
    if (lang === 'js' || lang === 'javascript') return `<!doctype html><html><head><meta charset="UTF-8"><style>body{font-family:-apple-system,sans-serif;padding:20px;font-size:14px;color:#111;}.out-line{padding:2px 0;border-bottom:1px solid #f0f0f0;}.out-err{color:#DC2626;font-weight:600;}</style></head><body><div id="out"></div><script>const _out=document.getElementById('out');const _log=console.log.bind(console);console.log=(...a)=>{_out.insertAdjacentHTML('beforeend','<div class="out-line">'+a.map(v=>typeof v==='object'?JSON.stringify(v,null,2):String(v)).join(' ')+'</div>');_log(...a);};try{${src}}catch(e){_out.insertAdjacentHTML('beforeend','<div class="out-err">❌ '+e.message+'</div>');}<\/script></body></html>`;
    return src;
  }, [lang]);

  useEffect(() => {
    const iframe = iframeRef.current; if (!iframe) return;
    const url = URL.createObjectURL(new Blob([buildDoc(val)], { type: 'text/html' }));
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
    await new Promise(r => setTimeout(r, 800));
    const resp = mockAnswer(selectedText, question);
    setAnswer(resp); setLoading(false);
    setHistory(h => [{ id: Date.now().toString(), question, answer: resp, selectedCode: selectedText }, ...h].slice(0, 3));
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

      {showPanel && (
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
              <div><label className="ap-field-label" htmlFor="ai-q">Tvoja otázka</label><textarea id="ai-q" ref={textareaRef} className="ap-textarea" placeholder="Napr. Prečo tento tag potrebuje atribút alt?" value={question} onChange={e => setQuestion(e.target.value)} onKeyDown={onKey} rows={3} /><div className="ap-hint"><kbd className="cm-kbd">Enter</kbd> odoslať · <kbd className="cm-kbd">Shift+Enter</kbd> nový riadok</div></div>
            </div>
            {(loading || answer) && (
              <div className="ap-answer"><div className="ap-answer-header">✨ AI odpoveď</div>
                {loading ? <div className="ap-loading"><div className="ld" /><div className="ld" /><div className="ld" /></div> : <div className="ap-answer-text">{answer}</div>}
              </div>
            )}
            <div className="ap-actions"><button className="ap-btn-primary" onClick={submit} disabled={loading || !question.trim()}>{loading ? '⏳ Generujem...' : '✨ Odoslať'}</button><button className="ap-btn-ghost" onClick={closePanel}>Zrušiť</button></div>
          </div>
        </div>
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
      const passed = correctCount >= Math.ceil(questions.length * 0.6); // 60% = passed
      const score = Math.round((correctCount / questions.length) * 100);
      // Konvertuj answers na { [index]: letter }
      const answersForDB: Record<number, string> = {};
      Object.entries(newAnswers).forEach(([k, v]) => { answersForDB[parseInt(k)] = v[0]; });

      saveQuizAttempt({ lessonId, quizId, score, passed, answers: answersForDB });
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
function TaskBlock({
  section,
  lessonId,
  taskId,
  onPassed,
}: {
  section: Section;
  lessonId: string;
  taskId: string;
  onPassed?: () => void;
}) {
  const [val, setVal] = useState(section.starterCode?.value ?? '');
  const [evalState, setEvalState] = useState<'idle' | 'loading' | 'done'>('idle');
  const [evalResult, setEvalResult] = useState<{ ok: boolean; message: string } | null>(null);
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const prevUrlRef = useRef<string | null>(null);
  const passedRef = useRef(false);

  useEffect(() => {
    const iframe = iframeRef.current; if (!iframe) return;
    const url = URL.createObjectURL(new Blob([val], { type: 'text/html' }));
    if (prevUrlRef.current) { const old = prevUrlRef.current; setTimeout(() => URL.revokeObjectURL(old), 2000); }
    prevUrlRef.current = url; iframe.src = url;
  }, [val]);

  const handleEvaluate = async () => {
    setEvalState('loading'); setEvalResult(null);
    await new Promise(r => setTimeout(r, 1200));

    const criteria = section.aiEvaluation?.criteria ?? [];
    const checkResults = criteria.map(c => {
      let ok = true;
      if (c.includes('<title>')) ok = val.match(/<title>[^<]+<\/title>/) !== null;
      else if (c.includes('<h1>')) ok = val.match(/<h1>[^<]+<\/h1>/) !== null;
      else if (c.includes('<p>')) ok = val.match(/<p>[^<]+<\/p>/) !== null;
      else if (c.includes('doctype')) ok = val.toLowerCase().includes('<!doctype html>');
      else if (c.includes('charset')) ok = val.toLowerCase().includes('charset');
      else if (c.includes('lang')) ok = val.includes('lang=');
      else if (c.includes('alt')) ok = val.includes('alt=');
      else if (c.includes('<label')) ok = val.match(/<label/i) !== null;
      return { label: c, ok };
    });

    const passedCount = checkResults.filter(c => c.ok).length;
    const total = checkResults.length;
    const allOk = passedCount === total;
    const score = total > 0 ? Math.round((passedCount / total) * 100) : 100;
    const failedLabels = checkResults.filter(c => !c.ok).map(c => `• ${c.label}`).join('\n');
    const message = allOk
      ? `Výborne! Všetky ${total} podmienky splnené. +${section.aiEvaluation?.xpReward ?? 15} XP 🎉`
      : `Splnené ${passedCount} z ${total} podmienok.\n\nChýba:\n${failedLabels}`;

    // Ulož do Supabase
    await saveTaskSubmission({
      lessonId,
      taskId,
      code: val,
      passed: allOk,
      score,
      checks: checkResults,
      feedback: message,
    });

    setEvalResult({ ok: allOk, message });
    setEvalState('done');

    if (allOk && !passedRef.current) {
      passedRef.current = true;
      onPassed?.();
    }
  };

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
              <li key={i} className="task-instr-item"><span className="task-instr-num">{i + 1}</span><span>{instr}</span></li>
            ))}
          </ol>
        </div>
      )}
      <div className="task-editor-wrap">
        <div className="task-editor-shell">
          <div className="task-editor-bar">
            <div className="cm-dots"><div className="cm-dot" style={{ background: '#FF5F57' }} /><div className="cm-dot" style={{ background: '#FFBD2E' }} /><div className="cm-dot" style={{ background: '#28C840' }} /></div>
            <span className="cm-lang-badge">{(section.starterCode?.language ?? 'html').toUpperCase()}</span>
          </div>
          <CodeMirror value={val} onChange={setVal} extensions={[getLang(section.starterCode?.language ?? 'html'), cmDarkTheme]} theme="none" height="300px" basicSetup={{ lineNumbers: true, highlightActiveLine: true, autocompletion: false, foldGutter: false }} />
        </div>
        <div className="task-preview-shell">
          <div className="cm-preview-bar">
            <div className="cm-preview-dots"><div className="cm-dot" style={{ background: '#FF5F57', opacity: 0.35 }} /><div className="cm-dot" style={{ background: '#FFBD2E', opacity: 0.35 }} /><div className="cm-dot" style={{ background: '#28C840', opacity: 0.35 }} /></div>
            <div className="cm-preview-address"><svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ color: '#10B981', flexShrink: 0 }}><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg><span>náhľad</span></div>
            <div className="cm-live-badge"><div className="cm-live-dot" /><span>Live</span></div>
          </div>
          <iframe ref={iframeRef} className="task-preview-iframe" sandbox="allow-scripts" title="Task preview" />
        </div>
      </div>
      <div className="task-footer">
        <button className="task-eval-btn" onClick={handleEvaluate} disabled={evalState === 'loading'}>
          {evalState === 'loading' ? <span className="task-eval-loading"><span className="ld" /><span className="ld" /><span className="ld" /> Vyhodnocujem...</span> : '✨ Vyhodnotiť'}
        </button>
      </div>
      {evalState === 'done' && evalResult && (
        <div className={`task-result ${evalResult.ok ? 'task-result-ok' : 'task-result-fail'}`}>
          <div className="task-result-icon">{evalResult.ok ? '🎉' : '💡'}</div>
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
  onTaskPassed,
  onQuizDone,
}: {
  section: Section;
  lessonId: string;
  quizId: string;
  taskId: string;
  onTaskPassed?: () => void;
  onQuizDone?: (count: number) => void;
}) {
  const meta = SECTION_META[section.type] || { icon: '', label: section.type, color: '#6B7280' };
  if (section.type === 'task') return <TaskBlock section={section} lessonId={lessonId} taskId={taskId} onPassed={onTaskPassed} />;

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
function CompletionBanner({ xp, nextLesson }: { xp: number; nextLesson: Lesson | null }) {
  return (
    <div style={{ background: 'linear-gradient(135deg,#F0FDF4,#ECFDF5)', border: '2px solid #10B981', borderRadius: '20px', padding: '28px 32px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '20px', flexWrap: 'wrap', marginBottom: '32px', animation: 'fadeUp 0.4s ease both' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
        <div style={{ fontSize: '36px' }}>🎉</div>
        <div>
          <div style={{ fontFamily: 'Nunito,sans-serif', fontWeight: 900, fontSize: '18px', color: '#166534', marginBottom: '4px' }}>Lekcia dokončená!</div>
          <div style={{ fontSize: '14px', color: '#166534', opacity: 0.8 }}>Získal si +{xp} XP · Skvelá práca!</div>
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

// ─── Main LessonPage ──────────────────────────────────────────────────────────
export default function LessonPage() {
  const params = useParams();
  const slug = Array.isArray(params.slug) ? params.slug[0] : params.slug ?? '';
  const lessons = trackData.lessons as Lesson[];
  const lesson = lessons.find(l => l.slug === slug);
  const lessonIndex = lessons.findIndex(l => l.slug === slug);
  const prevLesson = lessonIndex > 0 ? lessons[lessonIndex - 1] : null;
  const nextLesson = lessonIndex < lessons.length - 1 ? lessons[lessonIndex + 1] : null;

  const [completedSections, setCompletedSections] = useState<Set<number>>(new Set());
  const [activeSection, setActiveSection] = useState(0);
  const sectionRefs = useRef<(HTMLDivElement | null)[]>([]);

  // Progress state
  const [taskPassed, setTaskPassed] = useState(false);
  const [quizDone, setQuizDone] = useState(false);
  const [lessonCompleted, setLessonCompleted] = useState(false);

  // Načítaj existujúci progress pri otvorení lekcie
  useEffect(() => {
    if (!lesson) return;
    getLessonProgress(lesson.lesson_id).then(p => {
      if (!p) return;
      if (p.task_passed) setTaskPassed(true);
      if (p.quiz_passed) setQuizDone(true);
      if (p.completed) setLessonCompleted(true);
    });
  }, [lesson?.lesson_id]);

  // Ak task + quiz dokončené → lekcia je ready na completed
  // (marked_complete sa nastaví keď user klikne "Ďalšia lekcia")
  const lessonReadyToComplete = taskPassed && quizDone;

  if (!lesson) {
    return (
      <div style={{ padding: 40, fontFamily: 'monospace' }}>
        <h2>Lekcia nenájdená — slug: "{slug}"</h2>
        <ul>{lessons.map(l => <li key={l.id}>{l.slug}</li>)}</ul>
        <Link href="/app/learning/html">← Späť</Link>
      </div>
    );
  }

  // Scroll spy
  useEffect(() => {
    const observer = new IntersectionObserver(
      entries => entries.forEach(entry => {
        const idx = parseInt(entry.target.getAttribute('data-idx') || '0');
        if (entry.isIntersecting) setActiveSection(idx);
        if (!entry.isIntersecting && entry.boundingClientRect.top < 0) setCompletedSections(prev => new Set([...prev, idx]));
      }),
      { threshold: 0.3, rootMargin: '-10% 0px -60% 0px' }
    );
    sectionRefs.current.forEach((ref, idx) => { if (ref) { ref.setAttribute('data-idx', String(idx)); observer.observe(ref); } });
    return () => observer.disconnect();
  }, [lesson]);

  const scrollToSection = (idx: number) => sectionRefs.current[idx]?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  const progress = lessonCompleted ? 100 : Math.round((completedSections.size / lesson.sections.length) * 100);

  // Keď user klikne na "Ďalšia lekcia" → zavolaj markLessonComplete
  const handleNextLesson = async (href: string) => {
    if (!lessonCompleted) {
      await markLessonComplete(lesson.lesson_id);
      setLessonCompleted(true);
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
        .task-editor-wrap{display:grid;grid-template-columns:1fr 1fr;border-bottom:1.5px solid #F3F0FF;}
        @media(max-width:800px){.task-editor-wrap{grid-template-columns:1fr;}}
        .task-editor-shell{border-right:1.5px solid #2D2D3F;}
        .task-editor-bar{display:flex;align-items:center;gap:8px;padding:8px 14px;background:#14142A;border-bottom:1px solid #2D2D3F;}
        .task-preview-shell{display:flex;flex-direction:column;background:white;}
        .task-preview-iframe{flex:1;border:none;width:100%;min-height:280px;background:white;}
        .task-footer{padding:16px 28px;display:flex;justify-content:flex-end;background:#FAFAFA;border-bottom:1.5px solid #F3F0FF;}
        .task-eval-btn{padding:12px 28px;border-radius:12px;border:none;font-family:'Nunito',sans-serif;font-weight:800;font-size:15px;background:linear-gradient(135deg,#7361FF,#8C78FF);color:white;cursor:pointer;box-shadow:0 4px 16px rgba(115,97,255,0.3);}
        .task-eval-btn:disabled{opacity:0.6;cursor:not-allowed;}
        .task-eval-loading{display:flex;align-items:center;gap:6px;}
        .task-result{padding:20px 28px;display:flex;align-items:flex-start;gap:14px;animation:fadeUp 0.25s ease both;}
        .task-result-ok{background:linear-gradient(135deg,#F0FDF4,#ECFDF5);}
        .task-result-fail{background:linear-gradient(135deg,#FFF7ED,#FFFBEB);}
        .task-result-icon{font-size:24px;flex-shrink:0;margin-top:2px;}
        .task-result-text{font-family:'Sora',sans-serif;font-size:14px;line-height:1.7;color:#374151;}
        .task-result-ok .task-result-text{color:#166534;}
        .task-result-fail .task-result-text{color:#92400E;}
      `}</style>

      <div className="lesson-root">
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
            <div className="xp-pill">⚡ {lesson.xp} XP</div>
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
                const isCompleted = completedSections.has(idx);
                const isActive = activeSection === idx;
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
            {lessonCompleted && <CompletionBanner xp={lesson.xp} nextLesson={nextLesson} />}

            {lesson.sections.map((section, idx) => (
              <div key={idx} ref={el => { sectionRefs.current[idx] = el; }}>
                <SectionBlock
                  section={section}
                  lessonId={lesson.lesson_id}
                  quizId={lesson.quiz_id}
                  taskId={lesson.task_id}
                  onTaskPassed={() => setTaskPassed(true)}
                  onQuizDone={(count) => {
                    const passed = count >= (lesson.completionCriteria?.minimumCorrectAnswers ?? 2);
                    if (passed) setQuizDone(true);
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
    </>
  );
}