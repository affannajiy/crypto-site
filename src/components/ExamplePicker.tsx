import type { CipherExample } from '../ciphers/types';

/**
 * The worked starting points a cipher ships with.
 *
 * A blank form is the hardest part of any cipher page: the reader has to invent
 * a message and a key before anything happens, and a key invented by someone who
 * does not yet know the cipher is usually the one that throws. A preset sets
 * both at once, and each one is chosen to show something — a shift of 13, a key
 * of length one, a matrix with no inverse.
 */
export default function ExamplePicker({
  examples,
  onPick,
}: {
  examples: readonly CipherExample[];
  onPick: (example: CipherExample) => void;
}) {
  if (examples.length === 0) return null;

  return (
    <section aria-labelledby="examples-heading" className="flex flex-wrap items-center gap-2">
      <h2 id="examples-heading" className="cl-label mb-0">
        Try one
      </h2>
      {examples.map((example) => (
        <button
          key={example.label}
          type="button"
          className="cl-button min-h-9 px-3 py-1 text-sm"
          onClick={() => onPick(example)}
        >
          {example.label}
          {/* Said in words rather than shown as a warning colour: this preset is
              meant to fail, and finding that out by clicking it is the lesson. */}
          {example.demonstratesError === true && (
            <span className="ml-1.5 text-xs text-ink-subtle">· fails on purpose</span>
          )}
        </button>
      ))}
    </section>
  );
}
