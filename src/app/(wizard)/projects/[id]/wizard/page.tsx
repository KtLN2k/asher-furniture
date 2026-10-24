"use client";

import { Suspense } from "react";
import { WizardRoot } from "@/components/wizard/wizard-root";
import { useRouteId } from "@/lib/routes";

export default function WizardPage() {
  return (
    <Suspense>
      <WizardPageInner />
    </Suspense>
  );
}

function WizardPageInner() {
  const id = useRouteId();
  return <WizardRoot key={id} routeId={id} />;
}
