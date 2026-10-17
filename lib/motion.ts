/** The app's one spring: settles in about 200 ms with barely any overshoot. Every panel, sheet and thumb uses it. */
export const spring = { type: "spring", stiffness: 500, damping: 38 } as const;
/** Fades (reduced motion, toasts) stay at or under 150 ms. */
export const fade = { duration: 0.15 } as const;
