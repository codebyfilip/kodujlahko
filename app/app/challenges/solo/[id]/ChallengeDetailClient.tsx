'use client';

import Link from 'next/link';
import { useState } from 'react';
import {
  Globe, Palette, Code2, Clock, Zap, ChevronRight,
  CheckCircle2, Circle, Trophy, Users, Play,
  RotateCcw, ArrowLeft, TrendingUp,
} from 'lucide-react';
import type { Challenge, ChallengeProgress } from '../page';

const CATEGORY_LABEL: Record<string, string> = {
  'html': 'HTML', 'html+css': 'HTML + CSS', 'html+css+js': 'HTML + CSS + JS', 'javascript': 'JavaScript',
};
const CATEGORY_ICON: Record<string, React.ReactNode> = {
  'html': <Globe size={15} />, 'html+css': <Palette size={15} />, 'html+css+js': <Code2 size={15} />, 'javascript': <Code2 size={15} />,
};
const CATEGORY_COLOR: Record<string, { text: string; bg: string; border: string }> = {
  'html':        { text: '#DC2626', bg: '#FFF4F0', border: '#FECACA' },
  'html+css':    { text: '#2563EB', bg: '#EFF6FF', border: '#BFDBFE' },
  'html+css+js': { text: '#D97706', bg: '#FFFBEB', border: '#FDE68A' },
  'javascript':  { text: '#B45309', bg: '#FFFBEB', border: '#FDE68A' },
};
const DIFFICULTY_LABEL: Record<string, string> = {
  easy: 'Ľahká', medium: 'Stredná', hard: 'Ťažká',
};
const DIFFICULTY_DOT: Record<string, string> = {
  easy: '#10B981', medium: '#F59E0B', hard: '#EF4444',
};

function formatTime(s: number) {
  const m = Math.floor(s / 60);
  const sec = s % 60;
  return `${m}:${sec.toString().padStart(2, '0')}`;
}

function getChallengeState(progress: ChallengeProgress | null, minScore: number): 'todo' | 'improve' | 'done' {
  if (!progress) return 'todo';
  if (progress.status === 'completed' && progress.best_score >= minScore) return 'done';
  return 'improve';
}

interface Props {
  challenge: Challenge;
  progress: ChallengeProgress | null;
  userId: string;
  groupName: string | null;
  groupLeaderboard: { user_id: string; display_name: string | null; best_score: number; best_time_seconds: number | null }[];
  groupAvgScore: number | null;
}

