'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Users, Lock, Globe, Eye, EyeOff, ArrowRight, Copy, Check } from 'lucide-react';
import { createGroup } from '@/app/actions/groups';

type GroupType = 'public' | 'invite_only';
type GroupPrivacy = 'full_detail' | 'aggregate_only';

export default function GroupCreateForm() {
  const router = useRouter();

  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [rules, setRules] = useState('');
  const [type, setType] = useState<GroupType>('invite_only');
  const [privacy, setPrivacy] = useState<GroupPrivacy>('full_detail');
  const [maxMembers, setMaxMembers] = useState(10);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [created, setCreated] = useState<{ joinCode: string } | null>(null);
  const [copied, setCopied] = useState(false);

  async function handleSubmit(e: React.SyntheticEvent<HTMLFormElement>) {
    e.preventDefault();
    setError('');
    setLoading(true);
    const result = await createGroup({ name, description, rules, type, privacy, maxMembers });
    setLoading(false);
    if (result.error) {
      setError(result.error);
    } else if (result.joinCode) {
      setCreated({ joinCode: result.joinCode });
    }
  }

  function copyCode() {
    if (!created) return;
    navigator.clipboard.writeText(created.joinCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  if (created) {
    return (
      <div className="max-w-md mx-auto px-6 py-16 text-center">
        <div
          className="inline-flex items-center justify-center w-16 h-16 rounded-2xl mb-6"
          style={{ background: 'linear-gradient(135deg, #7361FF15, #8C78FF25)' }}
        >
          <Users size={30} style={{ color: '#7361FF' }} />
        </div>
        <h2 className="text-2xl font-bold text-gray-900 mb-2">Skupina vytvorená!</h2>
        <p className="text-gray-500 text-sm mb-8">
          Zdieľaj tento kód s kamarátmi, nech sa môžu pripojiť.
        </p>

        <div className="rounded-2xl border border-gray-200 bg-gray-50 p-6 mb-6">
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">
            Pozývací kód skupiny
          </p>
          <p className="text-4xl font-mono font-bold tracking-widest text-gray-900 mb-4">
            {created.joinCode}
          </p>
          <button
            onClick={copyCode}
            className="inline-flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-semibold border-2 transition-all"
            style={{ borderColor: '#7361FF', color: '#7361FF' }}
          >
            {copied ? <Check size={15} /> : <Copy size={15} />}
            {copied ? 'Skopírované!' : 'Kopírovať kód'}
          </button>
        </div>

        <button
          onClick={() => router.push('/app/group')}
          className="flex items-center justify-center gap-2 w-full rounded-xl py-3 text-sm font-semibold text-white transition-all"
          style={{ background: 'linear-gradient(135deg, #7361FF, #8C78FF)' }}
        >
          Prejsť do skupiny
          <ArrowRight size={15} />
        </button>
      </div>
    );
  }

  return (
    <div className="max-w-xl mx-auto px-6 py-12">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900 mb-1">Vytvoriť skupinu</h1>
        <p className="text-gray-500 text-sm">Nastav detaily svojej skupiny a pozvi kamarátov.</p>
      </div>

      <form onSubmit={handleSubmit} className="flex flex-col gap-5">
        {/* Názov */}
        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-1.5">
            Názov skupiny <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            value={name}
            onChange={e => setName(e.target.value)}
            placeholder="napr. Frontend Dev Team"
            maxLength={50}
            required
            className="w-full rounded-xl border border-gray-200 px-4 py-2.5 text-sm text-gray-900 outline-none transition focus:border-[#7361FF] focus:ring-2 focus:ring-[#7361FF]/10"
          />
          <p className="text-xs text-gray-400 mt-1">{name.length}/50 znakov</p>
        </div>

        {/* Popis */}
        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-1.5">
            Popis skupiny
          </label>
          <textarea
            value={description}
            onChange={e => setDescription(e.target.value)}
            placeholder="Stručne opíš skupinu..."
            maxLength={200}
            rows={3}
            className="w-full rounded-xl border border-gray-200 px-4 py-2.5 text-sm text-gray-900 outline-none transition focus:border-[#7361FF] focus:ring-2 focus:ring-[#7361FF]/10 resize-none"
          />
        </div>

        {/* Pravidlá */}
        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-1.5">
            Pravidlá skupiny
          </label>
          <textarea
            value={rules}
            onChange={e => setRules(e.target.value)}
            placeholder="Napr. učíme sa každý deň aspoň 15 minút..."
            maxLength={500}
            rows={3}
            className="w-full rounded-xl border border-gray-200 px-4 py-2.5 text-sm text-gray-900 outline-none transition focus:border-[#7361FF] focus:ring-2 focus:ring-[#7361FF]/10 resize-none"
          />
        </div>

        {/* Typ skupiny */}
        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-2">
            Typ skupiny
          </label>
          <div className="grid grid-cols-2 gap-2">
            {([
              { value: 'invite_only', label: 'Len pozvaní', icon: <Lock size={15} />, desc: 'Skrytá, vstup cez kód' },
              { value: 'public',      label: 'Verejná',     icon: <Globe size={15} />, desc: 'Viditeľná, voľný vstup' },
            ] as const).map(opt => (
              <button
                key={opt.value}
                type="button"
                onClick={() => setType(opt.value)}
                className={`flex flex-col items-center gap-1 rounded-xl border-2 p-3 text-xs font-semibold transition-all ${
                  type === opt.value
                    ? 'border-[#7361FF] bg-[#7361FF]/5 text-[#7361FF]'
                    : 'border-gray-200 text-gray-600 hover:border-gray-300'
                }`}
              >
                {opt.icon}
                <span>{opt.label}</span>
                <span className="font-normal text-[10px] text-gray-400">{opt.desc}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Viditeľnosť progressu */}
        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-2">
            Viditeľnosť progresu členov
          </label>
          <div className="grid grid-cols-2 gap-2">
            {([
              { value: 'full_detail', label: 'Plný detail', icon: <Eye size={15} />, desc: 'Všetci vidia všetko' },
              { value: 'aggregate_only', label: 'Iba súhrn', icon: <EyeOff size={15} />, desc: 'Len XP a poradie' },
            ] as const).map(opt => (
              <button
                key={opt.value}
                type="button"
                onClick={() => setPrivacy(opt.value)}
                className={`flex flex-col items-center gap-1 rounded-xl border-2 p-3 text-xs font-semibold transition-all ${
                  privacy === opt.value
                    ? 'border-[#7361FF] bg-[#7361FF]/5 text-[#7361FF]'
                    : 'border-gray-200 text-gray-600 hover:border-gray-300'
                }`}
              >
                {opt.icon}
                <span>{opt.label}</span>
                <span className="font-normal text-[10px] text-gray-400">{opt.desc}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Max členov */}
        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-1.5">
            Maximálny počet členov: <span style={{ color: '#7361FF' }}>{maxMembers}</span>
          </label>
          <input
            type="range"
            min={2}
            max={50}
            value={maxMembers}
            onChange={e => setMaxMembers(Number(e.target.value))}
            className="w-full accent-[#7361FF]"
          />
          <div className="flex justify-between text-xs text-gray-400 mt-1">
            <span>2</span>
            <span>50</span>
          </div>
        </div>

        {error && (
          <p className="text-sm text-red-500 bg-red-50 rounded-xl px-4 py-2.5">{error}</p>
        )}

        <button
          type="submit"
          disabled={loading || name.trim().length < 2}
          className="flex items-center justify-center gap-2 rounded-xl py-3 text-sm font-semibold text-white transition-all disabled:opacity-50 mt-1"
          style={{ background: 'linear-gradient(135deg, #7361FF, #8C78FF)' }}
        >
          {loading ? 'Vytvárám skupinu…' : (
            <>
              Vytvoriť skupinu
              <ArrowRight size={15} />
            </>
          )}
        </button>
      </form>
    </div>
  );
}
