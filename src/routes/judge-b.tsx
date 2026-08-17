import { createFileRoute } from "@tanstack/react-router";
import { RolePanel } from "@/components/RolePanel";

export const Route = createFileRoute("/judge-b")({
  validateSearch: (s: Record<string, unknown>) => ({
    session: typeof s.session === "string" ? s.session : undefined,
  }),
  head: () => ({
    meta: [
      { title: "حكم المجموعة ب — منصة التحكيم للووشو" },
      { name: "description", content: "لوحة حكم المجموعة ب ضمن منصة التحكيم للجامعة التونسية للووشو كونغ فو." },
      { property: "og:title", content: "حكم المجموعة ب — منصة التحكيم للووشو" },
      { property: "og:description", content: "لوحة حكم المجموعة ب ضمن منصة التحكيم للجامعة التونسية للووشو كونغ فو." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: () => <RolePanel role="b-performance-judge" />,
});
