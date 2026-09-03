'use client';

interface HeaderProps {
  onSelectFolder: () => void;
  onRefresh: () => void;
  isLoading?: boolean;
}

export function Header({ onSelectFolder, onRefresh, isLoading = false }: HeaderProps) {
  return (
    <header className="bg-white border-b border-slate-200 shadow-sm">
      <div className="max-w-full px-6 py-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-slate-900">Builder's Diary</h1>
            <p className="text-sm text-slate-600">Portfolio visualization & tag search</p>
          </div>
          <div className="flex gap-3">
            <button
              onClick={onSelectFolder}
              disabled={isLoading}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-slate-300 transition-colors font-medium"
            >
              Select Folder
            </button>
            <button
              onClick={onRefresh}
              disabled={isLoading}
              className="px-4 py-2 bg-slate-100 text-slate-900 rounded-lg hover:bg-slate-200 disabled:bg-slate-300 transition-colors font-medium"
            >
              {isLoading ? 'Loading...' : 'Refresh'}
            </button>
          </div>
        </div>
      </div>
    </header>
  );
}
