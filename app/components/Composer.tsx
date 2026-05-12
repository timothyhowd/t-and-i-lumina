'use client';

import { useEffect, useRef } from 'react';

/**
 * Chat composer. Auto-growing textarea, Enter to send,
 * Shift+Enter for newline. Soft shadow + slate styling, accent-color focus.
 */
export function Composer({
  value,
  onChange,
  onSubmit,
  disabled,
  placeholder,
  autoFocus = true,
}: {
  value: string;
  onChange: (v: string) => void;
  onSubmit: () => void;
  disabled?: boolean;
  placeholder?: string;
  autoFocus?: boolean;
}) {
  const ref = useRef<HTMLTextAreaElement | null>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${Math.min(el.scrollHeight, 220)}px`;
  }, [value]);

  function handleKey(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && !e.shiftKey && !e.metaKey && !e.ctrlKey && !e.nativeEvent.isComposing) {
      e.preventDefault();
      if (!disabled && value.trim().length > 0) onSubmit();
    }
  }

  return (
    <div className="relative flex items-end gap-2 rounded-lg border border-line bg-card p-1.5 shadow-s1 focus-within:border-accent/60 focus-within:shadow-s2 transition-all">
      <textarea
        ref={ref}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={handleKey}
        disabled={disabled}
        placeholder={placeholder ?? 'Describe what you need…'}
        rows={1}
        autoFocus={autoFocus}
        className="flex-1 resize-none bg-transparent px-3 py-2 text-[14.5px] leading-6 focus:outline-none disabled:opacity-60 placeholder:text-muted"
      />
      <button
        type="button"
        onClick={() => !disabled && value.trim() && onSubmit()}
        disabled={disabled || !value.trim()}
        aria-label="Send"
        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-ink text-white shadow-s1 transition-all hover:bg-ink-2 active:scale-95 disabled:bg-line disabled:text-muted disabled:cursor-not-allowed disabled:shadow-none"
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M5 12h14M13 5l7 7-7 7" />
        </svg>
      </button>
    </div>
  );
}
