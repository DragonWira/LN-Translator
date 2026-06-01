import React, { useState, useCallback, useRef } from 'react';
import {
  BookOpen, Play, Square, Download, Zap, AlertCircle,
  CheckCircle2, Loader2, RefreshCw, BookMarked, Hash, Terminal
} from 'lucide-react';
import ApiConfigPanel from './components/ApiConfigPanel';
import FileUpload from './components/FileUpload';
import { ChapterList, LogConsole, ProgressBar } from './components/TranslationPanel';
import { parseEpub, repackEpub, downloadBlob } from './utils/epub';
import { translateChapter, sleep, estimateTokens, GroqRateLimitError, GroqAuthError } from './utils/groq';
import type { ApiConfig, Chapter, EpubData, LogEntry, TranslationStatus } from './types';
import { DEFAULT_SYSTEM_PROMPT, GROQ_MODELS } from './types';

const DELAY_BETWEEN_CHAPTERS_MS = 4000;

function loadConfig(): ApiConfig {
  try {
    const raw = localStorage.getItem('groq_epub_config');
    if (raw) {
      const parsed = JSON.parse(raw);
      return {
        apiKey: parsed.apiKey || '',
        model: parsed.model || GROQ_MODELS[0].id,
        systemPrompt: parsed.systemPrompt || DEFAULT_SYSTEM_PROMPT,
      };
    }
  } catch {}
  return { apiKey: '', model: GROQ_MODELS[0].id, systemPrompt: DEFAULT_SYSTEM_PROMPT };
}

function saveConfig(config: ApiConfig) {
  localStorage.setItem('groq_epub_config', JSON.stringify(config));
}

function makeLog(type: LogEntry['type'], message: string): LogEntry {
  return {
    id: `${Date.now()}-${Math.random()}`,
    timestamp: new Date().toLocaleTimeString(),
    type,
    message,
  };
}

