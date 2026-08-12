import { createContext, useContext } from "react";

export type CompetitionStyle = "changquan" | "nanquan" | "taijiquan" | "traditional" | null;

export type UserRole = 
  | "chief-referee" 
  | "assistant-referee" 
  | "a-quality-judge" 
  | "b-performance-judge" 
  | "c-difficulty-judge" 
  | "technical-assistant"
  | null;

export interface DifficultyMovement {
  code: string;
  label: string;
  connection: string;
  value: number;
}

export interface Athlete {
  id: string;
  name: string;
  country: string;
  category: string;
  order: number;
  difficultySheet?: DifficultyMovement[];
}

export interface AppliedDeduction {
  code: string;
  value: number;
  label: string;
}

export interface DifficultyAttempt {
  code: string;
  label: string;
  value: number;
  successful: boolean;
  /** "movement" (max 1.40) or "connection" (max 0.60). Defaults to movement. */
  kind?: "movement" | "connection";
}

export interface MovementSequenceItem {
  id: string;
  name: string;
  nameAr: string;
  status: "pending" | "success" | "fail";
}

// IWUF 2024 style-specific max scores
export interface StyleConfig {
  maxA: number;
  maxB: number;
  maxC: number;
  performanceTime: number;
  hasContinuityTimer: boolean;
  deductionWeights: { minor: number; medium: number; major: number };
}

export const STYLE_CONFIGS: Record<string, StyleConfig> = {
  changquan: {
    maxA: 5.0, maxB: 3.0, maxC: 2.0,
    performanceTime: 80,
    hasContinuityTimer: false,
    deductionWeights: { minor: 0.1, medium: 0.2, major: 0.3 },
  },
  nanquan: {
    maxA: 5.0, maxB: 3.0, maxC: 2.0,
    performanceTime: 80,
    hasContinuityTimer: false,
    deductionWeights: { minor: 0.1, medium: 0.2, major: 0.3 },
  },
  taijiquan: {
    maxA: 5.0, maxB: 3.0, maxC: 2.0,
    performanceTime: 300,
    hasContinuityTimer: true,
    deductionWeights: { minor: 0.1, medium: 0.2, major: 0.3 },
  },
  traditional: {
    maxA: 5.0, maxB: 3.0, maxC: 2.0,
    performanceTime: 90,
    hasContinuityTimer: false,
    deductionWeights: { minor: 0.1, medium: 0.3, major: 0.5 },
  },
};

// Join request — judge submits name + desired role, waits for chief to assign a slot
export type RequestedRole = "A" | "B" | "C" | "AHJ";

export interface JoinRequest {
  id: string;               // local id (mirrors DB id when synced)
  judgeName: string;
  requestedRole: RequestedRole;
  requestedAt: number;
  status: "waiting" | "assigned" | "rejected";
  assignedKey?: string;     // e.g. "A1", "B3" — set when chief assigns
}

// Active assignment: judgeKey -> name (the live team)
export type JudgeAssignments = Record<string, string>;

export interface TeamConfig {
  numA: number; // 1..5
  numB: number; // 3..7
  numC: number; // 1..5
}

export const DEFAULT_TEAM: TeamConfig = { numA: 3, numB: 5, numC: 3 };

