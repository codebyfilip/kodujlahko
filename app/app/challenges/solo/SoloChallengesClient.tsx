'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Globe, Palette, Code2, Clock, Zap, ChevronRight, CheckCircle2, TrendingUp, Target } from 'lucide-react';
import type { Challenge, ChallengeProgress } from './page';

type Category = 'all' | 'html' | 'html+css' | 'html+css+js' | 'javascript';
type Difficulty = 'all' | 'easy' | 'medium' | 'hard';
type StatusFilter = 'all' | 'todo' | 'done' | 'improve';

const CATEGORY_LABELS: Record<string, string> = {
  'javascript': 'JavaScript',
  'all': 'Všetky',
  'html': 'HTML',
  'html+css': 'HTML + CSS',
  'html+css+js': 'HTML + CSS + JS',
};
const DIFFICULTY_LABELS: Record<string, string> = {
  'all': 'Všetky',
  'easy': 'Ľahká',
  'medium': 'Stredná',
  'hard': 'Ťažká',
};
const STATUS_LABELS: Record<string, string> = {
  'all': 'Všetky',
  'todo': 'Nedokončené',
  'done': 'Dokončené',
  'improve': 'Zlepšiteľné',
};

const CATEGORY_ICON: Record<string, React.ReactNode> = {
  'javascript': <Code2 size={16} />,
  'html': <Globe size={16} />,
  'html+css': <Palette size={16} />,
  'html+css+js': <Code2 size={16} />,
};
const CATEGORY_COLOR: Record<string, { text: string; bg: string; border: string }> = {
  'javascript': { text: '#B45309', bg: '#FFFBEB', border: '#FDE68A' },
  'html':       { text: '#DC2626', bg: '#FFF4F0', border: '#FECACA' },
  'html+css':   { text: '#2563EB', bg: '#EFF6FF', border: '#BFDBFE' },
  'html+css+js':{ text: '#D97706', bg: '#FFFBEB', border: '#FDE68A' },
};
const DIFFICULTY_DOT: Record<string, string> = {
  easy: '#10B981',
  medium: '#F59E0B',
  hard: '#EF4444',
};
const DIFFICULTY_BG: Record<string, string> = {
  easy: '#F0FDF4',
  medium: '#FFFBEB',
  hard: '#FFF4F0',
};

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
}

function getChallengeStatus(progress: ChallengeProgress | undefined, minScore: number): 'todo' | 'done' | 'improve' {
  if (!progress) return 'todo';
  if (progress.status === 'completed' && progress.best_score >= minScore) return 'done';
  return 'improve';
}

interface Props {
  challenges: Challenge[];
  progressData: Record<string, ChallengeProgress>;
  completed: number;
  totalXP: number;
  totalCount: number;
}

