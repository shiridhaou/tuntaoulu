// Smart Report Engine — IWUF deduction → Franco-Tunisien advice mapping
// Mixing Tunisian Arabic with French technical Wushu terminology.

export interface CodeAdvice {
  code: string;
  category: string;        // e.g. "Technique", "Équilibre", "Saut", "Arme"
  titleFr: string;
  titleAr: string;
  advice: string;          // Franco-Tunisien coaching line
}

// Maps the FIRST DIGIT (or first 2 digits) of a Judge-A deduction code to advice.
// Codes follow IWUF 2024: 10s Basics, 20s Nanquan, 30s Jumps, 50s Taiji, 60s Weapons, 70s Equipment.
export const ADVICE_BY_CODE: Record<string, CodeAdvice> = {
  // ===== 10s — Technique / Basics / Stances =====
  "10": {
    code: "10", category: "Technique",
    titleFr: "Précision des mouvements", titleAr: "دقة الحركات",
    advice:
      "فمّة Manque de précision في الـ Mouvements de base. لازمك تثبّت الـ Trajectoire متاع يديك وتراجع الـ Posture في كل Stance باش تتفادى الـ Déduction الجاية. الـ Coordination بين الجزء العلوي والسفلي ضرورية.",
  },
  "11": {
    code: "11", category: "Stance",
    titleFr: "Stabilité des stances", titleAr: "ثبات الوقفات",
    advice:
      "الـ Stances متاعك (Mabu, Gongbu) مازالت تحتاج Stabilisation أكثر. خدم على الـ Renforcement des cuisses وحافظ على الـ Alignement متاع الركبة فوق المشط بالضبط.",
  },
  // ===== 20s — Nanquan specifics =====
  "20": {
    code: "20", category: "Nanquan",
    titleFr: "Force et explosivité Nanquan", titleAr: "قوة وانفجار النانتشوان",
    advice:
      "في الـ Nanquan لازم تبيّن Puissance أكثر في الـ Frappes مع Cri (Faaaa) متزامن. الـ Tension متاع الجسم لازمها تكون لحظية، موش متواصلة باش ما تخسرش الـ Rythme.",
  },
  // ===== 30s — Jumps / Aerial =====
  "30": {
    code: "30", category: "Saut",
    titleFr: "Réception des sauts", titleAr: "هبوط القفزات",
    advice:
      "الـ Réception متاع الـ Sauts ضعيفة. ركّز على Amortir بالركبة وقت النزول وحافظ على الـ Équilibre. ابدا تخدم على Tornado Kick ببطء قبل ما تزيد السرعة.",
  },
  "31": {
    code: "31", category: "Saut",
    titleFr: "Hauteur insuffisante", titleAr: "ارتفاع غير كاف",
    advice:
      "الـ Hauteur متاع الـ Saut ناقصة. زيد في Pliométrie وخدم Squat-jumps يومياً. الـ Impulsion من الرجل الخلفية لازمها تكون أقوى.",
  },
  // ===== 50s — Taijiquan =====
  "50": {
    code: "50", category: "Taiji",
    titleFr: "Continuité du mouvement", titleAr: "تواصل الحركة",
    advice:
      "في الـ Taiji لازم Fluidité كاملة بلا Pauses. حافظ على الـ Respiration متزامنة مع الحركة، وما تكسرش الـ Rythme حتى وقت Transitions الصعبة.",
  },
  // ===== 60s — Weapons =====
  "60": {
    code: "60", category: "Équilibre / Arme",
    titleFr: "Équilibre & contrôle de l'arme", titleAr: "التوازن والتحكم في السلاح",
    advice:
      "لازم تخدم أكثر على الـ Stabilisation وقت الـ Réception. الـ Équilibre متاعك نقص فيه خاطر الـ Appui موش ثابت، والـ Arme ما كانتش مرتاحة في يدّيك. حاول Visualiser الـ Trajectoire قبل التنفيذ.",
  },
  "61": {
    code: "61", category: "Arme",
    titleFr: "Contact avec l'arme", titleAr: "تماس مع السلاح",
    advice:
      "حصل Contact غير مرغوب فيه بين الـ Arme والجسم. خدم على الـ Espacement وعلى Trajectoires أوسع، خاصة في الـ Mouvements circulaires.",
  },
  // ===== 70s — Equipment / Tenue =====
  "70": {
    code: "70", category: "Équipement",
    titleFr: "Tenue et équipement", titleAr: "اللباس والمعدات",
    advice:
      "Problème في الـ Tenue ولا الـ Équipement (سقوط حزام، انفلات سلاح). راجع كل قطعة قبل الدخول وخدم Check-list.",
  },
};

// Fallback per-decade if exact code not mapped
export const ADVICE_BY_DECADE: Record<string, CodeAdvice> = {
  "1": ADVICE_BY_CODE["10"],
  "2": ADVICE_BY_CODE["20"],
  "3": ADVICE_BY_CODE["30"],
  "5": ADVICE_BY_CODE["50"],
  "6": ADVICE_BY_CODE["60"],
  "7": ADVICE_BY_CODE["70"],
};

