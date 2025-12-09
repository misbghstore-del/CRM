"use server";

import { createClient } from "@supabase/supabase-js";
import { revalidatePath } from "next/cache";

// Helper to get admin client
function getAdminClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceRoleKey) {
    console.error("Missing Supabase environment variables", {
      supabaseUrl: !!supabaseUrl,
      serviceRoleKey: !!serviceRoleKey,
    });
    throw new Error("Missing Supabase environment variables");
  }

  return createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
    },
  });
}

import { createClient as createServerClient } from "@/utils/supabase/server";

// Helper to check if current user has permission
async function checkPermission(allowedRoles: string[]) {
  const supabase = await createServerClient();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error || !user) {
    throw new Error("Unauthorized");
  }

  // Get profile to check role
  const adminClient = getAdminClient();
  const { data: profile } = await adminClient
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  if (!profile || !allowedRoles.includes(profile.role)) {
    throw new Error(
      `Insufficient permissions: User has role ${
        profile?.role
      }, needed ${allowedRoles.join(" or ")}`
    );
  }

  return profile;
}

export async function getUsersList() {
  try {
    const supabaseAdmin = getAdminClient();

    // Fetch auth users
    const {
      data: { users: authUsers },
      error: authError,
    } = await supabaseAdmin.auth.admin.listUsers();
    if (authError) throw authError;

    // Fetch profiles
    const { data: profiles, error: profilesError } = await supabaseAdmin
      .from("profiles")
      .select("id, role, full_name, phone");

    if (profilesError) throw profilesError;

    // Create a map of profiles for easy lookup
    const profileMap = new Map(profiles.map((p) => [p.id, p]));

    console.log(
      `Found ${authUsers.length} auth users and ${profiles.length} profiles`
    );

    // Merge data
    const mergedUsers = authUsers.map(
      (u: {
        id: string;
        email?: string;
        phone?: string;
        user_metadata?: { full_name?: string; role?: string };
        banned_until?: string;
        created_at: string;
        last_sign_in_at?: string;
      }) => {
        const profile = profileMap.get(u.id);
        return {
          id: u.id,
          email: u.email || "",
          // Prioritize profile data, fallback to metadata, then defaults
          phone: profile?.phone || u.phone || "",
          full_name: profile?.full_name || u.user_metadata?.full_name || "",
          role: profile?.role || u.user_metadata?.role || "user",
          banned_until: u.banned_until,
          created_at: u.created_at,
          last_sign_in_at: u.last_sign_in_at,
        };
      }
    );

    return {
      success: true,
      users: mergedUsers,
    };
  } catch (error) {
    console.error("Error fetching users:", error);
    return { error: (error as Error).message, users: [] };
  }
}

export type ActionState = {
  error?: string;
  message?: string;
  success?: boolean;
};

export async function createUser(
  prevState: ActionState | null,
  formData: FormData
) {
  const email = formData.get("email") as string;
  const password = formData.get("password") as string;
  const fullName = formData.get("fullName") as string;
  const role = formData.get("role") as string;

  // 1. Permission Check: Only admin or super_admin can create users
  try {
    await checkPermission(["admin", "super_admin"]);
  } catch (e) {
    return { error: "Unauthorized: Only Admins can create users." };
  }

  console.log(
    `[createUser] Attempting to create user: ${email}, role: ${role}`
  );

  if (!email || !password || !fullName || !role) {
    return { error: "All fields are required" };
  }

  try {
    const supabaseAdmin = getAdminClient();

    const { data, error } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: {
        full_name: fullName,
        role: role,
      },
    });

    if (error) {
      console.error("[createUser] Auth creation failed:", error);
      throw error;
    }

    console.log(`[createUser] Auth user created with ID: ${data.user.id}`);

    // Ensure profile exists/updates with correct role
    const { error: profileError } = await supabaseAdmin
      .from("profiles")
      .update({ role: role, full_name: fullName })
      .eq("id", data.user.id);

    if (profileError) {
      console.error("[createUser] Profile update error:", profileError);
      // Try insert if update failed (though trigger should have handled it)
      const { error: insertError } = await supabaseAdmin
        .from("profiles")
        .insert({
          id: data.user.id,
          role: role,
          full_name: fullName,
          email: email,
        });

      if (insertError)
        console.error("[createUser] Profile insert retry failed:", insertError);
      else console.log("[createUser] Profile inserted manually");
    } else {
      console.log("[createUser] Profile updated successfully");
    }

    revalidatePath("/admin");
    return { success: true, message: `User ${email} created successfully!` };
  } catch (error) {
    console.error("[createUser] Unexpected error:", error);
    return { error: (error as Error).message };
  }
}

