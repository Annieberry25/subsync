'use client';

/**
 * Pill switch shared by the Settings sections.
 *
 * One implementation so the control cannot drift between the notification and
 * privacy panels. The knob moves with a transform transition, keeping the
 * animation on the compositor, and colour alone distinguishes the states: teal
 * when on, a raised neutral when off. Focus and disabled states are built in so
 * every caller gets an accessible control without repeating the classes.
 */
export function ToggleSwitch({
  checked,
  onToggle,
  disabled = false,
  ariaLabel,
}: {
  checked: boolean;
  onToggle: () => void;
  disabled?: boolean;
  ariaLabel?: string;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={ariaLabel}
      disabled={disabled}
      /* Opts out of the global 44px square touch floor (globals.css) which
         otherwise forces this 24x44 pill into a 44x44 circle on phones. */
      data-touch="compact"
      onClick={onToggle}
      className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer items-center rounded-full transition-colors duration-200 ease-in-out focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#14B8A6]/70 focus-visible:ring-offset-2 focus-visible:ring-offset-[#0B0D0D] disabled:cursor-not-allowed disabled:opacity-50 ${
        checked ? 'bg-[#14B8A6]' : 'bg-[#2A2E2E]'
      }`}
    >
      <span
        className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-md ring-0 transition-transform duration-200 ease-in-out ${
          checked ? 'translate-x-[22px]' : 'translate-x-[2px]'
        }`}
      />
    </button>
  );
}
