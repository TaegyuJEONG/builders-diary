'use client';

import React, { useEffect, useState } from 'react';
import { ChatViewEntry, loadFolderHandleFromStorage, readChatPage, readChatView } from '@/lib/fileSystem';

export function ChatViewer({ runId, projectId }: { runId: string; projectId: string }) {
  const [chats, setChats] = useState<ChatViewEntry[]>([]);
  const [errors, setErrors] = useState<Array<{ title: string; message: string }>>([]);
  const [selected, setSelected] = useState<ChatViewEntry | null>(null);
  const [page, setPage] = useState(0);
  const [messages, setMessages] = useState<Array<{ sender: string; text: string; created_at?: string | null }>>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  useEffect(() => { (async () => { try { const handle = await loadFolderHandleFromStorage(); if (!handle) throw new Error('Builder’s Diary folder is not connected.'); const view = await readChatView(handle, runId, projectId); if (!view) throw new Error('Chat viewer files are not ready yet.'); setChats(view.chats); setErrors(view.errors); setSelected(view.chats[0] || null); } catch (e) { setError(e instanceof Error ? e.message : 'Unable to open Chat viewer.'); } finally { setLoading(false); } })(); }, [runId, projectId]);
  useEffect(() => { if (!selected) return; (async () => { const handle = await loadFolderHandleFromStorage(); if (!handle || !selected.pages[page]) return; const data = await readChatPage(handle, runId, selected.pages[page]); if (!data) setError('This Chat page could not be read. The file may be missing or damaged.'); else setMessages(data.messages || []); })(); }, [runId, selected, page]);
  if (loading) return <main style={{ padding: 28, color: 'var(--text2)' }}>Loading Chat viewer…</main>;
  return <main style={{ minHeight: '100vh', background: 'var(--bg)', color: 'var(--text)', padding: 28, fontFamily: 'inherit' }}>
    <div style={{ maxWidth: 1100, margin: '0 auto' }}><div className="mono" style={{ color: 'var(--accent)', fontSize: 10, marginBottom: 8 }}>BUILDER’S DIARY · CHAT VIEWER</div><h1 style={{ fontSize: 24, margin: '0 0 8px' }}>Chat sources</h1><p style={{ color: 'var(--text2)', fontSize: 12, marginTop: 0 }}>Local transcript viewer. Pages are loaded one at a time.</p>
      {error && <div style={{ border: '1px solid var(--danger)', color: 'var(--danger)', padding: 10, borderRadius: 4, margin: '16px 0', fontSize: 12 }}>{error}</div>}
      {errors.map((item, i) => <div key={i} style={{ color: 'var(--danger)', fontSize: 11, margin: '7px 0' }}>{item.title}: {item.message}</div>)}
      {chats.length === 0 && !error && <p style={{ color: 'var(--text2)' }}>No Chat transcript has been prepared for this project yet.</p>}
      <div style={{ display: 'grid', gridTemplateColumns: '280px 1fr', gap: 18, marginTop: 20 }}>{chats.length > 0 && <nav style={{ borderRight: '1px solid var(--border)', paddingRight: 14 }}>{chats.map((chat, i) => <button key={`${chat.title}-${i}`} onClick={() => { setSelected(chat); setPage(0); setMessages([]); setError(''); }} style={{ display: 'block', width: '100%', textAlign: 'left', padding: '10px 8px', border: 0, borderRadius: 4, background: selected === chat ? 'var(--surface)' : 'transparent', color: selected === chat ? 'var(--text)' : 'var(--text2)', cursor: 'pointer' }}><div style={{ fontSize: 12 }}>{chat.title}</div><div className="mono" style={{ fontSize: 9, marginTop: 4 }}>{chat.message_count} messages</div></button>)}</nav>}
        {selected && <section><h2 style={{ fontSize: 18, margin: '0 0 5px' }}>{selected.title}</h2><p style={{ color: 'var(--text2)', fontSize: 12, lineHeight: 1.5, marginTop: 0 }}>{selected.summary || 'No export summary.'}</p><div className="mono" style={{ color: 'var(--text3)', fontSize: 10, margin: '16px 0' }}>Page {page + 1} of {selected.pages.length} · {selected.message_count} messages</div>{messages.map((message, i) => <article key={i} style={{ padding: '12px 0', borderTop: '1px solid var(--border)' }}><div className="mono" style={{ color: 'var(--accent)', fontSize: 10, marginBottom: 5 }}>{message.sender}</div><div style={{ whiteSpace: 'pre-wrap', overflowWrap: 'anywhere', fontSize: 12, lineHeight: 1.65 }}>{message.text}</div></article>)}<div style={{ display: 'flex', gap: 8, marginTop: 16 }}><button disabled={page===0} onClick={() => setPage(p=>p-1)} className="mono">Previous</button><button disabled={page>=selected.pages.length-1} onClick={() => setPage(p=>p+1)} className="mono">Load more</button></div></section>}
      </div></div>
  </main>;
}
