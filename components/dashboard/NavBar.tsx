'use client';

import { useState, useRef, useEffect } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { usePathname, useRouter } from 'next/navigation';
import { User, Settings, HelpCircle, LogOut, Menu, X } from 'lucide-react';
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
    setIsMobileMenuOpen(false);
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

  const navItems = [
    { label: 'Domov', href: '/app' },
    { label: 'Učenie', href: '/app/learning' },
    { label: 'Skupina', href: '/app/group' },
    { label: 'Výzvy', href: '/app/challenges' },
  ];

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

  useEffect(() => {
    setIsMobileMenuOpen(false);
  }, [pathname]);

  const isActive = (href: string) =>
    href === '/app' ? pathname === '/app' : pathname === href || pathname?.startsWith(href + '/');

  const initials = user?.name?.charAt(0).toUpperCase() || user?.email?.charAt(0).toUpperCase() || 'U';

  return (
    <>
      <header className="fixed top-0 left-0 right-0 z-50 bg-white border-b border-gray-100">
        <nav className="flex items-center justify-between px-4 md:px-14 py-3 md:py-4 max-w-screen-2xl mx-auto">

          {/* Logo */}
          <Link href="/app" className="flex items-center gap-2 shrink-0">
            <Image src="/logo.png" alt="KódujĽahko logo" width={34} height={34} className="md:w-10 md:h-10" />
            <span
              style={{ fontFamily: "'Momo Trust Display', sans-serif" }}
              className="text-lg md:text-2xl bg-linear-to-r from-[#7361FF] to-[#8C78FF] bg-clip-text font-bold text-transparent"
            >
              KódujĽahko
            </span>
          </Link>

          {/* Desktop nav links */}
          <div className="hidden md:flex items-center gap-1">
            {navItems.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="relative px-5 py-2 text-gray-700 font-medium rounded-lg transition-all duration-300 group"
              >
                <span className={`relative z-10 transition-colors duration-300 ${isActive(item.href) ? 'text-gray-900' : 'group-hover:text-gray-900'}`}>
                  {item.label}
                </span>
                <span className={`absolute left-1/2 bottom-0 h-[1.5px] bg-linear-to-r from-[#7361FF] to-[#8C78FF] rounded-full transition-all duration-300 ${isActive(item.href) ? 'w-4/5 left-[10%]' : 'w-0 group-hover:w-4/5 group-hover:left-[10%]'}`} />
              </Link>
            ))}
          </div>

          {/* Desktop avatar dropdown */}
          <div className="hidden md:flex items-center gap-5">
            <div className="relative" ref={dropdownRef}>
              <button
                onClick={() => setIsDropdownOpen(!isDropdownOpen)}
                className="relative cursor-pointer inline-flex items-center justify-center w-10 h-10 overflow-hidden font-medium text-white rounded-full transition-all duration-300 bg-linear-to-r from-[#7361FF] to-[#8C78FF] hover:shadow-[0_4px_15px_rgba(115,97,255,0.3)] hover:scale-[1.03]"
              >
                {user?.avatar ? (
                  <Image src={user.avatar} width={40} height={40} alt={user.name} className="w-full h-full object-cover" />
                ) : (
                  <span className="text-sm font-semibold">{initials}</span>
                )}
              </button>

              {isDropdownOpen && (
                <div className="absolute right-0 top-14 w-64 overflow-hidden rounded-2xl border border-gray-200 bg-white/95 backdrop-blur-md shadow-lg">
                  {user && (
                    <div className="border-b border-gray-100 px-4 py-3">
                      <p className="font-semibold text-gray-900">{user.name}</p>
                      <p className="text-sm text-gray-500">{user.email}</p>
                    </div>
                  )}
                  <div className="py-2">
                    <Link href="/app/profile" className="flex items-center gap-3 px-4 py-2.5 text-sm text-gray-700 transition-all hover:bg-gray-50 hover:text-[#7361FF]" onClick={() => setIsDropdownOpen(false)}>
                      <User className="h-4 w-4" /> Profil
                    </Link>
                    <Link href="/app/settings" className="flex items-center gap-3 px-4 py-2.5 text-sm text-gray-700 transition-all hover:bg-gray-50 hover:text-[#7361FF]" onClick={() => setIsDropdownOpen(false)}>
                      <Settings className="h-4 w-4" /> Nastavenia
                    </Link>
                    <Link href="/app/support" className="flex items-center gap-3 px-4 py-2.5 text-sm text-gray-700 transition-all hover:bg-gray-50 hover:text-[#7361FF]" onClick={() => setIsDropdownOpen(false)}>
                      <HelpCircle className="h-4 w-4" /> Podpora
                    </Link>
                  </div>
                  <div className="border-t border-gray-100 py-2">
                    <button onClick={handleLogout} className="flex w-full items-center gap-3 px-4 py-2.5 text-sm text-red-600 transition-all hover:bg-red-50">
                      <LogOut className="h-4 w-4" /> Odhlásiť sa
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Mobile right side: avatar initial + hamburger */}
          <div className="flex md:hidden items-center gap-2">
            <div className="inline-flex items-center justify-center w-8 h-8 text-xs font-semibold text-white rounded-full bg-linear-to-r from-[#7361FF] to-[#8C78FF]">
              {user?.avatar ? (
                <Image src={user.avatar} width={32} height={32} alt="" className="w-full h-full object-cover rounded-full" />
              ) : initials}
            </div>
            <button
              onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
              aria-label="Menu"
              className="p-2 rounded-xl hover:bg-gray-100 transition-colors"
            >
              {isMobileMenuOpen ? <X className="w-5 h-5 text-gray-700" /> : <Menu className="w-5 h-5 text-gray-700" />}
            </button>
          </div>
        </nav>

        {/* Mobile dropdown menu */}
        {isMobileMenuOpen && (
          <div className="md:hidden border-t border-gray-100 bg-white">
            <div className="px-4 pt-3 pb-2 flex flex-col gap-1">
              {navItems.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => setIsMobileMenuOpen(false)}
                  className={`flex items-center px-4 py-3 rounded-xl text-base font-medium transition-all ${
                    isActive(item.href)
                      ? 'bg-[#7361FF]/10 text-[#7361FF]'
                      : 'text-gray-700 hover:bg-gray-50 hover:text-[#7361FF]'
                  }`}
                >
                  {item.label}
                </Link>
              ))}
            </div>

            {user && (
              <div className="px-4 pb-4 border-t border-gray-100 mt-1 pt-3 flex flex-col gap-1">
                <div className="px-4 py-2 mb-1">
                  <p className="font-semibold text-gray-900 text-sm">{user.name}</p>
                  <p className="text-xs text-gray-500">{user.email}</p>
                </div>
                <Link href="/app/profile" onClick={() => setIsMobileMenuOpen(false)} className="flex items-center gap-3 px-4 py-3 rounded-xl text-sm text-gray-700 hover:bg-gray-50 hover:text-[#7361FF] transition-all">
                  <User className="h-4 w-4" /> Profil
                </Link>
                <button onClick={handleLogout} className="flex items-center gap-3 px-4 py-3 rounded-xl text-sm text-red-600 hover:bg-red-50 transition-all w-full text-left">
                  <LogOut className="h-4 w-4" /> Odhlásiť sa
                </button>
              </div>
            )}
          </div>
        )}
      </header>
    </>
  );
}
