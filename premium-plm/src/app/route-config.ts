import {
  Bell,
  ClipboardCheck,
  FileText,
  Gauge,
  History,
  LayoutDashboard,
  ListOrdered,
  type LucideIcon,
} from "lucide-react";

export interface NavItem {
  label: string;
  to: string;
  icon: LucideIcon;
  comingSoon?: boolean;
}


export const primaryNav: NavItem[] = [
  { label: "Dashboard", to: "/", icon: LayoutDashboard },
  { label: "Initiatives", to: "/initiatives", icon: Gauge, comingSoon: true },
  { label: "BRD Reviews", to: "/brd-reviews", icon: FileText, comingSoon: true },
  { label: "Portfolio", to: "/portfolio", icon: ClipboardCheck, comingSoon: true },
  { label: "Priorities", to: "/priorities", icon: ListOrdered, comingSoon: true },
  {
    label: "Notifications",
    to: "/notifications",
    icon: Bell,
    comingSoon: true,
  },
  {
    label: "Audit Trail",
    to: "/audit-trail",
    icon: History,
    comingSoon: true,
  },
];

export function findNavItem(pathname: string): NavItem | undefined {
  /*
   * The dashboard is matched exactly, not by prefix. Treating it like the other
   * entries made `item.to === "/"` true for every path, so the first item always
   * won and the breadcrumb read "Dashboard" everywhere.
   */
  return primaryNav.find((item) =>
    item.to === "/" ? pathname === "/" : pathname.startsWith(item.to),
  );
}
