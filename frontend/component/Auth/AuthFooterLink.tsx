import { Link } from "@/design/ui";

/** "Already have an account? Log in" under an auth form. */
const AuthFooterLink = ({ text, href, label }: { text: string; href: string; label: string }) => (
  <p className="text-center text-body text-ink-muted">
    {text}{" "}
    <Link href={href} className="font-medium">
      {label}
    </Link>
  </p>
);

export default AuthFooterLink;
