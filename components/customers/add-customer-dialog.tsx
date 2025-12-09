"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Plus, Loader2 } from "lucide-react";
import { createCustomer } from "@/app/actions/customers";

interface Customer {
  id: string;
  name: string;
  type: string;
  profession?: string;
}

interface AddCustomerDialogProps {
  trigger?: React.ReactNode;
  onSuccess?: (newCustomer: Customer | null) => void;
}

export default function AddCustomerDialog({
  trigger,
  onSuccess,
}: AddCustomerDialogProps) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [customerType, setCustomerType] = useState("Prospect Dealer");
  const [professionals, setProfessionals] = useState<Customer[]>([]);
  const [location, setLocation] = useState<{ lat: number; lng: number } | null>(
    null
  );
  const [phoneError, setPhoneError] = useState<string>("");

  // Fetch professionals and dealers when dialog opens
  const fetchProfessionals = async () => {
    const { createClient } = await import("@/utils/supabase/client");
    const supabase = createClient();
    const { data } = await supabase
      .from("customers")
      .select("id, name, type, profession")
      .in("type", ["Professional", "Dealer"]);

    if (data) setProfessionals(data);
  };

  const fetchLocation = (retryWithLowAccuracy = false) => {
    if ("geolocation" in navigator) {
      const options = retryWithLowAccuracy
        ? { enableHighAccuracy: false, timeout: 30000, maximumAge: 60000 }
        : { enableHighAccuracy: true, timeout: 20000, maximumAge: 60000 };

      navigator.geolocation.getCurrentPosition(
        (position) => {
          setLocation({
            lat: position.coords.latitude,
            lng: position.coords.longitude,
          });
        },
        (error) => {
          if (error.code === 3 && !retryWithLowAccuracy) {
            console.warn(
              "High accuracy geolocation timed out, retrying with low accuracy..."
            );
            fetchLocation(true);
            return;
          }

          console.warn("Geolocation error:", error.code, error.message);
        },
        options
      );
    }
  };

  const handleOpenChange = (newOpen: boolean) => {
    setOpen(newOpen);
    if (newOpen) {
      fetchProfessionals();
      fetchLocation();
    }
  };

  const checkPhoneExists = async (phone: string) => {
    if (!phone || phone.length < 10) {
      setPhoneError("");
      return;
    }

    const { createClient } = await import("@/utils/supabase/client");
    const supabase = createClient();
    const { data } = await supabase
      .from("customers")
      .select("id, name")
      .eq("phone", phone)
      .limit(1);

    if (data && data.length > 0) {
      setPhoneError(`This number already exists for customer: ${data[0].name}`);
    } else {
      setPhoneError("");
    }
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    e.stopPropagation(); // Prevent parent form submission

    // Prevent submission if phone number already exists
    if (phoneError) {
      return;
    }

    setLoading(true);
    const formData = new FormData(e.currentTarget);

    if (location) {
      formData.append("location_lat", location.lat.toString());
      formData.append("location_lng", location.lng.toString());
    }

    const result = await createCustomer(null, formData);

    if (result?.error) {
      alert(result.error);
    } else if (result?.success) {
      setOpen(false);
      if (onSuccess) {
        onSuccess(null);
      }
    }
    setLoading(false);
  };

  // Filter professionals by role
  const architects = professionals.filter((p) => p.profession === "Architect");
  const builders = professionals.filter(
    (p) => p.profession === "Builder" || p.profession === "Contractor"
  );
  const dealers = professionals.filter((p) => p.type === "Dealer");

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        {trigger || (
          <Button>
            <Plus className="mr-2 h-4 w-4" /> Add Customer
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Add New Customer</DialogTitle>
          <DialogDescription>
            Create a new customer profile. Select the type to determine the
            workflow.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="grid gap-4 py-4">
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="type" className="text-right">
              Customer Type
            </Label>
            <Select
              name="type"
              value={customerType}
              onValueChange={setCustomerType}
              required
            >
              <SelectTrigger className="col-span-3">
                <SelectValue placeholder="Select type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="Prospect Dealer">Prospect Dealer</SelectItem>
                <SelectItem value="Professional">
                  Professional (Builder/Contractor)
                </SelectItem>
                <SelectItem value="Site">Project Site</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {customerType === "Professional" && (
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="profession" className="text-right">
                Profession
              </Label>
              <Select name="profession" required>
                <SelectTrigger className="col-span-3">
                  <SelectValue placeholder="Select Profession" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Architect">Architect</SelectItem>
                  <SelectItem value="Builder">Builder</SelectItem>
                  <SelectItem value="Contractor">Contractor</SelectItem>
                </SelectContent>
              </Select>
            </div>
          )}

          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="name" className="text-right">
              {customerType === "Site" ? "Site Name" : "Name"}
            </Label>
            <Input id="name" name="name" className="col-span-3" required />
          </div>

          {customerType === "Site" && (
            <>
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="contact_person" className="text-right">
                  Primary Contact
                </Label>
                <Input
                  id="contact_person"
                  name="contact_person"
                  placeholder="End User Name"
                  className="col-span-3"
                />
              </div>
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="site_description" className="text-right">
                  Site Description
                </Label>
                <Input
                  id="site_description"
                  name="site_description"
                  placeholder="Optional"
                  className="col-span-3"
                />
              </div>
            </>
          )}

          {customerType !== "Site" && (
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="contact_person" className="text-right">
                Contact Person
              </Label>
              <Input
                id="contact_person"
                name="contact_person"
                className="col-span-3"
              />
            </div>
          )}

          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="phone" className="text-right">
              Contact Phone
            </Label>
            <div className="col-span-3">
              <Input
                id="phone"
                name="phone"
                onChange={(e) => checkPhoneExists(e.target.value)}
              />
              {phoneError && (
                <p className="text-sm text-destructive mt-1">{phoneError}</p>
              )}
            </div>
          </div>
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="address" className="text-right">
              Address
            </Label>
            <Input id="address" name="address" className="col-span-3" />
          </div>
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="city" className="text-right">
              City
            </Label>
            <Input
              id="city"
              name="city"
              placeholder="Enter city"
              className="col-span-3"
            />
          </div>

          {customerType === "Prospect Dealer" && (
            <div className="grid grid-cols-4 items-center gap-4">
              <Label className="text-right">Location Tag</Label>
              <div className="col-span-3 p-2 bg-muted rounded-md text-sm flex justify-between items-center">
                <span>
                  {location
                    ? `${location.lat.toFixed(6)}, ${location.lng.toFixed(6)}`
                    : "Fetching location..."}
                </span>
                {!location && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-6 px-2"
                    onClick={() => fetchLocation()}
                  >
                    Retry
                  </Button>
                )}
              </div>
            </div>
          )}

          {customerType === "Site" && (
            <>
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="architect_id" className="text-right">
                  Link to Architect
                </Label>
                <Select name="architect_id">
                  <SelectTrigger className="col-span-3">
                    <SelectValue placeholder="Select Architect" />
                  </SelectTrigger>
                  <SelectContent>
                    {architects.map((p) => (
                      <SelectItem key={p.id} value={p.id}>
                        {p.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="builder_id" className="text-right">
                  Link to Builder
                </Label>
                <Select name="builder_id">
                  <SelectTrigger className="col-span-3">
                    <SelectValue placeholder="Select Builder/Contractor" />
                  </SelectTrigger>
                  <SelectContent>
                    {builders.map((p) => (
                      <SelectItem key={p.id} value={p.id}>
                        {p.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="dealer_id" className="text-right">
                  Link to Dealer
                </Label>
                <Select name="dealer_id">
                  <SelectTrigger className="col-span-3">
                    <SelectValue placeholder="Select Dealer" />
                  </SelectTrigger>
                  <SelectContent>
                    {dealers.map((p) => (
                      <SelectItem key={p.id} value={p.id}>
                        {p.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="site_photo" className="text-right">
                  Site Photo
                </Label>
                <Input
                  id="site_photo"
                  name="site_photo"
                  type="file"
                  className="col-span-3"
                />
              </div>
              <div className="grid grid-cols-4 items-center gap-4">
                <Label className="text-right">Location Tag</Label>
                <div className="col-span-3 p-2 bg-muted rounded-md text-sm flex justify-between items-center">
                  <span>
                    {location
                      ? `${location.lat.toFixed(6)}, ${location.lng.toFixed(6)}`
                      : "Fetching location..."}
                  </span>
                  {!location && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="h-6 px-2"
                      onClick={() => fetchLocation()}
                    >
                      Retry
                    </Button>
                  )}
                </div>
              </div>
            </>
          )}

          <DialogFooter>
            <Button type="submit" disabled={loading}>
              {loading ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : null}
              Create Customer
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
