import React from "react";
import { ToastType } from "./ToastContext";

interface ToastItemProps {
  title: string;
  description: string;
  type: ToastType;
  onClose: () => void;
}

const ToastItem: React.FC<ToastItemProps> = ({ title = "", description = "", type = "warning", onClose }) => {
  const bgColor: Record<ToastType, string> = {
    success: "bg-green-100 border-green-300",
    error: "bg-red-100 border-red-300",
    warning: "bg-yellow-100 border-yellow-300",
  };

  const textColor: Record<ToastType, string> = {
    success: "text-green-800",
    error: "text-red-800",
    warning: "text-yellow-800",
  };

  return (
    <div
      className={`w-[362px] h-auto flex items-center justify-between gap-6 
        px-4 py-3 border rounded-lg shadow-[0px_5px_5px_rgba(18,39,21,0.05)] 
        ${bgColor[type]}`}
    >
      <div className="flex flex-col gap-1 w-[245px]">
        {title && (
          <p className={`text-[16px] font-medium leading-[125%] tracking-[-0.02em] ${textColor[type]}`}>{title}</p>
        )}
        {description && (
          <p className={`text-[14px] font-normal leading-[125%] tracking-[-0.02em] ${textColor[type]}`}>
            {description}
          </p>
        )}
      </div>
      <button
        onClick={onClose}
        className="flex items-center justify-center gap-2 
          px-3 py-[6px] w-[61px] h-[30px] bg-[#EFF0F3] rounded 
          text-[14px] font-medium text-[#232A25]"
      >
        Close
      </button>
    </div>
  );
};

export default ToastItem;
