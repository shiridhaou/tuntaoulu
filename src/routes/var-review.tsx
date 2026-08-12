import { createFileRoute } from "@tanstack/react-router";
import { VarReviewDashboard } from "@/components/VarReviewDashboard";

export const Route = createFileRoute("/var-review")({
  head: () => ({
    meta: [
      { title: "VAR Review — Tunisian Wushu" },
      { name: "description", content: "Video Assistant Referee dashboard for live score review and flagging." },
      { property: "og:title", content: "VAR Review — Tunisian Wushu" },
      { property: "og:description", content: "Real-time monitoring and re-evaluation of judging scores." },
    ],
  }),
  component: VarReviewPage,
});

function VarReviewPage() {
  return <VarReviewDashboard />;
}
