import type React from 'react';

export const chatContainer: React.CSSProperties = {
  fontFamily: 'inherit',
  width: '100%',
  boxSizing: 'border-box',
  display: 'flex',
  flexDirection: 'column',
  height: '100%',
  minHeight: 0,
  background: 'var(--background)',
  color: 'var(--foreground)',
  border: '1px solid var(--border)',
  borderRadius: 'var(--radius, 0.75rem)',
  overflow: 'hidden',
};

// ── Message list ────────────────────────────────────────────────────────────

export const messagesList: React.CSSProperties = {
  flex: 1,
  minHeight: 0,
  overflowY: 'auto',
  padding: '16px 20px 8px',
  display: 'flex',
  flexDirection: 'column',
  gap: '8px',
};

// ── User message ─────────────────────────────────────────────────────────────

export const userMessageRow: React.CSSProperties = {
  display: 'flex',
  justifyContent: 'flex-end',
};

export const userBubble: React.CSSProperties = {
  maxWidth: '75%',
  padding: '9px 16px',
  borderRadius: '20px',
  borderBottomRightRadius: '6px',
  fontSize: '14px',
  lineHeight: 1.6,
  whiteSpace: 'pre-wrap',
  wordBreak: 'break-word',
  background: 'var(--muted)',
  color: 'var(--foreground)',
};

// ── Assistant message ────────────────────────────────────────────────────────

export const assistantMessageRow: React.CSSProperties = {
  display: 'flex',
  gap: '10px',
  alignItems: 'flex-start',
};

export const assistantIcon: React.CSSProperties = {
  width: '18px',
  height: '18px',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  flexShrink: 0,
  marginTop: '3px',
  color: 'var(--muted-foreground)',
  opacity: 0.6,
};

export const assistantText: React.CSSProperties = {
  flex: 1,
  fontSize: '14px',
  lineHeight: 1.65,
  color: 'var(--foreground)',
  whiteSpace: 'pre-wrap',
  wordBreak: 'break-word',
};

// ── Loading dots ─────────────────────────────────────────────────────────────

export const loadingDots: React.CSSProperties = {
  display: 'flex',
  gap: '3px',
  padding: '2px 0 2px 28px',
};

export const dot: React.CSSProperties = {
  width: '4px',
  height: '4px',
  borderRadius: '50%',
  background: 'var(--muted-foreground)',
};

// ── Empty state ───────────────────────────────────────────────────────────────

export const emptyState: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  flex: 1,
  fontSize: '13px',
  color: 'var(--muted-foreground)',
  padding: '32px 24px',
  textAlign: 'center',
};

export const emptyCenterWrap: React.CSSProperties = {
  flex: 1,
  minHeight: 0,
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  justifyContent: 'flex-start',
  padding: '0 24px 32px',
};

export const emptyHeroTitle: React.CSSProperties = {
  fontSize: '26px',
  fontWeight: 700,
  color: 'var(--foreground)',
  textAlign: 'center',
  margin: '0 0 8px',
  lineHeight: 1.2,
};

export const emptyHeroSubtitle: React.CSSProperties = {
  fontSize: '14px',
  color: 'var(--muted-foreground)',
  textAlign: 'center',
  margin: '0 0 28px',
};

export const promptsGrid: React.CSSProperties = {
  display: 'grid',
  gridTemplateColumns: '1fr 1fr',
  gap: '8px',
  width: '100%',
  maxWidth: '540px',
};

export const promptCardBtn: React.CSSProperties = {
  padding: '12px 14px',
  background: 'var(--card)',
  border: '1px solid var(--border)',
  borderRadius: '12px',
  fontSize: '13px',
  color: 'var(--muted-foreground)',
  cursor: 'pointer',
  textAlign: 'left',
  lineHeight: 1.45,
  fontFamily: 'inherit',
  width: '100%',
};

// ── Floating input card ───────────────────────────────────────────────────────

export const inputCard: React.CSSProperties = {
  margin: '0 12px 12px',
  border: '1px solid var(--border)',
  borderRadius: '18px',
  background: 'var(--card)',
  flexShrink: 0,
  overflow: 'hidden',
};

export const inputCardTextarea: React.CSSProperties = {
  fontFamily: 'inherit',
  display: 'block',
  width: '100%',
  minHeight: '52px',
  maxHeight: '180px',
  padding: '14px 16px 6px',
  fontSize: '14px',
  lineHeight: 1.55,
  color: 'var(--foreground)',
  background: 'transparent',
  border: 'none',
  resize: 'none',
  outline: 'none',
  boxSizing: 'border-box',
};

