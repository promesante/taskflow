import { clsx } from 'clsx';
import type { ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

/**
 * shadcn/ui class-name helper: merge conditional class lists and de-dupe
 * conflicting Tailwind utilities. Shared by every `components/ui` primitive.
 */
export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}
