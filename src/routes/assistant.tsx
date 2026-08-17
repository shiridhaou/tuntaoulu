import { createFileRoute } from "@tanstack/react-router";
import { RolePanel } from "@/components/RolePanel";

export const Route = createFileRoute("/assistant")({
  validateSearch: (s: Record<string, unknown>) => ({
    session: typeof s.session === "string" ? s.session : undefined,
  }),
  head: () => ({
    meta: [
      { title: "الحكم المساعد — منصة التحكيم للووشو" },
      { name: "description", content: "لوحة الحكم المساعد ضمن منصة التحكيم للجامعة التونسية للووشو كونغ فو." },
      { property: "og:title", content: "الحكم المساعد — منصة التحكيم للووشو" },
      { property: "og:description", content: "لوحة الحكم المساعد ضمن منصة التحكيم للجامعة التونسية للووشو كونغ فو." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: () => <RolePanel role="assistant-referee" />,
});
