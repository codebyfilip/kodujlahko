'use client';

import Link from 'next/link';
import Image from 'next/image';
import { useState, useEffect } from 'react';
import { FiMenu, FiX } from 'react-icons/fi';

function getCtaHref() {
  if (typeof document === 'undefined') return '/signup';
  const visited = document.cookie.split(';').some(c => c.trim().startsWith('kl_visited='));
  return visited ? '/login' : '/signup';
}

export default function Navbar() {
  const [isOpen, setIsOpen] = useState(false);
  const [ctaHref, setCtaHref] = useState('/signup');

  useEffect(() => {
    setCtaHref(getCtaHref());
  }, []);

  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => { document.body.style.overflow = ''; };
  }, [isOpen]);

  const navLinks = [
    { name: 'Domov', href: '#home' },
    { name: 'O projekte', href: '#about' },
    { name: 'Ako to funguje', href: '#how-it-works' },
    { name: 'Funkcie', href: '#features' },
  ];

  return (
    <header className="absolute top-3 sm:top-4 left-1/2 -translate-x-1/2 z-50 w-full px-3 sm:px-6">
      <nav className="flex items-center justify-between bg-white/80 backdrop-blur-md rounded-2xl px-4 sm:px-8 md:px-10 py-3 sm:py-4 shadow-sm border border-white/60">

        <Link href="/" className="flex items-center gap-2 shrink-0">
          <Image src="/logo.png" alt="KodujĽahko logo" width={34} height={34} className="sm:w-10 sm:h-10" />
          <span
            style={{ fontFamily: "'Momo Trust Display', sans-serif" }}
            className="text-lg sm:text-2xl bg-linear-to-r from-[#7361FF] to-[#8C78FF] bg-clip-text font-bold text-transparent"
          >
            KódujĽahko
          </span>
        </Link>

        <div className="hidden md:flex items-center gap-1">
          {navLinks.map((link) => (
            <Link
              key={link.name}
              href={link.href}
              className="relative px-4 py-2 text-gray-600 font-medium rounded-lg transition-all duration-300 group hover:text-gray-900"
            >
              <span className="nunito relative z-10">{link.name}</span>
              <span className="absolute left-1/2 bottom-0 h-[1.5px] w-0 bg-linear-to-r from-[#7361FF] to-[#8C78FF] rounded-full transition-all duration-300 group-hover:w-4/5 group-hover:left-[10%]" />
            </Link>
          ))}
        </div>

        <div className="hidden md:flex items-center">
          <Link
            href={ctaHref}
            className="nunito inline-flex items-center justify-center px-7 py-2.5 font-medium text-white rounded-xl transition-all duration-300 bg-linear-to-r from-[#7361FF] to-[#8C78FF] hover:shadow-[0_4px_15px_rgba(115,97,255,0.35)] hover:scale-[1.03]"
          >
            Začni sa učiť
          </Link>
        </div>

        <button
          onClick={() => setIsOpen(!isOpen)}
          aria-label="Menu"
          className="md:hidden p-2 rounded-xl hover:bg-gray-100 transition-colors"
        >
          {isOpen
            ? <FiX className="w-6 h-6 text-gray-700" />
            : <FiMenu className="w-6 h-6 text-gray-700" />
          }
        </button>
      </nav>

      {isOpen && (
        <div className="md:hidden fixed inset-0 top-[68px] bg-white/98 backdrop-blur-xl z-40 flex flex-col px-5 pt-6 pb-10 gap-3">
          {navLinks.map((link) => (
            <Link
              key={link.name}
              href={link.href}
              onClick={() => setIsOpen(false)}
              className="nunito text-lg font-medium text-gray-800 px-4 py-4 rounded-2xl hover:bg-[#7361FF]/8 hover:text-[#7361FF] transition-all border border-transparent hover:border-[#7361FF]/15 active:scale-[0.98]"
            >
              {link.name}
            </Link>
          ))}

          <div className="mt-auto pt-4 border-t border-gray-100">
            <Link
              href={ctaHref}
              onClick={() => setIsOpen(false)}
              className="nunito w-full flex items-center justify-center py-4 bg-linear-to-r from-[#7361FF] to-[#8C78FF] text-white text-lg font-semibold rounded-2xl shadow-lg active:scale-[0.98] transition-transform"
            >
              Začni sa učiť zadarmo
            </Link>
          </div>
        </div>
      )}
    </header>
  );
}
