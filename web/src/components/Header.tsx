'use client';

interface HeaderProps {
  onSelectFolder: () => void;
  onRefresh: () => void;
  isLoading?: boolean;
}

export function Header({ onSelectFolder, onRefresh, isLoading = false }: HeaderProps) {
  return (
    <header style={{
      backgroundColor: 'var(--bg-primary)',
      borderBottom: '1px solid var(--rule)',
      padding: '24px 32px',
    }}>
      <div style={{
        maxWidth: '100%',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
      }}>
        <div>
          <h1 style={{
            fontFamily: "'Instrument Serif', serif",
            fontSize: '28px',
            fontWeight: '700',
            color: 'var(--ink)',
            margin: '0 0 8px 0',
          }}>
            Builder's Diary
          </h1>
          <p style={{
            fontFamily: "'IBM Plex Mono', monospace",
            fontSize: '12px',
            color: 'var(--muted)',
            margin: '0',
            letterSpacing: '0.05em',
          }}>
            Portfolio visualization & tag search
          </p>
        </div>
        <div style={{
          display: 'flex',
          gap: '12px',
        }}>
          <button
            onClick={onSelectFolder}
            disabled={isLoading}
            style={{
              fontFamily: "'IBM Plex Mono', monospace",
              padding: '10px 20px',
              backgroundColor: isLoading ? 'var(--muted)' : 'var(--accent-primary)',
              color: 'var(--bg-primary)',
              border: `1px solid ${isLoading ? 'var(--muted)' : 'var(--accent-primary)'}`,
              borderRadius: '2px',
              cursor: isLoading ? 'not-allowed' : 'pointer',
              fontSize: '12px',
              fontWeight: '500',
              letterSpacing: '0.08em',
              transition: 'all 0.2s ease',
              opacity: isLoading ? 0.6 : 1,
            }}
            onMouseEnter={(e) => !isLoading && (e.currentTarget.style.backgroundColor = 'var(--ink)')}
            onMouseLeave={(e) => !isLoading && (e.currentTarget.style.backgroundColor = 'var(--accent-primary)')}
          >
            SELECT FOLDER
          </button>
          <button
            onClick={onRefresh}
            disabled={isLoading}
            style={{
              fontFamily: "'IBM Plex Mono', monospace",
              padding: '10px 20px',
              backgroundColor: 'transparent',
              color: 'var(--text-primary)',
              border: '1px solid var(--rule)',
              borderRadius: '2px',
              cursor: isLoading ? 'not-allowed' : 'pointer',
              fontSize: '12px',
              fontWeight: '500',
              letterSpacing: '0.08em',
              transition: 'all 0.2s ease',
              opacity: isLoading ? 0.6 : 1,
            }}
            onMouseEnter={(e) => !isLoading && (e.currentTarget.style.borderColor = 'var(--accent-primary)')}
            onMouseLeave={(e) => !isLoading && (e.currentTarget.style.borderColor = 'var(--rule)')}
          >
            {isLoading ? 'LOADING...' : 'REFRESH'}
          </button>
        </div>
      </div>
    </header>
  );
}
