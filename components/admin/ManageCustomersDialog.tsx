"use client";

import { useState, useEffect, useMemo } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  getAllCustomersWithAssignments,
  assignCustomerToBDM,
  unassignCustomer,
  getUsersList,
} from "@/app/actions/admin";
import { Loader2, UserPlus, UserMinus, RefreshCw, Search } from "lucide-react";

interface ManageCustomersDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export default function ManageCustomersDialog({
  open,
  onOpenChange,
}: ManageCustomersDialogProps) {
  const [customers, setCustomers] = useState<any[]>([]);
  const [bdms, setBdms] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [filterBDM, setFilterBDM] = useState<string>("all");

  // Assignment dialog state
  const [assignDialogOpen, setAssignDialogOpen] = useState(false);
  const [selectedCustomer, setSelectedCustomer] = useState<any>(null);
  const [selectedBDMId, setSelectedBDMId] = useState<string>("");

  const fetchData = async () => {
    setLoading(true);
    try {
      const [customersResult, usersResult] = await Promise.all([
        getAllCustomersWithAssignments(),
        getUsersList(),
      ]);

      console.log("Customers Result:", customersResult);
      console.log("Users Result:", usersResult);

      if (customersResult.success) {
        console.log("Setting customers:", customersResult.customers);
        setCustomers(customersResult.customers || []);
      } else {
        console.error("Customer fetch error:", customersResult.error);
      }

      if (usersResult.success && usersResult.users) {
        // Filter only BDMs and admins
        const bdmUsers = usersResult.users.filter(
          (u: any) => u.role === "bdm" || u.role === "admin"
        );
        console.log("BDMs:", bdmUsers);
        setBdms(bdmUsers);
      } else {
        console.error("Users fetch error:", usersResult.error);
      }
    } catch (error) {
      console.error("Error fetching data:", error);
    }
    setLoading(false);
  };

  useEffect(() => {
    if (open) {
      fetchData();
    }
  }, [open]);

  // Filtered customers based on search and BDM filter
  const filteredCustomers = useMemo(() => {
    return customers.filter((customer) => {
      // Search filter
      const matchesSearch =
        searchQuery === "" ||
        customer.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        customer.phone?.includes(searchQuery);

      // BDM filter
      const matchesBDM =
        filterBDM === "all" ||
        (filterBDM === "unassigned" && !customer.assigned_to) ||
        customer.assigned_to === filterBDM;

      return matchesSearch && matchesBDM;
    });
  }, [customers, searchQuery, filterBDM]);

  const openAssignDialog = (customer: any) => {
    setSelectedCustomer(customer);
    setSelectedBDMId(customer.assigned_to || "");
    setAssignDialogOpen(true);
  };

  const handleAssign = async () => {
    if (!selectedCustomer || !selectedBDMId) {
      alert("Please select a BDM");
      return;
    }

    setProcessing(true);
    const result = await assignCustomerToBDM(
      selectedCustomer.id,
      selectedBDMId
    );

    if (result.error) {
      alert(`Error: ${result.error}`);
    } else {
      alert(result.message);
      setAssignDialogOpen(false);
      fetchData();
    }
    setProcessing(false);
  };

  // State for unassign confirmation
  const [unassignConfirmOpen, setUnassignConfirmOpen] = useState(false);
  const [customerToUnassign, setCustomerToUnassign] = useState<{
    id: string;
    name: string;
  } | null>(null);

  const handleUnassignClick = (customerId: string, customerName: string) => {
    setCustomerToUnassign({ id: customerId, name: customerName });
    setUnassignConfirmOpen(true);
  };

  const confirmUnassign = async () => {
    if (!customerToUnassign) return;

    setProcessing(true);
    const result = await unassignCustomer(customerToUnassign.id);

    if (result.error) {
      alert(`Error: ${result.error}`);
    } else {
      alert(result.message);
      fetchData();
      setUnassignConfirmOpen(false);
      setCustomerToUnassign(null);
    }
    setProcessing(false);
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-[95vw] h-[90vh] flex flex-col">
          <DialogHeader>
            <DialogTitle className="text-2xl font-bold text-primary">
              Manage Customer Assignments
            </DialogTitle>
            <DialogDescription>
              Assign customers to BDMs or remove assignments
            </DialogDescription>
          </DialogHeader>

          {/* Filters */}
          <div className="flex flex-col md:flex-row gap-4 items-end py-4">
            <div className="flex-1 space-y-2">
              <Label className="text-sm text-muted-foreground">Search</Label>
              <div className="relative">
                <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9"
                />
              </div>
            </div>

            <div className="flex-1 space-y-2">
              <Label className="text-sm text-muted-foreground">
                Filter by BDM
              </Label>
              <Select value={filterBDM} onValueChange={setFilterBDM}>
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All BDMs</SelectItem>
                  <SelectItem value="unassigned">Unassigned</SelectItem>
                  {bdms.map((bdm) => (
                    <SelectItem key={bdm.id} value={bdm.id}>
                      {bdm.full_name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <Button
              onClick={fetchData}
              variant="outline"
              className="w-auto whitespace-nowrap"
              disabled={loading}
            >
              {loading ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <RefreshCw className="mr-2 h-4 w-4" />
              )}
              Refresh
            </Button>
          </div>
          <div className="flex-1 overflow-auto border rounded-lg">
            <table className="w-full text-left text-sm">
              <thead className="bg-muted text-muted-foreground sticky top-0">
                <tr>
                  <th className="px-4 py-3 font-medium">Customer</th>
                  <th className="px-4 py-3 font-medium">Contact</th>
                  <th className="px-4 py-3 font-medium">Stage</th>
                  <th className="px-4 py-3 font-medium">Assigned BDM</th>
                  <th className="px-4 py-3 font-medium text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border bg-card">
                {loading ? (
                  <tr>
                    <td colSpan={5} className="p-8 text-center">
                      <Loader2 className="h-6 w-6 animate-spin mx-auto text-primary" />
                    </td>
                  </tr>
                ) : filteredCustomers.length > 0 ? (
                  filteredCustomers.map((customer) => (
                    <tr key={customer.id} className="hover:bg-muted/50">
                      <td className="px-4 py-3">
                        <div className="font-medium text-foreground">
                          {customer.name}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {customer.type}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">
                        <div className="text-xs">{customer.phone || "-"}</div>
                      </td>
                      <td className="px-4 py-3">
                        <span className="inline-flex items-center rounded-full bg-primary/10 px-2 py-1 text-xs font-medium text-primary">
                          {customer.stage}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        {customer.bdm ? (
                          <div>
                            <div className="font-medium text-foreground">
                              {customer.bdm.full_name}
                            </div>
                            <div className="text-xs text-muted-foreground">
                              {customer.bdm.email}
                            </div>
                          </div>
                        ) : (
                          <span className="text-muted-foreground italic">
                            Unassigned
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <div className="flex justify-end gap-2">
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-8 px-3 text-primary hover:text-primary hover:bg-primary/10"
                            onClick={() => openAssignDialog(customer)}
                            disabled={processing}
                          >
                            <UserPlus className="mr-1 h-3 w-3" />
                            {customer.assigned_to ? "Reassign" : "Assign"}
                          </Button>
                          {customer.assigned_to && (
                            <Button
                              size="sm"
                              variant="ghost"
                              className="h-8 px-3 text-destructive hover:text-destructive hover:bg-destructive/10"
                              onClick={() =>
                                handleUnassignClick(customer.id, customer.name)
                              }
                              disabled={processing}
                            >
                              <UserMinus className="mr-1 h-3 w-3" />
                              Remove
                            </Button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td
                      colSpan={5}
                      className="px-4 py-8 text-center text-muted-foreground"
                    >
                      No customers found matching your filters.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          <div className="text-sm text-muted-foreground pt-2">
            Showing {filteredCustomers.length} of {customers.length} customers
          </div>
        </DialogContent>
      </Dialog>

      {/* Assignment Dialog */}
      <Dialog open={assignDialogOpen} onOpenChange={setAssignDialogOpen}>
        {/* ... existing assignment dialog content ... */}
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {selectedCustomer?.assigned_to ? "Reassign" : "Assign"} Customer
            </DialogTitle>
            <DialogDescription>
              Select a BDM to assign <strong>{selectedCustomer?.name}</strong>{" "}
              to
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 py-4">
            <div className="space-y-2">
              <Label>Select BDM</Label>
              <Select value={selectedBDMId} onValueChange={setSelectedBDMId}>
                <SelectTrigger>
                  <SelectValue placeholder="Choose a BDM..." />
                </SelectTrigger>
                <SelectContent>
                  {bdms.map((bdm) => (
                    <SelectItem key={bdm.id} value={bdm.id}>
                      <div className="flex items-center gap-2">
                        <span>{bdm.full_name}</span>
                        <span className="text-xs text-muted-foreground">
                          ({bdm.email})
                        </span>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="flex justify-end gap-2">
            <Button
              variant="outline"
              onClick={() => setAssignDialogOpen(false)}
              disabled={processing}
            >
              Cancel
            </Button>
            <Button
              onClick={handleAssign}
              disabled={processing || !selectedBDMId}
            >
              {processing ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Assigning...
                </>
              ) : (
                "Assign"
              )}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Unassign Confirmation Dialog */}
      <Dialog open={unassignConfirmOpen} onOpenChange={setUnassignConfirmOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Unassign Customer</DialogTitle>
            <DialogDescription>
              Are you sure you want to remove the assignment for{" "}
              <strong>{customerToUnassign?.name}</strong>?
            </DialogDescription>
          </DialogHeader>
          <div className="flex justify-end gap-2 mt-4">
            <Button
              variant="outline"
              onClick={() => setUnassignConfirmOpen(false)}
              disabled={processing}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={confirmUnassign}
              disabled={processing}
            >
              {processing ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Removing...
                </>
              ) : (
                "Remove Assignment"
              )}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
