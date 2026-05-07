import type { Metadata } from "next";
import { DeployPageClient } from "@/components/deploy/deploy-page-client";

export const metadata: Metadata = {
  title: "Deploy",
  description:
    "Prepare and deploy Skytells Spark applications to dedicated Skytells containers with private service networking.",
};

export default function DeployPage() {
  return <DeployPageClient />;
}
