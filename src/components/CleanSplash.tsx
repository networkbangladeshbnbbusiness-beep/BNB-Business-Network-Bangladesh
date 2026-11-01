import React, { useEffect } from "react";
import { motion } from "motion/react";

interface CleanSplashProps {
  onFinish: () => void;
}

export default function CleanSplash({ onFinish }: CleanSplashProps) {
  useEffect(() => {
    // Show clean white splash with centered official logo, then transition immediately to software
    const timer = setTimeout(() => {
      onFinish();
    }, 1800);
    return () => clearTimeout(timer);
  }, [onFinish]);

  return (
    <div className="fixed inset-0 z-[9999] bg-white flex items-center justify-center overflow-hidden select-none">
      <motion.div
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ 
          duration: 0.45,
          ease: "easeOut"
        }}
        className="flex items-center justify-center p-6"
      >
        <img 
          src="/bnb_logo.png" 
          alt="BNB Official Logo" 
          className="w-48 h-48 xs:w-56 xs:h-56 sm:w-64 sm:h-64 object-contain"
        />
      </motion.div>
    </div>
  );
}
