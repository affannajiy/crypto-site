/**
 * The one honest sentence this project owes its users, written once.
 *
 * It sits small in the site footer on every page, and nowhere else. Repeating it
 * on top of every panel read as alarm rather than as information, and a warning
 * that shouts on every screen is one people learn to stop seeing. The real
 * honesty work is done by the "How this breaks" section every cipher must ship.
 *
 * It is not dismissible, and it should not become dismissible.
 */
export const SAFETY_NOTICE =
  'This is a learning tool. It runs entirely in the browser, and nothing typed here is ' +
  'sent anywhere. However, it has not been audited, and no code that a browser can read ' +
  'can keep a secret. Therefore, it must never be used to protect anything real.';

export default function SafetyNotice() {
  return (
    <p className="cl-prose text-xs text-ink-subtle">{SAFETY_NOTICE}</p>
  );
}
