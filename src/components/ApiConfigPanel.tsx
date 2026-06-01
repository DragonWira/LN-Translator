import React, { useState } from 'react';
import { Eye, EyeOff, Key, Cpu, MessageSquare, ChevronDown, ChevronUp, RotateCcw } from 'lucide-react';
import type { ApiConfig } from '../types';
import { GROQ_MODELS, DEFAULT_SYSTEM_PROMPT } from '../types';

interface ApiConfigPanelProps {
  config: ApiConfig;
  onChange: (config: ApiConfig) => void;
  disabled: boolean;
}

export default function ApiConfigPanel({ config, onChange, disabled }: ApiConfigPanelProps) {
  const [showKey, setShowKey] = useState(false);
  const [promptExpanded, setPromptExpanded] = useState(true);

  const update = (partial: Partial<ApiConfig>) => onChange({ ...config, ...partial });

  return (
    <aside className="flex flex-col h-full bg-gray-900 border-r border-gray-800 overflow-y-auto">
      {/* Header */}
      <div className="px-5 py-4 border-b border-gray-800">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-emerald-500/20 flex items-center justify-center">
            <Cpu size={15} className="text-emerald-400" />
          </div>
          <div>
            <h2 className="text-sm font-semibold text-white leading-tight">API Configuration</h2>
            <p className="text-[11px] text-gray-500">Groq Cloud settings</p>
          </div>
        </div>
      </div>

      <div className="flex flex-col gap-5 p-5">
        {/* API Key */}
        <div className="flex flex-col gap-2">
          <label className="flex items-center gap-1.5 text-xs font-medium text-gray-400 uppercase tracking-wider">
            <Key size={11} />
            API Key
          </label>
          <div className="relative">
            <input
              type={showKey ? 'text' : 'password'}
              value={config.apiKey}
              onChange={e => update({ apiKey: e.target.value })}
              disabled={disabled}
              placeholder="gsk_..."
              className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2.5 text-sm text-white placeholder-gray-600 pr-9 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500/30 transition-colors disabled:opacity-50 disabled:cursor-not-allowed font-mono"
            />
            <button
              type="button"
              onClick={() => setShowKey(v => !v)}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-300 transition-colors"
            >
              {showKey ? <EyeOff size={14} /> : <Eye size={14} />}
            </button>
          </div>
          <p className="text-[11px] text-gray-600">Stored locally in your browser. Never sent elsewhere.</p>
        </div>

        {/* Model Selection */}
        <div className="flex flex-col gap-2">
          <label className="flex items-center gap-1.5 text-xs font-medium text-gray-400 uppercase tracking-wider">
            <Cpu size={11} />
            Model
          </label>
          <div className="relative">
            <select
              value={config.model}
              onChange={e => update({ model: e.target.value })}
              disabled={disabled}
              className="w-full appearance-none bg-gray-800 border border-gray-700 rounded-lg px-3 py-2.5 text-sm text-white focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500/30 transition-colors disabled:opacity-50 disabled:cursor-not-allowed pr-8"
            >
              {GROQ_MODELS.map(m => (
                <option key={m.id} value={m.id}>{m.label}</option>
              ))}
            </select>
            <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 pointer-events-none" />
          </div>
        </div>

        {/* Rate Limit Info */}
        <div className="bg-amber-500/10 border border-amber-500/20 rounded-lg p-3">
          <p className="text-[11px] text-amber-400 leading-relaxed">
            <span className="font-semibold">Rate Limit Guard</span> — A 4-second delay is automatically inserted between chapters to prevent Groq TPM/RPM limits.
          </p>
        </div>

        {/* System Prompt */}
        <div className="flex flex-col gap-2">
          <div className="flex items-center justify-between">
            <label className="flex items-center gap-1.5 text-xs font-medium text-gray-400 uppercase tracking-wider">
              <MessageSquare size={11} />
              System Prompt
            </label>
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => update({ systemPrompt: DEFAULT_SYSTEM_PROMPT })}
                disabled={disabled}
                title="Reset to default"
                className="p-1 text-gray-600 hover:text-gray-300 transition-colors disabled:opacity-40"
              >
                <RotateCcw size={12} />
              </button>
              <button
                type="button"
                onClick={() => setPromptExpanded(v => !v)}
                className="p-1 text-gray-600 hover:text-gray-300 transition-colors"
              >
                {promptExpanded ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
              </button>
            </div>
          </div>
          {promptExpanded && (
            <textarea
              value={config.systemPrompt}
              onChange={e => update({ systemPrompt: e.target.value })}
              disabled={disabled}
              rows={14}
              className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2.5 text-[12px] text-gray-300 placeholder-gray-600 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500/30 transition-colors disabled:opacity-50 disabled:cursor-not-allowed resize-none leading-relaxed font-mono"
            />
          )}
        </div>

        {/* Translation Tips */}
        <div className="bg-gray-800/60 border border-gray-700/50 rounded-lg p-3 flex flex-col gap-1.5">
          <p className="text-[11px] font-semibold text-gray-400">Tips for best results</p>
          <ul className="text-[11px] text-gray-600 space-y-1 list-disc list-inside">
            <li>Use Llama 3.3 70B for highest quality</li>
            <li>Chapters over 8k tokens may be truncated</li>
            <li>The prompt is fully customizable above</li>
          </ul>
        </div>
      </div>
    </aside>
  );
}