export async function toggleUserStatus(userId: string, shouldBan: boolean) {
  console.log(`[toggleUserStatus] User: ${userId}, Ban: ${shouldBan}`);

  // 1. Permission Check: Only SUPER ADMIN can ban users
  try {
    await checkPermission(["super_admin"]);
  } catch (e) {
    return { error: "Unauthorized: Only Super Admin can ban users." };
  }

  try {
    const supabaseAdmin = getAdminClient();
    const banDuration = shouldBan ? "876000h" : "none";

    const { error } = await supabaseAdmin.auth.admin.updateUserById(userId, {
      ban_duration: banDuration,
    });

    if (error) {
      console.error("[toggleUserStatus] Failed:", error);
      throw error;
    }

    console.log("[toggleUserStatus] Success");
    revalidatePath("/admin");
    return {
      success: true,
      message: shouldBan ? "User banned" : "User unbanned",
    };
  } catch (error) {
    console.error("[toggleUserStatus] Error:", error);
    return { error: (error as Error).message };
  }
}

export async function updateUserRole(userId: string, newRole: "admin" | "bdm") {
  console.log(`[updateUserRole] User: ${userId}, New Role: ${newRole}`);

  // 1. Permission Check: Only SUPER ADMIN can change roles (promote/demote)
  try {
    await checkPermission(["super_admin"]);
  } catch (e) {
    return { error: "Unauthorized: Only Super Admin can manage roles." };
  }

  try {
    const supabaseAdmin = getAdminClient();

    // Update public.profiles
    const { error: profileError } = await supabaseAdmin
      .from("profiles")
      .update({ role: newRole })
      .eq("id", userId);

    if (profileError) {
      console.error("[updateUserRole] Profile update failed:", profileError);
      throw profileError;
    }

    // Update user metadata
    const { error: authError } = await supabaseAdmin.auth.admin.updateUserById(
      userId,
      {
        user_metadata: { role: newRole },
      }
    );

    if (authError)
      console.error("[updateUserRole] Auth metadata update failed:", authError);

    console.log("[updateUserRole] Success");
    revalidatePath("/admin");
    return { success: true, message: `Role updated to ${newRole}` };
  } catch (error) {
    console.error("[updateUserRole] Error:", error);
    return { error: (error as Error).message };
  }
}

