import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { PaymentResultSheet } from '@/components/settings/payment-result-sheet';

vi.mock('next/link', () => ({
  default: ({
    href,
    children,
    ...rest
  }: {
    href: string;
    children: React.ReactNode;
  } & React.AnchorHTMLAttributes<HTMLAnchorElement>) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));

function renderSheet(overrides: Partial<Parameters<typeof PaymentResultSheet>[0]> = {}) {
  const props = {
    state: 'success' as const,
    planExpiresAt: '2026-11-06T12:26:41.000Z',
    subscriptionListed: true,
    onClose: vi.fn(),
    onRecheck: vi.fn(),
    ...overrides,
  };
  render(<PaymentResultSheet {...props} />);
  return props;
}

describe('PaymentResultSheet', () => {
  it('renders nothing before a result exists', () => {
    const { container } = render(
      <PaymentResultSheet state={null} onClose={vi.fn()} onRecheck={vi.fn()} />
    );

    expect(container).toBeEmptyDOMElement();
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('confirms a successful payment with the real expiry date', () => {
    renderSheet();

    const dialog = screen.getByRole('dialog');
    expect(dialog).toHaveTextContent('Payment confirmed');
    expect(dialog).toHaveTextContent(/active until .*6.*2026/);
    expect(dialog).toHaveTextContent('Added to your subscription list');
    expect(screen.getByRole('link', { name: 'View subscriptions' })).toHaveAttribute(
      'href',
      '/subscriptions'
    );
  });

  it('offers a re-check while the plan is still activating', () => {
    const props = renderSheet({ state: 'pending', planExpiresAt: null });

    const dialog = screen.getByRole('dialog');
    expect(dialog).toHaveTextContent('Activating your plan');
    expect(dialog).toHaveTextContent('usually takes a few seconds');
    expect(dialog).toHaveTextContent('activates automatically');
    // No refresh/clock cue: the copy tells the customer to wait, and an icon
    // that reads as "refresh" contradicts it.
    expect(dialog.querySelector('svg.lucide-clock')).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Check again' }));
    expect(props.onRecheck).toHaveBeenCalledTimes(1);
  });

  it('sends an incomplete checkout back to plans', () => {
    renderSheet({ state: 'failed', planExpiresAt: null });

    expect(screen.getByRole('dialog')).toHaveTextContent('Payment not completed');
    expect(screen.getByRole('link', { name: 'Back to plans' })).toHaveAttribute(
      'href',
      '/plans'
    );
  });

  it('stays dismissible while verifying', () => {
    renderSheet({ state: 'checking', planExpiresAt: null });

    expect(screen.getByRole('dialog')).toHaveTextContent('Confirming your payment');
    expect(screen.getByRole('button', { name: 'Close' })).toBeInTheDocument();
  });
});
