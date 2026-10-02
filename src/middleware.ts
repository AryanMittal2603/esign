import { NextResponse, type NextRequest } from "next/server";
import { ADMIN_COOKIE, readToken } from "@/lib/session";

const MOBILE_UA = /Android|iPhone|iPad|iPod|Mobile|Opera Mini|IEMobile/i;

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // Responsive entry: phones go to the signatory gate. Anything not clearly a phone falls
  // through to the root page, which decides by screen width in the browser.
  if (pathname === "/") {
    const mobile = MOBILE_UA.test(req.headers.get("user-agent") ?? "") || req.headers.get("sec-ch-ua-mobile") === "?1";
    if (mobile) return NextResponse.redirect(new URL("/sign", req.url));
    return NextResponse.next();
  }

  const isAdminPage = pathname.startsWith("/admin") && pathname !== "/admin/login";
  const isAdminApi = pathname.startsWith("/api/admin") && pathname !== "/api/admin/login";
  if (isAdminPage || isAdminApi) {
    const session = await readToken<{ sub: string }>(req.cookies.get(ADMIN_COOKIE)?.value);
    if (!session) {
      if (isAdminApi) return NextResponse.json({ error: "Sign in first" }, { status: 401 });
      const url = new URL("/admin/login", req.url);
      url.searchParams.set("next", pathname);
      return NextResponse.redirect(url);
    }
  }
  return NextResponse.next();
}

// Signatory upload routes are intentionally excluded so large scans never pass through middleware.
export const config = { matcher: ["/", "/admin/:path*", "/api/admin/:path*"] };
