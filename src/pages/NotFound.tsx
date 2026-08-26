import { Link } from 'react-router-dom';

export default function NotFound() {
  return (
    <div className="flex w-full flex-col gap-4">
      <h1 className="text-2xl font-semibold text-ink-strong">That page is not here</h1>
      <p className="cl-prose text-ink-muted">
        The address you followed does not match anything in this site. Nothing has gone wrong —
        the link is simply pointing somewhere that does not exist.
      </p>
      <p>
        <Link to="/" className="cl-button">
          Back to the catalogue
        </Link>
      </p>
    </div>
  );
}
