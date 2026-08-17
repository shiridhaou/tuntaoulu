import { createFileRoute, Navigate } from "@tanstack/react-router";
import { useCompetition } from "@/store/competition-store";

import { RoleSelection } from "@/components/RoleSelection";
import { pathForRole } from "@/components/RolePanel";


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
  const { selectedRole, sessionCode, storageHydrated } = useCompetition();

  // Wait for the persisted role/session to be restored before deciding what to
  // render — otherwise a reload briefly sees a null role and bounces the user
  // off their assigned station.
  if (!storageHydrated) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: "#050505" }}>
        <span className="text-xs tracking-widest uppercase text-white/50 font-body">Restoring session…</span>
      </div>
    );
  }

  if (!selectedRole) return <RoleSelection />;

  // Every role now lives on its own bookmarkable URL (/ta, /chief, /judge-a, …)
  // so a refresh or tab switch restores the exact same panel + session.
  return (
    <Navigate
      to={pathForRole(selectedRole)}
      search={sessionCode ? { session: sessionCode } : undefined}
      replace
    />
  );
}

