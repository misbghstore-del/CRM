import { AuthError } from "@supabase/supabase-js";

/**
 * Handle Supabase auth errors gracefully
 * @param error - The auth error from Supabase
 * @returns User-friendly error message
 */
export function handleAuthError(error: unknown): string {
  if (!error) return "An unknown error occurred";

  const authError = error as AuthError;

  // Handle refresh token errors
  if (
    authError.message?.includes("refresh_token_not_found") ||
    authError.message?.includes("Invalid Refresh Token")
  ) {
    // Clear local storage
    if (typeof window !== "undefined") {
      localStorage.clear();
      sessionStorage.clear();
    }
    return "Your session has expired. Please log in again.";
  }

  // Handle other common auth errors
  if (authError.message?.includes("Invalid login credentials")) {
    return "Invalid email or password. Please try again.";
  }

  if (authError.message?.includes("Email not confirmed")) {
    return "Please verify your email address before logging in.";
  }

  if (authError.message?.includes("User already registered")) {
    return "An account with this email already exists.";
  }

  // Return the original error message or a generic one
  return authError.message || "An authentication error occurred";
}

/**
 * Check if user should be redirected to login
 * @param error - The auth error from Supabase
 * @returns true if should redirect to login
 */
export function shouldRedirectToLogin(error: unknown): boolean {
  if (!error) return false;

  const authError = error as AuthError;

  // Redirect on session/token errors
  return (
    authError.message?.includes("refresh_token") ||
    authError.message?.includes("JWT") ||
    authError.message?.includes("session") ||
    authError.status === 401
  );
}