export default function ChallengeDetailClient({ challenge, progress, userId, groupName, groupLeaderboard, groupAvgScore }: Props) {
  const state = getChallengeState(progress, challenge.validation.min_score_to_pass);
  const catColor = CATEGORY_COLOR[challenge.category];

  const myRank = groupLeaderboard.findIndex(e => e.user_id === userId) + 1;
  const medals = ['🥇', '🥈', '🥉'];

  return (
    <>
      <style>{`
        /* ── Layout ── */
        .detail-grid { display:grid; grid-template-columns:1fr 320px; gap:20px; align-items:start; padding:40px 0 0; }
        .detail-main { display:flex; flex-direction:column; gap:20px; }
        .detail-side { display:flex; flex-direction:column; gap:16px; }

        /* ── Breadcrumb ── */
        .breadcrumb { display:flex; align-items:center; gap:8px; font-size:13px; color:var(--muted); margin-bottom:24px; font-family:'Nunito',sans-serif; font-weight:600; }
        .breadcrumb a { color:var(--brand); text-decoration:none; }
        .breadcrumb a:hover { text-decoration:underline; }

        /* ── Header card ── */
        .header-card { background:white; border:1.5px solid var(--border); border-radius:20px; padding:28px; }
        .header-top { display:flex; align-items:center; gap:10px; margin-bottom:20px; flex-wrap:wrap; }
        .cat-badge { display:inline-flex; align-items:center; gap:5px; padding:5px 12px; border-radius:100px; font-size:12px; font-family:'Nunito',sans-serif; font-weight:800; border:1.5px solid; }
        .diff-badge { display:inline-flex; align-items:center; gap:5px; font-size:12px; font-weight:600; color:var(--muted); font-family:'Nunito',sans-serif; }
        .diff-dot { width:7px; height:7px; border-radius:50%; flex-shrink:0; }

        .header-title { font-family:'Nunito',sans-serif; font-weight:900; font-size:clamp(22px,3vw,30px); color:var(--text); margin:0 0 10px; letter-spacing:-0.02em; line-height:1.2; }
        .header-desc { font-size:14px; color:var(--muted); line-height:1.7; margin:0 0 20px; }

        .header-meta { display:flex; gap:16px; flex-wrap:wrap; padding-top:16px; border-top:1px solid var(--border); }
        .meta-item { display:flex; align-items:center; gap:6px; font-size:13px; color:var(--muted); font-weight:500; }
        .meta-item strong { color:var(--text); font-family:'Nunito',sans-serif; font-weight:800; }

        /* ── Checklist ── */
        .checklist-card { background:white; border:1.5px solid var(--border); border-radius:20px; padding:24px; }
        .card-title { font-family:'Nunito',sans-serif; font-weight:900; font-size:15px; color:var(--text); margin:0 0 16px; display:flex; align-items:center; gap:8px; }
        .check-item { display:flex; align-items:flex-start; gap:10px; padding:8px 0; border-bottom:1px solid #F7F7FB; }
        .check-item:last-child { border-bottom:none; padding-bottom:0; }
        .check-icon { flex-shrink:0; margin-top:1px; }
        .check-text { font-size:13px; color:var(--text); line-height:1.5; }
        .check-pts { flex-shrink:0; font-family:'Nunito',sans-serif; font-weight:800; font-size:11px; color:var(--brand); background:var(--brand-light); border-radius:100px; padding:2px 8px; margin-top:1px; }

        /* ── My progress card ── */
        .progress-card { background:white; border:1.5px solid var(--border); border-radius:20px; padding:24px; }
        .score-big { font-family:'Nunito',sans-serif; font-weight:900; font-size:40px; color:var(--text); line-height:1; margin-bottom:4px; }
        .score-label { font-size:12px; color:var(--faint); margin-bottom:16px; }
        .prog-bar-outer { height:8px; background:var(--brand-light); border-radius:100px; overflow:hidden; margin-bottom:16px; }
        .prog-bar-inner { height:100%; border-radius:100px; background:linear-gradient(90deg,var(--brand),var(--brand-2)); transition:width .6s; }
        .mini-stats { display:grid; grid-template-columns:1fr 1fr; gap:8px; }
        .mini-stat { background:var(--bg); border-radius:12px; padding:10px 12px; }
        .mini-stat-val { font-family:'Nunito',sans-serif; font-weight:900; font-size:16px; color:var(--text); }
        .mini-stat-lab { font-size:11px; color:var(--faint); margin-top:2px; }

        /* ── Group panel ── */
        .group-card { background:white; border:1.5px solid var(--border); border-radius:20px; padding:24px; }
        .lb-row { display:flex; align-items:center; gap:10px; padding:8px 10px; border-radius:12px; margin-bottom:4px; }
        .lb-row.me { background:#F5F3FF; border:1.5px solid var(--brand-mid); }
        .lb-rank { font-size:14px; width:24px; text-align:center; flex-shrink:0; font-weight:700; color:var(--faint); }
        .lb-avatar { width:28px; height:28px; border-radius:50%; background:linear-gradient(135deg,var(--brand),var(--brand-2)); display:flex; align-items:center; justify-content:center; font-size:11px; font-weight:800; color:white; flex-shrink:0; }
        .lb-name { flex:1; font-size:13px; font-weight:600; color:var(--text); overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
        .lb-name.me { color:var(--brand); font-weight:800; }
        .lb-score { font-family:'Nunito',sans-serif; font-weight:800; font-size:12px; color:var(--text); flex-shrink:0; }
        .lb-time { font-size:11px; color:var(--faint); flex-shrink:0; margin-left:6px; }
        .group-avg { display:flex; justify-content:space-between; margin-top:12px; padding-top:12px; border-top:1px solid var(--border); font-size:12px; color:var(--faint); }
        .group-avg strong { color:var(--text); font-family:'Nunito',sans-serif; font-weight:800; }

        /* ── No group ── */
        .no-group { background:var(--brand-light); border:1.5px solid var(--brand-mid); border-radius:20px; padding:20px; text-align:center; }
        .no-group-icon { width:40px; height:40px; border-radius:12px; background:white; display:flex; align-items:center; justify-content:center; margin:0 auto 10px; }
        .no-group-text { font-size:13px; color:#5B21B6; line-height:1.5; margin-bottom:12px; }
        .no-group-link { display:inline-flex; align-items:center; gap:4px; font-size:12px; font-weight:700; color:var(--brand); text-decoration:none; font-family:'Nunito',sans-serif; }

        /* ── Action buttons ── */
        .actions { display:flex; flex-direction:column; gap:10px; }
        .btn-primary { display:inline-flex; align-items:center; justify-content:center; gap:8px; width:100%; background:linear-gradient(135deg,var(--brand),var(--brand-2)); color:white; border-radius:14px; padding:14px 20px; font-family:'Nunito',sans-serif; font-weight:800; font-size:15px; text-decoration:none; border:none; cursor:pointer; box-shadow:0 4px 16px rgba(115,97,255,0.35); transition:transform .18s, box-shadow .18s; }
        .btn-primary:hover { transform:translateY(-2px); box-shadow:0 8px 24px rgba(115,97,255,0.45); }
        .btn-secondary { display:inline-flex; align-items:center; justify-content:center; gap:8px; width:100%; background:white; color:var(--brand); border:1.5px solid var(--brand-mid); border-radius:14px; padding:12px 20px; font-family:'Nunito',sans-serif; font-weight:800; font-size:14px; text-decoration:none; cursor:pointer; transition:border-color .15s, background .15s; }
        .btn-secondary:hover { background:var(--brand-light); border-color:var(--brand); }
        .btn-warn { display:inline-flex; align-items:center; justify-content:center; gap:8px; width:100%; background:linear-gradient(135deg,#F59E0B,#D97706); color:white; border-radius:14px; padding:14px 20px; font-family:'Nunito',sans-serif; font-weight:800; font-size:15px; text-decoration:none; border:none; cursor:pointer; box-shadow:0 4px 16px rgba(245,158,11,0.3); transition:transform .18s; }
        .btn-warn:hover { transform:translateY(-2px); }

        /* ── Status banners ── */
        .banner-done { background:#F0FDF4; border:1.5px solid #A7F3D0; border-radius:16px; padding:16px 20px; display:flex; align-items:center; gap:12px; }
        .banner-improve { background:#FFFBEB; border:1.5px solid #FDE68A; border-radius:16px; padding:16px 20px; display:flex; align-items:center; gap:12px; }
        .banner-icon { width:36px; height:36px; border-radius:10px; display:flex; align-items:center; justify-content:center; flex-shrink:0; }
        .banner-title { font-family:'Nunito',sans-serif; font-weight:900; font-size:14px; }
        .banner-sub { font-size:12px; margin-top:2px; }

        @media(max-width:860px) { .detail-grid { grid-template-columns:1fr; } }
      `}</style>

      <div className="detail-grid">
        {/* ── ĽAVÝ STĹPEC ── */}
        <div className="detail-main">

          {/* Header card */}
          <div className="header-card">
            <Link href="/app/challenges/solo" className="breadcrumb" style={{ marginBottom: 16 }}>
              <ArrowLeft size={13} />
              Sólo výzvy
            </Link>
            <div className="header-top">
              <span className="cat-badge" style={{ color: catColor.text, background: catColor.bg, borderColor: catColor.border }}>
                {CATEGORY_ICON[challenge.category]}
                {CATEGORY_LABEL[challenge.category]}
              </span>
              <span className="diff-badge">
                <span className="diff-dot" style={{ background: DIFFICULTY_DOT[challenge.difficulty] }} />
                {DIFFICULTY_LABEL[challenge.difficulty]}
              </span>
              {state === 'done' && (
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 12, fontWeight: 700, color: '#065F46', background: '#D1FAE5', borderRadius: 100, padding: '4px 10px', fontFamily: 'Nunito' }}>
                  <CheckCircle2 size={12} /> Dokončená
                </span>
              )}
            </div>

            <h1 className="header-title">{challenge.title}</h1>
            <p className="header-desc">{challenge.description}</p>

            <div className="header-meta">
              <span className="meta-item"><Clock size={14} /> ~<strong>{challenge.estimated_minutes}</strong> min</span>
              <span className="meta-item"><Zap size={14} /> <strong>{challenge.xp_reward}</strong> XP</span>
              <span className="meta-item">
                <span style={{ width: 14, height: 14, borderRadius: 4, background: 'var(--brand-light)', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, fontWeight: 800, color: 'var(--brand)', fontFamily: 'Nunito' }}>
                  {((challenge.validation.html as {rules?:unknown[]})?.rules?.length ?? 0) + ((challenge.validation.css as {rules?:unknown[]})?.rules?.length ?? 0) + ((challenge.validation.js as {rules?:unknown[]})?.rules?.length ?? 0) + (challenge.validation.css_battle ? 1 : 0)}
                </span>
                pravidiel na splnenie
              </span>
              <span className="meta-item">min. <strong>{challenge.validation.min_score_to_pass}%</strong> na úspech</span>
            </div>
          </div>

          {/* Status banner */}
          {state === 'done' && progress && (
            <div className="banner-done">
              <div className="banner-icon" style={{ background: '#D1FAE5' }}>
                <CheckCircle2 size={18} color="#10B981" />
              </div>
              <div>
                <div className="banner-title" style={{ color: '#065F46' }}>Výborne! Túto výzvu si úspešne dokončil.</div>
                <div className="banner-sub" style={{ color: '#166534' }}>
                  Skóre: {progress.best_score}%
                  {progress.best_time_seconds != null && ` · Čas: ${formatTime(progress.best_time_seconds)}`}
                  {` · ${progress.xp_earned} XP získané`}
                </div>
              </div>
            </div>
          )}

          {state === 'improve' && progress && (
            <div className="banner-improve">
              <div className="banner-icon" style={{ background: '#FEF3C7' }}>
                <TrendingUp size={18} color="#D97706" />
              </div>
              <div>
                <div className="banner-title" style={{ color: '#92400E' }}>Takmer tam — oprav riešenie a zlepši skóre.</div>
                <div className="banner-sub" style={{ color: '#B45309' }}>
                  Tvoje najlepšie skóre: {progress.best_score}% · Potrebuješ {challenge.validation.min_score_to_pass}%
                  {progress.xp_earned < challenge.xp_reward && ` · Môžeš získať ešte +${challenge.xp_reward - progress.xp_earned} XP`}
                </div>
              </div>
            </div>
          )}

          {/* Checklist inštrukcií */}
          <div className="checklist-card">
            <div className="card-title">
              <CheckCircle2 size={16} color="var(--brand)" />
              Čo musíš splniť
            </div>
            {[
              ...((challenge.validation.html as {rules?:{id:string;description?:string;feedback?:string;successLabel?:string;points:number}[]})?.rules ?? []),
              ...((challenge.validation.css as {rules?:{id:string;description?:string;feedback?:string;successLabel?:string;points:number}[]})?.rules ?? []),
              ...((challenge.validation.js as {rules?:{id:string;description?:string;feedback?:string;successLabel?:string;points:number}[]})?.rules ?? []),
              ...(challenge.validation.css_battle ? [{ id: 'css_battle', description: 'Výsledok sa musí vizuálne podobať referenčnému preview.', points: challenge.validation.css_battle_points ?? 40 }] : []),
            ].map((rule) => (
              <div key={rule.id} className="check-item">
                <span className="check-icon">
                  {progress?.status === 'completed'
                    ? <CheckCircle2 size={16} color="#10B981" />
                    : <Circle size={16} color="var(--faint)" />
                  }
                </span>
                <span className="check-text">{(rule as { successLabel?: string; feedback?: string; description?: string }).successLabel || (rule as { feedback?: string; description?: string }).feedback || (rule as { description?: string }).description}</span>
                <span className="check-pts">{rule.points}b</span>
              </div>
            ))}
          </div>
        </div>

        {/* ── PRAVÝ STĹPEC ── */}
        <div className="detail-side">

          {/* Akcie */}
          <div className="actions">
            {state === 'todo' ? (
              <Link href={`/app/challenges/solo/${challenge.id}/editor`} className="btn-primary">
                <Play size={16} fill="white" /> Spustiť výzvu
              </Link>
            ) : state === 'improve' ? (
              <>
                <Link href={`/app/challenges/solo/${challenge.id}/editor`} className="btn-warn">
                  <RotateCcw size={16} /> Zlepšiť riešenie
                </Link>
                <Link href={`/app/challenges/solo/${challenge.id}/editor`} className="btn-secondary">
                  Pokračovať v riešení
                </Link>
              </>
            ) : (
              <>
                <Link href={`/app/challenges/solo/${challenge.id}/editor`} className="btn-secondary">
                  <RotateCcw size={15} /> Zopakovať výzvu
                </Link>
              </>
            )}
          </div>

          {/* Môj postup */}
          {progress && (
            <div className="progress-card">
              <div className="card-title">
                <TrendingUp size={16} color="var(--brand)" /> Môj postup
              </div>
              <div className="score-big">{progress.best_score}<span style={{ fontSize: 20, color: 'var(--faint)' }}>%</span></div>
              <div className="score-label">Najlepšie skóre · {progress.attempts ?? 1}× skúšané</div>
              <div className="prog-bar-outer">
                <div className="prog-bar-inner" style={{ width: `${progress.best_score}%` }} />
              </div>
              <div className="mini-stats">
                <div className="mini-stat">
                  <div className="mini-stat-val">{progress.xp_earned} XP</div>
                  <div className="mini-stat-lab">získané z {challenge.xp_reward}</div>
                </div>
                {progress.best_time_seconds != null && (
                  <div className="mini-stat">
                    <div className="mini-stat-val">{formatTime(progress.best_time_seconds)}</div>
                    <div className="mini-stat-lab">najlepší čas</div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Skupinový leaderboard */}
          {groupName ? (
            <div className="group-card">
              <div className="card-title">
                <Trophy size={16} color="#D97706" /> {groupName}
              </div>

              {groupLeaderboard.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '20px 0' }}>
                  <div style={{ fontSize: 13, color: 'var(--muted)', lineHeight: 1.5 }}>
                    Zatiaľ nikto v tvojej skupine túto výzvu nedokončil.<br />
                    <strong style={{ color: 'var(--brand)' }}>Buď prvý!</strong>
                  </div>
                </div>
              ) : (
                <>
                  {groupLeaderboard.map((entry, idx) => {
                    const isMe = entry.user_id === userId;
                    const name = entry.display_name ?? 'Neznámy';
                    return (
                      <div key={entry.user_id} className={`lb-row${isMe ? ' me' : ''}`}>
                        <span className="lb-rank">{idx < 3 ? medals[idx] : idx + 1}</span>
                        <div className="lb-avatar">{name.charAt(0).toUpperCase()}</div>
                        <span className={`lb-name${isMe ? ' me' : ''}`}>
                          {name}{isMe && <span style={{ fontSize: 10, opacity: 0.7, marginLeft: 4 }}>(ja)</span>}
                        </span>
                        <span className="lb-score">{entry.best_score}%</span>
                        {entry.best_time_seconds != null && (
                          <span className="lb-time">{formatTime(entry.best_time_seconds)}</span>
                        )}
                      </div>
                    );
                  })}

                  {myRank === 0 && (
                    <div style={{ textAlign: 'center', padding: '8px 0', fontSize: 12, color: 'var(--muted)' }}>
                      Nie si ešte v rebríčku — dokonči výzvu!
                    </div>
                  )}

                  <div className="group-avg">
                    <span>Priemer skupiny</span>
                    <strong>{groupAvgScore}%</strong>
                  </div>
                </>
              )}
            </div>
          ) : (
            <div className="no-group">
              <div className="no-group-icon">
                <Users size={20} color="var(--brand)" />
              </div>
              <p className="no-group-text">
                Pridaj sa do skupiny a porovnaj svoje výsledky s ostatnými.
              </p>
              <Link href="/app/group" className="no-group-link">
                Pozrieť skupiny <ChevronRight size={13} />
              </Link>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
