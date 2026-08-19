import { redirect } from "next/navigation";

/** Legacy selection page removed — users choose workspaces from the dashboard/header. */
export default function SelectContextRedirectPage() {
  redirect("/dashboard");
}
