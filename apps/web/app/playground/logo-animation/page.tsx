'use client';

import { useState } from 'react';
import Image from 'next/image';
import { Button } from '@/components/ui/button';

export default function LogoAnimationPlayground() {
  const [isAnimating, setIsAnimating] = useState(false);

  const handleTrigger = () => {
    setIsAnimating(false);
    // Force reflow to restart animation
    setTimeout(() => {
      setIsAnimating(true);
    }, 10);
  };

  return (
    <div className="min-h-screen bg-black flex flex-col items-center justify-center p-8 gap-8">
      <div className="text-center space-y-4">
        <h1 className="text-3xl font-bold text-white">Logo Animation Playground</h1>
        <p className="text-gray-400">
          Test the hamburger menu logo animation
        </p>
      </div>

      {/* Animation Preview Area */}
      <div className="bg-gray-800 rounded-lg p-12 min-w-[400px]">
        <div className="flex items-center justify-center">
          <div className="w-32 h-32 flex items-center justify-center">
            <Image
              src="/icons/logo-light.svg"
              alt="Mentorfy"
              width={128}
              height={128}
              className={isAnimating ? 'animate-logo-entrance' : ''}
            />
          </div>
        </div>
      </div>

      {/* Controls */}
      <div className="flex gap-4">
        <Button onClick={handleTrigger} size="lg">
          Trigger Animation
        </Button>
        <Button
          onClick={() => setIsAnimating(false)}
          variant="outline"
          size="lg"
        >
          Reset
        </Button>
      </div>

      {/* Animation Info */}
      <div className="bg-gray-900 rounded-lg p-6 max-w-2xl space-y-4 border border-gray-700">
        <h2 className="text-xl font-semibold text-white">Current Animation</h2>
        <div className="space-y-2 text-sm font-mono text-gray-300">
          <p>
            <strong className="text-white">0-33%:</strong> Spin 720deg (0.5s)
          </p>
          <p>
            <strong className="text-white">33-67%:</strong> Glow fades in (0.5s)
          </p>
          <p>
            <strong className="text-white">67%:</strong> brightness(2.2) + subtle 3-layer glow (6px/12px/20px)
          </p>
          <p>
            <strong className="text-white">67-100%:</strong> Glow fades out (0.5s)
          </p>
          <p className="text-xs text-gray-500 mt-2">Total duration: 1.5 seconds</p>
        </div>
        <p className="text-xs text-gray-400 mt-4">
          Edit the animation in{' '}
          <code className="bg-gray-800 px-1.5 py-0.5 rounded text-gray-300">
            app/globals.css
          </code>{' '}
          under the <code className="bg-gray-800 px-1.5 py-0.5 rounded text-gray-300">@keyframes logo-entrance</code> rule
        </p>
      </div>
    </div>
  );
}