export const inputCardBottom: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  padding: '4px 10px 10px',
};

export const modelChipButton: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: '6px',
  fontSize: '12px',
  color: 'var(--muted-foreground)',
  background: 'transparent',
  border: 'none',
  cursor: 'pointer',
  padding: '3px 6px',
  borderRadius: '6px',
  fontFamily: 'inherit',
};

export const sendCircle: React.CSSProperties = {
  width: '30px',
  height: '30px',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  border: 'none',
  borderRadius: '50%',
  background: 'var(--foreground)',
  color: 'var(--background)',
  cursor: 'pointer',
  flexShrink: 0,
};

export const stopCircle: React.CSSProperties = {
  width: '30px',
  height: '30px',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  border: 'none',
  borderRadius: '50%',
  background: 'var(--muted)',
  color: 'var(--muted-foreground)',
  cursor: 'pointer',
  flexShrink: 0,
};

// ── Smart model selector wrapper ─────────────────────────────────────────────

export const modelSelectorWrapper: React.CSSProperties = {
  position: 'relative',
  display: 'inline-block',
};

export const modelSelectorDropdown: React.CSSProperties = {
  position: 'absolute',
  bottom: '100%',
  left: 0,
  zIndex: 50,
};

// ── Model selector panel ──────────────────────────────────────────────────────

export const modelSelectorPanel: React.CSSProperties = {
  margin: '0 12px 6px',
  background: 'var(--card)',
  border: '1px solid var(--border)',
  borderRadius: '16px',
  overflow: 'hidden',
  flexShrink: 0,
  maxHeight: '300px',
  width: '280px',
  display: 'flex',
  flexDirection: 'column',
};

export const modelSearchField: React.CSSProperties = {
  width: '100%',
  padding: '10px 14px',
  fontSize: '13px',
  background: 'transparent',
  border: 'none',
  borderBottom: '1px solid var(--border)',
  outline: 'none',
  color: 'var(--foreground)',
  fontFamily: 'inherit',
  boxSizing: 'border-box',
};

export const modelScrollArea: React.CSSProperties = {
  overflowY: 'auto',
  flex: 1,
  padding: '4px 0',
};

export const modelGroupLabel: React.CSSProperties = {
  padding: '8px 14px 2px',
  fontSize: '11px',
  fontWeight: 600,
  color: 'var(--muted-foreground)',
  textTransform: 'uppercase',
  letterSpacing: '0.05em',
};

export const modelItemButton: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  width: '100%',
  padding: '8px 14px',
  fontSize: '13px',
  color: 'var(--foreground)',
  background: 'transparent',
  border: 'none',
  cursor: 'pointer',
  textAlign: 'left',
  fontFamily: 'inherit',
  lineHeight: 1.4,
};

// ── Markdown rendering ────────────────────────────────────────────────────────

export const mdParagraph: React.CSSProperties = {
  margin: '0 0 10px',
  lineHeight: 1.65,
};

export const mdCodeBlock: React.CSSProperties = {
  background: 'var(--muted)',
  borderRadius: '8px',
  padding: '12px 14px',
  fontSize: '13px',
  fontFamily:
    'ui-monospace, SFMono-Regular, SF Mono, Menlo, Consolas, monospace',
  overflowX: 'auto',
  margin: '6px 0 10px',
  whiteSpace: 'pre',
  wordBreak: 'normal',
  display: 'block',
};

export const mdCodeLang: React.CSSProperties = {
  fontSize: '11px',
  color: 'var(--muted-foreground)',
  marginBottom: '6px',
  fontFamily:
    'ui-monospace, SFMono-Regular, SF Mono, Menlo, Consolas, monospace',
};

export const mdInlineCode: React.CSSProperties = {
  background: 'var(--muted)',
  borderRadius: '4px',
  padding: '1px 5px',
  fontSize: '0.875em',
  fontFamily:
    'ui-monospace, SFMono-Regular, SF Mono, Menlo, Consolas, monospace',
};

// ── Cost / error labels ───────────────────────────────────────────────────────

export const costLabel: React.CSSProperties = {
  fontSize: '11px',
  fontFamily:
    'ui-monospace, SFMono-Regular, SF Mono, Menlo, Consolas, monospace',
  color: 'var(--muted-foreground)',
  padding: '0 0 2px 28px',
  opacity: 0.8,
};

export const errorLabel: React.CSSProperties = {
  fontSize: '11px',
  color: '#ef4444',
  padding: '0 0 2px 28px',
  opacity: 0.85,
};
