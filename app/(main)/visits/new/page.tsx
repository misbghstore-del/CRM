"use client";

import { useEffect, useState, Suspense } from "react";
import { createClient } from "@/utils/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import {
  Loader2,
  Plus,
  Check,
  MapPin,
  User as UserIcon,
  Phone,
  Calendar,
  ArrowRight,
  CloudUpload,
} from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { createVisit } from "@/app/actions/visits";
import AddCustomerDialog from "@/components/customers/add-customer-dialog";
import EditCustomerDialog from "@/components/customers/edit-customer-dialog";

import ReactSelect from "react-select";
import { Badge } from "@/components/ui/badge";

const PIPELINE_STAGES = [
  "New Lead",
  "Validity Check",
  "1st Meeting Done",
  "Customer Visit/Demo",
  "Proposal",
  "Negotiation",
  "Closed",
];

import { User } from "@supabase/supabase-js";

interface Customer {
  id: string;
  name: string;
  phone: string | null;
  stage: string;
  type: string;
  contact_person?: string;
  address?: string;
  assigned_to?: string;
}

function NewVisitForm() {
  const [loading, setLoading] = useState(false);
  const [location, setLocation] = useState<{ lat: number; lng: number } | null>(
    null
  );
  const [locationName, setLocationName] = useState<string>("");
  const [locationError, setLocationError] = useState<string | null>(null);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [user, setUser] = useState<User | null>(null);
  const [selectedCustomer, setSelectedCustomer] = useState<string>("");
  const [currentStage, setCurrentStage] = useState<string>("");
  const [customerType, setCustomerType] = useState<string>("");
  const [customerDetails, setCustomerDetails] = useState<Customer | null>(null);

  const [taskId, setTaskId] = useState<string | null>(null);
  const [fileName, setFileName] = useState<string | null>(null);

  const router = useRouter();
  const searchParams = useSearchParams();

  const fetchLocation = () => {
    setLocationError(null);
    if ("geolocation" in navigator) {
      navigator.geolocation.getCurrentPosition(
        async (position) => {
          const lat = position.coords.latitude;
          const lng = position.coords.longitude;

          setLocation({ lat, lng });

          try {
            const response = await fetch(
              `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&zoom=18&addressdetails=1`,
              {
                headers: { "User-Agent": "CRM-App/1.0" },
                signal: AbortSignal.timeout(5000),
              }
            );

            if (response.ok) {
              const data = await response.json();
              const address = data.address;
              const parts = [];
              if (address.road) parts.push(address.road);
              if (address.suburb || address.neighbourhood)
                parts.push(address.suburb || address.neighbourhood);
              if (address.city || address.town || address.village)
                parts.push(address.city || address.town || address.village);
              if (address.state) parts.push(address.state);

              const placeName =
                parts.length > 0 ? parts.join(", ") : data.display_name;
              setLocationName(placeName);
            } else {
              setLocationName(`${lat.toFixed(6)}, ${lng.toFixed(6)}`);
            }
          } catch (error) {
            console.warn("Error fetching place name:", error);
            setLocationName(`${lat.toFixed(6)}, ${lng.toFixed(6)}`);
          }
        },
        (error) => {
          console.error("Geolocation error:", error.code, error.message);
          let errorMessage = "Could not get location.";
          switch (error.code) {
            case 1:
              errorMessage = "Location permission denied.";
              break;
            case 2:
              errorMessage = "Location unavailable.";
              break;
            case 3:
              errorMessage = "Location request timed out.";
              break;
            default:
              errorMessage = error.message || "Unknown error";
          }
          setLocationError(errorMessage);
        },
        {
          enableHighAccuracy: true,
          timeout: 15000,
          maximumAge: 0,
        }
      );
    } else {
      setLocationError("Geolocation is not supported by this browser.");
    }
  };

  useEffect(() => {
    const init = async () => {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      setUser(user);

      if (user) {
        const { data: customers } = await supabase
          .from("customers")
          .select("*")
          .eq("assigned_to", user.id);
        setCustomers(customers || []);

        // Check for customerId in URL
        const customerIdParam = searchParams.get("customerId");
        if (customerIdParam && customers) {
          const customer = customers.find((c) => c.id === customerIdParam);
          if (customer) {
            setSelectedCustomer(customerIdParam);
            setCurrentStage(customer.stage);
            setCustomerType(customer.type);
            setCustomerDetails(customer);
          }
        }

        // Check for taskId in URL
        const taskIdParam = searchParams.get("taskId");
        if (taskIdParam) {
          setTaskId(taskIdParam);
        }
      }

      fetchLocation();
    };
    init();
  }, [searchParams]);

  const refreshCustomers = async () => {
    if (!user) return;
    const supabase = createClient();
    const { data: customers } = await supabase
      .from("customers")
      .select("*")
      .eq("assigned_to", user.id);
    setCustomers(customers || []);

    // Also refresh selected customer details if one is selected
    if (selectedCustomer) {
      const updatedCustomer = customers?.find((c) => c.id === selectedCustomer);
      if (updatedCustomer) {
        setCustomerDetails(updatedCustomer);
      }
    }
  };

  const handleCustomerChange = (customerId: string) => {
    setSelectedCustomer(customerId);
    const customer = customers.find((c) => c.id === customerId);
    if (customer) {
      setCurrentStage(customer.stage);
      setCustomerType(customer.type);
      setCustomerDetails(customer);
    } else {
      setCurrentStage("");
      setCustomerType("");
      setCustomerDetails(null);
    }
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoading(true);
    const formData = new FormData(e.currentTarget);

    // Append location manually since it's state
    if (location) {
      formData.append("location_lat", location.lat.toString());
      formData.append("location_lng", location.lng.toString());
      if (locationName) {
        formData.append("location_name", locationName);
      }
    }

    // Append taskId if present
    if (taskId) {
      formData.append("task_id", taskId);
    }

    const result = await createVisit(null, formData);

    if (result?.error) {
      alert(result.error);
    } else if (result?.success) {
      router.push("/dashboard");
    }
    setLoading(false);
  };

  // Determine next logical stage
  const currentStageIndex = PIPELINE_STAGES.findIndex((s) =>
    currentStage?.startsWith(s)
  );
  const nextStage =
    currentStageIndex !== -1 && currentStageIndex < PIPELINE_STAGES.length - 1
      ? PIPELINE_STAGES[currentStageIndex + 1]
      : "";

  return (
    <div className="mx-auto max-w-6xl space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex flex-col gap-2">
        <h1 className="text-3xl font-heading font-bold tracking-tight text-foreground">
          Log New Visit
        </h1>
        <p className="text-muted-foreground text-lg">
          Record your customer interaction and schedule follow-ups.
        </p>
      </div>

      <form onSubmit={handleSubmit}>
        <div className="grid gap-8 md:grid-cols-12">
          {/* Left Column: Customer Selection & Details */}
          <div className="md:col-span-4 space-y-6">
            <Card className="h-fit">
              <CardHeader>
                <CardTitle className="text-lg">Customer</CardTitle>
                <CardDescription>Select who you visited</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center gap-2">
                  <div className="space-y-2 flex-1">
                    <Label className="text-muted-foreground">
                      Search Customer
                    </Label>
                    <ReactSelect
                      instanceId="customer-select"
                      value={
                        selectedCustomer
                          ? {
                              value: selectedCustomer,
                              label:
                                customers.find((c) => c.id === selectedCustomer)
                                  ?.name || "",
                              phone:
                                customers.find((c) => c.id === selectedCustomer)
                                  ?.phone || "",
                            }
                          : null
                      }
                      onChange={(option) => {
                        if (option) {
                          handleCustomerChange(option.value);
                        }
                      }}
                      options={customers.map((c) => ({
                        value: c.id,
                        label: c.name,
                        phone: c.phone || "",
                      }))}
                      filterOption={(option, inputValue) => {
                        const searchTerm = inputValue.toLowerCase();
                        return (
                          option.label.toLowerCase().includes(searchTerm) ||
                          option.data.phone.toLowerCase().includes(searchTerm)
                        );
                      }}
                      placeholder="Name or Phone"
                      isClearable
                      isSearchable
                      formatOptionLabel={(option) => (
                        <div className="flex flex-col">
                          <span className="font-medium">{option.label}</span>
                          {option.phone && (
                            <span className="text-xs text-muted-foreground">
                              {option.phone}
                            </span>
                          )}
                        </div>
                      )}
                      theme={(theme) => ({
                        ...theme,
                        borderRadius: 8,
                        colors: {
                          ...theme.colors,
                          primary: "hsl(var(--primary))",
                          primary25: "hsl(var(--accent))",
                          primary50: "hsl(var(--accent))",
                          neutral0: "hsl(var(--card))",
                          neutral5: "hsl(var(--accent))",
                          neutral10: "hsl(var(--accent))",
                          neutral20: "hsl(var(--border))",
                          neutral30: "hsl(var(--border))",
                          neutral40: "hsl(var(--muted-foreground))",
                          neutral50: "hsl(var(--muted-foreground))",
                          neutral60: "hsl(var(--foreground))",
                          neutral70: "hsl(var(--foreground))",
                          neutral80: "hsl(var(--foreground))",
                          neutral90: "hsl(var(--foreground))",
                        },
                      })}
                      styles={{
                        control: (base) => ({
                          ...base,
                          minHeight: "2.5rem",
                        }),
                        menuList: (base) => ({
                          ...base,
                          maxHeight: "300px",
                        }),
                      }}
                      className="react-select-container"
                      classNamePrefix="react-select"
                    />
                    <input
                      type="hidden"
                      name="customer"
                      value={selectedCustomer}
                    />
                  </div>
                  <AddCustomerDialog
                    onSuccess={refreshCustomers}
                    trigger={
                      <Button
                        type="button"
                        variant="outline"
                        size="icon"
                        className="shrink-0"
                      >
                        <Plus className="h-4 w-4" />
                      </Button>
                    }
                  />
                </div>

                {customerDetails && (
                  <div className="rounded-xl bg-muted/30 border border-border/50 p-4 space-y-4 animate-in fade-in zoom-in-95 duration-300">
                    <div className="flex items-start justify-between">
                      <div>
                        <h3 className="font-semibold text-foreground">
                          {customerDetails.name}
                        </h3>
                        <Badge
                          variant="outline"
                          className="mt-1 text-[10px] uppercase"
                        >
                          {customerDetails.type}
                        </Badge>
                      </div>
                      <EditCustomerDialog
                        customer={customerDetails}
                        onSuccess={refreshCustomers}
                        trigger={
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            className="h-6 w-6 p-0 hover:bg-background"
                          >
                            <span className="sr-only">Edit</span>
                            <div className="h-3 w-3" />
                          </Button>
                        }
                      />
                    </div>

                    <div className="space-y-3 text-sm text-muted-foreground">
                      <div className="flex items-center gap-2">
                        <UserIcon className="h-3.5 w-3.5 text-primary/70" />
                        <span className="truncate">
                          {customerDetails.contact_person || "N/A"}
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <UserIcon className="h-3.5 w-3.5 text-primary/70" />
                        <span className="truncate">
                          {customerDetails.contact_person || "N/A"}
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Phone className="h-3.5 w-3.5 text-primary/70" />
                        <span className="truncate">
                          {customerDetails.phone || "N/A"}
                        </span>
                      </div>
                      <div className="flex items-start gap-2">
                        <MapPin className="h-3.5 w-3.5 text-primary/70 mt-0.5" />
                        <span className="line-clamp-2">
                          {customerDetails.address || "N/A"}
                        </span>
                      </div>
                    </div>

                    <div className="pt-2 border-t border-border/50">
                      <Label className="text-xs text-muted-foreground uppercase tracking-wider mb-1 block">
                        Current Stage
                      </Label>
                      <Badge variant="secondary">
                        {customerDetails.stage || "N/A"}
                      </Badge>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Location Card */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium flex items-center gap-2">
                  <MapPin className="h-4 w-4 text-primary" />
                  Location Data
                </CardTitle>
              </CardHeader>
              <CardContent>
                {locationName && (
                  <div className="mb-4 p-3 bg-primary/10 rounded-lg border border-primary/20">
                    <span className="text-xs text-muted-foreground block mb-1">
                      Place
                    </span>
                    <span className="text-sm font-medium text-foreground">
                      {locationName}
                    </span>
                  </div>
                )}
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <span className="text-muted-foreground block text-xs">
                      Latitude
                    </span>
                    <span className="font-mono">
                      {location?.lat?.toFixed(6) || "Fetching..."}
                    </span>
                  </div>
                  <div>
                    <span className="text-muted-foreground block text-xs">
                      Longitude
                    </span>
                    <span className="font-mono">
                      {location?.lng?.toFixed(6) || "Fetching..."}
                    </span>
                  </div>
                </div>
                {locationError && (
                  <div className="flex flex-col gap-2 mt-2">
                    <p className="text-xs text-destructive">{locationError}</p>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => fetchLocation()}
                      className="w-full text-xs h-8 border-destructive/20 hover:bg-destructive/10 text-destructive"
                    >
                      <MapPin className="mr-2 h-3 w-3" /> Retry Location
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Right Column: Visit Details */}
          <div className="md:col-span-8 space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Visit Details</CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                {/* Stage Update (Only for New Leads) */}
                {customerType === "New Lead" && (
                  <div className="rounded-xl border border-blue-200 bg-blue-50/50 dark:bg-blue-900/10 dark:border-blue-800 p-4 transition-all">
                    <div className="mb-3 flex items-center justify-between">
                      <Label className="text-blue-700 dark:text-blue-300 font-semibold flex items-center gap-2">
                        <ArrowRight className="h-4 w-4" /> Update Pipeline Stage
                      </Label>
                    </div>
                    <div className="grid md:grid-cols-2 gap-4 items-end">
                      <div className="space-y-2">
                        <span className="text-xs text-muted-foreground block">
                          Current Stage
                        </span>
                        <div className="px-3 py-2 bg-background/50 rounded-md border text-sm text-muted-foreground">
                          {currentStage}
                        </div>
                      </div>
                      <div className="space-y-2">
                        <span className="text-xs text-muted-foreground block">
                          New Stage
                        </span>
                        <Select name="new_stage" defaultValue={nextStage}>
                          <SelectTrigger className="bg-background">
                            <SelectValue placeholder="Keep current stage" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="keep_current">
                              Keep current stage
                            </SelectItem>
                            {PIPELINE_STAGES.map((stage) => (
                              <SelectItem key={stage} value={stage}>
                                Move to: {stage}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                  </div>
                )}

                <div className="grid md:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <Label>Purpose of Visit</Label>
                    <Select name="purpose" required>
                      <SelectTrigger className="w-full h-12">
                        <SelectValue placeholder="Select purpose..." />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Sales Call">Sales Call</SelectItem>
                        <SelectItem value="Follow Up">Follow Up</SelectItem>
                        <SelectItem value="Collection">Collection</SelectItem>
                        <SelectItem value="Complaint">Complaint</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Outcome</Label>
                    <Select name="outcome" required>
                      <SelectTrigger className="w-full h-12">
                        <SelectValue placeholder="Select outcome..." />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Successful">Successful</SelectItem>
                        <SelectItem value="Follow Up Required">
                          Follow Up Required
                        </SelectItem>
                        <SelectItem value="Not Interested">
                          Not Interested
                        </SelectItem>
                        <SelectItem value="Closed">Closed</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label>Visit Notes</Label>
                  <Textarea
                    name="notes"
                    className="min-h-[120px] resize-y"
                    placeholder="Enter detailed notes about the meeting..."
                  />
                </div>

                <div className="space-y-4 pt-2">
                  <div className="text-center space-y-1">
                    <h3 className="text-base font-semibold text-primary uppercase tracking-wide">
                      Upload Files
                    </h3>
                    <p className="text-xs text-muted-foreground max-w-xs mx-auto">
                      Upload documents you want to share.
                    </p>
                  </div>

                  <div className="relative">
                    <div className="border-2 border-dashed border-border rounded-xl p-4 md:p-6 bg-muted/30 text-center transition-all hover:bg-muted/50 hover:border-primary/50">
                      <div className="flex flex-col items-center justify-center gap-3">
                        <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
                          <CloudUpload className="h-5 w-5 text-primary" />
                        </div>

                        <div className="space-y-0.5">
                          <p className="text-sm font-medium text-foreground">
                            {fileName ? (
                              <span className="text-primary font-semibold flex items-center gap-2 justify-center">
                                <Check className="h-3.5 w-3.5" /> {fileName}
                              </span>
                            ) : (
                              "Drag & Drop files here"
                            )}
                          </p>
                          {!fileName && (
                            <p className="text-[10px] text-muted-foreground font-medium uppercase">
                              OR
                            </p>
                          )}
                        </div>

                        <Label
                          htmlFor="photo-upload"
                          className="cursor-pointer inline-flex h-8 items-center justify-center rounded-lg bg-primary px-4 text-xs font-medium text-primary-foreground shadow transition-colors hover:bg-primary/90"
                        >
                          {fileName ? "Change" : "Browse"}
                        </Label>
                        <Input
                          id="photo-upload"
                          type="file"
                          name="photo"
                          accept="image/*"
                          className="hidden"
                          onChange={(e) => {
                            if (e.target.files && e.target.files[0]) {
                              setFileName(e.target.files[0].name);
                            }
                          }}
                        />
                      </div>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="border-amber-200 bg-amber-50/30 dark:border-amber-800 dark:bg-amber-900/10">
              <CardHeader className="pb-3">
                <CardTitle className="text-lg text-amber-700 dark:text-amber-400 flex items-center gap-2">
                  <Calendar className="h-5 w-5" />
                  Next Steps
                </CardTitle>
                <CardDescription>
                  Create a follow-up task automatically
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid md:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <Label className="text-amber-800 dark:text-amber-300">
                      Action Item
                    </Label>
                    <Input
                      name="next_step"
                      placeholder="e.g. Send Proposal"
                      className="bg-background border-amber-200 dark:border-amber-800 focus-visible:ring-amber-500"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-amber-800 dark:text-amber-300">
                      Due Date
                    </Label>
                    <Input
                      type="date"
                      name="next_step_date"
                      className="bg-background border-amber-200 dark:border-amber-800 focus-visible:ring-amber-500"
                    />
                  </div>
                </div>
              </CardContent>
            </Card>

            <div className="flex justify-end pt-4">
              <Button
                type="submit"
                size="lg"
                className="w-full md:w-auto min-w-[200px] shadow-lg shadow-primary/25"
                disabled={loading || !location || !!locationError}
              >
                {loading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Saving...
                  </>
                ) : !location || locationError ? (
                  "Waiting for location..."
                ) : (
                  "Submit Visit Log"
                )}
              </Button>
            </div>
          </div>
        </div>
      </form>
    </div>
  );
}

export default function NewVisitPage() {
  return (
    <Suspense
      fallback={
        <div className="flex items-center justify-center h-screen">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      }
    >
      <NewVisitForm />
    </Suspense>
  );
}
