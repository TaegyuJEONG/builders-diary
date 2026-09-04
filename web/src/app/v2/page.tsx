'use client';

import { Suspense } from 'react';
import { HomeContentV2 } from '@/components/HomeContentV2';

function V2Loading() {
  return (
    <div className="flex items-center justify-center h-screen bg-slate-900">
      <p className="text-slate-400">로딩 중...</p>
    </div>
  );
}

export default function V2Page() {
  return (
    <Suspense fallback={<V2Loading />}>
      <HomeContentV2 />
    </Suspense>
  );
}
