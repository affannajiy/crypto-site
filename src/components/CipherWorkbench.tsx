import { useCallback, useId, useRef, useState } from 'react';
import type { CipherModule, Params, Tier } from '../ciphers/types';
import ParamControls, { defaultParams } from './ParamControls';
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
      {cipher.params.length > 0 && (
        <section aria-labelledby={`${baseId}-key`} className="cl-card px-4 py-4">
          <h2 id={`${baseId}-key`} className="mb-3 text-sm font-semibold text-ink-strong">
            Key and settings
          </h2>
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
