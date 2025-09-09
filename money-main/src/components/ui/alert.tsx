"use client";

import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "@/lib/utils"

const alertVariants = cva(
  "relative w-full rounded-lg border px-4 py-3 text-sm grid has-[>svg]:grid-cols-[calc(var(--spacing)*4)_1fr] grid-cols-[0_1fr] has-[>svg]:gap-x-3 gap-y-0.5 items-start [&>svg]:size-4 [&>svg]:translate-y-0.5 [&>svg]:text-current",
  {
    variants: {
      variant: {
        default: "bg-card text-card-foreground",
        destructive:
          "text-destructive bg-card [&>svg]:text-current *:data-[slot=alert-description]:text-destructive/90",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
)

function Alert({
  className,
  variant,
  ...props
}: React.ComponentProps<"div"> & VariantProps<typeof alertVariants>) {
  return (
    <div
      data-slot="alert"
      role="alert"
      className={cn(alertVariants({ variant }), className)}
      {...props}
    />
  )
}

function AlertTitle({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="alert-title"
      className={cn(
        "col-start-2 line-clamp-1 min-h-4 font-medium tracking-tight",
        className
      )}
      {...props}
    />
  )
}

function AlertDescription({
  className,
  ...props
}: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="alert-description"
      className={cn(
        "text-muted-foreground col-start-2 grid justify-items-start gap-1 text-sm [&_p]:leading-relaxed",
        className
      )}
      {...props}
    />
  )
}

// --- Toast System ---
const ToastContext = React.createContext<any>(null);

const ICONS = {
  success: '✅',
  error: '❌',
  warning: '⚠️',
  info: 'ℹ️',
};

type ToastType = keyof typeof ICONS;
interface ToastItem {
  id: number;
  type: ToastType;
  message: string;
}

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = React.useState<ToastItem[]>([]);
  const addToast = React.useCallback((toast: { type: ToastType; message: string }) => {
    const id = Date.now() + Math.random();
    setToasts((prev) => [...prev, { ...toast, id }]);
    // Auto-dismiss after 3s
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 3000);
  }, []);
  const removeToast = React.useCallback((id: number) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);
  return (
    <ToastContext.Provider value={{ addToast }}>
      {children}
      <div className="fixed top-8 left-1/2 z-[9999] flex flex-col gap-4 items-center -translate-x-1/2">
        {toasts.map((toast) => (
          <div
            key={toast.id}
            className={`min-w-[320px] max-w-[90vw] px-8 py-6 rounded-lg shadow-2xl border-2 text-2xl font-bold flex items-center gap-4 animate-fade-in-up
              ${toast.type === 'success' ? 'bg-green-50 border-green-500 text-green-800' : ''}
              ${toast.type === 'error' ? 'bg-red-50 border-red-500 text-red-800' : ''}
              ${toast.type === 'warning' ? 'bg-yellow-50 border-yellow-500 text-yellow-800' : ''}
              ${toast.type === 'info' ? 'bg-blue-50 border-blue-500 text-blue-800' : ''}
            `}
            role="alert"
            style={{ animationDuration: '0.4s' }}
          >
            <span className="text-3xl">{ICONS[toast.type]}</span>
            <span>{toast.message}</span>
            <button
              className="ml-4 text-lg px-2 py-1 rounded hover:bg-gray-200"
              onClick={() => removeToast(toast.id)}
              aria-label="닫기"
            >
              ×
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const ctx = React.useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used within ToastProvider');
  return ctx.addToast;
}

export { Alert, AlertTitle, AlertDescription }
