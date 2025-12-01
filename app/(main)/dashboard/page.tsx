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
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import Link from "next/link";
import DateDisplay from "@/components/ui/date-display";

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
    .limit(5);

  const { data: visits } = await supabase
    .from("visits")
    .select("*, customers(name)")
    .eq("user_id", user?.id)
    .gte("timestamp", new Date().toISOString().split("T")[0]) // Visits from today onwards (or just today logic)
    .order("timestamp", { ascending: false })
    .limit(5);

  const { data: customers } = await supabase
    .from("customers")
    .select("id, name, phone")
    .eq("assigned_to", user?.id)
    .order("name");

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex flex-col gap-2">
        <h1 className="text-3xl font-heading font-bold tracking-tight text-foreground">
          Welcome back,{" "}
          {user?.user_metadata?.full_name?.split(" ")[0] || "User"}! 👋
        </h1>
        <p className="text-muted-foreground text-lg">
          Here's what's happening with your customers today.
        </p>
      </div>

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        {/* Quick Stats / Actions */}
        <Card className="bg-gradient-to-br from-primary/10 to-primary/5 border-primary/20">
          <CardHeader className="pb-2">
            <CardTitle className="text-lg text-primary flex items-center gap-2">
              <TrendingUp className="h-5 w-5" />
              Quick Actions
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-col gap-3">
              <CreateTaskDialog
                customers={customers || []}
                trigger={
                  <Button className="w-full justify-start" size="lg">
                    <Plus className="mr-2 h-5 w-5" /> Create New Task
                  </Button>
                }
              />
              <Link href="/visits/new">
                <Button
                  variant="outline"
                  className="w-full justify-start"
                  size="lg"
                >
                  <ArrowRight className="mr-2 h-5 w-5" /> Log a Visit
                </Button>
              </Link>
            </div>
          </CardContent>
        </Card>

        {/* Pending Tasks Section */}
        <Card className="md:col-span-1 lg:col-span-1 flex flex-col">
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
                  <p>No pending tasks. You're all caught up!</p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Visits Today Section */}
        <Card className="md:col-span-2 lg:col-span-1 flex flex-col">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-lg font-bold flex items-center gap-2">
              <CalendarCheck className="h-5 w-5 text-blue-500" />
              Visits Today
            </CardTitle>
            <Link href="/visits">
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
