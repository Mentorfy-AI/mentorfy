import React from 'react';
import { motion, Variants } from 'framer-motion';

interface TypewriterProps {
  text: string;
  className?: string;
  delay?: number;
}

export const Typewriter: React.FC<TypewriterProps> = ({ text, className, delay = 0 }) => {
  const words = text.split(" ");

  // Container for the whole sentence
  const container: Variants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: { staggerChildren: 0.1, delayChildren: delay },
    },
  };

  return (
    <motion.div
      className={`flex flex-wrap gap-[0.3em] ${className}`}
      variants={container}
      initial="hidden"
      animate="visible"
    >
      {words.map((word, i) => (
        <Word key={i} text={word} />
      ))}
    </motion.div>
  );
};

// Fix: Explicitly type as React.FC to correctly accept the 'key' prop in JSX
const Word: React.FC<{ text: string }> = ({ text }) => {
  // Container for letters in a word
  // We don't stagger here from the parent directly in a continuous flow easily without complex index math,
  // but we can rely on the parent staggering the words, and the word staggering its characters quickly.
  // To make it look like a continuous stream, we tweak the timing.
  
  const wordVariants: Variants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: { staggerChildren: 0.03 },
    },
  };

  const letterVariants: Variants = {
    hidden: { opacity: 0, y: 10 },
    visible: {
      opacity: 1,
      y: 0,
      transition: {
        type: "spring",
        damping: 12,
        stiffness: 100,
      },
    },
  };

  return (
    <motion.span variants={wordVariants} className="inline-block whitespace-nowrap">
      {text.split("").map((char, i) => (
        <motion.span key={i} variants={letterVariants} className="inline-block">
          {char}
        </motion.span>
      ))}
    </motion.span>
  );
};