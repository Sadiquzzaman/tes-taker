import { redirect } from "next/navigation";

/** "My Learning" removed — students use Classes with workspace filters. */
export default function LearningRedirectPage() {
  redirect("/classes");
}
