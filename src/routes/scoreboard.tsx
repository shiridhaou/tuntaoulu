import { createFileRoute } from "@tanstack/react-router";
import { PublicScoreboard } from "@/components/PublicScoreboard";

export const Route = createFileRoute("/scoreboard")({
  head: () => ({
    meta: [
      { title: "لوحة النتائج — الجامعة التونسية للووشو" },
      { name: "description", content: "لوحة النتائج العامة للمنافسة" },
      { property: "og:title", content: "لوحة النتائج — الجامعة التونسية للووشو" },
      { property: "og:description", content: "لوحة النتائج العامة للمنافسة" },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: ScoreboardPage,
});

function ScoreboardPage() {
  return <PublicScoreboard />;
}
