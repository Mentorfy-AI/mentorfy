'use client';

import React, { createContext, useContext } from 'react';

export const flowbuilderTheme = {
  // Primary colors
  primary: '#2B7FFF',
  primaryHover: '#256DD9',
  primaryLight5: 'rgba(43, 127, 255, 0.05)',
  primaryLight10: 'rgba(43, 127, 255, 0.1)',
  primaryLight20: 'rgba(43, 127, 255, 0.2)',
  primaryLight30: 'rgba(43, 127, 255, 0.3)',
  primaryLight50: 'rgba(43, 127, 255, 0.5)',
  primaryLight80: 'rgba(43, 127, 255, 0.8)',

  // Backgrounds
  bgOuter: '#FAFAFA',
  bgContainer: '#FFFFFF',
  bgFooter: 'rgba(255, 255, 255, 0.9)',

  // Progress bar
  progressBg: '#E0EFFF',
  progressFill: '#2B7FFF',

  // Text
  textHeading: 'rgb(15, 23, 42)', // slate-900
  textLabel: 'rgb(71, 85, 105)', // slate-600
  textSubtle: 'rgb(100, 116, 139)', // slate-500

  // Borders
  borderLight: 'rgb(241, 245, 249)', // gray-50
  borderInput: 'rgb(226, 232, 240)', // slate-200

  // Status
  statusOnline: '#00C853',

  // Validation
  error: 'rgb(239, 68, 68)', // red-500

  // Fonts (reference Next.js font variables)
  fontHeading: 'var(--font-inter)',
  fontBody: 'var(--font-inter)',
  fontWelcomeHeadline: 'var(--font-oswald)',
} as const;

export type FormTheme = typeof flowbuilderTheme;

const FormThemeContext = createContext<FormTheme>(flowbuilderTheme);

export const FormThemeProvider: React.FC<{
  children: React.ReactNode;
  theme?: FormTheme;
}> = ({ children, theme = flowbuilderTheme }) => {
  return (
    <FormThemeContext.Provider value={theme}>
      {children}
    </FormThemeContext.Provider>
  );
};

export const useFormTheme = () => {
  const context = useContext(FormThemeContext);
  if (!context) {
    throw new Error('useFormTheme must be used within FormThemeProvider');
  }
  return context;
};
