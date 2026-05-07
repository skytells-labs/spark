import type { Metadata } from "next";
import { HomeClient } from "@/components/chat/home-client";

export const metadata: Metadata = {
  title: "AI Application Builder",
  description:
    "Generate production-ready application code, UI, assets, database plans, and deployment guidance with Skytells.",
};

export default function Page() {
  return <HomeClient />;
}
