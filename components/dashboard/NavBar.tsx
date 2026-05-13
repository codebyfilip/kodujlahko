'use client';

import { useState, useRef, useEffect } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { usePathname, useRouter } from 'next/navigation';
import { User, Settings, HelpCircle, LogOut } from 'lucide-react';
import LogoutButton from './LogoutButton';
import { createClient } from '@/supabase/client';

interface NavbarProps {
  user?: {
    name: string;
    email: string;
    avatar?: string;
  };
  onLogout?: () => void;
}

export default function Navbar({ user, onLogout }: NavbarProps) {
  const router = useRouter();

  const handleLogout = async () => {
    setIsDropdownOpen(false);
    if (onLogout) {
      onLogout();
    } else {
      const supabase = createClient();
      await supabase.auth.signOut();
      router.push('/login');
      router.refresh();
    }
  };
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const pathname = usePathname();
  

  // Navigačné položky
  const navItems = [
    { label: 'Domov', href: '/app' },
    { label: 'Učenie', href: '/app/learning' },
    { label: 'Skupina', href: '/app/group' },
    { label: 'Výzvy', href: '/app/challenges' },
  ];

  // Zatvoriť dropdown pri kliku mimo
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsDropdownOpen(false);
      }
    }

    if (isDropdownOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [isDropdownOpen]);

  // Zatvoriť mobile menu pri zmene route
  useEffect(() => {
    setIsMobileMenuOpen(false);
  }, [pathname]);

  const isActive = (href: string) => href === '/app' ? pathname === '/app' : pathname === href || pathname?.startsWith(href + '/');

  return (
    <>
      {/* Navbar - 1:1 kópia landing page dizajnu */}
      <header className="absolute top-0 bg-transparent left-1/2 -translate-x-1/2 z-50 w-full">
        <nav className="flex items-center justify-between bg-white px-14 py-5">
          {/* Logo + Name */}
          <Link href="/app" className="flex items-center space-x-2">
            <Image
              src="/logo.png"
              alt="KódujĽahko logo"
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

          {/* Middle Nav Links */}
          <div className="hidden md:flex items-center space-x-1">
            {navItems.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="relative px-5 py-2 text-gray-700 font-medium rounded-lg transition-all duration-300 group"
              >
                {/* Text */}
                <span
                  className={`relative z-10 transition-colors duration-300 ${
                    isActive(item.href)
                      ? 'text-gray-900'
                      : 'group-hover:text-gray-900'
                  }`}
                >
                  {item.label}
                </span>

                {/* Elegant underline */}
                <span
                  className={`absolute left-1/2 bottom-0 h-[1.5px] bg-linear-to-r from-[#7361FF] to-[#8C78FF] rounded-full transition-all duration-300 ${
                    isActive(item.href)
                      ? 'w-4/5 left-[10%]'
                      : 'w-0 group-hover:w-4/5 group-hover:left-[10%]'
                  }`}
                />
              </Link>
            ))}
          </div>

          {/* Right Side - Avatar (namiesto CTA buttonu) */}
          <div className="hidden md:flex items-center space-x-5">
            <div className="relative" ref={dropdownRef}>
              <button
                onClick={() => setIsDropdownOpen(!isDropdownOpen)}
                className="relative cursor-pointer inline-flex items-center justify-center w-10 h-10 overflow-hidden font-medium text-white rounded-full transition-all duration-300 bg-linear-to-r from-[#7361FF] to-[#8C78FF] hover:shadow-[0_4px_15px_rgba(115,97,255,0.3)] hover:scale-[1.03]"
              >
                {user?.avatar ? (
                  <Image
                    src={user.avatar}
                    width={40}
                    height={40}
                    alt={user.name}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <span className="text-sm font-semibold">
                    {user?.name?.charAt(0).toUpperCase() || user?.email?.charAt(0).toUpperCase() || 'U'}
                  </span>
                )}
              </button>

              {/* Dropdown menu */}
              {isDropdownOpen && (
                <div className="absolute right-0 top-14 w-64 overflow-hidden rounded-2xl border border-gray-200 bg-white/95 backdrop-blur-md shadow-lg">
                  {/* User info header */}
                  {user && (
                    <div className="border-b border-gray-100 px-4 py-3">
                      <p className="font-semibold text-gray-900">{user.name}</p>
                      <p className="text-sm text-gray-500">{user.email}</p>
                    </div>
                  )}

                  {/* Menu items */}
                  <div className="py-2">
                    <Link
                      href="/app/profile"
                      className="flex items-center gap-3 px-4 py-2.5 text-sm text-gray-700 transition-all hover:bg-gray-50 hover:text-[#7361FF]"
                      onClick={() => setIsDropdownOpen(false)}
                    >
                      <User className="h-4 w-4" />
                      Profil
                    </Link>
                    <Link
                      href="/app/settings"
                      className="flex items-center gap-3 px-4 py-2.5 text-sm text-gray-700 transition-all hover:bg-gray-50 hover:text-[#7361FF]"
                      onClick={() => setIsDropdownOpen(false)}
                    >
                      <Settings className="h-4 w-4" />
                      Nastavenia
                    </Link>
                    <Link
                      href="/app/support"
                      className="flex items-center gap-3 px-4 py-2.5 text-sm text-gray-700 transition-all hover:bg-gray-50 hover:text-[#7361FF]"
                      onClick={() => setIsDropdownOpen(false)}
                    >
                      <HelpCircle className="h-4 w-4" />
                      Podpora
                    </Link>
                  </div>

                  {/* Logout - oddelené */}
                  <div className="border-t border-gray-100 py-2">
                    <button
                      onClick={handleLogout}
                      className="flex w-full items-center gap-3 px-4 py-2.5 text-sm text-red-600 transition-all hover:bg-red-50"
                    >
                      <LogOut className="h-4 w-4" />
                      Odhlásiť sa
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Mobile Menu Button */}
          <button
            onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
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
              {isMobileMenuOpen ? (
                <path d="M6 18L18 6M6 6l12 12" />
              ) : (
                <path d="M4 6h16M4 12h16M4 18h16" />
              )}
            </svg>
          </button>
        </nav>

        {/* Mobile Menu */}
        {isMobileMenuOpen && (
          <div className="md:hidden mt-3 bg-white/95 backdrop-blur-md border border-gray-200 rounded-2xl shadow-lg py-4">
            <div className="flex flex-col items-center space-y-3">
              {navItems.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => setIsMobileMenuOpen(false)}
                  className={`px-4 py-2 font-medium border rounded-full transition-all ${
                    isActive(item.href)
                      ? 'border-[#7361FF] text-[#7361FF] bg-[#7361FF]/5'
                      : 'border-gray-200 text-gray-700 hover:border-gray-400 hover:text-[#7361FF]'
                  }`}
                >
                  {item.label}
                </Link>
              ))}

              {/* User section v mobile */}
              {user && (
                <>
                  <div className="w-full border-t border-gray-200 my-2" />
                  <Link
                    href="/app/profile"
                    onClick={() => setIsMobileMenuOpen(false)}
                    className="px-4 py-2 text-gray-700 font-medium border border-gray-200 rounded-full hover:border-gray-400 hover:text-[#7361FF] transition-all"
                  >
                    Profil
                  </Link>
                  <Link
                    href="/app/settings"
                    onClick={() => setIsMobileMenuOpen(false)}
                    className="px-4 py-2 text-gray-700 font-medium border border-gray-200 rounded-full hover:border-gray-400 hover:text-[#7361FF] transition-all"
                  >
                    Nastavenia
                  </Link>
                 <LogoutButton />
                </>
              )}
            </div>
          </div>
        )}
      </header>
    </>
  );
}