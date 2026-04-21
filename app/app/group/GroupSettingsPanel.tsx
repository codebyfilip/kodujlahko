'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { X, Save, Globe, Lock, Eye, EyeOff, Crown, UserMinus, Trash2, AlertTriangle, Check } from 'lucide-react';
import { updateGroup, transferOwnership, removeMember, deleteGroup, leaveGroup } from '@/app/actions/groups';
import type { GroupRow, MembershipRow } from '@/app/actions/groups';

interface LeaderboardEntry {
  user_id: string;
  display_name?: string | null;
  email?: string | null;
}

interface Props {
  open: boolean;
  onClose: () => void;
  membership: MembershipRow & { group: GroupRow };
  currentUserId: string;
  members: LeaderboardEntry[];
}

function memberName(e: LeaderboardEntry) {
  return e.display_name || e.email?.split('@')[0] || 'Neznámy';
}

const TYPE_OPTIONS = [
  { value: 'invite_only' as const, label: 'Len pozvaní', icon: <Lock size={14} />, desc: 'Skrytá, vstup cez kód' },
  { value: 'public'      as const, label: 'Verejná',     icon: <Globe size={14} />, desc: 'Viditeľná, voľný vstup' },
];

const PRIVACY_OPTIONS = [
  { value: 'full_detail'     as const, label: 'Plný detail',  icon: <Eye size={14} />,    desc: 'Všetci vidia progres' },
  { value: 'aggregate_only'  as const, label: 'Iba súhrn',    icon: <EyeOff size={14} />, desc: 'Len XP a poradie' },
];

