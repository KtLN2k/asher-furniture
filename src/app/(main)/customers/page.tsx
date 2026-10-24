import type { Metadata } from "next";
import { CustomersView } from "@/components/customers/customers-view";

export const metadata: Metadata = { title: "לקוחות" };

export default function CustomersPage() {
  return <CustomersView />;
}