export async function deleteUser(userId: string) {
  console.log(`[deleteUser] Attempting to delete user: ${userId}`);

  // 1. Permission Check: Only SUPER ADMIN can delete users
  try {
    await checkPermission(["super_admin"]);
  } catch (e) {
    return { error: "Unauthorized: Only Super Admin can delete users." };
  }

  try {
    const supabaseAdmin = getAdminClient();

    // 1. Unassign customers (Set assigned_to = null)
    const { error: unassignError } = await supabaseAdmin
      .from("customers")
      .update({ assigned_to: null })
      .eq("assigned_to", userId);

    if (unassignError) {
      console.error(
        "[deleteUser] Failed to unassign customers:",
        unassignError
      );
      throw new Error("Failed to unassign customers from this user.");
    }

    // 2. Delete Tasks (Assuming tasks are owned by the user and can be removed)
    const { error: tasksError } = await supabaseAdmin
      .from("tasks")
      .delete()
      .eq("user_id", userId);

    if (tasksError) {
      console.warn(
        "[deleteUser] Failed to delete tasks (continuing...):",
        tasksError
      );
    }

    // 3. Nullify Visits (If possible, to keep history but remove user link)
    // Note: If user_id is NOT NULL in visits, this might fail, and we might need to delete visits.
    // For now, we try to nullify.
    const { error: visitsError } = await supabaseAdmin
      .from("visits")
      .update({ user_id: null })
      .eq("user_id", userId);

    if (visitsError) {
      console.warn(
        "[deleteUser] Failed to nullify visits (continuing...):",
        visitsError
      );
    }

    // 4. Explicitly delete profile
    const { error: profileError } = await supabaseAdmin
      .from("profiles")
      .delete()
      .eq("id", userId);

    if (profileError) {
      console.warn(
        "[deleteUser] Profile delete warning (might rely on cascade):",
        profileError
      );
      // If this fails, it's likely due to remaining FK constraints (e.g. visits if nullify failed)
      if (visitsError) {
        throw new Error(
          "Cannot delete user because they have associated visits that cannot be unlinked."
        );
      }
      throw profileError;
    } else {
      console.log("[deleteUser] Profile deleted (or not found)");
    }

    // 5. Delete auth user
    const { error } = await supabaseAdmin.auth.admin.deleteUser(userId);

    if (error) {
      console.error("[deleteUser] Auth delete failed:", error);
      throw error;
    }

    console.log("[deleteUser] Success");
    revalidatePath("/admin");
    return { success: true, message: "User deleted successfully" };
  } catch (error) {
    console.error("[deleteUser] Error:", error);
    return { error: (error as Error).message };
  }
}

export async function resetUserPassword(userId: string, newPassword: string) {
  try {
    const supabaseAdmin = getAdminClient();

    const { error } = await supabaseAdmin.auth.admin.updateUserById(userId, {
      password: newPassword,
    });

    if (error) throw error;

    return { success: true, message: "Password reset successfully" };
  } catch (error) {
    console.error("Error resetting password:", error);
    return { error: (error as Error).message };
  }
}

export async function getDashboardStats() {
  try {
    const supabaseAdmin = getAdminClient();

    // Fetch all data in parallel
    const [
      { data: users },
      { data: customers },
      { data: visits },
      { data: tasks },
    ] = await Promise.all([
      supabaseAdmin.from("profiles").select("id, full_name, role"),
      supabaseAdmin
        .from("customers")
        .select("id, stage, assigned_to, created_at"),
      supabaseAdmin.from("visits").select("id, user_id, created_at, outcome"),
      supabaseAdmin.from("tasks").select("id, user_id, is_completed"),
    ]);

    const bdms = users?.filter((u) => u.role === "bdm") || [];
    const allCustomers = customers || [];
    const allVisits = visits || [];
    const allTasks = tasks || [];

    // KPI Calculations
    const totalCustomers = allCustomers.length;
    const closedDeals = allCustomers.filter((c) => c.stage === "Closed").length;
    const openDeals = allCustomers.filter((c) => c.stage !== "Closed").length;
    const winRate =
      totalCustomers > 0
        ? ((closedDeals / totalCustomers) * 100).toFixed(1)
        : "0.0";

    // Pipeline Distribution
    const pipelineStages = [
      "New Lead",
      "Validity Check",
      "1st Meeting Done",
      "Customer Visit/Demo",
      "Proposal",
      "Negotiation",
      "Closed",
    ];
    const pipelineData = pipelineStages.map((stage) => ({
      name: stage,
      value: allCustomers.filter((c) => c.stage === stage).length,
    }));

    // Agent Performance
    const agentStats = bdms.map((bdm) => {
      const bdmCustomers = allCustomers.filter((c) => c.assigned_to === bdm.id);
      const bdmVisits = allVisits.filter((v) => v.user_id === bdm.id);
      const bdmTasks = allTasks.filter((t) => t.user_id === bdm.id);
      const bdmClosed = bdmCustomers.filter((c) => c.stage === "Closed").length;

      return {
        id: bdm.id,
        name: bdm.full_name || "Unknown",
        totalLeads: bdmCustomers.length,
        closedDeals: bdmClosed,
        activeLeads: bdmCustomers.length - bdmClosed,
        totalVisits: bdmVisits.length,
        pendingTasks: bdmTasks.filter((t) => !t.is_completed).length,
        winRate:
          bdmCustomers.length > 0
            ? Math.round((bdmClosed / bdmCustomers.length) * 100)
            : 0,
      };
    });

    return {
      success: true,
      stats: {
        kpi: {
          totalCustomers,
          closedDeals,
          openDeals,
          winRate,
          totalVisits: allVisits.length,
        },
        pipeline: pipelineData,
        agents: agentStats,
      },
    };
  } catch (error) {
    console.error("Error fetching dashboard stats:", error);
    return { error: (error as Error).message };
  }
}

