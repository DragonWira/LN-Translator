import React, { useEffect, useRef } from 'react';
import { CheckCircle2, XCircle, Clock, Loader2, AlertTriangle } from 'lucide-react';
import type { Chapter, LogEntry } from '../types';

interface ChapterListProps {
  chapters: Chapter[];
  currentIndex: number;
}

function statusIcon(status: Chapter['status']) {
  switch (status) {
    case 'done': return <CheckCircle2 size={13} className="text-emerald-400 flex-shrink-0" />;
    case 'error': return <XCircle size={13} className="text-red-400 flex-shrink-0" />;
    case 'translating': return <Loader2 size={13} className="text-blue-400 flex-shrink-0 animate-spin" />;
    default: return <Clock size={13} className="text-gray-600 flex-shrink-0" />;
  }
}

export function ChapterList({ chapters, currentIndex }: ChapterListProps) {
  const activeRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    activeRef.current?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  }, [currentIndex]);

  return (
    <div className="flex flex-col gap-0.5 overflow-y-auto max-h-52 pr-1 scrollbar-thin">
      {chapters.map((ch, i) => (
        <div
          key={ch.id}
          ref={i === currentIndex ? activeRef : undefined}
          className={`flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-[12px] transition-colors
            ${ch.status === 'translating' ? 'bg-blue-500/10 border border-blue-500/20' :
              ch.status === 'done' ? 'bg-gray-800/40' :
              ch.status === 'error' ? 'bg-red-500/10 border border-red-500/20' :
              'hover:bg-gray-800/30'}
          `}
        >
          {statusIcon(ch.status)}
          <span className={`truncate flex-1 ${ch.status === 'done' ? 'text-gray-400' : ch.status === 'translating' ? 'text-white font-medium' : 'text-gray-500'}`}>
            {ch.title}
          </span>
          {ch.tokensUsed && ch.tokensUsed > 0 && (
            <span className="text-[10px] text-gray-600 flex-shrink-0">{ch.tokensUsed.toLocaleString()} tok</span>
          )}
        </div>
      ))}
    </div>
  );
}

interface LogConsoleProps {
  logs: LogEntry[];
}

function logIcon(type: LogEntry['type']) {
  switch (type) {
    case 'success': return <CheckCircle2 size={11} className="text-emerald-400 flex-shrink-0 mt-0.5" />;
    case 'error': return <XCircle size={11} className="text-red-400 flex-shrink-0 mt-0.5" />;
    case 'warning': return <AlertTriangle size={11} className="text-amber-400 flex-shrink-0 mt-0.5" />;
    default: return <div className="w-1.5 h-1.5 rounded-full bg-gray-600 flex-shrink-0 mt-1.5" />;
  }
}

function logTextColor(type: LogEntry['type']) {
  switch (type) {
    case 'success': return 'text-emerald-400';
    case 'error': return 'text-red-400';
    case 'warning': return 'text-amber-400';
    default: return 'text-gray-400';
  }
}

export function LogConsole({ logs }: LogConsoleProps) {
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [logs]);

  return (
    <div className="bg-gray-950 border border-gray-800 rounded-xl p-3 h-44 overflow-y-auto font-mono text-[11px] flex flex-col gap-1 scrollbar-thin">
      {logs.length === 0 ? (
        <p className="text-gray-700 italic">Awaiting translation start...</p>
      ) : (
        logs.map(log => (
          <div key={log.id} className="flex items-start gap-1.5">
            {logIcon(log.type)}
            <span className="text-gray-600">{log.timestamp}</span>
            <span className={logTextColor(log.type)}>{log.message}</span>
          </div>
        ))
      )}
      <div ref={bottomRef} />
    </div>
  );
}

interface ProgressBarProps {
  current: number;
  total: number;
  label?: string;
}

export function ProgressBar({ current, total, label }: ProgressBarProps) {
  const pct = total > 0 ? Math.round((current / total) * 100) : 0;
  return (
    <div className="flex flex-col gap-1.5">
      {label && (
        <div className="flex justify-between items-center">
          <span className="text-xs text-gray-400">{label}</span>
          <span className="text-xs font-mono text-gray-500">{current} / {total} ({pct}%)</span>
        </div>
      )}
      <div className="h-2 bg-gray-800 rounded-full overflow-hidden">
        <div
          className="h-full bg-gradient-to-r from-emerald-600 to-emerald-400 rounded-full transition-all duration-500 ease-out"
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}
