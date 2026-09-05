'use client';

import React, { useState, useRef, useEffect, useMemo } from 'react';

export interface SelectOption {
  value: string;
  label: string;
  group?: string;   // category header (e.g. Mindset / Tools)
  count?: number;   // optional count badge
}

interface SearchableSelectProps {
  options: SelectOption[];
  value: string | string[] | null;
  onChange: (value: any) => void;
  multiple?: boolean;
  placeholder?: string;          // shown on the trigger when nothing selected
  searchPlaceholder?: string;    // shown in the keyword input
  allOptionLabel?: string;       // single-select only: a synthetic "All" option
  minWidth?: number;
  emptyText?: string;
}

export function SearchableSelect({
  options,
  value,
  onChange,
  multiple = false,
  placeholder = 'Select…',
  searchPlaceholder = 'Search…',
  allOptionLabel,
  minWidth = 180,
  emptyText = 'No results',
}: SearchableSelectProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [activeIdx, setActiveIdx] = useState(0);
  const rootRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const selectedArr: string[] = multiple
    ? (Array.isArray(value) ? value : [])
    : (typeof value === 'string' && value ? [value] : []);

  // close on outside click
  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, [open]);

  // focus the input when opening
  useEffect(() => {
    if (open) {
      setQuery('');
      setActiveIdx(0);
      setTimeout(() => inputRef.current?.focus(), 0);
    }
  }, [open]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return options;
    return options.filter(o => o.label.toLowerCase().includes(q));
  }, [options, query]);

  // grouped structure preserving order
  const grouped = useMemo(() => {
    const map = new Map<string, SelectOption[]>();
    for (const o of filtered) {
      const g = o.group || '';
      if (!map.has(g)) map.set(g, []);
      map.get(g)!.push(o);
    }
    return Array.from(map.entries()); // [group, options][]
  }, [filtered]);

  // flat list (for keyboard nav) in the same visual order
  const flat = useMemo(() => grouped.flatMap(([, opts]) => opts), [grouped]);

  const triggerLabel = useMemo(() => {
    if (multiple) {
      if (selectedArr.length === 0) return placeholder;
      if (selectedArr.length === 1) {
        const o = options.find(o => o.value === selectedArr[0]);
        return o ? o.label : `${selectedArr.length} selected`;
      }
      return `${selectedArr.length} selected`;
    }
    if (!value || value === '__all__') return allOptionLabel || placeholder;
    const o = options.find(o => o.value === value);
    return o ? o.label : placeholder;
  }, [multiple, selectedArr, value, options, placeholder, allOptionLabel]);

  const isPlaceholder = multiple ? selectedArr.length === 0 : (!value || value === '__all__');

  const handlePick = (val: string) => {
    if (multiple) {
      const set = new Set(selectedArr);
      if (set.has(val)) set.delete(val); else set.add(val);
      onChange(Array.from(set));
      // keep open for multi
    } else {
      onChange(val === '__all__' ? null : val);
      setOpen(false);
    }
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActiveIdx(i => Math.min(i + 1, flat.length - 1 + (allOptionLabel && !multiple ? 1 : 0)));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActiveIdx(i => Math.max(i - 1, 0));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      const withAll = (!multiple && allOptionLabel)
        ? [{ value: '__all__', label: allOptionLabel } as SelectOption, ...flat]
        : flat;
      const opt = withAll[activeIdx];
      if (opt) handlePick(opt.value);
    } else if (e.key === 'Escape') {
      setOpen(false);
    }
  };

  // index accounting for the synthetic all-option at top
  let runningIdx = 0;
  const allActive = !multiple && allOptionLabel && activeIdx === 0;

  return (
    <div ref={rootRef} style={{ position: 'relative', minWidth }}>
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        style={{
          width: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 8,
          padding: '7px 10px',
          background: 'var(--surface)',
          border: `1px solid ${open ? 'var(--accent)' : 'var(--border)'}`,
          borderRadius: 4,
          color: isPlaceholder ? 'var(--text3)' : 'var(--text)',
          fontSize: 12,
          fontFamily: "'IBM Plex Mono', monospace",
          transition: 'border-color 0.15s',
        }}
      >
        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {triggerLabel}
        </span>
        <span style={{ color: 'var(--text3)', fontSize: 9, flexShrink: 0 }}>▼</span>
      </button>

      {open && (
        <div
          style={{
            position: 'absolute',
            top: 'calc(100% + 4px)',
            left: 0,
            right: 0,
            minWidth,
            zIndex: 50,
            background: 'var(--surface)',
            border: '1px solid var(--border2)',
            borderRadius: 4,
            boxShadow: '0 8px 24px rgba(0,0,0,0.5)',
            overflow: 'hidden',
          }}
        >
          <div style={{ padding: 8, borderBottom: '1px solid var(--border)' }}>
            <input
              ref={inputRef}
              value={query}
              onChange={e => { setQuery(e.target.value); setActiveIdx(0); }}
              onKeyDown={onKeyDown}
              placeholder={searchPlaceholder}
              style={{
                width: '100%',
                padding: '6px 8px',
                background: 'var(--bg)',
                border: '1px solid var(--border)',
                borderRadius: 3,
                color: 'var(--text)',
                fontSize: 12,
                outline: 'none',
                fontFamily: "'IBM Plex Mono', monospace",
              }}
            />
          </div>

          <div className="thin-scroll" style={{ maxHeight: 280, overflowY: 'auto', padding: 4 }}>
            {/* synthetic ALL option for single-select */}
            {!multiple && allOptionLabel && (
              (() => {
                const q = query.trim().toLowerCase();
                if (q && !allOptionLabel.toLowerCase().includes(q)) return null;
                const selected = !value || value === '__all__';
                return (
                  <div
                    onMouseEnter={() => setActiveIdx(0)}
                    onClick={() => handlePick('__all__')}
                    style={rowStyle(selected, allActive as boolean)}
                  >
                    <span>{allOptionLabel}</span>
                    {selected && <span style={{ color: 'var(--accent)' }}>✓</span>}
                  </div>
                );
              })()
            )}

            {flat.length === 0 ? (
              <div style={{ padding: '12px 10px', color: 'var(--text3)', fontSize: 12, textAlign: 'center' }}>
                {emptyText}
              </div>
            ) : (
              grouped.map(([group, opts]) => (
                <div key={group || '__nogroup__'}>
                  {group && (
                    <div style={{
                      padding: '8px 10px 4px',
                      fontSize: 10,
                      color: 'var(--text3)',
                      textTransform: 'uppercase',
                      letterSpacing: '0.08em',
                    }}>
                      {group}
                    </div>
                  )}
                  {opts.map(o => {
                    const idxBase = (!multiple && allOptionLabel) ? 1 : 0;
                    const myIdx = idxBase + runningIdx;
                    runningIdx += 1;
                    const selected = selectedArr.includes(o.value);
                    const active = activeIdx === myIdx;
                    return (
                      <div
                        key={o.value}
                        onMouseEnter={() => setActiveIdx(myIdx)}
                        onClick={() => handlePick(o.value)}
                        style={rowStyle(selected, active)}
                      >
                        <span style={{ display: 'flex', alignItems: 'center', gap: 8, overflow: 'hidden' }}>
                          {multiple && (
                            <span style={{
                              width: 13, height: 13, flexShrink: 0,
                              border: `1px solid ${selected ? 'var(--accent)' : 'var(--border2)'}`,
                              background: selected ? 'var(--accent)' : 'transparent',
                              borderRadius: 2,
                              display: 'flex', alignItems: 'center', justifyContent: 'center',
                              fontSize: 9, color: 'var(--bg)', fontWeight: 700,
                            }}>
                              {selected ? '✓' : ''}
                            </span>
                          )}
                          <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {o.label}
                          </span>
                        </span>
                        <span style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
                          {typeof o.count === 'number' && (
                            <span style={{ color: 'var(--text3)', fontSize: 11 }}>{o.count}</span>
                          )}
                          {!multiple && selected && <span style={{ color: 'var(--accent)' }}>✓</span>}
                        </span>
                      </div>
                    );
                  })}
                </div>
              ))
            )}
          </div>

          {multiple && selectedArr.length > 0 && (
            <div style={{
              padding: '6px 8px',
              borderTop: '1px solid var(--border)',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
            }}>
              <span style={{ fontSize: 11, color: 'var(--text3)' }}>{selectedArr.length} selected</span>
              <button
                onClick={() => onChange([])}
                style={{
                  background: 'none', border: 'none', color: 'var(--text2)',
                  fontSize: 11, cursor: 'pointer', padding: '2px 6px',
                }}
              >
                Clear
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function rowStyle(selected: boolean, active: boolean): React.CSSProperties {
  return {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
    padding: '7px 10px',
    borderRadius: 3,
    cursor: 'pointer',
    fontSize: 12,
    color: selected ? 'var(--accent)' : 'var(--text)',
    background: active ? 'var(--surface2)' : 'transparent',
    transition: 'background 0.1s',
  };
}
