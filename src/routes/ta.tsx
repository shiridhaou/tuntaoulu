import { createFileRoute } from "@tanstack/react-router";
import { RolePanel } from "@/components/RolePanel";

export const Route = createFileRoute("/ta")({
  validateSearch: (s: Record<string, unknown>) => ({
    session: typeof s.session === "string" ? s.session : undefined,
  }),
  head: () => ({
    meta: [
      { title: "المساعد التقني — منصة التحكيم للووشو" },
      { name: "description", content: "لوحة المساعد التقني ضمن منصة التحكيم للجامعة التونسية للووشو كونغ فو." },
      { property: "og:title", content: "المساعد التقني — منصة التحكيم للووشو" },
      { property: "og:description", content: "لوحة المساعد التقني ضمن منصة التحكيم للجامعة التونسية للووشو كونغ فو." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: () => <RolePanel role="technical-assistant" />,
});
