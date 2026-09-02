export type BusinessPreset = {
  id: string;
  label: string;
  description: string;
  topics: Array<{ label: string; icon: string }>;
  qrSuggestions: string[];
};

const UNIVERSAL_TOPICS = [
  { label: "Overall Quality", icon: "★" },
  { label: "Staff / Support", icon: "🤝" },
  { label: "Value / Pricing", icon: "◎" },
  { label: "Ease / Convenience", icon: "✓" },
  { label: "Environment / Cleanliness", icon: "✨" },
  { label: "Speed / Timeliness", icon: "⚡" },
];

export const BUSINESS_PRESETS: BusinessPreset[] = [
  {
    id: "restaurant-cafe",
    label: "Restaurant / Cafe",
    description: "Food, service and dine-in experiences",
    topics: [
      { label: "Food / Drink Quality", icon: "★" },
      { label: "Staff / Service", icon: "🤝" },
      { label: "Speed / Wait Time", icon: "⚡" },
      { label: "Value / Pricing", icon: "◎" },
      { label: "Ambience", icon: "◌" },
      { label: "Cleanliness", icon: "✨" },
    ],
    qrSuggestions: ["Table", "Checkout", "Reception", "Takeaway Counter"],
  },
  {
    id: "healthcare",
    label: "Clinic / Healthcare",
    description: "Clinics, dental, diagnostics and care services",
    topics: [
      { label: "Care Quality", icon: "★" },
      { label: "Doctor / Staff", icon: "🤝" },
      { label: "Communication", icon: "◌" },
      { label: "Wait Time", icon: "⚡" },
      { label: "Cleanliness", icon: "✨" },
      { label: "Process / Convenience", icon: "✓" },
    ],
    qrSuggestions: ["Reception", "Billing Desk", "Waiting Area", "Consultation Exit"],
  },
  {
    id: "salon-beauty",
    label: "Salon / Beauty / Spa",
    description: "Beauty, grooming and wellness services",
    topics: [
      { label: "Service Quality", icon: "★" },
      { label: "Staff / Professionalism", icon: "🤝" },
      { label: "Hygiene", icon: "✨" },
      { label: "Wait Time", icon: "⚡" },
      { label: "Ambience", icon: "◌" },
      { label: "Value / Pricing", icon: "◎" },
    ],
    qrSuggestions: ["Reception", "Checkout", "Service Station", "Waiting Area"],
  },
  {
    id: "hospitality",
    label: "Hotel / Hospitality",
    description: "Hotels, stays and guest experiences",
    topics: [
      { label: "Overall Stay", icon: "★" },
      { label: "Staff / Service", icon: "🤝" },
      { label: "Room / Space Quality", icon: "◌" },
      { label: "Cleanliness", icon: "✨" },
      { label: "Check-in / Convenience", icon: "✓" },
      { label: "Value / Pricing", icon: "◎" },
    ],
    qrSuggestions: ["Reception", "Room", "Checkout", "Restaurant"],
  },
  {
    id: "fitness",
    label: "Gym / Fitness",
    description: "Gyms, studios and fitness centers",
    topics: [
      { label: "Overall Experience", icon: "★" },
      { label: "Trainer / Staff", icon: "🤝" },
      { label: "Equipment / Facilities", icon: "◌" },
      { label: "Cleanliness", icon: "✨" },
      { label: "Convenience", icon: "✓" },
      { label: "Value / Pricing", icon: "◎" },
    ],
    qrSuggestions: ["Reception", "Workout Floor", "Locker Area", "Exit"],
  },
  {
    id: "retail",
    label: "Retail / Showroom",
    description: "Stores, showrooms and physical retail",
    topics: [
      { label: "Overall Quality", icon: "★" },
      { label: "Staff / Support", icon: "🤝" },
      { label: "Value / Pricing", icon: "◎" },
      { label: "Availability / Choice", icon: "✓" },
      { label: "Environment", icon: "✨" },
      { label: "Checkout Speed", icon: "⚡" },
    ],
    qrSuggestions: ["Billing Counter", "Entrance", "Help Desk", "Packaging"],
  },
  {
    id: "education",
    label: "Education / Coaching",
    description: "Schools, institutes, classes and training",
    topics: [
      { label: "Learning Quality", icon: "★" },
      { label: "Teacher / Staff", icon: "🤝" },
      { label: "Communication", icon: "◌" },
      { label: "Facilities / Environment", icon: "✨" },
      { label: "Process / Convenience", icon: "✓" },
      { label: "Value", icon: "◎" },
    ],
    qrSuggestions: ["Reception", "Classroom", "Front Desk", "Exit"],
  },
  {
    id: "professional-services",
    label: "Professional Services",
    description: "Consulting, legal, finance and service businesses",
    topics: UNIVERSAL_TOPICS,
    qrSuggestions: ["Reception", "Meeting Room", "Billing Desk", "Exit"],
  },
  {
    id: "automotive",
    label: "Automotive / Service Center",
    description: "Dealerships, workshops and vehicle services",
    topics: [
      { label: "Service Quality", icon: "★" },
      { label: "Staff / Communication", icon: "🤝" },
      { label: "Speed / Turnaround", icon: "⚡" },
      { label: "Value / Pricing", icon: "◎" },
      { label: "Process / Convenience", icon: "✓" },
      { label: "Facility / Cleanliness", icon: "✨" },
    ],
    qrSuggestions: ["Service Desk", "Delivery Area", "Billing Desk", "Vehicle"],
  },
  {
    id: "real-estate",
    label: "Real Estate",
    description: "Brokerages, property offices and site visits",
    topics: [
      { label: "Overall Experience", icon: "★" },
      { label: "Agent / Staff", icon: "🤝" },
      { label: "Communication", icon: "◌" },
      { label: "Process / Convenience", icon: "✓" },
      { label: "Speed / Responsiveness", icon: "⚡" },
      { label: "Value / Guidance", icon: "◎" },
    ],
    qrSuggestions: ["Office Reception", "Site Visit", "Meeting Desk", "Handover"],
  },
  {
    id: "other",
    label: "Other / Custom",
    description: "Start universal and customize every topic",
    topics: UNIVERSAL_TOPICS,
    qrSuggestions: ["Reception", "Checkout", "Service Area", "Other"],
  },
];

export function getBusinessPreset(value?: string | null) {
  return BUSINESS_PRESETS.find((preset) => preset.id === value) ?? BUSINESS_PRESETS[BUSINESS_PRESETS.length - 1];
}
