'use client';

import Link from 'next/link';
import Image from 'next/image';
import { useState } from 'react';

export default function Navbar() {
  const [isOpen, setIsOpen] = useState(false);

  const navLinks = [
    { name: 'Domov', href: '#home' },
    { name: 'O projekte', href: '#about' },
    { name: 'Ako to funguje', href: '#how-it-works' },
    { name: 'Funkcie', href: '#features' },
    { name: 'Ukážka', href: '#showcase' },
  ];

  return (
    <header className="absolute top-4 left-1/2 -translate-x-1/2 z-50 w-[98%] sm:w-[98%] max-w-8xl">
      <nav className="flex items-center justify-between bg-white backdrop-blur-md  rounded-2xl px-10 py-5">
        {/* Logo + Name */}
        <Link href="/" className="flex items-center space-x-2">
          <Image
            src="/logo.png" // ← nahraď tvojou cestou k logu
            alt="KodujĽahko logo"
            width={40}
            height={40}
          />
          <span
  style={{ fontFamily: "'Momo Trust Display', sans-serif" }}
  className="text-2xl bg-linear-to-r from-[#7361FF] to-[#8C78FF] bg-clip-text font-bold text-transparent"
>
  KodujLahko
</span>
        </Link>

        {/* Desktop Menu */}
     {/* Middle Nav Links */}
<div className="hidden md:flex items-center space-x-1">
  {navLinks.map((link) => (
    <Link
      key={link.name}
      href={link.href}
      className="relative px-5 py-2 text-gray-700 font-medium rounded-lg transition-all duration-300 group"
    >
      {/* Text */}
      <span className=" nunito relative z-10 group-hover:text-gray-900 transition-colors duration-300">
        {link.name}
      </span>

      {/* Elegant underline */}
      <span className="absolute left-1/2 bottom-0 h-[1.5px] w-0 bg-gradient-to-r from-[#7361FF] to-[#8C78FF] rounded-full transition-all duration-300 group-hover:w-4/5 group-hover:left-[10%]" />
    </Link>
  ))}
</div>

{/* Right Side CTA */}
<div className="hidden md:flex items-center space-x-5">
  <Link
    href="/signup"
    className="nunito relative inline-flex items-center justify-center px-9 py-3 overflow-hidden font-medium text-white rounded-2xl transition-all duration-300 bg-gradient-to-r from-[#7361FF] to-[#8C78FF] hover:shadow-[0_4px_15px_rgba(115,97,255,0.3)] hover:scale-[1.03]"
  >
    <span className="relative z-10">Začni sa učiť</span>
    <span className="absolute inset-0 bg-white opacity-0 group-hover:opacity-[0.08] transition-opacity duration-300 rounded-full" />
  </Link>
</div>

        {/* Mobile Menu Button */}
        <button
          onClick={() => setIsOpen(!isOpen)}
          className="md:hidden p-2 rounded-md hover:bg-gray-100 transition-colors"
        >
          <svg
            className="w-6 h-6 text-gray-700"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            viewBox="0 0 24 24"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            {isOpen ? (
              <path d="M6 18L18 6M6 6l12 12" />
            ) : (
              <path d="M4 6h16M4 12h16M4 18h16" />
            )}
          </svg>
        </button>
      </nav>

      {/* Mobile Menu */}
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
              href="/signup"
              onClick={() => setIsOpen(false)}
              className="px-5 py-2.5 bg-gradient-to-r from-[#7361FF] to-[#8C78FF] text-white font-semibold rounded-full shadow-md hover:shadow-lg hover:scale-105 transition-all"
            >
              Začni sa učiť
            </Link>
          </div>
        </div>
      )}
    </header>
  );
}