import { Metadata } from "next";
import { LandingPage } from "@/components/landing/LandingPage";

export const metadata: Metadata = {
  title: "Chotu Restro AI — Modern Restaurant Operating System",
  description: "Fast cloud POS, direct QR ordering, station-routed kitchen displays, and multilingual voice billing. Zero aggregator commissions.",
};

export default function RootPage() {
  return <LandingPage />;
}
