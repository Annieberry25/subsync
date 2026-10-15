import { useRouter } from 'next/navigation';

/**
 * Derived rather than imported: `next/navigation` does not export a `Router`
 * type, and this only needs the two methods the helper calls.
 */
type Router = ReturnType<typeof useRouter>;

/**
 * Marks a link as having been opened from inside Settings.
 *
 * Settings mirrors the open section into the URL (`/settings?section=account`)
 * so a sub-page can be backed out of into that same section. That is right for
 * desktop, where the section list stays on screen, but on mobile the user came
 * from the category list and a plain `router.back()` drops them straight into
 * Account. Carrying the origin lets the back control name a real destination
 * instead of guessing from history.
 */
export const FROM_SETTINGS = 'from=settings';

/**
 * Back control for pages that can be opened from more than one place.
 *
 * Settings sub-pages are pushed from a section view, so history alone cannot
 * distinguish "came from the Account section" from "came from the category
 * list". `?from=settings` settles it; every other caller keeps normal history
 * behaviour.
 *
 * The query string is read from `window` at click time rather than through
 * `useSearchParams`, which would force a Suspense boundary around these pages
 * just to read a value that is already in the URL bar.
 */
export function goBack(router: Router): void {
  const search = typeof window === 'undefined' ? '' : window.location.search;

  if (search.includes(FROM_SETTINGS)) {
    router.push('/settings');
    return;
  }

  /*
   * A page reached directly — the help centre from a shared link, a deep link
   * from a search result — has nothing behind it, and `router.back()` on an empty
   * history is a no-op, which leaves the control doing nothing at all. Home is the
   * only destination that is correct from any of them.
   */
  if (typeof window !== 'undefined' && window.history.length <= 1) {
    router.push('/');
    return;
  }

  router.back();
}