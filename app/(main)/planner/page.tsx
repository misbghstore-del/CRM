"use client";

import { useState, useEffect, useCallback } from "react";
import { createClient } from "@/utils/supabase/client";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Plus, Calendar as CalendarIcon, Search, Clock } from "lucide-react";
import CreateTaskDialog from "@/components/tasks/create-task-dialog";
import CustomerHistoryDialog from "@/components/customers/customer-history-dialog";
import { getTasks } from "@/app/actions/tasks";
import { useRouter } from "next/navigation";
import { cn } from "@/lib/utils";

interface Customer {
  id: string;
  name: string;
  address: string | null;
}

interface PlannedVisit {
  id: string;
  customer_id: string | null;
  customers: {
    name: string;
  } | null;
  priority: string;
  description: string;
}

export default function PlannerPage() {
  const [date, setDate] = useState<string>(
    new Date().toISOString().split("T")[0]
  );
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [plannedVisits, setPlannedVisits] = useState<PlannedVisit[]>([]);
  const router = useRouter();

  const fetchTasks = useCallback(async () => {
    const tasks = await getTasks(date);
    setPlannedVisits(tasks);
    router.refresh();
  }, [date, router]);

  useEffect(() => {
    const fetchData = async () => {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return;

      // Fetch Customers
      const { data: customersData } = await supabase
        .from("customers")
        .select("*")
        .eq("assigned_to", user.id)
        .order("name");

      if (customersData) setCustomers(customersData);

      // Fetch Planned Visits
      await fetchTasks();
    };
    fetchData();
  }, [date, fetchTasks]);

  const filteredCustomers = customers.filter((c) =>
    c.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="space-y-4 md:space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex flex-col gap-2">
        <h1 className="text-2xl md:text-3xl font-heading font-bold tracking-tight text-foreground">
          Visit Planner
        </h1>
        <p className="text-muted-foreground text-sm md:text-lg">
          Plan your route and manage your customer visits.
        </p>
      </div>

      {/* Mobile: Stack vertically, Desktop: Side by side */}
      <div className="flex flex-col md:grid md:gap-6 md:grid-cols-12 gap-4">
        {/* Left Column: Date & Customers */}
        <div className="md:col-span-5 lg:col-span-4 flex flex-col gap-4 md:gap-6">
          <Card className="flex-shrink-0">
            <CardHeader className="p-4 md:p-6">
              <CardTitle className="text-base md:text-lg">
                Select Date
              </CardTitle>
            </CardHeader>
            <CardContent className="p-4 pt-0 md:p-6 md:pt-0">
              <div className="relative">
                <Input
                  type="date"
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  className="w-full pl-10 h-10 md:h-12 text-base md:text-lg"
                />
                <CalendarIcon className="absolute left-3 top-2.5 md:top-3.5 h-4 md:h-5 w-4 md:w-5 text-muted-foreground" />
              </div>
            </CardContent>
          </Card>

          <Card className="flex flex-col max-h-[400px] md:max-h-[calc(100vh-20rem)]">
            <CardHeader className="p-4 pb-2 md:p-6 md:pb-4">
              <CardTitle className="text-base md:text-lg flex items-center justify-between">
                <span>Customers</span>
                <span className="text-xs md:text-sm font-normal text-muted-foreground bg-secondary px-2 py-1 rounded-full">
                  {filteredCustomers.length}
                </span>
              </CardTitle>
              <div className="relative mt-2">
                <Search className="absolute left-3 top-2.5 md:top-3 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search customers..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9 h-9 md:h-10 text-sm md:text-base"
                />
              </div>
            </CardHeader>
            <CardContent className="flex-1 overflow-y-auto px-3 md:px-6 pr-1 md:pr-2 custom-scrollbar pb-4 md:pb-6">
              <div className="space-y-2 md:space-y-3">
                {filteredCustomers.map((customer) => (
                  <div
                    key={customer.id}
                    className="group flex items-center justify-between rounded-md border border-input bg-background px-3 h-9 md:h-10 shadow-sm transition-all hover:bg-accent hover:text-accent-foreground w-[90%] mx-auto"
                  >
                    <div className="flex items-center gap-2 min-w-0 flex-1 pr-2">
                      <span
                        className="font-medium text-sm md:text-base truncate"
                        title={customer.name}
                      >
                        {customer.name}
                      </span>
                      {customer.address && (
                        <span
                          className="hidden sm:inline text-xs text-muted-foreground truncate max-w-[150px]"
                          title={customer.address}
                        >
                          {customer.address}
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-1 md:opacity-0 md:group-hover:opacity-100 transition-opacity flex-shrink-0">
                      <CustomerHistoryDialog
                        customerId={customer.id}
                        customerName={customer.name}
                        trigger={
                          <Button
                            size="icon-sm"
                            variant="ghost"
                            className="h-6 w-6 md:h-7 md:w-7 rounded-full"
                          >
                            <svg
                              xmlns="http://www.w3.org/2000/svg"
                              width="16"
                              height="16"
                              viewBox="0 0 24 24"
                              fill="none"
                              stroke="currentColor"
                              strokeWidth="2"
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              className="h-3 w-3 md:h-3.5 md:w-3.5"
                            >
                              <circle cx="12" cy="12" r="10" />
                              <polyline points="12 6 12 12 16 14" />
                            </svg>
                          </Button>
                        }
                      />
                      <CreateTaskDialog
                        customerId={customer.id}
                        customerName={customer.name}
                        onSuccess={fetchTasks}
                        defaultDate={date}
                        trigger={
                          <Button
                            size="icon-sm"
                            variant="default"
                            className="h-6 w-6 md:h-7 md:w-7 rounded-full shadow-none"
                          >
                            <Plus className="h-3 w-3 md:h-3.5 md:w-3.5" />
                          </Button>
                        }
                      />
                    </div>
                  </div>
                ))}
                {filteredCustomers.length === 0 && (
                  <div className="text-center py-8 text-sm md:text-base text-muted-foreground">
                    No customers found.
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Right Column: Planned Visits */}
        <div className="md:col-span-7 lg:col-span-8">
          <Card className="bg-muted/30 border-dashed max-h-[500px] md:max-h-[calc(100vh-12rem)] flex flex-col">
            <CardHeader className="p-4 md:p-6">
              <CardTitle className="text-lg md:text-xl text-primary flex flex-col sm:flex-row sm:items-center gap-2">
                <div className="flex items-center gap-2">
                  <CalendarIcon className="h-4 md:h-5 w-4 md:w-5" />
                  <span className="text-base md:text-xl">Planned for</span>
                </div>
                <span className="text-sm md:text-xl font-medium">
                  {(() => {
                    const d = new Date(date);
                    const weekdays = [
                      "Sunday",
                      "Monday",
                      "Tuesday",
                      "Wednesday",
                      "Thursday",
                      "Friday",
                      "Saturday",
                    ];
                    const months = [
                      "January",
                      "February",
                      "March",
                      "April",
                      "May",
                      "June",
                      "July",
                      "August",
                      "September",
                      "October",
                      "November",
                      "December",
                    ];
                    return `${weekdays[d.getDay()]} ${d.getDate()} ${
                      months[d.getMonth()]
                    } ${d.getFullYear()}`;
                  })()}
                </span>
              </CardTitle>
              <CardDescription className="text-xs md:text-sm">
                {plannedVisits.length} visits scheduled
              </CardDescription>
            </CardHeader>
            <CardContent className="flex-1 overflow-y-auto overflow-x-hidden custom-scrollbar px-4 md:px-6 pb-4 md:pb-6">
              <div className="space-y-3 md:space-y-4">
                {plannedVisits.length > 0 ? (
                  plannedVisits.map((visit, index) => (
                    <div key={visit.id} className="relative pl-6 md:pl-8 group">
                      {/* Timeline Line */}
                      {index !== plannedVisits.length - 1 && (
                        <div className="absolute left-[9px] md:left-[11px] top-8 bottom-[-12px] md:bottom-[-16px] w-[2px] bg-border group-hover:bg-primary/30 transition-colors" />
                      )}

                      {/* Timeline Dot */}
                      <div className="absolute left-0 top-2.5 md:top-3 h-5 w-5 md:h-6 md:w-6 rounded-full border-2 border-primary bg-background z-10 flex items-center justify-center">
                        <div className="h-1.5 w-1.5 md:h-2 md:w-2 rounded-full bg-primary" />
                      </div>

                      <div
                        className="flex flex-col gap-3 md:gap-4 rounded-2xl border border-border bg-card p-3 md:p-4 shadow-sm transition-all hover:shadow-md hover:border-primary/50 cursor-pointer group/card"
                        onClick={() => {
                          if (visit.customer_id) {
                            router.push(
                              `/visits/new?customerId=${visit.customer_id}&taskId=${visit.id}`
                            );
                          }
                        }}
                      >
                        <div className="space-y-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <h4 className="font-bold text-base md:text-lg text-foreground group-hover/card:text-primary transition-colors">
                              {visit.customers?.name || "Unknown Customer"}
                            </h4>
                            <span
                              className={cn(
                                "text-xs px-2 py-0.5 rounded-full font-medium border",
                                visit.priority === "High"
                                  ? "bg-red-50 text-red-700 border-red-200 dark:bg-red-900/20 dark:text-red-300 dark:border-red-800"
                                  : "bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-900/20 dark:text-blue-300 dark:border-blue-800"
                              )}
                            >
                              {visit.priority}
                            </span>
                          </div>
                          <p className="text-xs md:text-sm text-muted-foreground flex items-center gap-2">
                            <Clock className="h-3 md:h-3.5 w-3 md:w-3.5 flex-shrink-0" />
                            <span className="line-clamp-2">
                              {visit.description}
                            </span>
                          </p>
                        </div>

                        <Button
                          variant="ghost"
                          size="sm"
                          className="self-start w-full sm:w-auto opacity-0 group-hover/card:opacity-100 transition-opacity text-xs md:text-sm"
                        >
                          Start Visit
                        </Button>
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="flex flex-col items-center justify-center text-center text-muted-foreground py-8 md:py-12">
                    <div className="h-12 w-12 md:h-16 md:w-16 rounded-full bg-muted flex items-center justify-center mb-4">
                      <CalendarIcon className="h-6 w-6 md:h-8 md:w-8 opacity-50" />
                    </div>
                    <h3 className="text-base md:text-lg font-medium text-foreground">
                      No visits planned
                    </h3>
                    <p className="text-xs md:text-sm">
                      Select a customer from the left to schedule a visit.
                    </p>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
