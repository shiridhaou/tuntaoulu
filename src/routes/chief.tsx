import { createFileRoute } from "@tanstack/react-router";
import { RolePanel } from "@/components/RolePanel";

export const Route = createFileRoute("/chief")({
  validateSearch: (s: Record<string, unknown>) => ({
    session: typeof s.session === "string" ? s.session : undefined,
  }),
  head: () => ({
    meta: [
      { title: "الحكم الرئيسي — منصة التحكيم للووشو" },
      { name: "description", content: "لوحة الحكم الرئيسي ضمن منصة التحكيم للجامعة التونسية للووشو كونغ فو." },
      { property: "og:title", content: "الحكم الرئيسي — منصة التحكيم للووشو" },
      { property: "og:description", content: "لوحة الحكم الرئيسي ضمن منصة التحكيم للجامعة التونسية للووشو كونغ فو." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: () => <RolePanel role="chief-referee" />,
});
