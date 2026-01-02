'use client';

import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { LevelsModal } from '@/components/levels-modal';

interface ProfileCardProps {
  /** User's display name */
  name: string;
  /** User's bio/description */
  bio: string;
  /** Fallback initials for avatar */
  avatarFallback: string;
  /** Current level (displayed in badge) */
  level: number;
  /** Progress towards next level (0-1) */
  progress: number;
  /** Words needed to reach next level */
  wordsToLevelUp: number;
  /** Whether to use mobile layout */
  isMobile?: boolean;
  /** Optional avatar image URL */
  avatarSrc?: string;
}

/**
 * Profile card component displaying user information with circular progress indicator
 * Features: Avatar with progress ring, level badge with brain icon, mentor memory stats
 */
export function ProfileCard({
  name,
  bio,
  avatarFallback,
  level,
  progress,
  wordsToLevelUp,
  isMobile = false,
  avatarSrc,
}: ProfileCardProps) {
  const circumference = 2 * Math.PI * 66;
  const strokeDashoffset = circumference * (1 - progress);
  const router = useRouter();
  const [isLevelsModalOpen, setIsLevelsModalOpen] = useState(false);

  const handleProfileClick = () => {
    router.push('/user-memory');
  };

  const handleLevelClick = () => {
    setIsLevelsModalOpen(true);
  };

  return (
    <>
      <header
        className={`flex flex-col items-center ${
          isMobile
            ? 'justify-start px-6 pt-2 pb-4'
            : 'justify-center text-center pb-4'
        }`}
      >
        {/* Progress Circle with Avatar */}
        <div className="relative mb-4">
          {/* Background and Progress Circles */}
          <svg
            className="w-36 h-36 transform -rotate-90"
            viewBox="0 0 144 144"
          >
            <circle
              cx="72"
              cy="72"
              r="66"
              stroke="currentColor"
              strokeWidth="6"
              fill="none"
              className="text-border/30"
            />
            <circle
              cx="72"
              cy="72"
              r="66"
              stroke="currentColor"
              strokeWidth="6"
              fill="none"
              strokeDasharray={circumference}
              strokeDashoffset={strokeDashoffset}
              className="text-blue-500 transition-all duration-1000 ease-out"
              strokeLinecap="round"
            />
          </svg>

          {/* Centered Avatar */}
          <button
            onClick={handleProfileClick}
            className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 rounded-full transition-transform hover:scale-105"
          >
            <Avatar className="w-32 h-32 ring-2 ring-border/20 shadow-lg hover:shadow-xl transition-shadow cursor-pointer">
              {avatarSrc ? (
                <img
                  src={avatarSrc || '/placeholder.svg'}
                  alt={`${name}'s profile picture`}
                  className="w-full h-full object-cover"
                />
              ) : (
                <AvatarFallback className="bg-gradient-to-br from-primary/10 to-accent/10 text-foreground text-4xl font-medium">
                  {avatarFallback}
                </AvatarFallback>
              )}
            </Avatar>
          </button>

          <div className="absolute bottom-2 right-2">
            <Badge
              variant="default"
              className="w-10 h-10 rounded-full p-0 bg-blue-500 hover:bg-blue-500 border-2 border-background shadow-lg flex items-center justify-center cursor-pointer transition-transform hover:scale-105"
              onClick={handleLevelClick}
            >
              <span className="text-white text-sm font-bold">{level}</span>
            </Badge>
          </div>
        </div>

        <div className="text-center space-y-1 mb-3">
          <button
            onClick={handleLevelClick}
            className="text-blue-500 text-xs font-medium tracking-wide hover:text-blue-400 transition-colors cursor-pointer"
          >
            LEVEL {level} - MENTOR MEMORY
          </button>
          <button
            onClick={handleLevelClick}
            className="block text-muted-foreground text-xs font-medium tracking-wide hover:text-foreground transition-colors cursor-pointer"
          >
            {wordsToLevelUp.toLocaleString()} WORDS TO LEVEL UP MIND
          </button>
        </div>

        {/* User Information */}
        <h1
          className={`font-semibold text-center text-balance ${
            isMobile ? 'text-3xl' : 'text-4xl'
          }`}
        >
          {name}
        </h1>
        <p className="text-muted-foreground text-sm mt-2 text-center italic">
          "{bio}"
        </p>
      </header>

      <LevelsModal
        isOpen={isLevelsModalOpen}
        onClose={() => setIsLevelsModalOpen(false)}
        currentLevel={level}
        currentProgress={progress}
      />
    </>
  );
}
