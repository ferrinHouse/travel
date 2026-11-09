'use client';

/** Prints the story. Lazy images switch to eager first so every photo makes it onto paper. */
export default function PrintButton() {
  async function print() {
    const lazy = [...document.querySelectorAll('img[loading="lazy"]')];
    for (const img of lazy) img.loading = 'eager';
    await Promise.all(lazy.map((img) => (img.complete ? null : img.decode().catch(() => null))));
    window.print();
  }
  return (
    <button type="button" className="btn btn-outline" onClick={print}>
      <span aria-hidden="true">🖨️</span> Print or save as PDF
    </button>
  );
}
