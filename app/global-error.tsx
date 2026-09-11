'use client';

import { useEffect } from 'react';

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('SubHalt Global Error:', error);
  }, [error]);

  return (
    <html lang="en">
      <body style={{ margin: 0, background: '#000000', color: '#F5F7F6', fontFamily: 'sans-serif' }}>
        <div
          style={{
            minHeight: '100vh',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '1rem',
          }}
        >
          <div
            style={{
              maxWidth: '28rem',
              width: '100%',
              textAlign: 'center',
              padding: '2rem',
              borderRadius: '1.5rem',
              background: '#0B0D0D',
              border: '1px solid #1A1D1D',
            }}
          >
            <div
              style={{
                width: '3rem',
                height: '3rem',
                margin: '0 auto 1rem',
                borderRadius: '0.75rem',
                background: 'rgba(217,54,62,0.1)',
                border: '1px solid rgba(217,54,62,0.2)',
                color: '#D9363E',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '1.25rem',
                fontWeight: 'bold',
              }}
            >
              !
            </div>
            <h2 style={{ fontSize: '1.25rem', fontWeight: 700, margin: '0 0 0.5rem' }}>
              Something Went Wrong
            </h2>
            <p style={{ fontSize: '0.8125rem', color: '#94A3B8', lineHeight: 1.6 }}>
              A critical error occurred while rendering the application.
            </p>
            <div style={{ marginTop: '1.5rem' }}>
              <button
                onClick={reset}
                style={{
                  padding: '0.5rem 1.25rem',
                  borderRadius: '0.75rem',
                  border: 'none',
                  background: '#D9363E',
                  color: '#fff',
                  fontSize: '0.8125rem',
                  fontWeight: 600,
                  cursor: 'pointer',
                }}
              >
                Try Again
              </button>
            </div>
          </div>
        </div>
      </body>
    </html>
  );
}
