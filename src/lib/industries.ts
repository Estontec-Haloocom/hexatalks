import { Stethoscope, Home, UtensilsCrossed, ShoppingBag, type LucideIcon } from "lucide-react";

export type Industry = {
  id: string;
  name: string;
  tagline: string;
  icon: LucideIcon;
  accent: string;
  starterPrompt: string;
  starterFirstMessage: string;
  goals: string[];
};

export const INDUSTRIES: Industry[] = [
  {
    id: "healthcare",
    name: "Healthcare",
    tagline: "Patient intake & appointment booking",
    icon: Stethoscope,
    accent: "from-emerald-500/20 to-emerald-500/5",
    starterPrompt:
      "You are a friendly, calm receptionist for a medical clinic. Help patients book, reschedule, or cancel appointments. Confirm their full name, date of birth, and reason for visit. Never give medical advice.",
    starterFirstMessage: "Hi, thanks for calling. This is your virtual assistant — how can I help you today?",
    goals: ["Book appointments", "Verify patient identity", "Triage urgency"],
  },
  {
    id: "real-estate",
    name: "Real Estate",
    tagline: "Lead qualification & property info",
    icon: Home,
    accent: "from-blue-500/20 to-blue-500/5",
    starterPrompt:
      "You are a sharp real-estate concierge. Qualify leads by asking about budget, location, timeline, and financing. Share property details when asked and offer to book a tour with an agent.",
    starterFirstMessage: "Hi! Thanks for reaching out about our listings. Are you looking to buy, rent, or just exploring?",
    goals: ["Qualify leads", "Share listing details", "Book tours"],
  },
  {
    id: "restaurant",
    name: "Restaurants",
    tagline: "Reservations & takeout orders",
    icon: UtensilsCrossed,
    accent: "from-orange-500/20 to-orange-500/5",
    starterPrompt:
      "You are a warm host for a restaurant. Take reservations (party size, date, time, name, phone) and answer questions about hours, location, and the menu. Confirm every detail before ending the call.",
    starterFirstMessage: "Hi, thanks for calling! Would you like to make a reservation or order takeout?",
    goals: ["Take reservations", "Answer menu questions", "Confirm details"],
  },
  {
    id: "ecommerce",
    name: "E-commerce / Support",
    tagline: "Order status, returns & FAQ",
    icon: ShoppingBag,
    accent: "from-violet-500/20 to-violet-500/5",
    starterPrompt:
      "You are an empathetic e-commerce support agent. Look up orders by order number or email, explain status, initiate returns, and answer policy questions. Escalate billing disputes to a human.",
    starterFirstMessage: "Hi! I can help with your order, returns, or any product questions — what's going on?",
    goals: ["Resolve order issues", "Process returns", "Answer FAQs"],
  },
];

// Character voices — friendly names, no provider/model jargon
export const VOICES = [
  { id: "jennifer", label: "Jennifer", description: "Warm, professional · Female" },
  { id: "ryan", label: "Ryan", description: "Confident, clear · Male" },
  { id: "sarah", label: "Sarah", description: "Friendly, British · Female" },
  { id: "mark", label: "Mark", description: "Calm, reassuring · Male" },
  { id: "ava", label: "Ava", description: "Bright, youthful · Female" },
  { id: "leo", label: "Leo", description: "Deep, authoritative · Male" },
];

export const LANGUAGES = [
  { id: "en-US", label: "English (US)" },
  { id: "en-GB", label: "English (UK)" },
  { id: "es-ES", label: "Spanish" },
  { id: "fr-FR", label: "French" },
  { id: "de-DE", label: "German" },
  { id: "hi-IN", label: "Hindi" },
  { id: "pt-BR", label: "Portuguese (BR)" },
  { id: "it-IT", label: "Italian" },
  { id: "ja-JP", label: "Japanese" },
  { id: "zh-CN", label: "Mandarin" },
];
