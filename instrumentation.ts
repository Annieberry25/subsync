export async function register() {
  if (process.env.NEXT_RUNTIME !== 'nodejs') return;
  if (process.env.NODE_ENV !== 'production') return;
  if (process.env.ENABLE_BACKGROUND_GMAIL_SCAN !== 'true') return;
  if (!process.env.CRON_SECRET) return;

  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000';
  let running = false;

  const runScan = async () => {
    if (running) return;
    running = true;
    try {
      const res = await fetch(`${baseUrl}/api/cron/gmail-rescan`, {
        method: 'POST',
        headers: { 'x-cron-secret': process.env.CRON_SECRET as string },
      });
      if (!res.ok) {
        console.error('[instrumentation] gmail rescan failed', res.status);
      }
    } catch (err) {
      console.error('[instrumentation] gmail rescan error', err);
    } finally {
      running = false;
    }
  };

  setInterval(runScan, 6 * 60 * 60 * 1000);
  setTimeout(runScan, 15 * 1000);
}