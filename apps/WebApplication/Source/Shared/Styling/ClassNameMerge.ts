import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

/**
 * Shared class-name merge owner for Tailwind + conditional class composition.
 */
export function mergeClassNames(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}

export const cn = mergeClassNames;
