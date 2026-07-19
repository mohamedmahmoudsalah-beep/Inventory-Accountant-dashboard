import Link from "next/link";
import { LayoutDashboard, MoreHorizontal, Eye } from "lucide-react";
import { formatDate } from "@/lib/utils";

export function DashboardCard({ dashboard, locale }: { dashboard: any; locale: string }) {
  return (
    <div className="glass-card rounded-2xl p-5 hover:shadow-xl transition-all duration-300 group">
      <div className="flex items-start justify-between mb-4">
        <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
          <LayoutDashboard className="w-5 h-5 text-primary" />
        </div>
        <button className="opacity-0 group-hover:opacity-100 p-1.5 hover:bg-accent rounded-lg transition-opacity">
          <MoreHorizontal className="w-4 h-4 text-muted-foreground" />
        </button>
      </div>

      <h3 className="font-semibold text-foreground mb-1 truncate">{dashboard.name}</h3>
      <p className="text-sm text-muted-foreground mb-4 line-clamp-2">
        {dashboard.description || "No description"}
      </p>

      <div className="flex items-center justify-between text-xs text-muted-foreground">
        <span>{dashboard._count?.widgets || 0} widgets</span>
        <span>{formatDate(dashboard.updatedAt, locale)}</span>
      </div>

      <Link
        href={`/${locale}/dashboards/${dashboard.id}`}
        className="mt-4 flex items-center justify-center gap-2 w-full py-2 rounded-xl bg-accent hover:bg-accent/80 text-foreground text-sm font-medium transition-colors"
      >
        <Eye className="w-4 h-4" />
        View Dashboard
      </Link>
    </div>
  );
}
