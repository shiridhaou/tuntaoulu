import { useCompetition, STYLE_CONFIGS, type Athlete, type DifficultyMovement } from "@/store/competition-store";
import { useLogout } from "@/hooks/useLogout";

import { FederationLogo } from "./FederationLogo";
import { SessionBadge } from "@/components/SessionBadge";
import { useActiveSessionCode } from "@/hooks/useActiveSession";
import { useRoomPresence } from "@/hooks/useRoomPresence";
import {
  ArrowRight, RotateCcw, Play, Pause, Bell, AlertTriangle, Zap, FileSpreadsheet,
  Video, VideoOff, CheckCircle2, AlertCircle, Loader2, Film, ShieldCheck,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import * as XLSX from "xlsx";
import { useRollingBuffer } from "@/hooks/useRollingBuffer";
import { supabase } from "@/integrations/supabase/client";
import { classifyAge } from "@/lib/ageCategories";

// 2025-2026 deduction buttons grouped by purpose. Values follow IWUF conventions.
type DeductionDef = { code: string; label: string; labelAr: string; value: number; severity: "minor" | "medium" | "major" };
const DEDUCTIONS: DeductionDef[] = [
  { code: "OOB",   label: "Out of Bounds",     labelAr: "خروج من البساط",  value: 0.1, severity: "minor"  },
  { code: "FALL",  label: "Fall",              labelAr: "سقوط",            value: 0.3, severity: "major"  },
  { code: "ADD",   label: "Extra Support",     labelAr: "استناد إضافي",    value: 0.2, severity: "medium" },
  { code: "TECH",  label: "Technical Error",   labelAr: "خطأ تقني",        value: 0.1, severity: "minor"  },
  { code: "WPN",   label: "Weapon Drop",       labelAr: "سقوط السلاح",     value: 0.3, severity: "major"  },
  { code: "STOP",  label: "Routine Stop",      labelAr: "توقف الأداء",     value: 0.2, severity: "medium" },
];

interface Clip {
  id: string;
  eventId: string | null;     // match_events row id (for Verify update)
  url: string;                // blob URL (local preview)
  blob: Blob | null;          // raw bytes for upload on Verify
  cloudUrl: string | null;    // public URL after upload
  deduction: DeductionDef;
  triggeredAt: number;
  athleteId: string | null;
  ageCategory: string | null;
  aiVerdict: "verified" | "review" | "pending";
  verified: boolean;          // chief-visible verification flag (post-upload)
  verifying?: boolean;
}

export function AssistantRefereePanel() {
  const {
    setSelectedRole, competitionStyle,
    judgeAScore, judgeBAverage, judgeCScore, finalScore,
    athletes, currentAthleteIndex, setAthletes,
    timerElapsed, setTimerElapsed, timerRunning, setTimerRunning,
    styleMode, setStyleMode,
    suggestedDeductions, addSuggestedDeduction, clearSuggestedDeductions,
    ahjReady, signalHeadJudge, clearAhjSignal,
    sessionCode,
  } = useCompetition();
  const logout = useLogout();
  const activeSession = useActiveSessionCode(sessionCode);
  useRoomPresence(activeSession, { role: "assistant" });

  const config = competitionStyle ? STYLE_CONFIGS[competitionStyle] : STYLE_CONFIGS.changquan;
  const athlete = athletes[currentAthleteIndex];
  const fileRef = useRef<HTMLInputElement>(null);
  const [importMsg, setImportMsg] = useState<string | null>(null);
  const overflowSuggestedRef = useRef(false);

  // Rolling buffer (camera + last 20s) — supports multi-camera hot-swap
  const {
    videoRef, status: camStatus, error: camError, start: startCam, stop: stopCam, extractClip,
    devices: camDevices, activeDeviceId: camActiveId, switchCamera,
  } = useRollingBuffer({ bufferSeconds: 20 });

  // Broadcast active camera changes so Chief / Public Display can show which angle is live
  useEffect(() => {
    if (!sessionCode || !camActiveId || camStatus !== "live") return;
    const idx = camDevices.findIndex((d) => d.deviceId === camActiveId);
    void supabase.from("match_events").insert({
      session_code: sessionCode,
      event_type: "var_camera_switch",
      payload: {
        deviceId: camActiveId,
        index: idx >= 0 ? idx : 0,
        label: camDevices[idx]?.label ?? `CAM ${(idx >= 0 ? idx : 0) + 1}`,
        total: camDevices.length,
      },
    });
  }, [camActiveId, camDevices, camStatus, sessionCode]);
  const [clips, setClips] = useState<Clip[]>([]);
  const [activeClip, setActiveClip] = useState<Clip | null>(null);
  const [pendingClip, setPendingClip] = useState<string | null>(null); // deduction code while slicing

  const fmtTime = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
  const ageCategory = useMemo(() => {
    if (!athlete) return null;
    // Athlete type doesn't carry birthDate — fall back to category string
    return (athlete as Athlete & { birthDate?: string }).birthDate
      ? classifyAge((athlete as Athlete & { birthDate?: string }).birthDate)
      : athlete.category;
  }, [athlete]);

  // Timer tick
  useEffect(() => {
    if (!timerRunning) return;
    const i = setInterval(() => setTimerElapsed(timerElapsed + 1), 1000);
    return () => clearInterval(i);
  }, [timerRunning, timerElapsed, setTimerElapsed]);

  const overTime = timerElapsed > config.performanceTime;
  const overBy = Math.max(0, timerElapsed - config.performanceTime);

  useEffect(() => {
    if (overTime && !overflowSuggestedRef.current) {
      overflowSuggestedRef.current = true;
      addSuggestedDeduction({
        code: "OT-1", label: "تجاوز الوقت المسموح", value: 0.1,
        reason: `تم تجاوز الوقت المحدد (${config.performanceTime}s) — اقتراح خصم 0.10`,
      });
    }
    if (!overTime) overflowSuggestedRef.current = false;
  }, [overTime, addSuggestedDeduction, config.performanceTime]);

  // ---- Clip generation ----
  const triggerDeduction = async (d: DeductionDef) => {
    // Always log a suggestion to Judge A regardless of camera state
    addSuggestedDeduction({
      code: d.code, label: d.labelAr, value: d.value,
      reason: `AHJ trigger • ${d.label} • -${d.value.toFixed(2)}`,
    });

    if (camStatus !== "live") return;
    setPendingClip(d.code);
    const blob = await extractClip(5, 2);
    setPendingClip(null);
    if (!blob) return;
    const url = URL.createObjectURL(blob);

    // Mock AI verdict — fall buttons need stricter "review" outcome
    const aiVerdict: Clip["aiVerdict"] = d.code === "FALL"
      ? (Math.random() > 0.3 ? "verified" : "review")
      : "verified";

    const clip: Clip = {
      id: `clip-${Date.now()}`,
      eventId: null,
      url,
      blob,
      cloudUrl: null,
      deduction: d,
      triggeredAt: Date.now(),
      athleteId: athlete?.id ?? null,
      ageCategory: typeof ageCategory === "string" ? ageCategory : ageCategory ?? null,
      aiVerdict,
      verified: false,
    };
    setClips((prev) => [clip, ...prev].slice(0, 12));

    // Broadcast metadata to chief via Realtime (URL is local blob — ref only)
    if (sessionCode) {
      const { data: inserted } = await supabase.from("match_events").insert({
        session_code: sessionCode,
        event_type: "ahj_clip",
        payload: {
          clipId: clip.id,
          athleteId: clip.athleteId,
          athleteName: athlete?.name ?? null,
          deductionCode: d.code,
          deductionLabel: d.label,
          value: d.value,
          severity: d.severity,
          ageCategory: clip.ageCategory,
          aiVerdict: clip.aiVerdict,
          triggeredAt: clip.triggeredAt,
          verified: false,
        },
      }).select("id").single();
      if (inserted?.id) {
        setClips((prev) => prev.map((c) => c.id === clip.id ? { ...c, eventId: inserted.id } : c));
      }
    }
  };

  // Verify a clip:
  //  1) Upload Blob to Supabase storage (match_clips bucket)
  //  2) Insert ahj_clip_verified event with public URL into match_events
  //  3) Only after success → mark verified locally (Chief sees green ✅ post-upload)
  const verifyClip = async (clip: Clip) => {
    if (clip.verified || clip.verifying) return;
    setClips((prev) => prev.map((c) => c.id === clip.id ? { ...c, verifying: true } : c));
    try {
      let cloudUrl = clip.cloudUrl;
      // Upload only once per clip
      if (!cloudUrl && sessionCode) {
        // Re-fetch the blob if missing (shouldn't normally happen)
        const blob: Blob = clip.blob ?? (await fetch(clip.url).then((r) => r.blob()));
        if (!blob) throw new Error("No clip data to upload");
        const filename = `session_${sessionCode}_athlete_${clip.athleteId ?? "unknown"}_${clip.triggeredAt}.webm`;
        const { error: upErr } = await supabase.storage
          .from("match_clips")
          .upload(filename, blob, { contentType: blob.type || "video/webm", upsert: true });
        if (upErr) throw upErr;
        const { data: pub } = supabase.storage.from("match_clips").getPublicUrl(filename);
        cloudUrl = pub.publicUrl;
      }

      if (sessionCode && cloudUrl) {
        await supabase.from("match_events").insert({
          session_code: sessionCode,
          event_type: "ahj_clip_verified",
          payload: {
            clipId: clip.id,
            originalEventId: clip.eventId,
            athleteId: clip.athleteId,
            deductionCode: clip.deduction.code,
            deductionLabel: clip.deduction.label,
            value: clip.deduction.value,
            clipUrl: cloudUrl,
            triggeredAt: clip.triggeredAt,
            verifiedAt: Date.now(),
          },
        });
      }

      setClips((prev) => prev.map((c) => c.id === clip.id ? { ...c, verified: true, verifying: false, cloudUrl } : c));
      setActiveClip((cur) => cur && cur.id === clip.id ? { ...cur, verified: true, verifying: false, cloudUrl } : cur);
    } catch (e) {
      console.error("verifyClip failed:", e);
      setClips((prev) => prev.map((c) => c.id === clip.id ? { ...c, verifying: false } : c));
    }
  };

  // Restore previously verified clips for this session/athlete on mount or athlete change
  useEffect(() => {
    if (!sessionCode || !athlete?.id) return;
    let cancelled = false;
    (async () => {
      const { data } = await supabase
        .from("match_events")
        .select("id, event_type, payload, created_at")
        .eq("session_code", sessionCode)
        .eq("event_type", "ahj_clip_verified")
        .order("created_at", { ascending: false })
        .limit(50);
      if (cancelled || !data) return;
      const restored: Clip[] = [];
      for (const row of data) {
        const p = (row.payload ?? {}) as Record<string, unknown>;
        if (p.athleteId !== athlete.id) continue;
        const code = String(p.deductionCode ?? "");
        const def = DEDUCTIONS.find((d) => d.code === code) ?? {
          code, label: String(p.deductionLabel ?? code), labelAr: String(p.deductionLabel ?? code),
          value: Number(p.value ?? 0), severity: "minor" as const,
        };
        const cloudUrl = typeof p.clipUrl === "string" ? p.clipUrl : null;
        if (!cloudUrl) continue;
        restored.push({
          id: String(p.clipId ?? row.id),
          eventId: typeof p.originalEventId === "string" ? p.originalEventId : null,
          url: cloudUrl,
          blob: null,
          cloudUrl,
          deduction: def,
          triggeredAt: Number(p.triggeredAt ?? Date.parse(row.created_at)),
          athleteId: athlete.id,
          ageCategory: null,
          aiVerdict: "verified",
          verified: true,
        });
      }
      if (restored.length) {
        setClips((prev) => {
          const existingIds = new Set(prev.map((c) => c.id));
          const merged = [...restored.filter((c) => !existingIds.has(c.id)), ...prev];
          return merged.slice(0, 12);
        });
      }
    })();
    return () => { cancelled = true; };
  }, [sessionCode, athlete?.id]);

  // Clean up object URLs on unmount only
  const clipsRef = useRef<Clip[]>([]);
  useEffect(() => { clipsRef.current = clips; }, [clips]);
  useEffect(() => () => { clipsRef.current.forEach((c) => URL.revokeObjectURL(c.url)); }, []);

  // ---- Import helpers (kept from previous version) ----
  const handleImportJSON = async (file: File) => {
    try {
      const text = await file.text();
      const data = JSON.parse(text);
      if (!Array.isArray(data)) throw new Error("expected array");
      const parsed: Athlete[] = data.map((row: unknown, i: number) => {
        const r = row as Record<string, unknown>;
        const sheet = Array.isArray(r.difficultySheet)
          ? (r.difficultySheet as unknown[]).map((m): DifficultyMovement => {
              const mv = m as Record<string, unknown>;
              return {
                code: String(mv.code ?? ""), label: String(mv.label ?? ""),
                connection: String(mv.connection ?? "Independent"), value: Number(mv.value ?? 0),
              };
            })
          : undefined;
        return {
          id: String(r.id ?? `a-${i + 1}`),
          name: String(r.name ?? `Athlete ${i + 1}`),
          country: String(r.country ?? "TUN"),
          category: String(r.category ?? competitionStyle ?? "—"),
          order: Number(r.order ?? i + 1),
          difficultySheet: sheet,
        };
      });
      setAthletes(parsed);
      setImportMsg(`✓ تم استيراد ${parsed.length} لاعب`);
      setTimeout(() => setImportMsg(null), 3000);
    } catch (e) {
      setImportMsg(`✗ خطأ في القراءة: ${(e as Error).message}`);
      setTimeout(() => setImportMsg(null), 4000);
    }
  };

  const handleImportExcel = async (file: File) => {
    try {
      const buf = await file.arrayBuffer();
      const wb = XLSX.read(buf, { type: "array" });
      const athletesSheetName = wb.SheetNames.find(n => /athlete|player|لاعب/i.test(n)) ?? wb.SheetNames[0];
      const aRows = XLSX.utils.sheet_to_json<Record<string, unknown>>(wb.Sheets[athletesSheetName], { defval: "" });
      const parsed: Athlete[] = aRows.map((r, i) => ({
        id: String(r.id ?? r.athleteId ?? `a-${i + 1}`),
        name: String(r.name ?? r.athleteName ?? `Athlete ${i + 1}`),
        country: String(r.country ?? "TUN"),
        category: String(r.category ?? competitionStyle ?? "—"),
        order: Number(r.order ?? i + 1),
      }));
      setAthletes(parsed);
      setImportMsg(`✓ Excel: ${parsed.length} لاعب`);
      setTimeout(() => setImportMsg(null), 4000);
    } catch (e) {
      setImportMsg(`✗ خطأ Excel: ${(e as Error).message}`);
      setTimeout(() => setImportMsg(null), 4000);
    }
  };

  const handleFile = (file: File) => {
    if (/\.xlsx?$/i.test(file.name)) handleImportExcel(file);
    else handleImportJSON(file);
  };

  return (
    <div className="h-screen max-h-screen overflow-hidden cyber-bg text-white flex flex-col">
      <header className="shrink-0 border-b border-cyber-orange/20 bg-black/40 backdrop-blur px-4 py-2 z-10">
        <div className="max-w-[1600px] mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button onClick={() => setSelectedRole(null)} className="h-8 w-8 rounded-lg bg-white/5 border border-white/10 flex items-center justify-center text-white/60 hover:text-white">
              <ArrowRight className="h-4 w-4" />
            </button>
            <FederationLogo size="sm" />
            <span className="text-xs text-cyber-orange font-heading font-bold px-2.5 py-1 rounded-full border border-cyber-orange/40 bg-cyber-orange/10 glow-cyber" dir="ltr">
              VAR • Hybrid Video Controller
            </span>
            <SessionBadge code={sessionCode} />
          </div>
          <div className="flex items-center gap-3">
            <span className="text-sm text-white/60 font-body">{athlete?.name ?? "—"}</span>
            {ageCategory && (
              <span className="text-[10px] font-heading font-bold text-cyber-orange bg-cyber-orange/10 border border-cyber-orange/30 px-2 py-0.5 rounded-full">
                {String(ageCategory)}
              </span>
            )}
            <button onClick={logout} className="text-sm text-white/50 hover:text-white font-body">خروج</button>
          </div>
        </div>
      </header>

      <main className="flex-1 min-h-0 max-w-[1600px] w-full mx-auto p-3 grid grid-cols-1 lg:grid-cols-3 gap-3 overflow-hidden">
        {/* LEFT — Live Video + Timeline + Recent Clips */}
        <section className="lg:col-span-2 flex flex-col gap-2 min-h-0 overflow-hidden">
          {/* Video player */}
          <div className="cyber-panel rounded-2xl overflow-hidden flex-1 min-h-0 flex flex-col">
            {/* Multi-camera switcher toolbar */}
            {camStatus === "live" && camDevices.length > 0 && (
              <div className="shrink-0 flex items-center gap-2 px-3 py-2 border-b border-white/10 bg-black/40">
                <span className="text-[10px] uppercase tracking-widest text-white/50 font-heading" dir="ltr">
                  Cameras
                </span>
                <div className="flex items-center gap-1.5 flex-wrap">
                  {camDevices.map((d, i) => {
                    const active = d.deviceId === camActiveId;
                    return (
                      <button
                        key={d.deviceId || i}
                        onClick={() => void switchCamera(d.deviceId)}
                        title={d.label}
                        className={`h-7 px-2.5 rounded-md text-[10px] font-heading font-black tracking-wider border transition-all ${
                          active
                            ? "bg-cyber-orange text-black border-cyber-orange shadow-[0_0_12px_rgba(255,140,0,0.7)]"
                            : "bg-white/5 text-white/70 border-white/10 hover:bg-white/10"
                        }`}
                        dir="ltr"
                      >
                        CAM {i + 1}
                      </button>
                    );
                  })}
                </div>
                <span className="ml-auto text-[10px] text-white/40 font-mono" dir="ltr">
                  {camDevices.length} source{camDevices.length === 1 ? "" : "s"}
                </span>
              </div>
            )}
            <div className="relative bg-black flex-1 min-h-0">
              <video ref={videoRef} className="w-full h-full object-cover" muted playsInline />
              {camStatus !== "live" && (
                <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-black/70 backdrop-blur-sm">
                  {camStatus === "starting" ? (
                    <Loader2 className="h-10 w-10 text-cyber-orange animate-spin" />
                  ) : camStatus === "denied" ? (
                    <>
                      <VideoOff className="h-10 w-10 text-red-400" />
                      <p className="text-sm text-red-300 font-body">تم رفض الوصول للكاميرا</p>
                    </>
                  ) : (
                    <>
                      <Video className="h-10 w-10 text-cyber-orange" />
                      <button onClick={startCam} className="cyber-btn-3d px-6 h-11 rounded-xl font-heading font-bold text-sm">
                        تشغيل الكاميرا
                      </button>
                      {camError && <p className="text-xs text-red-300">{camError}</p>}
                    </>
                  )}
                </div>
              )}
              {camStatus === "live" && (
                <>
                  <div className="absolute top-3 left-3 flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-red-500/90 backdrop-blur">
                    <span className="h-2 w-2 rounded-full bg-white animate-pulse" />
                    <span className="text-[10px] font-heading font-bold text-white tracking-wider">LIVE • 20s BUFFER</span>
                  </div>
                  <div className="absolute top-3 right-3 flex items-center gap-2">
                    <span className="text-[10px] font-heading font-bold text-cyber-orange bg-black/60 px-2 py-1 rounded-full" dir="ltr">
                      {fmtTime(timerElapsed)} / {fmtTime(config.performanceTime)}
                    </span>
                    <button onClick={stopCam} className="h-8 w-8 rounded-full bg-black/60 border border-white/20 flex items-center justify-center text-white/80 hover:text-white">
                      <VideoOff className="h-3.5 w-3.5" />
                    </button>
                  </div>
                  {pendingClip && (
                    <div className="absolute bottom-3 left-3 flex items-center gap-2 px-3 py-1.5 rounded-full bg-cyber-orange/90 text-black">
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      <span className="text-[11px] font-heading font-bold">Generating clip — {pendingClip}…</span>
                    </div>
                  )}
                </>
              )}
            </div>

            {/* Deduction Timeline — horizontal bar under video */}
            <div className="shrink-0 border-t border-white/10 px-3 py-2">
              <div className="flex items-center gap-3">
                <p className="text-[10px] uppercase tracking-widest text-cyber-orange font-heading flex items-center gap-1.5 shrink-0" dir="ltr">
                  <Film className="h-3 w-3" /> Timeline
                </p>
                <div className="relative h-8 flex-1 rounded-lg bg-white/5 border border-white/10 overflow-hidden">
                  <div className="absolute inset-0 flex items-center px-2 gap-1 overflow-x-auto">
                    {clips.length === 0 ? (
                      <span className="text-[10px] text-white/40 mx-auto">لا أحداث</span>
                    ) : (
                      clips.slice().reverse().map((c) => (
                        <button
                          key={c.id}
                          onClick={() => setActiveClip(c)}
                          title={`${c.deduction.label} • -${c.deduction.value}`}
                          className={`shrink-0 h-6 px-2 rounded flex items-center gap-1 text-[10px] font-heading font-bold border ${
                            c.deduction.severity === "major" ? "bg-red-500/20 border-red-500/40 text-red-200" :
                            c.deduction.severity === "medium" ? "bg-amber-500/20 border-amber-500/40 text-amber-200" :
                            "bg-sky-500/20 border-sky-500/40 text-sky-200"
                          }`}
                        >
                          {c.deduction.code}
                        </button>
                      ))
                    )}
                  </div>
                </div>
                <span className="text-[10px] text-white/40 font-body shrink-0" dir="ltr">{clips.length}</span>
              </div>
            </div>
          </div>

          {/* Recent clips — horizontal strip at bottom */}
          <div className="cyber-panel rounded-2xl p-2 shrink-0">
            <div className="flex items-center gap-2 mb-1.5">
              <p className="text-[10px] uppercase tracking-widest text-cyber-orange font-heading" dir="ltr">Recent Clips</p>
              <span className="text-[9px] text-white/40" dir="ltr">{clips.length}</span>
            </div>
            {clips.length === 0 ? (
              <p className="text-[10px] text-white/40 font-body py-1">اضغط أي زر خصم لتوليد كليب 7 ثوانٍ.</p>
            ) : (
              <div className="flex gap-2 overflow-x-auto pb-1">
                {clips.map((c) => (
                  <div
                    key={c.id}
                    className="shrink-0 w-32 rounded-lg border border-white/10 bg-black/40 overflow-hidden hover:border-cyber-orange/50 transition-colors"
                  >
                    <button onClick={() => setActiveClip(c)} className="block w-full text-left">
                      <video src={c.url} className="w-full h-16 object-cover bg-black" muted />
                      <div className="px-1.5 py-1">
                        <div className="flex items-center justify-between">
                          <span className="text-[9px] font-heading font-bold text-cyber-orange" dir="ltr">{c.deduction.code}</span>
                          <span className="text-[8px] text-white/40" dir="ltr">-{c.deduction.value}</span>
                        </div>
                        <div className="flex items-center gap-1 mt-0.5">
                          {c.aiVerdict === "verified" ? (
                            <CheckCircle2 className="h-2.5 w-2.5 text-green-300" />
                          ) : (
                            <AlertCircle className="h-2.5 w-2.5 text-amber-300" />
                          )}
                          <span className="text-[8px] text-white/60 truncate">{c.deduction.labelAr}</span>
                        </div>
                      </div>
                    </button>
                    <button
                      onClick={() => verifyClip(c)}
                      disabled={c.verified || c.verifying}
                      className={`w-full h-6 flex items-center justify-center gap-1 text-[9px] font-heading font-bold border-t border-white/10 transition-colors ${
                        c.verified
                          ? "bg-green-500/20 text-green-300 cursor-default"
                          : c.verifying
                            ? "bg-white/5 text-white/40"
                            : "bg-white/5 text-white/70 hover:bg-cyber-orange/20 hover:text-cyber-orange"
                      }`}
                    >
                      {c.verified ? (<><CheckCircle2 className="h-2.5 w-2.5" /> Verified</>)
                        : c.verifying ? (<><Loader2 className="h-2.5 w-2.5 animate-spin" /></>)
                        : (<><ShieldCheck className="h-2.5 w-2.5" /> Verify</>)}
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </section>

        {/* RIGHT — Controls */}
        <section className="lg:col-span-1 flex flex-col gap-2 min-h-0 overflow-hidden">
          {/* Chronometer — top */}
          <div className={`cyber-panel rounded-2xl px-4 py-2 shrink-0 ${overTime ? "cyber-pulse" : ""}`}>
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-baseline gap-2">
                <p className={`text-3xl font-heading font-black tabular-nums ${overTime ? "text-red-400" : "text-cyber-orange"}`} dir="ltr">
                  {fmtTime(timerElapsed)}
                </p>
                <p className="text-[10px] text-white/50 font-body" dir="ltr">/ {fmtTime(config.performanceTime)}</p>
                {overTime && (
                  <span className="flex items-center gap-1 text-[10px] text-red-300">
                    <AlertTriangle className="h-3 w-3" /> +{overBy}s
                  </span>
                )}
              </div>
              <div className="flex gap-1.5">
                <button onClick={() => setTimerRunning(!timerRunning)} className="cyber-btn-3d h-9 px-3 rounded-lg flex items-center gap-1.5 font-heading font-bold text-xs">
                  {timerRunning ? <><Pause className="h-3.5 w-3.5" /> Pause</> : <><Play className="h-3.5 w-3.5" /> Start</>}
                </button>
                <button onClick={() => { setTimerElapsed(0); setTimerRunning(false); overflowSuggestedRef.current = false; }} className="h-9 w-9 rounded-lg border border-white/15 bg-white/5 flex items-center justify-center text-white/70">
                  <RotateCcw className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
          </div>

          {/* Smart Triggers — center, fills */}
          <div className="cyber-panel rounded-2xl p-3 flex-1 min-h-0 flex flex-col">
            <div className="flex items-center justify-between mb-2 shrink-0">
              <p className="text-[10px] uppercase tracking-widest text-cyber-orange font-heading flex items-center gap-1.5" dir="ltr">
                <Zap className="h-3 w-3" /> Smart Triggers
              </p>
              <span className="text-[9px] text-white/40 font-body" dir="ltr">5s before • 2s after</span>
            </div>
            <div className="grid grid-cols-2 gap-2 flex-1 min-h-0">
              {DEDUCTIONS.map((d) => (
                <button
                  key={d.code}
                  onClick={() => triggerDeduction(d)}
                  disabled={pendingClip === d.code}
                  className={`min-h-0 rounded-xl font-heading font-bold text-xs flex flex-col items-center justify-center gap-0.5 transition-all ${
                    d.severity === "major" ? "bg-red-500/15 border border-red-500/40 text-red-200 hover:bg-red-500/25" :
                    d.severity === "medium" ? "bg-amber-500/15 border border-amber-500/40 text-amber-200 hover:bg-amber-500/25" :
                    "bg-sky-500/15 border border-sky-500/40 text-sky-200 hover:bg-sky-500/25"
                  } ${pendingClip === d.code ? "opacity-60 animate-pulse" : ""}`}
                >
                  <span dir="ltr">{d.code} • -{d.value}</span>
                  <span className="text-[9px] opacity-80">{d.labelAr}</span>
                </button>
              ))}
            </div>
            {camStatus !== "live" && (
              <p className="text-[9px] text-amber-300/80 mt-1.5 font-body shrink-0">
                ⚠ شغّل الكاميرا لتفعيل الكليبات.
              </p>
            )}
          </div>

          {/* Score row — compact horizontal */}
          <div className="grid grid-cols-4 gap-1.5 shrink-0">
            <ScoreTile label="A" value={judgeAScore} />
            <ScoreTile label="B" value={judgeBAverage} />
            <ScoreTile label="C" value={judgeCScore} accent />
            <ScoreTile label="Final" value={finalScore} accent strong />
          </div>

          {/* Logistics toolbar — Style mode + Import in single row */}
          <div className="cyber-panel rounded-2xl p-2 shrink-0 flex items-center gap-1.5">
            <input ref={fileRef} type="file" accept=".json,.xlsx,.xls,application/json" className="hidden"
              onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f); e.target.value = ""; }} />
            <button onClick={() => setStyleMode("mandatory")} className={`flex-1 h-8 rounded-lg font-heading font-bold text-[10px] ${styleMode === "mandatory" ? "cyber-btn-3d" : "bg-white/5 border border-white/10 text-white/60"}`}>إلزامي</button>
            <button onClick={() => setStyleMode("optional")} className={`flex-1 h-8 rounded-lg font-heading font-bold text-[10px] ${styleMode === "optional" ? "cyber-btn-3d" : "bg-white/5 border border-white/10 text-white/60"}`}>اختياري</button>
            <button onClick={() => fileRef.current?.click()} title={importMsg ?? "استيراد"} className="cyber-btn-3d h-8 px-3 rounded-lg flex items-center justify-center gap-1 font-heading font-bold text-[10px]">
              <FileSpreadsheet className="h-3.5 w-3.5" /> Import
            </button>
            {suggestedDeductions.length > 0 && (
              <button onClick={clearSuggestedDeductions} className="h-8 px-2 rounded-lg bg-cyber-orange/15 border border-cyber-orange/30 text-[10px] text-cyber-orange font-heading font-bold">
                {suggestedDeductions.length} →A
              </button>
            )}
          </div>

          {/* Signal Head Judge — permanent footbar */}
          <button
            onClick={() => (ahjReady ? clearAhjSignal() : signalHeadJudge())}
            className={`w-full cyber-btn-3d h-11 rounded-2xl flex items-center justify-center gap-2 font-heading font-black text-sm shrink-0 ${ahjReady ? "cyber-pulse" : ""}`}
          >
            <Bell className="h-4 w-4" />
            {ahjReady ? "تم إعلام الرئيس — للإلغاء" : "Signal Head Judge"}
          </button>
        </section>
      </main>

      {/* Clip player modal */}
      <AnimatePresence>
        {activeClip && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            onClick={() => setActiveClip(null)}
            className="fixed inset-0 z-50 bg-black/80 backdrop-blur flex items-center justify-center p-4"
          >
            <motion.div
              initial={{ scale: 0.95 }} animate={{ scale: 1 }} exit={{ scale: 0.95 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-black border border-cyber-orange/40 rounded-2xl overflow-hidden max-w-3xl w-full"
            >
              <video src={activeClip.url} controls autoPlay className="w-full aspect-video bg-black" />
              <div className="p-4 grid grid-cols-2 md:grid-cols-4 gap-3 text-xs">
                <div><p className="text-white/40 mb-0.5">Code</p><p className="font-heading font-bold text-cyber-orange" dir="ltr">{activeClip.deduction.code}</p></div>
                <div><p className="text-white/40 mb-0.5">Deduction</p><p className="font-heading font-bold text-white">{activeClip.deduction.labelAr} (-{activeClip.deduction.value})</p></div>
                <div><p className="text-white/40 mb-0.5">Athlete</p><p className="font-heading font-bold text-white">{athletes.find(a => a.id === activeClip.athleteId)?.name ?? "—"}</p></div>
                <div><p className="text-white/40 mb-0.5">AI Verdict</p>
                  {activeClip.aiVerdict === "verified" ? (
                    <p className="font-heading font-bold text-green-300 flex items-center gap-1"><CheckCircle2 className="h-3 w-3" /> Verified</p>
                  ) : (
                    <p className="font-heading font-bold text-amber-300 flex items-center gap-1"><AlertCircle className="h-3 w-3" /> Review</p>
                  )}
                </div>
              </div>
              <div className="px-4 pb-4 flex items-center justify-end gap-2 border-t border-white/10 pt-3">
                <button
                  onClick={() => verifyClip(activeClip)}
                  disabled={activeClip.verified || activeClip.verifying}
                  className={`h-10 px-5 rounded-xl flex items-center gap-2 font-heading font-bold text-xs transition-colors ${
                    activeClip.verified
                      ? "bg-green-500/25 text-green-200 cursor-default"
                      : activeClip.verifying
                        ? "bg-white/10 text-white/50"
                        : "bg-cyber-orange text-black hover:brightness-110"
                  }`}
                >
                  {activeClip.verified ? (<><CheckCircle2 className="h-4 w-4" /> Verified — تم التأكيد</>)
                    : activeClip.verifying ? (<><Loader2 className="h-4 w-4 animate-spin" /> جاري التأكيد…</>)
                    : (<><ShieldCheck className="h-4 w-4" /> Verify · تأكيد للرئيس</>)}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function ScoreTile({ label, value, accent, strong }: { label: string; value: number; accent?: boolean; strong?: boolean }) {
  return (
    <div className={`rounded-lg px-2 py-1.5 text-center border ${
      strong ? "border-cyber-orange/60 bg-cyber-orange/15 glow-cyber" :
      accent ? "border-cyber-orange/40 bg-cyber-orange/10" :
      "border-white/10 bg-white/5"
    }`}>
      <p className="text-[9px] text-white/60 font-body" dir="ltr">{label}</p>
      <p className={`text-base font-heading font-black tabular-nums ${accent || strong ? "text-cyber-orange" : "text-white"}`}>{value.toFixed(2)}</p>
    </div>
  );
}
