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

  const navLinks = [
    { name: 'Domov', href: '#home' },
    { name: 'O projekte', href: '#about' },
    { name: 'Ako to funguje', href: '#how-it-works' },
    { name: 'Funkcie', href: '#features' }
  ];

  return (
    <header className="absolute top-4 bg-transparent left-1/2 -translate-x-1/2 z-50 w-full">
      <nav className="flex items-center justify-between bg-transparent backdrop-blur-md rounded-2xl px-14 py-5">
        <Link href="/" className="flex items-center space-x-2">
          <Image
            src="/logo.png"
            alt="KodujĽahko logo"
            width={40}
            height={40}
          />
          <span
            style={{ fontFamily: "'Momo Trust Display', sans-serif" }}
            className="text-2xl bg-linear-to-r from-[#7361FF] to-[#8C78FF] bg-clip-text font-bold text-transparent"
          >
            KódujĽahko
          </span>
        </Link>

        <div className="hidden md:flex items-center space-x-1">
          {navLinks.map((link) => (
            <Link
              key={link.name}
              href={link.href}
              className="relative px-5 py-2 text-gray-700 font-medium rounded-lg transition-all duration-300 group"
            >
              <span className="nunito relative z-10 group-hover:text-gray-900 transition-colors duration-300">
                {link.name}
              </span>
              <span className="absolute left-1/2 bottom-0 h-[1.5px] w-0 bg-linear-to-r from-[#7361FF] to-[#8C78FF] rounded-full transition-all duration-300 group-hover:w-4/5 group-hover:left-[10%]" />
            </Link>
          ))}
        </div>

        <div className="hidden md:flex items-center space-x-5">
          <Link
            href={ctaHref}
            className="nunito relative inline-flex items-center justify-center px-9 py-3 overflow-hidden font-medium text-white rounded-2xl transition-all duration-300 bg-linear-to-r from-[#7361FF] to-[#8C78FF] hover:shadow-[0_4px_15px_rgba(115,97,255,0.3)] hover:scale-[1.03]"
          >
            <span className="relative z-10">Začni sa učiť</span>
          </Link>
        </div>

        <button
          onClick={() => setIsOpen(!isOpen)}
          className="md:hidden p-2 rounded-md hover:bg-gray-100 transition-colors"
        >
          {isOpen
            ? <FiX className="w-6 h-6 text-gray-700" />
            : <FiMenu className="w-6 h-6 text-gray-700" />
          }
        </button>
      </nav>

      {isOpen && (
        <div className="md:hidden mt-3 bg-white/95 backdrop-blur-md border border-gray-200 rounded-2xl shadow-lg py-4">
          <div className="flex flex-col items-center space-y-3">
            {navLinks.map((link) => (
              <Link
                key={link.name}
                href={link.href}
                onClick={() => setIsOpen(false)}
                className="px-4 py-2 text-gray-700 font-medium border border-gray-200 rounded-full hover:border-gray-400 hover:text-blue-600 transition-all"
              >
                {link.name}
              </Link>
            ))}
            <Link
              href={ctaHref}
              onClick={() => setIsOpen(false)}
              className="px-5 py-2.5 bg-linear-to-r from-[#7361FF] to-[#8C78FF] text-white font-semibold rounded-full shadow-md hover:shadow-lg hover:scale-105 transition-all"
            >
              Začni sa učiť
            </Link>
          </div>
        </div>
      )}
    </header>
  );
}
