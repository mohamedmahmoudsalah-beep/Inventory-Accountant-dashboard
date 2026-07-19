import { TrendingUp, TrendingDown, Minus } from "lucide-react";

export function KPICard({ title, value, previousValue, format = "number" }: any) {
  const trend = previousValue ? (value > previousValue ? "up" : value < previousValue ? "down" : "neutral") : "neutral";
  const diff = previousValue ? ((value - previousValue) / previousValue) * 100 : 0;

  const formatValue = (val: number) => {
    if (format === "currency") return `$${val.toLocaleString()}`;
    if (format === "percentage") return `${val}%`;
    return val.toLocaleString();
  };

  return (
    <div className="flex flex-col items-center justify-center h-full text-center">
      <p className="text-sm text-muted-foreground mb-2">{title}</p>
      <p className="text-3xl font-bold text-foreground">{formatValue(value)}</p>
      {previousValue && (
        <div
          className={`flex items-center gap-1 mt-2 text-sm ${
            trend === "up" ? "text-green-500" : trend === "down" ? "text-red-500" : "text-gray-500"
          }`}
        >
          {trend === "up" ? <TrendingUp className="w-4 h-4" /> : trend === "down" ? <TrendingDown className="w-4 h-4" /> : <Minus className="w-4 h-4" />}
          <span>{Math.abs(diff).toFixed(1)}%</span>
        </div>
      )}
    </div>
  );
}
