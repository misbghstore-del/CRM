"use client";

import { useState, useEffect, use } from "react";
import { createClient } from "@/utils/supabase/client";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  CheckCircle2,
  Phone,
  MapPin,
  User,
  ArrowLeft,
  Loader2,
  Plus,
  Minus,
} from "lucide-react";
import EditCustomerDialog from "@/components/customers/edit-customer-dialog";
import Link from "next/link";
import { updateCustomerStage } from "@/app/actions/customers";
import { useRouter } from "next/navigation";

const PIPELINE_STAGES = [
  "New Lead",
  "Validity Check",
  "1st Meeting Done",
  "Customer Visit/Demo",
  "Proposal",
  "Negotiation",
  "Closed",
];

interface Customer {
  id: string;
  name: string;
  type: string;
  address?: string;
  stage: string;
  meeting_count?: number;
  contact_person?: string;
  phone?: string;
  created_at: string;
  last_edited_at: string;
  created_by_profile?: { full_name: string };
  last_edited_by_profile?: { full_name: string };
}

export default function CustomerDetailsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const [customer, setCustomer] = useState<Customer | null>(null);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState(false);
  const router = useRouter();

  useEffect(() => {
    const fetchCustomer = async () => {
      const supabase = createClient();
      const { data } = await supabase
        .from("customers")
        .select(
          `
          *,
          created_by_profile:profiles!created_by(full_name),
          last_edited_by_profile:profiles!last_edited_by(full_name)
        `
        )
        .eq("id", id)
        .single();

      if (data) {
        setCustomer(data);
      }
      setLoading(false);
    };
    fetchCustomer();
  }, [id]);

  const handleStageChange = async (newStage: string) => {
    if (!customer) return;
    setUpdating(true);
    // Optimistic update
    const oldStage = customer.stage;
    setCustomer({ ...customer, stage: newStage });

    const result = await updateCustomerStage(customer.id, newStage);

    if (result?.error) {
      alert(result.error);
      setCustomer({ ...customer, stage: oldStage }); // Revert
    } else {
      router.refresh();
    }
    setUpdating(false);
  };

  const handleMeetingCountChange = async (increment: boolean) => {
    if (!customer) return;
    const newCount = Math.max(
      0,
      (customer.meeting_count || 0) + (increment ? 1 : -1)
    );
    setUpdating(true);
    setCustomer({ ...customer, meeting_count: newCount });

    const result = await updateCustomerStage(
      customer.id,
      customer.stage,
      newCount
    );

    if (result?.error) {
      alert(result.error);
    }
    setUpdating(false);
  };

  const handleClosing = async (status: "Converted" | "Not Converted") => {
    if (!customer) return;
    setUpdating(true);
    const result = await updateCustomerStage(
      customer.id,
      "Closed",
      undefined,
      status
    );

    if (result?.error) {
      alert(result.error);
    } else {
      setCustomer({ ...customer, stage: `Closed - ${status}` });
      router.refresh();
    }
    setUpdating(false);
  };

  if (loading) {
    return (
      <div className="flex justify-center p-8">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!customer) {
    return <div className="p-8 text-center">Customer not found</div>;
  }

  const currentStageIndex = PIPELINE_STAGES.findIndex((s) =>
    customer.stage?.startsWith(s)
  );
  const isClosed = customer.stage?.startsWith("Closed");

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Link href="/customers">
          <Button variant="ghost" size="icon">
            <ArrowLeft className="h-4 w-4" />
          </Button>
        </Link>
        <div>
          <h1 className="text-3xl font-bold tracking-tight">{customer.name}</h1>
          <div className="flex items-center gap-2 text-muted-foreground">
            <Badge variant="outline">{customer.type}</Badge>
            <span>•</span>
            <span>{customer.address}</span>
          </div>
          <div className="flex flex-col items-end gap-2">
            <div className="text-xs text-muted-foreground text-right">
              {customer.created_by_profile && (
                <div>
                  Created by {customer.created_by_profile.full_name} on{" "}
                  {new Date(customer.created_at).toLocaleDateString()}
                </div>
              )}
              {customer.last_edited_by_profile && (
                <div>
                  Last edited by {customer.last_edited_by_profile.full_name} on{" "}
                  {new Date(customer.last_edited_at).toLocaleDateString()}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-3">
        {/* Main Info */}
        <Card className="md:col-span-2">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle>Contact Information</CardTitle>
            <EditCustomerDialog
              customer={customer}
              onSuccess={() => router.refresh()}
              trigger={
                <Button variant="default" size="sm">
                  Edit Details
                </Button>
              }
            />
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center gap-3">
              <User className="h-5 w-5 text-muted-foreground" />
              <div>
                <p className="font-medium">Contact Person</p>
                <p className="text-sm text-muted-foreground">
                  {customer.contact_person || "-"}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <Phone className="h-5 w-5 text-muted-foreground" />
              <div>
                <p className="font-medium">Phone</p>
                <p className="text-sm text-muted-foreground">
                  {customer.phone || "-"}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <MapPin className="h-5 w-5 text-muted-foreground" />
              <div>
                <p className="font-medium">Address</p>
                <p className="text-sm text-muted-foreground">
                  {customer.address || "-"}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Pipeline / Status */}
        <Card>
          <CardHeader>
            <CardTitle>Status & Pipeline</CardTitle>
            <CardDescription>
              Current stage in the sales process
            </CardDescription>
          </CardHeader>
          <CardContent>
            {customer.type === "New Lead" ? (
              <div className="space-y-6">
                <div className="relative border-l-2 border-muted pl-6 space-y-6">
                  {PIPELINE_STAGES.map((stage, index) => {
                    const isActive = currentStageIndex === index;
                    const isCompleted = currentStageIndex > index;
                    const isClosedStage = stage === "Closed";

                    return (
                      <div key={stage} className="relative">
                        <div
                          className={`absolute -left-[29px] top-1 h-3 w-3 rounded-full border-2 ${
                            isActive || isCompleted
                              ? "border-primary bg-primary"
                              : "border-muted bg-background"
                          }`}
                        />

                        <div className="flex flex-col gap-1">
                          <span
                            className={`text-sm font-medium ${
                              isActive
                                ? "text-primary"
                                : "text-muted-foreground"
                            }`}
                          >
                            {stage}
                          </span>

                          {isActive && !isClosed && (
                            <div className="mt-2">
                              {stage === "1st Meeting Done" && (
                                <div className="mb-3 flex items-center gap-3 rounded-lg border p-2 bg-muted/50">
                                  <span className="text-xs font-medium">
                                    Meetings:
                                  </span>
                                  <div className="flex items-center gap-2">
                                    <Button
                                      size="icon"
                                      variant="outline"
                                      className="h-6 w-6"
                                      onClick={() =>
                                        handleMeetingCountChange(false)
                                      }
                                    >
                                      <Minus className="h-3 w-3" />
                                    </Button>
                                    <span className="text-sm font-bold w-4 text-center">
                                      {customer.meeting_count || 0}
                                    </span>
                                    <Button
                                      size="icon"
                                      variant="outline"
                                      className="h-6 w-6"
                                      onClick={() =>
                                        handleMeetingCountChange(true)
                                      }
                                    >
                                      <Plus className="h-3 w-3" />
                                    </Button>
                                  </div>
                                </div>
                              )}

                              {stage === "Negotiation" && (
                                <p className="text-xs text-muted-foreground mb-2">
                                  Negotiations can happen multiple times. Keep
                                  logging visits/tasks.
                                </p>
                              )}

                              <div className="flex gap-2">
                                {index < PIPELINE_STAGES.length - 1 && (
                                  <Button
                                    size="sm"
                                    onClick={() =>
                                      handleStageChange(
                                        PIPELINE_STAGES[index + 1]
                                      )
                                    }
                                    disabled={updating}
                                  >
                                    Next Stage
                                  </Button>
                                )}
                              </div>
                            </div>
                          )}

                          {isClosedStage && isActive && (
                            <div className="mt-2 flex flex-col gap-2">
                              <div className="font-medium text-sm mb-1">
                                Final Outcome:
                              </div>
                              {customer.stage === "Closed" ? (
                                <div className="flex gap-2">
                                  <Button
                                    size="sm"
                                    variant="default"
                                    className="bg-green-600 hover:bg-green-700"
                                    onClick={() => handleClosing("Converted")}
                                  >
                                    Converted
                                  </Button>
                                  <Button
                                    size="sm"
                                    variant="destructive"
                                    onClick={() =>
                                      handleClosing("Not Converted")
                                    }
                                  >
                                    Not Converted
                                  </Button>
                                </div>
                              ) : (
                                <Badge
                                  variant={
                                    customer.stage.includes("Converted") &&
                                    !customer.stage.includes("Not")
                                      ? "default"
                                      : "destructive"
                                  }
                                >
                                  {customer.stage}
                                </Badge>
                              )}
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center py-8 text-center">
                <CheckCircle2 className="h-12 w-12 text-green-500 mb-4" />
                <h3 className="text-lg font-medium">Active Professional</h3>
                <p className="text-sm text-muted-foreground mt-2">
                  This customer is a professional partner. Standard visit and
                  task logging applies.
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
