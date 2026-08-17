import { useEffect } from "react";
import { Navigate, useSearch } from "@tanstack/react-router";
import { useCompetition, type UserRole } from "@/store/competition-store";

import { ChiefRefereeDashboard } from "@/components/ChiefRefereeDashboard";
import { ChiefSetupGate } from "@/components/ChiefSetupGate";
import { JudgeAPanel } from "@/components/JudgeAPanel";
import { JudgeBPanel } from "@/components/JudgeBPanel";
import { JudgeCPanel } from "@/components/JudgeCPanel";
import { AssistantRefereePanel } from "@/components/AssistantRefereePanel";
import { TechnicalAssistantDashboard } from "@/components/TechnicalAssistantDashboard";
import { SessionGuard } from "@/components/SessionGuard";

/** Explicit, bookmarkable URL per role. */
export const ROLE_PATHS: Record<Exclude<UserRole, null>, string> = {
  "chief-referee": "/chief",
  "technical-assistant": "/ta",
  "a-quality-judge": "/judge-a",
  "b-performance-judge": "/judge-b",
  "c-difficulty-judge": "/judge-c",
  "assistant-referee": "/assistant",
};

export function pathForRole(role: UserRole): string {
  return role ? (ROLE_PATHS[role] ?? "/") : "/";
}

/** Slot prefix is the single source of truth for which judge panel renders. */
function panelRoleFromSlot(judgeId: string | null): UserRole | null {
  if (!judgeId) return null;
  if (judgeId.startsWith("AHJ")) return "assistant-referee";
  if (judgeId.startsWith("A")) return "a-quality-judge";
  if (judgeId.startsWith("B")) return "b-performance-judge";
  if (judgeId.startsWith("C")) return "c-difficulty-judge";
  return null;
}

function roleNeedsAssignedSlot(role: UserRole) {
  return (
    role === "a-quality-judge" ||
    role === "b-performance-judge" ||
    role === "c-difficulty-judge" ||
    role === "assistant-referee"
  );
}

/**
 * Renders the panel for an explicit URL role.
 * - Adopts the role from the URL (so a refresh on /judge-a stays on /judge-a).
 * - Adopts ?session=CODE when present, otherwise keeps the persisted code.
 * No sync / realtime logic lives here.
 */
export function RolePanel({ role }: { role: Exclude<UserRole, null> }) {
  const {
    selectedRole, setSelectedRole, judgeId, sessionCode, setSessionCode,
    setupComplete, setSetupComplete, storageHydrated,
  } = useCompetition();

  const search = useSearch({ strict: false }) as { session?: string };
  const urlSession = typeof search?.session === "string" ? search.session.trim().toUpperCase() : "";

  useEffect(() => {
    if (!storageHydrated) return;
    if (selectedRole !== role) setSelectedRole(role);
  }, [storageHydrated, selectedRole, role, setSelectedRole]);

  useEffect(() => {
    if (!storageHydrated) return;
    if (urlSession && urlSession !== sessionCode) setSessionCode(urlSession);
  }, [storageHydrated, urlSession, sessionCode, setSessionCode]);

  if (!storageHydrated) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: "#050505" }}>
        <span className="text-xs tracking-widest uppercase text-white/50 font-body">Restoring session…</span>
      </div>
    );
  }

  if (role === "chief-referee") {
    if (!setupComplete) return <ChiefSetupGate onComplete={() => setSetupComplete(true)} />;
    return <ChiefRefereeDashboard />;
  }
  if (role === "technical-assistant") return <TechnicalAssistantDashboard />;

  if (!judgeId) return <Navigate to="/judge-join" />;

  const effectiveRole = panelRoleFromSlot(judgeId);
  if (!effectiveRole || (roleNeedsAssignedSlot(role) && effectiveRole !== role)) {
    return <Navigate to="/judge-join" />;
  }

  const panel =
    effectiveRole === "a-quality-judge" ? <JudgeAPanel /> :
    effectiveRole === "b-performance-judge" ? <JudgeBPanel /> :
    effectiveRole === "c-difficulty-judge" ? <JudgeCPanel /> :
    <AssistantRefereePanel />;

  return <SessionGuard>{panel}</SessionGuard>;
}
