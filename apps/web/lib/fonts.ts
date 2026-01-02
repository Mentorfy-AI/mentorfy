import localFont from 'next/font/local'
import { Inter, Space_Grotesk } from 'next/font/google'

// =============================================================================
// LUMINA FORM FONTS - Google Fonts (Original Lumina Design)
// =============================================================================

export const inter = Inter({
  subsets: ['latin'],
  weight: ['300', '400', '500', '600'],
  variable: '--font-inter',
  display: 'swap',
})

export const spaceGrotesk = Space_Grotesk({
  subsets: ['latin'],
  weight: ['300', '400', '500', '600'],
  variable: '--font-space-grotesk',
  display: 'swap',
})

// =============================================================================
// MENTORFY BRAND FONTS - Local Fonts
// =============================================================================

// Secondary Font: Testuale (Serif)
export const testuale = localFont({
  src: [
    {
      path: '../public/fonts/testuale/woff2/Testuale-Regular.woff2',
      weight: '400',
      style: 'normal',
    },
    {
      path: '../public/fonts/testuale/woff2/Testuale-Italic.woff2',
      weight: '400',
      style: 'italic',
    },
    {
      path: '../public/fonts/testuale/woff2/Testuale-Medium.woff2',
      weight: '500',
      style: 'normal',
    },
    {
      path: '../public/fonts/testuale/woff2/Testuale-MediumItalic.woff2',
      weight: '500',
      style: 'italic',
    },
    {
      path: '../public/fonts/testuale/woff2/Testuale-SemiBold.woff2',
      weight: '600',
      style: 'normal',
    },
    {
      path: '../public/fonts/testuale/woff2/Testuale-SemiBoldItalic.woff2',
      weight: '600',
      style: 'italic',
    },
    {
      path: '../public/fonts/testuale/woff2/Testuale-Bold.woff2',
      weight: '700',
      style: 'normal',
    },
    {
      path: '../public/fonts/testuale/woff2/Testuale-BoldItalic.woff2',
      weight: '700',
      style: 'italic',
    },
  ],
  variable: '--font-secondary',
  display: 'swap',
})

// Primary Font: Neue Haas Grotesk Display Pro (Sans-serif)
export const neueHaas = localFont({
  src: [
    {
      path: '../public/fonts/neue-haas-grotesk-display-pro/woff2/NeueHaasDisplayXXThin.woff2',
      weight: '100',
      style: 'normal',
    },
    {
      path: '../public/fonts/neue-haas-grotesk-display-pro/woff2/NeueHaasDisplayXXThinItalic.woff2',
      weight: '100',
      style: 'italic',
    },
    {
      path: '../public/fonts/neue-haas-grotesk-display-pro/woff2/NeueHaasDisplayXThin.woff2',
      weight: '200',
      style: 'normal',
    },
    {
      path: '../public/fonts/neue-haas-grotesk-display-pro/woff2/NeueHaasDisplayXThinItalic.woff2',
      weight: '200',
      style: 'italic',
    },
    {
      path: '../public/fonts/neue-haas-grotesk-display-pro/woff2/NeueHaasDisplayThin.woff2',
      weight: '300',
      style: 'normal',
    },
    {
      path: '../public/fonts/neue-haas-grotesk-display-pro/woff2/NeueHaasDisplayThinItalic.woff2',
      weight: '300',
      style: 'italic',
    },
    {
      path: '../public/fonts/neue-haas-grotesk-display-pro/woff2/NeueHaasDisplayLight.woff2',
      weight: '350',
      style: 'normal',
    },
    {
      path: '../public/fonts/neue-haas-grotesk-display-pro/woff2/NeueHaasDisplayLightItalic.woff2',
      weight: '350',
      style: 'italic',
    },
    {
      path: '../public/fonts/neue-haas-grotesk-display-pro/woff2/NeueHaasDisplayRoman.woff2',
      weight: '400',
      style: 'normal',
    },
    {
      path: '../public/fonts/neue-haas-grotesk-display-pro/woff2/NeueHaasDisplayRomanItalic.woff2',
      weight: '400',
      style: 'italic',
    },
    {
      path: '../public/fonts/neue-haas-grotesk-display-pro/woff2/NeueHaasDisplayMediu.woff2',
      weight: '500',
      style: 'normal',
    },
    {
      path: '../public/fonts/neue-haas-grotesk-display-pro/woff2/NeueHaasDisplayMediumItalic.woff2',
      weight: '500',
      style: 'italic',
    },
    {
      path: '../public/fonts/neue-haas-grotesk-display-pro/woff2/NeueHaasDisplayBold.woff2',
      weight: '700',
      style: 'normal',
    },
    {
      path: '../public/fonts/neue-haas-grotesk-display-pro/woff2/NeueHaasDisplayBoldItalic.woff2',
      weight: '700',
      style: 'italic',
    },
    {
      path: '../public/fonts/neue-haas-grotesk-display-pro/woff2/NeueHaasDisplayBlack.woff2',
      weight: '900',
      style: 'normal',
    },
    {
      path: '../public/fonts/neue-haas-grotesk-display-pro/woff2/NeueHaasDisplayBlackItalic.woff2',
      weight: '900',
      style: 'italic',
    },
  ],
  variable: '--font-primary',
  display: 'swap',
})
