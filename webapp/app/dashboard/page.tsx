'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/lib/auth';
import { getScanHistory } from '@/lib/api';

interface ScanRecord {
  jobTitle?: string;
  company?: string;
  riskScore: number;
  timestamp: number;
}

export default function DashboardPage() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const [scans, setScans] = useState<ScanRecord[]>([]);
  const [fetching, setFetching] = useState(true);

  useEffect(() => {
    if (!loading && !user) router.replace('/');
  }, [loading, user, router]);

  useEffect(() => {
    if (!user) return;
    getScanHistory(user.token)
      .then((data) => {
        const history: ScanRecord[] = data.scanHistory || data.data?.scanHistory || [];
        setScans(history.sort((a, b) => b.timestamp - a.timestamp));
      })
      .finally(() => setFetching(false));
  }, [user]);

  if (loading || !user) return null;

  const avgRisk = scans.length
    ? Math.round(scans.reduce((s, r) => s + r.riskScore, 0) / scans.length)
    : null;
  const highRisk = scans.filter((s) => s.riskScore > 60).length;
  const safeJobs = scans.filter((s) => s.riskScore <= 30).length;

  function riskBadge(score: number) {
    if (score <= 30) return 'bg-green-100 text-green-700';
    if (score <= 60) return 'bg-yellow-100 text-yellow-700';
    return 'bg-red-100 text-red-700';
  }

  return (
    <div className="max-w-3xl mx-auto px-4 py-12">

      {/* Header */}
      <div className="flex items-start justify-between mb-8 slide-up">
        <div>
          <h1 className="text-2xl font-extrabold text-gray-900 tracking-tight">Your scans</h1>
          <p className="text-sm text-gray-400 mt-0.5">{user.email}</p>
        </div>
        <Link
          href="/"
          className="bg-green-600 hover:bg-green-700 text-white text-sm font-bold rounded-xl px-4 py-2.5 transition-all shadow-sm shadow-green-200 active:scale-[0.98]"
        >
          + New scan
        </Link>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-3 mb-8 slide-up-delay-1">
        {[
          { label: 'Total scanned', value: scans.length, color: 'text-gray-900' },
          { label: 'Avg risk score', value: avgRisk ?? '—', color: avgRisk && avgRisk > 60 ? 'text-red-600' : avgRisk && avgRisk > 30 ? 'text-yellow-600' : 'text-green-600' },
          { label: 'High-risk found', value: highRisk, color: highRisk > 0 ? 'text-red-600' : 'text-gray-900' },
        ].map(({ label, value, color }) => (
          <div key={label} className="bg-white rounded-xl border border-green-100 p-4 text-center hover:border-green-300 transition-colors">
            <div className={`text-3xl font-extrabold ${color}`}>{value}</div>
            <div className="text-xs text-gray-400 mt-1 font-medium">{label}</div>
          </div>
        ))}
      </div>

      {/* Safe jobs callout */}
      {safeJobs > 0 && (
        <div className="bg-green-50 border border-green-200 rounded-xl px-5 py-3.5 mb-6 flex items-center gap-3 slide-up-delay-1">
          <span className="text-2xl">🛡️</span>
          <p className="text-sm text-green-700 font-medium">
            You've avoided <span className="font-bold">{highRisk}</span> potentially fraudulent job{highRisk !== 1 ? 's' : ''} — nice work.
          </p>
        </div>
      )}

      {/* Scan list */}
      <div className="bg-white rounded-xl border border-green-100 overflow-hidden slide-up-delay-2">
        <div className="px-5 py-4 border-b border-gray-50 flex items-center justify-between">
          <h2 className="font-bold text-gray-900 text-sm">Scan History</h2>
          {scans.length > 0 && (
            <span className="text-xs text-gray-400">{scans.length} total</span>
          )}
        </div>

        {fetching ? (
          <div className="py-14 text-center text-gray-400 text-sm">
            <div className="spinner mx-auto mb-3" style={{ borderColor: '#d1fae5', borderTopColor: '#16a34a' }} />
            Loading your history…
          </div>
        ) : scans.length === 0 ? (
          <div className="py-14 text-center">
            <p className="text-gray-400 text-sm mb-3">Nothing scanned yet.</p>
            <Link href="/" className="text-green-600 text-sm font-semibold hover:underline">
              Analyze your first job →
            </Link>
          </div>
        ) : (
          <ul className="divide-y divide-gray-50">
            {scans.map((scan, i) => (
              <li key={i} className="px-5 py-4 flex items-center gap-4 hover:bg-green-50/40 transition-colors">
                <span className={`text-xs font-extrabold rounded-full px-2.5 py-1 shrink-0 tabular-nums ${riskBadge(scan.riskScore)}`}>
                  {scan.riskScore}
                </span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-gray-900 truncate">
                    {scan.jobTitle || 'Unknown position'}
                  </p>
                  {scan.company && (
                    <p className="text-xs text-gray-400 truncate">{scan.company}</p>
                  )}
                </div>
                <span className="text-xs text-gray-300 shrink-0 tabular-nums">
                  {new Date(scan.timestamp).toLocaleDateString([], { month: 'short', day: 'numeric' })}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
