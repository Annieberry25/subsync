import { describe, it, expect, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import ConfirmDialog from '@/components/ui/confirm-dialog';

describe('ConfirmDialog', () => {
  it('renders title, description, and action buttons when open', () => {
    render(
      <ConfirmDialog
        isOpen
        onClose={vi.fn()}
        onConfirm={vi.fn()}
        title="Delete subscription?"
        description="This action permanently removes the subscription."
      />
    );

    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Delete subscription?' })).toBeInTheDocument();
    expect(screen.getByText('This action permanently removes the subscription.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Confirm' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Cancel' })).toBeInTheDocument();
  });

  it('renders nothing when closed', () => {
    const { container } = render(
      <ConfirmDialog isOpen={false} onClose={vi.fn()} onConfirm={vi.fn()} title="Delete?" description="Sure?" />
    );

    expect(container).toBeEmptyDOMElement();
  });

  it('calls onConfirm and then onClose when the confirm button is clicked', async () => {
    const onConfirm = vi.fn(async () => {});
    const onClose = vi.fn();

    render(
      <ConfirmDialog
        isOpen
        onClose={onClose}
        onConfirm={onConfirm}
        title="Delete?"
        description="Are you sure?"
        confirmText="Delete"
      />
    );

    await userEvent.click(screen.getByRole('button', { name: 'Delete' }));

    expect(onConfirm).toHaveBeenCalledTimes(1);
    await waitFor(() => expect(onClose).toHaveBeenCalledTimes(1));
  });

  it('calls onClose but not onConfirm when the cancel button is clicked', async () => {
    const onConfirm = vi.fn();
    const onClose = vi.fn();

    render(
      <ConfirmDialog
        isOpen
        onClose={onClose}
        onConfirm={onConfirm}
        title="Delete?"
        description="Are you sure?"
        cancelText="Keep"
      />
    );

    await userEvent.click(screen.getByRole('button', { name: 'Keep' }));

    expect(onClose).toHaveBeenCalledTimes(1);
    expect(onConfirm).not.toHaveBeenCalled();
  });
});