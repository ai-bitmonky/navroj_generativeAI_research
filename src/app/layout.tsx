import type { Metadata, Viewport } from "next";
import "@fontsource-variable/bricolage-grotesque/opsz.css";
import "@fontsource-variable/golos-text/index.css";
import "@fontsource-variable/noto-sans-devanagari/index.css";
import "@/styles/core.css";
import "@/styles/mobile.css";
import "@/styles/desktop.css";

export const metadata: Metadata = {
  title: "ekoo",
  description: "Find one thing to do this week. Join a verified volunteering activity or help a neighbour within 3 km, no login needed.",
  applicationName: "ekoo",
  appleWebApp: { capable: true, title: "ekoo", statusBarStyle: "default" },
  formatDetection: { telephone: false },
  openGraph: {
    title: "ekoo",
    description: "Join an activity or help nearby. Most take under two hours.",
    type: "website",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  interactiveWidget: "resizes-content",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#F1F3F0" },
    { media: "(prefers-color-scheme: dark)", color: "#0C0F0E" },
  ],
};

// Apply a saved theme before first paint to avoid a light/dark flash.
const themeScript = `try{var t=localStorage.getItem("ekoo-theme");if(t==="dark"||t==="light")document.documentElement.setAttribute("data-theme",t)}catch(e){}`;

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body>{children}</body>
    </html>
  );
}
