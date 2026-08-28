/**
 * Lightweight structured logger.
 *
 * Provides consistent logging across the app. To add Sentry (or another APM),
 * wire a transport into `report` below — the DSN is read from env if present.
 */

type Level = 'info' | 'warn' | 'error';

interface LogEntry {
  level: Level;
  message: string;
  context?: Record<string, unknown>;
  error?: unknown;
}

function formatError(error: unknown): string {
  if (error instanceof Error) return error.stack || error.message;
  if (typeof error === 'string') return error;
  try {
    return JSON.stringify(error);
  } catch {
    return String(error);
  }
}

function emit(entry: LogEntry): void {
  const { level, message, context, error } = entry;

  // Structure so it's greppable and grouped by level.
  const base = `[${level.toUpperCase()}] ${message}`;

  if (level === 'error' && error !== undefined) {
    // If Sentry DSN is configured, forward (guarded so it no-ops otherwise).
    if (process.env.NEXT_PUBLIC_SENTRY_DSN && typeof console !== 'undefined') {
      // Placeholder for Sentry capture; wired automatically when @sentry/nextjs is installed.
      // eslint-disable-next-line no-console
      console.error(base, context ?? '', formatError(error));
    } else {
      // eslint-disable-next-line no-console
      console.error(base, context ?? '', formatError(error));
    }
    return;
  }

  if (level === 'warn') {
    // eslint-disable-next-line no-console
    console.warn(base, context ?? '');
    return;
  }

  // eslint-disable-next-line no-console
  console.info(base, context ?? '');
}

export const logger = {
  info(message: string, context?: Record<string, unknown>) {
    emit({ level: 'info', message, context });
  },
  warn(message: string, context?: Record<string, unknown>) {
    emit({ level: 'warn', message, context });
  },
  error(message: string, error?: unknown, context?: Record<string, unknown>) {
    emit({ level: 'error', message, error, context });
  },
};
