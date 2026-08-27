/**
 * Form controls, generated from a cipher's `params`.
 *
 * Nothing here knows which cipher it is serving. A new cipher declares its
 * parameters and gets working, labelled, keyboard-operable controls for free —
 * which is the whole reason `ParamSpec` exists.
 *
 * Every control is a native element with a real `<label>`. There are no div
 * buttons and no placeholder-as-label in this file.
 */
import { useId, useState } from 'react';
import type { ParamSpec, Params } from '../ciphers/types';
import { fromHex, groupHex, randomBytes, toHex } from '../lib/format';

// Re-exported so the many existing imports of `defaultParams` from this module
// keep working; the implementation moved to a React-free file that a test and
// the registry can also import.
export { defaultParams } from '../ciphers/params';

/**
 * Below this span a slider is the better control: the whole key space is visible
 * at a glance and arrow keys walk it. Above it, typing a number is faster.
 */
const SLIDER_MAX_SPAN = 64;

interface ControlProps {
  spec: ParamSpec;
  value: string | number | undefined;
  onChange: (name: string, value: string | number) => void;
}

function NumberControl({ spec, value, onChange }: ControlProps & { spec: ParamSpec & { kind: 'number' } }) {
  const id = useId();
  const current = typeof value === 'number' ? value : Number(value ?? spec.default);
  const useSlider = spec.max - spec.min <= SLIDER_MAX_SPAN;

  return (
    <div>
      <label htmlFor={id} className="cl-label flex items-baseline justify-between gap-3">
        <span>{spec.label}</span>
        <span className="font-mono text-sm font-bold text-marker-ink" aria-hidden="true">
          {current}
        </span>
      </label>
      <input
        id={id}
        type={useSlider ? 'range' : 'number'}
        // h-6 keeps the pointer target at 24 CSS px (WCAG 2.5.8).
        className={useSlider ? 'h-6 w-full accent-[var(--color-marker)]' : 'cl-field font-mono'}
        min={spec.min}
        max={spec.max}
        step={1}
        value={current}
        onChange={(e) => onChange(spec.name, Number(e.target.value))}
      />
      <p className="mt-1 text-xs text-ink-subtle">
        A whole number from {spec.min} to {spec.max}.
      </p>
    </div>
  );
}

function TextControl({ spec, value, onChange }: ControlProps & { spec: ParamSpec & { kind: 'text' } }) {
  const id = useId();
  return (
    <div>
      <label htmlFor={id} className="cl-label">
        {spec.label}
      </label>
      <input
        id={id}
        type="text"
        className="cl-field font-mono"
        value={String(value ?? spec.default)}
        placeholder={spec.placeholder ?? ''}
        spellCheck={false}
        autoComplete="off"
        onChange={(e) => onChange(spec.name, e.target.value)}
      />
    </div>
  );
}

function SelectControl({ spec, value, onChange }: ControlProps & { spec: ParamSpec & { kind: 'select' } }) {
  const id = useId();
  return (
    <div>
      <label htmlFor={id} className="cl-label">
        {spec.label}
      </label>
      <select
        id={id}
        className="cl-field"
        value={String(value ?? spec.default)}
        onChange={(e) => onChange(spec.name, e.target.value)}
      >
        {spec.options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </div>
  );
}

function BytesControl({ spec, value, onChange }: ControlProps & { spec: ParamSpec & { kind: 'bytes' } }) {
  const id = useId();
  const hintId = `${id}-hint`;
  const [touched, setTouched] = useState(false);

  const raw = String(value ?? '');
  const parsed = fromHex(raw);
  const wrongLength = parsed !== null && parsed.length !== spec.lengthBytes;
  // Never mark a field wrong while the user is still typing in it (UI-UX §7c.6).
  const problem =
    !touched || raw === ''
      ? null
      : parsed === null
        ? 'That is not valid hex. Use the digits 0-9 and the letters a-f, two per byte.'
        : wrongLength
          ? `That is ${parsed.length} bytes. This key needs ${spec.lengthBytes}.`
          : null;

  return (
    <div>
      <label htmlFor={id} className="cl-label">
        {spec.label}
      </label>
      <div className="flex gap-2">
        <input
          id={id}
          type="text"
          className="cl-field font-mono"
          value={raw}
          spellCheck={false}
          autoComplete="off"
          aria-describedby={hintId}
          aria-invalid={problem !== null}
          onBlur={() => setTouched(true)}
          onChange={(e) => onChange(spec.name, e.target.value.trim())}
        />
        <button
          type="button"
          className="cl-button shrink-0"
          onClick={() => {
            setTouched(false);
            onChange(spec.name, toHex(randomBytes(spec.lengthBytes)));
          }}
        >
          Randomise
        </button>
      </div>
      <p id={hintId} className="mt-1 text-xs text-ink-subtle">
        {problem ?? `${spec.lengthBytes} bytes as hex, for example ${groupHex(toHex(new Uint8Array(Math.min(spec.lengthBytes, 4))))}…`}
      </p>
    </div>
  );
}

export default function ParamControls({
  specs,
  values,
  onChange,
}: {
  specs: readonly ParamSpec[];
  values: Params;
  onChange: (name: string, value: string | number) => void;
}) {
  if (specs.length === 0) {
    return <p className="text-sm text-ink-subtle">This cipher takes no key or settings.</p>;
  }

  return (
    <div className="grid gap-4 sm:grid-cols-2">
      {specs.map((spec) => {
        const shared = { value: values[spec.name], onChange };
        switch (spec.kind) {
          case 'number':
            return <NumberControl key={spec.name} spec={spec} {...shared} />;
          case 'text':
            return <TextControl key={spec.name} spec={spec} {...shared} />;
          case 'select':
            return <SelectControl key={spec.name} spec={spec} {...shared} />;
          case 'bytes':
            return <BytesControl key={spec.name} spec={spec} {...shared} />;
        }
      })}
    </div>
  );
}
