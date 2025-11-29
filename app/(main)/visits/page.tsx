"use client";

import { useState, useEffect, useMemo } from "react";
import { createClient } from "@/utils/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Calendar } from "lucide-react";

export default function VisitsPage() {
  const [visits, setVisits] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedBDM, setSelectedBDM] = useState<string>("all");
  const [selectedCustomer, setSelectedCustomer] = useState<string>("all");
  const [startDate, setStartDate] = useState<string>("");
  const [endDate, setEndDate] = useState<string>("");
  const supabase = createClient();

  useEffect(() => {
    const fetchVisits = async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return;

      const { data } = await supabase
        .from("visits")
        .select("*, customers(name), profiles(full_name)")
        .order("timestamp", { ascending: false });

      if (data) setVisits(data);
      setLoading(false);
    };
    fetchVisits();
  }, []);

  // Get unique BDMs and Customers for filter dropdowns
  const uniqueBDMs = useMemo(() => {
    const bdms = visits
      .map((v) => ({ id: v.bdm_id, name: v.profiles?.full_name }))
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
      // BDM filter
      if (selectedBDM !== "all" && visit.bdm_id !== selectedBDM) {
        return false;
      }

      // Customer filter
      if (
        selectedCustomer !== "all" &&
        visit.customer_id !== selectedCustomer
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
  }, [visits, selectedBDM, selectedCustomer, startDate, endDate]);

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
              <Select value={selectedBDM} onValueChange={setSelectedBDM}>
                <SelectTrigger className="bg-background">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All BDMs</SelectItem>
                  {uniqueBDMs.map((bdm, index) => (
                    <SelectItem key={`${bdm.id}-${index}`} value={bdm.id}>
                      {bdm.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label className="text-muted-foreground">
                Filter by Customer
              </Label>
              <Select
                value={selectedCustomer}
                onValueChange={setSelectedCustomer}
              >
                <SelectTrigger className="bg-background">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Customers</SelectItem>
                  {uniqueCustomers.map((customer, index) => (
                    <SelectItem
                      key={`${customer.id}-${index}`}
                      value={customer.id}
                    >
                      {customer.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label className="text-muted-foreground">Start Date</Label>
              <div className="relative">
                <Input
                  type="date"
                  className="bg-background pl-10"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                />
                <Calendar className="absolute left-3 top-2.5 h-5 w-5 text-muted-foreground" />
              </div>
            </div>
            <div className="space-y-2">
              <Label className="text-muted-foreground">End Date</Label>
              <div className="relative">
                <Input
                  type="date"
                  className="bg-background pl-10"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                />
                <Calendar className="absolute left-3 top-2.5 h-5 w-5 text-muted-foreground" />
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
                            {new Date(visit.timestamp).toLocaleString()}
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
