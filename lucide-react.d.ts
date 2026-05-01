declare module "lucide-react" {
  import * as React from "react";

  export interface LucideProps extends React.SVGProps<SVGSVGElement> {
    size?: string | number;
    absoluteStrokeWidth?: boolean;
  }

  export type LucideIcon = React.ForwardRefExoticComponent<
    Omit<LucideProps, "ref"> & React.RefAttributes<SVGSVGElement>
  >;

  export const ChevronLeft: LucideIcon;
  export const ChevronRight: LucideIcon;
  export const AlertCircle: LucideIcon;
  export const RefreshCcw: LucideIcon;
  export const Home: LucideIcon;
  export const ArrowLeft: LucideIcon;
  export const CircleDollarSign: LucideIcon;
  export const ClipboardList: LucideIcon;
  export const ClipboardPenLine: LucideIcon;
  export const Download: LucideIcon;
  export const Eye: LucideIcon;
  export const EyeOff: LucideIcon;
  export const FileText: LucideIcon;
  export const KeyRound: LucideIcon;
  export const LayoutDashboard: LucideIcon;
  export const LogIn: LucideIcon;
  export const LogOut: LucideIcon;
  export const MapPin: LucideIcon;
  export const Package: LucideIcon;
  export const PackageCheck: LucideIcon;
  export const PackagePlus: LucideIcon;
  export const PenLine: LucideIcon;
  export const Plus: LucideIcon;
  export const Printer: LucideIcon;
  export const Search: LucideIcon;
  export const ShieldAlert: LucideIcon;
  export const ShieldCheck: LucideIcon;
  export const ShieldOff: LucideIcon;
  export const Ship: LucideIcon;
  export const Trash2: LucideIcon;
  export const Truck: LucideIcon;
  export const User: LucideIcon;
  export const UserCircle: LucideIcon;
  export const UserPlus: LucideIcon;
  export const Users: LucideIcon;
  export const Warehouse: LucideIcon;
}