// Customer Assignment Management
export async function getAllCustomersWithAssignments() {
  try {
    const supabaseAdmin = getAdminClient();

    // Fetch all customers with their assigned BDM details
    const { data: customers, error } = await supabaseAdmin
      .from("customers")
      .select(
        `
                id,
                name,
                phone,
                stage,
                type,
                assigned_to,
                bdm:profiles!assigned_to (
                    id,
                    full_name,
                    email
                )
            `
      )
      .order("name");

    if (error) {
      console.error("[getAllCustomersWithAssignments] Query error:", error);
      throw error;
    }

    console.log(
      "[getAllCustomersWithAssignments] Fetched customers:",
      customers?.length || 0
    );

    return {
      success: true,
      customers: customers || [],
    };
  } catch (error) {
    console.error("Error fetching customers with assignments:", error);
    return { error: (error as Error).message, customers: [] };
  }
}

export async function assignCustomerToBDM(customerId: string, bdmId: string) {
  console.log(`[assignCustomerToBDM] Customer: ${customerId}, BDM: ${bdmId}`);
  try {
    const supabaseAdmin = getAdminClient();

    // Verify the BDM exists and has the correct role
    const { data: bdm, error: bdmError } = await supabaseAdmin
      .from("profiles")
      .select("id, role, full_name")
      .eq("id", bdmId)
      .single();

    if (bdmError || !bdm) {
      throw new Error("BDM not found");
    }

    if (bdm.role !== "bdm" && bdm.role !== "admin") {
      throw new Error("Selected user is not a BDM");
    }

    // Update the customer's assigned_to field
    const { error: updateError } = await supabaseAdmin
      .from("customers")
      .update({ assigned_to: bdmId })
      .eq("id", customerId);

    if (updateError) {
      console.error("[assignCustomerToBDM] Update failed:", updateError);
      throw updateError;
    }

    console.log("[assignCustomerToBDM] Success");
    revalidatePath("/admin");
    revalidatePath("/dashboard");
    return {
      success: true,
      message: `Customer assigned to ${bdm.full_name}`,
    };
  } catch (error) {
    console.error("[assignCustomerToBDM] Error:", error);
    return { error: (error as Error).message };
  }
}

export async function unassignCustomer(customerId: string) {
  console.log(`[unassignCustomer] Customer: ${customerId}`);
  try {
    const supabaseAdmin = getAdminClient();

    // Set assigned_to to null
    const { error: updateError } = await supabaseAdmin
      .from("customers")
      .update({ assigned_to: null })
      .eq("id", customerId);

    if (updateError) {
      console.error("[unassignCustomer] Update failed:", updateError);
      throw updateError;
    }

    console.log("[unassignCustomer] Success");
    revalidatePath("/admin");
    revalidatePath("/dashboard");
    return {
      success: true,
      message: "Customer unassigned successfully",
    };
  } catch (error) {
    console.error("[unassignCustomer] Error:", error);
    return { error: (error as Error).message };
  }
}
