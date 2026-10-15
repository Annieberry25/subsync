import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Archive, Trash2 } from 'lucide-react';
import { ActionMenu, type ActionMenuItem } from '@/components/ui/action-menu';

/**
 * Regression cover for a menu that shipped broken.
 *
 * The menu used to make room for itself by adding padding to <body> and scrolling
 * the window down whenever it would overflow the bottom of the viewport. Its own
 * dismissal listener is registered on `window` in the capture phase, so that
 * programmatic scroll was read as the reader scrolling and closed the menu again
 * in the same frame. Every trigger near the end of a long list therefore opened a
 * menu that vanished immediately, which reads as a dead control rather than as a
 * positioning bug. That is where the History archived and deleted cards sit.
 *
 * The menu now flips above its trigger instead, so nothing scrolls and there is
 * nothing to mistake for a dismissal.
 */

const ITEMS: ActionMenuItem[] = [
  { label: 'Archive', icon: Archive, onSelect: vi.fn() },
  { label: 'Delete', icon: Trash2, onSelect: vi.fn(), tone: 'danger' },
];

const VIEWPORT_WIDTH = 400;
const VIEWPORT_HEIGHT = 800;

/**
 * jsdom reports every rect as zero, which would make the flip arithmetic
 * meaningless. The trigger is placed by hand at whichever position the test needs.
 */
function placeTrigger(trigger: HTMLElement, rect: Partial<DOMRect>) {
  trigger.getBoundingClientRect = () =>
    ({
      top: 0,
      left: 0,
      bottom: 0,
      right: 0,
      width: 0,
      height: 0,
      x: 0,
      y: 0,
      toJSON: () => ({}),
      ...rect,
    }) as DOMRect;
}

function renderMenu() {
  const user = userEvent.setup();
  render(<ActionMenu triggerLabel="Actions for Netflix" items={ITEMS} />);

  const trigger = screen.getByRole('button', { name: 'Actions for Netflix' });
  return { user, trigger };
}

const menu = () => screen.queryByRole('menu');

describe('ActionMenu', () => {
  beforeEach(() => {
    vi.spyOn(window, 'innerWidth', 'get').mockReturnValue(VIEWPORT_WIDTH);
    vi.spyOn(window, 'innerHeight', 'get').mockReturnValue(VIEWPORT_HEIGHT);
    vi.spyOn(window, 'scrollBy').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
    document.body.style.paddingBottom = '';
  });

  it('opens below the trigger when there is room', async () => {
    const { user, trigger } = renderMenu();
    placeTrigger(trigger, { top: 100, bottom: 128, right: 360 });

    await user.click(trigger);

    expect(menu()).toBeInTheDocument();
    expect(menu()).toHaveStyle({ top: '136px' });
  });

  /**
   * The regression. A trigger near the bottom used to scroll the page to fit the
   * menu, and that scroll closed it again.
   */
  it('stays open for a trigger near the bottom of the viewport', async () => {
    const { user, trigger } = renderMenu();
    placeTrigger(trigger, { top: 740, bottom: 768, right: 360 });

    await user.click(trigger);

    expect(menu()).toBeInTheDocument();
    // Flipped above: 740 - 8 gap - 102 menu height, rather than pushing the page down.
    expect(menu()).toHaveStyle({ top: '630px' });
    expect(window.scrollBy).not.toHaveBeenCalled();
    expect(document.body.style.paddingBottom).toBe('');
  });

  it('does not grow the page to fit the menu', async () => {
    const { user, trigger } = renderMenu();
    placeTrigger(trigger, { top: 740, bottom: 768, right: 360 });

    await user.click(trigger);

    expect(document.body.style.paddingBottom).toBe('');
  });

  /**
   * A trigger near the top has more room below than above, so flipping would push
   * the menu off the top of the screen instead of helping.
   */
  it('keeps the menu below a trigger near the top of the viewport', async () => {
    const { user, trigger } = renderMenu();
    placeTrigger(trigger, { top: 4, bottom: 32, right: 360 });

    await user.click(trigger);

    expect(menu()).toHaveStyle({ top: '40px' });
  });

  it('closes when the reader scrolls the page', async () => {
    const { user, trigger } = renderMenu();
    placeTrigger(trigger, { top: 100, bottom: 128, right: 360 });

    await user.click(trigger);
    expect(menu()).toBeInTheDocument();

    // The reader scrolls. jsdom never moves scrollY on its own, so it is moved by
    // hand to stand in for a real scroll away from where the menu was opened.
    vi.spyOn(window, 'scrollY', 'get').mockReturnValue(120);
    window.dispatchEvent(new Event('scroll'));

    await waitFor(() => expect(menu()).toBeNull());
  });

  /**
   * A scroll dispatched at `window` has target `window`, which is not a Node.
   * `Node.contains()` throws on one, and that exception escaped the listener
   * without being caught, so the dismissal died on the first such event.
   */
  it('does not throw on a scroll event whose target is not a Node', async () => {
    const { user, trigger } = renderMenu();
    placeTrigger(trigger, { top: 100, bottom: 128, right: 360 });

    await user.click(trigger);

    expect(() => window.dispatchEvent(new Event('scroll'))).not.toThrow();
    // Still open: nothing actually scrolled, so there is nothing to dismiss.
    expect(menu()).toBeInTheDocument();
  });

  it('runs an item and closes', async () => {
    const onSelect = vi.fn();
    const items: ActionMenuItem[] = [
      { label: 'Archive', icon: Archive, onSelect },
      { label: 'Delete', icon: Trash2, onSelect, tone: 'danger' },
    ];
    const user = userEvent.setup();
    render(<ActionMenu triggerLabel="Actions for Netflix" items={items} />);

    const trigger = screen.getByRole('button', { name: 'Actions for Netflix' });
    placeTrigger(trigger, { top: 100, bottom: 128, right: 360 });

    await user.click(trigger);
    await user.click(screen.getByRole('menuitem', { name: /Archive/i }));

    expect(onSelect).toHaveBeenCalledTimes(1);
    expect(menu()).toBeNull();
  });

  it('toggles shut on a second press of the trigger', async () => {
    const { user, trigger } = renderMenu();
    placeTrigger(trigger, { top: 100, bottom: 128, right: 360 });

    await user.click(trigger);
    expect(menu()).toBeInTheDocument();

    await user.click(trigger);
    expect(menu()).toBeNull();
  });
});
