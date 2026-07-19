import createMiddleware from "next-intl/middleware";
import { withAuth } from "next-auth/middleware";
import { NextResponse } from "next/server";
import { locales, defaultLocale } from "./i18n/config";

const intlMiddleware = createMiddleware({
  locales,
  defaultLocale,
  localePrefix: "always",
});

export default withAuth(
  function middleware(req) {
    const pathname = req.nextUrl.pathname;

    // Skip auth API routes and public assets
    if (pathname.includes("/api/auth") || pathname.includes("/_next") || pathname.includes("/favicon")) {
      return NextResponse.next();
    }

    return intlMiddleware(req);
  },
  {
    callbacks: {
      authorized({ req, token }) {
        const pathname = req.nextUrl.pathname;
        // Allow login page and public assets
        if (pathname.includes("/login") || pathname.includes("/_next")) {
          return true;
        }
        return token !== null;
      },
    },
  }
);

export const config = {
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico).*)"],
};
