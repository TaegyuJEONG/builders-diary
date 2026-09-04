'use client';

import React, { useState, useRef, useEffect } from 'react';
import { CardData } from '@/lib/mockData';

interface CardListProps {
  cards: CardData[];
  selectedCardId: string | null;
  onSelectCard: (cardId: string) => void;
}

export function CardListScrollable({ cards, selectedCardId, onSelectCard }: CardListProps) {
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(true);

  const checkScroll = () => {
    if (scrollContainerRef.current) {
      const { scrollLeft, scrollWidth, clientWidth } = scrollContainerRef.current;
      setCanScrollLeft(scrollLeft > 0);
      setCanScrollRight(scrollLeft < scrollWidth - clientWidth - 10);
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
  }, [cards]);

  const scroll = (direction: 'left' | 'right') => {
    if (scrollContainerRef.current) {
      const scrollAmount = 300;
      scrollContainerRef.current.scrollBy({
        left: direction === 'left' ? -scrollAmount : scrollAmount,
        behavior: 'smooth'
      });
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed':
        return 'border-green-500 bg-green-500/10';
      case 'in_progress':
        return 'border-yellow-500 bg-yellow-500/10';
      case 'blocked':
        return 'border-red-500 bg-red-500/10';
      default:
        return 'border-slate-600 bg-slate-600/10';
    }
  };

  return (
    <div className="relative h-full flex flex-col">
      {/* Header */}
      <div className="px-6 py-4 border-b border-slate-700">
        <h3 className="text-sm font-semibold text-slate-300">작업 카드</h3>
        <p className="text-xs text-slate-500 mt-1">{cards.length}개 항목</p>
      </div>

      {/* Scroll Container */}
      <div className="flex-1 overflow-hidden relative flex items-center">
        {/* Left Arrow */}
        {canScrollLeft && (
          <button
            onClick={() => scroll('left')}
            className="absolute left-0 top-1/2 -translate-y-1/2 z-10 bg-slate-800/80 hover:bg-slate-700 text-slate-300 p-2 rounded-r"
            aria-label="Scroll left"
          >
            ←
          </button>
        )}

        {/* Cards Container */}
        <div
          ref={scrollContainerRef}
          className="flex gap-3 overflow-x-auto overflow-y-hidden px-6 py-4 flex-1 scrollbar-hide"
          style={{ scrollBehavior: 'smooth' }}
        >
          {cards.map((card) => (
            <button
              key={card.id}
              onClick={() => onSelectCard(card.id)}
              className={`flex-shrink-0 w-64 p-4 rounded-lg border-2 transition-all cursor-pointer ${
                selectedCardId === card.id
                  ? 'border-green-500 bg-green-500/20 shadow-lg shadow-green-500/30'
                  : `${getStatusColor(card.status)} hover:border-slate-500`
              }`}
            >
              <div className="text-left">
                <h4 className="text-sm font-semibold text-slate-200 line-clamp-2 mb-2">
                  {card.title}
                </h4>
                <div className="flex items-center gap-2">
                  <span
                    className={`text-xs px-2 py-1 rounded ${
                      card.status === 'completed'
                        ? 'bg-green-500/30 text-green-300'
                        : card.status === 'in_progress'
                        ? 'bg-yellow-500/30 text-yellow-300'
                        : card.status === 'blocked'
                        ? 'bg-red-500/30 text-red-300'
                        : 'bg-slate-600/30 text-slate-400'
                    }`}
                  >
                    {card.status === 'in_progress' ? '진행 중' : 
                     card.status === 'completed' ? '완료' :
                     card.status === 'blocked' ? '블로킹' : '대기'}
                  </span>
                </div>
              </div>
            </button>
          ))}
        </div>

        {/* Right Arrow */}
        {canScrollRight && (
          <button
            onClick={() => scroll('right')}
            className="absolute right-0 top-1/2 -translate-y-1/2 z-10 bg-slate-800/80 hover:bg-slate-700 text-slate-300 p-2 rounded-l"
            aria-label="Scroll right"
          >
            →
          </button>
        )}
      </div>

      {/* Empty State */}
      {cards.length === 0 && (
        <div className="flex-1 flex items-center justify-center text-slate-500">
          <p className="text-sm">카드가 없습니다</p>
        </div>
      )}

      <style>{`
        .scrollbar-hide::-webkit-scrollbar {
          display: none;
        }
        .scrollbar-hide {
          -ms-overflow-style: none;
          scrollbar-width: none;
        }
      `}</style>
    </div>
  );
}
