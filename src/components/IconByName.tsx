// Central lucide icon registry: render any data-driven icon by its string name.
// Used for industry tabs, category chips, and headers.
import {
  BadgeCheck,
  Banknote,
  Briefcase,
  Building2,
  Car,
  Clapperboard,
  ClipboardList,
  Cpu,
  Factory,
  FlaskConical,
  Fuel,
  Gamepad2,
  GitBranch,
  GraduationCap,
  HardHat,
  HeartPulse,
  Hotel,
  Landmark,
  Package,
  Pill,
  Plane,
  RadioTower,
  Rocket,
  Server,
  ServerCog,
  ShieldCheck,
  Ship,
  ShoppingCart,
  Truck,
  Wheat,
  Zap,
  type LucideIcon,
} from "lucide-react";

export const ICON_MAP: Record<string, LucideIcon> = {
  BadgeCheck,
  Banknote,
  Briefcase,
  Building2,
  Car,
  Clapperboard,
  ClipboardList,
  Cpu,
  Factory,
  FlaskConical,
  Fuel,
  Gamepad2,
  GitBranch,
  GraduationCap,
  HardHat,
  HeartPulse,
  Hotel,
  Landmark,
  Package,
  Pill,
  Plane,
  RadioTower,
  Rocket,
  Server,
  ServerCog,
  ShieldCheck,
  Ship,
  ShoppingCart,
  Truck,
  Wheat,
  Zap,
};

export default function IconByName({
  name,
  size = 16,
  className,
}: {
  name: string;
  size?: number;
  className?: string;
}) {
  const Icon = ICON_MAP[name] ?? Briefcase;
  return <Icon size={size} className={className} />;
}
