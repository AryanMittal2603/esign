import { NextResponse, type NextRequest } from "next/server";
import { ADMIN_COOKIE, readToken } from "@/lib/session";

const MOBILE_UA = /Android|iPhone|iPad|iPod|Mobile|Opera Mini|IEMobile/i;

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // Responsive entry: phones go to the signatory gate, desktops to the admin dashboard.
  if (pathname === "/") {
    const mobile = MOBILE_UA.test(req.headers.get("user-agent") ?? "");
    return NextResponse.redirect(new URL(mobile ? "/sign" : "/admin", req.url));
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
