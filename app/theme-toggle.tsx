'use client';

import { useEffect, useState } from 'react';
import { flushSync } from 'react-dom';
import { Moon, Sun } from 'lucide-react';

type Theme = 'dark' | 'light';

function liquidDrainFrames(): Keyframe[] {
  const width = window.innerWidth;
  const height = window.innerHeight;
  const amplitude = Math.min(30, height * 0.045);
  const waves = Math.max(1.6, Math.min(4, width / 300));
  // Dense, equally spaced points form smooth sine curves rather than angular corners.
  return Array.from({ length: 91 }, (_, frame) => {
    const progress = frame / 90;
    const waterline = -amplitude * 2 + (height + amplitude * 4) * progress;
    const phase = progress * Math.PI * 2.2;
    const points = Array.from({ length: 97 }, (_, point) => {
      const x = point / 96;
      const ripple = Math.sin(x * Math.PI * 2 * waves + phase) * amplitude
        + Math.sin(x * Math.PI * 2 * waves - phase * 0.65) * amplitude * 0.18;
      return `${(x * 100).toFixed(3)}% ${((waterline + ripple) / height * 100).toFixed(3)}%`;
    });
    return { clipPath: `polygon(${points.join(',')}, 100% 120%, 0% 120%)` };
  });
}

export default function ThemeToggle() {
  const [theme, setTheme] = useState<Theme>('dark');
  const [switching, setSwitching] = useState(false);

  useEffect(() => {
    setTheme(document.documentElement.dataset.theme === 'light' ? 'light' : 'dark');
  }, []);

  async function toggle() {
    if (switching) return;
    const next = theme === 'dark' ? 'light' : 'dark';
    const apply = () => {
      document.documentElement.dataset.theme = next;
      setTheme(next);
      try { localStorage.setItem('clipsave-theme', next); } catch { /* Storage may be disabled. */ }
    };
    if (!document.startViewTransition || matchMedia('(prefers-reduced-motion: reduce)').matches) {
      apply();
      return;
    }
    setSwitching(true);
    try {
      // The old page is a browser snapshot: drain it away over the live new theme.
      const transition = document.startViewTransition(() => flushSync(apply));
      await transition.ready;
      document.documentElement.animate(liquidDrainFrames(), {
        duration: 2200,
        easing: 'cubic-bezier(.35, 0, .2, 1)',
        fill: 'both',
        pseudoElement: '::view-transition-old(root)',
      });
      await transition.finished;
    } catch {
      apply();
    } finally {
      setSwitching(false);
    }
  }

  return <button className="theme-toggle" type="button" onClick={toggle} disabled={switching}
    aria-label={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}
    title={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}>
    <Sun className="theme-sun" size={15} aria-hidden="true" />
    <Moon className="theme-moon" size={15} aria-hidden="true" />
    <span className="theme-label">{theme === 'dark' ? 'Light' : 'Dark'}</span>
  </button>;
}
