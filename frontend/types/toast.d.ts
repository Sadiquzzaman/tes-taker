type ToastType = "success" | "error" | "warning";

interface Toast {
  id: number;
  title?: string;
  description?: string;
  type?: ToastType;
}

type ToastPayload = Omit<Toast, "id">;

interface ToastContextProps {
  triggerToast: (toast: ToastPayload) => void;
}

interface ToastProviderProps {
  children: React.ReactNode;
}

interface ToastItemProps {
  title: string;
  description: string;
  type: ToastType;
  onClose: () => void;
}
