import { useEffect } from 'react';

// Closes a sheet on Escape. Every sheet in the app is aria-modal, so it claims
// modal behaviour and owes the matching keyboard contract; four of the five
// previously had no Escape handler, so they could only be dismissed by tapping.
// ponytail: a hook, not a focus trap. Focus containment is a larger change and
// nothing here has focusable content behind the overlay.
export function useEscape(active: boolean, onClose: () => void) {
  useEffect(() => {
    if (!active) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        onClose();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [active, onClose]);
}
