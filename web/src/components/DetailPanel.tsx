'use client';

import React from 'react';
import { Record } from '@/lib/types';

interface DetailPanelProps {
  record: Record | null;
}

export function DetailPanel({ record }: DetailPanelProps) {
  if (!record) {
    return (
      <div className="flex items-center justify-center h-full text-slate-400 p-8">
        <div className="text-center">
          <p className="text-lg font-medium">Select a record to view details</p>
          <p className="text-sm mt-2">Click on any card to see more information</p>
        </div>
      </div>
    );
  }

  const statusColors: { [key: string]: { bg: string; text: string } } = {
    completed: { bg: 'bg-green-100', text: 'text-green-700' },
    in_progress: { bg: 'bg-blue-100', text: 'text-blue-700' },
    blocked: { bg: 'bg-red-100', text: 'text-red-700' }
  };

  const statusLabel = record.status || 'pending';
  const statusColor = statusColors[statusLabel] || { bg: 'bg-slate-100', text: 'text-slate-700' };

  return (
    <div className="h-full overflow-y-auto">
      <div className="p-8 max-w-2xl">
        {/* Header */}
        <div className="mb-6">
          <h1 className="text-3xl font-bold text-slate-900 mb-3">{record.title}</h1>
          
          {/* Status Badge */}
          {record.status && (
            <div className={`inline-block ${statusColor.bg} ${statusColor.text} px-3 py-1 rounded-full text-sm font-semibold capitalize`}>
              {statusLabel.replace('_', ' ')}
            </div>
          )}
        </div>

        {/* Meta Information */}
        <div className="bg-slate-50 rounded-lg p-4 mb-6 space-y-3">
          <div>
            <p className="text-xs font-semibold text-slate-600 uppercase tracking-wider">Created</p>
            <p className="text-sm text-slate-900 mt-1">
              {new Date(record.created_at).toLocaleDateString('en-US', {
                year: 'numeric',
                month: 'long',
                day: 'numeric'
              })}
            </p>
          </div>
          {record.updated_at && (
            <div>
              <p className="text-xs font-semibold text-slate-600 uppercase tracking-wider">Updated</p>
              <p className="text-sm text-slate-900 mt-1">
                {new Date(record.updated_at).toLocaleDateString('en-US', {
                  year: 'numeric',
                  month: 'long',
                  day: 'numeric'
                })}
              </p>
            </div>
          )}
        </div>

        {/* Summary */}
        {record.summary && (
          <div className="mb-6">
            <h2 className="text-lg font-semibold text-slate-900 mb-3">Summary</h2>
            <p className="text-slate-700 leading-relaxed">{record.summary}</p>
          </div>
        )}

        {/* Tags */}
        {record.tags && record.tags.length > 0 && (
          <div className="mb-6">
            <h2 className="text-lg font-semibold text-slate-900 mb-3">Tags</h2>
            <div className="flex flex-wrap gap-2">
              {record.tags.map((tag) => (
                <span
                  key={tag}
                  className="inline-block bg-emerald-100 text-emerald-700 px-3 py-1 rounded-full text-sm font-medium"
                >
                  {tag}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Content */}
        {record.content && (
          <div className="mb-6">
            <h2 className="text-lg font-semibold text-slate-900 mb-3">Details</h2>
            <div className="prose prose-sm max-w-none">
              <div className="bg-slate-50 rounded-lg p-4 text-sm text-slate-700 leading-relaxed whitespace-pre-wrap">
                {record.content.substring(0, 500)}
                {record.content.length > 500 && '...'}
              </div>
            </div>
          </div>
        )}

        {/* File Path */}
        {record.file_path && (
          <div className="mt-8 pt-6 border-t border-slate-200">
            <p className="text-xs font-semibold text-slate-600 uppercase tracking-wider">File Path</p>
            <p className="text-xs text-slate-500 mt-1 font-mono break-all">{record.file_path}</p>
          </div>
        )}
      </div>
    </div>
  );
}
