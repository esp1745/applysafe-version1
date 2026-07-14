const BACKEND = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:3000';

export interface JobData {
  title?: string;
  company?: string;
  location?: string;
  salary?: string;
  description?: string;
  contactEmail?: string[];
  companyDomain?: string;
}

export interface AnalysisResult {
  riskScore: number;
  jobTitle: string;
  company: string;
  redFlags: string[];
  positiveIndicators: string[];
  explanation: string;
  timestamp: number;
  aiAnalyzed: boolean;
}

export interface AuthResponse {
  success: boolean;
  userId: string;
  token: string;
  subscriptionStatus: string;
  trialInfo: object;
}

export async function analyzeJob(jobData: JobData, token?: string): Promise<AnalysisResult> {
  const res = await fetch(`${BACKEND}/api/analyze-job`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify({ jobData }),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || 'Analysis failed');
  }

  const data = await res.json();
  return data.analysis;
}

export async function signInWithGoogle(
  googleToken: string,
  email: string,
  name: string,
  picture: string
): Promise<AuthResponse> {
  const res = await fetch(`${BACKEND}/api/auth/google`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ googleToken, email, name, picture }),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.message || 'Sign in failed');
  }

  return res.json();
}

export async function getScanHistory(token: string) {
  const res = await fetch(`${BACKEND}/api/v3/sync`, {
    headers: { Authorization: `Bearer ${token}` },
  });

  if (!res.ok) return { scanHistory: [] };
  const data = await res.json();
  return data;
}

export async function checkUsage(token: string) {
  const res = await fetch(`${BACKEND}/api/usage/check`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ feature: 'scan' }),
  });

  if (!res.ok) return { allowed: true };
  return res.json();
}
