import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

export async function middleware(request: NextRequest) {
  let response = NextResponse.next({
    request: {
      headers: request.headers,
    },
  });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          return request.cookies.get(name)?.value;
        },
        set(name: string, value: string, options: CookieOptions) {
          request.cookies.set({
            name,
            value,
            ...options,
          });
          response = NextResponse.next({
            request: {
              headers: request.headers,
            },
          });
          response.cookies.set({
            name,
            value,
            ...options,
          });
        },
        remove(name: string, options: CookieOptions) {
          request.cookies.set({
            name,
            value: "",
            ...options,
          });
          response = NextResponse.next({
            request: {
              headers: request.headers,
            },
          });
          response.cookies.set({
            name,
            value: "",
            ...options,
          });
        },
      },
    }
  );

  let user = null;

  try {
    const { data, error } = await supabase.auth.getUser();

    // Handle auth errors (invalid/expired refresh token)
    if (error) {
      console.error("Auth error in middleware:", error.message);

      // Clear all auth-related cookies
      const cookiesToClear = [
        "sb-access-token",
        "sb-refresh-token",
        process.env.NEXT_PUBLIC_SUPABASE_URL
          ? `sb-${
              new URL(process.env.NEXT_PUBLIC_SUPABASE_URL).hostname.split(
                "."
              )[0]
            }-auth-token`
          : null,
      ].filter(Boolean);

      cookiesToClear.forEach((cookieName) => {
        if (cookieName) {
          response.cookies.delete(cookieName as string);
        }
      });

      // Redirect to login if not already there
      if (
        !request.nextUrl.pathname.startsWith("/login") &&
        !request.nextUrl.pathname.startsWith("/auth")
      ) {
        return NextResponse.redirect(new URL("/login", request.url));
      }
    } else {
      user = data.user;
    }
  } catch (error) {
    console.error("Unexpected error in middleware:", error);
  }

  if (
    !user &&
    !request.nextUrl.pathname.startsWith("/login") &&
    !request.nextUrl.pathname.startsWith("/auth")
  ) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  return response;
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * Feel free to modify this pattern to include more paths.
     */
    "/((?!_next/static|_next/image|favicon.ico|manifest.webmanifest|sw.js|icon|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
