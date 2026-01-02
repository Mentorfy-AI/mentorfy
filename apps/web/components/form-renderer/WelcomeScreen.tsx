'use client';

import React from 'react';
import { ArrowRight } from 'lucide-react';
import { motion } from 'framer-motion';
import { useFormTheme } from '@/lib/forms/theme';
import { WelcomeConfig } from '@/lib/forms/types';

interface WelcomeScreenProps {
  botName: string;
  botAvatarUrl?: string;
  welcome: WelcomeConfig;
  onStart: () => void;
}

export const WelcomeScreen: React.FC<WelcomeScreenProps> = ({
  botName,
  botAvatarUrl,
  welcome,
  onStart,
}) => {
  const theme = useFormTheme();

  return (
    <div
      className="min-h-screen w-full flex flex-col items-center font-sans"
      style={{ backgroundColor: theme.bgOuter }}
    >
      {/* Main Container */}
      <div
        className="w-full max-w-lg md:max-w-full min-h-screen flex flex-col relative"
        style={{ backgroundColor: theme.bgContainer }}
      >
        {/* Content - Vertically Centered */}
        <main className="flex-1 flex flex-col justify-center px-8 py-12">
          <motion.div
            key="welcome"
            initial={{ opacity: 0, y: 20, filter: 'blur(10px)' }}
            animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
            exit={{ opacity: 0, y: -20, filter: 'blur(10px)' }}
            transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
          >
            {/* Bot Avatar and Name */}
            <div className="flex flex-col items-center mb-8">
              {botAvatarUrl && (
                <div className="relative mb-4">
                  <img
                    src={botAvatarUrl}
                    alt={botName}
                    referrerPolicy="no-referrer"
                    className="w-20 h-20 rounded-full object-cover shadow-lg"
                  />
                  <div
                    className="absolute bottom-0 right-0 w-5 h-5 rounded-full border-[3px]"
                    style={{
                      backgroundColor: theme.statusOnline,
                      borderColor: theme.bgContainer,
                    }}
                  />
                </div>
              )}
              <h2
                className="text-xl font-bold text-center"
                style={{
                  color: theme.textHeading,
                  fontFamily: theme.fontBody,
                }}
              >
                {botName}
              </h2>
            </div>

            {/* Headline */}
            <h1
              className="text-3xl md:text-4xl font-extrabold text-center mb-6 leading-tight uppercase"
              style={{
                color: theme.textHeading,
                fontFamily: theme.fontWelcomeHeadline,
              }}
            >
              {welcome.headline}
            </h1>

            {/* Description */}
            <p
              className="text-base md:text-lg text-center mb-6 leading-relaxed"
              style={{
                color: theme.textSubtle,
                fontFamily: theme.fontBody,
              }}
            >
              {welcome.description}
            </p>

            {/* CTA Button */}
            <div className="flex flex-col items-center">
              <button
                onClick={onStart}
                className="w-auto md:w-1/3 h-14 px-8 rounded-lg font-bold text-lg tracking-wide shadow-lg hover:opacity-90 active:scale-[0.98] transition-all flex items-center justify-center gap-2 whitespace-nowrap"
                style={{
                  backgroundColor: theme.primary,
                  color: theme.bgContainer,
                  fontFamily: theme.fontBody,
                }}
              >
                {welcome.buttonText}
                <ArrowRight
                  size={20}
                  strokeWidth={3}
                />
              </button>
            </div>

            {/* Footer Text */}
            {welcome.footerText && (
              <p
                className="text-sm text-center mt-4"
                style={{
                  color: theme.textSubtle,
                  fontFamily: theme.fontBody,
                }}
              >
                {welcome.footerText}
              </p>
            )}

            {/* Existing User Login Link */}
            <a
              href="/sign-in"
              className="block text-center mt-6 font-semibold hover:underline"
              style={{
                color: theme.textHeading,
                fontFamily: theme.fontBody,
              }}
            >
              Click Here To Login If You're An Existing User
            </a>
          </motion.div>
        </main>
      </div>
    </div>
  );
};
