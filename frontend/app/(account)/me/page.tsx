import type { Metadata } from "next";
import { MeView } from "./view";

export const metadata: Metadata = { title: "Your profile", description: "Your rank, credit and signed project record on Connect." };

export default function MePage() {
  return <MeView />;
}
