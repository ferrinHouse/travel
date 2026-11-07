'use client';

// Replaces the root layout when it fails, so it can't rely on globals.css.
export default function GlobalError({ unstable_retry }) {
  return (
    <html lang="en">
      <body style={{ fontFamily: 'system-ui, sans-serif', textAlign: 'center', padding: '80px 20px', color: '#2c3e50' }}>
        <title>Something went wrong · Family Adventures</title>
        <h1>Something went wrong</h1>
        <p>The app couldn&apos;t load. Please try again in a moment.</p>
        <button
          type="button"
          onClick={() => unstable_retry()}
          style={{ padding: '10px 20px', borderRadius: 6, border: 'none', background: '#3498db', color: 'white', fontWeight: 600, cursor: 'pointer' }}
        >
          Try again
        </button>
      </body>
    </html>
  );
}
