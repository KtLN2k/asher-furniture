"use client";

import { Suspense } from "react";
import { CustomerDetail } from "@/components/customers/customer-detail";
import { useRouteId } from "@/lib/routes";

export default function CustomerPage() {
  return (
    <Suspense>
      <CustomerPageInner />
    </Suspense>
  );
}

function CustomerPageInner() {
  const id = useRouteId();
  return <CustomerDetail id={id} />;
}
