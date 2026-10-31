import { describe, it, expect } from 'vitest';
import { renderWeeklyRecapEmail } from '@/lib/email/templates';
import { sendWeeklyRecapEmail } from '@/lib/email/send';

describe('Weekly recap local preview', () => {
  it('renders the weekly recap email HTML (what the user sees)', () => {
    const input = {
      count: 3,
      comingUp: [
        { name: 'Spotify', nextBillingDate: '2026-11-02', price: 10.99, currency: 'USD' },
        { name: 'Netflix', nextBillingDate: '2026-11-05', price: 15.99, currency: 'USD' },
      ],
      recentlyRenewed: [
        { name: 'ChatGPT Plus', nextBillingDate: '2026-10-28' },
      ],
      newThisWeek: [
        { name: 'iCloud+', createdAt: '2026-10-26' },
      ],
    };

    const { subject, html } = renderWeeklyRecapEmail(input);

    console.log('\n=== WEEKLY RECAP EMAIL PREVIEW ===');
    console.log('Subject:', subject);
    console.log('--- HTML body (summary before sign-in button) ---');
    console.log(html);
    console.log('=== END PREVIEW ===\n');

    expect(subject).toBe('Your weekly subscription recap');
    expect(html).toContain('You are tracking 3 active subscriptions.');
    expect(html).toContain('Coming up');
    expect(html).toContain('Spotify');
    expect(html).toContain('Recently renewed');
    expect(html).toContain('ChatGPT Plus');
    expect(html).toContain('New this week');
    expect(html).toContain('iCloud+');
  });

  it('logs the push notification body', () => {
    const count = 3;
    const body =
      count === 1
        ? 'You are tracking 1 subscription.'
        : `You are tracking ${count} subscriptions.`;

    console.log('\n=== WEEKLY RECAP PUSH PREVIEW ===');
    console.log('Title: Your week in subscriptions');
    console.log('Body:', body);
    console.log('URL: /subscriptions');
    console.log('Tag: weekly-recap');
    console.log('=== END PUSH PREVIEW ===\n');

    expect(body).toBe('You are tracking 3 subscriptions.');
  });
});
