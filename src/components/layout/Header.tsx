"use client";

import { useTranslations } from "next-intl";
import { Search, Bell, Moon, Sun, Globe } from "lucide-react";
import { useTheme } from "next-themes";
import { usePathname, useRouter } from "next/navigation";
import { signOut } from "next-auth/react";

export function Header({ user }: { user: any }) {
  const t = useTranslations();
  const { theme, setTheme } = useTheme();
  const pathname = usePathname();
  const router = useRouter();
  const locale = pathname.split("/")[1] || "en";

  const toggleLocale = () => {
    const newLocale = locale === "en" ? "ar" : "en";
    const newPath = pathname.replace(`/${locale}`, `/${newLocale}`);
    router.push(newPath);
  };

  return (
    <header className="h-16 border-b border-border bg-card/50 backdrop-blur-xl flex items-center justify-between px-6 sticky top-0 z-40">
      <div className="flex items-center gap-4 flex-1">
        <div className="relative max-w-md w-full">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <input
            type="text"
            placeholder={t("navigation.search")}
            className="w-full pl-10 pr-4 py-2 bg-background border border-border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
          />
        </div>
      </div>

      <div className="flex items-center gap-2">
        <button
          onClick={toggleLocale}
          className="p-2 rounded-xl hover:bg-accent text-muted-foreground transition-colors"
          title="Toggle Language"
        >
          <Globe className="w-5 h-5" />
        </button>

        <button
          onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
          className="p-2 rounded-xl hover:bg-accent text-muted-foreground transition-colors"
        >
          {theme === "dark" ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
        </button>

        <button className="p-2 rounded-xl hover:bg-accent text-muted-foreground transition-colors relative">
          <Bell className="w-5 h-5" />
          <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-breadfast-red rounded-full" />
        </button>

        <button
          onClick={() => signOut({ callbackUrl: "/login" })}
          className="ml-2 px-4 py-2 text-sm font-medium text-destructive hover:bg-destructive/10 rounded-xl transition-colors"
        >
          {t("navigation.logout")}
        </button>
      </div>
    </header>
  );
}
