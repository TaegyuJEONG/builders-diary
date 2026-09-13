'use client';

// Detect the user's OS for showing the right "open a terminal" hint.
// File System Access + npx work the same everywhere; this is purely for guidance copy.

export type OS = 'mac' | 'windows' | 'linux';

export function detectOS(): OS {
  if (typeof navigator === 'undefined') return 'mac';

  // Prefer the modern hint API when available.
  const uaPlatform =
    (navigator as any).userAgentData?.platform ||
    navigator.platform ||
    navigator.userAgent ||
    '';
  const p = String(uaPlatform).toLowerCase();

  if (p.includes('mac') || p.includes('iphone') || p.includes('ipad')) return 'mac';
  if (p.includes('win')) return 'windows';
  return 'linux';
}

export interface TerminalHint {
  /** Short human sentence telling the user how to open a terminal. */
  label: string;
  /** Keyboard shortcut string for emphasis, e.g. "⌘ + Space". */
  keys: string;
  /** What to type after the shortcut, e.g. "Terminal". */
  type: string;
}

export function terminalHint(os: OS = detectOS()): TerminalHint {
  switch (os) {
    case 'mac':
      return { label: 'Open Terminal', keys: '⌘ + Space', type: 'Terminal' };
    case 'windows':
      return { label: 'Open a terminal', keys: 'Win', type: 'cmd' };
    default:
      return { label: 'Open a terminal', keys: 'Ctrl + Alt + T', type: '' };
  }
}
