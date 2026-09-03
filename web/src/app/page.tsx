'use client';

import { Suspense } from 'react';
import { HomeContent } from './home-content';

function HomeLoading() {
  return (
    <div className="flex items-center justify-center h-screen">
      <p>Loading...</p>
    </div>
  );
}

export default function Home() {
  return (
    <Suspense fallback={<HomeLoading />}>
      <HomeContent />
    </Suspense>
  );
}
