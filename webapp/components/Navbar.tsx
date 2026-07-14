'use client';

import Link from 'next/link';
import { useAuth } from '@/lib/auth';
import GoogleSignInButton from './GoogleSignInButton';

export default function Navbar() {
  const { user, signOut } = useAuth();

  return (
    <nav className="sticky top-0 z-50 bg-white/90 backdrop-blur border-b border-green-100">
      <div className="max-w-5xl mx-auto px-4 h-14 flex items-center justify-between">
        <Link href="/" className="flex items-center gap-2 group">
          <div className="w-8 h-8 bg-green-600 rounded-lg flex items-center justify-center text-white text-sm font-bold shadow-sm group-hover:bg-green-700 transition-colors">
            ✓
          </div>
          <span className="font-bold text-gray-900 text-base tracking-tight">ApplySafe</span>
        </Link>

        <div className="flex items-center gap-3">
          {user ? (
            <>
              <Link
                href="/dashboard"
                className="text-sm text-gray-600 hover:text-green-700 font-medium transition-colors"
              >
                Dashboard
              </Link>
              <div className="h-4 w-px bg-gray-200" />
              <div className="flex items-center gap-2">
                {user.picture && (
                  <img src={user.picture} alt="" className="w-7 h-7 rounded-full ring-2 ring-green-100" />
                )}
                <span className="text-sm text-gray-700 font-medium hidden sm:block">{user.name.split(' ')[0]}</span>
                <button
                  onClick={signOut}
                  className="text-xs text-gray-400 hover:text-red-500 transition-colors ml-1"
                >
                  Sign out
                </button>
              </div>
            </>
          ) : (
            <GoogleSignInButton compact />
          )}
        </div>
      </div>
    </nav>
  );
}
