import { createClient } from "@/utils/supabase/server";
import AddCustomerDialog from "@/components/customers/add-customer-dialog";
import CustomerList from "@/components/customers/customer-list";

export default async function CustomersPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Get profile to check role
  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  let query = supabase.from("customers").select("*").order("name");

  // Only super_admin can see all customers
  if (profile?.role !== "super_admin") {
    query = query.eq("assigned_to", user.id);
  }

  const { data: customers } = await query;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold tracking-tight">Customers</h1>
        <AddCustomerDialog />
      </div>

      <CustomerList initialCustomers={customers || []} />
    </div>
  );
}
