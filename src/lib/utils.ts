import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function sanitizeFileName(name: string): string {
  // 영문, 숫자, ., _, -만 허용, 나머지는 _로 치환
  return name.replace(/[^a-zA-Z0-9._-]/g, '_');
}
