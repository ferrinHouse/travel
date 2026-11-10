'use client';

export default function ReloadButton() {
  return (
    <button type="button" className="btn" onClick={() => window.location.reload()}>
      Try again
    </button>
  );
}
