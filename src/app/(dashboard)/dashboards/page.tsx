import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth/auth.config";
import { prisma } from "@/lib/db/prisma";
import { getTranslations } from "next-intl/server";
import { DashboardCard } from "@/components/dashboard/DashboardCard";
import { Plus } from "lucide-react";
import Link from "next/link";

export default async function DashboardsPage({ params: { locale } }: { params: { locale: string } }) {
  const t = await getTranslations();
  const session = await getServerSession(authOptions);
  const userId = (session?.user as any)?.id;

  const dashboards = await prisma.dashboard.findMany({
    where: { createdById: userId },
    include: { businessUnit: true, _count: { select: { widgets: true } } },
    orderBy: { updatedAt: "desc" },
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold text-foreground">{t("navigation.dashboards")}</h1>
        <Link
          href={`/${locale}/dashboards/new`}
          className="inline-flex items-center gap-2 px-4 py-2.5 bg-primary text-primary-foreground rounded-xl font-medium hover:bg-primary/90 transition-colors"
        >
          <Plus className="w-4 h-4" />
          {t("dashboard.create")}
        </Link>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {dashboards.map((dashboard) => (
          <DashboardCard key={dashboard.id} dashboard={dashboard} locale={locale} />
        ))}
      </div>
    </div>
  );
}
