'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { analyzeJob, JobData } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import GoogleSignInButton from '@/components/GoogleSignInButton';

type InputMode = 'url' | 'text';

const SUPPORTED_SITES = ['LinkedIn', 'Indeed', 'Glassdoor', 'ZipRecruiter', 'Monster', 'Greenhouse', 'Lever', 'Workday'];

export default function HomePage() {
  const [mode, setMode] = useState<InputMode>('url');
  const [url, setUrl] = useState('');
  const [text, setText] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const { user } = useAuth();
  const router = useRouter();

  async function handleAnalyze() {
    setError('');
    if (mode === 'url' && !url.trim()) return setError('Drop a job URL above.');
    if (mode === 'text' && !text.trim()) return setError('Paste the job description above.');

    setLoading(true);
    try {
      let jobData: JobData;

      if (mode === 'url') {
        const res = await fetch('/api/fetch-job', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ url: url.trim() }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Could not reach that job page.');
        jobData = data.jobData;
      } else {
        jobData = { description: text.trim() };
      }

      const result = await analyzeJob(jobData, user?.token);
      sessionStorage.setItem('applysafe_result', JSON.stringify(result));
      router.push('/results');
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Something went wrong.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="max-w-2xl mx-auto px-4 py-14">

      {/* Hero */}
      <div className="text-center mb-10 slide-up">
        <div className="inline-flex items-center justify-center w-16 h-16 bg-green-600 rounded-2xl shadow-lg shadow-green-200 mb-5">
          <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
            <polyline points="9 12 11 14 15 10" />
          </svg>
        </div>
        <h1 className="text-4xl font-extrabold text-gray-900 mb-3 tracking-tight">
          Is this job for real?
        </h1>
        <p className="text-gray-500 text-lg max-w-md mx-auto leading-relaxed">
          Scammers are getting smarter. Paste any job posting and we'll spot the red flags before you do.
        </p>
      </div>

      {/* Input card */}
      <div className="bg-white rounded-2xl shadow-md shadow-green-100 border border-green-100 p-5 slide-up-delay-1">

        {/* Mode tabs */}
        <div className="flex gap-1 bg-gray-100 rounded-lg p-1 mb-5 w-fit">
          {(['url', 'text'] as InputMode[]).map((m) => (
            <button
              key={m}
              onClick={() => setMode(m)}
              className={`px-4 py-1.5 rounded-md text-sm font-semibold transition-all ${
                mode === m
                  ? 'bg-white shadow-sm text-green-700 ring-1 ring-green-200'
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              {m === 'url' ? '🔗 Job URL' : '📋 Paste text'}
            </button>
          ))}
        </div>

        {mode === 'url' ? (
          <div className="relative">
            <input
              type="url"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://www.linkedin.com/jobs/view/..."
              className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-green-400 focus:border-transparent transition-all placeholder:text-gray-400 pr-10"
              onKeyDown={(e) => e.key === 'Enter' && handleAnalyze()}
            />
            {url && (
              <button
                onClick={() => setUrl('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-300 hover:text-gray-500 transition-colors text-lg leading-none"
              >
                ×
              </button>
            )}
          </div>
        ) : (
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Paste the full job description here — title, company, responsibilities, requirements, all of it."
            rows={7}
            className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-green-400 focus:border-transparent transition-all resize-none placeholder:text-gray-400 leading-relaxed"
          />
        )}

        {error && (
          <div className="mt-3 flex items-center gap-2 text-red-600 text-sm bg-red-50 rounded-lg px-3 py-2">
            <span>⚠</span> {error}
          </div>
        )}

        <button
          onClick={handleAnalyze}
          disabled={loading}
          className={`mt-4 w-full bg-green-600 hover:bg-green-700 active:scale-[0.99] disabled:opacity-60 disabled:cursor-not-allowed text-white font-bold rounded-xl py-3.5 transition-all text-sm tracking-wide shadow-md shadow-green-200 flex items-center justify-center gap-2 ${!loading ? 'btn-pulse' : ''}`}
        >
          {loading ? (
            <>
              <span className="spinner" />
              Analyzing…
            </>
          ) : (
            'Check This Job →'
          )}
        </button>

        {/* Supported sites */}
        <div className="mt-4 flex flex-wrap gap-1.5 justify-center">
          {SUPPORTED_SITES.map((site) => (
            <span key={site} className="text-xs text-gray-400 bg-gray-50 px-2 py-0.5 rounded-full border border-gray-100">
              {site}
            </span>
          ))}
        </div>
      </div>

      {/* Sign-in nudge */}
      {!user && (
        <div className="mt-6 text-center slide-up-delay-2">
          <p className="text-sm text-gray-400 mb-3">Sign in to keep track of everything you've scanned.</p>
          <div className="flex justify-center">
            <GoogleSignInButton />
          </div>
        </div>
      )}

      {/* Trust row */}
      <div className="mt-12 grid grid-cols-3 gap-3 slide-up-delay-3">
        {[
          { icon: '⚡', label: 'Under 10 seconds', sub: 'Real-time analysis' },
          { icon: '🔍', label: 'Deep analysis', sub: 'Not just keywords' },
          { icon: '🔒', label: 'Private by design', sub: 'Nothing stored' },
        ].map(({ icon, label, sub }) => (
          <div
            key={label}
            className="flex flex-col items-center text-center bg-white rounded-xl border border-green-100 px-3 py-4 gap-1 hover:border-green-300 hover:shadow-sm transition-all cursor-default"
          >
            <span className="text-2xl">{icon}</span>
            <span className="text-xs font-semibold text-gray-700">{label}</span>
            <span className="text-xs text-gray-400">{sub}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
