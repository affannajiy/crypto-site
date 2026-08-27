import { useCallback, useId, useRef, useState } from 'react';
import type { CipherExample, CipherModule, Params, Tier } from '../ciphers/types';
import { cipherCanRandomise, defaultParams, randomKeyFor } from '../ciphers/params';
import ExamplePicker from './ExamplePicker';
import ParamControls from './ParamControls';
import { useCipherRun, type Direction } from './useCipherRun';
import EncryptPanel from './panels/EncryptPanel';
import AttackPanel from './panels/AttackPanel';
import VisualizePanel from './panels/VisualizePanel';
import BenchmarkPanel from './panels/BenchmarkPanel';

/**
 * The generic host.
 *
 * This component knows about `CipherModule` and nothing else. It never branches
 * on a slug, never imports a cipher, and renders exactly the tabs a cipher
 * declared — so a cipher that teaches nothing by being attacked simply has no
 * Attack tab, rather than a disabled one.
 */
const TIER_LABELS: Record<Tier, string> = {
  encrypt: 'Encrypt',
  attack: 'Attack',
  visualize: 'Visualize',
  benchmark: 'Benchmark',
};

const DEFAULT_INPUT = 'Meet me at the old bridge at midnight.';

export default function CipherWorkbench({ cipher }: { cipher: CipherModule }) {
  const baseId = useId();
  const [tab, setTab] = useState<Tier>(cipher.tiers[0] ?? 'encrypt');
  const [input, setInput] = useState(DEFAULT_INPUT);
  const [params, setParams] = useState<Params>(() => defaultParams(cipher.params));
  const [direction, setDirection] = useState<Direction>('encrypt');
  const [activeIndex, setActiveIndex] = useState<number | null>(null);

  const run = useCipherRun(cipher, input, params, direction);
  const tabRefs = useRef<(HTMLButtonElement | null)[]>([]);

  // A step index only means something against the text that produced it, so
  // editing the message clears the selection rather than pointing it somewhere
  // arbitrary.
  const changeInput = useCallback((value: string) => {
    setInput(value);
    setActiveIndex(null);
  }, []);

  const changeParam = useCallback((name: string, value: string | number) => {
    setParams((previous) => ({ ...previous, [name]: value }));
  }, []);

  const useKey = useCallback((key: Params) => {
    setParams((previous) => ({ ...previous, ...key }));
  }, []);

  /**
   * Send the result back in and work the other way.
   *
   * Both pieces of state move together, so this is one callback rather than the
   * caller doing two — a swap that set the text and left the direction alone
   * would silently re-encrypt the ciphertext.
   */
  const swap = useCallback((output: string) => {
    setInput(output);
    setDirection((previous) => (previous === 'encrypt' ? 'decrypt' : 'encrypt'));
    setActiveIndex(null);
  }, []);

  /**
   * Load a preset: its message, and its key on top of the defaults.
   *
   * The defaults are re-applied first so that picking a second example cannot
   * inherit half of the first one — an example sets only the params it cares
   * about, and everything it left out should be the cipher's default rather than
   * whatever happened to be on screen.
   */
  const useExample = useCallback(
    (example: CipherExample) => {
      setInput(example.input);
      setParams({ ...defaultParams(cipher.params), ...example.params });
      setDirection('encrypt');
      setActiveIndex(null);
    },
    [cipher],
  );

  const randomise = useCallback(() => {
    setParams((previous) => randomKeyFor(cipher, previous));
    setActiveIndex(null);
  }, [cipher]);

  const changeDirection = useCallback((next: Direction) => {
    setDirection(next);
    setActiveIndex(null);
  }, []);

  /** Arrow keys, Home and End, per the ARIA tabs pattern. */
  const onTabKeyDown = (event: React.KeyboardEvent, index: number) => {
    const count = cipher.tiers.length;
    let next: number;
    switch (event.key) {
      case 'ArrowRight':
        next = (index + 1) % count;
        break;
      case 'ArrowLeft':
        next = (index - 1 + count) % count;
        break;
      case 'Home':
        next = 0;
        break;
      case 'End':
        next = count - 1;
        break;
      default:
        return;
    }
    event.preventDefault();
    const tier = cipher.tiers[next];
    if (tier === undefined) return;
    setTab(tier);
    tabRefs.current[next]?.focus();
  };

  const lastOutput = run.status === 'done' ? run.result.output : '';

  return (
    <div className="flex flex-col gap-6">
      <ExamplePicker examples={cipher.examples ?? []} onPick={useExample} />

      {cipher.params.length > 0 && (
        <section aria-labelledby={`${baseId}-key`} className="cl-card px-4 py-4">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <h2 id={`${baseId}-key`} className="text-sm font-semibold text-ink-strong">
              Key and settings
            </h2>
            {/* Only shown when something here can actually be invented. A cipher
                whose only text param is a plugboard string gets no button rather
                than a button that does nothing. */}
            {cipherCanRandomise(cipher) && (
              <button
                type="button"
                className="cl-button min-h-9 px-3 py-1 text-sm"
                onClick={randomise}
              >
                Randomise
              </button>
            )}
          </div>
          <ParamControls specs={cipher.params} values={params} onChange={changeParam} />
        </section>
      )}

      <div>
        <div
          role="tablist"
          aria-label={`${cipher.name} tools`}
          className="flex flex-wrap gap-1 border-b border-line"
        >
          {cipher.tiers.map((tier, index) => {
            const selected = tier === tab;
            return (
              <button
                key={tier}
                ref={(el) => {
                  tabRefs.current[index] = el;
                }}
                type="button"
                role="tab"
                id={`${baseId}-tab-${tier}`}
                aria-selected={selected}
                aria-controls={`${baseId}-panel-${tier}`}
                tabIndex={selected ? 0 : -1}
                onClick={() => setTab(tier)}
                onKeyDown={(event) => onTabKeyDown(event, index)}
                className={[
                  'min-h-9 -mb-px border-b-2 px-4 py-2 text-sm',
                  selected
                    ? 'border-marker-line font-semibold text-ink-strong'
                    : 'border-transparent text-ink-muted hover:border-line-strong hover:text-ink',
                ].join(' ')}
              >
                {TIER_LABELS[tier]}
              </button>
            );
          })}
        </div>

        <div
          role="tabpanel"
          id={`${baseId}-panel-${tab}`}
          aria-labelledby={`${baseId}-tab-${tab}`}
          tabIndex={0}
          className="pt-6"
        >
          {tab === 'encrypt' && (
            <EncryptPanel
              cipher={cipher}
              params={params}
              onSwap={swap}
              input={input}
              onInputChange={changeInput}
              direction={direction}
              onDirectionChange={changeDirection}
              run={run}
              activeIndex={activeIndex}
              onActiveIndexChange={setActiveIndex}
            />
          )}
          {tab === 'attack' && (
            <AttackPanel cipher={cipher} lastOutput={lastOutput} onUseKey={useKey} />
          )}
          {tab === 'visualize' && <VisualizePanel cipher={cipher} params={params} run={run} />}
          {tab === 'benchmark' && <BenchmarkPanel cipher={cipher} params={params} />}
        </div>
      </div>
    </div>
  );
}
