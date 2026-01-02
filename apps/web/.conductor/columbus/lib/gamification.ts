/**
 * Gamification configuration for user memory levels
 * Levels range from 1-8 based on word count in user memory
 */

export const LEVEL_THRESHOLDS = {
  1: 0,
  2: 500,
  3: 2000,
  4: 5000,
  5: 10000,
  6: 20000,
  7: 40000,
  8: 80000,
} as const;

export type UserLevel = keyof typeof LEVEL_THRESHOLDS;

/**
 * Calculate user level based on word count
 * @param wordCount - Total words in user memory
 * @returns User level (1-8)
 */
export function calculateLevel(wordCount: number): UserLevel {
  const levels = Object.entries(LEVEL_THRESHOLDS)
    .map(([level, threshold]) => ({
      level: parseInt(level) as UserLevel,
      threshold,
    }))
    .sort((a, b) => b.threshold - a.threshold); // Sort descending

  for (const { level, threshold } of levels) {
    if (wordCount >= threshold) {
      return level;
    }
  }

  return 1; // Default to level 1
}

/**
 * Get words needed to reach next level
 * @param wordCount - Current word count
 * @returns Words needed to level up, or null if at max level
 */
export function getWordsToNextLevel(wordCount: number): number | null {
  const currentLevel = calculateLevel(wordCount);

  if (currentLevel === 8) {
    return null; // Max level reached
  }

  const nextLevel = (currentLevel + 1) as UserLevel;
  const nextThreshold = LEVEL_THRESHOLDS[nextLevel];

  return nextThreshold - wordCount;
}

/**
 * Get current level threshold
 * @param level - User level
 * @returns Word count threshold for the level
 */
export function getLevelThreshold(level: UserLevel): number {
  return LEVEL_THRESHOLDS[level];
}
