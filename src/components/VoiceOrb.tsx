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
        {/* Particle/Ring Field */}
        <AnimatePresence>
          {isActive && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0"
            >
              {[...Array(3)].map((_, i) => (
                <motion.div
                  key={i}
                  animate={{ 
                    rotate: 360,
                    scale: [1, 1.1 + (i * 0.1), 1],
                  }}
                  transition={{ 
                    rotate: { duration: 10 + (i * 5), repeat: Infinity, ease: "linear" },
                    scale: { duration: 3, repeat: Infinity, ease: "easeInOut", delay: i * 0.5 }
                  }}
                  className="absolute inset-0 rounded-full border border-white/5 shadow-[0_0_15px_rgba(255,255,255,0.05)]"
                  style={{ margin: i * 20 }}
                />
              ))}
              
              {/* Audio Visualizer Bars (Simulated with volume) */}
              {[...Array(12)].map((_, i) => (
                <motion.div
                  key={`bar-${i}`}
                  animate={{ 
                    height: isActive ? [20, 20 + (volume * 100 * Math.random()), 20] : 20,
                    opacity: isActive ? [0.2, 0.5, 0.2] : 0.1
                  }}
                  transition={{ duration: 0.15, repeat: Infinity }}
                  className="absolute w-1 rounded-full bg-white/20"
                  style={{ 
                    left: "50%",
                    top: "50%",
                    transformOrigin: "bottom center",
                    transform: `translate(-50%, -100%) rotate(${i * 30}deg) translateY(-${size * 0.35}px)`
                  }}
                />
              ))}
            </motion.div>
          )}
        </AnimatePresence>

        {/* Deep background glow */}
        <motion.div
          animate={{ 
            scale: isActive ? [1, 1.2, 1] : 1, 
            opacity: isActive ? [0.4, 0.6, 0.4] : 0.2,
          }}
          transition={{ duration: 3, repeat: Infinity, ease: "linear" }}
          className="absolute inset-0 rounded-full blur-[50px]"
          style={{ background: currentGradient }}
        />

        {/* Floating pulse rings */}
        <AnimatePresence>
          {isActive && (
            <>
              <motion.div
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: [0, 0.5, 0], scale: 1.5 }}
                transition={{ duration: 2.5, repeat: Infinity, ease: "easeOut" }}
                className="absolute inset-0 rounded-full border-2 border-white/20 blur-sm"
              />
              <motion.div
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: [0, 0.3, 0], scale: 1.8 }}
                transition={{ duration: 2.5, repeat: Infinity, ease: "easeOut", delay: 0.8 }}
                className="absolute inset-0 rounded-full border border-white/10 blur-md"
              />
            </>
          )}
        </AnimatePresence>

        {/* Glassmorphic Shadow */}
        <div className="absolute inset-[15%] rounded-full bg-black/10 blur-xl translate-y-4" />

        {/* Main Orb Body */}
        <motion.div
          animate={{ 
            scale: isActive ? scale : 1,
            rotate: isActive ? 360 : 0,
            y: isActive ? [0, -8, 0] : 0
          }}
          transition={{ 
            scale: { type: "spring", stiffness: 300, damping: 15 },
            rotate: { duration: 25, repeat: Infinity, ease: "linear" },
            y: { duration: 4, repeat: Infinity, ease: "easeInOut" }
          }}
          className="relative z-10 rounded-full shadow-2xl overflow-hidden cursor-pointer"
          style={{ 
            width: size * 0.6, 
            height: size * 0.6, 
            background: currentGradient,
            boxShadow: `
              inset -12px -12px 24px rgba(0,0,0,0.5), 
              inset 12px 12px 24px rgba(255,255,255,0.25), 
              0 0 60px ${isSpeaking ? 'rgba(56, 189, 248, 0.4)' : (status === "connecting" ? 'rgba(245, 158, 11, 0.4)' : 'rgba(124, 58, 237, 0.4)')}
            `
          }}
        >
          {/* Internal Swirl/Fluid Effect */}
          <motion.div 
            animate={{ 
              background: [
                "radial-gradient(circle at 30% 30%, rgba(255,255,255,0.2) 0%, transparent 50%)",
                "radial-gradient(circle at 70% 70%, rgba(255,255,255,0.2) 0%, transparent 50%)",
                "radial-gradient(circle at 30% 30%, rgba(255,255,255,0.2) 0%, transparent 50%)"
              ]
            }}
            transition={{ duration: 5, repeat: Infinity }}
            className="absolute inset-0"
          />

          <motion.div 
            animate={{ x: ["-100%", "200%"] }}
            transition={{ duration: 4, repeat: Infinity, ease: "linear" }}
            className="absolute inset-0 bg-gradient-to-r from-transparent via-white/15 to-transparent -skew-x-12"
          />
          
          {/* Top highlight */}
          <div className="absolute top-[10%] left-[20%] w-[40%] h-[20%] rounded-[100%] bg-white/30 blur-md rotate-[-15deg]" />
        </motion.div>
      </div>
    );
  }
);
VoiceOrb.displayName = "VoiceOrb";

