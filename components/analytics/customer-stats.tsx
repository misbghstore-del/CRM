"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useEffect, useState } from "react";
import { getCustomerStats } from "@/app/actions/analytics";
import { Loader2, Users, TrendingUp } from "lucide-react";

export default function CustomerStats() {
  const [stats, setStats] = useState<{ total: number; growth: number } | null>(
    null
  );
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      const data = await getCustomerStats();
      setStats(data);
      setLoading(false);
    };
    fetchData();
  }, []);

  if (loading) {
    return (
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Total Customers</CardTitle>
          <Users className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-blue-950/20 dark:to-indigo-950/20 border-blue-200 dark:border-blue-800">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium text-blue-700 dark:text-blue-300">
          Total Customers
        </CardTitle>
        <Users className="h-4 w-4 text-blue-500" />
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold text-blue-900 dark:text-blue-100">
          {stats?.total}
        </div>
        <p className="text-xs text-blue-600/80 dark:text-blue-400 flex items-center gap-1 mt-1">
          <TrendingUp className="h-3 w-3" />
          <span className="font-medium">+{stats?.growth}</span>
          <span>in last 30 days</span>
        </p>
      </CardContent>
    </Card>
  );
}
