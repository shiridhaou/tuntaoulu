import { createFileRoute, Navigate } from "@tanstack/react-router";
import { useCompetition, type UserRole } from "@/store/competition-store";

import { RoleSelection } from "@/components/RoleSelection";
import { ChiefRefereeDashboard } from "@/components/ChiefRefereeDashboard";
import { ChiefSetupGate } from "@/components/ChiefSetupGate";
import { JudgeAPanel } from "@/components/JudgeAPanel";
import { JudgeBPanel } from "@/components/JudgeBPanel";
import { JudgeCPanel } from "@/components/JudgeCPanel";
import { AssistantRefereePanel } from "@/components/AssistantRefereePanel";
import { TechnicalAssistantDashboard } from "@/components/TechnicalAssistantDashboard";
import { SessionGuard } from "@/components/SessionGuard";

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

// Single source of truth: the assigned slot prefix decides which judge panel is rendered.
// This prevents stale `selectedRole` (e.g. user clicked Judge A then re-requested as AHJ)
// from forcing the wrong UI.
function panelRoleFromSlot(judgeId: string | null): UserRole | null {
  if (!judgeId) return null;
  // IMPORTANT: check "AHJ" before "A" because "AHJ".startsWith("A") is also true.
  if (judgeId.startsWith("AHJ")) return "assistant-referee";
  if (judgeId.startsWith("A")) return "a-quality-judge";
  if (judgeId.startsWith("B")) return "b-performance-judge";
  if (judgeId.startsWith("C")) return "c-difficulty-judge";
  return null;
}

function roleNeedsAssignedSlot(role: UserRole) {
  return role === "a-quality-judge" || role === "b-performance-judge" || role === "c-difficulty-judge" || role === "assistant-referee";
}

function Index() {
  const { selectedRole, judgeId, setupComplete, setSetupComplete, storageHydrated } = useCompetition();

  // Wait for the persisted role/session to be restored before deciding what to
  // render — otherwise a reload or a socket-driven remount briefly sees a null
  // role and bounces the user off their assigned station.
  if (!storageHydrated) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: "#050505" }}>
        <span className="text-xs tracking-widest uppercase text-white/50 font-body">Restoring session…</span>
      </div>
    );
  }

  if (!selectedRole) return <RoleSelection />;


  // Standalone roles (no slot assignment needed)
  if (selectedRole === "chief-referee") {
    if (!setupComplete) return <ChiefSetupGate onComplete={() => setSetupComplete(true)} />;
    return <ChiefRefereeDashboard />;
  }
  if (selectedRole === "technical-assistant") {
    // TA has its own internal SessionEntryGate (verifies code against `sessions` table
    // exactly like judges do). Wrapping it in <SessionGuard> would double-block them
    // before they ever get a chance to type the chief's code → "Session Unauthorized".
    return <TechnicalAssistantDashboard />;
  }

  // All judging roles (A/B/C/AHJ) MUST come through /judge-join so the chief assigns a slot.
  if (!judgeId) return <Navigate to="/judge-join" />;

  // Derive the panel from the actual assigned slot — never trust the locally-selected role here,
  // because users may have picked a different role in RoleSelection than what the chief approved.
  const effectiveRole = panelRoleFromSlot(judgeId);

  if (!effectiveRole || (roleNeedsAssignedSlot(selectedRole) && effectiveRole !== selectedRole)) {
    return <Navigate to="/judge-join" />;
  }

  const panel =
    effectiveRole === "a-quality-judge" ? <JudgeAPanel /> :
    effectiveRole === "b-performance-judge" ? <JudgeBPanel /> :
    effectiveRole === "c-difficulty-judge" ? <JudgeCPanel /> :
    <AssistantRefereePanel />;

  return <SessionGuard>{panel}</SessionGuard>;
}
