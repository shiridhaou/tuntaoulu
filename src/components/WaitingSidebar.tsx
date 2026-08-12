import { useEffect, useMemo, useState } from "react";
import { useCompetition } from "@/store/competition-store";
import { Users, X, UserCheck, UserX, Trash2, Settings2, Plus, Minus } from "lucide-react";

const ORANGE = "#FF7A1A";
const GOLD = "#F4C542";

type Group = "A" | "B" | "C";

interface Props {
  open: boolean;
  onClose: () => void;
}

export function WaitingSidebar({ open, onClose }: Props) {
  const {
    joinRequests, judgeAssignments, team, sessionCode,
    assignJudge, rejectJoinRequest, revokeJudge,
  } = useCompetition();

  const waiting = useMemo(
    () => joinRequests.filter(r => r.status === "waiting"),
    [joinRequests]
  );

  const slotsByGroup: Record<Group, string[]> = useMemo(() => {
    const make = (g: Group, n: number) => Array.from({ length: n }, (_, i) => `${g}${i + 1}`);
    return {
      A: make("A", team.numA),
      B: make("B", team.numB),
      C: make("C", team.numC),
    };
  }, [team]);

  const freeSlots = useMemo(() => {
    const free: string[] = [];
    (["A", "B", "C"] as Group[]).forEach(g => {
      slotsByGroup[g].forEach(k => {
        if (!judgeAssignments[k]) free.push(k);
      });
    });
    return free;
  }, [slotsByGroup, judgeAssignments]);

  const assigned = useMemo(() => {
    const out: { key: string; name: string }[] = [];
    (["A", "B", "C"] as Group[]).forEach(g => {
      slotsByGroup[g].forEach(k => {
        if (judgeAssignments[k]) out.push({ key: k, name: judgeAssignments[k] });
      });
    });
    return out;
  }, [slotsByGroup, judgeAssignments]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[58] flex" onClick={onClose}>
      <div className="flex-1 bg-black/60 backdrop-blur-sm" />
      <aside
        onClick={(e) => e.stopPropagation()}
        className="w-80 md:w-[26rem] h-full bg-[#0a0a0a] border-l overflow-y-auto"
        style={{ borderColor: `${ORANGE}33` }}
      >
        <div className="p-4 border-b border-white/10 flex items-center justify-between sticky top-0 bg-[#0a0a0a] z-10">
          <div className="flex items-center gap-2">
            <Users className="h-4 w-4" style={{ color: ORANGE }} />
            <p className="text-sm font-heading font-black text-white tracking-wider">إدارة الفريق</p>
          </div>
          <button onClick={onClose} className="h-8 w-8 rounded-lg bg-white/5 border border-white/10 text-white/60 hover:text-white flex items-center justify-center">
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* SESSION CODE BANNER — so chief can compare with what judges typed */}
        <div className="p-4 border-b border-white/5">
          <p className="text-[10px] uppercase tracking-[0.3em] text-white/50 font-body mb-2">
            رمز جلستك الحالية · Your Session Code
          </p>
          <div className="rounded-xl border bg-black/40 p-3 text-center" style={{ borderColor: `${GOLD}55` }}>
            <p className="text-3xl font-heading font-black tabular-nums tracking-[0.4em]" style={{ color: GOLD }} dir="ltr">
              {sessionCode ?? "—"}
            </p>
            <p className="text-[10px] text-white/40 font-body mt-1">
              يجب على القضاة إدخال هذا الرمز بالضبط
            </p>
          </div>
        </div>

        {/* WAITING LIST */}
        <div className="p-4 border-b border-white/5">
          <p className="text-[10px] uppercase tracking-[0.3em] text-white/50 font-body mb-3">
            قائمة الانتظار · Waiting <span className="text-white/30">({waiting.length})</span>
          </p>
          {waiting.length === 0 ? (
            <p className="text-xs text-white/40 font-body text-center py-6">لا توجد طلبات انضمام</p>
          ) : (
            <div className="space-y-2">
              {waiting.map(req => {
                // AHJ is always assigned to the dedicated "AHJ" slot, never to A/B/C slots
                const filteredSlots = req.requestedRole === "AHJ"
                  ? ["AHJ"]
                  : freeSlots.filter(s => s.startsWith(req.requestedRole));
                return (
                  <WaitingCard
                    key={req.id}
                    name={req.judgeName}
                    requestedRole={req.requestedRole}
                    freeSlots={filteredSlots}
                    onAssign={(slot) => assignJudge(req.id, slot)}
                    onReject={() => rejectJoinRequest(req.id)}
                  />
                );
              })}
            </div>
          )}
        </div>

        {/* TEAM CONFIG */}
        <TeamConfigSection />

        {/* ASSIGNED TEAM */}
        <div className="p-4">
          <p className="text-[10px] uppercase tracking-[0.3em] text-white/50 font-body mb-3">
            الفريق المعتمد · Active Team <span className="text-white/30">({assigned.length})</span>
          </p>
          {assigned.length === 0 ? (
            <p className="text-xs text-white/40 font-body text-center py-6">لم يتم تعيين أي قاضٍ بعد</p>
          ) : (
            <div className="space-y-1.5">
              {assigned.map(a => (
                <div key={a.key}
                  className="flex items-center justify-between rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2">
                  <div className="flex items-center gap-3">
                    <span className="h-9 w-9 rounded-full border flex items-center justify-center text-[11px] font-heading font-black"
                      style={{ borderColor: `${GOLD}66`, color: GOLD }} dir="ltr">
                      {a.key}
                    </span>
                    <div>
                      <p className="text-sm font-body text-white">{a.name}</p>
                      <p className="text-[9px] uppercase tracking-widest text-emerald-400 font-body">Online</p>
                    </div>
                  </div>
                  <button
                    onClick={() => {
                      if (window.confirm(`سحب صلاحية ${a.key} (${a.name})؟ ستُلغى نقاطه ويُعاد حساب المعدل.`)) {
                        revokeJudge(a.key);
                      }
                    }}
                    title="Revoke access"
                    className="h-8 w-8 rounded-lg bg-red-500/10 border border-red-500/30 text-red-400 hover:bg-red-500/20 flex items-center justify-center"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </aside>
    </div>
  );
}

function WaitingCard({ name, requestedRole, freeSlots, onAssign, onReject }: {
  name: string; requestedRole: "A" | "B" | "C" | "AHJ"; freeSlots: string[];
  onAssign: (slot: string) => void; onReject: () => void;
}) {
  const [slot, setSlot] = useState<string>(freeSlots[0] ?? "");
  const roleMeta: Record<string, { label: string; color: string; bg: string }> = {
    A:   { label: "Quality (A)",     color: "#34D399", bg: "rgba(52,211,153,0.12)" },
    B:   { label: "Performance (B)", color: "#FB923C", bg: "rgba(251,146,60,0.12)" },
    C:   { label: "Difficulty (C)",  color: "#F87171", bg: "rgba(248,113,113,0.12)" },
    AHJ: { label: "VAR",             color: "#60A5FA", bg: "rgba(96,165,250,0.12)" },
  };
  const meta = roleMeta[requestedRole];

  useEffect(() => {
    const forcedSlot = requestedRole === "AHJ" ? "AHJ" : freeSlots[0] ?? "";
    setSlot((current) => (current === forcedSlot ? current : forcedSlot));
  }, [requestedRole, freeSlots]);

  return (
    <div className="rounded-xl border bg-white/[0.04] p-3" style={{ borderColor: `${meta.color}55` }}>
      <div className="flex items-center justify-between mb-2">
        <div className="min-w-0">
          <p className="text-sm font-heading font-bold text-white truncate">{name}</p>
          <span className="inline-block mt-1 px-2 py-0.5 rounded-md text-[10px] font-heading font-bold tracking-wider"
            style={{ background: meta.bg, color: meta.color, border: `1px solid ${meta.color}66` }} dir="ltr">
            {meta.label}
          </span>
        </div>
        <button onClick={onReject}
          title="رفض · Reject"
          className="h-7 w-7 rounded-lg bg-red-500/10 border border-red-500/30 text-red-400 hover:bg-red-500/20 flex items-center justify-center shrink-0">
          <UserX className="h-3.5 w-3.5" />
        </button>
      </div>
      <div className="flex items-center gap-2">
        <select
          value={slot}
          onChange={e => setSlot(e.target.value)}
          disabled={requestedRole === "AHJ" || freeSlots.length === 0}
          className="flex-1 h-9 rounded-lg bg-black/40 border border-white/10 text-white text-sm font-heading font-bold px-2 focus:outline-none disabled:opacity-40"
          dir="ltr"
        >
          {freeSlots.length === 0 && <option>لا توجد فتحات شاغرة</option>}
          {freeSlots.map(s => <option key={s} value={s}>{s}</option>)}
        </select>
        <button
          onClick={() => slot && onAssign(slot)}
          disabled={!slot || freeSlots.length === 0}
          title="قبول · Accept"
          className="h-9 px-3 rounded-lg font-heading font-black text-[11px] tracking-wider flex items-center gap-1 disabled:opacity-40"
          style={{ background: "#10B981", color: "#000" }}
        >
          <UserCheck className="h-3.5 w-3.5" />
          قبول
        </button>
      </div>
    </div>
  );
}

function TeamConfigSection() {
  const { team, setTeamConfig } = useCompetition();
  const limits = { A: [1, 5], B: [1, 5], C: [1, 5] } as const;

  const update = (group: "numA" | "numB" | "numC", delta: number) => {
    const key = group.slice(3) as "A" | "B" | "C";
    const [min, max] = limits[key];
    const next = Math.max(min, Math.min(max, team[group] + delta));
    setTeamConfig({ ...team, [group]: next });
  };

  const Row = ({ label, group, sub }: { label: string; group: "numA" | "numB" | "numC"; sub: string }) => (
    <div className="flex items-center justify-between rounded-xl border border-white/10 bg-white/[0.02] px-3 py-2">
      <div>
        <p className="text-sm font-heading font-bold text-white">{label}</p>
        <p className="text-[10px] text-white/40 font-body">{sub}</p>
      </div>
      <div className="flex items-center gap-1">
        <button onClick={() => update(group, -1)}
          className="h-8 w-8 rounded-lg bg-white/5 border border-white/10 text-white hover:bg-white/10 flex items-center justify-center">
          <Minus className="h-3.5 w-3.5" />
        </button>
        <span className="h-8 w-10 flex items-center justify-center text-lg font-heading font-black tabular-nums" style={{ color: GOLD }} dir="ltr">
          {team[group]}
        </span>
        <button onClick={() => update(group, +1)}
          className="h-8 w-8 rounded-lg bg-white/5 border border-white/10 text-white hover:bg-white/10 flex items-center justify-center">
          <Plus className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  );

  return (
    <div className="p-4 border-b border-white/5">
      <div className="flex items-center gap-2 mb-3">
        <Settings2 className="h-3.5 w-3.5" style={{ color: ORANGE }} />
        <p className="text-[10px] uppercase tracking-[0.3em] text-white/50 font-body">عدد القضاة · Team Size</p>
      </div>
      <div className="space-y-2">
        <Row label="Group A — Quality" group="numA" sub="1 – 5" />
        <Row label="Group B — Performance" group="numB" sub="1 – 5" />
        <Row label="Group C — Difficulty" group="numC" sub="1 – 5" />
      </div>
      <p className="text-[10px] text-white/40 font-body mt-2 leading-relaxed">
        تقليص العدد يُلغي تلقائياً صلاحية القضاة في الفتحات المحذوفة ويُعيد حساب المعدل.
      </p>
    </div>
  );
}
