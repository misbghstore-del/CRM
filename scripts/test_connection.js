const { createClient } = require("@supabase/supabase-js");

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error("Missing env vars");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function testConnection() {
  console.log("Testing connection to:", supabaseUrl);
  try {
    const { count, error } = await supabase
      .from("profiles")
      .select("*", { count: "exact", head: true });

    if (error) {
      console.error("Connection failed:", JSON.stringify(error, null, 2));
    } else {
      console.log("Connection successful! Profiles count:", count);
    }
  } catch (err) {
    console.error("Unexpected error:", err.message);
    console.error(err);
  }

  console.log("Testing direct fetch...");
  try {
    const res = await fetch(`${supabaseUrl}/rest/v1/`, {
      headers: {
        apikey: supabaseKey,
        Authorization: `Bearer ${supabaseKey}`,
      },
    });
    console.log("Fetch status:", res.status);
    console.log("Fetch status text:", res.statusText);
    const text = await res.text();
    console.log("Fetch body:", text.substring(0, 100));
  } catch (err) {
    console.error("Fetch error:", err.message);
    if (err.cause) console.error("Cause:", err.cause);
  }
}

testConnection();
