'use client';

import { useState } from 'react';

export function TagInput({ values, onChange, placeholder }: { values: string[]; onChange: (values: string[]) => void; placeholder?: string }) {
  const [draft, setDraft] = useState('');

  const commit = () => {
    const trimmed = draft.trim();
    if (trimmed && !values.includes(trimmed)) onChange([...values, trimmed]);
    setDraft('');
  };

  return (
    <div>
      <input
        className="input-editorial"
        value={draft}
        onChange={e => setDraft(e.target.value)}
        onKeyDown={e => {
          if (e.key === 'Enter' || e.key === ',') { e.preventDefault(); commit(); }
        }}
        onBlur={commit}
        placeholder={placeholder ?? 'Type and press Enter to add'}
      />
      {values.length > 0 && (
        <div className="wizard-chip-group" style={{ marginTop: '10px' }}>
          {values.map(v => (
            <button key={v} type="button" className="wizard-chip" data-selected="true" onClick={() => onChange(values.filter(x => x !== v))}>
              {v} ✕
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
