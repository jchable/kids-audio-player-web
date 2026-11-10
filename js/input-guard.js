/* Après un changement d'écran, un double toucher ne doit pas atteindre le nouvel écran. */

export function createInputGuard(now = Date.now) {
  let heldUntil = 0;
  return {
    hold(ms) { heldUntil = now() + ms; },
    allows() { return now() >= heldUntil; },
  };
}
