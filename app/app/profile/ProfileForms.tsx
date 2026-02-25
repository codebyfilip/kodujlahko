'use client';

import { useState } from 'react';
import Image from 'next/image';
import { User, Lock, Mail, Calendar, Shield, CheckCircle, AlertCircle, Eye, EyeOff, Flame, Zap, BookOpen } from 'lucide-react';
import { updateDisplayName, updatePassword } from '@/app/actions/profile';

interface ProfileFormsProps {
  displayName: string;
  email: string;
  avatar?: string;
  isGoogleUser: boolean;
  joinedDate: string;
  stats: {
    streak: number;
    xp: number;
    completedLessons: number;
  };
}

function initials(name: string) {
  const parts = name.trim().split(' ').filter(Boolean);
  if (!parts.length) return 'U';
  return ((parts[0]?.[0] ?? '') + (parts[1]?.[0] ?? '')).toUpperCase() || 'U';
}

type ToastState = { type: 'success' | 'error'; message: string } | null;

function Toast({ toast, onClose }: { toast: ToastState; onClose: () => void }) {
  if (!toast) return null;
  return (
    <div
      className={`flex items-center gap-3 rounded-xl px-4 py-3 text-sm font-medium transition-all ${
        toast.type === 'success'
          ? 'bg-green-50 border border-green-200 text-green-800'
          : 'bg-red-50 border border-red-200 text-red-800'
      }`}
    >
      {toast.type === 'success' ? (
        <CheckCircle className="w-4 h-4 flex-shrink-0 text-green-600" />
      ) : (
        <AlertCircle className="w-4 h-4 flex-shrink-0 text-red-600" />
      )}
      <span>{toast.message}</span>
      <button onClick={onClose} className="ml-auto text-current opacity-60 hover:opacity-100 transition-opacity">✕</button>
    </div>
  );
}

