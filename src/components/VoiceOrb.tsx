import { motion } from "framer-motion";
import { cn } from "@/lib/utils";

export const VoiceOrb = ({ active = false, volume = 0, size = 240, className }: { active?: boolean; volume?: number; size?: number; className?: string }) => {
  const scale = 1 + Math.min(volume, 1) * 0.18;
  return (
    <div className={cn("relative grid place-items-center", className)} style={{ width: size, height: size }}>
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
};
