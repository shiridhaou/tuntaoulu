import { useState } from "react";
import { useCompetition } from "@/store/competition-store";
import { FederationLogo } from "./FederationLogo";
import { Copy, CheckCircle, Link2, ArrowRight } from "lucide-react";

export function SessionCreate() {
  const { sessionCode, generateSessionCode, logout } = useCompetition();
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    if (sessionCode) {
      navigator.clipboard.writeText(sessionCode);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <div className="rounded-xl border border-gold/30 bg-gold/5 p-4">
      <div className="flex items-center gap-3 mb-3">
        <Link2 className="h-5 w-5 text-gold" />
        <h2 className="text-base font-heading font-bold text-foreground">رمز الجلسة — Session Code</h2>
      </div>
      {!sessionCode ? (
        <button onClick={() => void generateSessionCode()}
          className="w-full py-3 rounded-xl bg-gold/20 border border-gold/40 text-gold font-heading font-bold text-sm hover:bg-gold/30 transition-colors">
          إنشاء رمز جلسة جديد
        </button>
      ) : (
        <div className="flex items-center gap-3">
          <div className="flex-1 bg-surface rounded-xl p-3 text-center">
            <p className="text-3xl font-heading font-black text-gold tracking-[0.3em]" dir="ltr">{sessionCode}</p>
            <p className="text-xs text-white/60 font-body mt-1">شارك هذا الرمز مع الحكام للانضمام</p>
          </div>
          <button onClick={handleCopy} className="h-12 w-12 rounded-xl bg-gold/20 border border-gold/40 flex items-center justify-center text-gold hover:bg-gold/30 transition-colors">
            {copied ? <CheckCircle className="h-5 w-5" /> : <Copy className="h-5 w-5" />}
          </button>
        </div>
      )}
    </div>
  );
}

export function SessionJoin({ onJoined }: { onJoined: () => void }) {
  const { setSessionCode, setJudgeId, logout } = useCompetition();
  const [code, setCode] = useState("");
  const [jid, setJid] = useState("");
  const [error, setError] = useState(false);

  const handleJoin = () => {
    if (code.length >= 4 && jid.length >= 1) {
      setSessionCode(code.toUpperCase());
      setJudgeId(jid.toUpperCase());
      onJoined();
    } else {
      setError(true);
      setTimeout(() => setError(false), 1500);
    }
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="flex justify-center mb-8">
          <FederationLogo size="md" />
        </div>
        <div className="rounded-2xl border border-border bg-card p-6 space-y-5">
          <h1 className="text-2xl font-heading font-bold text-foreground text-center">الانضمام للمباراة</h1>
          <p className="text-sm text-white/60 font-body text-center">أدخل رمز الجلسة ومعرّف الحكم للانضمام</p>
          
          <div>
            <label className="text-sm font-body font-semibold text-white mb-1.5 block">رمز الجلسة — Session Code</label>
            <input
              value={code}
              onChange={e => setCode(e.target.value.toUpperCase())}
              placeholder="ABC123"
              dir="ltr"
              maxLength={6}
              className={`w-full h-14 rounded-xl bg-surface border text-center text-2xl font-heading font-black tracking-[0.3em] text-gold placeholder:text-white/20 focus:outline-none focus:ring-2 focus:ring-gold/50 ${error ? "border-fed-red" : "border-border"}`}
            />
          </div>
          
          <div>
            <label className="text-sm font-body font-semibold text-white mb-1.5 block">معرّف الحكم — Judge ID</label>
            <input
              value={jid}
              onChange={e => setJid(e.target.value.toUpperCase())}
              placeholder="J1, B2, AHJ..."
              dir="ltr"
              maxLength={4}
              className={`w-full h-14 rounded-xl bg-surface border text-center text-2xl font-heading font-black tracking-widest text-fed-blue placeholder:text-white/20 focus:outline-none focus:ring-2 focus:ring-fed-blue/50 ${error ? "border-fed-red" : "border-border"}`}
            />
          </div>

          {error && <p className="text-sm text-fed-red font-body text-center">أدخل رمز الجلسة ومعرّف الحكم</p>}

          <button onClick={handleJoin}
            className="w-full h-14 rounded-xl bg-gold text-gold-foreground font-heading font-bold text-lg hover:brightness-110 transition-all">
            انضمام <ArrowRight className="inline h-5 w-5 mr-2" />
          </button>

          <button onClick={logout} className="w-full text-sm text-white/40 hover:text-white/70 font-body transition-colors">
            رجوع
          </button>
        </div>
      </div>
    </div>
  );
}
