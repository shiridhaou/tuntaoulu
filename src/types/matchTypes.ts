export interface JudgeStatusRow {
  judge_slot: string;
  judge_name: string;
  state: "sent" | "waiting" | "offline";
  updated_at?: string;
}
