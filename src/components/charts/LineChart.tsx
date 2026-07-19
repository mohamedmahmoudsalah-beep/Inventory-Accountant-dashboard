"use client";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";

export function LineChartComponent({ data, config }: { data: any[]; config: any }) {
  const sampleData = data.length > 0 ? data : [
    { name: "Jan", value: 400 },
    { name: "Feb", value: 300 },
    { name: "Mar", value: 600 },
  ];

  return (
    <ResponsiveContainer width="100%" height="100%">
      <LineChart data={sampleData}>
        <CartesianGrid strokeDasharray="3 3" stroke="#374151" opacity={0.3} />
        <XAxis dataKey={config?.xAxis || "name"} stroke="#9CA3AF" fontSize={12} />
        <YAxis stroke="#9CA3AF" fontSize={12} />
        <Tooltip
          contentStyle={{
            backgroundColor: "#1F2937",
            border: "1px solid #374151",
            borderRadius: "8px",
          }}
        />
        <Line
          type="monotone"
          dataKey={config?.yAxis || "value"}
          stroke="#F26522"
          strokeWidth={2}
          dot={{ fill: "#F26522", r: 4 }}
        />
      </LineChart>
    </ResponsiveContainer>
  );
}
