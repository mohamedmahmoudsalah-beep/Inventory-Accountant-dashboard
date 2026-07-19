"use client";
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from "recharts";

const COLORS = ["#F26522", "#0F3460", "#E94560", "#16A34A", "#2563EB"];

export function PieChartComponent({ data, config }: { data: any[]; config: any }) {
  const sampleData = data.length > 0 ? data : [
    { name: "A", value: 400 },
    { name: "B", value: 300 },
    { name: "C", value: 300 },
  ];

  return (
    <ResponsiveContainer width="100%" height="100%">
      <PieChart>
        <Pie
          data={sampleData}
          cx="50%"
          cy="50%"
          innerRadius={60}
          outerRadius={80}
          paddingAngle={5}
          dataKey={config?.yAxis || "value"}
        >
          {sampleData.map((entry, index) => (
            <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
          ))}
        </Pie>
        <Tooltip
          contentStyle={{
            backgroundColor: "#1F2937",
            border: "1px solid #374151",
            borderRadius: "8px",
          }}
        />
      </PieChart>
    </ResponsiveContainer>
  );
}
