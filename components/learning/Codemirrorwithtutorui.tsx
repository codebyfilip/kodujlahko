'use client';

import React, {
  useCallback,
  useEffect,
  useRef,
  useState,
  KeyboardEvent,
} from 'react';
import CodeMirror, { ReactCodeMirrorRef } from '@uiw/react-codemirror';
import { html } from '@codemirror/lang-html';
import { css } from '@codemirror/lang-css';
import { javascript } from '@codemirror/lang-javascript';
import { EditorView } from '@codemirror/view';

// ─── Types ────────────────────────────────────────────────────────────────────

interface HistoryEntry {
  id: string;
  question: string;
  answer: string;
  selectedCode: string;
  timestamp: Date;
}

interface BubblePos {
  top: number;
  left: number;
}

interface Props {
  initialCode?: string;
  language?: 'html' | 'css' | 'js';
}

// ─── Mock AI ─────────────────────────────────────────────────────────────────

const MOCK_ANSWERS: Array<(code: string, q: string) => string> = [
  (code, q) =>
    `Tento kód ${code.trim().startsWith('<') ? 'je HTML element' : 'je kód'}, ktorý ${q.toLowerCase().includes('prečo') ? 'slúži na definovanie štruktúry obsahu stránky' : 'definuje obsah a štruktúru webového dokumentu'}. ` +
    `Napríklad: \`${code.split('\n')[0].trim().slice(0, 60)}\` hovorí prehliadaču, ako má interpretovať daný obsah.`,
  (code, q) =>
    `Označený kód ukazuje ${code.includes('=') ? 'atribúty HTML elementu' : 'základnú HTML syntax'}. ` +
    `${q.toLowerCase().includes('ako') ? 'Funguje tak, že prehliadač prečíta tagy a vykreslí zodpovedajúci obsah.' : 'Každý tag má otváraciu a zatváraciu variantu, pričom obsah je medzi nimi.'}`,
  (code) =>
    `Toto je príklad správnej HTML praxe — ${code.includes('alt') ? 'atribút alt zlepšuje prístupnosť pre čítačky obrazovky' : code.includes('class') ? 'class atribút umožňuje CSS štýlovanie' : 'semantické tagy zlepšujú SEO a prístupnosť'}. ` +
    `Odporúčam vždy používať takúto štruktúru v reálnych projektoch.`,
];

function generateMockAnswer(selectedText: string, question: string): string {
  const idx = Math.floor(Math.random() * MOCK_ANSWERS.length);
  return MOCK_ANSWERS[idx](selectedText, question);
}

// ─── Language extensions ──────────────────────────────────────────────────────

function getLangExtension(lang: 'html' | 'css' | 'js') {
  if (lang === 'css') return css();
  if (lang === 'js') return javascript({ jsx: false });
  return html();
}

// ─── Custom CM theme ─────────────────────────────────────────────────────────

const tutorTheme = EditorView.theme({
  '&': {
    fontSize: '13.5px',
    fontFamily: '"JetBrains Mono", "Fira Code", monospace',
    backgroundColor: '#1A1A2E',
    color: '#CDD6F4',
    borderRadius: '0 0 16px 16px',
  },
  '.cm-content': { padding: '16px 20px', minHeight: '220px' },
  '.cm-focused': { outline: 'none' },
  '.cm-line': { lineHeight: '1.7' },
  '.cm-cursor': { borderLeftColor: '#7361FF', borderLeftWidth: '2px' },
  '.cm-selectionBackground, &.cm-focused .cm-selectionBackground': {
    backgroundColor: 'rgba(115, 97, 255, 0.35) !important',
  },
  '.cm-gutters': {
    backgroundColor: '#14142A',
    borderRight: '1px solid #2D2D3F',
    color: '#555570',
  },
  '.cm-activeLineGutter': { backgroundColor: '#1E1E38' },
  '.cm-activeLine': { backgroundColor: 'rgba(115,97,255,0.06)' },
  '.cm-scroller': { overflow: 'auto' },
});

// ─── Component ────────────────────────────────────────────────────────────────

const DEFAULT_HTML = `<!doctype html>
<html lang="sk">
  <head>
    <meta charset="UTF-8">
    <title>Moja stránka</title>
  </head>
  <body>
    <h1>Vitaj na KóduĽahko</h1>
    <p>Označ <strong>ľubovoľný text</strong> alebo tag
       a opýtaj sa AI tutora!</p>
  </body>
</html>`;

