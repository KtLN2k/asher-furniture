"use client";

import { useParams } from "next/navigation";
import { WizardRoot } from "@/components/wizard/wizard-root";

export default function WizardPage() {
  const { id } = useParams<{ id: string }>();
  return <WizardRoot key={id} routeId={id} />;
}
