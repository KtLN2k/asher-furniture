import type { MetadataRoute } from "next";

// נדרש לייצוא הסטטי של האפליקציה (output: export); באתר המניפסט ממילא קבוע
export const dynamic = "force-static";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "רהיטי אשר",
    short_name: "רהיטי אשר",
    description: "תכנון רהיטים בהתאמה אישית",
    lang: "he",
    dir: "rtl",
    start_url: "/",
    display: "standalone",
    background_color: "#fdfbf7",
    theme_color: "#774a2b",
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
      { src: "/icons/icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
