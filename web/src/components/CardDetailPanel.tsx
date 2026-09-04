'use client';

import React from 'react';
import { CardData } from '@/lib/mockData';

interface CardDetailPanelProps {
  card: CardData | null;
}

export function CardDetailPanel({ card }: CardDetailPanelProps) {
  if (!card) {
    return (
      <div className="h-full flex items-center justify-center bg-slate-900">
        <div className="text-center text-slate-500">
          <p className="text-sm">카드를 선택하세요</p>
        </div>
      </div>
    );
  }

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'completed':
        return { label: '완료', color: 'bg-green-500/30 text-green-300' };
      case 'in_progress':
        return { label: '진행 중', color: 'bg-yellow-500/30 text-yellow-300' };
      case 'blocked':
        return { label: '블로킹', color: 'bg-red-500/30 text-red-300' };
      default:
        return { label: '대기 중', color: 'bg-slate-600/30 text-slate-400' };
    }
  };

  const status = getStatusLabel(card.status);

  return (
    <div className="h-full flex flex-col bg-slate-900 overflow-y-auto">
      {/* Header */}
      <div className="px-8 py-6 border-b border-slate-700 flex-shrink-0">
        <div className="flex items-start justify-between gap-4 mb-4">
          <h2 className="text-2xl font-bold text-slate-100 leading-tight">{card.title}</h2>
          <span className={`text-xs px-3 py-1 rounded font-semibold flex-shrink-0 ${status.color}`}>
            {status.label}
          </span>
        </div>
        <p className="text-sm text-slate-400">ID: {card.id}</p>
      </div>

      {/* Content */}
      <div className="flex-1 px-8 py-6 space-y-6 overflow-y-auto">
        {/* Summary */}
        <div>
          <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-2">
            요약
          </h3>
          <p className="text-sm text-slate-300 leading-relaxed">{card.summary}</p>
        </div>

        {/* Tags */}
        <div>
          <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-3">
            태그
          </h3>
          <div className="flex flex-wrap gap-2">
            {card.tags.map((tag) => (
              <span
                key={tag}
                className="inline-flex px-3 py-1 bg-slate-800 border border-slate-700 rounded-full text-xs text-slate-300 hover:border-green-500 hover:text-green-400 transition-colors cursor-pointer"
              >
                {tag}
              </span>
            ))}
          </div>
        </div>

        {/* Metadata */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-2">
              생성일
            </h3>
            <p className="text-sm text-slate-300">{card.created_at}</p>
          </div>
          <div>
            <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-2">
              상태
            </h3>
            <p className="text-sm text-slate-300">{status.label}</p>
          </div>
        </div>

        {/* Actions */}
        <div className="space-y-3 pt-4 border-t border-slate-700">
          <button className="w-full px-4 py-2 bg-green-500/20 border border-green-500/50 text-green-400 rounded hover:bg-green-500/30 transition-colors text-sm font-medium">
            상세 내용 보기
          </button>
          <button className="w-full px-4 py-2 bg-slate-800 border border-slate-700 text-slate-300 rounded hover:border-slate-600 transition-colors text-sm font-medium">
            태그 편집
          </button>
        </div>
      </div>
    </div>
  );
}
