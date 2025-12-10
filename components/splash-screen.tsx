"use client";

import { useEffect, useState } from "react";
import Logo from "./logo";
import { cn } from "@/lib/utils";

export default function SplashScreen() {
  const [show, setShow] = useState(true);
  const [animate, setAnimate] = useState(false);

  useEffect(() => {
    // Start animation shortly after mount
    const timer1 = setTimeout(() => {
      setAnimate(true);
    }, 500);

    // Remove splash screen after animation
    const timer2 = setTimeout(() => {
      setShow(false);
    }, 1500);

    return () => {
      clearTimeout(timer1);
      clearTimeout(timer2);
    };
  }, []);

  if (!show) return null;

  return (
    <div
      className={cn(
        "fixed inset-0 z-50 flex items-center justify-center bg-background transition-opacity duration-1000",
        animate ? "opacity-0" : "opacity-100"
      )}
    >
      <div
        className={cn(
          "transition-transform duration-1000",
          animate ? "scale-110" : "scale-100"
        )}
      >
        <Logo size={200} />
      </div>
    </div>
  );
}