export function getAdviceForCode(code: string): CodeAdvice {
  if (ADVICE_BY_CODE[code]) return ADVICE_BY_CODE[code];
  const decade = code.charAt(0);
  if (ADVICE_BY_DECADE[decade]) return ADVICE_BY_DECADE[decade];
  return {
    code,
    category: "Général",
    titleFr: "Observation générale",
    titleAr: "ملاحظة عامة",
    advice: "Déduction مسجّلة. راجع الـ Vidéo مع المدرّب باش تفهم الـ Détail متاع الخطأ.",
  };
}

// ===== Contextual / psychological analysis =====
export interface TimedDeduction {
  code: string;
  value: number;
  timeSec: number; // when in the routine it happened
}

export interface ContextualInsight {
  id: string;
  emoji: string;
  titleFr: string;
  titleAr: string;
  advice: string;
}

export function analyzeContext(
  deductions: TimedDeduction[],
  performanceTime: number,
): ContextualInsight[] {
  const insights: ContextualInsight[] = [];
  if (deductions.length === 0) return insights;

  // 1) Errors clustered in the LAST 20s → endurance / breath management
  const lateWindow = Math.max(0, performanceTime - 20);
  const lateErrors = deductions.filter((d) => d.timeSec >= lateWindow);
  if (lateErrors.length >= 2) {
    insights.push({
      id: "endurance",
      emoji: "💨",
      titleFr: "Gestion de souffle & Résistance physique",
      titleAr: "إدارة النفس والتحمل البدني",
      advice:
        `لاحظنا ${lateErrors.length} أخطاء في آخر 20 ثانية من العرض. هذا يدلّ على Fatigue وضعف في الـ Gestion de souffle. ` +
        `لازمك تزيد في Cardio (course fractionnée) و Endurance spécifique باش تحافظ على نفس مستوى الـ Performance من البداية للنهاية.`,
    });
  }

  // 2) Rhythm oscillation → big gaps between consecutive deductions = stress/concentration
  if (deductions.length >= 3) {
    const sorted = [...deductions].sort((a, b) => a.timeSec - b.timeSec);
    const gaps: number[] = [];
    for (let i = 1; i < sorted.length; i++) gaps.push(sorted[i].timeSec - sorted[i - 1].timeSec);
    const avgGap = gaps.reduce((s, g) => s + g, 0) / gaps.length;
    const variance = gaps.reduce((s, g) => s + (g - avgGap) ** 2, 0) / gaps.length;
    if (Math.sqrt(variance) > avgGap * 0.6) {
      insights.push({
        id: "rhythm",
        emoji: "🧠",
        titleFr: "Concentration & Gestion de stress",
        titleAr: "التركيز وإدارة الضغط",
        advice:
          "فمّة Tذبذب في الـ Rythme متاع الأخطاء — مرّة تركيز عالي ومرّة Distractions. " +
          "خدم على Exercices de respiration (4-7-8) و Visualisation mentale قبل العرض باش تحافظ على Concentration ثابتة من البداية.",
      });
    }
  }

  // 3) Errors at the START → stress de démarrage
  const earlyErrors = deductions.filter((d) => d.timeSec <= 15);
  if (earlyErrors.length >= 2) {
    insights.push({
      id: "start-stress",
      emoji: "🎯",
      titleFr: "Démarrage & Stress initial",
      titleAr: "البداية والتوتر الأولي",
      advice:
        "أكثر من خطأ في أول 15 ثانية يدلّ على Stress de démarrage. " +
        "خدم Échauffement مطوّل و Routine pré-compétition ثابتة (موسيقى، تنفس، Visualisation) باش تدخل القاعة وانت Calme و Centré.",
    });
  }

  // 4) Heavy total deduction → confidence / preparation
  const totalLoss = deductions.reduce((s, d) => s + d.value, 0);
  if (totalLoss >= 1.0) {
    insights.push({
      id: "preparation",
      emoji: "📈",
      titleFr: "Préparation globale",
      titleAr: "التحضير العام",
      advice:
        `الـ Déduction الإجمالية وصلت ${totalLoss.toFixed(2)} نقطة. ` +
        "هذا يحتاج Plan d'entraînement مكثّف على المدى المتوسط (4-6 أسابيع) مع Sessions vidéo أسبوعية مع المدرّب لتحليل كل Détail.",
    });
  }

  return insights;
}

export function buildWhatsAppMessage(opts: {
  athleteName: string;
  finalScore: number;
  reportUrl: string;
  topAdvice?: string;
}): string {
  const lines = [
    `🥋 *Rapport Wushu — ${opts.athleteName}*`,
    `🏆 Score final: *${opts.finalScore.toFixed(2)}*`,
    "",
    "💡 *Conseil AI principal:*",
    opts.topAdvice ?? "Voir le rapport complet pour les détails.",
    "",
    `📊 Rapport complet: ${opts.reportUrl}`,
    "",
    "— الجامعة التونسية للووشو كونغ فو",
  ];
  return lines.join("\n");
}
