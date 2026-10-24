"use client";

import Image from "next/image";
import { useState } from "react";
import { cn } from "./cn";

export interface AvatarProps {
  name: string;
  /** Photo URL; falls back to initials when missing or broken. */
  src?: string | null;
  size?: "sm" | "md" | "lg";
  className?: string;
}

const SIZES = { sm: "size-6 text-caption", md: "size-8 text-caption", lg: "size-12 text-body" };

/** First letters of the first and last word ("Nadia Rahman" -> "NR"); works for Bangla names too. */
export const initialsOf = (name: string) => {
  const words = name.trim().split(/\s+/).filter(Boolean);
  if (!words.length) return "?";
  const first = Array.from(words[0])[0] ?? "";
  const last = words.length > 1 ? (Array.from(words[words.length - 1])[0] ?? "") : "";
  return (first + last).toLocaleUpperCase();
};

/** A person's photo, or their initials on a soft green circle. */
const Avatar = ({ name, src, size = "md", className }: AvatarProps) => {
  const [broken, setBroken] = useState(false);
  const showImage = Boolean(src) && !broken;

  return (
    <span
      role="img"
      aria-label={name}
      className={cn(
        "relative inline-flex shrink-0 select-none items-center justify-center overflow-hidden rounded-full bg-primary-soft font-semibold text-primary",
        SIZES[size],
        className,
      )}
    >
      {showImage ? (
        // unoptimized: photos come from any storage host, so they are not resized by Next.
        <Image src={src ?? ""} alt="" fill unoptimized className="object-cover" onError={() => setBroken(true)} />
      ) : (
        <span aria-hidden="true">{initialsOf(name)}</span>
      )}
    </span>
  );
};

export default Avatar;
