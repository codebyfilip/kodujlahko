'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import CodeMirror from '@uiw/react-codemirror';
import { html as htmlLang } from '@codemirror/lang-html';
import { css as cssLang } from '@codemirror/lang-css';
import { javascript } from '@codemirror/lang-javascript';
import { EditorView, keymap } from '@codemirror/view';
import { HighlightStyle, syntaxHighlighting } from '@codemirror/language';
import { acceptCompletion } from '@codemirror/autocomplete';
import { tags } from '@lezer/highlight';
import type { Challenge } from '../../page';
import { ArrowLeft, Clock, Play, Loader2, CheckCircle, Send, ChevronDown, ChevronUp, X, Trophy, RotateCcw, Star } from 'lucide-react';
import {
  runLibValidation,
  getValidationRuleSummary,
  type LibCheckResult,
  type ChallengeValidationConfig,
} from './runLibValidation';
import { submitChallengeAttempt, getGroupChallengeLeaderboard, type LeaderboardEntry } from '@/app/actions/challenges';

interface ExistingProgress {
  challenge_id: string;
  status: 'started' | 'completed';
  best_score: number;
  xp_earned: number;
  best_time_seconds: number | null;
  attempts: number;
}

interface Props {
  challenge: Challenge;
  userId: string;
  existingProgress: ExistingProgress | null;
}

// ─── VS Code syntax highlighting ─────────────────────────────────────────────
const vsCodeHighlight = syntaxHighlighting(HighlightStyle.define([
  { tag: tags.comment,                     color: '#6A9955', fontStyle: 'italic' },
  { tag: tags.lineComment,                 color: '#6A9955', fontStyle: 'italic' },
  { tag: tags.blockComment,               color: '#6A9955', fontStyle: 'italic' },
  { tag: tags.keyword,                    color: '#569CD6' },
  { tag: tags.controlKeyword,             color: '#C586C0' },
  { tag: tags.moduleKeyword,              color: '#569CD6' },
  { tag: tags.operatorKeyword,            color: '#569CD6' },
  { tag: tags.string,                     color: '#CE9178' },
  { tag: tags.special(tags.string),       color: '#CE9178' },
  { tag: tags.regexp,                     color: '#D16969' },
  { tag: tags.number,                     color: '#B5CEA8' },
  { tag: tags.bool,                       color: '#569CD6' },
  { tag: tags.null,                       color: '#569CD6' },
  { tag: tags.function(tags.variableName), color: '#DCDCAA' },
  { tag: tags.function(tags.propertyName), color: '#DCDCAA' },
  { tag: tags.typeName,                   color: '#4EC9B0' },
  { tag: tags.className,                  color: '#4EC9B0' },
  { tag: tags.definition(tags.typeName),  color: '#4EC9B0' },
  { tag: tags.variableName,               color: '#9CDCFE' },
  { tag: tags.definition(tags.variableName), color: '#9CDCFE' },
  { tag: tags.local(tags.variableName),   color: '#9CDCFE' },
  { tag: tags.special(tags.variableName), color: '#9CDCFE' },
  { tag: tags.propertyName,               color: '#9CDCFE' },
  { tag: tags.operator,                   color: '#D4D4D4' },
  { tag: tags.punctuation,                color: '#D4D4D4' },
  { tag: tags.bracket,                    color: '#D4D4D4' },
  { tag: tags.tagName,                    color: '#569CD6' },
  { tag: tags.attributeName,              color: '#9CDCFE' },
  { tag: tags.attributeValue,             color: '#CE9178' },
  { tag: tags.angleBracket,               color: '#808080' },
  { tag: tags.meta,                       color: '#808080' },
  { tag: tags.atom,                       color: '#D4D4D4' },
  { tag: tags.unit,                       color: '#B5CEA8' },
  { tag: tags.color,                      color: '#CE9178' },
  { tag: tags.self,                       color: '#569CD6' },
]));

// ─── VS Code-style theme ──────────────────────────────────────────────────────
const cmDarkTheme = EditorView.theme({
  '&': { fontSize: '13.5px', fontFamily: '"JetBrains Mono",monospace', backgroundColor: '#1e1e1e', color: '#d4d4d4' },
  '.cm-content': { padding: '16px 0', caretColor: '#aeafad' },
  '.cm-focused': { outline: 'none' },
  '.cm-line': { lineHeight: '1.6', padding: '0 20px' },
  '.cm-cursor': { borderLeftColor: '#aeafad', borderLeftWidth: '2px' },
  '.cm-selectionBackground': { backgroundColor: '#3D2F8A !important' },
  '&.cm-focused .cm-selectionBackground': { backgroundColor: '#3D2F8A !important' },
  '&:not(.cm-focused) .cm-selectionBackground': { backgroundColor: '#3D2F8A66 !important' },
  '.cm-line ::selection': { backgroundColor: '#3D2F8A !important' },
  '.cm-gutters': { backgroundColor: '#1e1e1e', borderRight: '1px solid #2d2d2d', color: '#858585' },
  '.cm-activeLineGutter': { backgroundColor: '#252535', color: '#c6c6c6' },
  '.cm-activeLine': { backgroundColor: '#252535' },
  '.cm-scroller': { overflow: 'auto' },
  // autocomplete tooltip
  '.cm-tooltip': { backgroundColor: '#1A1A2E', border: '1px solid #3D2F8A', borderRadius: '8px', boxShadow: '0 8px 24px #00000066', padding: '2px 0', overflow: 'hidden' },
  '.cm-tooltip-autocomplete > ul': { fontFamily: '"JetBrains Mono",monospace', fontSize: '12.5px', maxHeight: '240px' },
  '.cm-tooltip-autocomplete > ul > li': { padding: '5px 12px', color: '#CDD6F4', display: 'flex', alignItems: 'center' },
  '.cm-tooltip-autocomplete > ul > li[aria-selected]': { backgroundColor: '#3D2F8A', color: '#fff' },
  '.cm-completionLabel': { color: '#CDD6F4' },
  '.cm-completionDetail': { color: '#7361FF', marginLeft: '8px', fontSize: '11px', opacity: '0.8' },
  '.cm-completionMatchedText': { color: '#A78BFA', fontWeight: 'bold', textDecoration: 'none' },
  '.cm-tooltip.cm-completionInfo': { backgroundColor: '#1A1A2E', border: '1px solid #3D2F8A', padding: '8px 12px', color: '#9CA3AF', fontSize: '12px' },
});

