// eslint-disable-next-line @typescript-eslint/no-require-imports
const { createClient } = require("@supabase/supabase-js");

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !serviceRoleKey) {
  console.error("Missing env vars");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, serviceRoleKey);

async function checkSchema() {
  // We can't directly query schema with JS client easily without SQL function,
  // but we can try to insert a row with null assigned_to and see if it fails.
  // Or better, just try to update a dummy customer.

  console.log("Checking if we can set assigned_to to null...");

  // Create a dummy customer
  const { data: customer, error: createError } = await supabase
    .from("customers")
    .insert({ name: "Schema Test Customer", phone: "0000000000" })
    .select()
    .single();

  if (createError) {
    console.error("Failed to create test customer:", createError);
    return;
  }

  console.log("Created test customer:", customer.id);

  // Try to assign
  const { error: assignError } = await supabase
    .from("customers")
    .update({ assigned_to: customer.assigned_to || "some-uuid" }) // Just to test update
    .eq("id", customer.id);

  // Try to unassign (set to null)
  const { error: unassignError } = await supabase
    .from("customers")
    .update({ assigned_to: null })
    .eq("id", customer.id);

  if (unassignError) {
    console.error("Unassign error:", unassignError);
  } else {
    console.log("Unassign successful (column allows nulls)");
  }

  // Cleanup
  await supabase.from("customers").delete().eq("id", customer.id);
}

checkSchema();
