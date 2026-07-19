"use client";

import { useState, useEffect } from "react";
import { useTranslations } from "next-intl";
import { Database, Plus, RefreshCw, Trash2, ExternalLink } from "lucide-react";
import { GoogleSheetsConnector } from "@/components/data-sources/GoogleSheetsConnector";

export default function DatasetsPage() {
  const t = useTranslations();
  const [datasets, setDatasets] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showConnector, setShowConnector] = useState(false);

  useEffect(() => {
    fetchDatasets();
  }, []);

  const fetchDatasets = async () => {
    try {
      const res = await fetch("/api/datasets");
      const data = await res.json();
      setDatasets(data.datasets || []);
    } catch (error) {
      console.error("Error fetching datasets:", error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin w-8 h-8 border-2 border-primary border-t-transparent rounded-full" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold text-foreground">{t("dataset.title")}</h1>
        <button
          onClick={() => setShowConnector(true)}
          className="inline-flex items-center gap-2 px-4 py-2.5 bg-primary text-primary-foreground rounded-xl font-medium hover:bg-primary/90 transition-colors"
        >
          <Plus className="w-4 h-4" />
          {t("dataset.connect")}
        </button>
      </div>

      {datasets.length === 0 ? (
        <div className="glass-card rounded-2xl p-12 text-center">
          <Database className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
          <h3 className="text-lg font-medium text-foreground mb-2">{t("dataset.noDatasets")}</h3>
          <button
            onClick={() => setShowConnector(true)}
            className="inline-flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-lg font-medium hover:bg-primary/90 transition-colors"
          >
            <Plus className="w-4 h-4" />
            {t("dataset.create")}
          </button>
        </div>
      ) : (
        <div className="glass-card rounded-2xl overflow-hidden">
          <table className="w-full">
            <thead className="bg-accent/50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase">Name</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase">Type</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase">Rows</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {datasets.map((dataset) => (
                <tr key={dataset.id} className="hover:bg-accent/30 transition-colors">
                  <td className="px-6 py-4 text-sm font-medium text-foreground">{dataset.name}</td>
                  <td className="px-6 py-4 text-sm text-muted-foreground">{dataset.type}</td>
                  <td className="px-6 py-4 text-sm text-muted-foreground">{dataset.rowCount || "-"}</td>
                  <td className="px-6 py-4 text-sm">
                    <div className="flex items-center gap-2">
                      <button className="p-1.5 hover:bg-accent rounded-lg text-muted-foreground">
                        <RefreshCw className="w-4 h-4" />
                      </button>
                      <button className="p-1.5 hover:bg-accent rounded-lg text-muted-foreground">
                        <ExternalLink className="w-4 h-4" />
                      </button>
                      <button className="p-1.5 hover:bg-destructive/10 rounded-lg text-destructive">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {showConnector && (
        <GoogleSheetsConnector
          onClose={() => setShowConnector(false)}
          onSuccess={() => {
            setShowConnector(false);
            fetchDatasets();
          }}
        />
      )}
    </div>
  );
}
