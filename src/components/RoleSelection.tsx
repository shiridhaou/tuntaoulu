import { useEffect, useRef } from "react";
import { useCompetition, type UserRole } from "@/store/competition-store";
import { FederationLogo } from "./FederationLogo";
import { Shield, Users, Star, Zap, Target, Monitor, LogOut, Cpu, Nfc } from "lucide-react";
import { motion } from "framer-motion";
import { useNavigate } from "@tanstack/react-router";

/**
 * FAST ACCESS / NFC BRIDGE
 * The screen accepts quick-trigger URL parameters so an NFC card (or a QR badge)
 * can drop an official straight into their station with no typing:
 *
 *   /?role=A&code=ABC123                → Judge A join screen, code prefilled
 *   /?role=B&code=ABC123&slot=B3        → Judge B3 station directly (pre-assigned card)
 *   /?role=chief                        → Chief setup
 *   /?role=ta&code=ABC123               → Technical Assistant
 *   /?role=display&code=ABC123          → Public display
 *
 * `token` is accepted as an alias of `code` for future NFC reader payloads.
 */
const ROLE_ALIASES: Record<string, UserRole | "scoreboard"> = {
  a: "a-quality-judge",
  b: "b-performance-judge",
  c: "c-difficulty-judge",
  ahj: "assistant-referee",
  var: "assistant-referee",
  chief: "chief-referee",
  "chief-referee": "chief-referee",
  ta: "technical-assistant",
  "technical-assistant": "technical-assistant",
  display: "scoreboard",
  scoreboard: "scoreboard",
};


interface RoleOption {
  id: UserRole | "scoreboard";
  title: string;
  subtitle: string;
  description: string;
  icon: React.ReactNode;
  color: string;
  gradient: string;
  iconBg: string;
}

const roles: RoleOption[] = [
  {
    id: "chief-referee",
    title: "Chief Referee",
    subtitle: "الحكم الرئيسي",
    description: "إدارة سير المنافسة واختيار الأساليب",
    icon: <Shield className="h-8 w-8" />,
    color: "text-gold",
    gradient: "from-gold/25 to-gold/5",
    iconBg: "from-gold/30 to-amber-500/10",
  },
  {
    id: "assistant-referee",
    title: "VAR",
    subtitle: "حكم الفيديو المساعد",
    description: "مراجعة الفيديو واللقطات والخصومات اللحظية",
    icon: <Users className="h-8 w-8" />,
    color: "text-fed-blue",
    gradient: "from-fed-blue/25 to-fed-blue/5",
    iconBg: "from-fed-blue/30 to-sky-500/10",
  },
  {
    id: "a-quality-judge",
    title: "Quality Judge (A)",
    subtitle: "حكم الجودة",
    description: "تقييم الجودة العامة وتنفيذ التقنيات",
    icon: <Star className="h-8 w-8" />,
    color: "text-emerald-400",
    gradient: "from-emerald-500/25 to-emerald-500/5",
    iconBg: "from-emerald-500/30 to-green-500/10",
  },
  {
    id: "b-performance-judge",
    title: "Performance Judge (B)",
    subtitle: "حكم الأداء",
    description: "تقييم عناصر الأداء والتعبير الفني",
    icon: <Zap className="h-8 w-8" />,
    color: "text-orange-400",
    gradient: "from-orange-500/25 to-orange-500/5",
    iconBg: "from-orange-500/30 to-amber-500/10",
  },
  {
    id: "c-difficulty-judge",
    title: "Difficulty Judge (C)",
    subtitle: "حكم الصعوبة",
    description: "تقييم مستوى صعوبة الحركات",
    icon: <Target className="h-8 w-8" />,
    color: "text-fed-red",
    gradient: "from-fed-red/25 to-red-500/5",
    iconBg: "from-fed-red/30 to-red-500/10",
  },
  {
    id: "technical-assistant",
    title: "Technical Assistant",
    subtitle: "المساعد التقني",
    description: "استيراد اللاعبين، إعداد البطولة، إدارة المباريات",
    icon: <Cpu className="h-8 w-8" />,
    color: "text-cyan-400",
    gradient: "from-cyan-500/25 to-cyan-500/5",
    iconBg: "from-cyan-500/30 to-sky-500/10",
  },
  {
    id: "scoreboard",
    title: "Display Screen",
    subtitle: "شاشة العرض",
    description: "عرض النتائج الحية — يتطلب رمز الجلسة",
    icon: <Monitor className="h-8 w-8" />,
    color: "text-purple-400",
    gradient: "from-purple-500/25 to-purple-500/5",
    iconBg: "from-purple-500/30 to-violet-500/10",
  },
];

