import { createClient } from "@/utils/supabase/server";
import { Button } from "@/components/ui/button";
import {
  Plus,
  Clock,
  CalendarCheck,
  TrendingUp,
  ArrowRight,
} from "lucide-react";
import CreateTaskDialog from "@/components/tasks/create-task-dialog";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import Link from "next/link";
import DateDisplay from "@/components/ui/date-display";
import VisitsChart from "@/components/analytics/visits-chart";
import CustomerStats from "@/components/analytics/customer-stats";
import TopBDMs from "@/components/analytics/top-bdms";

interface Task {
  id: string;
  description: string;
  due_date: string | null;
  is_completed: boolean;
  customers: {
    name: string;
  } | null;
}

interface Visit {
  id: string;
  timestamp: string;
  purpose: string;
  outcome: string;
  customers: {
    name: string;
  } | null;
}

interface Customer {
  id: string;
  name: string;
  phone: string | null;
}

export default async function DashboardPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: tasks } = await supabase
    .from("tasks")
    .select("*, customers(name)")
    .eq("user_id", user?.id)
    .eq("is_completed", false)
    .order("due_date", { ascending: true })
    .limit(5)
    .returns<Task[]>();

  const { data: visits } = await supabase
    .from("visits")
    .select("*, customers(name)")
    .eq("user_id", user?.id)
    .gte("timestamp", new Date().toISOString().split("T")[0]) // Visits from today onwards
    .order("timestamp", { ascending: false })
    .limit(5)
    .returns<Visit[]>();

  const { data: customers } = await supabase
    .from("customers")
    .select("id, name, phone")
    .eq("assigned_to", user?.id)
    .order("name")
    .returns<Customer[]>();

  // Get user role
  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user?.id)
    .single();

  const isAdmin = profile?.role === "admin";

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex flex-col gap-2">
        <h1 className="text-3xl font-heading font-bold tracking-tight text-foreground">
          Welcome back,{" "}
          {user?.user_metadata?.full_name?.split(" ")[0] || "User"}! 👋
        </h1>
        <p className="text-muted-foreground text-lg">
          Here&apos;s your performance overview and daily tasks.
        </p>
      </div>

      {/* Stats & Actions Row */}
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
        <CustomerStats />

        <Card className="bg-gradient-to-br from-primary/10 to-primary/5 border-primary/20">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <TrendingUp className="h-4 w-4" />
              Quick Actions
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-4">
            <div className="flex flex-col gap-2">
              <CreateTaskDialog
                customers={customers || []}
                trigger={
                  <Button
                    className="w-full justify-start h-8 text-xs"
                    size="sm"
                  >
                    <Plus className="mr-2 h-3 w-3" /> Create Task
                  </Button>
                }
              />
              <Link href="/visits/new">
                <Button
                  variant="outline"
                  className="w-full justify-start h-8 text-xs"
                  size="sm"
                >
                  <ArrowRight className="mr-2 h-3 w-3" /> Log Visit
                </Button>
              </Link>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Analytics Main Row */}
      <div className="grid gap-6 md:grid-cols-1 lg:grid-cols-7">
        <div className="lg:col-span-4">
          <VisitsChart />
        </div>
        <div className="lg:col-span-3">
          <TopBDMs />
        </div>
      </div>

      {/* Operational Lists Row */}
      <div className="grid gap-6 md:grid-cols-2">
        {/* Pending Tasks Section */}
        <Card className="flex flex-col">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-lg font-bold flex items-center gap-2">
              <Clock className="h-5 w-5 text-orange-500" />
              Pending Tasks
            </CardTitle>
            <Link href="/planner">
              <Button
                variant="link"
                size="sm"
                className="h-8 px-0 text-muted-foreground"
              >
                View all
              </Button>
            </Link>
          </CardHeader>
          <CardContent className="flex-1">
            <div className="space-y-4">
              {tasks && tasks.length > 0 ? (
                tasks.map((task) => (
                  <div
                    key={task.id}
                    className="flex items-start justify-between group rounded-lg p-3 hover:bg-muted/50 transition-colors border border-transparent hover:border-border/50"
                  >
                    <div className="space-y-1">
                      <p className="text-sm font-medium leading-none group-hover:text-primary transition-colors">
                        {task.description}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {task.customers?.name} •{" "}
                        {task.due_date
                          ? new Date(task.due_date).toLocaleDateString()
                          : "No date"}
                      </p>
                    </div>
                    <div className="flex items-center">
                      <span className="inline-flex items-center rounded-full bg-orange-100 px-2 py-0.5 text-xs font-medium text-orange-800 dark:bg-orange-900/30 dark:text-orange-300">
                        Pending
                      </span>
                    </div>
                  </div>
                ))
              ) : (
                <div className="flex h-full flex-col items-center justify-center text-center text-muted-foreground py-8">
                  <p>No pending tasks. You&apos;re all caught up!</p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Visits Today Section */}
        <Card className="flex flex-col">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-lg font-bold flex items-center gap-2">
              <CalendarCheck className="h-5 w-5 text-blue-500" />
              Visits Today
            </CardTitle>
            {isAdmin && (
              <Link href="/visits">
                <Button
                  variant="link"
                  size="sm"
                  className="h-8 px-0 text-muted-foreground"
                >
                  View all
                </Button>
              </Link>
            )}
          </CardHeader>
          <CardContent className="flex-1">
            <div className="space-y-4">
              {visits && visits.length > 0 ? (
                visits.map((visit) => (
                  <div
                    key={visit.id}
                    className="flex items-center justify-between group rounded-lg p-3 hover:bg-muted/50 transition-colors border border-transparent hover:border-border/50"
                  >
                    <div className="flex items-center gap-4">
                      <div className="flex flex-col items-center justify-center rounded-md bg-muted p-2 h-10 w-10">
                        <DateDisplay
                          timestamp={visit.timestamp}
                          className="text-xs font-bold"
                          options={{
                            hour: "2-digit",
                            minute: "2-digit",
                            hour12: false,
                          }}
                        />
                      </div>
                      <div className="space-y-1">
                        <p className="text-sm font-medium leading-none group-hover:text-primary transition-colors">
                          {visit.customers?.name}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {visit.purpose}
                        </p>
                      </div>
                    </div>
                    <span className="text-xs text-muted-foreground bg-secondary px-2 py-1 rounded-full">
                      {visit.outcome}
                    </span>
                  </div>
                ))
              ) : (
                <div className="flex h-full flex-col items-center justify-center text-center text-muted-foreground py-8">
                  <p>No visits logged for today yet.</p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
