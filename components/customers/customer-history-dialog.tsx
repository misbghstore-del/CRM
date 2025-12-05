"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { getVisitsByCustomer } from "@/app/actions/visits";
import { Loader2, Calendar, MapPin } from "lucide-react";

interface CustomerHistoryDialogProps {
  customerId: string;
  customerName: string;
  trigger?: React.ReactNode;
}

interface VisitHistoryItem {
  id: string;
  date: string;
  outcome: string;
  purpose: string;
  notes?: string;
  location_lat?: number;
}

export default function CustomerHistoryDialog({
  customerId,
  customerName,
  trigger,
}: CustomerHistoryDialogProps) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [visits, setVisits] = useState<VisitHistoryItem[]>([]);

  useEffect(() => {
    if (open) {
      const fetchVisits = async () => {
        setLoading(true);
        const data = await getVisitsByCustomer(customerId);
        setVisits(data);
        setLoading(false);
      };
      fetchVisits();
    }
  }, [open, customerId]);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger || (
          <Button
            variant="link"
            className="p-0 h-auto font-medium text-foreground hover:underline"
          >
            {customerName}
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="sm:max-w-[600px]">
        <DialogHeader>
          <DialogTitle>{customerName} - Visit History</DialogTitle>
          <DialogDescription>Past visits and interactions.</DialogDescription>
        </DialogHeader>
        <ScrollArea className="h-[400px] w-full rounded-md border p-4">
          {loading ? (
            <div className="flex justify-center items-center h-full">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : visits.length > 0 ? (
            <div className="space-y-4">
              {visits.map((visit) => (
                <div
                  key={visit.id}
                  className="flex flex-col gap-2 rounded-lg border p-3 text-sm"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 font-semibold text-lime-600">
                      <Calendar className="h-4 w-4" />
                      {new Date(visit.date).toLocaleDateString()}
                    </div>
                    <span
                      className={`px-2 py-0.5 rounded-full text-xs ${
                        visit.outcome === "Successful"
                          ? "bg-green-100 text-green-700"
                          : visit.outcome === "Closed"
                          ? "bg-blue-100 text-blue-700"
                          : "bg-gray-100 text-gray-700"
                      }`}
                    >
                      {visit.outcome}
                    </span>
                  </div>
                  <div className="grid gap-1">
                    <div className="text-muted-foreground">
                      <span className="font-medium text-foreground">
                        Purpose:{" "}
                      </span>
                      {visit.purpose}
                    </div>
                    {visit.notes && (
                      <div className="text-muted-foreground">
                        <span className="font-medium text-foreground">
                          Notes:{" "}
                        </span>
                        {visit.notes}
                      </div>
                    )}
                    {visit.location_lat && (
                      <div className="flex items-center gap-1 text-xs text-muted-foreground mt-1">
                        <MapPin className="h-3 w-3" />
                        Location Logged
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center text-muted-foreground py-8">
              No visit history found.
            </div>
          )}
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}
