'use client';

import { Record } from '@/lib/types';
import { renderMarkdown } from '@/lib/parser';
import { copyToClipboard, generateResumeLink } from '@/utils/resumeLink';
import { useState } from 'react';

interface RecordDetailProps {
  record?: Record | null;
}

export function RecordDetail({ record }: RecordDetailProps) {
  const [copied, setCopied] = useState(false);

  if (!record) {
    return (
      <div className="flex items-center justify-center h-full text-slate-500">
        <p>Select a record to view details</p>
      </div>
    );
  }

  const handleCopyLink = async () => {
    const link = generateResumeLink(window.location.origin, 'record', record.id);
    await copyToClipboard(link);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const formattedDate = new Date(record.created_at).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });

  const htmlContent = renderMarkdown(record.content);

  return (
    <div className="h-full overflow-y-auto flex flex-col">
      <div className="flex-1">
        <div className="p-6">
          <h2 className="text-3xl font-bold text-slate-900 mb-4">{record.title}</h2>

          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-6 pb-6 border-b border-slate-200">
            <div className="text-sm text-slate-600">
              <p className="mb-1">
                <span className="font-medium">Created:</span> {formattedDate}
              </p>
              {record.updated_at && (
                <p>
                  <span className="font-medium">Updated:</span>{' '}
                  {new Date(record.updated_at).toLocaleDateString('en-US', {
                    year: 'numeric',
                    month: 'long',
                    day: 'numeric',
                  })}
                </p>
              )}
            </div>

            <button
              onClick={handleCopyLink}
              className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                copied
                  ? 'bg-green-100 text-green-700'
                  : 'bg-blue-600 text-white hover:bg-blue-700'
              }`}
            >
              {copied ? '✓ Copied!' : '📋 Copy Resume Link'}
            </button>
          </div>

          {record.tags.length > 0 && (
            <div className="mb-6">
              <h3 className="text-sm font-semibold text-slate-900 mb-2">Tags</h3>
              <div className="flex flex-wrap gap-2">
                {record.tags.map(tag => (
                  <span
                    key={tag}
                    className="px-3 py-1 bg-slate-100 text-slate-700 rounded-full text-sm font-medium"
                  >
                    {tag}
                  </span>
                ))}
              </div>
            </div>
          )}

          {record.summary && (
            <div className="mb-6 p-4 bg-blue-50 border-l-4 border-blue-500 rounded">
              <h3 className="text-sm font-semibold text-blue-900 mb-2">Summary</h3>
              <p className="text-blue-800">{record.summary}</p>
            </div>
          )}

          <div className="prose prose-sm max-w-none">
            <div
              className="text-slate-800 leading-relaxed"
              dangerouslySetInnerHTML={{
                __html: htmlContent,
              }}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
