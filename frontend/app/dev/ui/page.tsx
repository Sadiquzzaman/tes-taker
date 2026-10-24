import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Gallery from "./Gallery";

export const metadata: Metadata = {
  title: "Components — Instructor",
  robots: { index: false, follow: false },
};

/**
 * Every design/ui component in every state (P1-02/03), for review at 375 and 1280 px. On in
 * development and wherever DEV_UI=true (beta); off in production. Shows sample data only.
 */
export default function DevUiPage() {
  if (process.env.NODE_ENV === "production" && process.env.DEV_UI !== "true") {
    notFound();
  }
  return <Gallery />;
}