export default function GroupSettingsPanel({ open, onClose, membership, currentUserId, members }: Props) {
  const router = useRouter();
  const group = membership.group;

  // ── Editácia info ──
  const [name, setName] = useState(group.name);
  const [description, setDescription] = useState(group.description ?? '');
  const [rules, setRules] = useState(group.rules ?? '');
  const [type, setType] = useState(group.type);
  const [privacy, setPrivacy] = useState(group.privacy);
  const [maxMembers, setMaxMembers] = useState(group.max_members);
  const [saving, setSaving] = useState(false);
  const [saveOk, setSaveOk] = useState(false);
  const [saveError, setSaveError] = useState('');

  // ── Členovia ──
  const [removingId, setRemovingId] = useState<string | null>(null);
  const [transferTarget, setTransferTarget] = useState<string | null>(null);
  const [confirmTransfer, setConfirmTransfer] = useState(false);
  const [transferring, setTransferring] = useState(false);

  // ── Vymazanie skupiny ──
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);

  // ── Opustenie ──
  const [confirmLeave, setConfirmLeave] = useState(false);
  const [leaving, setLeaving] = useState(false);

  const [actionError, setActionError] = useState('');

  const otherMembers = members.filter(m => m.user_id !== currentUserId);

  async function handleSave() {
    if (!name.trim() || name.trim().length < 2) { setSaveError('Názov musí mať aspoň 2 znaky.'); return; }
    setSaving(true); setSaveError(''); setSaveOk(false);
    const res = await updateGroup(group.id, { name: name.trim(), description, rules, type, privacy, maxMembers });
    setSaving(false);
    if (res.error) { setSaveError(res.error); }
    else { setSaveOk(true); setTimeout(() => setSaveOk(false), 2500); router.refresh(); }
  }

  async function handleRemove(userId: string) {
    setRemovingId(userId); setActionError('');
    const res = await removeMember(group.id, userId);
    setRemovingId(null);
    if (res.error) setActionError(res.error);
    else router.refresh();
  }

  async function handleTransfer() {
    if (!transferTarget) return;
    setTransferring(true); setActionError('');
    const res = await transferOwnership(group.id, transferTarget);
    setTransferring(false);
    if (res.error) { setActionError(res.error); }
    else { setConfirmTransfer(false); setTransferTarget(null); onClose(); router.refresh(); }
  }

  async function handleDelete() {
    setDeleting(true); setActionError('');
    const res = await deleteGroup(group.id);
    setDeleting(false);
    if (res.error) { setActionError(res.error); }
    else { onClose(); router.refresh(); }
  }

  async function handleLeave() {
    setLeaving(true); setActionError('');
    const res = await leaveGroup(group.id);
    setLeaving(false);
    if (res.error) { setActionError(res.error); }
    else { onClose(); router.refresh(); }
  }

  if (!open) return null;

  return (
    <>
      {/* Backdrop */}
      <div
        onClick={onClose}
        style={{ position: 'fixed', inset: 0, zIndex: 300, background: 'rgba(17,17,24,0.4)', backdropFilter: 'blur(4px)', animation: 'gspFadeIn 0.18s ease' }}
      />

      {/* Panel */}
      <div style={{
        position: 'fixed', top: 0, right: 0, bottom: 0, zIndex: 301,
        width: 420, background: 'white',
        boxShadow: '-8px 0 48px rgba(0,0,0,0.14)',
        display: 'flex', flexDirection: 'column',
        animation: 'gspSlideIn 0.22s cubic-bezier(0.34,1.1,0.64,1)',
      }}>

        {/* Header */}
        <div style={{ padding: '20px 24px 16px', borderBottom: '1px solid #F3F4F6', display: 'flex', alignItems: 'center', gap: 12, flexShrink: 0 }}>
          <div style={{ flex: 1 }}>
            <div style={{ fontFamily: 'Nunito,sans-serif', fontWeight: 900, fontSize: 16, color: '#111118' }}>Nastavenia skupiny</div>
            <div style={{ fontSize: 12, color: '#9CA3AF', marginTop: 2 }}>{group.name}</div>
          </div>
          <button onClick={onClose} style={{ width: 32, height: 32, borderRadius: 8, border: '1px solid #E8E6F0', background: 'white', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#9CA3AF' }}>
            <X size={15} />
          </button>
        </div>

        {/* Scrollable content */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: 28 }}>

          {/* ── 1. Základné info ── */}
          <section>
            <SectionTitle>Základné informácie</SectionTitle>

            <Field label="Názov skupiny *">
              <input
                value={name}
                onChange={e => setName(e.target.value)}
                maxLength={50}
                style={inputStyle}
              />
              <div style={{ fontSize: 11, color: '#9CA3AF', marginTop: 4 }}>{name.length}/50</div>
            </Field>

            <Field label="Popis">
              <textarea
                value={description}
                onChange={e => setDescription(e.target.value)}
                maxLength={200}
                rows={3}
                placeholder="Stručne opíš skupinu…"
                style={{ ...inputStyle, resize: 'none' }}
              />
            </Field>

            <Field label="Pravidlá">
              <textarea
                value={rules}
                onChange={e => setRules(e.target.value)}
                maxLength={500}
                rows={4}
                placeholder="Napr. učíme sa každý deň aspoň 15 minút…"
                style={{ ...inputStyle, resize: 'none' }}
              />
            </Field>

            <Field label="Typ skupiny">
              <div style={{ display: 'flex', gap: 8 }}>
                {TYPE_OPTIONS.map(opt => (
                  <button key={opt.value} type="button" onClick={() => setType(opt.value)} style={{
                    flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4,
                    padding: '10px 6px', borderRadius: 12, cursor: 'pointer', fontSize: 11, fontWeight: 600, fontFamily: 'Nunito,sans-serif',
                    border: `2px solid ${type === opt.value ? '#7361FF' : '#E5E7EB'}`,
                    background: type === opt.value ? '#F5F3FF' : 'white',
                    color: type === opt.value ? '#7361FF' : '#6B7280',
                    transition: 'all 0.15s',
                  }}>
                    {opt.icon}
                    <span>{opt.label}</span>
                    <span style={{ fontSize: 9, opacity: 0.7, fontWeight: 400, textAlign: 'center' }}>{opt.desc}</span>
                  </button>
                ))}
              </div>
            </Field>

            <Field label="Viditeľnosť progresu">
              <div style={{ display: 'flex', gap: 8 }}>
                {PRIVACY_OPTIONS.map(opt => (
                  <button key={opt.value} type="button" onClick={() => setPrivacy(opt.value)} style={{
                    flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4,
                    padding: '10px 6px', borderRadius: 12, cursor: 'pointer', fontSize: 11, fontWeight: 600, fontFamily: 'Nunito,sans-serif',
                    border: `2px solid ${privacy === opt.value ? '#7361FF' : '#E5E7EB'}`,
                    background: privacy === opt.value ? '#F5F3FF' : 'white',
                    color: privacy === opt.value ? '#7361FF' : '#6B7280',
                    transition: 'all 0.15s',
                  }}>
                    {opt.icon}
                    <span>{opt.label}</span>
                    <span style={{ fontSize: 9, opacity: 0.7, fontWeight: 400 }}>{opt.desc}</span>
                  </button>
                ))}
              </div>
            </Field>

            <Field label={`Max. členov: ${maxMembers}`}>
              <input type="range" min={Math.max(2, members.length)} max={50} value={maxMembers} onChange={e => setMaxMembers(Number(e.target.value))} style={{ width: '100%', accentColor: '#7361FF' }} />
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: '#9CA3AF', marginTop: 2 }}>
                <span>{Math.max(2, members.length)} (min)</span><span>50</span>
              </div>
            </Field>

            {saveError && <div style={{ fontSize: 12, color: '#EF4444', background: '#FEF2F2', borderRadius: 10, padding: '8px 12px', marginTop: 4 }}>{saveError}</div>}

            <button
              onClick={handleSave}
              disabled={saving || name.trim().length < 2}
              style={{
                width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                padding: '11px 0', borderRadius: 12, border: 'none', cursor: saving ? 'not-allowed' : 'pointer',
                fontFamily: 'Nunito,sans-serif', fontWeight: 800, fontSize: 14,
                background: saveOk ? 'linear-gradient(135deg, #10B981, #34D399)' : 'linear-gradient(135deg, #7361FF, #8C78FF)',
                color: 'white', opacity: saving || name.trim().length < 2 ? 0.6 : 1,
                transition: 'background 0.3s',
                marginTop: 4,
              }}
            >
              {saving ? 'Ukladám…' : saveOk ? <><Check size={15} /> Uložené!</> : <><Save size={14} /> Uložiť zmeny</>}
            </button>
          </section>

          {/* ── 2. Správa členov ── */}
          {otherMembers.length > 0 && (
            <section>
              <SectionTitle>Správa členov</SectionTitle>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {otherMembers.map(m => {
                  const name = memberName(m);
                  const isTransferTarget = transferTarget === m.user_id;
                  return (
                    <div key={m.user_id} style={{
                      display: 'flex', alignItems: 'center', gap: 10,
                      padding: '10px 12px', borderRadius: 12, background: isTransferTarget ? '#F5F3FF' : '#F9FAFB',
                      border: `1.5px solid ${isTransferTarget ? '#C4B5FD' : 'transparent'}`,
                      transition: 'all 0.15s',
                    }}>
                      <div style={{ width: 32, height: 32, borderRadius: '50%', flexShrink: 0, background: 'linear-gradient(135deg, #7361FF, #8C78FF)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 800, color: 'white' }}>
                        {name.charAt(0).toUpperCase()}
                      </div>
                      <span style={{ flex: 1, fontSize: 13, fontWeight: 600, color: '#111118', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{name}</span>
                      <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
                        <button
                          onClick={() => { setTransferTarget(isTransferTarget ? null : m.user_id); setConfirmTransfer(false); }}
                          title="Preniesť vlastníctvo"
                          style={{ padding: '5px 8px', borderRadius: 8, border: `1px solid ${isTransferTarget ? '#7361FF' : '#E5E7EB'}`, background: isTransferTarget ? '#7361FF' : 'white', color: isTransferTarget ? 'white' : '#9CA3AF', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4, fontSize: 11, fontWeight: 600, fontFamily: 'Nunito,sans-serif', transition: 'all 0.15s' }}
                        >
                          <Crown size={11} /> Owner
                        </button>
                        <button
                          onClick={() => handleRemove(m.user_id)}
                          disabled={removingId === m.user_id}
                          title="Odstrániť člena"
                          style={{ padding: '5px 8px', borderRadius: 8, border: '1px solid #FCA5A5', background: 'white', color: '#EF4444', cursor: 'pointer', display: 'flex', alignItems: 'center', opacity: removingId === m.user_id ? 0.5 : 1, transition: 'all 0.15s' }}
                        >
                          <UserMinus size={13} />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Confirm transfer */}
              {transferTarget && !confirmTransfer && (
                <div style={{ marginTop: 10, padding: '12px 14px', background: '#FFFBEB', border: '1.5px solid #FDE68A', borderRadius: 12 }}>
                  <p style={{ fontSize: 12, color: '#92400E', fontWeight: 600, marginBottom: 8 }}>
                    Preniesť skupinu na <strong>{memberName(otherMembers.find(m => m.user_id === transferTarget)!)}</strong>?
                  </p>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <button onClick={() => setConfirmTransfer(true)} style={{ flex: 1, padding: '7px 0', borderRadius: 9, border: 'none', background: '#F59E0B', color: 'white', fontSize: 12, fontWeight: 700, cursor: 'pointer', fontFamily: 'Nunito,sans-serif' }}>
                      Potvrdiť prenos
                    </button>
                    <button onClick={() => { setTransferTarget(null); setConfirmTransfer(false); }} style={{ flex: 1, padding: '7px 0', borderRadius: 9, border: '1px solid #E5E7EB', background: 'white', color: '#6B7280', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>
                      Zrušiť
                    </button>
                  </div>
                </div>
              )}
              {confirmTransfer && (
                <div style={{ marginTop: 10, padding: '12px 14px', background: '#FEF2F2', border: '1.5px solid #FCA5A5', borderRadius: 12 }}>
                  <p style={{ fontSize: 12, color: '#991B1B', fontWeight: 600, marginBottom: 8 }}>
                    Naozaj? Stratíš vlastníctvo skupiny.
                  </p>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <button onClick={handleTransfer} disabled={transferring} style={{ flex: 1, padding: '7px 0', borderRadius: 9, border: 'none', background: '#EF4444', color: 'white', fontSize: 12, fontWeight: 700, cursor: 'pointer', fontFamily: 'Nunito,sans-serif', opacity: transferring ? 0.6 : 1 }}>
                      {transferring ? 'Prenášam…' : 'Áno, preniesť'}
                    </button>
                    <button onClick={() => { setConfirmTransfer(false); setTransferTarget(null); }} style={{ flex: 1, padding: '7px 0', borderRadius: 9, border: '1px solid #E5E7EB', background: 'white', color: '#6B7280', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>
                      Zrušiť
                    </button>
                  </div>
                </div>
              )}
            </section>
          )}

          {/* ── 3. Nebezpečná zóna ── */}
          <section>
            <SectionTitle danger>Nebezpečná zóna</SectionTitle>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {/* Opustiť */}
              {!confirmLeave ? (
                <button onClick={() => setConfirmLeave(true)} style={{ width: '100%', padding: '10px 0', borderRadius: 12, border: '1.5px solid #FCA5A5', background: 'white', color: '#EF4444', fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: 'Nunito,sans-serif' }}>
                  Opustiť skupinu
                </button>
              ) : (
                <div style={{ padding: '12px 14px', background: '#FEF2F2', border: '1.5px solid #FCA5A5', borderRadius: 12 }}>
                  <p style={{ fontSize: 12, color: '#991B1B', fontWeight: 600, marginBottom: 8 }}>
                    {otherMembers.length > 0 ? 'Pred odchodom musíš preniesť vlastníctvo.' : 'Skupina bude vymazaná (si jediný člen).'}
                  </p>
                  {otherMembers.length === 0 && (
                    <div style={{ display: 'flex', gap: 8 }}>
                      <button onClick={handleLeave} disabled={leaving} style={{ flex: 1, padding: '7px 0', borderRadius: 9, border: 'none', background: '#EF4444', color: 'white', fontSize: 12, fontWeight: 700, cursor: 'pointer', fontFamily: 'Nunito,sans-serif', opacity: leaving ? 0.6 : 1 }}>
                        {leaving ? 'Odchádzam…' : 'Áno, odísť'}
                      </button>
                      <button onClick={() => setConfirmLeave(false)} style={{ flex: 1, padding: '7px 0', borderRadius: 9, border: '1px solid #E5E7EB', background: 'white', color: '#6B7280', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>
                        Zrušiť
                      </button>
                    </div>
                  )}
                  {otherMembers.length > 0 && (
                    <button onClick={() => setConfirmLeave(false)} style={{ width: '100%', padding: '7px 0', borderRadius: 9, border: '1px solid #E5E7EB', background: 'white', color: '#6B7280', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>
                      Rozumiem, zrušiť
                    </button>
                  )}
                </div>
              )}

              {/* Vymazať skupinu */}
              {!confirmDelete ? (
                <button onClick={() => setConfirmDelete(true)} style={{ width: '100%', padding: '10px 0', borderRadius: 12, border: '1.5px solid #FCA5A5', background: '#FEF2F2', color: '#DC2626', fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: 'Nunito,sans-serif', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
                  <Trash2 size={14} /> Vymazať skupinu
                </button>
              ) : (
                <div style={{ padding: '12px 14px', background: '#FEF2F2', border: '2px solid #EF4444', borderRadius: 12 }}>
                  <div style={{ display: 'flex', gap: 8, alignItems: 'flex-start', marginBottom: 10 }}>
                    <AlertTriangle size={16} style={{ color: '#EF4444', flexShrink: 0, marginTop: 1 }} />
                    <p style={{ fontSize: 12, color: '#991B1B', fontWeight: 600 }}>
                      Toto sa nedá vrátiť. Všetci členovia budú odstránení a skupina zanikne.
                    </p>
                  </div>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <button onClick={handleDelete} disabled={deleting} style={{ flex: 1, padding: '7px 0', borderRadius: 9, border: 'none', background: '#DC2626', color: 'white', fontSize: 12, fontWeight: 700, cursor: 'pointer', fontFamily: 'Nunito,sans-serif', opacity: deleting ? 0.6 : 1 }}>
                      {deleting ? 'Mažem…' : 'Áno, vymazať'}
                    </button>
                    <button onClick={() => setConfirmDelete(false)} style={{ flex: 1, padding: '7px 0', borderRadius: 9, border: '1px solid #E5E7EB', background: 'white', color: '#6B7280', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>
                      Zrušiť
                    </button>
                  </div>
                </div>
              )}
            </div>
          </section>

          {actionError && (
            <div style={{ fontSize: 12, color: '#EF4444', background: '#FEF2F2', borderRadius: 10, padding: '8px 12px' }}>{actionError}</div>
          )}
        </div>
      </div>

      <style>{`
        @keyframes gspFadeIn  { from { opacity:0 } to { opacity:1 } }
        @keyframes gspSlideIn { from { transform:translateX(100%) } to { transform:translateX(0) } }
      `}</style>
    </>
  );
}

// ── Pomocné komponenty ────────────────────────────────────────────────────────

function SectionTitle({ children, danger }: { children: React.ReactNode; danger?: boolean }) {
  return (
    <div style={{ fontSize: 11, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.06em', color: danger ? '#EF4444' : '#9CA3AF', fontFamily: 'Nunito,sans-serif', marginBottom: 12, display: 'flex', alignItems: 'center', gap: 6 }}>
      {danger && <AlertTriangle size={11} />}
      {children}
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 14 }}>
      <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: '#374151', marginBottom: 6, fontFamily: 'Nunito,sans-serif' }}>{label}</label>
      {children}
    </div>
  );
}

const inputStyle: React.CSSProperties = {
  width: '100%', borderRadius: 10, border: '1.5px solid #E5E7EB',
  padding: '9px 12px', fontSize: 13, color: '#111118', outline: 'none',
  fontFamily: 'inherit', background: 'white', boxSizing: 'border-box',
  transition: 'border-color 0.15s',
};
