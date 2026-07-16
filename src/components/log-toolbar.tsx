'use client';

import { LogAutoScrollButton, LogCopyButton, LogClearButton } from '@/components/log-buttons';

interface LogToolbarProps {
  lines: string[];
  autoScroll: boolean;
  onAutoScrollChange: (value: boolean) => void;
  onClear: () => void;
  compact?: boolean;
}

export function LogToolbar({ lines, autoScroll, onAutoScrollChange, onClear, compact = false }: LogToolbarProps) {
  return (
    <div className="flex items-center gap-1">
      <LogAutoScrollButton autoScroll={autoScroll} onChange={onAutoScrollChange} compact={compact} />
      <LogCopyButton lines={lines} compact={compact} />
      <LogClearButton onClear={onClear} compact={compact} />
    </div>
  );
}
