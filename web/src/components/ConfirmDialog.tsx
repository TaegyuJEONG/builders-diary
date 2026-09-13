'use client';

import React, { useEffect, useState } from 'react';

export interface ConfirmDialogProps {
  open: boolean;
  title: string;
  message: React.ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  danger?: boolean;
  requireText?: string;
  onConfirm: () => void;
  onCancel: () => void;
}

/** Shared in-app confirmation dialog. Do not use window.confirm/prompt/alert for product actions. */
export function ConfirmDialog({
  open, title, message, confirmLabel = 'Confirm', cancelLabel = 'Cancel', danger = false,
  requireText, onConfirm, onCancel,
}: ConfirmDialogProps) {
  const [typed, setTyped] = useState('');

  useEffect(() => {
    if (open) setTyped('');
  }, [open, requireText]);

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onCancel();
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [open, onCancel]);

  if (!open) return null;
  const canConfirm = !requireText || typed === requireText;

  return (
    <div role="presentation" onMouseDown={event => { if (event.target === event.currentTarget) onCancel(); }} style={{ position: 'fixed', inset: 0, zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20, background: 'rgba(0,0,0,.72)' }}>
      <section role="dialog" aria-modal="true" aria-labelledby="confirm-dialog-title" style={{ width: 460, maxWidth: '100%', background: 'var(--surface)', border: `1px solid ${danger ? 'var(--danger)' : 'var(--border2)'}`, borderRadius: 8, boxShadow: '0 20px 60px rgba(0,0,0,.45)', overflow: 'hidden' }}>
        <header style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '16px 18px', borderBottom: '1px solid var(--border)' }}>
          <span aria-hidden="true" style={{ color: danger ? 'var(--danger)' : 'var(--accent)', fontSize: 18 }}>{danger ? '!' : '?'}</span>
          <strong id="confirm-dialog-title" style={{ fontSize: 14, color: 'var(--text)' }}>{title}</strong>
          <button onClick={onCancel} aria-label="Close" style={{ marginLeft: 'auto', width: 26, height: 26, border: '1px solid var(--border)', borderRadius: 4, background: 'transparent', color: 'var(--text2)', cursor: 'pointer' }}>×</button>
        </header>
        <div style={{ padding: 18, color: 'var(--text2)', fontSize: 12, lineHeight: 1.6 }}>{message}
          {requireText && <div style={{ marginTop: 16 }}>
            <div className="mono" style={{ marginBottom: 6, fontSize: 10, color: 'var(--text3)', textTransform: 'uppercase' }}>Type to confirm</div>
            <div className="mono" style={{ marginBottom: 7, padding: '8px 10px', borderRadius: 4, background: 'var(--bg)', color: 'var(--accent)', fontSize: 11, userSelect: 'all' }}>{requireText}</div>
            <input autoFocus value={typed} onChange={event => setTyped(event.target.value)} placeholder={requireText} style={{ width: '100%', boxSizing: 'border-box', padding: '9px 10px', border: `1px solid ${typed && !canConfirm ? 'var(--danger)' : 'var(--border2)'}`, borderRadius: 4, background: 'var(--bg)', color: 'var(--text)', fontFamily: 'inherit', fontSize: 12, outline: 'none' }} />
          </div>}
        </div>
        <footer style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, padding: '12px 18px', borderTop: '1px solid var(--border)' }}>
          <button onClick={onCancel} style={{ padding: '8px 12px', border: '1px solid var(--border)', borderRadius: 4, background: 'transparent', color: 'var(--text2)', cursor: 'pointer', fontSize: 11 }}>{cancelLabel}</button>
          <button disabled={!canConfirm} onClick={onConfirm} style={{ padding: '8px 12px', border: `1px solid ${danger ? 'var(--danger)' : 'var(--accent)'}`, borderRadius: 4, background: danger ? 'rgba(248,113,113,.12)' : 'rgba(74,222,128,.1)', color: danger ? 'var(--danger)' : 'var(--accent)', cursor: canConfirm ? 'pointer' : 'not-allowed', opacity: canConfirm ? 1 : .45, fontSize: 11 }}>{confirmLabel}</button>
        </footer>
      </section>
    </div>
  );
}
