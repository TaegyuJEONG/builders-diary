'use client';

import React, { useRef, useEffect } from 'react';
import { Record } from '@/lib/types';

interface CardScrollableProps {
  records: Record[];
  selectedRecordId: string | null;
  onSelectRecord: (recordId: string) => void;
}

export function CardScrollable({
  records,
  selectedRecordId,
  onSelectRecord
}: CardScrollableProps) {
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to selected card
  useEffect(() => {
    if (selectedRecordId && scrollContainerRef.current) {
      const selectedElement = scrollContainerRef.current.querySelector(
        `[data-record-id="${selectedRecordId}"]`
      );
      if (selectedElement) {
        selectedElement.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
      }
    }
  }, [selectedRecordId]);

  if (records.length === 0) {
    return (
      <div className="flex items-center justify-center h-full text-slate-400 p-4">
        <div className="text-center">
          <p className="text-sm">No records found</p>
        </div>
      </div>
    );
  }

  return (
    <div className="relative h-full flex flex-col">
      <div className="flex-1 overflow-hidden">
        <div
          ref={scrollContainerRef}
          className="flex gap-4 p-4 h-full overflow-x-auto overflow-y-hidden scroll-smooth"
          style={{ scrollBehavior: 'smooth' }}
        >
          {records.map((record) => (
            <div
              key={record.id}
              data-record-id={record.id}
              onClick={() => onSelectRecord(record.id)}
              className={`flex-shrink-0 w-64 p-4 rounded-lg border-2 cursor-pointer transition-all ${
                selectedRecordId === record.id
                  ? 'border-emerald-500 bg-emerald-50 shadow-lg'
                  : 'border-slate-200 bg-white hover:border-slate-300 hover:shadow-md'
              }`}
            >
              <h3 className="font-semibold text-slate-900 line-clamp-3 text-sm mb-2">
                {record.title}
              </h3>
              <div className="text-xs text-slate-500">
                {new Date(record.created_at).toLocaleDateString()}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Scroll hint */}
      {records.length > 4 && (
        <div className="absolute right-4 bottom-2 text-xs text-slate-400 pointer-events-none">
          → scroll
        </div>
      )}
    </div>
  );
}