const cssAutoSemicolon = EditorView.updateListener.of(update => {
  for (const tr of update.transactions) {
    if (!tr.isUserEvent('input.complete')) continue;
    const view = update.view;
    const pos = view.state.selection.main.head;
    const line = view.state.doc.lineAt(pos);
    const text = line.text.trimEnd();
    if (text.endsWith(';') || text.endsWith('{') || text.endsWith('}') || text.endsWith(',')) continue;
    if (text.includes(':')) {
      // value completion — doplň ; a nechaj kurzor pred ním
      view.dispatch({ changes: { from: pos, insert: ';' }, selection: { anchor: pos } });
    } else {
      // property completion — doplň ": ;" a daj kurzor medzi : a ;
      view.dispatch({ changes: { from: pos, insert: ': ;' }, selection: { anchor: pos + 2 } });
    }
  }
});

function getLang(tab: 'html' | 'css' | 'js') {
  if (tab === 'css') return cssLang();
  if (tab === 'js') return javascript();
  return htmlLang();
}

function formatTime(seconds: number) {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

function buildPreviewDoc(html: string, css: string, js: string) {
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

const JS_INTERCEPTOR = `const _s=v=>{try{return typeof v==='object'&&v!==null?JSON.stringify(v,null,2):String(v)}catch{return String(v)}};const _p=(t,...a)=>window.parent.postMessage({t,d:a.map(_s).join(' ')},'*');console.log=(...a)=>_p('log',...a);console.warn=(...a)=>_p('warn',...a);console.error=(...a)=>_p('err',...a);`;

type Tab = 'html' | 'css' | 'js' | 'pokyny';

type CheckState = {
  checks: LibCheckResult[];
  score: number;
  passed: boolean;
  open: boolean;
};

export default function ChallengeEditorClient({ challenge, userId: _userId, existingProgress }: Props) {

  const availableTabs: Tab[] = challenge.category === 'html'
    ? ['html']
    : challenge.category === 'html+css'
    ? ['html', 'css']
    : challenge.category === 'javascript'
    ? ['js']
    : ['html', 'css', 'js'];

  const storageKey = `challenge_${challenge.id}`;
  const validationConfig = challenge.validation as unknown as ChallengeValidationConfig;
  const ruleSummary = getValidationRuleSummary(validationConfig);
  const totalPoints = ruleSummary.filter(r => r.points > 0).reduce((s, r) => s + r.points, 0);

  // ─── Code state ──────────────────────────────────────────────────────────────
  const [activeTab, setActiveTab] = useState<Tab>(challenge.category === 'javascript' ? 'js' : 'html');
  const [codeHtml, setCodeHtml] = useState(() => {
    if (typeof window === 'undefined') return challenge.starter_code.html;
    return localStorage.getItem(`${storageKey}_html`) ?? challenge.starter_code.html;
  });
  const [codeCss, setCodeCss] = useState(() => {
    if (typeof window === 'undefined') return challenge.starter_code.css;
    return localStorage.getItem(`${storageKey}_css`) ?? challenge.starter_code.css;
  });
  const [codeJs, setCodeJs] = useState(() => {
    if (typeof window === 'undefined') return challenge.starter_code.js;
    return localStorage.getItem(`${storageKey}_js`) ?? challenge.starter_code.js;
  });

  // ─── Timer ──────────────────────────────────────────────────────────────────
  const [elapsed, setElapsed] = useState(0);
  const startRef = useRef<number | null>(null);
  const baseElapsedRef = useRef<number>(0);
  const rafRef = useRef<number | null>(null);

  useEffect(() => {
    const storedStart = localStorage.getItem(`${storageKey}_start`);
    const storedElapsed = localStorage.getItem(`${storageKey}_elapsed`);
    const base = storedElapsed ? parseInt(storedElapsed) : 0;
    baseElapsedRef.current = base;
    const now = Date.now();
    if (storedStart) {
      startRef.current = parseInt(storedStart);
    } else {
      startRef.current = now;
      localStorage.setItem(`${storageKey}_start`, String(now));
    }
    const tick = () => {
      setElapsed(baseElapsedRef.current + Math.floor((Date.now() - startRef.current!) / 1000));
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => { if (rafRef.current) cancelAnimationFrame(rafRef.current); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => { localStorage.setItem(`${storageKey}_html`, codeHtml); }, [codeHtml, storageKey]);
  useEffect(() => { localStorage.setItem(`${storageKey}_css`, codeCss); }, [codeCss, storageKey]);
  useEffect(() => { localStorage.setItem(`${storageKey}_js`, codeJs); }, [codeJs, storageKey]);

  // ─── Console (javascript category) ──────────────────────────────────────────
  const [consoleLines, setConsoleLines] = useState<{ t: 'log' | 'warn' | 'err'; text: string }[]>([]);
  const consoleEndRef = useRef<HTMLDivElement>(null);

  // ─── Live preview ────────────────────────────────────────────────────────────
  const previewRef = useRef<HTMLIFrameElement>(null);
  const targetRef = useRef<HTMLIFrameElement>(null);
  const prevPreviewUrl = useRef<string | null>(null);

  const updatePreview = useCallback(() => {
    const iframe = previewRef.current; if (!iframe) return;
    if (challenge.category === 'javascript') {
      setConsoleLines([]);
      const doc = `<!doctype html><html><head><meta charset="UTF-8"></head><body><script>${JS_INTERCEPTOR}try{${codeJs}}catch(e){window.parent.postMessage({t:'err',d:e.message},'*');}<\/script></body></html>`;
      const url = URL.createObjectURL(new Blob([doc], { type: 'text/html;charset=utf-8' }));
      if (prevPreviewUrl.current) { const old = prevPreviewUrl.current; setTimeout(() => URL.revokeObjectURL(old), 2000); }
      prevPreviewUrl.current = url; iframe.src = url;
      return;
    }
    const doc = buildPreviewDoc(codeHtml, codeCss, codeJs);
    const url = URL.createObjectURL(new Blob([doc], { type: 'text/html;charset=utf-8' }));
    if (prevPreviewUrl.current) { const old = prevPreviewUrl.current; setTimeout(() => URL.revokeObjectURL(old), 2000); }
    prevPreviewUrl.current = url; iframe.src = url;
  }, [codeHtml, codeCss, codeJs, challenge.category]);

  useEffect(() => { updatePreview(); }, [updatePreview]);

  useEffect(() => {
    if (challenge.category !== 'javascript') return;
    const handler = (e: MessageEvent) => {
      if (!e.data || typeof e.data.t !== 'string') return;
      const { t, d } = e.data as { t: string; d: string };
      if (t === 'log' || t === 'warn' || t === 'err') {
        setConsoleLines(prev => [...prev, { t, text: d }]);
      }
    };
    window.addEventListener('message', handler);
    return () => window.removeEventListener('message', handler);
  }, [challenge.category]);

  useEffect(() => {
    consoleEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [consoleLines]);

  const prevTargetUrl = useRef<string | null>(null);
  useEffect(() => {
    const iframe = targetRef.current;
    if (!iframe || !challenge.target_preview) return;
    const { html, css, js } = challenge.target_preview;
    const doc = buildPreviewDoc(html, css, js);
    const url = URL.createObjectURL(new Blob([doc], { type: 'text/html;charset=utf-8' }));
    if (prevTargetUrl.current) { const old = prevTargetUrl.current; setTimeout(() => URL.revokeObjectURL(old), 2000); }
    prevTargetUrl.current = url; iframe.src = url;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ─── Validation ──────────────────────────────────────────────────────────────
  const [checkState, setCheckState] = useState<CheckState | null>(null);
  const [checkLoading, setCheckLoading] = useState(false);
  const [submitState, setSubmitState] = useState<'idle' | 'loading' | 'done'>('idle');
  const [submitResult, setSubmitResult] = useState<{
    score: number;
    xpEarned: number;
    passed: boolean;
    isNewBest: boolean;
    checks: LibCheckResult[];
  } | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [groupLb, setGroupLb] = useState<{
    groupName: string | null;
    entries: LeaderboardEntry[];
    myRank: number | null;
  } | null>(null);
  const [resetConfirm, setResetConfirm] = useState(false);

  const handleCheck = useCallback(async () => {
    if (checkLoading) return;
    setCheckLoading(true);
    try {
      const result = await runLibValidation(
        validationConfig,
        codeHtml, codeCss, codeJs,
        challenge.target_preview,
        challenge.category,
      );
      setCheckState({ ...result, open: true });
    } finally {
      setCheckLoading(false);
    }
  }, [checkLoading, codeHtml, codeCss, codeJs, validationConfig, challenge.target_preview]);

  const handleSubmit = useCallback(async () => {
    if (submitState === 'loading') return;
    setSubmitState('loading');
    setSubmitError(null);

    try {
      const result = await runLibValidation(
        validationConfig,
        codeHtml, codeCss, codeJs,
        challenge.target_preview,
        challenge.category,
      );

      const res = await submitChallengeAttempt({
        challengeId: challenge.id,
        score: result.score,
        passed: result.passed,
        xpReward: challenge.xp_reward,
        timeSeconds: elapsed,
        existingBestScore: existingProgress?.best_score ?? 0,
        existingAttempts: existingProgress?.attempts ?? 0,
        existingXpEarned: existingProgress?.xp_earned ?? 0,
        existingBestTime: existingProgress?.best_time_seconds ?? null,
      });

      if (res.error) {
        setSubmitError(res.error);
        setSubmitState('idle');
        return;
      }

      localStorage.removeItem(`${storageKey}_start`);
      localStorage.removeItem(`${storageKey}_elapsed`);
      if (rafRef.current) cancelAnimationFrame(rafRef.current);

      setSubmitResult({
        score: result.score,
        xpEarned: res.xpAwarded,
        passed: result.passed,
        isNewBest: res.isNewBest,
        checks: result.checks,
      });
      setSubmitState('done');

      getGroupChallengeLeaderboard(challenge.id).then(setGroupLb).catch(() => {});
    } catch (e) {
      setSubmitError(e instanceof Error ? e.message : 'Chyba pri ukladaní');
      setSubmitState('idle');
    }
  }, [submitState, codeHtml, codeCss, codeJs, challenge, elapsed, existingProgress, storageKey, validationConfig]);

  // ─── Reset ────────────────────────────────────────────────────────────────────
  const handleReset = useCallback(() => {
    setCodeHtml(challenge.starter_code.html);
    setCodeCss(challenge.starter_code.css);
    setCodeJs(challenge.starter_code.js);
    localStorage.setItem(`${storageKey}_html`, challenge.starter_code.html);
    localStorage.setItem(`${storageKey}_css`, challenge.starter_code.css);
    localStorage.setItem(`${storageKey}_js`, challenge.starter_code.js);
    const now = Date.now();
    startRef.current = now;
    localStorage.setItem(`${storageKey}_start`, String(now));
    localStorage.removeItem(`${storageKey}_elapsed`);
    setElapsed(0);
    setResetConfirm(false);
    setCheckState(null);
  }, [challenge.starter_code, storageKey]);

  const handleRetry = useCallback(() => {
    const now = Date.now();
    baseElapsedRef.current = elapsed;
    startRef.current = now;
    localStorage.setItem(`${storageKey}_start`, String(now));
    localStorage.setItem(`${storageKey}_elapsed`, String(elapsed));
    setSubmitState('idle');
    setSubmitResult(null);
    setGroupLb(null);
    setCheckState(null);
  }, [storageKey, elapsed]);

  const activeCodeTab = (activeTab === 'pokyny' ? 'html' : activeTab) as 'html' | 'css' | 'js';
  const currentCode = activeCodeTab === 'html' ? codeHtml : activeCodeTab === 'css' ? codeCss : codeJs;
  const setCurrentCode = activeCodeTab === 'html' ? setCodeHtml : activeCodeTab === 'css' ? setCodeCss : setCodeJs;

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const mod = e.metaKey || e.ctrlKey;
      if (mod && e.key === 'Enter') { e.preventDefault(); handleSubmit(); }
      if (mod && e.shiftKey && e.key === 'k') { e.preventDefault(); handleCheck(); }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [handleSubmit, handleCheck]);

  const hasTarget = !!challenge.target_preview;
  const difficultyColor = challenge.difficulty === 'easy' ? '#10B981' : challenge.difficulty === 'medium' ? '#F59E0B' : '#EF4444';
  const difficultyLabel = challenge.difficulty === 'easy' ? 'Ľahká' : challenge.difficulty === 'medium' ? 'Stredná' : 'Ťažká';

  // ─── Resizable dividers ──────────────────────────────────────────────────────
  const editorViewRef = useRef<EditorView | null>(null);
  const colorInputRef = useRef<HTMLInputElement | null>(null);
  const [editorWidth, setEditorWidth] = useState(420);
  const [isDraggingDiv, setIsDraggingDiv] = useState(false);
  const mainRef = useRef<HTMLDivElement>(null);

  const handleDividerPointerDown = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    e.currentTarget.setPointerCapture(e.pointerId);
    setIsDraggingDiv(true);
  }, []);
  const handleDividerPointerMove = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    if (!e.currentTarget.hasPointerCapture(e.pointerId) || !mainRef.current) return;
    const rect = mainRef.current.getBoundingClientRect();
    const newWidth = Math.min(Math.max(e.clientX - rect.left, 200), rect.width - 200);
    setEditorWidth(newWidth);
  }, []);
  const handleDividerPointerUp = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    e.currentTarget.releasePointerCapture(e.pointerId);
    setIsDraggingDiv(false);
  }, []);

  const [topPreviewHeight, setTopPreviewHeight] = useState<number | null>(null);
  const [isDraggingV, setIsDraggingV] = useState(false);
  const previewColRef = useRef<HTMLDivElement>(null);

  // ─── Comparison slider ───────────────────────────────────────────────────────
  const [compareMode, setCompareMode] = useState(false);
  const [sliderPos, setSliderPos] = useState(50);
  const [isDraggingSlider, setIsDraggingSlider] = useState(false);
  const compareContainerRef = useRef<HTMLDivElement>(null);

  const handleSliderPointerDown = useCallback((e: React.PointerEvent) => {
    e.currentTarget.setPointerCapture(e.pointerId);
    setIsDraggingSlider(true);
  }, []);
  const handleSliderPointerMove = useCallback((e: React.PointerEvent) => {
    if (!e.currentTarget.hasPointerCapture(e.pointerId) || !compareContainerRef.current) return;
    const rect = compareContainerRef.current.getBoundingClientRect();
    const pct = Math.min(Math.max(((e.clientX - rect.left) / rect.width) * 100, 2), 98);
    setSliderPos(pct);
  }, []);
  const handleSliderPointerUp = useCallback((e: React.PointerEvent) => {
    e.currentTarget.releasePointerCapture(e.pointerId);
    setIsDraggingSlider(false);
  }, []);

  const handleVDividerPointerDown = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    e.currentTarget.setPointerCapture(e.pointerId);
    setIsDraggingV(true);
  }, []);
  const handleVDividerPointerMove = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    if (!e.currentTarget.hasPointerCapture(e.pointerId) || !compareContainerRef.current) return;
    const rect = compareContainerRef.current.getBoundingClientRect();
    const newH = Math.min(Math.max(e.clientY - rect.top, 80), rect.height - 80);
    setTopPreviewHeight(newH);
  }, []);
  const handleVDividerPointerUp = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    e.currentTarget.releasePointerCapture(e.pointerId);
    setIsDraggingV(false);
  }, []);

  // ─── Result screen ───────────────────────────────────────────────────────────
  if (submitState === 'done' && submitResult) {
    const passedCount = submitResult.checks.filter(r => r.passed).length;
    const scoreColor = submitResult.passed ? '#10B981' : submitResult.score >= 50 ? '#F59E0B' : '#EF4444';
    return (
      <>
      <style>{`* { box-sizing: border-box; margin: 0; padding: 0; } html, body { height: 100%; overflow: hidden; } nav, header, [class*="navbar"], [class*="NavBar"], [class*="nav-bar"] { display: none !important; }`}</style>
      <div style={{ minHeight: '100vh', background: '#0F0F1A', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: '"JetBrains Mono",monospace', padding: 24, overflowY: 'auto' }}>
        <div style={{ background: '#1A1A2E', border: `1px solid ${submitResult.passed ? '#10B98133' : '#2D2D3F'}`, borderRadius: 20, padding: '40px 36px', maxWidth: 540, width: '100%' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 28 }}>
            <div style={{ width: 56, height: 56, borderRadius: '50%', background: submitResult.passed ? 'rgba(16,185,129,0.12)' : 'rgba(245,158,11,0.12)', border: `2px solid ${scoreColor}`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <Trophy size={26} color={scoreColor} />
            </div>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ color: '#CDD6F4', fontSize: 20, fontWeight: 700 }}>
                  {submitResult.passed ? 'Výzva splnená!' : 'Takmer tam...'}
                </span>
                {submitResult.isNewBest && (
                  <span style={{ background: 'rgba(115,97,255,0.2)', color: '#A78BFA', fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 20, letterSpacing: '0.3px' }}>
                    Nové maximum
                  </span>
                )}
              </div>
              <div style={{ color: '#6B7280', fontSize: 13, marginTop: 2 }}>
                {submitResult.passed
                  ? `Splnil si ${passedCount} z ${submitResult.checks.length} kritérií`
                  : submitResult.isNewBest
                    ? `Potrebuješ aspoň ${challenge.validation.min_score_to_pass}% — dosiahol si ${submitResult.score}%`
                    : `Pod tvojim rekordom (max: ${existingProgress?.best_score ?? 0}%)`}
              </div>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10, marginBottom: 24 }}>
            <div style={{ background: '#0F0F1A', borderRadius: 12, padding: '14px 16px', textAlign: 'center' }}>
              <div style={{ color: scoreColor, fontSize: 28, fontWeight: 800 }}>{submitResult.score}%</div>
              <div style={{ color: '#6B7280', fontSize: 11, marginTop: 3 }}>Skóre</div>
            </div>
            <div style={{ background: '#0F0F1A', borderRadius: 12, padding: '14px 16px', textAlign: 'center' }}>
              <div style={{ color: submitResult.xpEarned > 0 ? '#7361FF' : '#4B5563', fontSize: 28, fontWeight: 800 }}>
                {submitResult.xpEarned > 0 ? `+${submitResult.xpEarned}` : '—'}
              </div>
              <div style={{ color: '#6B7280', fontSize: 11, marginTop: 3 }}>XP</div>
            </div>
            <div style={{ background: '#0F0F1A', borderRadius: 12, padding: '14px 16px', textAlign: 'center' }}>
              <div style={{ color: '#CDD6F4', fontSize: 28, fontWeight: 800 }}>{formatTime(elapsed)}</div>
              <div style={{ color: '#6B7280', fontSize: 11, marginTop: 3 }}>Čas</div>
            </div>
          </div>

          <div style={{ marginBottom: 24 }}>
            <div style={{ color: '#6B7280', fontSize: 11, fontWeight: 600, letterSpacing: '0.5px', textTransform: 'uppercase', marginBottom: 8 }}>Výsledky kritérií</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 5, maxHeight: 240, overflowY: 'auto' }}>
              {submitResult.checks.filter(r => !r.isPenalty).map(r => (
                <div key={r.id} style={{ display: 'flex', alignItems: 'flex-start', gap: 10, padding: '8px 12px', background: '#0F0F1A', borderRadius: 8, border: `1px solid ${r.passed ? '#10B98122' : '#EF444422'}` }}>
                  <div style={{ width: 16, height: 16, borderRadius: '50%', background: r.passed ? 'rgba(16,185,129,0.15)' : 'rgba(239,68,68,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, marginTop: 1 }}>
                    {r.passed ? <CheckCircle size={11} color="#10B981" /> : <X size={11} color="#EF4444" />}
                  </div>
                  <span style={{ color: r.passed ? '#9CA3AF' : '#CDD6F4', fontSize: 12, flex: 1, lineHeight: 1.4 }}>
                    {r.passed ? r.label : (r.hint ?? r.label)}
                  </span>
                  <span style={{ color: r.passed ? '#10B981' : '#6B7280', fontSize: 12, flexShrink: 0 }}>
                    {r.earned > 0 ? `+${r.earned}` : `0/${r.points}`}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {groupLb && groupLb.groupName && groupLb.entries.length > 0 && (
            <div style={{ marginBottom: 24 }}>
              <div style={{ color: '#6B7280', fontSize: 11, fontWeight: 600, letterSpacing: '0.5px', textTransform: 'uppercase', marginBottom: 8 }}>
                Skupina: {groupLb.groupName}
                {groupLb.myRank && <span style={{ color: '#7361FF', marginLeft: 8 }}>#{groupLb.myRank} miesto</span>}
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                {groupLb.entries.map((entry, i) => {
                  const isMe = groupLb.myRank === i + 1;
                  const medal = i === 0 ? '#F59E0B' : i === 1 ? '#9CA3AF' : i === 2 ? '#B45309' : null;
                  return (
                    <div key={entry.user_id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '7px 12px', background: isMe ? 'rgba(115,97,255,0.1)' : '#0F0F1A', borderRadius: 8, border: `1px solid ${isMe ? '#7361FF44' : '#1E1E38'}` }}>
                      <span style={{ width: 20, textAlign: 'center', fontSize: 13, color: medal ?? '#6B7280', fontWeight: medal ? 700 : 400, flexShrink: 0 }}>
                        {medal ? ['🥇', '🥈', '🥉'][i] : `${i + 1}.`}
                      </span>
                      <span style={{ flex: 1, fontSize: 12, color: isMe ? '#CDD6F4' : '#9CA3AF', fontWeight: isMe ? 600 : 400, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {entry.display_name ?? 'Anonymný'}
                        {isMe && <span style={{ color: '#7361FF', marginLeft: 6, fontSize: 11 }}>ty</span>}
                      </span>
                      <span style={{ fontSize: 12, color: entry.best_score >= challenge.validation.min_score_to_pass ? '#10B981' : '#F59E0B', fontWeight: 600, flexShrink: 0 }}>{entry.best_score}%</span>
                      {entry.best_time_seconds !== null && (
                        <span style={{ fontSize: 11, color: '#6B7280', flexShrink: 0 }}>{formatTime(entry.best_time_seconds)}</span>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            <button
              onClick={handleRetry}
              style={{ padding: '10px 20px', background: submitResult.passed ? '#1E1E38' : '#7361FF', color: submitResult.passed ? '#9CA3AF' : '#fff', border: submitResult.passed ? '1px solid #2D2D3F' : 'none', borderRadius: 9, fontSize: 13, fontWeight: 600, cursor: 'pointer', flex: 1 }}
            >
              {submitResult.passed ? 'Zopakovať' : 'Skúsiť znova'}
            </button>
            <Link
              href={`/app/challenges/solo/${challenge.id}`}
              style={{ padding: '10px 20px', background: '#1E1E38', color: '#CDD6F4', border: '1px solid #2D2D3F', borderRadius: 9, fontSize: 13, fontWeight: 600, textDecoration: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', flex: 1 }}
            >
              Detail výzvy
            </Link>
            <Link
              href="/app/challenges/solo"
              style={{ padding: '10px 20px', background: '#1E1E38', color: '#6B7280', border: '1px solid #2D2D3F', borderRadius: 9, fontSize: 13, fontWeight: 600, textDecoration: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', flex: 1 }}
            >
              Všetky výzvy
            </Link>
          </div>
        </div>
      </div>
      </>
    );
  }

  return (
    <>
      <style>{`
        * { box-sizing: border-box; margin: 0; padding: 0; }
        html, body { height: 100%; overflow: hidden; }
        .ce-root { display: flex; flex-direction: column; height: 100vh; background: #0F0F1A; font-family: 'JetBrains Mono', monospace; color: #CDD6F4; }

        .ce-topbar { height: 52px; background: #14142A; border-bottom: 1px solid #2D2D3F; display: flex; align-items: center; gap: 0; flex-shrink: 0; }
        .ce-back { display: flex; align-items: center; gap: 6px; padding: 0 16px; height: 100%; color: #6B7280; text-decoration: none; font-size: 13px; border-right: 1px solid #2D2D3F; white-space: nowrap; }
        .ce-back:hover { color: #CDD6F4; background: rgba(255,255,255,0.04); }
        .ce-title { padding: 0 16px; font-size: 13px; font-weight: 600; color: #CDD6F4; flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
        .ce-badge { padding: 3px 10px; border-radius: 6px; font-size: 11px; font-weight: 700; letter-spacing: 0.3px; }
        .ce-timer { display: flex; align-items: center; gap: 6px; padding: 0 16px; font-size: 13px; color: #6B7280; border-left: 1px solid #2D2D3F; }
        .ce-actions { display: flex; align-items: center; gap: 8px; padding: 0 16px; border-left: 1px solid #2D2D3F; height: 100%; }
        .ce-btn { display: flex; align-items: center; gap: 6px; padding: 7px 14px; border-radius: 8px; font-size: 12px; font-weight: 600; cursor: pointer; border: none; transition: opacity 0.15s; white-space: nowrap; }
        .ce-btn:hover { opacity: 0.85; }
        .ce-btn-check { background: #1E1E38; color: #CDD6F4; border: 1px solid #2D2D3F; }
        .ce-btn-check:disabled { opacity: 0.6; cursor: not-allowed; }
        .ce-btn-submit { background: #7361FF; color: #fff; }
        .ce-btn-submit:disabled { opacity: 0.6; cursor: not-allowed; }
        @keyframes spin { to { transform: rotate(360deg); } }

        .ce-main { flex: 1; display: flex; overflow: hidden; }
        .ce-editor-col { display: flex; flex-direction: column; flex-shrink: 0; min-width: 200px; overflow-y: auto; overflow-x: hidden; }
        .ce-editor-col .ce-tabs { position: sticky; top: 0; z-index: 10; }
        .ce-divider { width: 4px; background: #2D2D3F; cursor: col-resize; flex-shrink: 0; transition: background 0.15s; position: relative; touch-action: none; }
        .ce-divider::before { content: ''; position: absolute; inset: 0; margin: 0 -6px; }
        .ce-divider:hover { background: #7361FF55; }
        .ce-divider-active { background: #7361FF !important; }
        .ce-vdivider { height: 4px; background: #2D2D3F; cursor: row-resize; flex-shrink: 0; transition: background 0.15s; position: relative; touch-action: none; }
        .ce-vdivider::before { content: ''; position: absolute; inset: 0; margin: -6px 0; }
        .ce-vdivider:hover { background: #7361FF55; }
        .ce-tabs { display: flex; background: #14142A; border-bottom: 1px solid #2D2D3F; flex-shrink: 0; }
        .ce-tab { padding: 10px 18px; font-size: 12px; font-weight: 600; cursor: pointer; border: none; background: none; color: #6B7280; transition: color 0.15s, background 0.15s; border-bottom: 2px solid transparent; }
        .ce-tab:hover { color: #CDD6F4; }
        .ce-tab-active { color: #7361FF; border-bottom-color: #7361FF; }
        .ce-codemirror-wrap { flex: 1; position: relative; }
        .ce-codemirror-wrap .cm-editor { height: auto !important; min-height: 100vh; }
        .ce-codemirror-wrap .cm-selectionBackground { background-color: #3D2F8A !important; }
        .ce-codemirror-wrap .cm-focused .cm-selectionBackground { background-color: #3D2F8A !important; }
        .ce-codemirror-wrap ::selection { background-color: #3D2F8A !important; color: inherit; }

        .ce-preview-col { flex: 1; display: flex; flex-direction: column; overflow: hidden; min-width: 0; }
        .ce-preview-half { flex: 1; display: flex; flex-direction: column; border-bottom: 1px solid #2D2D3F; overflow: hidden; min-height: 0; }
        .ce-preview-half:last-child { border-bottom: none; }
        .ce-preview-bar { height: 36px; background: #14142A; border-bottom: 1px solid #2D2D3F; display: flex; align-items: center; padding: 0 14px; gap: 8px; flex-shrink: 0; }
        .ce-preview-bar-label { font-size: 11px; color: #6B7280; font-weight: 600; letter-spacing: 0.5px; text-transform: uppercase; }
        .ce-live-dot { width: 6px; height: 6px; border-radius: 50%; background: #10B981; animation: ce-blink 2s infinite; }
        @keyframes ce-blink { 0%,100% { opacity: 1; } 50% { opacity: 0.3; } }
        .ce-iframe { flex: 1; border: none; background: #fff; display: block; }

        .ce-check-panel { position: fixed; bottom: 0; left: 0; right: 0; background: #14142A; border-top: 1px solid #2D2D3F; z-index: 100; transform: translateY(100%); transition: transform 0.25s ease; }
        .ce-check-panel-open { transform: translateY(0); }
        .ce-check-header { display: flex; align-items: center; padding: 14px 20px; gap: 12px; cursor: pointer; }
        .ce-check-score { font-size: 20px; font-weight: 800; }
        .ce-check-label { font-size: 13px; color: #6B7280; flex: 1; }
        .ce-check-items { padding: 0 20px 16px; display: flex; flex-direction: column; gap: 6px; max-height: 240px; overflow-y: auto; }
        .ce-rule { display: flex; align-items: flex-start; gap: 10px; padding: 8px 12px; border-radius: 8px; background: #1A1A2E; }
        .ce-rule-icon { width: 18px; height: 18px; border-radius: 50%; display: flex; align-items: center; justify-content: center; flex-shrink: 0; margin-top: 1px; }
        .ce-rule-desc { font-size: 12px; color: #CDD6F4; flex: 1; }
        .ce-rule-pts { font-size: 12px; color: #6B7280; white-space: nowrap; }

        .js-console { background:#1E1E1E; display:flex; flex-direction:column; height:100%; overflow:hidden; }
        .js-console-bar { background:#2D2D2D; display:flex; align-items:center; justify-content:space-between; padding:0 14px; height:36px; flex-shrink:0; border-bottom:1px solid #3D3D3D; }
        .js-console-bar-label { font-size:11px; color:#9CA3AF; font-weight:600; letter-spacing:0.5px; display:flex; align-items:center; gap:6px; }
        .js-console-output { flex:1; overflow-y:auto; padding:4px 0; }
        .js-console-line { font-family:'JetBrains Mono',monospace; font-size:12.5px; padding:3px 14px; line-height:1.55; white-space:pre-wrap; word-break:break-all; border-bottom:1px solid #262626; }
        .js-console-log { color:#D4D4D4; }
        .js-console-warn { color:#DDB66E; background:rgba(221,182,110,0.07); }
        .js-console-err { color:#F48771; background:rgba(244,135,113,0.07); }
      `}</style>

      <div className="ce-root">
        <div className="ce-topbar">
          <Link href={`/app/challenges/solo/${challenge.id}`} className="ce-back">
            <ArrowLeft size={14} />
            Späť
          </Link>
          <div className="ce-title">{challenge.title}</div>
          <span className="ce-badge" style={{ background: `${difficultyColor}18`, color: difficultyColor, marginRight: 8 }}>
            {difficultyLabel}
          </span>
          {existingProgress && existingProgress.best_score > 0 && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '0 12px', borderLeft: '1px solid #2D2D3F', fontSize: 12, color: existingProgress.status === 'completed' ? '#10B981' : '#F59E0B', whiteSpace: 'nowrap' }}>
              <Star size={12} fill="currentColor" />
              {existingProgress.best_score}%
            </div>
          )}
          <div className="ce-timer">
            <Clock size={13} />
            {formatTime(elapsed)}
          </div>
          <div className="ce-actions">
            <button className="ce-btn ce-btn-check" onClick={handleCheck} disabled={checkLoading}>
              {checkLoading ? <Loader2 size={13} style={{ animation: 'spin 1s linear infinite' }} /> : <Play size={13} />}
              {checkLoading ? 'Kontrolujem...' : 'Skontrolovať'}
            </button>
            <button className="ce-btn ce-btn-submit" onClick={handleSubmit} disabled={submitState === 'loading'}>
              <Send size={13} />
              {submitState === 'loading' ? 'Ukladám...' : 'Odovzdať'}
            </button>
          </div>
        </div>

        {submitError && (
          <div style={{ position: 'absolute', top: 52, left: 0, right: 0, background: '#450a0a', borderBottom: '1px solid #7f1d1d', color: '#fca5a5', fontSize: 12, padding: '8px 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', zIndex: 50 }}>
            <span>Chyba pri ukladaní: {submitError}</span>
            <button onClick={() => setSubmitError(null)} style={{ background: 'none', border: 'none', color: '#fca5a5', cursor: 'pointer', padding: '0 4px' }}><X size={14} /></button>
          </div>
        )}

        <div className="ce-main" ref={mainRef}>
          <div className="ce-editor-col" style={{ width: editorWidth }}>
            <div className="ce-tabs">
              <button
                className={`ce-tab ${activeTab === 'pokyny' ? 'ce-tab-active' : ''}`}
                style={{ color: activeTab === 'pokyny' ? '#10B981' : undefined, borderBottomColor: activeTab === 'pokyny' ? '#10B981' : undefined }}
                onClick={() => setActiveTab('pokyny')}
              >
                POKYNY
              </button>
              <div style={{ width: 1, background: '#2D2D3F', margin: '8px 0', flexShrink: 0 }} />
              {availableTabs.map(tab => (
                <button
                  key={tab}
                  className={`ce-tab ${activeTab === tab ? 'ce-tab-active' : ''}`}
                  onClick={() => setActiveTab(tab)}
                >
                  {tab.toUpperCase()}
                </button>
              ))}
              <div style={{ flex: 1 }} />
              {activeTab === 'css' && (
                <>
                  <input
                    ref={colorInputRef}
                    type="color"
                    style={{ position: 'absolute', opacity: 0, pointerEvents: 'none', width: 0, height: 0 }}
                    onChange={e => {
                      const hex = e.target.value;
                      const view = editorViewRef.current;
                      if (!view) return;
                      view.dispatch(view.state.replaceSelection(hex));
                      view.focus();
                    }}
                  />
                  <button
                    onClick={() => colorInputRef.current?.click()}
                    style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '0 12px', background: 'none', border: 'none', color: '#9CA3AF', fontSize: 11, cursor: 'pointer' }}
                    title="Vybrať farbu"
                  >
                    <span style={{ width: 12, height: 12, borderRadius: 3, background: 'conic-gradient(red,yellow,lime,cyan,blue,magenta,red)', display: 'inline-block', flexShrink: 0 }} />
                    Farba
                  </button>
                </>
              )}
              {resetConfirm ? (
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '0 10px' }}>
                  <span style={{ fontSize: 11, color: '#F59E0B' }}>Resetovať kód?</span>
                  <button onClick={handleReset} style={{ fontSize: 11, fontWeight: 700, color: '#EF4444', background: 'none', border: 'none', cursor: 'pointer', padding: '2px 6px' }}>Áno</button>
                  <button onClick={() => setResetConfirm(false)} style={{ fontSize: 11, color: '#6B7280', background: 'none', border: 'none', cursor: 'pointer', padding: '2px 6px' }}>Nie</button>
                </div>
              ) : (
                <button
                  onClick={() => setResetConfirm(true)}
                  style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '0 12px', background: 'none', border: 'none', color: '#555570', fontSize: 11, cursor: 'pointer' }}
                  title="Reset na štartovaciu šablónu"
                >
                  <RotateCcw size={12} />
                  Reset
                </button>
              )}
            </div>
            {activeTab === 'pokyny' ? (
              <div style={{ flex: 1, overflowY: 'auto', padding: '20px 18px', display: 'flex', flexDirection: 'column', gap: 20 }}>
                <div>
                  <div style={{ fontSize: 11, fontWeight: 600, color: '#6B7280', letterSpacing: '0.5px', textTransform: 'uppercase', marginBottom: 8 }}>Popis</div>
                  <p style={{ fontSize: 13, color: '#9CA3AF', lineHeight: 1.6, margin: 0 }}>{challenge.description}</p>
                </div>
                <div>
                  <div style={{ fontSize: 11, fontWeight: 600, color: '#6B7280', letterSpacing: '0.5px', textTransform: 'uppercase', marginBottom: 8 }}>Čo treba splniť</div>
                  <ol style={{ margin: 0, padding: '0 0 0 18px', display: 'flex', flexDirection: 'column', gap: 8 }}>
                    {challenge.instructions.map((ins, i) => (
                      <li key={i} style={{ fontSize: 13, color: '#CDD6F4', lineHeight: 1.5 }}>{ins}</li>
                    ))}
                  </ol>
                </div>
                <div>
                  <div style={{ fontSize: 11, fontWeight: 600, color: '#6B7280', letterSpacing: '0.5px', textTransform: 'uppercase', marginBottom: 8 }}>Kritériá hodnotenia</div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                    {ruleSummary.map(rule => (
                      <div key={rule.id} style={{ display: 'flex', alignItems: 'flex-start', gap: 10, padding: '7px 10px', background: '#0F0F1A', borderRadius: 8, border: '1px solid #1E1E38' }}>
                        <span style={{ width: 32, height: 18, background: '#1E1E38', borderRadius: 4, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, fontWeight: 700, color: '#7361FF', flexShrink: 0 }}>{rule.points}b</span>
                        <span style={{ fontSize: 12, color: '#9CA3AF', flex: 1, lineHeight: 1.4 }}>{rule.description}</span>
                      </div>
                    ))}
                  </div>
                  <div style={{ marginTop: 10, fontSize: 11, color: '#6B7280' }}>
                    Min. skóre na splnenie: <span style={{ color: '#7361FF', fontWeight: 700 }}>{challenge.validation.min_score_to_pass}%</span>
                    {' · '}Odmena: <span style={{ color: '#F59E0B', fontWeight: 700 }}>+{challenge.xp_reward} XP</span>
                    {' · '}Celkom bodov: <span style={{ color: '#CDD6F4', fontWeight: 700 }}>{totalPoints}b</span>
                  </div>
                </div>
              </div>
            ) : (
              <div className="ce-codemirror-wrap">
                <CodeMirror
                  key={activeCodeTab}
                  value={currentCode}
                  onChange={setCurrentCode}
                  onCreateEditor={view => { editorViewRef.current = view; }}
                  extensions={[getLang(activeCodeTab), cmDarkTheme, vsCodeHighlight, keymap.of([{ key: 'Tab', run: acceptCompletion }]), ...(activeCodeTab === 'css' ? [cssAutoSemicolon] : [])]}
                  theme="none"
                  minHeight="100vh"
                  basicSetup={{ lineNumbers: true, highlightActiveLine: true, autocompletion: true, foldGutter: false }}
                />
              </div>
            )}
          </div>

          <div
            className={`ce-divider${isDraggingDiv ? ' ce-divider-active' : ''}`}
            onPointerDown={handleDividerPointerDown}
            onPointerMove={handleDividerPointerMove}
            onPointerUp={handleDividerPointerUp}
            onPointerCancel={handleDividerPointerUp}
          />

          <div className="ce-preview-col" ref={previewColRef}>
            {challenge.category === 'javascript' ? (
              <>
                {/* Hidden iframe runs the JS via postMessage interceptor */}
                <iframe
                  ref={previewRef}
                  sandbox="allow-scripts allow-same-origin"
                  style={{ display: 'none' }}
                  title="JS Runner"
                />
                {/* Console panel */}
                <div className="js-console">
                  <div className="js-console-bar">
                    <span className="js-console-bar-label">▶ Console</span>
                    <button
                      onClick={() => setConsoleLines([])}
                      style={{ background: 'none', border: 'none', color: '#6B7280', fontSize: 11, cursor: 'pointer', padding: '2px 8px', fontFamily: 'inherit' }}
                    >
                      Vymazať
                    </button>
                  </div>
                  <div className="js-console-output">
                    {consoleLines.length === 0 && (
                      <span style={{ color: '#4B5563', fontSize: 12, fontStyle: 'italic', padding: '12px 14px', display: 'block' }}>
                        Spusti kód — výstup sa zobrazí tu
                      </span>
                    )}
                    {consoleLines.map((line, i) => (
                      <div key={i} className={`js-console-line js-console-${line.t}`}>{line.text}</div>
                    ))}
                    <div ref={consoleEndRef} />
                  </div>
                </div>
              </>
            ) : (
              <>
                {/* ── Top bar ── */}
                <div className="ce-preview-bar" style={{ justifyContent: 'space-between' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    {compareMode
                      ? <span style={{ fontSize: 11, color: '#7361FF', fontWeight: 700 }}>⟺ POROVNANIE</span>
                      : <><div className="ce-live-dot" /><span className="ce-preview-bar-label">Tvoj výstup</span></>}
                  </div>
                  {hasTarget && (
                    <button
                      onClick={() => setCompareMode(m => !m)}
                      style={{ background: compareMode ? '#7361FF22' : 'none', border: compareMode ? '1px solid #7361FF55' : 'none', borderRadius: 6, color: '#7361FF', fontSize: 11, fontWeight: 600, cursor: 'pointer', padding: '3px 8px' }}
                    >
                      {compareMode ? '✕ Zatvoriť' : '⟺ Porovnať'}
                    </button>
                  )}
                </div>

                {/* ── Shared preview area — iframy sú vždy v DOM ── */}
                <div ref={compareContainerRef} style={{ flex: 1, position: 'relative', overflow: 'hidden' }}>

                  {/* User iframe */}
                  <div style={compareMode
                    ? { position: 'absolute', inset: 0, clipPath: `inset(0 ${100 - sliderPos}% 0 0)` }
                    : { position: 'absolute', top: 0, left: 0, right: 0, bottom: hasTarget ? '50%' : 0, ...(hasTarget && topPreviewHeight !== null ? { bottom: `calc(100% - ${topPreviewHeight}px)` } : {}) }
                  }>
                    <iframe
                      ref={previewRef}
                      className="ce-iframe"
                      sandbox="allow-scripts"
                      title="Tvoj výstup"
                      style={{ width: '100%', height: '100%', pointerEvents: (isDraggingDiv || isDraggingV || isDraggingSlider) ? 'none' : undefined }}
                    />
                  </div>

                  {/* Target iframe */}
                  {hasTarget && (
                    <div style={compareMode
                      ? { position: 'absolute', inset: 0, clipPath: `inset(0 0 0 ${sliderPos}%)` }
                      : { position: 'absolute', bottom: 0, left: 0, right: 0, top: topPreviewHeight !== null ? topPreviewHeight + 4 : '50%' }
                    }>
                      {!compareMode && (
                        <div className="ce-preview-bar">
                          <CheckCircle size={12} color="#10B981" />
                          <span className="ce-preview-bar-label">Cieľový výstup</span>
                        </div>
                      )}
                      <iframe
                        ref={targetRef}
                        className="ce-iframe"
                        sandbox="allow-scripts"
                        title="Cieľový výstup"
                        style={{ width: '100%', height: compareMode ? '100%' : 'calc(100% - 36px)', pointerEvents: (isDraggingDiv || isDraggingV || isDraggingSlider) ? 'none' : undefined }}
                      />
                    </div>
                  )}

                  {/* Vertical resize handle (normal mode) */}
                  {hasTarget && !compareMode && (
                    <div
                      className={`ce-vdivider${isDraggingV ? ' ce-divider-active' : ''}`}
                      style={{ position: 'absolute', left: 0, right: 0, top: topPreviewHeight !== null ? topPreviewHeight : '50%', transform: 'translateY(-50%)' }}
                      onPointerDown={handleVDividerPointerDown}
                      onPointerMove={handleVDividerPointerMove}
                      onPointerUp={handleVDividerPointerUp}
                      onPointerCancel={handleVDividerPointerUp}
                    />
                  )}

                  {/* Compare labels + handle */}
                  {hasTarget && compareMode && (
                    <>
                      <div style={{ position: 'absolute', top: 8, left: 10, fontSize: 10, fontWeight: 700, color: '#fff', background: '#0008', borderRadius: 4, padding: '2px 7px', pointerEvents: 'none', zIndex: 10 }}>MÔJ</div>
                      <div style={{ position: 'absolute', top: 8, right: 10, fontSize: 10, fontWeight: 700, color: '#fff', background: '#0008', borderRadius: 4, padding: '2px 7px', pointerEvents: 'none', zIndex: 10 }}>CIEĽ</div>
                      <div
                        style={{ position: 'absolute', top: 0, bottom: 0, left: `${sliderPos}%`, width: 3, background: '#7361FF', zIndex: 20, cursor: 'col-resize', transform: 'translateX(-50%)' }}
                        onPointerDown={handleSliderPointerDown}
                        onPointerMove={handleSliderPointerMove}
                        onPointerUp={handleSliderPointerUp}
                        onPointerCancel={handleSliderPointerUp}
                      >
                        <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%,-50%)', width: 30, height: 30, borderRadius: '50%', background: '#7361FF', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 2px 8px #0006', fontSize: 14, color: '#fff', userSelect: 'none', cursor: 'col-resize' }}>⟺</div>
                      </div>
                    </>
                  )}
                </div>
              </>
            )}
          </div>
        </div>

        {checkState && (
          <div className={`ce-check-panel ${checkState.open ? 'ce-check-panel-open' : ''}`}>
            <div className="ce-check-header" onClick={() => setCheckState(s => s ? { ...s, open: !s.open } : null)}>
              <span
                className="ce-check-score"
                style={{ color: checkState.passed ? '#10B981' : checkState.score >= 50 ? '#F59E0B' : '#EF4444' }}
              >
                {checkState.score}%
              </span>
              <span className="ce-check-label">
                {checkState.passed
                  ? `Splnené! (min. ${challenge.validation.min_score_to_pass}%)`
                  : `Potrebuješ aspoň ${challenge.validation.min_score_to_pass}% — pokračuj!`}
              </span>
              <button
                style={{ background: 'none', border: 'none', color: '#6B7280', cursor: 'pointer', padding: 4 }}
                onClick={e => { e.stopPropagation(); setCheckState(null); }}
              >
                <X size={16} />
              </button>
              {checkState.open ? <ChevronDown size={16} color="#6B7280" /> : <ChevronUp size={16} color="#6B7280" />}
            </div>
            {checkState.open && (
              <div className="ce-check-items">
                {checkState.checks.filter(r => !r.isPenalty).map(r => (
                  <div key={r.id} className="ce-rule">
                    <div
                      className="ce-rule-icon"
                      style={{ background: r.passed ? 'rgba(16,185,129,0.15)' : 'rgba(239,68,68,0.15)' }}
                    >
                      {r.passed ? <CheckCircle size={12} color="#10B981" /> : <X size={12} color="#EF4444" />}
                    </div>
                    <span className="ce-rule-desc">
                      {r.passed ? r.label : (r.hint ?? r.label)}
                    </span>
                    <span className="ce-rule-pts">
                      {r.earned > 0 ? `+${r.earned}` : `0/${r.points}`} b.
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </>
  );
}
