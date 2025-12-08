"use client";

import { useState, useEffect, useMemo } from "react";
import { createClient } from "@/utils/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Calendar, Search } from "lucide-react";
import DateDisplay from "@/components/ui/date-display";

interface Visit {
  id: string;
  timestamp: string;
  user_id: string;
  customer_id: string;
  purpose: string;
  outcome: string;
  notes: string;
  photo_url?: string;
  customers?: { name: string };
  profiles?: { full_name: string };
}

export default function VisitsPage() {
  const [visits, setVisits] = useState<Visit[]>([]);
  const [loading, setLoading] = useState(true);
  const [bdmSearch, setBdmSearch] = useState<string>("");
  const [customerSearch, setCustomerSearch] = useState<string>("");
  const [startDate, setStartDate] = useState<string>("");
  const [endDate, setEndDate] = useState<string>("");

  useEffect(() => {
    const fetchVisits = async () => {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return;

      // Get user profile to check role
      const { data: profile } = await supabase
        .from("profiles")
        .select("role")
        .eq("id", user.id)
        .single();

      let query = supabase
        .from("visits")
        .select("*, customers(name), profiles(full_name)")
        .order("timestamp", { ascending: false });

      // If not admin, only show own visits
      if (profile?.role !== "admin") {
        query = query.eq("user_id", user.id);
      }

      const { data } = await query;

      if (data) setVisits(data);
      setLoading(false);
    };
    fetchVisits();
  }, []);

  // Get unique BDMs and Customers for filter dropdowns
  const uniqueBDMs = useMemo(() => {
    const bdms = visits
      .map((v) => ({ id: v.user_id, name: v.profiles?.full_name }))
      .filter(
        (v, i, arr) => v.name && arr.findIndex((t) => t.id === v.id) === i
      );
    return bdms;
  }, [visits]);

  const uniqueCustomers = useMemo(() => {
    const customers = visits
      .map((v) => ({ id: v.customer_id, name: v.customers?.name }))
      .filter(
        (v, i, arr) => v.name && arr.findIndex((t) => t.id === v.id) === i
      );
    return customers;
  }, [visits]);

  // Filter visits based on selected filters
  const filteredVisits = useMemo(() => {
    return visits.filter((visit) => {
      // BDM filter - search by name
      if (
        bdmSearch &&
        !visit.profiles?.full_name
          ?.toLowerCase()
          .includes(bdmSearch.toLowerCase())
      ) {
        return false;
      }

      // Customer filter - search by name
      if (
        customerSearch &&
        !visit.customers?.name
          ?.toLowerCase()
          .includes(customerSearch.toLowerCase())
      ) {
        return false;
      }

      // Start date filter
      if (startDate && new Date(visit.timestamp) < new Date(startDate)) {
        return false;
      }

      // End date filter
      if (
        endDate &&
        new Date(visit.timestamp) > new Date(endDate + "T23:59:59")
      ) {
        return false;
      }

      return true;
    });
  }, [visits, bdmSearch, customerSearch, startDate, endDate]);

  return (
    <div className="space-y-6">
      <Card className="rounded-3xl border-none shadow-sm ring-1 ring-border">
        <CardHeader>
          <CardTitle className="text-2xl font-bold text-primary">
            All Visit Logs
          </CardTitle>
        </CardHeader>
        <CardContent>
          {/* Filters */}
          <div className="mb-8 grid gap-4 grid-cols-1 sm:grid-cols-2 md:grid-cols-4">
            <div className="space-y-2">
              <Label className="text-muted-foreground">Filter by BDM</Label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search BDM name..."
                  value={bdmSearch}
                  onChange={(e) => setBdmSearch(e.target.value)}
                  className="bg-background pl-10 !h-12 rounded-xl border-border/50 shadow-sm w-full"
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label className="text-muted-foreground">
                Filter by Customer
              </Label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search customer name..."
                  value={customerSearch}
                  onChange={(e) => setCustomerSearch(e.target.value)}
                  className="bg-background pl-10 !h-12 rounded-xl border-border/50 shadow-sm w-full"
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label className="text-muted-foreground">Start Date</Label>
              <div className="relative">
                <Input
                  type="date"
                  className="bg-background pl-10 !h-12 rounded-xl border-border/50 shadow-sm w-full"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                />
                <Calendar className="absolute left-3 top-3.5 h-5 w-5 text-muted-foreground" />
              </div>
            </div>
            <div className="space-y-2">
              <Label className="text-muted-foreground">End Date</Label>
              <div className="relative">
                <Input
                  type="date"
                  className="bg-background pl-10 !h-12 rounded-xl border-border/50 shadow-sm w-full"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                />
                <Calendar className="absolute left-3 top-3.5 h-5 w-5 text-muted-foreground" />
              </div>
            </div>
          </div>

          {/* Table with horizontal scroll on mobile */}
          <div className="overflow-x-auto -mx-4 sm:mx-0">
            <div className="inline-block min-w-full align-middle">
              <div className="overflow-hidden rounded-lg border border-border">
                <table className="min-w-full text-left text-sm">
                  <thead className="bg-muted text-muted-foreground">
                    <tr>
                      <th className="px-4 py-3 font-medium whitespace-nowrap">
                        Timestamp
                      </th>
                      <th className="px-4 py-3 font-medium whitespace-nowrap">
                        Customer
                      </th>
                      <th className="px-4 py-3 font-medium whitespace-nowrap">
                        BDM
                      </th>
                      <th className="px-4 py-3 font-medium whitespace-nowrap">
                        Purpose
                      </th>
                      <th className="px-4 py-3 font-medium whitespace-nowrap">
                        Outcome
                      </th>
                      <th className="px-4 py-3 font-medium whitespace-nowrap">
                        Notes
                      </th>
                      <th className="px-4 py-3 font-medium whitespace-nowrap">
                        Files
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border bg-card">
                    {loading ? (
                      <tr>
                        <td colSpan={7} className="p-4 text-center">
                          Loading...
                        </td>
                      </tr>
                    ) : filteredVisits.length > 0 ? (
                      filteredVisits.map((visit) => (
                        <tr key={visit.id} className="hover:bg-muted/50">
                          <td className="px-4 py-3 text-muted-foreground whitespace-nowrap">
                            <DateDisplay timestamp={visit.timestamp} />
                          </td>
                          <td className="px-4 py-3 font-medium text-foreground whitespace-nowrap">
                            {visit.customers?.name}
                          </td>
                          <td className="px-4 py-3 text-muted-foreground whitespace-nowrap">
                            {visit.profiles?.full_name || "Unknown"}
                          </td>
                          <td className="px-4 py-3 text-muted-foreground whitespace-nowrap">
                            {visit.purpose}
                          </td>
                          <td className="px-4 py-3 text-muted-foreground whitespace-nowrap">
                            {visit.outcome}
                          </td>
                          <td className="px-4 py-3 text-muted-foreground max-w-[200px] truncate">
                            {visit.notes}
                          </td>
                          <td className="px-4 py-3 text-muted-foreground whitespace-nowrap">
                            {visit.photo_url && (
                              <a
                                href={visit.photo_url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-primary hover:underline"
                              >
                                View
                              </a>
                            )}
                          </td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td
                          colSpan={7}
                          className="px-4 py-8 text-center text-muted-foreground bg-muted/20"
                        >
                          No visits found matching your filters.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
