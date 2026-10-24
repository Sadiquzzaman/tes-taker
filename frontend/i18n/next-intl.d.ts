import type messages from "../messages/en.json";
import type { Locale } from "./config";

// Type-checks message keys (t("nav.plans")) and the locale against messages/en.json.
declare module "next-intl" {
  interface AppConfig {
    Locale: Locale;
    Messages: typeof messages;
  }
}
