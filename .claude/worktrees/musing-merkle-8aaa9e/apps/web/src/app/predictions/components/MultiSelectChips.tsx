'use client';

interface Props {
  options: string[];
  selected: string[];
  onChange: (next: string[]) => void;
  maxHeight?: string;
}

/** Generic chip-based multi-select, reused for course preferences and
 * horizontal reservations — built once since no multi-select exists in
 * components/ui, styled with the existing badge-editorial chip. */
export function MultiSelectChips({ options, selected, onChange, maxHeight }: Props) {
  const toggle = (option: string) => {
    if (selected.includes(option)) onChange(selected.filter(o => o !== option));
    else onChange([...selected, option]);
  };

  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', maxHeight, overflowY: maxHeight ? 'auto' : undefined, padding: maxHeight ? '4px 2px' : undefined }}>
      {options.map(option => {
        const isSelected = selected.includes(option);
        return (
          <button
            key={option}
            type="button"
            onClick={() => toggle(option)}
            className="badge-editorial"
            style={{
              cursor: 'pointer',
              border: isSelected ? '1.5px solid var(--accent-blue)' : '1px solid var(--border-color)',
              backgroundColor: isSelected ? 'var(--accent-blue)' : 'transparent',
              color: isSelected ? '#FFFFFF' : 'var(--text-primary)',
              fontWeight: isSelected ? 600 : 500,
            }}
          >
            {isSelected ? '✓ ' : ''}{option}
          </button>
        );
      })}
    </div>
  );
}
