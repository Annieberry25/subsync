import { describe, it, expect } from 'vitest';
import { useState } from 'react';
import { renderToString } from 'react-dom/server';
import { hydrateRoot } from 'react-dom/client';
import { act } from 'react';
import Sheet from '@/components/ui/sheet';
import { ActionMenu } from '@/components/ui/action-menu';
import { Archive, Trash2 } from 'lucide-react';

/**
 * Reproduces the PRODUCTION path, not the test path.
 *
 * Every other suite renders with RTL's `render`, which is a client-only
 * `createRoot` mount. That never calls `getServerSnapshot`, so the
 * `useSyncExternalStore(emptySubscribe, () => true, () => false)` gate reads
 * `true` on its very first render and every overlay works.
 *
 * A real page is server-rendered and then hydrated. There React calls
 * `getServerSnapshot` first, which is `false`, and the overlay renders `null`.
 * It is only correct if React re-reads `getSnapshot` afterwards and flips the
 * gate to `true`. This file is the only place that difference is exercised.
 */

function SheetProbe() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button type="button" onClick={() => setOpen(true)}>
        open sheet
      </button>
      <Sheet open={open} onClose={() => setOpen(false)} title="Sheet title" description="Body" />
    </>
  );
}

function MenuProbe() {
  // ActionMenu holds its own open state; nothing outside it can open it, so the
  // probe renders the menu and the test drives its own trigger.
  return (
    <ActionMenu
      triggerLabel="Actions for Netflix"
      items={[
        { label: 'Archive', icon: Archive, onSelect: () => {} },
        { label: 'Delete', icon: Trash2, onSelect: () => {}, tone: 'danger' },
      ]}
    />
  );
}

async function hydrateAndClick(element: JSX.Element, trigger: string) {
  const html = renderToString(element);
  const root = document.createElement('div');
  root.innerHTML = html;
  document.body.appendChild(root);

  await act(async () => {
    hydrateRoot(root, element);
  });

  const button = Array.from(document.querySelectorAll('button')).find(
    (b) => b.textContent === trigger
  );
  expect(button).toBeTruthy();

  await act(async () => {
    button!.click();
  });
}

describe('overlay mounted gate under hydration', () => {
  it('Sheet renders after a real hydration', async () => {
    await hydrateAndClick(<SheetProbe />, 'open sheet');

    // The dialog is portalled to document.body.
    expect(document.querySelector('[role="dialog"]')).toBeTruthy();
  });

  it('ActionMenu renders after a real hydration', async () => {
    const html = renderToString(<MenuProbe />);
    const root = document.createElement('div');
    root.innerHTML = html;
    document.body.appendChild(root);

    await act(async () => {
      hydrateRoot(root, <MenuProbe />);
    });

    const trigger = document.querySelector('[aria-label="Actions for Netflix"]');
    expect(trigger).toBeTruthy();

    await act(async () => {
      (trigger as HTMLButtonElement).click();
    });

    expect(document.querySelector('[role="menu"]')).toBeTruthy();
  });
});
