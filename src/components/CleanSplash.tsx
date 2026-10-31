import React, { useEffect, useState, useRef } from "react";

interface CleanSplashProps {
  onFinish: () => void;
}

export default function CleanSplash({ onFinish }: CleanSplashProps) {
  useEffect(() => {
    onFinish();
  }, [onFinish]);

  return null;
}