export interface CompetitionState {
  isAuthenticated: boolean;
  selectedRole: UserRole;
  competitionStyle: CompetitionStyle;
  athletes: Athlete[];
  currentAthleteIndex: number;
  // Session
  sessionCode: string | null;
  judgeId: string | null;
  generateSessionCode: () => Promise<void>;
  setSessionCode: (code: string | null) => void;
  setJudgeId: (id: string | null) => void;
  // Setup gate — chief must complete this before sharing the session
  setupComplete: boolean;
  setSetupComplete: (v: boolean) => void;
  // Team config
  team: TeamConfig;
  setTeamConfig: (cfg: TeamConfig) => void;
  // Performance timer
  timerRunning: boolean;
  timerElapsed: number;
  // Continuity timer (Taijiquan)
  continuityPause: number;
  // Judge A
  judgeADeductions: AppliedDeduction[];
  judgeAScore: number;
  addJudgeADeduction: (d: AppliedDeduction) => void;
  resetJudgeADeductions: () => void;
  // Judge B
  judgeBScores: number[];
  judgeBAverage: number;
  setJudgeBScore: (index: number, score: number) => void;
  resetJudgeBScores: () => void;
  // Judge C
  judgeCAttempts: DifficultyAttempt[];
  judgeCScore: number;
  addJudgeCAttempt: (a: DifficultyAttempt) => void;
  toggleJudgeCAttempt: (index: number) => void;
  resetJudgeCAttempts: () => void;
  // AHJ (Assistant Head Judge) movement sequence
  movementSequence: MovementSequenceItem[];
  setMovementStatus: (id: string, status: "success" | "fail") => void;
  resetMovementSequence: () => void;
  // Bias detection
  biasAlerts: { judgeIndex: number; score: number; average: number }[];
  // Final
  finalScore: number;
  scoreRevealed: boolean;
  setScoreRevealed: (v: boolean) => void;
  // Setters
  setAuthenticated: (v: boolean) => void;
  setSelectedRole: (role: UserRole) => void;
  setCompetitionStyle: (style: CompetitionStyle) => void;
  setAthletes: (athletes: Athlete[]) => void;
  setCurrentAthleteIndex: (i: number) => void;
  setTimerRunning: (v: boolean) => void;
  setTimerElapsed: (v: number) => void;
  setContinuityPause: (v: number) => void;
  logout: () => void;
  // AI Chat
  aiMessages: { role: "user" | "assistant"; content: string }[];
  addAiMessage: (msg: { role: "user" | "assistant"; content: string }) => void;
  clearAiMessages: () => void;
  // Join requests + assignments
  joinRequests: JoinRequest[];
  judgeAssignments: JudgeAssignments;       // "A1" -> "اسم القاضي"
  approvedJudges: string[];                 // derived: keys with assignment
  submitJoinRequest: (judgeName: string, requestedRole: RequestedRole) => Promise<string>; // returns request id (DB id)
  assignJudge: (requestId: string, judgeKey: string) => void;
  rejectJoinRequest: (id: string) => void;
  revokeJudge: (judgeKey: string) => void;  // removes assignment + clears that judge's score
  // Chief override scores per judge slot
  judgeOverrides: Record<string, number | null>;
  setJudgeOverride: (judgeKey: string, score: number | null) => void;
  // Slots that have submitted a score for the CURRENT athlete (live from DB)
  submittedSlots: string[];
  // Public scoreboard customization
  marqueeText: string;
  setMarqueeText: (text: string) => void;
  sponsorLogos: string[];
  addSponsorLogo: (url: string) => void;
  removeSponsorLogo: (index: number) => void;
  // Leaderboard
  leaderboardMode: boolean;
  setLeaderboardMode: (v: boolean) => void;
  results: Record<string, number>;
  commitCurrentResult: () => void;
  clearResults: () => void;
  getLeaderboard: () => { athlete: Athlete; score: number }[];
  // Reports
  reports: Record<string, AthleteReport>;
  getReport: (athleteId: string) => AthleteReport | null;
  // AHJ
  styleMode: "mandatory" | "optional";
  setStyleMode: (m: "mandatory" | "optional") => void;
  suggestedDeductions: { code: string; label: string; value: number; reason: string; createdAt: number }[];
  addSuggestedDeduction: (s: { code: string; label: string; value: number; reason: string }) => void;
  clearSuggestedDeductions: () => void;
  ahjReady: boolean;
  signalHeadJudge: () => void;
  clearAhjSignal: () => void;
  // VAR Broadcast (v1.1.4) — Chief toggles whether the public TV mirrors the VAR live feed
  isVarLiveOnPublic: boolean;
  setIsVarLiveOnPublic: (v: boolean) => void;
}

export interface AthleteReport {
  athleteId: string;
  athleteName: string;
  country: string;
  category: string;
  style: CompetitionStyle;
  finalScore: number;
  judgeAScore: number;
  judgeBAverage: number;
  judgeCScore: number;
  deductions: { code: string; value: number; label: string; timeSec: number }[];
  performanceTime: number;
  committedAt: number;
}

export const CompetitionContext = createContext<CompetitionState | null>(null);

export function useCompetition() {
  const ctx = useContext(CompetitionContext);
  if (!ctx) throw new Error("useCompetition must be used within CompetitionProvider");
  return ctx;
}
