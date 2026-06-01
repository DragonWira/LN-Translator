import React, { useCallback, useState } from 'react';
import { Upload, BookOpen, X, FileText } from 'lucide-react';

interface FileUploadProps {
  onFile: (file: File) => void;
  disabled: boolean;
  fileName?: string;
  onClear: () => void;
}

export default function FileUpload({ onFile, disabled, fileName, onClear }: FileUploadProps) {
  const [isDragging, setIsDragging] = useState(false);

  const handleDrop = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);
    if (disabled) return;
    const file = e.dataTransfer.files[0];
    if (file && file.name.toLowerCase().endsWith('.epub')) {
      onFile(file);
    }
  }, [onFile, disabled]);

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    if (!disabled) setIsDragging(true);
  };

  const handleDragLeave = () => setIsDragging(false);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) onFile(file);
    e.target.value = '';
  };

  if (fileName) {
    return (
      <div className="flex items-center gap-3 bg-gray-800/80 border border-emerald-500/30 rounded-xl px-4 py-3">
        <div className="w-9 h-9 rounded-lg bg-emerald-500/20 flex items-center justify-center flex-shrink-0">
          <BookOpen size={18} className="text-emerald-400" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-white truncate">{fileName}</p>
          <p className="text-xs text-emerald-500">EPUB loaded successfully</p>
        </div>
        <button
          onClick={onClear}
          disabled={disabled}
          className="p-1.5 rounded-lg text-gray-500 hover:text-white hover:bg-gray-700 transition-colors disabled:opacity-40"
          title="Remove file"
        >
          <X size={14} />
        </button>
      </div>
    );
  }

  return (
    <div
      onDrop={handleDrop}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      className={`relative flex flex-col items-center justify-center gap-3 border-2 border-dashed rounded-xl py-10 px-6 transition-all cursor-pointer
        ${isDragging
          ? 'border-emerald-400 bg-emerald-500/10 scale-[1.01]'
          : 'border-gray-700 bg-gray-800/40 hover:border-gray-600 hover:bg-gray-800/60'
        }
        ${disabled ? 'opacity-50 cursor-not-allowed' : ''}
      `}
      onClick={() => {
        if (!disabled) document.getElementById('epub-input')?.click();
      }}
    >
      <input
        id="epub-input"
        type="file"
        accept=".epub"
        className="hidden"
        onChange={handleInputChange}
        disabled={disabled}
      />
      <div className={`w-12 h-12 rounded-2xl flex items-center justify-center transition-colors ${isDragging ? 'bg-emerald-500/20' : 'bg-gray-700/80'}`}>
        {isDragging ? (
          <FileText size={22} className="text-emerald-400" />
        ) : (
          <Upload size={22} className="text-gray-400" />
        )}
      </div>
      <div className="text-center">
        <p className="text-sm font-medium text-gray-300">
          {isDragging ? 'Drop your EPUB here' : 'Drop your EPUB file here'}
        </p>
        <p className="text-xs text-gray-600 mt-0.5">or click to browse — .epub files only</p>
      </div>
    </div>
  );
}
