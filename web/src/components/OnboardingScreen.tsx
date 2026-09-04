'use client';

import React from 'react';

interface OnboardingProps {
  onStart: () => void;
}

export function OnboardingScreen({ onStart }: OnboardingProps) {
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex items-center justify-center p-4">
      <div className="max-w-2xl w-full">
        {/* Header */}
        <div className="text-center mb-12">
          <h1 className="text-4xl md:text-5xl font-bold text-slate-100 mb-4">
            Builder's Diary
          </h1>
          <p className="text-lg text-slate-400">
            당신의 작업 기록을 체계적으로 관리하세요
          </p>
        </div>

        {/* Steps */}
        <div className="space-y-6 mb-12">
          {[
            {
              step: 1,
              title: '폴더 연결',
              description: '로컬 폴더를 선택하여 작업 기록과 연결합니다'
            },
            {
              step: 2,
              title: '자동 스캔',
              description: '폴더 구조를 분석하여 프로젝트, 목표, 카드를 자동으로 로드합니다'
            },
            {
              step: 3,
              title: '시각화',
              description: '프로젝트별 목표와 작업 카드를 효율적으로 탐색하고 관리합니다'
            }
          ].map(({ step, title, description }) => (
            <div
              key={step}
              className="flex gap-6 p-6 rounded-lg border border-slate-700 bg-slate-800/30 hover:bg-slate-800/50 transition-colors"
            >
              <div className="flex-shrink-0">
                <div className="w-12 h-12 rounded-full bg-green-500/20 border-2 border-green-500 flex items-center justify-center">
                  <span className="text-green-400 font-bold text-lg">{step}</span>
                </div>
              </div>
              <div className="flex-1">
                <h3 className="text-lg font-semibold text-slate-100 mb-1">{title}</h3>
                <p className="text-sm text-slate-400">{description}</p>
              </div>
            </div>
          ))}
        </div>

        {/* Features */}
        <div className="mb-12">
          <h2 className="text-xl font-semibold text-slate-100 mb-4">특징</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {[
              { icon: '📁', label: '로컬 폴더 지원' },
              { icon: '🏷️', label: '스마트 태그 필터링' },
              { icon: '📊', label: '다단계 계층 구조' },
              { icon: '⚡', label: '빠른 검색 & 탐색' }
            ].map(({ icon, label }) => (
              <div key={label} className="flex items-center gap-3 p-4 rounded-lg bg-slate-800/30 border border-slate-700">
                <span className="text-2xl">{icon}</span>
                <span className="text-slate-300">{label}</span>
              </div>
            ))}
          </div>
        </div>

        {/* CTA */}
        <div className="space-y-4">
          <button
            onClick={onStart}
            className="w-full px-6 py-4 bg-green-500 hover:bg-green-600 text-slate-900 font-semibold rounded-lg transition-colors shadow-lg shadow-green-500/30 text-lg"
          >
            시작하기
          </button>
          <p className="text-center text-xs text-slate-500">
            폴더 선택 권한이 필요합니다. 브라우저의 파일 접근 권한을 허용해주세요.
          </p>
        </div>

        {/* Demo Note */}
        <div className="mt-8 p-4 rounded-lg bg-yellow-500/10 border border-yellow-500/30 text-center">
          <p className="text-xs text-yellow-400 font-medium">
            💡 이것은 V2 UI 프로토타입입니다. 데모 데이터를 사용 중입니다.
          </p>
        </div>
      </div>
    </div>
  );
}
