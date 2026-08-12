import {
  Radar, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, ResponsiveContainer,
  BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid, Cell,
} from "recharts";
import { Activity, Target } from "lucide-react";

const GOLD = "#D4AF37";
const ORANGE = "#FF7A1A";

interface ReportChartsProps {
  judgeAScore: number;
  judgeBAverage: number;
  judgeCScore: number;
  maxA: number;
  maxB: number;
  maxC: number;
  deductions: { code: string; value: number; timeSec: number; label: string }[];
  performanceTime: number;
}

export function ReportCharts({
  judgeAScore, judgeBAverage, judgeCScore, maxA, maxB, maxC,
  deductions, performanceTime,
}: ReportChartsProps) {
  // Normalize scores to 0-100 for radar
  const radarData = [
    { axis: "Quality A", value: Math.round((judgeAScore / maxA) * 100), fullMark: 100 },
    { axis: "Performance B", value: Math.round((judgeBAverage / maxB) * 100), fullMark: 100 },
    { axis: "Difficulty C", value: Math.round((judgeCScore / maxC) * 100), fullMark: 100 },
  ];

  // Bucketize deductions into 10s windows
  const bucketSize = 10;
  const buckets = Math.ceil(performanceTime / bucketSize);
  const timelineData = Array.from({ length: buckets }, (_, i) => {
    const start = i * bucketSize;
    const end = start + bucketSize;
    const inBucket = deductions.filter(d => d.timeSec >= start && d.timeSec < end);
    return {
      window: `${start}-${end}s`,
      total: Math.round(inBucket.reduce((s, d) => s + d.value, 0) * 100) / 100,
      count: inBucket.length,
    };
  });

  const maxBucket = Math.max(...timelineData.map(b => b.total), 0.1);

  return (
    <div className="space-y-4">
      {/* Radar Chart */}
      <div className="rounded-2xl p-4"
        style={{ background: "rgba(255,255,255,0.03)", border: `1px solid ${GOLD}33` }}>
        <div className="flex items-center gap-2 mb-2">
          <Target className="h-4 w-4" style={{ color: GOLD }} />
          <h3 className="font-heading font-black text-sm" style={{ color: GOLD }}>
            Performance Balance
          </h3>
          <span className="text-[10px] text-white/40">— التوازن الفني</span>
        </div>
        <div className="h-56 -mx-2">
          <ResponsiveContainer width="100%" height="100%">
            <RadarChart data={radarData} outerRadius="75%">
              <PolarGrid stroke={`${GOLD}33`} />
              <PolarAngleAxis
                dataKey="axis"
                tick={{ fill: GOLD, fontSize: 11, fontWeight: 700 }}
              />
              <PolarRadiusAxis
                angle={90}
                domain={[0, 100]}
                tick={{ fill: "rgba(255,255,255,0.3)", fontSize: 9 }}
                stroke={`${GOLD}22`}
              />
              <Radar
                name="Score"
                dataKey="value"
                stroke={GOLD}
                fill={GOLD}
                fillOpacity={0.35}
                strokeWidth={2}
              />
              <Tooltip
                contentStyle={{
                  background: "#0a0a0a",
                  border: `1px solid ${GOLD}66`,
                  borderRadius: 8,
                  color: "#fff",
                  fontSize: 11,
                }}
                formatter={((v: unknown) => [`${v}%`, "Score"]) as never}
              />
            </RadarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Timeline Bar Chart */}
      <div className="rounded-2xl p-4"
        style={{ background: "rgba(255,255,255,0.03)", border: `1px solid ${GOLD}33` }}>
        <div className="flex items-center gap-2 mb-2">
          <Activity className="h-4 w-4" style={{ color: GOLD }} />
          <h3 className="font-heading font-black text-sm" style={{ color: GOLD }}>
            Performance Timeline
          </h3>
          <span className="text-[10px] text-white/40">— توزيع الخصومات</span>
        </div>
        <div className="h-44 -mx-2">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={timelineData} margin={{ top: 5, right: 8, left: -20, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
              <XAxis
                dataKey="window"
                tick={{ fill: "rgba(255,255,255,0.5)", fontSize: 9 }}
                stroke="rgba(255,255,255,0.1)"
              />
              <YAxis
                tick={{ fill: "rgba(255,255,255,0.4)", fontSize: 9 }}
                stroke="rgba(255,255,255,0.1)"
              />
              <Tooltip
                cursor={{ fill: `${ORANGE}11` }}
                contentStyle={{
                  background: "#0a0a0a",
                  border: `1px solid ${ORANGE}66`,
                  borderRadius: 8,
                  color: "#fff",
                  fontSize: 11,
                }}
                formatter={((v: unknown, _n: unknown, p: { payload?: { count?: number } }) => [`−${v} (${p?.payload?.count ?? 0}x)`, "Déductions"]) as never}
              />
              <Bar dataKey="total" radius={[6, 6, 0, 0]}>
                {timelineData.map((entry, i) => {
                  const intensity = entry.total / maxBucket;
                  const color = intensity > 0.66 ? ORANGE : intensity > 0.33 ? `${ORANGE}cc` : `${GOLD}99`;
                  return <Cell key={i} fill={entry.total === 0 ? "rgba(255,255,255,0.05)" : color} />;
                })}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
        <p className="text-[10px] text-white/40 text-center mt-1">
          نوافذ 10 ثوان — الأشرطة البرتقالية الكثيفة = فترات انخفاض التركيز
        </p>
      </div>
    </div>
  );
}
