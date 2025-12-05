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

interface User {
  id: string;
  email: string;
  full_name: string;
  role: string;
  phone?: string;
}

interface Customer {
  id: string;
  name: string;
  type: string;
  phone?: string;
  stage: string;
  assigned_to?: string | null;
  bdm?: {
    id: string;
    full_name: string;
    email: string;
  } | null;
}

interface ManageCustomersDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export default function ManageCustomersDialog({
  open,
  onOpenChange,
}: ManageCustomersDialogProps) {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [bdms, setBdms] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [filterBDM, setFilterBDM] = useState<string>("all");

  // Assignment dialog state
  const [assignDialogOpen, setAssignDialogOpen] = useState(false);
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(
    null
  );
  const [selectedBDMId, setSelectedBDMId] = useState<string>("");

  const fetchData = async (showLoading = true) => {
    if (showLoading) setLoading(true);
    try {
      const [customersResult, usersResult] = await Promise.all([
        getAllCustomersWithAssignments(),
        getUsersList(),
      ]);

      console.log("Customers Result:", customersResult);
      console.log("Users Result:", usersResult);

      if (customersResult.success) {
        console.log("Setting customers:", customersResult.customers);
        setCustomers(
          (customersResult.customers as unknown as Customer[]) || []
        );
      } else {
        console.error("Customer fetch error:", customersResult.error);
      }

      if (usersResult.success && usersResult.users) {
        // Filter only BDMs and admins
        const bdmUsers = usersResult.users.filter(
          (u: User) => u.role === "bdm" || u.role === "admin"
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

  // Track previous open state to handle reset/loading during render
  const [prevOpen, setPrevOpen] = useState(open);

  // Check for prop change during render (pattern to avoid useEffect setState warning)
  if (open !== prevOpen) {
    setPrevOpen(open);
    if (open) {
      setLoading(true);
    }
  }

  useEffect(() => {
    if (open) {
      // eslint-disable-next-line
      fetchData(false);
    }
  }, [open]);

  // Filtered customers based on search and BDM filter
  const filteredCustomers = useMemo(() => {
    return customers.filter((customer) => {
      // Search filter
      const matchesSearch =
        searchQuery === "" ||
        customer.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (customer.phone && customer.phone.includes(searchQuery));

      // BDM filter
      const matchesBDM =
        filterBDM === "all" ||
        (filterBDM === "unassigned" && !customer.assigned_to) ||
        customer.assigned_to === filterBDM;

      return matchesSearch && matchesBDM;
    });
  }, [customers, searchQuery, filterBDM]);

  const openAssignDialog = (customer: Customer) => {
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
          <div className="flex flex-col md:flex-row gap-4 md:items-end py-4">
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
              onClick={() => fetchData(true)}
              variant="outline"
              className="w-full md:w-auto whitespace-nowrap"
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

          <div className="flex-1 overflow-auto border rounded-lg bg-background">
            {/* Desktop Table View */}
            <table className="hidden md:table w-full text-left text-sm">
              <thead className="bg-muted text-muted-foreground sticky top-0 z-10">
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

            {/* Mobile Card View */}
            <div className="md:hidden space-y-4 p-4">
              {loading ? (
                <div className="p-8 text-center">
                  <Loader2 className="h-6 w-6 animate-spin mx-auto text-primary" />
                </div>
              ) : filteredCustomers.length > 0 ? (
                filteredCustomers.map((customer) => (
                  <div
                    key={customer.id}
                    className="flex flex-col gap-3 p-4 rounded-lg border bg-card shadow-sm"
                  >
                    <div className="flex justify-between items-start">
                      <div>
                        <div className="font-medium text-foreground">
                          {customer.name}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {customer.type}
                        </div>
                      </div>
                      <span className="inline-flex items-center rounded-full bg-primary/10 px-2 py-1 text-xs font-medium text-primary">
                        {customer.stage}
                      </span>
                    </div>

                    <div className="text-sm text-muted-foreground">
                      <span className="font-medium text-foreground">
                        Contact:{" "}
                      </span>
                      {customer.phone || "-"}
                    </div>

                    <div className="text-sm">
                      <span className="font-medium text-foreground">
                        Assigned to:{" "}
                      </span>
                      {customer.bdm ? (
                        <span className="text-foreground">
                          {customer.bdm.full_name}
                        </span>
                      ) : (
                        <span className="text-muted-foreground italic">
                          Unassigned
                        </span>
                      )}
                    </div>

                    <div className="flex gap-2 pt-2 border-t mt-1">
                      <Button
                        size="sm"
                        variant="outline"
                        className="flex-1 text-primary hover:text-primary hover:bg-primary/10 border-primary/20"
                        onClick={() => openAssignDialog(customer)}
                        disabled={processing}
                      >
                        <UserPlus className="mr-1 h-3 w-3" />
                        {customer.assigned_to ? "Reassign" : "Assign"}
                      </Button>
                      {customer.assigned_to && (
                        <Button
                          size="sm"
                          variant="outline"
                          className="flex-1 text-destructive hover:text-destructive hover:bg-destructive/10 border-destructive/20"
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
                  </div>
                ))
              ) : (
                <div className="text-center text-muted-foreground py-8">
                  No customers found matching your filters.
                </div>
              )}
            </div>
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
