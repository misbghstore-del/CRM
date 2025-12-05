console.log(
  "NEXT_PUBLIC_SUPABASE_URL is set:",
  !!process.env.NEXT_PUBLIC_SUPABASE_URL
);
console.log(
  "NEXT_PUBLIC_SUPABASE_ANON_KEY is set:",
  !!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);
console.log(
  "Supabase URL value (first 10 chars):",
  process.env.NEXT_PUBLIC_SUPABASE_URL
    ? process.env.NEXT_PUBLIC_SUPABASE_URL.substring(0, 10)
    : "N/A"
);
