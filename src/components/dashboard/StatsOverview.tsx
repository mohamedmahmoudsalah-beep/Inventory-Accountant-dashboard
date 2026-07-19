import { LayoutDashboard, Database, Building2, BarChart3 } from "lucide-react";

const icons = {
  layout: LayoutDashboard,
  database: Database,
  building: Building2,
  widgets: BarChart3,
};

export function StatsOverview({ stats }: { stats: any[] }) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
      {stats.map((stat, index) => {
        const Icon = (icons as any)[stat.icon] || BarChart3;
        return (
          <div
            key={index}
            className="glass-card rounded-2xl p-5 hover:shadow-lg transition-all duration-300"
          >
            <div className="flex items-center justify-between mb-3">
              <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
                <Icon className="w-5 h-5 text-primary" />
              </div>
              {stat.trend && (
                <span
                  className={`text-xs font-medium px-2 py-1 rounded-full ${
                    stat.trend === "up"
                      ? "bg-green-500/10 text-green-500"
                      : stat.trend === "down"
                      ? "bg-red-500/10 text-red-500"
                      : "bg-gray-500/10 text-gray-500"
                  }`}
                >
                  {stat.trend === "up" ? "↑" : stat.trend === "down" ? "↓" : "→"}
                </span>
              )}
            </div>
            <p className="text-2xl font-bold text-foreground">{stat.value}</p>
            <p className="text-sm text-muted-foreground mt-1">{stat.label}</p>
          </div>
        );
      })}
    </div>
  );
}
