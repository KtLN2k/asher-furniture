import type { Metadata } from "next";
import { WizardRoot } from "@/components/wizard/wizard-root";

export const metadata: Metadata = { title: "פרויקט חדש" };

export default function NewProjectPage() {
  return <WizardRoot routeId={null} />;
}
