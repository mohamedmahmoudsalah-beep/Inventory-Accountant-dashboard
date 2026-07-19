import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth/auth.config";
import { prisma } from "@/lib/db/prisma";
import { getTranslations } from "next-intl/server";
import { DashboardCard } from "@/components/dashboard/DashboardCard";
import { StatsOverview } from "@/components/dashboard/StatsOverview";
import { RecentActivity } from "@/components/dashboard/RecentActivity";
import { Plus, LayoutDashboard } from "lucide-react";
import Link from "next/link";

export default async function DashboardHomePage({
  params: { locale },
}: {
  params: { locale: string };
}) {
  const t = await getTranslations();
  const session = await getServerSession(authOptions);
  const userId = (session?.user as any)?.id;

  const [dashboards, datasets, businessUnits] = await Promise.all([
    prisma.dashboard.findMany({
      where: { createdById: userId },
      take: 6,
      orderBy: { updatedAt: "desc" },
      include: { businessUnit: true, _count: { select: { widgets: true } } },
    }),
    prisma.dataset.count({ where: { createdById: userId } }),
    prisma.businessUnit.count(),
  ]);

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground">{t("navigation.dashboard")}</h1>
          <p className="text-muted-foreground mt-1">
            Welcome back, {(session?.user as any)?.name}
          </p>
        </div>
        <Link
          href={`/${locale}/dashboards/new`}
          className="inline-flex items-center gap-2 px-4 py-2.5 bg-primary text-primary-foreground rounded-xl font-medium hover:bg-primary/90 transition-colors shadow-lg shadow-primary/20"
        >
          <Plus className="w-4 h-4" />
          {t("dashboard.create")}
        </Link>
      </div>

      {/* Stats */}
      <StatsOverview
        stats={[
          { label: "Dashboards", value: dashboards.length, icon: "layout", trend: "up" },
          { label: "Datasets", value: datasets, icon: "database", trend: "neutral" },
          { label: "Business Units", value: businessUnits, icon: "building", trend: "up" },
          { label: "Widgets", value: dashboards.reduce((acc, d) => acc + (d._count?.widgets || 0), 0), icon: "widgets", trend: "up" },
        ]}
      />

      {/* Recent Dashboards */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-semibold text-foreground">{t("navigation.dashboards")}</h2>
          <Link
            href={`/${locale}/dashboards`}
            className="text-sm text-primary hover:text-primary/80 font-medium"
          >
            View All
          </Link>
        </div>

        {dashboards.length === 0 ? (
          <div className="glass-card rounded-2xl p-12 text-center">
            <LayoutDashboard className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
            <h3 className="text-lg font-medium text-foreground mb-2">{t("dashboard.noDashboards")}</h3>
            <p className="text-muted-foreground mb-4">{t("dashboard.createFirst")}</p>
            <Link
              href={`/${locale}/dashboards/new`}
              className="inline-flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-lg font-medium hover:bg-primary/90 transition-colors"
            >
              <Plus className="w-4 h-4" />
              {t("dashboard.create")}
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {dashboards.map((dashboard) => (
              <DashboardCard key={dashboard.id} dashboard={dashboard} locale={locale} />
            ))}
          </div>
        )}
      </div>

      {/* Recent Activity */}
      <RecentActivity />
    </div>
  );
}
