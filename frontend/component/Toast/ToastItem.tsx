import Toast from "@/design/ui/Toast";

/** Superseded by design/ui/Toast (P1-02/03); kept as a wrapper until its removal is approved (docs/TODO.md). */
const ToastItem = ({ title = "", description = "", type = "warning", onClose }: ToastItemProps) => (
  <Toast title={title} description={description} tone={type} onClose={onClose} />
);

export default ToastItem;
