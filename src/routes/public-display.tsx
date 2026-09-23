import { createFileRoute } from "@tanstack/react-router";
import { PublicDisplay } from "@/components/PublicDisplay";

export const Route = createFileRoute("/public-display")({
  head: () => ({
    meta: [
      { title: "Public Display — Tunisian Wushu Federation" },
      { name: "description", content: "Live public display of athlete scores, judging breakdown and AI insights." },
      { property: "og:title", content: "Public Display — Tunisian Wushu" },
      { property: "og:description", content: "Live published scores with full judging transparency." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: PublicDisplayPage,
});

function PublicDisplayPage() {
  return <PublicDisplay />;
}
