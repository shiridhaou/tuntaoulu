import { createFileRoute, Navigate, useSearch } from "@tanstack/react-router";
import { useEffect } from "react";
import { useCompetition } from "@/store/competition-store";

/**
 * /judge — generic judge entry point.
 * Resolves the persisted (or URL-supplied) slot to its dedicated panel URL so a
 * reload never renders the wrong view. Unassigned devices go to the join screen.
 */
export const Route = createFileRoute("/judge")({
  validateSearch: (s: Record<string, unknown>) => ({
    session: typeof s.session === "string" ? s.session : undefined,
  }),
  head: () => ({
    meta: [
      { title: "دخول الحكام — منصة التحكيم للووشو" },
      { name: "description", content: "توجيه الحكام إلى لوحاتهم المخصصة حسب الخانة المسندة." },
      { property: "og:title", content: "دخول الحكام — منصة التحكيم للووشو" },
      { property: "og:description", content: "توجيه الحكام إلى لوحاتهم المخصصة حسب الخانة المسندة." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: JudgeDispatch,
});

function slotPath(judgeId: string | null): string | null {
  if (!judgeId) return null;
  if (judgeId.startsWith("AHJ")) return "/assistant";
  if (judgeId.startsWith("A")) return "/judge-a";
  if (judgeId.startsWith("B")) return "/judge-b";
  if (judgeId.startsWith("C")) return "/judge-c";
  return null;
}

function JudgeDispatch() {
  const { judgeId, sessionCode, setSessionCode, storageHydrated } = useCompetition();
  const search = useSearch({ from: "/judge" }) as { session?: string };
  const urlSession = search?.session ? search.session.trim().toUpperCase() : "";

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

  const target = slotPath(judgeId);
  if (!target) return <Navigate to="/judge-join" replace />;

  const code = urlSession || sessionCode;
  return <Navigate to={target} search={code ? { session: code } : undefined} replace />;
}