export default function SoloChallengesClient({ challenges, progressData, completed, totalXP, totalCount }: Props) {
  const [cat, setCat] = useState<Category>('all');
  const [diff, setDiff] = useState<Difficulty>('all');
  const [status, setStatus] = useState<StatusFilter>('all');

  const filtered = challenges.filter(c => {
    if (cat !== 'all' && c.category !== cat) return false;
    if (diff !== 'all' && c.difficulty !== diff) return false;
    if (status !== 'all') {
      const s = getChallengeStatus(progressData[c.id], c.validation.min_score_to_pass);
      if (status !== s) return false;
    }
    return true;
  });

  const improvable = challenges.filter(c => getChallengeStatus(progressData[c.id], c.validation.min_score_to_pass) === 'improve').length;

  return (
    <>
      <style>{`
        /* ── Header ── */
        .sh-hero { padding: 48px 0 32px; }
        .sh-breadcrumb { display:flex; align-items:center; gap:8px; font-size:13px; color:var(--muted); margin-bottom:20px; font-family:'Nunito',sans-serif; font-weight:600; }
        .sh-breadcrumb a { color:var(--brand); text-decoration:none; }
        .sh-breadcrumb a:hover { text-decoration:underline; }
        .sh-title { font-family:'Nunito',sans-serif; font-size:clamp(26px,4vw,40px); font-weight:900; letter-spacing:-0.03em; color:var(--text); margin:0 0 8px; }
        .sh-sub { font-size:15px; color:var(--muted); margin:0 0 28px; line-height:1.6; max-width:520px; }

        /* ── Stats row ── */
        .stats-row { display:flex; gap:12px; flex-wrap:wrap; margin-bottom:32px; }
        .stat-pill { display:flex; align-items:center; gap:10px; background:white; border:1px solid var(--border); border-radius:14px; padding:12px 18px; }
        .stat-pill-icon { width:34px; height:34px; border-radius:9px; display:flex; align-items:center; justify-content:center; flex-shrink:0; }
        .stat-pill-val { font-family:'Nunito',sans-serif; font-weight:900; font-size:18px; color:var(--text); line-height:1; }
        .stat-pill-lab { font-size:11px; color:var(--faint); margin-top:2px; }

        /* ── Filter bar ── */
        .filter-group { display:flex; flex-direction:column; gap:10px; margin-bottom:28px; }
        .filter-row { display:flex; align-items:center; gap:8px; flex-wrap:wrap; }
        .filter-label { font-size:12px; font-weight:700; color:var(--muted); font-family:'Nunito',sans-serif; min-width:80px; }
        .pill-btn { display:inline-flex; align-items:center; gap:5px; padding:6px 14px; border-radius:100px; border:1.5px solid var(--border); background:white; font-family:'Nunito',sans-serif; font-size:12px; font-weight:700; color:var(--muted); cursor:pointer; transition:all .15s; white-space:nowrap; }
        .pill-btn:hover { border-color:var(--brand-mid); color:var(--brand); background:var(--brand-light); }
        .pill-btn.active { border-color:var(--brand); background:var(--brand); color:white; }

        /* ── Results count ── */
        .results-row { display:flex; align-items:center; justify-content:space-between; margin-bottom:16px; }
        .results-count { font-family:'Nunito',sans-serif; font-size:13px; font-weight:700; color:var(--brand); background:var(--brand-light); border-radius:100px; padding:4px 12px; }

        /* ── Challenge grid ── */
        .ch-grid { display:grid; grid-template-columns:repeat(auto-fill,minmax(320px,1fr)); gap:12px; }

        /* ── Challenge card ── */
        .ch-card { background:white; border:1.5px solid var(--border); border-radius:20px; padding:22px; text-decoration:none; color:inherit; display:flex; flex-direction:column; gap:0; transition:border-color .18s, box-shadow .18s, transform .18s; position:relative; overflow:hidden; }
        .ch-card:hover { border-color:var(--brand-mid); box-shadow:0 6px 24px rgba(115,97,255,0.10); transform:translateY(-2px); }
        .ch-card.ch-done { border-color:#A7F3D0; border-left:3px solid #10B981; }
        .ch-card.ch-done:hover { border-color:#6EE7B7; box-shadow:0 6px 24px rgba(16,185,129,0.10); }
        .ch-card.ch-improve { border-color:#FDE68A; border-left:3px solid #F59E0B; }
        .ch-card.ch-improve:hover { border-color:#FCD34D; box-shadow:0 6px 24px rgba(245,158,11,0.10); }

        /* card top row */
        .ch-top { display:flex; align-items:center; justify-content:space-between; margin-bottom:14px; }
        .ch-cat-badge { display:inline-flex; align-items:center; gap:5px; padding:4px 10px; border-radius:100px; font-size:11px; font-family:'Nunito',sans-serif; font-weight:800; border:1px solid; }
        .ch-diff { display:flex; align-items:center; gap:5px; font-size:12px; font-weight:600; color:var(--muted); font-family:'Nunito',sans-serif; }
        .ch-diff-dot { width:7px; height:7px; border-radius:50%; flex-shrink:0; }

        /* card body */
        .ch-title { font-family:'Nunito',sans-serif; font-weight:900; font-size:16px; color:var(--text); margin:0 0 6px; line-height:1.3; }
        .ch-desc { font-size:13px; color:var(--muted); line-height:1.5; margin:0 0 16px; display:-webkit-box; -webkit-line-clamp:2; -webkit-box-orient:vertical; overflow:hidden; }

        /* card meta */
        .ch-meta { display:flex; align-items:center; gap:12px; flex-wrap:wrap; margin-bottom:16px; }
        .ch-meta-item { display:flex; align-items:center; gap:4px; font-size:12px; color:var(--muted); font-weight:500; }

        /* card footer */
        .ch-footer { display:flex; align-items:center; justify-content:space-between; margin-top:auto; padding-top:14px; border-top:1px solid var(--border); }
        .ch-xp { display:flex; align-items:center; gap:5px; font-family:'Nunito',sans-serif; font-size:13px; font-weight:800; color:var(--brand); }
        .ch-action { display:inline-flex; align-items:center; gap:5px; font-family:'Nunito',sans-serif; font-size:13px; font-weight:800; color:var(--brand); transition:gap .15s; }
        .ch-card:hover .ch-action { gap:8px; }

        /* done/improve scores */
        .ch-score-row { display:flex; gap:8px; margin-bottom:10px; flex-wrap:wrap; }
        .ch-score-badge { display:flex; align-items:center; gap:4px; padding:3px 10px; border-radius:100px; font-size:11px; font-weight:800; font-family:'Nunito',sans-serif; }
        .ch-score-done { background:#D1FAE5; color:#065F46; }
        .ch-score-time { background:#EDE9FF; color:#5B21B6; }
        .ch-score-improve { background:#FEF3C7; color:#92400E; }
        .ch-score-xp { background:#F0FDF4; color:#166534; }

        /* improve nudge */
        .ch-improve-nudge { font-size:11px; color:#92400E; font-weight:600; margin-bottom:10px; display:flex; align-items:center; gap:4px; }

        /* empty state */
        .empty-state { display:flex; flex-direction:column; align-items:center; justify-content:center; padding:80px 24px; text-align:center; }
        .empty-icon { width:56px; height:56px; border-radius:16px; background:var(--brand-light); display:flex; align-items:center; justify-content:center; margin-bottom:16px; }
        .empty-title { font-family:'Nunito',sans-serif; font-weight:900; font-size:18px; color:var(--text); margin:0 0 8px; }
        .empty-sub { font-size:14px; color:var(--muted); margin:0; }

        @media(max-width:640px) { .ch-grid { grid-template-columns:1fr; } .stats-row { gap:8px; } }
      `}</style>

      {/* Header */}
      <div className="sh-hero">
        <div className="sh-breadcrumb">
          <a href="/app/challenges">Výzvy</a>
          <span>›</span>
          <span>Sólo výzvy</span>
        </div>
        <h1 className="sh-title">Sólo výzvy</h1>
        <p className="sh-sub">Precvič si HTML, CSS a JavaScript na reálnych úlohách. Vlastným tempom, bez tlaku.</p>

        {/* Stats */}
        <div className="stats-row">
          <div className="stat-pill">
            <div className="stat-pill-icon" style={{ background: '#EDE9FF' }}>
              <Target size={16} color="#7361FF" />
            </div>
            <div>
              <div className="stat-pill-val">{completed}<span style={{ fontSize: 13, color: 'var(--faint)', fontWeight: 600 }}>/{totalCount}</span></div>
              <div className="stat-pill-lab">Dokončených</div>
            </div>
          </div>
          <div className="stat-pill">
            <div className="stat-pill-icon" style={{ background: '#FEF3C7' }}>
              <Zap size={16} color="#D97706" />
            </div>
            <div>
              <div className="stat-pill-val">{totalXP}</div>
              <div className="stat-pill-lab">XP získané</div>
            </div>
          </div>
          {improvable > 0 && (
            <div className="stat-pill">
              <div className="stat-pill-icon" style={{ background: '#FFF7ED' }}>
                <TrendingUp size={16} color="#EA580C" />
              </div>
              <div>
                <div className="stat-pill-val">{improvable}</div>
                <div className="stat-pill-lab">Zlepšiteľné</div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Filters */}
      <div className="filter-group">
        <div className="filter-row">
          <span className="filter-label">Kategória</span>
          {(['all', 'html', 'html+css', 'javascript', 'html+css+js'] as Category[]).map(c => (
            <button key={c} className={`pill-btn${cat === c ? ' active' : ''}`} onClick={() => setCat(c)}>
              {c !== 'all' && CATEGORY_ICON[c]}
              {CATEGORY_LABELS[c]}
            </button>
          ))}
        </div>
        <div className="filter-row">
          <span className="filter-label">Obtiažnosť</span>
          {(['all', 'easy', 'medium', 'hard'] as Difficulty[]).map(d => (
            <button key={d} className={`pill-btn${diff === d ? ' active' : ''}`} onClick={() => setDiff(d)}>
              {d !== 'all' && <span style={{ width: 7, height: 7, borderRadius: '50%', background: DIFFICULTY_DOT[d], display: 'inline-block' }} />}
              {DIFFICULTY_LABELS[d]}
            </button>
          ))}
        </div>
        <div className="filter-row">
          <span className="filter-label">Stav</span>
          {(['all', 'todo', 'done', 'improve'] as StatusFilter[]).map(s => (
            <button key={s} className={`pill-btn${status === s ? ' active' : ''}`} onClick={() => setStatus(s)}>
              {STATUS_LABELS[s]}
            </button>
          ))}
        </div>
      </div>

      {/* Results count */}
      <div className="results-row">
        <span className="results-count">{filtered.length} výziev</span>
      </div>

      {/* Grid */}
      {filtered.length === 0 ? (
        <div className="empty-state">
          <div className="empty-icon"><Target size={24} color="#7361FF" /></div>
          <p className="empty-title">Žiadne výzvy</p>
          <p className="empty-sub">Skús zmeniť filtre — možno hľadáš niečo čo ešte nie je dostupné.</p>
        </div>
      ) : (
        <div className="ch-grid">
          {filtered.map(challenge => {
            const progress = progressData[challenge.id];
            const s = getChallengeStatus(progress, challenge.validation.min_score_to_pass);
            const catColor = CATEGORY_COLOR[challenge.category];
            const actionText = s === 'todo' ? 'Spustiť' : s === 'improve' ? 'Zlepšiť' : 'Zopakovať';

            return (
              <Link
                key={challenge.id}
                href={`/app/challenges/solo/${challenge.id}`}
                className={`ch-card${s === 'done' ? ' ch-done' : s === 'improve' ? ' ch-improve' : ''}`}
              >
                {/* Top row */}
                <div className="ch-top">
                  <span
                    className="ch-cat-badge"
                    style={{ color: catColor.text, background: catColor.bg, borderColor: catColor.border }}
                  >
                    {CATEGORY_ICON[challenge.category]}
                    {CATEGORY_LABELS[challenge.category]}
                  </span>
                  <span className="ch-diff">
                    <span className="ch-diff-dot" style={{ background: DIFFICULTY_DOT[challenge.difficulty] }} />
                    {DIFFICULTY_LABELS[challenge.difficulty]}
                  </span>
                </div>

                {/* Title + desc */}
                <h3 className="ch-title">{challenge.title}</h3>
                <p className="ch-desc">{challenge.description}</p>

                {/* Score row (if attempted) */}
                {progress && (
                  <div className="ch-score-row">
                    {s === 'done' ? (
                      <>
                        <span className="ch-score-badge ch-score-done">
                          <CheckCircle2 size={10} /> {progress.best_score}%
                        </span>
                        {progress.best_time_seconds != null && (
                          <span className="ch-score-badge ch-score-time">
                            <Clock size={10} /> {formatTime(progress.best_time_seconds)}
                          </span>
                        )}
                        <span className="ch-score-badge ch-score-xp">
                          <Zap size={10} /> {progress.xp_earned} XP
                        </span>
                      </>
                    ) : (
                      <>
                        <span className="ch-score-badge ch-score-improve">
                          {progress.best_score}% — môžeš zlepšiť
                        </span>
                        {progress.xp_earned < challenge.xp_reward && (
                          <span className="ch-score-badge ch-score-xp">
                            +{challenge.xp_reward - progress.xp_earned} XP ešte možno získať
                          </span>
                        )}
                      </>
                    )}
                  </div>
                )}

                {/* Meta */}
                <div className="ch-meta">
                  <span className="ch-meta-item"><Clock size={12} /> ~{challenge.estimated_minutes} min</span>
                  <span className="ch-meta-item">
                    <span style={{ fontSize: 10, width: 14, height: 14, borderRadius: 4, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', background: DIFFICULTY_BG[challenge.difficulty], color: DIFFICULTY_DOT[challenge.difficulty], fontFamily: 'Nunito', fontWeight: 800 }}>
                      {((challenge.validation.html as {rules?:unknown[]})?.rules?.length ?? 0) + ((challenge.validation.css as {rules?:unknown[]})?.rules?.length ?? 0) + ((challenge.validation.js as {rules?:unknown[]})?.rules?.length ?? 0) + (challenge.validation.css_battle ? 1 : 0)}
                    </span>
                    pravidiel
                  </span>
                </div>

                {/* Footer */}
                <div className="ch-footer">
                  <span className="ch-xp">
                    <Zap size={13} />
                    {s === 'done' ? `${progress!.xp_earned} / ${challenge.xp_reward} XP` : `${challenge.xp_reward} XP`}
                  </span>
                  <span className="ch-action" style={{ color: s === 'improve' ? '#D97706' : s === 'done' ? '#10B981' : 'var(--brand)' }}>
                    {actionText} <ChevronRight size={15} />
                  </span>
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </>
  );
}
