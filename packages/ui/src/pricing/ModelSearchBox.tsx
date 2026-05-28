import React, { useState } from 'react';

function SearchIcon() {
  return (
    <svg
      width="13"
      height="13"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <circle cx="11" cy="11" r="8" />
      <line x1="21" y1="21" x2="16.65" y2="16.65" />
    </svg>
  );
}

function ClearIcon() {
  return (
    <svg
      width="12"
      height="12"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
      strokeLinecap="round"
    >
      <line x1="18" y1="6" x2="6" y2="18" />
      <line x1="6" y1="6" x2="18" y2="18" />
    </svg>
  );
}

export interface ModelSearchBoxProps extends Omit<
  React.InputHTMLAttributes<HTMLInputElement>,
  'onChange'
> {
  value: string;
  onChange: (value: string) => void;
}

export const ModelSearchBox = React.forwardRef<
  HTMLInputElement,
  ModelSearchBoxProps
>(
  (
    { value, onChange, placeholder = 'Search models…', style, ...props },
    ref,
  ) => {
    const [focused, setFocused] = useState(false);

    return (
      <div
        style={{ position: 'relative', width: '100%', fontFamily: 'inherit' }}
      >
        <div
          style={{
            position: 'absolute',
            left: 10,
            top: '50%',
            transform: 'translateY(-50%)',
            color: 'var(--muted-foreground)',
            pointerEvents: 'none',
            display: 'flex',
            alignItems: 'center',
          }}
        >
          <SearchIcon />
        </div>
        <input
          ref={ref}
          type="text"
          value={value}
          placeholder={placeholder}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          onChange={e => onChange(e.target.value)}
          style={{
            width: '100%',
            boxSizing: 'border-box',
            fontFamily: 'inherit',
            fontSize: 13,
            height: 36,
            paddingLeft: 30,
            paddingRight: value ? 32 : 12,
            background: 'var(--card)',
            color: 'var(--card-foreground)',
            border: `1px solid ${focused ? 'var(--ring, var(--border))' : 'var(--border)'}`,
            borderRadius: 'var(--radius, 0.75rem)',
            outline: 'none',
            transition: 'border-color 0.15s',
            ...style,
          }}
          {...props}
        />
        {value && (
          <button
            type="button"
            onClick={() => onChange('')}
            style={{
              position: 'absolute',
              right: 8,
              top: '50%',
              transform: 'translateY(-50%)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: 20,
              height: 20,
              border: 'none',
              background: 'transparent',
              color: 'var(--muted-foreground)',
              cursor: 'pointer',
              padding: 0,
              borderRadius: 4,
            }}
          >
            <ClearIcon />
          </button>
        )}
      </div>
    );
  },
);
ModelSearchBox.displayName = 'ModelSearchBox';
