import { headers } from "next/headers";
import { userAgent } from "next/server";
import EkooApp from "@/components/EkooApp";

// Server guess from the user agent so the right launch screen shows before the client measures the window.
export default async function Page() {
  const ua = userAgent({ headers: await headers() });
  const guess = ua.device.type === "mobile" || ua.device.type === "tablet" ? "mobile" : "desktop";
  return <EkooApp initialView={guess} />;
}
