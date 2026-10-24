import type { Metadata, Viewport } from "next";
import "@fontsource-variable/heebo";
import "./globals.css";
import { ToastProvider } from "@/components/ui/toast";

export const metadata: Metadata = {
  title: { default: "רהיטי אשר", template: "%s | רהיטי אשר" },
  description: "מערכת תכנון רהיטים בהתאמה אישית לנגרייה",
  applicationName: "רהיטי אשר",
  appleWebApp: { capable: true, title: "רהיטי אשר", statusBarStyle: "default" },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#774a2b",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="he" dir="rtl" className="h-full antialiased">
      <body className="min-h-full">
        <ToastProvider>{children}</ToastProvider>
      </body>
    </html>
  );
}
