import React, { useEffect, useState } from 'react';
import { PhoneCall, PhoneIncoming } from 'lucide-react';
import { authHeader } from '../services/supabase';
import { Spinner } from './ui/kit';

/**
 * The helpline on a real phone: the person's own phone rings and they talk to the same
 * helpline (language menu, questions, applications), or they dial the helpline number.
 * Shown only when the phone line is set up on the server.
 */
export const CallMeCard: React.FC<{ mobile?: string }> = ({ mobile }) => {
  const [status, setStatus] = useState<{ enabled: boolean; number: string | null } | null>(null);
  const [to, setTo] = useState(mobile || '');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);

  useEffect(() => {
    fetch('/api/voice/status')
      .then((r) => r.json())
      .then(setStatus)
      .catch(() => setStatus(null));
  }, []);
  useEffect(() => {
    if (mobile && !to) setTo(mobile);
  }, [mobile]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!status?.enabled) return null;

  const callMe = async () => {
    setBusy(true);
    setMessage(null);
    try {
      const res = await fetch('/api/voice/call-me', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...(await authHeader()) },
        body: JSON.stringify({ to }),
      });
      const data = await res.json().catch(() => ({}));
      setMessage(res.ok ? { ok: true, text: 'Calling you now — please answer your phone.' } : { ok: false, text: data.error || 'Could not place the call.' });
    } catch {
      setMessage({ ok: false, text: 'Could not reach the helpline. Please try again.' });
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="rounded-3xl border border-white/10 bg-white/[0.04] p-5" aria-labelledby="callme-h">
      <div className="flex items-start gap-3">
        <span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-emerald-500/20 text-emerald-300">
          <PhoneIncoming className="h-5 w-5" aria-hidden />
        </span>
        <div className="min-w-0">
          <h2 id="callme-h" className="text-lg font-extrabold text-white">
            Talk to the helpline on your phone
          </h2>
          <p className="mt-1 text-sm text-slate-300">
            We call you, and you speak in your language — ask questions or fill an application by voice and keypad. No internet needed during the call.
          </p>
        </div>
      </div>
      <div className="mt-4 flex flex-wrap gap-2">
        <span className="grid h-12 place-items-center rounded-xl border border-white/15 px-3 font-semibold text-white">+91</span>
        <input
          translate="no"
          value={to}
          onChange={(e) => setTo(e.target.value.replace(/[^\d ]/g, ''))}
          inputMode="numeric"
          placeholder="Your mobile number"
          aria-label="Your mobile number"
          className="h-12 min-w-0 flex-1 rounded-xl border border-white/15 bg-white/[0.07] px-4 text-base text-white placeholder:text-slate-400 focus:border-teal focus:outline-none"
        />
        <button onClick={callMe} disabled={busy || to.replace(/\D/g, '').length < 10} className="btn btn-success h-12">
          {busy ? <Spinner className="h-5 w-5" /> : <PhoneCall className="h-5 w-5" aria-hidden />} Call me
        </button>
      </div>
      {message && (
        <p role="status" className={`mt-3 text-sm ${message.ok ? 'text-emerald-300' : 'text-amber-300'}`}>
          {message.text}
        </p>
      )}
      {status.number && (
        <p className="mt-3 text-xs text-slate-400">
          Or dial the helpline: <strong translate="no" className="text-slate-200">{status.number}</strong>
        </p>
      )}
    </section>
  );
};
