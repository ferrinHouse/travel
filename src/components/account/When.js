'use client';

const FORMAT = new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' });

/** A timestamp in the viewer's own time zone (the server may render a different zone). */
export default function When({ value, fallback = 'never' }) {
  if (!value) return fallback;
  const date = new Date(value);
  return (
    <time dateTime={date.toISOString()} suppressHydrationWarning>
      {FORMAT.format(date)}
    </time>
  );
}
