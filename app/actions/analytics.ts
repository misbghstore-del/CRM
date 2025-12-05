"use server";

import { createClient } from "@/utils/supabase/server";

export async function getVisitsStats(range: "week" | "month" = "week") {
  const supabase = await createClient();
  const now = new Date();
  const startDate = new Date();

  if (range === "week") {
    startDate.setDate(now.getDate() - 7);
  } else {
    startDate.setDate(now.getDate() - 30);
  }

  const { data: visits, error } = await supabase
    .from("visits")
    .select("timestamp")
    .gte("timestamp", startDate.toISOString())
    .order("timestamp", { ascending: true });

  if (error) {
    console.error("Error fetching visit stats:", error);
    return [];
  }

  // Aggregate by date
  const stats: Record<string, number> = {};

  // Initialize all dates in range with 0
  for (let d = new Date(startDate); d <= now; d.setDate(d.getDate() + 1)) {
    const dateStr = d.toISOString().split("T")[0];
    stats[dateStr] = 0;
  }

  visits.forEach((visit) => {
    const dateStr = new Date(visit.timestamp).toISOString().split("T")[0];
    if (stats[dateStr] !== undefined) {
      stats[dateStr]++;
    }
  });

  return Object.entries(stats).map(([date, count]) => ({
    date,
    count,
  }));
}

export async function getCustomerStats() {
  const supabase = await createClient();

  // Total customers
  const { count: totalCount, error: totalError } = await supabase
    .from("customers")
    .select("*", { count: "exact", head: true });

  if (totalError) {
    console.error("Error fetching total customers:", totalError);
    return { total: 0, growth: 0 };
  }

  // New customers in last 30 days
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  const { count: newCount, error: newError } = await supabase
    .from("customers")
    .select("*", { count: "exact", head: true })
    .gte("created_at", thirtyDaysAgo.toISOString());

  if (newError) {
    console.error("Error fetching new customers:", newError);
    return { total: totalCount || 0, growth: 0 };
  }

  return {
    total: totalCount || 0,
    growth: newCount || 0,
  };
}

export async function getTopBDMs() {
  const supabase = await createClient();

  // Check if user is admin
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return [];

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  if (profile?.role !== "admin") {
    return [];
  }

  // Fetch visits with BDM info
  const { data: visits, error } = await supabase
    .from("visits")
    .select("user_id, profiles(full_name)");

  if (error) {
    console.error("Error fetching top BDMs:", error);
    return [];
  }

  // Aggregate counts
  const bdmCounts: Record<string, { name: string; count: number }> = {};

  visits.forEach((visit) => {
    const profile = Array.isArray(visit.profiles)
      ? visit.profiles[0]
      : visit.profiles;
    const bdmName = profile?.full_name || "Unknown";
    const bdmId = visit.user_id;

    if (!bdmCounts[bdmId]) {
      bdmCounts[bdmId] = { name: bdmName, count: 0 };
    }
    bdmCounts[bdmId].count++;
  });

  // Sort and take top 5
  return Object.values(bdmCounts)
    .sort((a, b) => b.count - a.count)
    .slice(0, 5);
}
