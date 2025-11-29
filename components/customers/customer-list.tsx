"use client";

import { useState } from "react";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  LayoutGrid,
  List,
  Filter,
  Search,
  MapPin,
  Phone,
  User,
} from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

interface CustomerListProps {
  initialCustomers: any[];
}

export default function CustomerList({ initialCustomers }: CustomerListProps) {
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");
  const [filterType, setFilterType] = useState<string>("All");
  const [filterCity, setFilterCity] = useState<string>("All");
  const [searchQuery, setSearchQuery] = useState("");

  // Get unique cities for filter
  const uniqueCities = Array.from(
    new Set(initialCustomers.map((c) => c.city).filter(Boolean))
  ).sort();

  const filteredCustomers = initialCustomers.filter((customer) => {
    const matchesType = filterType === "All" || customer.type === filterType;
    const matchesCity = filterCity === "All" || customer.city === filterCity;
    const matchesSearch =
      customer.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      customer.contact_person
        ?.toLowerCase()
        .includes(searchQuery.toLowerCase()) ||
      customer.city?.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesType && matchesCity && matchesSearch;
  });

  const getStageBadgeVariant = (stage: string) => {
    if (stage === "Closed - Converted") return "success";
    if (stage === "Closed - Not Converted") return "destructive";
    if (stage === "New Lead") return "info";
    if (stage === "Active") return "success";
    return "secondary";
  };

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      {/* Controls Bar */}
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between bg-card p-4 rounded-2xl border border-border/50 shadow-sm">
        <div className="flex flex-1 items-center gap-4">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search customers..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9 bg-background/50 border-border/50 focus:bg-background transition-colors"
            />
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <Filter className="h-4 w-4 text-muted-foreground hidden sm:block" />
            <Select value={filterType} onValueChange={setFilterType}>
              <SelectTrigger className="w-[160px] bg-background/50 border-border/50">
                <SelectValue placeholder="Filter by Type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="All">All Types</SelectItem>
                <SelectItem value="New Lead">New Lead</SelectItem>
                <SelectItem value="Professional">Professional</SelectItem>
                <SelectItem value="Site">Project Site</SelectItem>
              </SelectContent>
            </Select>
            <Select value={filterCity} onValueChange={setFilterCity}>
              <SelectTrigger className="w-[160px] bg-background/50 border-border/50">
                <SelectValue placeholder="Filter by City" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="All">All Cities</SelectItem>
                {uniqueCities.map((city) => (
                  <SelectItem key={city} value={city}>
                    {city}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="flex items-center gap-1 bg-secondary/50 p-1 rounded-lg self-start md:self-auto">
          <Button
            variant={viewMode === "grid" ? "default" : "ghost"}
            size="sm"
            onClick={() => setViewMode("grid")}
            className={cn("h-8 px-3", viewMode === "grid" ? "shadow-sm" : "")}
          >
            <LayoutGrid className="h-4 w-4 mr-2" /> Grid
          </Button>
          <Button
            variant={viewMode === "list" ? "default" : "ghost"}
            size="sm"
            onClick={() => setViewMode("list")}
            className={cn("h-8 px-3", viewMode === "list" ? "shadow-sm" : "")}
          >
            <List className="h-4 w-4 mr-2" /> List
          </Button>
        </div>
      </div>

      {/* Content */}
      {viewMode === "grid" ? (
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {filteredCustomers.map((customer) => (
            <Link
              key={customer.id}
              href={`/customers/${customer.id}`}
              className="group block h-full"
            >
              <Card className="h-full transition-all duration-300 hover:shadow-md hover:border-primary/30 group-hover:-translate-y-1">
                <CardHeader className="pb-3">
                  <div className="flex justify-between items-start gap-2">
                    <CardTitle className="text-lg group-hover:text-primary transition-colors line-clamp-1">
                      {customer.name}
                    </CardTitle>
                    <Badge
                      variant="outline"
                      className="shrink-0 text-[10px] uppercase tracking-wider"
                    >
                      {customer.type}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3 text-sm text-muted-foreground">
                    <div className="flex items-center gap-2">
                      <User className="h-4 w-4 text-primary/70" />
                      <span className="truncate">
                        {customer.contact_person || "No contact person"}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Phone className="h-4 w-4 text-primary/70" />
                      <span className="truncate">
                        {customer.phone || "No phone"}
                      </span>
                    </div>
                    <div className="flex items-start gap-2">
                      <MapPin className="h-4 w-4 text-primary/70 mt-0.5" />
                      <div className="flex-1 min-w-0">
                        <span className="line-clamp-1">
                          {customer.address || "No address"}
                        </span>
                        {customer.city && (
                          <span className="text-xs text-primary font-medium">
                            {customer.city}
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="pt-3 flex items-center justify-between border-t border-border/50 mt-3">
                      <span className="text-xs font-medium text-muted-foreground">
                        Current Stage
                      </span>
                      <Badge variant={getStageBadgeVariant(customer.stage)}>
                        {customer.stage}
                      </Badge>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      ) : (
        <div className="space-y-3">
          {filteredCustomers.map((customer) => (
            <Link
              key={customer.id}
              href={`/customers/${customer.id}`}
              className="block group"
            >
              <div className="flex flex-col sm:flex-row sm:items-center justify-between p-4 rounded-xl border border-border/50 bg-card hover:bg-accent/30 hover:border-primary/20 transition-all duration-200 shadow-sm">
                <div className="flex-1 min-w-0 mb-3 sm:mb-0">
                  <div className="flex items-center gap-3 mb-1">
                    <h3 className="font-heading font-semibold text-lg text-foreground group-hover:text-primary transition-colors truncate">
                      {customer.name}
                    </h3>
                    <Badge
                      variant="outline"
                      className="text-[10px] uppercase tracking-wider"
                    >
                      {customer.type}
                    </Badge>
                  </div>
                  <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted-foreground">
                    <span className="flex items-center gap-1">
                      <User className="h-3.5 w-3.5" /> {customer.contact_person}
                    </span>
                    <span className="flex items-center gap-1">
                      <Phone className="h-3.5 w-3.5" /> {customer.phone}
                    </span>
                  </div>
                </div>

                <div className="flex items-center justify-between sm:justify-end gap-4 sm:gap-6 min-w-0">
                  <div className="text-sm text-muted-foreground truncate max-w-[200px] hidden md:block">
                    <div className="flex items-center gap-1">
                      <MapPin className="h-3.5 w-3.5 flex-shrink-0" />
                      <span className="truncate">{customer.address}</span>
                    </div>
                    {customer.city && (
                      <span className="text-xs text-primary font-medium ml-5">
                        {customer.city}
                      </span>
                    )}
                  </div>
                  <Badge
                    variant={getStageBadgeVariant(customer.stage)}
                    className="shrink-0"
                  >
                    {customer.stage}
                  </Badge>
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}

      {filteredCustomers.length === 0 && (
        <div className="text-center py-12">
          <div className="inline-flex h-12 w-12 items-center justify-center rounded-full bg-muted mb-4">
            <Search className="h-6 w-6 text-muted-foreground" />
          </div>
          <h3 className="text-lg font-medium">No customers found</h3>
          <p className="text-muted-foreground">
            Try adjusting your search or filters.
          </p>
        </div>
      )}
    </div>
  );
}
