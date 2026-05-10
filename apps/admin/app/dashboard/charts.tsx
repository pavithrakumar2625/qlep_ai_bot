import type { WorkspaceAnalytics } from "../../lib/api";

interface ChartsProps {
  analytics: WorkspaceAnalytics;
}

const PRIORITY_ORDER = ["urgent", "high", "medium", "low"];
const PRIORITY_COLORS: Record<string, string> = {
  urgent: "#b42318",
  high: "#dc6803",
  medium: "#0f766e",
  low: "#475467",
};

export function AnalyticsCharts({ analytics }: ChartsProps) {
  return (
    <section className="grid layout" style={{ marginTop: 24 }}>
      <article className="panel">
        <p className="muted">Volume over the last {analytics.days} days</p>
        <VolumeBars rows={analytics.volumeByDay} />
      </article>
      <article className="panel">
        <p className="muted">Priority breakdown</p>
        <Distribution
          rows={[...analytics.byPriority].sort(
            (a, b) => PRIORITY_ORDER.indexOf(a.label) - PRIORITY_ORDER.indexOf(b.label),
          )}
          getLabel={(row) => row.label}
          getValue={(row) => row.count}
          getColor={(row) => PRIORITY_COLORS[row.label] ?? "#94a3b8"}
        />
      </article>
      <article className="panel">
        <p className="muted">Category breakdown</p>
        <Distribution
          rows={analytics.byCategory}
          getLabel={(row) => row.category}
          getValue={(row) => row.count}
          getColor={() => "#0f766e"}
        />
      </article>
      <article className="panel">
        <p className="muted">Status breakdown</p>
        <Distribution
          rows={analytics.byStatus}
          getLabel={(row) => row.status}
          getValue={(row) => row.count}
          getColor={() => "#475467"}
        />
      </article>
    </section>
  );
}

function VolumeBars({ rows }: { rows: { day: string; count: number }[] }) {
  if (rows.length === 0) {
    return <p className="muted">No feedback in this window.</p>;
  }
  const max = Math.max(...rows.map((row) => row.count), 1);
  const width = 480;
  const height = 140;
  const barWidth = Math.max(4, Math.floor(width / rows.length) - 2);

  return (
    <svg
      role="img"
      aria-label="Daily feedback volume"
      width="100%"
      viewBox={`0 0 ${width} ${height}`}
      style={{ marginTop: 12 }}
    >
      {rows.map((row, idx) => {
        const h = (row.count / max) * (height - 24);
        const x = idx * (barWidth + 2);
        return (
          <g key={row.day}>
            <rect
              x={x}
              y={height - h - 16}
              width={barWidth}
              height={h}
              fill="#0f766e"
              rx={3}
            />
            <text
              x={x + barWidth / 2}
              y={height - 4}
              textAnchor="middle"
              fontSize={9}
              fill="#6d665f"
            >
              {row.day.slice(5)}
            </text>
          </g>
        );
      })}
    </svg>
  );
}

interface DistributionProps<T> {
  rows: T[];
  getLabel: (row: T) => string;
  getValue: (row: T) => number;
  getColor: (row: T) => string;
}

function Distribution<T>({ rows, getLabel, getValue, getColor }: DistributionProps<T>) {
  if (rows.length === 0) {
    return <p className="muted">No data yet.</p>;
  }
  const max = Math.max(...rows.map(getValue), 1);
  return (
    <div className="list" style={{ marginTop: 12 }}>
      {rows.map((row, idx) => {
        const value = getValue(row);
        const pct = (value / max) * 100;
        return (
          <div key={`${getLabel(row)}-${idx}`}>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4, fontSize: 13 }}>
              <span>{getLabel(row)}</span>
              <span className="muted">{value}</span>
            </div>
            <div style={{ background: "rgba(15,118,110,0.08)", borderRadius: 6, height: 8, overflow: "hidden" }}>
              <div
                style={{
                  width: `${pct}%`,
                  height: "100%",
                  background: getColor(row),
                  borderRadius: 6,
                }}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}
