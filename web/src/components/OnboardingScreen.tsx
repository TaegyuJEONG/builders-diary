'use client';

import React from 'react';

interface OnboardingScreenProps {
  onSelectFolder: () => void;
  isLoading: boolean;
  error?: string | null;
}

const steps = [
  {
    n: 1,
    title: '폴더 연결',
    body: '새 폴더를 만들거나 기존 포트폴리오 폴더를 연결한다. 여기에 프로젝트·목표·작업 기록이 쌓인다.',
    hint: '신규 폴더 생성 · 기존 폴더 연결',
  },
  {
    n: 2,
    title: 'MCP 연결',
    body: '에이전트가 이 폴더에 기록을 적재하도록 MCP 서버를 연결한다. 한 번 연결하면 채팅에서 바로 쓸 수 있다.',
    hint: 'builders-diary MCP',
  },
  {
    n: 3,
    title: '에이전트에서 스킬 호출',
    body: 'Claude · ChatGPT · Cursor 같은 에이전트 채팅창에서 스킬 이름을 부르면, 그 세션의 실행 흔적에서 한 편이 만들어진다.',
    hint: '@builders-diary',
  },
];

export function OnboardingScreen({ onSelectFolder, isLoading, error }: OnboardingScreenProps) {
  return (
    <div style={{
      minHeight: '100vh',
      background: 'var(--bg)',
      color: 'var(--text)',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '40px 24px',
    }}>
      <div style={{ maxWidth: 720, width: '100%' }}>
        {/* Brand */}
        <div style={{ textAlign: 'center', marginBottom: 8 }}>
          <h1 className="serif" style={{ fontSize: 40, fontWeight: 400, color: 'var(--text)', margin: 0 }}>
            Builder&apos;s Diary
          </h1>
          <p className="mono" style={{ fontSize: 12, color: 'var(--text2)', marginTop: 8, letterSpacing: '0.05em' }}>
            끝난 작업 하나를 리크루터가 읽을 수 있는 한 편으로 기록한다
          </p>
        </div>

        {/* Connect CTA */}
        <div style={{ textAlign: 'center', margin: '36px 0 40px' }}>
          <button
            onClick={onSelectFolder}
            disabled={isLoading}
            className="mono"
            style={{
              padding: '14px 40px',
              background: isLoading ? 'var(--border)' : 'var(--accent)',
              color: isLoading ? 'var(--text3)' : 'var(--bg)',
              border: 'none',
              borderRadius: 4,
              fontSize: 14,
              fontWeight: 600,
              letterSpacing: '0.04em',
              cursor: isLoading ? 'not-allowed' : 'pointer',
              transition: 'all 0.2s',
            }}
            onMouseEnter={e => { if (!isLoading) e.currentTarget.style.background = '#5fe091'; }}
            onMouseLeave={e => { if (!isLoading) e.currentTarget.style.background = 'var(--accent)'; }}
          >
            {isLoading ? '연결 중…' : '프로젝트 연결하기'}
          </button>
          <p className="mono" style={{ fontSize: 11, color: 'var(--text3)', marginTop: 12 }}>
            브라우저 폴더 선택으로 포트폴리오 디렉터리를 지정한다
          </p>
          {error && (
            <p className="mono" style={{ fontSize: 11, color: 'var(--danger)', marginTop: 8 }}>
              {error}
            </p>
          )}
        </div>

        {/* Guide */}
        <div style={{ marginBottom: 14 }}>
          <span className="mono" style={{
            fontSize: 10, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.1em',
          }}>
            가이드
          </span>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 14 }}>
          {steps.map(s => (
            <div key={s.n} style={{
              background: 'var(--surface)',
              border: '1px solid var(--border)',
              borderRadius: 6,
              padding: 18,
              display: 'flex',
              flexDirection: 'column',
              minHeight: 190,
            }}>
              <div style={{
                width: 26, height: 26, borderRadius: 4,
                border: '1px solid var(--accent)',
                color: 'var(--accent)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 13, fontWeight: 600, marginBottom: 14,
              }} className="mono">
                {s.n}
              </div>
              <h3 style={{ fontSize: 14, fontWeight: 600, color: 'var(--text)', margin: '0 0 8px' }}>
                {s.title}
              </h3>
              <p style={{ fontSize: 12, color: 'var(--text2)', lineHeight: 1.6, margin: 0, flex: 1 }}>
                {s.body}
              </p>
              <div className="mono" style={{
                marginTop: 12,
                fontSize: 11,
                color: 'var(--accent)',
                background: 'var(--tag-active-bg)',
                border: '1px solid var(--accent-dim)',
                borderRadius: 3,
                padding: '5px 8px',
                display: 'inline-block',
                alignSelf: 'flex-start',
              }}>
                {s.hint}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
