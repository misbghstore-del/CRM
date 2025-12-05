"use client";

import { useState, useEffect } from "react";
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
import { Loader2, Plus, Check, ChevronsUpDown } from "lucide-react";
import { createTask } from "@/app/actions/tasks";
import { cn } from "@/utils/cn";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { useRouter } from "next/navigation";

interface Customer {
  id: string;
  name: string;
  phone?: string | null;
}

interface CreateTaskDialogProps {
  customerId?: string;
  customerName?: string;
  customers?: Customer[]; // List of customers for selection
  trigger?: React.ReactNode;
  onSuccess?: () => void;
  defaultDate?: string;
}

export default function CreateTaskDialog({
  customerId,
  customerName,
  customers = [],
  trigger,
  onSuccess,
  defaultDate,
}: CreateTaskDialogProps) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [selectedCustomer, setSelectedCustomer] = useState<string>(
    customerId || ""
  );
  const [comboboxOpen, setComboboxOpen] = useState(false);
  const router = useRouter();

  useEffect(() => {
    if (customerId && customerId !== selectedCustomer) {
      // eslint-disable-next-line
      setSelectedCustomer(customerId);
    }
  }, [customerId, selectedCustomer]);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoading(true);
    const formData = new FormData(e.currentTarget);

    // Use selectedCustomer if available, otherwise fallback to prop (though prop updates state)
    if (selectedCustomer) {
      formData.append("customer_id", selectedCustomer);
    }

    try {
      const result = await createTask(null, formData);

      if (result?.error) {
        alert(result.error);
      } else if (result?.success) {
        setOpen(false);
        router.refresh();
        if (onSuccess) {
          // Small delay to ensure DB propagation
          setTimeout(() => {
            onSuccess();
          }, 500);
        }
      }
    } catch (e) {
      console.error("CreateTaskDialog: Error calling createTask:", e);
      alert("Error calling createTask: " + e);
    }
    setLoading(false);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger || (
          <Button
            size="sm"
            className="h-8 w-8 rounded-full bg-lime-500 p-0 hover:bg-lime-600"
          >
            <Plus className="h-5 w-5 text-white" />
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Add Task</DialogTitle>
          <DialogDescription>
            Create a new task {customerName ? `for ${customerName}` : ""}.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="grid gap-4 py-4">
          {/* Customer Selection (if not pre-selected) */}
          {!customerId && customers.length > 0 && (
            <div className="grid grid-cols-4 items-center gap-4">
              <Label className="text-right">Customer</Label>
              <div className="col-span-3">
                <Popover open={comboboxOpen} onOpenChange={setComboboxOpen}>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      role="combobox"
                      aria-expanded={comboboxOpen}
                      className="w-full justify-between font-normal"
                    >
                      {selectedCustomer
                        ? customers.find((c) => c.id === selectedCustomer)?.name
                        : "Select customer..."}
                      <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-[300px] p-0" align="start">
                    <Command
                      filter={(value, search) => {
                        if (value.toLowerCase().includes(search.toLowerCase()))
                          return 1;
                        return 0;
                      }}
                    >
                      <CommandInput placeholder="Search customer..." />
                      <CommandList>
                        <CommandEmpty>No customer found.</CommandEmpty>
                        <CommandGroup>
                          {customers.map((c) => (
                            <CommandItem
                              key={c.id}
                              value={`${c.name} ${c.phone || ""}`}
                              onSelect={() => {
                                setSelectedCustomer(c.id);
                                setComboboxOpen(false);
                              }}
                            >
                              <Check
                                className={cn(
                                  "mr-2 h-4 w-4",
                                  selectedCustomer === c.id
                                    ? "opacity-100"
                                    : "opacity-0"
                                )}
                              />
                              <div className="flex flex-col">
                                <span>{c.name}</span>
                              </div>
                            </CommandItem>
                          ))}
                        </CommandGroup>
                      </CommandList>
                    </Command>
                  </PopoverContent>
                </Popover>
              </div>
            </div>
          )}

          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="description" className="text-right">
              Action Item
            </Label>
            <Input
              id="description"
              name="description"
              placeholder="e.g. Call back"
              className="col-span-3"
              required
            />
          </div>
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="due_date" className="text-right">
              Due Date
            </Label>
            <Input
              id="due_date"
              name="due_date"
              type="date"
              defaultValue={
                defaultDate || new Date().toISOString().split("T")[0]
              }
              className="col-span-3"
              required
            />
          </div>
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="priority" className="text-right">
              Priority
            </Label>
            <Select name="priority" defaultValue="Normal">
              <SelectTrigger className="col-span-3">
                <SelectValue placeholder="Select priority" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="High">High</SelectItem>
                <SelectItem value="Normal">Normal</SelectItem>
                <SelectItem value="Low">Low</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <DialogFooter>
            <Button type="submit" disabled={loading}>
              {loading ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : null}
              Create Task
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
