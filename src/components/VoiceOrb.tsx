import { forwardRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";

type Props = { 
  status?: "idle" | "connecting" | "active" | "ended";
  volume?: number; 
  size?: number; 
  className?: string;
  isSpeaking?: boolean;
};

export const VoiceOrb = forwardRef<HTMLDivElement, Props>(
  ({ status = "idle", volume = 0, size = 240, className, isSpeaking = false }, ref) => {
    const isActive = status === "active" || status === "connecting";
    const scale = 1 + Math.min(volume, 1) * 0.25;
    
    // Determine colors based on state
    const orbGradients = {
      idle: "radial-gradient(circle at 30% 30%, hsl(262 83% 70%), hsl(262 83% 45%) 60%, hsl(222 47% 11%) 100%)",
      connecting: "radial-gradient(circle at 30% 30%, hsl(38 92% 70%), hsl(38 92% 50%) 60%, hsl(222 47% 11%) 100%)",
      listening: "radial-gradient(circle at 30% 30%, hsl(262 83% 70%), hsl(262 83% 45%) 60%, hsl(222 47% 11%) 100%)",
      speaking: "radial-gradient(circle at 30% 30%, hsl(199 89% 70%), hsl(199 89% 48%) 60%, hsl(222 47% 11%) 100%)",
    };

    const currentGradient = isSpeaking ? orbGradients.speaking : (status === "connecting" ? orbGradients.connecting : orbGradients.idle);

    return (
      <div ref={ref} className={cn("relative grid place-items-center", className)} style={{ width: size, height: size }}>
        {/* Deep background glow */}
        <motion.div
          animate={{ 
            scale: isActive ? [1, 1.15, 1] : 1, 
            opacity: isActive ? [0.3, 0.5, 0.3] : 0.2,
          }}
          transition={{ duration: 3, repeat: Infinity, ease: "linear" }}
          className="absolute inset-0 rounded-full blur-[40px]"
          style={{ background: currentGradient }}
        />

        {/* Medium outer glow */}
        <motion.div
          animate={{ 
            scale: isActive ? [1, 1.08, 1] : 1, 
            opacity: isActive ? 0.6 : 0.3,
          }}
          transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
          className="absolute inset-[10%] rounded-full blur-2xl"
          style={{ background: currentGradient }}
        />

        {/* Floating rings when active */}
        <AnimatePresence>
          {isActive && (
            <>
              <motion.div
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: [0, 0.4, 0], scale: 1.4 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 2, repeat: Infinity, ease: "easeOut" }}
                className="absolute inset-0 rounded-full border border-white/10"
              />
              <motion.div
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: [0, 0.2, 0], scale: 1.6 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 2, repeat: Infinity, ease: "easeOut", delay: 0.5 }}
                className="absolute inset-0 rounded-full border border-white/5"
              />
            </>
          )}
        </AnimatePresence>

        {/* Main Orb Body */}
        <motion.div
          animate={{ 
            scale: isActive ? scale : 1,
            rotate: isActive ? 360 : 0
          }}
          transition={{ 
            scale: { type: "spring", stiffness: 200, damping: 12 },
            rotate: { duration: 20, repeat: Infinity, ease: "linear" }
          }}
          className="relative z-10 rounded-full shadow-2xl overflow-hidden"
          style={{ 
            width: size * 0.6, 
            height: size * 0.6, 
            background: currentGradient,
            boxShadow: `inset -10px -10px 20px rgba(0,0,0,0.4), inset 10px 10px 20px rgba(255,255,255,0.2), 0 0 40px ${isSpeaking ? 'rgba(56, 189, 248, 0.3)' : 'rgba(124, 58, 237, 0.3)'}`
          }}
        >
          {/* Internal Shimmer Effect */}
          <motion.div 
            animate={{ x: ["-100%", "100%"] }}
            transition={{ duration: 3, repeat: Infinity, ease: "linear" }}
            className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent skew-x-12"
          />
          
          {/* Surface highlights */}
          <div className="absolute top-[15%] left-[15%] w-[30%] h-[30%] rounded-full bg-white/20 blur-md" />
        </motion.div>
      </div>
    );
  }
);
VoiceOrb.displayName = "VoiceOrb";

