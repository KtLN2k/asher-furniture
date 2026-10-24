"use client";

import { useParams } from "next/navigation";
import { CustomerDetail } from "@/components/customers/customer-detail";

export default function CustomerPage() {
  const { id } = useParams<{ id: string }>();
  return <CustomerDetail id={id} />;
}