export function RoleSelection() {
  const { setSelectedRole, setJudgeId, setSessionCode, setSetupComplete, logout } = useCompetition();
  const navigate = useNavigate();

  // --- Quick trigger (URL params / NFC card payload) ------------------------
  const quickDoneRef = useRef(false);
  useEffect(() => {
    if (quickDoneRef.current || typeof window === "undefined") return;
    const q = new URLSearchParams(window.location.search);
    const rawRole = (q.get("role") ?? "").trim().toLowerCase();
    if (!rawRole) return;
    const target = ROLE_ALIASES[rawRole];
    if (!target) return;
    quickDoneRef.current = true;

    const code = (q.get("code") ?? q.get("token") ?? "").trim().toUpperCase() || null;
    const slot = (q.get("slot") ?? "").trim().toUpperCase() || null;

    if (target === "scoreboard") {
      if (code) setSessionCode(code);
      void navigate({ to: "/display-join", search: code ? { code } : {} } as never);
      return;
    }
    if (target === "chief-referee") {
      setSessionCode(null);
      setJudgeId(null);
      setSetupComplete(false);
      setSelectedRole("chief-referee");
      return;
    }
    if (target === "technical-assistant") {
      setSelectedRole("technical-assistant");
      setJudgeId(null);
      setSessionCode(null);
      // NFC only pre-fills the same verified join screen; it never bypasses
      // active-session validation.
      void navigate({ to: "/judge-join", search: code ? { code } : {} } as never);
      return;
    }

    // Judging roles (A/B/C/VAR)
    setSelectedRole(target);
    setSessionCode(null);
    // Keep accepting legacy slot parameters, but do not trust them to bypass
    // session verification. Automatic assignment happens after validation.
    void slot;
    void navigate({ to: "/judge-join", search: code ? { code } : {} } as never);
  }, [navigate, setSelectedRole, setSessionCode, setJudgeId, setSetupComplete]);


  const handleSelect = (role: RoleOption) => {
    setJudgeId(null);

    if (role.id === "scoreboard") {
      // Display screen joins like a judge: must enter the chief's session code
      // before being routed into the live scoreboard. Enforces session isolation.
      setSelectedRole(null);
      setSessionCode(null);
      navigate({ to: "/display-join" });
      return;
    }

    // SESSION ISOLATION — Chief always starts a fresh, isolated session.
    // Purge only this app's session state. Never clear all localStorage: the backend
    // auth client stores its device session there, and deleting it made the Chief's
    // first session insert race against a new anonymous sign-in.
    if (role.id === "chief-referee") {
      try {
        if (typeof window !== "undefined") {
          const keysToRemove: string[] = [];
          for (let i = 0; i < window.localStorage.length; i += 1) {
            const key = window.localStorage.key(i);
            if (key?.startsWith("taolu.")) keysToRemove.push(key);
          }
          keysToRemove.forEach((key) => window.localStorage.removeItem(key));
        }
      } catch { /* ignore */ }
      setSessionCode(null);
      setJudgeId(null);
      setSetupComplete(false);
      setSelectedRole(role.id as UserRole);
      console.log("[RoleSelection] Chief selected → forced fresh session, routing to Setup Gate");
      navigate({ to: "/" });
      return;
    }

    setSelectedRole(role.id as UserRole);

    // Everyone else (judges + technical assistant) joins with the session code.
    setSessionCode(null);
    navigate({ to: "/judge-join" });
  };

  return (
    <div className="min-h-screen p-4 md:p-8 relative overflow-hidden">
      <div className="mesh-gradient-bg" />

      <div className="max-w-5xl mx-auto relative z-10">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex items-center justify-between mb-8"
        >
          <div className="glass-card px-4 py-2 rounded-xl">
            <FederationLogo size="sm" />
          </div>
          <button
            onClick={logout}
            className="flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors text-sm font-body glass-card px-4 py-2 rounded-xl"
          >
            <LogOut className="h-4 w-4" />
            خروج
          </button>
        </motion.div>

        {/* Title */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="text-center mb-10"
        >
          <h1 className="text-4xl md:text-5xl font-heading font-black text-transparent bg-clip-text bg-gradient-to-r from-gold via-foreground to-gold mb-2">
            اختر دورك
          </h1>
          <p className="text-muted-foreground font-body text-lg">
            اختر منصبك التحكيمي لهذه الجلسة
          </p>
          <div className="mt-3 inline-flex items-center gap-2 text-[11px] text-muted-foreground/80 font-body glass-card px-3 py-1.5 rounded-full">
            <Nfc className="h-3.5 w-3.5 text-gold" />
            دخول سريع برمز الجلسة أو ببطاقة NFC — بدون كلمة مرور
          </div>
        </motion.div>

        {/* Desktop/Tablet: Grid | Mobile: Capsule list */}
        <div className="hidden sm:grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {roles.map((role, idx) => (
            <motion.button
              key={role.id}
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.15 + idx * 0.07 }}
              whileHover={{ y: -8, scale: 1.02 }}
              whileTap={{ scale: 0.97 }}
              onClick={() => handleSelect(role)}
              className={`group relative glass-card rounded-2xl p-6 text-right transition-all duration-300 hover:border-gold/40 card-3d`}
            >
              <div className="flex flex-col gap-4">
                {/* 3D Icon */}
                <motion.div
                  className={`h-16 w-16 rounded-2xl bg-gradient-to-br ${role.iconBg} border border-foreground/5 flex items-center justify-center ${role.color} icon-float`}
                >
                  {role.icon}
                </motion.div>
                <div>
                  <p className={`text-sm font-heading font-bold ${role.color} mb-0.5`} dir="ltr">
                    {role.title}
                  </p>
                  <p className="text-base font-body font-semibold text-foreground">
                    {role.subtitle}
                  </p>
                  <p className="text-xs text-muted-foreground font-body mt-2 leading-relaxed">
                    {role.description}
                  </p>
                </div>
              </div>
              {/* Hover glow */}
              <div className={`absolute inset-0 rounded-2xl bg-gradient-to-br ${role.gradient} opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none`} />
            </motion.button>
          ))}
        </div>

        {/* Mobile: Capsule list */}
        <div className="sm:hidden flex flex-col gap-3">
          {roles.map((role, idx) => (
            <motion.button
              key={role.id}
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.1 + idx * 0.06 }}
              whileTap={{ scale: 0.97 }}
              onClick={() => handleSelect(role)}
              className="glass-card rounded-2xl px-5 py-4 flex items-center gap-4 active:border-gold/40 transition-all"
            >
              <div className={`h-14 w-14 shrink-0 rounded-xl bg-gradient-to-br ${role.iconBg} border border-foreground/5 flex items-center justify-center ${role.color}`}>
                {role.icon}
              </div>
              <div className="text-right flex-1 min-w-0">
                <p className={`text-sm font-heading font-bold ${role.color}`} dir="ltr">
                  {role.title}
                </p>
                <p className="text-base font-body font-semibold text-foreground">
                  {role.subtitle}
                </p>
              </div>
            </motion.button>
          ))}
        </div>
      </div>
    </div>
  );
}
