import { forwardRef } from "react";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";

type Props = { active?: boolean; volume?: number; size?: number; className?: string };

export const VoiceOrb = forwardRef<HTMLDivElement, Props>(
  ({ active = false, volume = 0, size = 240, className }, ref) => {
    const scale = 1 + Math.min(volume, 1) * 0.18;
    return (
      <div ref={ref} className={cn("relative grid place-items-center", className)} style={{ width: size, height: size }}>
        <motion.div
          animate={{ scale: active ? [1, 1.06, 1] : 1, opacity: active ? 0.7 : 0.35 }}
          transition={{ duration: 2.4, repeat: Infinity, ease: "easeInOut" }}
          className="absolute inset-0 rounded-full blur-2xl"
          style={{ background: "var(--gradient-orb)" }}
        />
        <motion.div
          animate={{ scale }}
          transition={{ type: "spring", stiffness: 120, damping: 14 }}
          className="relative rounded-full shadow-[var(--shadow-elev)]"
          style={{ width: size * 0.62, height: size * 0.62, background: "var(--gradient-orb)" }}
        />
      </div>
    );
  }
);
VoiceOrb.displayName = "VoiceOrb";
