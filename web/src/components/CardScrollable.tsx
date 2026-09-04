'use client';

import React, { useRef, useEffect, useState } from 'react';

interface CardScrollableProps {
  records: any[];
  selectedRecordId: string | null;
  onSelectRecord: (recordId: string) => void;
}

export function CardScrollable({
  records,
  selectedRecordId,
  onSelectRecord
}: CardScrollableProps) {
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);

  // Check scroll position
  const checkScroll = () => {
    if (scrollContainerRef.current) {
      setCanScrollLeft(scrollContainerRef.current.scrollLeft > 0);
      setCanScrollRight(
        scrollContainerRef.current.scrollLeft <
        scrollContainerRef.current.scrollWidth - scrollContainerRef.current.clientWidth - 10
      );
    }
  };

  useEffect(() => {
    checkScroll();
    const container = scrollContainerRef.current;
    if (container) {
      container.addEventListener('scroll', checkScroll);
      window.addEventListener('resize', checkScroll);
      return () => {
        container.removeEventListener('scroll', checkScroll);
        window.removeEventListener('resize', checkScroll);
      };
    }
  }, []);

  // Auto-scroll to selected card
  useEffect(() => {
    if (selectedRecordId && scrollContainerRef.current) {
      const selectedElement = scrollContainerRef.current.querySelector(
        `[data-record-id="${selectedRecordId}"]`
      );
      if (selectedElement) {
        selectedElement.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
        checkScroll();
      }
    }
  }, [selectedRecordId]);

  // Handle scroll button clicks
  const scroll = (direction: 'left' | 'right') => {
    if (scrollContainerRef.current) {
      const scrollAmount = 340; // Card width + gap
      scrollContainerRef.current.scrollBy({
        left: direction === 'left' ? -scrollAmount : scrollAmount,
        behavior: 'smooth'
      });
      setTimeout(checkScroll, 300);
    }
  };

  // Handle mouse wheel scroll
  const handleWheel = (e: React.WheelEvent<HTMLDivElement>) => {
    if (scrollContainerRef.current) {
      e.preventDefault();
      scrollContainerRef.current.scrollBy({
        left: e.deltaY > 0 ? 50 : -50,
        behavior: 'smooth'
      });
      setTimeout(checkScroll, 100);
    }
  };

  if (records.length === 0) {
    return (
      <div className="flex items-center justify-center h-full text-slate-400 p-4">
        <div className="text-center">
          <p className="text-sm">No cards found</p>
        </div>
      </div>
    );
  }

  return (
    <div className="relative h-full flex flex-col">
      {/* Scroll buttons */}
      {canScrollLeft && (
        <button
          onClick={() => scroll('left')}
          className="absolute left-2 top-1/2 -translate-y-1/2 z-10 bg-white/90 hover:bg-white p-2 rounded-full shadow-md transition-all"
          aria-label="Scroll left"
        >
          <svg className="w-5 h-5 text-slate-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </button>
      )}

      {canScrollRight && (
        <button
          onClick={() => scroll('right')}
          className="absolute right-2 top-1/2 -translate-y-1/2 z-10 bg-white/90 hover:bg-white p-2 rounded-full shadow-md transition-all"
          aria-label="Scroll right"
        >
          <svg className="w-5 h-5 text-slate-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
        </button>
      )}

      <div className="flex-1 overflow-hidden">
        <div
          ref={scrollContainerRef}
          className="flex gap-4 p-4 h-full overflow-x-auto overflow-y-hidden scroll-smooth"
          onWheel={handleWheel}
          style={{ scrollBehavior: 'smooth' }}
        >
          {records.map((record) => (
            <div
              key={record.id}
              data-record-id={record.id}
              onClick={() => onSelectRecord(record.id)}
              className={`flex-shrink-0 w-72 p-4 rounded-lg border-2 cursor-pointer transition-all ${
                selectedRecordId === record.id
                  ? 'border-emerald-500 bg-emerald-50 shadow-lg'
                  : 'border-slate-200 bg-white hover:border-slate-300 hover:shadow-md'
              }`}
            >
              <h3 className="font-semibold text-slate-900 line-clamp-2 text-sm mb-2">
                {record.title}
              </h3>
              <p className="text-xs text-slate-600 line-clamp-2 mb-3">
                {record.summary || 'No description'}
              </p>
              <div className="flex items-center justify-between">
                <div className="text-xs text-slate-500">
                  {new Date(record.created_at).toLocaleDateString()}
                </div>
                {record.status && (
                  <span className={`text-xs font-medium px-2 py-1 rounded ${
                    record.status === 'completed' ? 'bg-green-100 text-green-700' :
                    record.status === 'in_progress' ? 'bg-blue-100 text-blue-700' :
                    record.status === 'blocked' ? 'bg-red-100 text-red-700' :
                    'bg-slate-100 text-slate-700'
                  }`}>
                    {record.status.replace('_', ' ')}
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Scroll hint */}
      {records.length > 4 && !canScrollRight && (
        <div className="absolute right-4 bottom-2 text-xs text-slate-400 pointer-events-none">
          End
        </div>
      )}
    </div>
  );
}
