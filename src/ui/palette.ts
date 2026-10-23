/**
 * Soft-clay palette (spec docs/superpowers/specs/2026-10-23-clay-visual-design.md §4.1), as 0xRRGGBB numbers.
 * Use `css()` from clay.ts where a CSS string is needed (Text styles, canvas fills).
 */
export const CLAY = {
  /** Page background: radial cream, centre → edge. */
  bgInner: 0xfbf6ef,
  bgOuter: 0xefe5d8,
  /** Panels / question band, and the smaller plaques (info chips). */
  panel: 0xf6efe6,
  plaque: 0xefe7de,
  /** Text: dark, secondary, accent (combo etc.). */
  ink: 0x5a4636,
  ink2: 0x6b5a4b,
  accent: 0xe0703c,
  /** Faded clay (grey balls, disabled buttons, unlit cards) and its text. */
  faded: 0xd9d0c5,
  fadedText: 0x9b8f82,
  peg: 0xf2b765,
  /** Peg flash: the peg colour moved ~45% toward white (a brighter clay peg, pre-baked). */
  pegFlash: 0xf8d7aa,
  floor: 0xc99a74,
  /** Warning-line dots (inset). */
  warnDot: 0xe9b3a6,
  boss: 0xa98be0,
  hpOn: 0xf08a7a,
  hpOff: 0xe3d9ce,
  /** Primary button. */
  primary: 0x79c96b,
} as const;

/** Ball colours in spec order: coral, sky, mint, lemon, grape, peach, teal. */
export const BALL_COLORS: readonly number[] = [0xff8a6b, 0x6fb7f2, 0x6fcf97, 0xf7c94b, 0xb48ce6, 0xf79ab0, 0x5cc8c0];

/** Settings switch: inset track (pale mint when on, the empty-HP grey when off) and its raised knob. */
export const TOGGLE = {
  onTrack: 0xcfe9d6,
  offTrack: CLAY.hpOff,
  knobOn: BALL_COLORS[2],
  knobOff: CLAY.faded,
} as const;
