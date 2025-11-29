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

interface AddCustomerDialogProps {
  trigger?: React.ReactNode;
  onSuccess?: (newCustomer: any) => void;
}

export default function AddCustomerDialog({
  trigger,
  onSuccess,
}: AddCustomerDialogProps) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [customerType, setCustomerType] = useState("New Lead");
  const [professionals, setProfessionals] = useState<any[]>([]);
  const [location, setLocation] = useState<{ lat: number; lng: number } | null>(
    null
  );

  // Fetch professionals when dialog opens
  const fetchProfessionals = async () => {
    const { createClient } = await import("@/utils/supabase/client");
    const supabase = createClient();
    const { data } = await supabase
      .from("customers")
      .select("id, name, type, profession")
      .eq("type", "Professional");

    if (data) setProfessionals(data);
  };

  const handleOpenChange = (newOpen: boolean) => {
    setOpen(newOpen);
    if (newOpen) {
      fetchProfessionals();
      if ("geolocation" in navigator) {
        navigator.geolocation.getCurrentPosition((position) => {
          setLocation({
            lat: position.coords.latitude,
            lng: position.coords.longitude,
          });
        });
      }
    }
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
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
  const dealers = professionals.filter((p) => p.profession === "Dealer");

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
                <SelectItem value="New Lead">
                  New Lead (Prospect Dealer)
                </SelectItem>
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
                  <SelectItem value="Dealer">Dealer</SelectItem>
                  <SelectItem value="Other">Other</SelectItem>
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
                Contact
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
            <Input id="phone" name="phone" className="col-span-3" />
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
                <div className="col-span-3 p-2 bg-muted rounded-md text-sm">
                  {location
                    ? `${location.lat}, ${location.lng}`
                    : "Fetching location..."}
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
