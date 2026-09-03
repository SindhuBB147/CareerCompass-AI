'use client';

import React, { useRef, useState } from 'react';

interface FileDropInputProps {
  accept: string;
  onFileSelected: (file: File) => void;
  label: string;
  hint?: string;
  selectedFileName?: string | null;
}

export function FileDropInput({ accept, onFileSelected, label, hint, selectedFileName }: FileDropInputProps) {
  const [isDragActive, setIsDragActive] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFiles = (files: FileList | null) => {
    const file = files?.[0];
    if (file) onFileSelected(file);
  };

  return (
    <div
      className="admin-dropzone"
      data-active={isDragActive || undefined}
      role="button"
      tabIndex={0}
      onClick={() => inputRef.current?.click()}
      onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') inputRef.current?.click(); }}
      onDragOver={e => { e.preventDefault(); setIsDragActive(true); }}
      onDragLeave={() => setIsDragActive(false)}
      onDrop={e => { e.preventDefault(); setIsDragActive(false); handleFiles(e.dataTransfer.files); }}
    >
      <input
        ref={inputRef}
        type="file"
        accept={accept}
        onChange={e => handleFiles(e.target.files)}
        style={{ display: 'none' }}
        aria-label={label}
      />
      <strong style={{ display: 'block', color: 'var(--text-primary)', marginBottom: '4px' }}>
        {selectedFileName ? `📄 ${selectedFileName}` : `⬆ ${label}`}
      </strong>
      {hint && <span>{hint}</span>}
    </div>
  );
}
