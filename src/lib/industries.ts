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

export const VOICES = [
  { id: "jennifer", label: "Jennifer", description: "Warm, professional female (US)" },
  { id: "ryan", label: "Ryan", description: "Confident male (US)" },
  { id: "sarah", label: "Sarah", description: "Friendly female (UK)" },
  { id: "mark", label: "Mark", description: "Calm male (US)" },
];

export const MODELS = [
  { id: "gpt-4o-mini", label: "GPT-4o mini · fast & cheap" },
  { id: "gpt-4o", label: "GPT-4o · best quality" },
  { id: "gpt-3.5-turbo", label: "GPT-3.5 Turbo · lowest latency" },
];
