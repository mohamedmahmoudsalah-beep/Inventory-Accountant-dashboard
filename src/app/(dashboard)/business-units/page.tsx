import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth/auth.config";
import { prisma } from "@/lib/db/prisma";
import { getTranslations } from "next-intl/server";
import { Building2, Plus, Users } from "lucide-react";

export default async function BusinessUnitsPage({ params: { locale } }: { params: { locale: string } }) {
  const t = await getTranslations();
  const units = await prisma.businessUnit.findMany({
    include: {
      _count: { select: { members: true, dashboards: true, datasets: true } },
    },
    orderBy: { createdAt: "desc" },
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold text-foreground">{t("businessUnit.title")}</h1>
        <button className="inline-flex items-center gap-2 px-4 py-2.5 bg-primary text-primary-foreground rounded-xl font-medium hover:bg-primary/90 transition-colors">
          <Plus className="w-4 h-4" />
          {t("businessUnit.create")}
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {units.map((unit) => (
          <div
            key={unit.id}
            className="glass-card rounded-2xl p-6 hover:shadow-xl transition-all duration-300"
          >
            <div className="flex items-start justify-between mb-4">
              <div
                className="w-12 h-12 rounded-xl flex items-center justify-center"
                style={{ backgroundColor: `${unit.color}20` }}
              >
                <Building2 className="w-6 h-6" style={{ color: unit.color }} />
              </div>
              <span
                className={`px-2.5 py-1 rounded-full text-xs font-medium ${
                  unit.isActive
                    ? "bg-green-500/10 text-green-500"
                    : "bg-gray-500/10 text-gray-500"
                }`}
              >
                {unit.isActive ? "Active" : "Inactive"}
              </span>
            </div>

            <h3 className="text-lg font-semibold text-foreground mb-1">{unit.name}</h3>
            <p className="text-sm text-muted-foreground mb-4">{unit.description || "No description"}</p>

            <div className="flex items-center gap-4 text-sm text-muted-foreground">
              <div className="flex items-center gap-1.5">
                <Users className="w-4 h-4" />
                <span>{unit._count.members} members</span>
              </div>
              <div>
                <span>{unit._count.dashboards} dashboards</span>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
