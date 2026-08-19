import { createFileRoute } from "@tanstack/react-router";

import { RoleSelection } from "@/components/RoleSelection";


export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "منصة التحكيم — الجامعة التونسية للووشو كونغ فو" },
      { name: "description", content: "المنصة الرسمية للتحكيم للجامعة التونسية للووشو كونغ فو" },
      { property: "og:title", content: "منصة التحكيم — الجامعة التونسية للووشو كونغ فو" },
      { property: "og:description", content: "المنصة الرسمية للتحكيم للجامعة التونسية للووشو كونغ فو" },
    ],
  }),
  component: Index,
});

function Index() {
  // Root ALWAYS shows the role picker — no silent auto-routing into a panel.
  // Role-specific URLs (/ta, /chief, /judge-a …) remain directly bookmarkable.
  return <RoleSelection />;
}
