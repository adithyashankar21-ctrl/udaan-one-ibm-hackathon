import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ArrowRight } from 'lucide-react';

/** Every time the app opens or is refreshed; never on a shared verify link, nor for people who asked for less motion or saved data. */
function shouldShow(): boolean {
  try {
    if (typeof window === 'undefined') return false;
    if (new URLSearchParams(window.location.search).has('verify')) return false;
    if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return false;
    if ((navigator as Navigator & { connection?: { saveData?: boolean } }).connection?.saveData) return false;
    if (document.documentElement.dataset.motion === 'reduce') return false;
    return true;
  } catch {
    return true;
  }
}

// The clip carries a small dark four-point mark in its bottom-right corner. It is painted over
// with matching background taken from just above it (positions in 1280x720 frame coordinates).
const FRAME_W = 1280;
const FRAME_H = 720;
const MARK = { x: 1158, y: 600, patch: 104, lift: 120 };

/**
 * Welcome screen shown before the app: the UDAAN ONE logo animation fills the screen as a
 * living backdrop (drawn on a canvas, so it never looks like a video player), then fades into
 * the page. Always skippable; falls back to the still logo if the clip cannot play.
 */
export const WelcomeSplash: React.FC = () => {
  const [open, setOpen] = useState(shouldShow);
  const [leaving, setLeaving] = useState(false);
  const [playing, setPlaying] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const skipRef = useRef<HTMLButtonElement>(null);

  const finish = useCallback(() => {
    setLeaving(true);
    window.setTimeout(() => setOpen(false), 650);
  }, []);

  // Paint each video frame to the canvas, with the corner mark covered
  useEffect(() => {
    if (!open) return;
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    canvas.width = FRAME_W;
    canvas.height = FRAME_H;

    const patch = document.createElement('canvas');
    patch.width = patch.height = MARK.patch;
    const pctx = patch.getContext('2d')!;
    const half = MARK.patch / 2;
    let raf = 0;

    const paint = () => {
      ctx.drawImage(video, 0, 0, FRAME_W, FRAME_H);
      pctx.globalCompositeOperation = 'source-over';
      pctx.clearRect(0, 0, MARK.patch, MARK.patch);
      pctx.drawImage(canvas, MARK.x - half, MARK.y - half - MARK.lift, MARK.patch, MARK.patch, 0, 0, MARK.patch, MARK.patch);
      pctx.globalCompositeOperation = 'destination-in';
      const g = pctx.createRadialGradient(half, half, half * 0.62, half, half, half);
      g.addColorStop(0, 'rgba(0,0,0,1)');
      g.addColorStop(1, 'rgba(0,0,0,0)');
      pctx.fillStyle = g;
      pctx.fillRect(0, 0, MARK.patch, MARK.patch);
      ctx.drawImage(patch, MARK.x - half, MARK.y - half);
      raf = requestAnimationFrame(paint);
    };

    const onPlaying = () => {
      setPlaying(true);
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(paint);
    };
    video.addEventListener('playing', onPlaying);
    video.play().catch(() => {
      // Autoplay refused: do not hold anyone up on a screen that is not moving
      finish();
    });
    // A slow network should not keep people waiting: leave after a few seconds if nothing played
    const stall = window.setTimeout(() => {
      if (video.readyState < 3) finish();
    }, 4500);
    return () => {
      cancelAnimationFrame(raf);
      window.clearTimeout(stall);
      video.removeEventListener('playing', onPlaying);
    };
  }, [open, finish]);

  useEffect(() => {
    if (!open) return;
    skipRef.current?.focus({ preventScroll: true });
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' || e.key === 'Enter') finish();
    };
    window.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = prev;
    };
  }, [open, finish]);

  if (!open) return null;

  return (
    <div
      role="dialog"
      aria-label="Welcome to UDAAN ONE"
      className={`fixed inset-0 z-[100] flex items-center justify-center overflow-hidden bg-[#050b24] transition-opacity duration-[650ms] ${leaving ? 'opacity-0' : 'opacity-100'}`}
    >
      {/* Still logo while the animation loads, and if it never does */}
      <img
        src="/logo-mark.png"
        alt=""
        className={`absolute h-40 w-40 rounded-[22%] shadow-[0_0_80px_-10px_rgba(255,153,51,0.5)] transition-opacity duration-700 ${playing ? 'opacity-0' : 'opacity-100'}`}
      />
      <video ref={videoRef} src="/welcome.mp4" muted playsInline preload="auto" onEnded={finish} aria-hidden className="pointer-events-none absolute h-px w-px opacity-0" />
      <canvas
        ref={canvasRef}
        aria-hidden
        className={`h-full w-full object-contain transition-opacity duration-700 min-[900px]:object-cover ${playing ? 'opacity-100' : 'opacity-0'}`}
      />
      {/* Soft edge so the frame melts into the screen on tall phones */}
      <div aria-hidden className="pointer-events-none absolute inset-0 shadow-[inset_0_0_120px_60px_#050b24]" />

      <div className="absolute inset-x-0 bottom-0 flex items-center justify-between gap-3 px-4 pb-[max(1.25rem,env(safe-area-inset-bottom))] pt-10 sm:px-8">
        <p className="hidden text-sm text-white/70 sm:block">AI for Opportunity. Technology for All.</p>
        <button
          ref={skipRef}
          onClick={finish}
          className="ml-auto inline-flex min-h-11 items-center gap-2 rounded-full bg-white/10 px-5 text-sm font-semibold text-white ring-1 ring-white/25 backdrop-blur hover:bg-white/20"
        >
          Skip <ArrowRight className="h-4 w-4" aria-hidden />
        </button>
      </div>
    </div>
  );
};
