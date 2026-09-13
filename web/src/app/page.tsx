'use client';

import { HomeContent } from './home-content';
import { ChatViewer } from '@/components/ChatViewer';

export default function Home() {
  if (typeof window !== 'undefined') {
    const query = new URLSearchParams(window.location.search);
    const runId = query.get('chatRun');
    const projectId = query.get('chatProject');
    if (runId && projectId) return <ChatViewer runId={runId} projectId={projectId} />;
  }
  return <HomeContent />;
}
