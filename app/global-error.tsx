'use client';

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html>
      <body>
        <div style={{ padding: '2rem', background: 'red', color: 'white', height: '100vh' }}>
          <h1>GLOBAL SERVER ERROR</h1>
          <pre>{error?.message || "Unknown error"}</pre>
          <pre>{error?.stack}</pre>
          <button onClick={() => reset()}>Try again</button>
        </div>
      </body>
    </html>
  );
}
