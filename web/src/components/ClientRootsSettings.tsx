'use client';

/**
 * Browser onboarding cannot safely inspect local app data. Claude Code's import
 * helper checks the known location for a selected source after the user starts
 * an import, before it reads any conversations.
 */
export function ClientRootsSettings() {
  return <p className="mono" style={{ fontSize: 11, color: 'var(--text3)', lineHeight: 1.6 }}>
    The import helper checks the selected app&apos;s known local location in Claude Code when you start the import.
  </p>;
}
