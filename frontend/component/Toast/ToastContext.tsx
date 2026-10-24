"use client";

import { createContext, useContext, useState, useCallback } from "react";
import Toast, { ToastRegion } from "@/design/ui/Toast";

const ToastContext = createContext<ToastContextProps | undefined>(undefined);

export const useToast = () => {
  const context = useContext(ToastContext);
  if (!context) throw new Error("useToast must be used within a ToastProvider");
  return context;
};

export const ToastProvider: React.FC<ToastProviderProps> = ({ children }) => {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const triggerToast = useCallback((toast: ToastPayload) => {
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

      <ToastRegion>
        {toasts.map((toast) => (
          <Toast
            key={toast.id}
            title={toast.title}
            description={toast.description}
            tone={toast.type || "warning"}
            onClose={() => removeToast(toast.id)}
          />
        ))}
      </ToastRegion>
    </ToastContext.Provider>
  );
};
