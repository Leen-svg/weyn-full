import { Platform, TextStyle } from 'react-native';
import { colors } from './tokens';

/**
 * Font families are loaded as one family name per weight (see app/_layout.tsx).
 *
 * This is deliberate. Android's font matching does not reliably synthesise a
 * weight from a variable font, so `fontWeight: '800'` on a single registered
 * family renders as regular on many devices. Registering the ExtraBold cut
 * under its own name and never setting fontWeight is the only thing that
 * looks the same on both platforms.
 */
export const fonts = {
  display: 'BricolageGrotesque_800ExtraBold', // headings, buttons
  displayBold: 'BricolageGrotesque_700Bold',
  displaySemi: 'BricolageGrotesque_600SemiBold',
  body: 'SpaceGrotesk_400Regular',
  bodyMedium: 'SpaceGrotesk_500Medium',
  bodySemi: 'SpaceGrotesk_600SemiBold',
  bodyBold: 'SpaceGrotesk_700Bold',
  arabic: 'Kufam_800ExtraBold', // ALL Arabic, weight 800
  arabicBody: 'Kufam_700Bold',
} as const;

/**
 * CSS clamp() has no RN equivalent, so the web's fluid headings collapse to
 * the mobile end of each clamp: h1 -> 34..44 becomes a flat 36.
 */
export const type = {
  h1: {
    fontFamily: fonts.display,
    fontSize: 36,
    lineHeight: 38,
    letterSpacing: -1.2,
    color: colors.ink,
  },
  h2: {
    fontFamily: fonts.display,
    fontSize: 28,
    lineHeight: 30,
    letterSpacing: -1.1,
    color: colors.ink,
  },
  h3: {
    fontFamily: fonts.display,
    fontSize: 21,
    lineHeight: 24,
    letterSpacing: -0.7,
    color: colors.ink,
  },
  lead: {
    fontFamily: fonts.bodyMedium,
    fontSize: 17,
    lineHeight: 27,
    color: colors.inkSoft,
  },
  body: {
    fontFamily: fonts.bodyMedium,
    fontSize: 16,
    lineHeight: 27,
    color: colors.inkSoft,
  },
  small: {
    fontFamily: fonts.bodySemi,
    fontSize: 14,
    lineHeight: 20,
    color: colors.inkSoft,
  },
  /** The uppercase tracked label above a heading. */
  eyebrow: {
    fontFamily: fonts.bodyBold,
    fontSize: 13,
    letterSpacing: 2.5,
    textTransform: 'uppercase',
    color: colors.blueDeep,
  },
  button: {
    fontFamily: fonts.displayBold,
    fontSize: 16,
    color: colors.ink,
  },
  chip: {
    fontFamily: fonts.bodyBold,
    fontSize: 13,
    color: colors.ink,
  },
} satisfies Record<string, TextStyle>;

/**
 * Android clips tall ascenders/descenders when lineHeight is close to
 * fontSize, and vertically centres text in the line box differently to iOS.
 * `includeFontPadding: false` is the fix, and it is Android-only.
 */
export const androidTextFix = Platform.select({
  android: { includeFontPadding: false },
  default: {},
}) as TextStyle;
