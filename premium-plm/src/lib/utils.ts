import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

// Joins class names and lets a later Tailwind class win over an earlier
// clashing one (the helper every shadcn-registry component imports).
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
