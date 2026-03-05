"use client";

import { createContext, useContext, useState, ReactNode, useCallback } from "react";
import ToastItem from "./ToastItem";
export type ToastType = "success" | "error" | "warning";

interface Toast {
  id: number;
  title?: string;
  description?: string;
  type?: ToastType;
}

interface ToastContextProps {
  triggerToast: (toast: Omit<Toast, "id">) => void;
}

const ToastContext = createContext<ToastContextProps | undefined>(undefined);

export const useToast = () => {
  const context = useContext(ToastContext);
  if (!context) throw new Error("useToast must be used within a ToastProvider");
  return context;
};

interface ToastProviderProps {
  children: ReactNode;
}

export const ToastProvider: React.FC<ToastProviderProps> = ({ children }) => {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const triggerToast = useCallback((toast: Omit<Toast, "id">) => {
    const id = Date.now();
    setToasts((prev) => [...prev, { ...toast, id }]);

    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 5000);
  }, []);

  const removeToast = (id: number) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  };

  return (
    <ToastContext.Provider value={{ triggerToast }}>
      {children}

      <div className="fixed right-4 top-4 flex flex-col gap-2 z-50">
        {toasts.map((toast) => (
          <ToastItem
            key={toast.id}
            title={toast.title || ""}
            description={toast.description || ""}
            type={toast.type || "warning"}
            onClose={() => removeToast(toast.id)}
          />
        ))}
      </div>
    </ToastContext.Provider>
  );
};