export default function CodeMirrorWithTutorUI({
  initialCode = DEFAULT_HTML,
  language = 'html',
}: Props) {
  const cmRef = useRef<ReactCodeMirrorRef>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const [code, setCode] = useState(initialCode);

  // Bubble
  const [bubblePos, setBubblePos] = useState<BubblePos | null>(null);
  const [selectedText, setSelectedText] = useState('');
  const [showBubble, setShowBubble] = useState(false);

  // Panel
  const [showPanel, setShowPanel] = useState(false);
  const [question, setQuestion] = useState('');
  const [loading, setLoading] = useState(false);
  const [answer, setAnswer] = useState('');

  // History
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [showHistory, setShowHistory] = useState(false);

  // ── Detect selection ────────────────────────────────────────────────────────
  const handleSelectionChange = useCallback(() => {
    const view = cmRef.current?.view;
    if (!view) return;

    const { state } = view;
    const sel = state.selection.main;

    if (sel.empty) {
      setShowBubble(false);
      setSelectedText('');
      return;
    }

    const text = state.sliceDoc(sel.from, sel.to);
    if (!text.trim()) {
      setShowBubble(false);
      return;
    }

    setSelectedText(text);

    // Get pixel coords of selection end (or start if end not visible)
    const coords =
      view.coordsAtPos(sel.to) ?? view.coordsAtPos(sel.from);

    if (!coords || !containerRef.current) {
      // Fallback: top-right of editor
      setBubblePos({ top: 8, left: (containerRef.current?.offsetWidth ?? 400) - 200 });
      setShowBubble(true);
      return;
    }

    const containerRect = containerRef.current.getBoundingClientRect();
    setBubblePos({
      top: coords.top - containerRect.top - 44, // above selection
      left: Math.min(
        coords.left - containerRect.left,
        (containerRef.current.offsetWidth ?? 400) - 220
      ),
    });
    setShowBubble(true);
  }, []);

  // ── Attach CM event listener ────────────────────────────────────────────────
  const onEditorCreate = useCallback(
    (view: EditorView) => {
      // Use DOM mouseup / keyup to trigger check
      const check = () => setTimeout(handleSelectionChange, 50);
      view.dom.addEventListener('mouseup', check);
      view.dom.addEventListener('keyup', check);
    },
    [handleSelectionChange]
  );

  // ── Keyboard shortcuts ──────────────────────────────────────────────────────
  useEffect(() => {
    const handler = (e: globalThis.KeyboardEvent) => {
      if (e.key === 'Escape') {
        setShowPanel(false);
        setShowBubble(false);
      }
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        if (selectedText.trim()) {
          openPanel();
        }
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [selectedText]);

  // Focus textarea when panel opens
  useEffect(() => {
    if (showPanel) {
      setTimeout(() => textareaRef.current?.focus(), 80);
    }
  }, [showPanel]);

  // ── Actions ─────────────────────────────────────────────────────────────────
  const openPanel = () => {
    setAnswer('');
    setQuestion('');
    setShowPanel(true);
    setShowBubble(false);
    setShowHistory(false);
  };

  const closePanel = () => {
    setShowPanel(false);
    setAnswer('');
    setQuestion('');
  };

  const handleSubmit = async () => {
    if (!question.trim()) return;
    setLoading(true);
    setAnswer('');
    await new Promise((r) => setTimeout(r, 800));
    const resp = generateMockAnswer(selectedText, question);
    setAnswer(resp);
    setLoading(false);
    setHistory((prev) =>
      [
        {
          id: Date.now().toString(),
          question,
          answer: resp,
          selectedCode: selectedText,
          timestamp: new Date(),
        },
        ...prev,
      ].slice(0, 3)
    );
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  // ── Render ───────────────────────────────────────────────────────────────────
  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Nunito:wght@700;800;900&family=Sora:wght@400;500;600&family=JetBrains+Mono:wght@400;500&display=swap');

        .tutor-root { position: relative; font-family: 'Sora', sans-serif; }

        /* ── Editor chrome ── */
        .editor-chrome {
          border-radius: 16px;
          overflow: hidden;
          border: 1px solid #2D2D3F;
          box-shadow: 0 8px 32px rgba(0,0,0,0.18);
        }

        .editor-topbar {
          background: #14142A;
          padding: 10px 16px;
          display: flex;
          align-items: center;
          justify-content: space-between;
          border-bottom: 1px solid #2D2D3F;
        }

        .editor-dots { display: flex; gap: 6px; }
        .editor-dot {
          width: 12px; height: 12px; border-radius: 50%;
        }

        .editor-lang-badge {
          font-family: 'JetBrains Mono', monospace;
          font-size: 11px;
          font-weight: 500;
          color: #7C6AF7;
          letter-spacing: 0.08em;
          text-transform: uppercase;
        }

        .editor-hint {
          font-size: 11px;
          color: #555570;
          font-weight: 500;
          display: flex;
          align-items: center;
          gap: 6px;
        }

        .kbd {
          background: rgba(255,255,255,0.08);
          border: 1px solid rgba(255,255,255,0.12);
          border-radius: 5px;
          padding: 1px 6px;
          font-family: 'JetBrains Mono', monospace;
          font-size: 10px;
          color: #8888AA;
        }

        /* ── Floating bubble ── */
        .ai-bubble {
          position: absolute;
          z-index: 50;
          display: flex;
          align-items: center;
          gap: 4px;
          background: white;
          border: 1.5px solid #E8E6F0;
          border-radius: 100px;
          padding: 5px 6px;
          box-shadow: 0 4px 20px rgba(115,97,255,0.15), 0 2px 8px rgba(0,0,0,0.08);
          animation: bubblePop 0.15s cubic-bezier(0.34,1.56,0.64,1) both;
          pointer-events: all;
        }

        @keyframes bubblePop {
          from { opacity: 0; transform: scale(0.8) translateY(4px); }
          to   { opacity: 1; transform: scale(1) translateY(0); }
        }

        .bubble-btn {
          display: flex;
          align-items: center;
          gap: 5px;
          border: none;
          border-radius: 100px;
          padding: 5px 11px;
          font-family: 'Nunito', sans-serif;
          font-size: 12px;
          font-weight: 800;
          cursor: pointer;
          transition: all 0.15s;
          white-space: nowrap;
        }

        .bubble-btn-primary {
          background: linear-gradient(135deg, #7361FF, #8C78FF);
          color: white;
          box-shadow: 0 2px 10px rgba(115,97,255,0.35);
        }

        .bubble-btn-primary:hover {
          transform: translateY(-1px);
          box-shadow: 0 4px 14px rgba(115,97,255,0.5);
        }

        .bubble-btn-ghost {
          background: #F5F3FF;
          color: #7361FF;
        }

        .bubble-btn-ghost:hover { background: #EDE9FF; }

        .bubble-sep {
          width: 1px; height: 18px;
          background: #E8E6F0;
          margin: 0 2px;
        }

        .bubble-close {
          width: 24px; height: 24px;
          border-radius: 50%;
          border: none;
          background: transparent;
          color: #9CA3AF;
          font-size: 14px;
          cursor: pointer;
          display: flex; align-items: center; justify-content: center;
          transition: background 0.15s, color 0.15s;
        }

        .bubble-close:hover { background: #F3F4F6; color: #374151; }

        /* ── AI Panel ── */
        .ai-panel-overlay {
          position: fixed;
          inset: 0;
          z-index: 200;
          display: flex;
          align-items: center;
          justify-content: center;
          background: rgba(17,17,24,0.45);
          backdrop-filter: blur(4px);
          animation: fadeIn 0.15s ease both;
          padding: 20px;
        }

        @keyframes fadeIn {
          from { opacity: 0; }
          to   { opacity: 1; }
        }

        .ai-panel {
          background: white;
          border-radius: 24px;
          box-shadow: 0 24px 64px rgba(0,0,0,0.18), 0 0 0 1px rgba(115,97,255,0.08);
          width: 100%;
          max-width: 520px;
          overflow: hidden;
          animation: panelSlide 0.2s cubic-bezier(0.34,1.2,0.64,1) both;
        }

        @keyframes panelSlide {
          from { opacity: 0; transform: translateY(12px) scale(0.97); }
          to   { opacity: 1; transform: translateY(0) scale(1); }
        }

        .panel-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 20px 24px 16px;
          border-bottom: 1px solid #F3F4F6;
        }

        .panel-title-wrap { display: flex; align-items: center; gap: 10px; }

        .panel-icon {
          width: 36px; height: 36px;
          border-radius: 12px;
          background: linear-gradient(135deg, #7361FF, #8C78FF);
          display: flex; align-items: center; justify-content: center;
          font-size: 16px;
        }

        .panel-title {
          font-family: 'Nunito', sans-serif;
          font-size: 16px;
          font-weight: 900;
          color: #111118;
          margin: 0;
          letter-spacing: -0.01em;
        }

        .panel-sub {
          font-size: 12px;
          color: #9CA3AF;
          margin: 0;
        }

        .panel-header-actions { display: flex; align-items: center; gap: 8px; }

        .panel-history-btn {
          display: flex; align-items: center; gap: 5px;
          border: 1px solid #E8E6F0;
          border-radius: 8px;
          background: white;
          padding: 5px 10px;
          font-size: 12px;
          font-weight: 700;
          font-family: 'Nunito', sans-serif;
          color: #6B7280;
          cursor: pointer;
          transition: all 0.15s;
        }
        .panel-history-btn:hover { border-color: #C4B5FD; color: #7361FF; background: #F5F3FF; }

        .panel-close-btn {
          width: 32px; height: 32px;
          border-radius: 10px;
          border: 1px solid #E8E6F0;
          background: white;
          color: #9CA3AF;
          font-size: 16px;
          cursor: pointer;
          display: flex; align-items: center; justify-content: center;
          transition: all 0.15s;
        }
        .panel-close-btn:hover { border-color: #EF4444; color: #EF4444; background: #FEF2F2; }

        /* Selected code preview */
        .panel-body { padding: 20px 24px; display: flex; flex-direction: column; gap: 16px; }

        .selected-preview {
          background: #1A1A2E;
          border-radius: 12px;
          overflow: hidden;
        }

        .selected-preview-header {
          padding: 8px 12px;
          background: #14142A;
          border-bottom: 1px solid #2D2D3F;
          display: flex;
          align-items: center;
          justify-content: space-between;
        }

        .selected-preview-label {
          font-size: 11px;
          font-family: 'JetBrains Mono', monospace;
          color: #7C6AF7;
          letter-spacing: 0.06em;
          text-transform: uppercase;
        }

        .selected-preview-code {
          padding: 12px 14px;
          font-family: 'JetBrains Mono', monospace;
          font-size: 12px;
          color: #CDD6F4;
          line-height: 1.6;
          white-space: pre-wrap;
          word-break: break-all;
          max-height: 100px;
          overflow-y: auto;
        }

        /* Question input */
        .question-label {
          font-family: 'Nunito', sans-serif;
          font-size: 12px;
          font-weight: 800;
          color: #374151;
          text-transform: uppercase;
          letter-spacing: 0.05em;
          display: block;
          margin-bottom: 6px;
        }

        .question-textarea {
          width: 100%;
          border: 1.5px solid #E8E6F0;
          border-radius: 12px;
          padding: 12px 14px;
          font-family: 'Sora', sans-serif;
          font-size: 14px;
          color: #111118;
          background: white;
          resize: none;
          min-height: 72px;
          outline: none;
          transition: border-color 0.15s, box-shadow 0.15s;
          line-height: 1.5;
        }

        .question-textarea::placeholder { color: #C4B5FD; }

        .question-textarea:focus {
          border-color: #7361FF;
          box-shadow: 0 0 0 3px rgba(115,97,255,0.12);
        }

        .question-hint {
          font-size: 11px;
          color: #9CA3AF;
          margin-top: 4px;
          display: flex;
          align-items: center;
          gap: 4px;
        }

        /* Panel actions */
        .panel-actions {
          display: flex;
          gap: 8px;
          padding: 0 24px 20px;
        }

        .panel-btn {
          flex: 1;
          padding: 12px;
          border-radius: 12px;
          border: none;
          font-family: 'Nunito', sans-serif;
          font-weight: 800;
          font-size: 14px;
          cursor: pointer;
          transition: all 0.15s;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 6px;
        }

        .panel-btn-primary {
          background: linear-gradient(135deg, #7361FF, #8C78FF);
          color: white;
          box-shadow: 0 4px 14px rgba(115,97,255,0.3);
        }

        .panel-btn-primary:hover:not(:disabled) {
          transform: translateY(-1px);
          box-shadow: 0 6px 20px rgba(115,97,255,0.4);
        }

        .panel-btn-primary:disabled {
          opacity: 0.55;
          cursor: not-allowed;
        }

        .panel-btn-ghost {
          background: #F9FAFB;
          border: 1.5px solid #E8E6F0;
          color: #6B7280;
        }

        .panel-btn-ghost:hover { background: #F3F4F6; color: #374151; }

        /* Answer */
        .answer-wrap {
          margin: 0 24px 20px;
          border-radius: 14px;
          overflow: hidden;
          border: 1px solid #E8E6F0;
          animation: fadeUp 0.2s ease both;
        }

        @keyframes fadeUp {
          from { opacity: 0; transform: translateY(8px); }
          to   { opacity: 1; transform: translateY(0); }
        }

        .answer-header {
          padding: 10px 14px;
          background: linear-gradient(135deg, #F5F3FF, #FDF4FF);
          border-bottom: 1px solid #EDE9FF;
          display: flex;
          align-items: center;
          gap: 7px;
          font-family: 'Nunito', sans-serif;
          font-size: 12px;
          font-weight: 800;
          color: #7361FF;
          text-transform: uppercase;
          letter-spacing: 0.05em;
        }

        .answer-text {
          padding: 14px;
          font-size: 14px;
          color: #374151;
          line-height: 1.7;
          background: white;
        }

        /* Loading */
        .loading-dots {
          display: flex;
          align-items: center;
          gap: 5px;
          padding: 20px 14px;
          background: white;
        }

        .loading-dot {
          width: 7px; height: 7px;
          border-radius: 50%;
          background: #7361FF;
          animation: dotBounce 0.9s infinite ease-in-out both;
        }
        .loading-dot:nth-child(2) { animation-delay: 0.15s; }
        .loading-dot:nth-child(3) { animation-delay: 0.3s; }

        @keyframes dotBounce {
          0%, 80%, 100% { transform: scale(0.6); opacity: 0.4; }
          40%            { transform: scale(1);   opacity: 1; }
        }

        /* History */
        .history-section {
          border-top: 1px solid #F3F4F6;
          animation: fadeUp 0.15s ease both;
        }

        .history-header {
          padding: 12px 24px;
          font-family: 'Nunito', sans-serif;
          font-size: 11px;
          font-weight: 800;
          color: #9CA3AF;
          text-transform: uppercase;
          letter-spacing: 0.06em;
        }

        .history-item {
          padding: 12px 24px;
          border-top: 1px solid #F9FAFB;
          cursor: pointer;
          transition: background 0.12s;
        }
        .history-item:hover { background: #FAFAFA; }

        .history-q {
          font-size: 13px;
          font-weight: 600;
          color: #374151;
          margin-bottom: 3px;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }

        .history-a {
          font-size: 12px;
          color: #9CA3AF;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }

        .history-empty {
          padding: 16px 24px;
          font-size: 13px;
          color: #C4B5FD;
          text-align: center;
        }

        .history-pb { padding-bottom: 8px; }
      `}</style>

      <div className="tutor-root" ref={containerRef}>

        {/* ── Editor chrome ── */}
        <div className="editor-chrome">
          <div className="editor-topbar">
            <div className="editor-dots">
              <div className="editor-dot" style={{ background: '#FF5F57' }} />
              <div className="editor-dot" style={{ background: '#FFBD2E' }} />
              <div className="editor-dot" style={{ background: '#28C840' }} />
            </div>
            <span className="editor-lang-badge">{language}</span>
            <div className="editor-hint">
              <span>Označ kód</span>
              <span className="kbd">⌘K</span>
              <span>Ask AI</span>
            </div>
          </div>

          <CodeMirror
            ref={cmRef}
            value={code}
            onChange={setCode}
            extensions={[getLangExtension(language), tutorTheme]}
            onCreateEditor={onEditorCreate}
            basicSetup={{
              lineNumbers: true,
              highlightActiveLine: true,
              highlightSelectionMatches: true,
              autocompletion: false,
              foldGutter: false,
            }}
            theme="none"
          />
        </div>

        {/* ── Floating bubble ── */}
        {showBubble && bubblePos && (
          <div
            className="ai-bubble"
            style={{ top: bubblePos.top, left: bubblePos.left }}
          >
            <button
              className="bubble-btn bubble-btn-primary"
              onClick={openPanel}
            >
              ✨ Ask AI
            </button>
            <div className="bubble-sep" />
            <button
              className="bubble-btn bubble-btn-ghost"
              onClick={() => {
                setQuestion('Vysvetli mi tento kód.');
                openPanel();
              }}
            >
              Explain
            </button>
            <div className="bubble-sep" />
            <button
              className="bubble-close"
              onClick={() => setShowBubble(false)}
              title="Zavrieť"
            >
              ×
            </button>
          </div>
        )}

        {/* ── AI Panel ── */}
        {showPanel && (
          <div
            className="ai-panel-overlay"
            onClick={(e) => { if (e.target === e.currentTarget) closePanel(); }}
          >
            <div className="ai-panel" ref={panelRef}>

              {/* Header */}
              <div className="panel-header">
                <div className="panel-title-wrap">
                  <div className="panel-icon">✨</div>
                  <div>
                    <p className="panel-title">AI Tutor</p>
                    <p className="panel-sub">Spýtaj sa na označený kód</p>
                  </div>
                </div>
                <div className="panel-header-actions">
                  {history.length > 0 && (
                    <button
                      className="panel-history-btn"
                      onClick={() => setShowHistory(h => !h)}
                    >
                      🕐 História ({history.length})
                    </button>
                  )}
                  <button className="panel-close-btn" onClick={closePanel} title="Zavrieť (ESC)">
                    ×
                  </button>
                </div>
              </div>

              {/* History panel */}
              {showHistory && (
                <div className="history-section">
                  <div className="history-header">Posledné otázky</div>
                  {history.length === 0 ? (
                    <div className="history-empty">Zatiaľ žiadne otázky</div>
                  ) : (
                    <div className="history-pb">
                      {history.map(h => (
                        <div
                          key={h.id}
                          className="history-item"
                          onClick={() => {
                            setQuestion(h.question);
                            setAnswer(h.answer);
                            setShowHistory(false);
                          }}
                        >
                          <div className="history-q">❓ {h.question}</div>
                          <div className="history-a">{h.answer}</div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* Body */}
              <div className="panel-body">
                {/* Selected code preview */}
                <div>
                  <span className="question-label">Označený kód</span>
                  <div className="selected-preview">
                    <div className="selected-preview-header">
                      <span className="selected-preview-label">
                        {language} · {selectedText.split('\n').length} riadok
                      </span>
                    </div>
                    <div className="selected-preview-code">
                      {selectedText || '(žiadny text neoznačený)'}
                    </div>
                  </div>
                </div>

                {/* Question */}
                <div>
                  <label className="question-label" htmlFor="ai-question">
                    Tvoja otázka
                  </label>
                  <textarea
                    id="ai-question"
                    ref={textareaRef}
                    className="question-textarea"
                    placeholder="Napr. Prečo tento tag potrebuje atribút alt? Čo robí tento element?..."
                    value={question}
                    onChange={e => setQuestion(e.target.value)}
                    onKeyDown={handleKeyDown}
                    rows={3}
                  />
                  <div className="question-hint">
                    <span className="kbd">Enter</span> odoslať
                    <span style={{ marginLeft: 4 }}>·</span>
                    <span className="kbd">Shift+Enter</span> nový riadok
                  </div>
                </div>
              </div>

              {/* Answer */}
              {(loading || answer) && (
                <div className="answer-wrap">
                  <div className="answer-header">
                    ✨ AI odpoveď
                  </div>
                  {loading ? (
                    <div className="loading-dots">
                      <div className="loading-dot" />
                      <div className="loading-dot" />
                      <div className="loading-dot" />
                    </div>
                  ) : (
                    <div className="answer-text">{answer}</div>
                  )}
                </div>
              )}

              {/* Actions */}
              <div className="panel-actions">
                <button
                  className="panel-btn panel-btn-primary"
                  onClick={handleSubmit}
                  disabled={loading || !question.trim()}
                >
                  {loading ? '⏳ Generujem...' : '✨ Odoslať'}
                </button>
                <button
                  className="panel-btn panel-btn-ghost"
                  onClick={closePanel}
                >
                  Zrušiť
                </button>
              </div>

            </div>
          </div>
        )}
      </div>
    </>
  );
}