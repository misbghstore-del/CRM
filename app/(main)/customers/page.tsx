import { createClient } from "@/utils/supabase/server";
import AddCustomerDialog from "@/components/customers/add-customer-dialog";
import CustomerList from "@/components/customers/customer-list";

export default async function CustomersPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: customers } = await supabase
    .from("customers")
    .select("*")
    .eq("assigned_to", user?.id)
    .order("name");

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