export default function ProfileForms({
  displayName: initialName,
  email,
  avatar,
  isGoogleUser,
  joinedDate,
  stats,
}: ProfileFormsProps) {
  // Name form
  const [name, setName] = useState(initialName);
  const [nameLoading, setNameLoading] = useState(false);
  const [nameToast, setNameToast] = useState<ToastState>(null);

  // Password form
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [pwLoading, setPwLoading] = useState(false);
  const [pwToast, setPwToast] = useState<ToastState>(null);

  const avatarText = initials(name || email);

  const handleNameSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (nameLoading) return;
    setNameLoading(true);
    setNameToast(null);
    const result = await updateDisplayName(name);
    setNameLoading(false);
    if (result.error) {
      setNameToast({ type: 'error', message: result.error });
    } else {
      setNameToast({ type: 'success', message: 'Meno bolo úspešne aktualizované!' });
    }
  };

  const handlePasswordSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (pwLoading) return;
    if (newPassword !== confirmPassword) {
      setPwToast({ type: 'error', message: 'Heslá sa nezhodujú' });
      return;
    }
    if (newPassword.length < 8) {
      setPwToast({ type: 'error', message: 'Heslo musí mať aspoň 8 znakov' });
      return;
    }
    setPwLoading(true);
    setPwToast(null);
    const result = await updatePassword(newPassword);
    setPwLoading(false);
    if (result.error) {
      setPwToast({ type: 'error', message: result.error });
    } else {
      setPwToast({ type: 'success', message: 'Heslo bolo úspešne zmenené!' });
      setNewPassword('');
      setConfirmPassword('');
    }
  };

  const inputClass =
    'w-full pl-12 pr-4 py-3 rounded-xl bg-gray-50 border border-gray-200 focus:border-[#7361FF] focus:ring-2 focus:ring-[#7361FF]/20 outline-none transition-all text-gray-800 text-sm';

  return (
    <div
      style={{
        fontFamily: "'DM Sans', sans-serif",
        maxWidth: 860,
        margin: '0 auto',
        padding: '56px 24px 100px',
      }}
    >
      {/* ── Profile Hero Card ── */}
      <div
        style={{
          background: 'linear-gradient(135deg, #F5F3FF 0%, #EDE9FF 50%, #F3E8FF 100%)',
          border: '1px solid #DDD6FE',
          borderRadius: 28,
          padding: '36px 40px',
          marginBottom: 28,
          position: 'relative',
          overflow: 'hidden',
        }}
      >
        {/* Decorative blobs */}
        <div
          style={{
            position: 'absolute',
            top: -40,
            right: -40,
            width: 200,
            height: 200,
            borderRadius: '50%',
            background: 'rgba(115,97,255,0.08)',
            pointerEvents: 'none',
          }}
        />
        <div
          style={{
            position: 'absolute',
            bottom: -60,
            left: -20,
            width: 180,
            height: 180,
            borderRadius: '50%',
            background: 'rgba(140,120,255,0.06)',
            pointerEvents: 'none',
          }}
        />

        <div style={{ display: 'flex', alignItems: 'center', gap: 24, flexWrap: 'wrap', position: 'relative' }}>
          {/* Avatar */}
          <div
            style={{
              width: 80,
              height: 80,
              borderRadius: '50%',
              background: 'linear-gradient(135deg, #7361FF, #8C78FF)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: 28,
              fontWeight: 800,
              color: 'white',
              flexShrink: 0,
              boxShadow: '0 8px 24px rgba(115,97,255,0.35)',
              overflow: 'hidden',
              fontFamily: "'Nunito', sans-serif",
            }}
          >
            {avatar ? (
              <Image src={avatar} width={80} height={80} alt={name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
            ) : (
              avatarText
            )}
          </div>

          {/* Info */}
          <div style={{ flex: 1, minWidth: 200 }}>
            <h1
              style={{
                fontFamily: "'Nunito', sans-serif",
                fontSize: 26,
                fontWeight: 900,
                color: '#111',
                margin: '0 0 4px',
                letterSpacing: '-0.02em',
              }}
            >
              {name}
            </h1>
            <p style={{ color: '#6B7280', fontSize: 14, margin: '0 0 10px' }}>{email}</p>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <Calendar style={{ width: 14, height: 14, color: '#7361FF' }} />
              <span style={{ fontSize: 13, color: '#7361FF', fontWeight: 600 }}>
                Člen od {joinedDate}
              </span>
            </div>
          </div>

          {/* Provider badge */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              background: 'white',
              border: '1px solid #E5E7EB',
              borderRadius: 100,
              padding: '8px 16px',
              fontSize: 13,
              fontWeight: 600,
              color: '#374151',
              flexShrink: 0,
            }}
          >
            {isGoogleUser ? (
              <>
                <svg width="16" height="16" viewBox="0 0 24 24">
                  <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                  <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                  <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
                  <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
                </svg>
                Google účet
              </>
            ) : (
              <>
                <Mail style={{ width: 14, height: 14, color: '#7361FF' }} />
                Email účet
              </>
            )}
          </div>
        </div>
      </div>

      {/* ── Stats Strip ── */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(3, 1fr)',
          gap: 16,
          marginBottom: 28,
        }}
      >
        {/* Streak */}
        <div
          style={{
            background: 'linear-gradient(135deg, #FFF7ED, #FFEDD5)',
            border: '1px solid #FED7AA',
            borderRadius: 20,
            padding: '20px 24px',
            display: 'flex',
            alignItems: 'center',
            gap: 14,
          }}
        >
          <div
            style={{
              width: 44,
              height: 44,
              borderRadius: 14,
              background: 'linear-gradient(135deg, #F97316, #FB923C)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
              boxShadow: '0 4px 12px rgba(249,115,22,0.3)',
            }}
          >
            <Flame style={{ width: 22, height: 22, color: 'white' }} />
          </div>
          <div>
            <p style={{ fontSize: 12, color: '#9A3412', fontWeight: 600, margin: '0 0 2px', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Streak</p>
            <p style={{ fontFamily: "'Nunito', sans-serif", fontSize: 22, fontWeight: 900, color: '#9A3412', margin: 0 }}>
              {stats.streak} <span style={{ fontSize: 14, fontWeight: 600 }}>dní</span>
            </p>
          </div>
        </div>

        {/* XP */}
        <div
          style={{
            background: 'linear-gradient(135deg, #F5F3FF, #EDE9FF)',
            border: '1px solid #DDD6FE',
            borderRadius: 20,
            padding: '20px 24px',
            display: 'flex',
            alignItems: 'center',
            gap: 14,
          }}
        >
          <div
            style={{
              width: 44,
              height: 44,
              borderRadius: 14,
              background: 'linear-gradient(135deg, #7361FF, #8C78FF)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
              boxShadow: '0 4px 12px rgba(115,97,255,0.3)',
            }}
          >
            <Zap style={{ width: 22, height: 22, color: 'white' }} />
          </div>
          <div>
            <p style={{ fontSize: 12, color: '#4C1D95', fontWeight: 600, margin: '0 0 2px', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Skúsenosti</p>
            <p style={{ fontFamily: "'Nunito', sans-serif", fontSize: 22, fontWeight: 900, color: '#4C1D95', margin: 0 }}>
              {stats.xp.toLocaleString()} <span style={{ fontSize: 14, fontWeight: 600 }}>XP</span>
            </p>
          </div>
        </div>

        {/* Lessons */}
        <div
          style={{
            background: 'linear-gradient(135deg, #F0FDF4, #DCFCE7)',
            border: '1px solid #A7F3D0',
            borderRadius: 20,
            padding: '20px 24px',
            display: 'flex',
            alignItems: 'center',
            gap: 14,
          }}
        >
          <div
            style={{
              width: 44,
              height: 44,
              borderRadius: 14,
              background: 'linear-gradient(135deg, #10B981, #34D399)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
              boxShadow: '0 4px 12px rgba(16,185,129,0.3)',
            }}
          >
            <BookOpen style={{ width: 22, height: 22, color: 'white' }} />
          </div>
          <div>
            <p style={{ fontSize: 12, color: '#065F46', fontWeight: 600, margin: '0 0 2px', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Lekcie</p>
            <p style={{ fontFamily: "'Nunito', sans-serif", fontSize: 22, fontWeight: 900, color: '#065F46', margin: 0 }}>
              {stats.completedLessons} <span style={{ fontSize: 14, fontWeight: 600 }}>hotových</span>
            </p>
          </div>
        </div>
      </div>

      {/* ── Two column layout ── */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>

        {/* ── Personal info card ── */}
        <div
          style={{
            background: 'white',
            border: '1px solid #E8E6F0',
            borderRadius: 24,
            padding: '28px 32px',
            boxShadow: '0 2px 12px rgba(115,97,255,0.06)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 24 }}>
            <div
              style={{
                width: 36,
                height: 36,
                borderRadius: 10,
                background: 'linear-gradient(135deg, #EDE9FF, #F3E8FF)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <User style={{ width: 18, height: 18, color: '#7361FF' }} />
            </div>
            <div>
              <h2
                style={{
                  fontFamily: "'Nunito', sans-serif",
                  fontSize: 16,
                  fontWeight: 800,
                  color: '#111',
                  margin: 0,
                }}
              >
                Osobné informácie
              </h2>
              <p style={{ fontSize: 12, color: '#9CA3AF', margin: 0 }}>Zmeň si zobrazované meno</p>
            </div>
          </div>

          <form onSubmit={handleNameSave} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: '#374151', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                Zobrazované meno
              </label>
              <div style={{ position: 'relative' }}>
                <User
                  style={{
                    position: 'absolute',
                    left: 14,
                    top: '50%',
                    transform: 'translateY(-50%)',
                    width: 16,
                    height: 16,
                    color: '#9CA3AF',
                  }}
                />
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className={inputClass}
                  placeholder="Tvoje meno"
                  maxLength={50}
                />
              </div>
            </div>

            {nameToast && (
              <Toast toast={nameToast} onClose={() => setNameToast(null)} />
            )}

            <button
              type="submit"
              disabled={nameLoading}
              className="relative inline-flex items-center justify-center px-6 py-3 overflow-hidden font-semibold text-white rounded-xl bg-gradient-to-r from-[#7361FF] to-[#8C78FF] transition-all duration-300 hover:shadow-[0_4px_15px_rgba(115,97,255,0.3)] hover:scale-[1.02] active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100 cursor-pointer text-sm"
              style={{ fontFamily: "'Nunito', sans-serif", fontWeight: 700 }}
            >
              {nameLoading ? 'Ukladám...' : 'Uložiť zmeny'}
            </button>
          </form>
        </div>

        {/* ── Security card ── */}
        <div
          style={{
            background: 'white',
            border: '1px solid #E8E6F0',
            borderRadius: 24,
            padding: '28px 32px',
            boxShadow: '0 2px 12px rgba(115,97,255,0.06)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 24 }}>
            <div
              style={{
                width: 36,
                height: 36,
                borderRadius: 10,
                background: 'linear-gradient(135deg, #EDE9FF, #F3E8FF)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Shield style={{ width: 18, height: 18, color: '#7361FF' }} />
            </div>
            <div>
              <h2
                style={{
                  fontFamily: "'Nunito', sans-serif",
                  fontSize: 16,
                  fontWeight: 800,
                  color: '#111',
                  margin: 0,
                }}
              >
                Zabezpečenie
              </h2>
              <p style={{ fontSize: 12, color: '#9CA3AF', margin: 0 }}>
                {isGoogleUser ? 'Prihlasuješ sa cez Google' : 'Zmeň si heslo'}
              </p>
            </div>
          </div>

          {isGoogleUser ? (
            <div
              style={{
                background: 'linear-gradient(135deg, #F0FDF4, #DCFCE7)',
                border: '1px solid #A7F3D0',
                borderRadius: 16,
                padding: '20px',
                display: 'flex',
                alignItems: 'flex-start',
                gap: 12,
              }}
            >
              <CheckCircle style={{ width: 20, height: 20, color: '#10B981', flexShrink: 0, marginTop: 1 }} />
              <div>
                <p style={{ fontFamily: "'Nunito', sans-serif", fontSize: 14, fontWeight: 700, color: '#065F46', margin: '0 0 4px' }}>
                  Zabezpečené cez Google
                </p>
                <p style={{ fontSize: 13, color: '#047857', margin: 0, lineHeight: 1.5 }}>
                  Tvoj účet je chránený Google autentifikáciou. Zmenu hesla môžeš vykonať priamo v nastaveniach Google.
                </p>
              </div>
            </div>
          ) : (
            <form onSubmit={handlePasswordSave} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: '#374151', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  Nové heslo
                </label>
                <div style={{ position: 'relative' }}>
                  <Lock
                    style={{
                      position: 'absolute',
                      left: 14,
                      top: '50%',
                      transform: 'translateY(-50%)',
                      width: 16,
                      height: 16,
                      color: '#9CA3AF',
                    }}
                  />
                  <input
                    type={showNew ? 'text' : 'password'}
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    className="w-full pl-12 pr-12 py-3 rounded-xl bg-gray-50 border border-gray-200 focus:border-[#7361FF] focus:ring-2 focus:ring-[#7361FF]/20 outline-none transition-all text-gray-800 text-sm"
                    placeholder="Minimálne 8 znakov"
                  />
                  <button
                    type="button"
                    onClick={() => setShowNew(!showNew)}
                    style={{ position: 'absolute', right: 14, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', padding: 0, color: '#9CA3AF' }}
                  >
                    {showNew ? <EyeOff style={{ width: 16, height: 16 }} /> : <Eye style={{ width: 16, height: 16 }} />}
                  </button>
                </div>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: '#374151', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  Potvrdiť heslo
                </label>
                <div style={{ position: 'relative' }}>
                  <Lock
                    style={{
                      position: 'absolute',
                      left: 14,
                      top: '50%',
                      transform: 'translateY(-50%)',
                      width: 16,
                      height: 16,
                      color: '#9CA3AF',
                    }}
                  />
                  <input
                    type={showConfirm ? 'text' : 'password'}
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    className="w-full pl-12 pr-12 py-3 rounded-xl bg-gray-50 border border-gray-200 focus:border-[#7361FF] focus:ring-2 focus:ring-[#7361FF]/20 outline-none transition-all text-gray-800 text-sm"
                    placeholder="Zopakuj nové heslo"
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirm(!showConfirm)}
                    style={{ position: 'absolute', right: 14, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', padding: 0, color: '#9CA3AF' }}
                  >
                    {showConfirm ? <EyeOff style={{ width: 16, height: 16 }} /> : <Eye style={{ width: 16, height: 16 }} />}
                  </button>
                </div>
              </div>

              {/* Password strength indicator */}
              {newPassword.length > 0 && (
                <div>
                  <div style={{ display: 'flex', gap: 4, marginBottom: 4 }}>
                    {[1, 2, 3, 4].map((level) => (
                      <div
                        key={level}
                        style={{
                          flex: 1,
                          height: 4,
                          borderRadius: 100,
                          background:
                            newPassword.length >= level * 3
                              ? level <= 1 ? '#EF4444' : level <= 2 ? '#F59E0B' : level <= 3 ? '#10B981' : '#7361FF'
                              : '#E5E7EB',
                          transition: 'background 0.3s',
                        }}
                      />
                    ))}
                  </div>
                  <p style={{ fontSize: 11, color: '#9CA3AF', margin: 0 }}>
                    {newPassword.length < 4 ? 'Veľmi slabé' : newPassword.length < 7 ? 'Slabé' : newPassword.length < 10 ? 'Dobré' : 'Silné'} heslo
                  </p>
                </div>
              )}

              {pwToast && (
                <Toast toast={pwToast} onClose={() => setPwToast(null)} />
              )}

              <button
                type="submit"
                disabled={pwLoading}
                className="relative inline-flex items-center justify-center px-6 py-3 overflow-hidden font-semibold text-white rounded-xl bg-gradient-to-r from-[#7361FF] to-[#8C78FF] transition-all duration-300 hover:shadow-[0_4px_15px_rgba(115,97,255,0.3)] hover:scale-[1.02] active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100 cursor-pointer text-sm"
                style={{ fontFamily: "'Nunito', sans-serif", fontWeight: 700 }}
              >
                {pwLoading ? 'Mením heslo...' : 'Zmeniť heslo'}
              </button>
            </form>
          )}
        </div>
      </div>

      {/* ── Account info card (full width) ── */}
      <div
        style={{
          background: 'white',
          border: '1px solid #E8E6F0',
          borderRadius: 24,
          padding: '28px 32px',
          marginTop: 20,
          boxShadow: '0 2px 12px rgba(115,97,255,0.06)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 24 }}>
          <div
            style={{
              width: 36,
              height: 36,
              borderRadius: 10,
              background: 'linear-gradient(135deg, #EDE9FF, #F3E8FF)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Mail style={{ width: 18, height: 18, color: '#7361FF' }} />
          </div>
          <div>
            <h2
              style={{
                fontFamily: "'Nunito', sans-serif",
                fontSize: 16,
                fontWeight: 800,
                color: '#111',
                margin: 0,
              }}
            >
              Informácie o účte
            </h2>
            <p style={{ fontSize: 12, color: '#9CA3AF', margin: 0 }}>Tieto údaje nie je možné meniť</p>
          </div>
        </div>

        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(3, 1fr)',
            gap: 16,
          }}
        >
          {[
            { icon: <Mail style={{ width: 16, height: 16, color: '#7361FF' }} />, label: 'Email adresa', value: email },
            {
              icon: <Shield style={{ width: 16, height: 16, color: '#7361FF' }} />,
              label: 'Spôsob prihlásenia',
              value: isGoogleUser ? 'Google OAuth' : 'Email a heslo',
            },
            { icon: <Calendar style={{ width: 16, height: 16, color: '#7361FF' }} />, label: 'Člen od', value: joinedDate },
          ].map((item, i) => (
            <div
              key={i}
              style={{
                background: '#FAFAFA',
                border: '1px solid #F0EDFF',
                borderRadius: 16,
                padding: '16px 18px',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
                {item.icon}
                <span
                  style={{
                    fontSize: 11,
                    fontWeight: 700,
                    color: '#9CA3AF',
                    textTransform: 'uppercase',
                    letterSpacing: '0.05em',
                  }}
                >
                  {item.label}
                </span>
              </div>
              <p
                style={{
                  fontFamily: "'Nunito', sans-serif",
                  fontSize: 14,
                  fontWeight: 700,
                  color: '#374151',
                  margin: 0,
                  wordBreak: 'break-all',
                }}
              >
                {item.value}
              </p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
