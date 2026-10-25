/** Client for the loans helpers (server/loans/router.ts). Nothing sent here is stored. */
import type { LoanNeed } from '../data/loanAdvice';
import type { UploadFile } from './autofillApi';

async function call<T>(path: string, body?: unknown): Promise<T> {
  const res = await fetch(`/api/loans${path}`, {
    method: body === undefined ? 'GET' : 'POST',
    headers: { 'X-Udaan-Client': '1', ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}) },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || 'Something went wrong. Please try again.');
  return data as T;
}

export interface ContractReview {
  summary: string[];
  terms: Array<{ label: string; value: string; plain: string; flag: 'ok' | 'watch' | 'danger' }>;
  missing?: string[];
  verdict: 'ok' | 'careful' | 'avoid';
  verdictReason: string;
  questions?: string[];
}

export interface BusinessPlan {
  title: string;
  summary: string;
  products: string[];
  customers: string;
  location?: string;
  setupCosts: Array<{ item: string; amount: number }>;
  monthlyCosts: Array<{ item: string; amount: number }>;
  monthlySales: number;
  loanNeeded: number;
  ownContribution?: number;
  repayment: string;
  experience?: string;
  risks: string[];
  assumptions: string[];
}

export interface FraudReview {
  verdict: 'looks-genuine' | 'suspicious' | 'scam' | 'unknown';
  reasons: string[];
  whatToDo: string[];
}

export interface NearbyPlace {
  name: string;
  brand: string;
  address: string;
  hours: string;
  distanceKm: number;
  mapsUrl: string;
  matchesLender: boolean;
}

export const loanApi = {
  understand: (text: string, known: LoanNeed, asking?: string) => call<{ need: Partial<LoanNeed> }>('/understand', { text, known, asking }).then((r) => r.need || {}),
  contract: (input: { text?: string; files?: UploadFile[] }, language: string) => call<ContractReview>('/contract', { ...input, language }),
  businessPlan: (description: string, need: LoanNeed, language: string) => call<{ plan: BusinessPlan; local: BusinessPlan | null }>('/business-plan', { description, need, language }),
  async businessPlanPdf(plan: BusinessPlan, name: string): Promise<Blob> {
    const res = await fetch('/api/loans/business-plan/pdf', { method: 'POST', headers: { 'X-Udaan-Client': '1', 'Content-Type': 'application/json' }, body: JSON.stringify({ plan, name }) });
    if (!res.ok) throw new Error('Could not make the PDF.');
    return res.blob();
  },
  fraudCheck: (text: string, language: string) => call<FraudReview>('/fraud-check', { text, language }),
  nearby: (where: { lat: number; lon: number } | { pincode: string }, lender?: string, kind: 'bank' | 'office' = 'bank', lang = 'en') => {
    const q = new URLSearchParams({ ...('pincode' in where ? { pincode: where.pincode } : { lat: String(where.lat), lon: String(where.lon) }), kind, lang, ...(lender ? { lender } : {}) });
    return call<{ places: NearbyPlace[]; center: { lat: number; lon: number } }>(`/nearby?${q}`);
  },
};
