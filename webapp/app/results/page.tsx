'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import RiskGauge from '@/components/RiskGauge';
import { AnalysisResult } from '@/lib/api';

export default function ResultsPage() {
  const [result, setResult] = useState<AnalysisResult | null>(null);
  const router = useRouter();

  useEffect(() => {
    const stored = sessionStorage.getItem('applysafe_result');
    if (!stored) { router.replace('/'); return; }
    try { setResult(JSON.parse(stored)); } catch { router.replace('/'); }
  }, [router]);

  if (!result) return null;

  const level = result.riskScore <= 30 ? 'safe' : result.riskScore <= 60 ? 'moderate' : 'danger';

  const theme = {
    safe:     { bg: 'from-green-50 to-white',   border: 'border-green-200',  icon: '✅', headline: 'Looks legitimate' },
    moderate: { bg: 'from-yellow-50 to-white',  border: 'border-yellow-200', icon: '⚠️', headline: 'Proceed carefully' },
    danger:   { bg: 'from-red-50 to-white',     border: 'border-red-200',    icon: '🚨', headline: 'High scam risk' },
  }[level];

  return (
    <div className="max-w-2xl mx-auto px-4 py-10">

      <Link href="/" className="inline-flex items-center gap-1.5 text-sm text-gray-400 hover:text-green-700 mb-6 transition-colors group">
        <span className="group-hover:-translate-x-0.5 transition-transform">←</span>
        Check another job
      </Link>

      {/* Hero result card */}
      <div className={`rounded-2xl border bg-gradient-to-b ${theme.bg} ${theme.border} p-6 mb-4 slide-up`}>
        <div className="flex flex-col sm:flex-row items-center gap-6">
          <RiskGauge score={result.riskScore} />

          <div className="flex-1 text-center sm:text-left">
            <div className="flex items-center gap-2 justify-center sm:justify-start mb-1">
              <span className="text-xl">{theme.icon}</span>
              <span className="font-bold text-gray-900 text-lg">{theme.headline}</span>
            </div>

            {result.jobTitle && (
              <p className="text-gray-700 font-semibold">{result.jobTitle}</p>
            )}
            {result.company && (
              <p className="text-gray-400 text-sm">{result.company}</p>
            )}

            <p className="mt-3 text-sm text-gray-600 leading-relaxed">
              {result.explanation}
            </p>

            <div className="mt-3 flex flex-wrap gap-2 justify-center sm:justify-start">
              {result.aiAnalyzed && (
                <span className="inline-flex items-center gap-1 text-xs bg-green-100 text-green-700 rounded-full px-2.5 py-0.5 font-medium">
                  ✓ Analyzed
                </span>
              )}
              <span className="text-xs text-gray-400">
                {new Date(result.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Red flags */}
      {result.redFlags?.length > 0 && (
        <div className="bg-white rounded-xl border border-red-100 p-5 mb-3 slide-up-delay-1">
          <h2 className="font-bold text-gray-900 mb-3 flex items-center gap-2 text-sm uppercase tracking-wide">
            <span className="w-5 h-5 bg-red-500 rounded-full flex items-center justify-center text-white text-xs">!</span>
            Red Flags <span className="text-red-400 font-normal normal-case tracking-normal">({result.redFlags.length})</span>
          </h2>
          <ul className="space-y-2.5">
            {result.redFlags.map((flag, i) => (
              <li key={i} className="flex gap-3 text-sm text-gray-700 group">
                <span className="mt-0.5 w-4 h-4 bg-red-100 rounded-full flex items-center justify-center text-red-500 text-xs shrink-0">✕</span>
                <span className="leading-snug">{flag}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Positive indicators */}
      {result.positiveIndicators?.length > 0 && (
        <div className="bg-white rounded-xl border border-green-100 p-5 mb-3 slide-up-delay-2">
          <h2 className="font-bold text-gray-900 mb-3 flex items-center gap-2 text-sm uppercase tracking-wide">
            <span className="w-5 h-5 bg-green-500 rounded-full flex items-center justify-center text-white text-xs">✓</span>
            Good Signs <span className="text-green-500 font-normal normal-case tracking-normal">({result.positiveIndicators.length})</span>
          </h2>
          <ul className="space-y-2.5">
            {result.positiveIndicators.map((item, i) => (
              <li key={i} className="flex gap-3 text-sm text-gray-700">
                <span className="mt-0.5 w-4 h-4 bg-green-100 rounded-full flex items-center justify-center text-green-600 text-xs shrink-0">✓</span>
                <span className="leading-snug">{item}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* No red flags state */}
      {(!result.redFlags || result.redFlags.length === 0) && result.riskScore <= 30 && (
        <div className="bg-green-50 border border-green-200 rounded-xl p-5 mb-3 text-center slide-up-delay-1">
          <p className="text-green-700 font-semibold text-sm">No red flags detected 🎉</p>
          <p className="text-green-600 text-xs mt-1">Always verify company details independently before applying.</p>
        </div>
      )}

      {/* Actions */}
      <div className="mt-6 flex gap-3 slide-up-delay-3">
        <Link
          href="/"
          className="flex-1 bg-green-600 hover:bg-green-700 active:scale-[0.99] text-white font-bold rounded-xl py-3 text-sm text-center transition-all shadow-md shadow-green-200"
        >
          Check Another Job
        </Link>
        <button
          onClick={() => window.print()}
          className="border border-gray-200 hover:border-gray-300 rounded-xl px-4 py-3 text-sm text-gray-500 hover:text-gray-700 transition-all"
          title="Print / Save as PDF"
        >
          Save
        </button>
      </div>
    </div>
  );
}
