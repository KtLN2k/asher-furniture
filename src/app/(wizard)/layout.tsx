import { AppShell } from "@/components/shell/app-shell";

export default function WizardLayout({ children }: { children: React.ReactNode }) {
  return <AppShell focusOnMobile>{children}</AppShell>;
}