export default function App() {
  const [config, setConfig] = useState<ApiConfig>(loadConfig);
  const [epubData, setEpubData] = useState<EpubData | null>(null);
  const [chapters, setChapters] = useState<Chapter[]>([]);
  const [status, setStatus] = useState<TranslationStatus>('idle');
  const [currentIndex, setCurrentIndex] = useState(-1);
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [totalTokens, setTotalTokens] = useState(0);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const abortRef = useRef(false);

  const addLog = useCallback((type: LogEntry['type'], message: string) => {
    setLogs(prev => [...prev.slice(-199), makeLog(type, message)]);
  }, []);

  const handleConfigChange = (cfg: ApiConfig) => {
    setConfig(cfg);
    saveConfig(cfg);
  };

  const handleFile = async (file: File) => {
    setStatus('parsing');
    setErrorMsg(null);
    setLogs([]);
    setChapters([]);
    setTotalTokens(0);
    setCurrentIndex(-1);
    addLog('info', `Loading "${file.name}"...`);
    try {
      const data = await parseEpub(file);
      setEpubData(data);
      setChapters(data.chapters);
      addLog('success', `Parsed ${data.chapters.length} chapters from "${file.name}"`);
      setStatus('idle');
    } catch (e: any) {
      addLog('error', e.message || 'Failed to parse EPUB');
      setErrorMsg(e.message || 'Failed to parse EPUB');
      setStatus('error');
      setEpubData(null);
    }
  };

  const handleClear = () => {
    if (status === 'translating') return;
    setEpubData(null);
    setChapters([]);
    setLogs([]);
    setStatus('idle');
    setErrorMsg(null);
    setTotalTokens(0);
    setCurrentIndex(-1);
  };

  const handleStart = async () => {
    if (!epubData || !config.apiKey.trim()) {
      setErrorMsg('Please provide a Groq API key and upload an EPUB file.');
      return;
    }
    setErrorMsg(null);
    abortRef.current = false;
    setStatus('translating');
    setTotalTokens(0);

    const chaptersCopy = chapters.map(c => ({ ...c, status: 'pending' as const, translatedContent: null }));
    setChapters(chaptersCopy);
    setLogs([]);
    addLog('info', `Starting translation — ${chaptersCopy.length} chapters, model: ${config.model}`);

    let runningTokens = 0;
    let completedCount = 0;
    const updated = [...chaptersCopy];

    for (let i = 0; i < updated.length; i++) {
      if (abortRef.current) {
        addLog('warning', 'Translation cancelled by user.');
        break;
      }

      setCurrentIndex(i);
      updated[i] = { ...updated[i], status: 'translating' };
      setChapters([...updated]);
      addLog('info', `Translating chapter ${i + 1}/${updated.length}: "${updated[i].title}"`);

      let attempts = 0;
      let success = false;

      while (attempts < 3 && !success && !abortRef.current) {
        try {
          const result = await translateChapter(
            config.apiKey,
            config.model,
            config.systemPrompt,
            updated[i].originalContent
          );
          updated[i] = {
            ...updated[i],
            status: 'done',
            translatedContent: result.translatedContent,
            tokensUsed: result.tokensUsed,
          };
          runningTokens += result.tokensUsed;
          completedCount++;
          setTotalTokens(runningTokens);
          setChapters([...updated]);
          addLog('success', `Chapter ${i + 1} done — ${result.tokensUsed.toLocaleString()} tokens`);
          success = true;
        } catch (e: any) {
          if (e instanceof GroqAuthError) {
            addLog('error', 'Invalid API key. Stopping translation.');
            setErrorMsg('Invalid Groq API key. Please check your key in the sidebar.');
            updated[i] = { ...updated[i], status: 'error' };
            setChapters([...updated]);
            abortRef.current = true;
            break;
          } else if (e instanceof GroqRateLimitError) {
            const wait = (e.retryAfter + 2) * 1000;
            addLog('warning', `Rate limited. Waiting ${e.retryAfter}s before retry...`);
            await sleep(wait);
            attempts++;
          } else {
            attempts++;
            addLog('warning', `Error on chapter ${i + 1} (attempt ${attempts}/3): ${e.message}`);
            if (attempts >= 3) {
              updated[i] = { ...updated[i], status: 'error' };
              setChapters([...updated]);
              addLog('error', `Skipped chapter ${i + 1} after 3 failed attempts.`);
            } else {
              await sleep(3000);
            }
          }
        }
      }

      // Delay between chapters (skip after last chapter)
      if (!abortRef.current && i < updated.length - 1) {
        addLog('info', `Waiting ${DELAY_BETWEEN_CHAPTERS_MS / 1000}s before next chapter...`);
        await sleep(DELAY_BETWEEN_CHAPTERS_MS);
      }
    }

    setCurrentIndex(-1);
    if (!abortRef.current) {
      addLog('success', `Translation complete! ${completedCount}/${updated.length} chapters translated. Total tokens: ${runningTokens.toLocaleString()}`);
      setStatus('done');
    } else {
      setStatus('idle');
    }

    // Update epubData chapters for download
    setEpubData(prev => prev ? { ...prev, chapters: updated } : null);
  };

  const handleStop = () => {
    abortRef.current = true;
    addLog('warning', 'Stop requested — finishing current chapter...');
  };

  const handleDownload = async () => {
    if (!epubData) return;
    addLog('info', 'Repacking EPUB...');
    try {
      const translatedEpub = { ...epubData, chapters };
      const blob = await repackEpub(translatedEpub);
      downloadBlob(blob, `${epubData.fileName}_ID.epub`);
      addLog('success', `Downloaded: ${epubData.fileName}_ID.epub`);
    } catch (e: any) {
      addLog('error', `Failed to repack EPUB: ${e.message}`);
    }
  };

  const doneCount = chapters.filter(c => c.status === 'done').length;
  const errorCount = chapters.filter(c => c.status === 'error').length;
  const totalChapters = chapters.length;
  const estimatedTokens = chapters.reduce((sum, c) => sum + estimateTokens(c.originalContent), 0);

  const isTranslating = status === 'translating';
  const canStart = !isTranslating && !!epubData && !!config.apiKey.trim() && chapters.length > 0;
  const canDownload = status === 'done' || (doneCount > 0 && status === 'idle' && epubData !== null);

  return (
    <div className="min-h-screen bg-gray-950 text-white flex flex-col">
      {/* Top Bar */}
      <header className="flex-shrink-0 h-12 border-b border-gray-800 flex items-center px-4 gap-3 bg-gray-900/80 backdrop-blur-sm z-10">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-emerald-500/20 flex items-center justify-center">
            <BookOpen size={15} className="text-emerald-400" />
          </div>
          <span className="font-semibold text-sm text-white tracking-tight">EPUB Novel Translator</span>
          <span className="hidden sm:inline text-[10px] text-gray-600 border border-gray-800 rounded px-1.5 py-0.5 font-mono">JP → ID</span>
        </div>
        <div className="flex-1" />
        <div className="flex items-center gap-2 text-[11px] text-gray-600">
          <Zap size={11} className="text-emerald-500" />
          <span>©DragonWira</span>
        </div>
        <button
          onClick={() => setSidebarOpen(v => !v)}
          className="ml-2 p-1.5 rounded-lg text-gray-500 hover:text-white hover:bg-gray-800 transition-colors text-[11px] border border-gray-800"
        >
          {sidebarOpen ? 'Hide Config' : 'Show Config'}
        </button>
      </header>

      <div className="flex flex-1 overflow-hidden">
        {/* Sidebar */}
        <div className={`flex-shrink-0 transition-all duration-300 overflow-hidden ${sidebarOpen ? 'w-72 xl:w-80' : 'w-0'}`}>
          <ApiConfigPanel config={config} onChange={handleConfigChange} disabled={isTranslating} />
        </div>

        {/* Main Content */}
        <main className="flex-1 overflow-y-auto p-4 lg:p-6 flex flex-col gap-5 min-w-0">
          {/* Page Title */}
          <div>
            <h1 className="text-xl font-bold text-white">EPUB Groq Cloud Novel Translator</h1>
            <p className="text-xs text-gray-500 mt-0.5">Japanese Light Novel → Indonesian Localization · Powered by Groq AI</p>
          </div>

          {/* Error Banner */}
          {errorMsg && (
            <div className="flex items-start gap-2.5 bg-red-500/10 border border-red-500/30 rounded-xl px-4 py-3">
              <AlertCircle size={15} className="text-red-400 flex-shrink-0 mt-0.5" />
              <p className="text-sm text-red-400">{errorMsg}</p>
              <button onClick={() => setErrorMsg(null)} className="ml-auto text-red-500 hover:text-red-300 transition-colors">
                <span className="text-lg leading-none">&times;</span>
              </button>
            </div>
          )}

          <div className="grid grid-cols-1 xl:grid-cols-5 gap-5">
            {/* Left Column: Upload + Stats + Actions */}
            <div className="xl:col-span-2 flex flex-col gap-4">
              {/* File Upload */}
              <div className="bg-gray-900 border border-gray-800 rounded-xl p-4 flex flex-col gap-3">
                <div className="flex items-center gap-2 mb-1">
                  <BookMarked size={14} className="text-gray-400" />
                  <h3 className="text-xs font-semibold text-gray-300 uppercase tracking-wider">Source File</h3>
                </div>
                <FileUpload
                  onFile={handleFile}
                  disabled={isTranslating || status === 'parsing'}
                  fileName={epubData?.fileName ? `${epubData.fileName}.epub` : undefined}
                  onClear={handleClear}
                />
                {status === 'parsing' && (
                  <div className="flex items-center gap-2 text-xs text-blue-400">
                    <Loader2 size={13} className="animate-spin" />
                    Parsing EPUB structure...
                  </div>
                )}
              </div>

              {/* Stats */}
              {chapters.length > 0 && (
                <div className="bg-gray-900 border border-gray-800 rounded-xl p-4 grid grid-cols-2 gap-3">
                  {[
                    { label: 'Chapters', value: totalChapters, icon: <BookOpen size={13} />, color: 'text-blue-400' },
                    { label: 'Translated', value: doneCount, icon: <CheckCircle2 size={13} />, color: 'text-emerald-400' },
                    { label: 'Est. Tokens', value: estimatedTokens.toLocaleString(), icon: <Hash size={13} />, color: 'text-amber-400' },
                    { label: 'Tokens Used', value: totalTokens.toLocaleString(), icon: <Zap size={13} />, color: 'text-emerald-400' },
                  ].map(stat => (
                    <div key={stat.label} className="bg-gray-800/60 rounded-lg p-2.5 flex flex-col gap-1">
                      <div className={`flex items-center gap-1 ${stat.color} text-[11px]`}>
                        {stat.icon}
                        <span className="font-medium">{stat.label}</span>
                      </div>
                      <p className="text-lg font-bold text-white leading-tight">{stat.value}</p>
                    </div>
                  ))}
                </div>
              )}

              {/* Action Buttons */}
              <div className="bg-gray-900 border border-gray-800 rounded-xl p-4 flex flex-col gap-3">
                {/* Start/Stop */}
                {isTranslating ? (
                  <button
                    onClick={handleStop}
                    className="w-full flex items-center justify-center gap-2 bg-red-500/10 hover:bg-red-500/20 border border-red-500/30 text-red-400 rounded-xl py-3 text-sm font-semibold transition-all"
                  >
                    <Square size={15} />
                    Stop Translation
                  </button>
                ) : (
                  <button
                    onClick={handleStart}
                    disabled={!canStart}
                    className="w-full flex items-center justify-center gap-2 bg-emerald-500 hover:bg-emerald-400 disabled:bg-gray-700 disabled:text-gray-500 disabled:cursor-not-allowed text-gray-950 disabled:text-gray-500 rounded-xl py-3 text-sm font-semibold transition-all shadow-lg shadow-emerald-500/10 hover:shadow-emerald-500/20"
                  >
                    <Play size={15} />
                    {doneCount > 0 && doneCount < totalChapters
                      ? 'Resume Translation'
                      : 'Start Translation'}
                  </button>
                )}

                {/* Progress bar while translating */}
                {isTranslating && (
                  <ProgressBar
                    current={doneCount}
                    total={totalChapters}
                    label={currentIndex >= 0 ? `Translating: "${chapters[currentIndex]?.title}"` : 'Processing...'}
                  />
                )}

                {/* Download */}
                <button
                  onClick={handleDownload}
                  disabled={!canDownload}
                  className={`w-full flex items-center justify-center gap-2 rounded-xl py-3 text-sm font-semibold transition-all border
                    ${canDownload
                      ? 'bg-blue-500/10 hover:bg-blue-500/20 border-blue-500/30 text-blue-400 hover:text-blue-300'
                      : 'bg-gray-800/40 border-gray-700 text-gray-600 cursor-not-allowed'
                    }
                  `}
                >
                  <Download size={15} />
                  Download Translated EPUB
                </button>

                {status === 'done' && (
                  <div className="flex items-center gap-2 text-[12px] text-emerald-400">
                    <CheckCircle2 size={13} />
                    Translation complete — {doneCount}/{totalChapters} chapters
                    {errorCount > 0 && <span className="text-amber-400 ml-1">({errorCount} skipped)</span>}
                  </div>
                )}

                {!epubData && !isTranslating && (
                  <p className="text-[11px] text-gray-600 text-center">Upload an EPUB and configure your API key to begin.</p>
                )}
                {epubData && !config.apiKey.trim() && !isTranslating && (
                  <p className="text-[11px] text-amber-500 text-center">Enter your Groq API key in the sidebar to start.</p>
                )}
              </div>
            </div>

            {/* Right Column: Chapters + Log */}
            <div className="xl:col-span-3 flex flex-col gap-4">
              {/* Chapter List */}
              {chapters.length > 0 && (
                <div className="bg-gray-900 border border-gray-800 rounded-xl p-4 flex flex-col gap-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <BookOpen size={14} className="text-gray-400" />
                      <h3 className="text-xs font-semibold text-gray-300 uppercase tracking-wider">Chapters</h3>
                    </div>
                    <div className="flex items-center gap-2 text-[11px]">
                      <span className="text-emerald-400">{doneCount} done</span>
                      {errorCount > 0 && <span className="text-red-400">{errorCount} error</span>}
                      <span className="text-gray-600">{totalChapters - doneCount - errorCount} pending</span>
                    </div>
                  </div>

                  {isTranslating && (
                    <ProgressBar current={doneCount} total={totalChapters} />
                  )}

                  <ChapterList chapters={chapters} currentIndex={currentIndex} />
                </div>
              )}

              {/* Log Console */}
              <div className="bg-gray-900 border border-gray-800 rounded-xl p-4 flex flex-col gap-3">
                <div className="flex items-center gap-2">
                  <Terminal size={14} className="text-gray-400" />
                  <h3 className="text-xs font-semibold text-gray-300 uppercase tracking-wider">Activity Log</h3>
                  {isTranslating && <Loader2 size={12} className="text-blue-400 animate-spin ml-auto" />}
                  {!isTranslating && logs.length > 0 && (
                    <button
                      onClick={() => setLogs([])}
                      className="ml-auto text-[11px] text-gray-600 hover:text-gray-400 flex items-center gap-1 transition-colors"
                    >
                      <RefreshCw size={10} /> Clear
                    </button>
                  )}
                </div>
                <LogConsole logs={logs} />
              </div>

              {/* Usage Guide (when no file loaded) */}
              {!epubData && status !== 'parsing' && (
                <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
                  <h3 className="text-sm font-semibold text-white mb-3">How to use</h3>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    {[
                      { step: '1', title: 'Configure', desc: 'Enter your Groq Cloud API key and select a model in the sidebar.' },
                      { step: '2', title: 'Upload', desc: 'Drag and drop your Japanese EPUB file into the upload zone.' },
                      { step: '3', title: 'Translate', desc: 'Click Start Translation. Download your localized EPUB when done.' },
                    ].map(item => (
                      <div key={item.step} className="flex gap-3">
                        <div className="w-6 h-6 rounded-full bg-emerald-500/20 text-emerald-400 text-[11px] font-bold flex items-center justify-center flex-shrink-0">
                          {item.step}
                        </div>
                        <div>
                          <p className="text-xs font-semibold text-gray-300">{item.title}</p>
                          <p className="text-[11px] text-gray-600 mt-0.5 leading-relaxed">{item.desc}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}
