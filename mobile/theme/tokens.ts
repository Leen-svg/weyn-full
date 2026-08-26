/**
 * WEYN design tokens, ported 1:1 from weynapp/app/design-system.css.
 *
 * This file is the only place a raw colour or radius may appear. If a value
 * changes in the CSS it changes here too, and nowhere else in the app.
 */

export const colors = {
  paper: '#F9F9F9', // page background
  white: '#FFFFFF', // card background
  ink: '#1F3044', // text, ALL borders, ALL shadows
  inkDeep: '#152230', // dark sections, footer
  inkSoft: '#54677D', // body copy, secondary text

  blue: '#5AA9E6', // brand blue, wordmark
  blueDeep: '#3D8FD1', // blue on light backgrounds, eyebrows
  sky: '#7FC8F8', // THE AI COLOUR — anything AI does is sky
  skyWash: '#EAF4FD',

  yellow: '#FFE45E', // highlight, selected state, default button
  yellowWash: '#FFF8D9',

  pink: '#FF6392', // accent and the ؟ mark. NEVER a big surface
  pinkDeep: '#F2477C',
  pinkWash: '#FFEDF3',

  purple: '#8E7CE8', // PRIMARY CTA
  purpleDeep: '#7863DB', // its pressed state
  purpleWash: '#F1EEFC',
} as const;

export const radius = {
  lg: 28, // cards, big panels
  md: 18, // small cards, stickers
  sm: 12, // inputs
  pill: 999, // buttons, chips, tags, tab bar
} as const;

/**
 * The border is 2.5px in CSS. React Native rounds border widths to the
 * device pixel grid, and 2.5 on a @2x screen is exactly 5 physical pixels,
 * so it survives. On @3x it lands on 7.5 and gets rounded — acceptable.
 */
export const border = {
  width: 2.5,
  thin: 2,
  color: colors.ink,
} as const;

/** Hard offset shadow: 6px 6px 0 ink. No blur, no alpha. See theme/pop.tsx. */
export const shadow = {
  lg: { dx: 10, dy: 10 },
  md: { dx: 6, dy: 6 },
  sm: { dx: 4, dy: 4 },
  xs: { dx: 3, dy: 3 },
} as const;

export const space = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 18,
  xl: 26,
  xxl: 38,
} as const;

export type ShadowSize = keyof typeof shadow;
