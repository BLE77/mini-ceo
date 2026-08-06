import type { Metadata } from "next";
import MiniCeoApp from "./mini-ceo-app";

export const metadata: Metadata = {
  title: "Mini CEO - Your boss in your pocket",
  description:
    "A character-first creator operating system that turns ideas into a publishing schedule and keeps you accountable until the work ships.",
};

export default function Home() {
  return <MiniCeoApp />;
}
