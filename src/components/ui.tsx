import { useEffect, useId, useState, type CSSProperties, type ReactNode } from 'react';
import { readableInk } from '../color';
import { paths } from '../router';
import { parseNum, plain } from '../format';

/** Small shared building blocks used across screens. */

export function TopBar({
  title,
  back,
  backLabel = 'Back',
  action,
  color,
}: {
  title: ReactNode;
  back?: string;
  backLabel?: string;
  action?: ReactNode;
  /** A recipe color for the header band (§14). */
  color?: string;
}) {
  const style: CSSProperties | undefined = color
    ? ({ '--band': color, '--band-ink': readableInk(color) } as CSSProperties)
    : undefined;
  return (
    <header className={color ? 'topbar banded' : 'topbar'} style={style}>
      {back ? (
        <a className="topbar-back" href={back} aria-label={backLabel}>
          ‹
        </a>
      ) : null}
      <h1 className="topbar-title">{title}</h1>
      <span className="topbar-action">{action}</span>
    </header>
  );
}

/** D2: shown on every calculator screen. */
export function Footer() {
  return (
    <p className="legal">
      <a href={paths.about()}>Not medical advice · Not affiliated with LMNT.</a>
    </p>
  );
}

export function Section({ title, children, aside }: { title: string; children: ReactNode; aside?: ReactNode }) {
  return (
    <section className="section">
      <div className="section-head">
        <h2>{title}</h2>
        {aside}
      </div>
      {children}
    </section>
  );
}

/** An ⓘ button that reveals a short explanation (H-4). */
export function Info({ children, label }: { children: ReactNode; label: string }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        type="button"
        className="info-btn"
        aria-label={`About ${label}`}
        aria-expanded={open}
        onClick={(e) => {
          e.preventDefault();
          setOpen(!open);
        }}
      >
        ⓘ
      </button>
      {open && <span className="info-text">{children}</span>}
    </>
  );
}

export function Segmented<T extends string | number>({
  options,
  value,
  onChange,
  label,
}: {
  options: { value: T; label: string }[];
  value: T;
  onChange: (value: T) => void;
  label: string;
}) {
  return (
    <div className="segmented" role="radiogroup" aria-label={label}>
      {options.map((o) => (
        <button
          key={String(o.value)}
          type="button"
          role="radio"
          aria-checked={o.value === value}
          className={o.value === value ? 'on' : ''}
          onClick={() => onChange(o.value)}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

/** A modal bottom sheet. Escape or the backdrop closes it. */
export function Sheet({ title, onClose, children }: { title: string; onClose: () => void; children: ReactNode }) {
  const titleId = useId();
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);
  return (
    <div className="sheet-backdrop" onClick={onClose}>
      <div
        className="sheet"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="sheet-head">
          <h2 id={titleId}>{title}</h2>
          <button type="button" className="link" onClick={onClose} aria-label="Close">
            ✕
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

/** Confirmation for destructive actions (§14). */
export function Confirm({
  title,
  message,
  confirmLabel,
  onConfirm,
  onCancel,
  danger = true,
}: {
  title: string;
  message: ReactNode;
  confirmLabel: string;
  onConfirm: () => void;
  onCancel: () => void;
  danger?: boolean;
}) {
  return (
    <Sheet title={title} onClose={onCancel}>
      <p>{message}</p>
      <div className="actions">
        <button type="button" className={danger ? 'btn danger' : 'btn'} onClick={onConfirm}>
          {confirmLabel}
        </button>
        <button type="button" className="btn ghost" onClick={onCancel}>
          Cancel
        </button>
      </div>
    </Sheet>
  );
}

/** A labelled number box that keeps what the user typed while they edit. */
export function NumField({
  label,
  value,
  onValue,
  suffix,
  info,
  hint,
  big = false,
  min,
  disabled,
  hideLabel = false,
  inline = false,
}: {
  label: string;
  value: number | undefined;
  onValue: (value: number | undefined) => void;
  suffix?: string;
  info?: ReactNode;
  hint?: ReactNode;
  big?: boolean;
  min?: number;
  disabled?: boolean;
  /** Keep the label for screen readers only, where the context already says what the box is. */
  hideLabel?: boolean;
  /** Label on the left, a short box on the right (settings rows). */
  inline?: boolean;
}) {
  const id = useId();
  const [text, setText] = useState(value === undefined ? '' : plain(value, 6));
  const [seen, setSeen] = useState(value);
  // While the box has focus, what the user typed wins. Saves echo back
  // asynchronously, and a late echo of an earlier keystroke ("1" while the
  // box already says "1.2") must not overwrite the text mid-typing.
  const [focused, setFocused] = useState(false);
  if (value !== seen) {
    setSeen(value);
    if (!focused && parseNum(text) !== value) setText(value === undefined ? '' : plain(value, 6));
  }
  const bad = text.trim() !== '' && (parseNum(text) === undefined || (min !== undefined && (parseNum(text) ?? 0) < min));
  return (
    <div className={inline ? 'field inline' : 'field'}>
      <label className={hideLabel ? 'sr-only' : 'field-label'} htmlFor={id}>
        {label}
      </label>
      <span className={big ? 'input-wrap big' : 'input-wrap'}>
        <input
          id={id}
          type="text"
          inputMode="decimal"
          value={text}
          disabled={disabled}
          aria-invalid={bad || undefined}
          onFocus={() => setFocused(true)}
          onBlur={() => {
            setFocused(false);
            // Show the saved value again if the text was left invalid or differs.
            if (parseNum(text) !== value) setText(value === undefined ? '' : plain(value, 6));
          }}
          onChange={(e) => {
            setText(e.target.value);
            const n = parseNum(e.target.value);
            onValue(n === undefined || (min !== undefined && n < min) ? undefined : n);
          }}
        />
        {suffix && (
          <span className="suffix" aria-hidden>
            {suffix}
          </span>
        )}
      </span>
      {info && <Info label={label}>{info}</Info>}
      {hint && <p className="hint">{hint}</p>}
    </div>
  );
}

export function Chip({ children, tone = 'warn' }: { children: ReactNode; tone?: 'warn' | 'info' }) {
  return <span className={`chip ${tone}`}>{children}</span>;
}

export function Empty({ title, children }: { title: string; children?: ReactNode }) {
  return (
    <div className="empty">
      <strong>{title}</strong>
      {children && <p>{children}</p>}
    </div>
  );
}

export function Loading() {
  return (
    <p className="soon" role="status">
      Loading…
    </p>
  );
}
