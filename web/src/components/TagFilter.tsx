'use client';

import { useState } from 'react';

interface TagFilterProps {
  allTags: string[];
  selectedTags: string[];
  onTagChange: (tags: string[]) => void;
}

export function TagFilter({ allTags, selectedTags, onTagChange }: TagFilterProps) {
  const [isOpen, setIsOpen] = useState(false);

  const handleTagToggle = (tag: string) => {
    if (selectedTags.includes(tag)) {
      onTagChange(selectedTags.filter(t => t !== tag));
    } else {
      onTagChange([...selectedTags, tag]);
    }
  };

  const handleClearAll = () => {
    onTagChange([]);
  };

  if (allTags.length === 0) {
    return null;
  }

  return (
    <div className="border-t border-slate-200 p-4">
      <h3 className="font-semibold text-slate-900 mb-3">Filter by Tags</h3>
      
      {/* Desktop: Show all tags */}
      <div className="hidden md:flex flex-wrap gap-2 mb-4">
        {allTags.map(tag => (
          <button
            key={tag}
            onClick={() => handleTagToggle(tag)}
            className={`px-3 py-1 rounded-full text-sm font-medium transition-colors ${
              selectedTags.includes(tag)
                ? 'bg-blue-600 text-white'
                : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
            }`}
          >
            {tag}
          </button>
        ))}
      </div>

      {/* Mobile: Dropdown */}
      <div className="md:hidden">
        <button
          onClick={() => setIsOpen(!isOpen)}
          className="w-full px-3 py-2 text-left bg-slate-100 rounded-lg text-slate-900 hover:bg-slate-200 transition-colors"
        >
          {selectedTags.length > 0 ? `${selectedTags.length} selected` : 'Select tags...'}
        </button>
        {isOpen && (
          <div className="mt-2 bg-white border border-slate-200 rounded-lg p-3 max-h-40 overflow-y-auto">
            {allTags.map(tag => (
              <label key={tag} className="flex items-center mb-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={selectedTags.includes(tag)}
                  onChange={() => handleTagToggle(tag)}
                  className="mr-2"
                />
                <span className="text-sm text-slate-700">{tag}</span>
              </label>
            ))}
          </div>
        )}
      </div>

      {selectedTags.length > 0 && (
        <div className="mt-3">
          <div className="flex flex-wrap gap-2 mb-2">
            {selectedTags.map(tag => (
              <span key={tag} className="inline-flex items-center gap-1 bg-blue-100 text-blue-700 px-2 py-1 rounded text-sm">
                {tag}
                <button
                  onClick={() => handleTagToggle(tag)}
                  className="hover:text-blue-900 font-bold"
                >
                  ×
                </button>
              </span>
            ))}
          </div>
          <button
            onClick={handleClearAll}
            className="text-xs text-slate-600 hover:text-slate-900 underline"
          >
            Clear all
          </button>
        </div>
      )}
    </div>
  );
}
