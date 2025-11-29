"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/utils/supabase/client";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import DashboardView from "@/components/admin/dashboard-view";
import ManageCustomersDialog from "@/components/admin/ManageCustomersDialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Ban,
  UserCheck,
  Key,
  Loader2,
  RefreshCw,
  Trash2,
  Shield,
  ShieldAlert,
  CheckCircle2,
  XCircle,
} from "lucide-react";
import {
  createUser,
  toggleUserStatus,
  updateUserRole,
  deleteUser,
  resetUserPassword,
  getUsersList,
} from "@/app/actions/admin";

export default function AdminPage() {
  const [users, setUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isAdmin, setIsAdmin] = useState<boolean | null>(null);
  const [currentUserEmail, setCurrentUserEmail] = useState<string | null>(null);

  // Reset Password State
  const [isResetOpen, setIsResetOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState<any>(null);
  const [newPassword, setNewPassword] = useState("");

  // Confirmation Dialog State
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [confirmConfig, setConfirmConfig] = useState<{
    title: string;
    description: string;
    action: () => Promise<void>;
  } | null>(null);

  // Manage Customers Dialog State
  const [isManageCustomersOpen, setIsManageCustomersOpen] = useState(false);

  const supabase = createClient();

  const checkAdminAccess = async () => {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      setIsAdmin(false);
      return;
    }
    setCurrentUserEmail(user.email || "");

    const { data: profile } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .single();

    if (profile && profile.role === "admin") {
      setIsAdmin(true);
      fetchUsers();
    } else {
      setIsAdmin(false);
      setLoading(false);
    }
  };

  const fetchUsers = async () => {
    setLoading(true);
    const result = await getUsersList();
    if (result.success && result.users) {
      setUsers(result.users);
    } else {
      console.error("Failed to fetch users:", result.error);
    }
    setLoading(false);
  };

  useEffect(() => {
    checkAdminAccess();
  }, []);

  const handleSync = async () => {
    setSyncing(true);
    await fetchUsers();
    setTimeout(() => setSyncing(false), 1000);
  };

  const handleCreateUser = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setSyncing(true);
    const formData = new FormData(e.currentTarget);

    const result = await createUser(null, formData);

    if (result?.error) {
      alert(result.error);
    } else {
      alert(result?.message || "User created");
      setIsCreateOpen(false);
      fetchUsers();
    }
    setSyncing(false);
  };

  const openConfirmDialog = (
    title: string,
    description: string,
    action: () => Promise<void>
  ) => {
    setConfirmConfig({ title, description, action });
    setConfirmOpen(true);
  };

  const handleConfirmAction = async () => {
    if (!confirmConfig) return;
    setConfirmOpen(false);
    await confirmConfig.action();
    setConfirmConfig(null);
  };

  const handleToggleBan = (userId: string, isBanned: boolean) => {
    openConfirmDialog(
      isBanned ? "Unban User" : "Ban User",
      isBanned
        ? "Are you sure you want to unban this user?"
        : "Are you sure you want to ban this user? They will not be able to log in.",
      async () => {
        setSyncing(true);
        const result = await toggleUserStatus(userId, !isBanned);

        if (result?.error) alert(result.error);
        else {
          alert(result?.message);
          fetchUsers();
        }
        setSyncing(false);
      }
    );
  };

  const handleRoleUpdate = (userId: string, currentRole: string) => {
    const newRole = currentRole === "admin" ? "bdm" : "admin";
    openConfirmDialog(
      "Change User Role",
      `Are you sure you want to change the role to ${newRole.toUpperCase()}?`,
      async () => {
        setSyncing(true);
        const result = await updateUserRole(userId, newRole);

        if (result?.error) alert(result.error);
        else {
          alert(result?.message);
          fetchUsers();
        }
        setSyncing(false);
      }
    );
  };

  const handleDelete = (userId: string) => {
    openConfirmDialog(
      "Delete User",
      "Are you sure you want to DELETE this user? This action cannot be undone.",
      async () => {
        setSyncing(true);
        const result = await deleteUser(userId);

        if (result?.error) alert(result.error);
        else {
          alert(result?.message);
          fetchUsers();
        }
        setSyncing(false);
      }
    );
  };

  const openResetDialog = (user: any) => {
    setSelectedUser(user);
    setNewPassword("");
    setIsResetOpen(true);
  };

  const handleResetPassword = async () => {
    if (!newPassword || newPassword.length < 6) {
      alert("Password must be at least 6 characters");
      return;
    }

    setSyncing(true);
    const result = await resetUserPassword(selectedUser.id, newPassword);
    if (result?.error) alert(result.error);
    else {
      alert(result?.message);
      setIsResetOpen(false);
    }
    setSyncing(false);
  };

  if (isAdmin === false) {
    return (
      <div className="flex h-[80vh] flex-col items-center justify-center text-center">
        <div className="mb-6 rounded-full bg-destructive/10 p-6">
          <Ban className="h-12 w-12 text-destructive" />
        </div>
        <h1 className="mb-2 text-3xl font-bold text-foreground">
          Access Restricted
        </h1>
        <p className="mb-8 max-w-md text-muted-foreground">
          You do not have permission to view this page.
        </p>
        <Button
          asChild
          variant="outline"
          className="border-primary text-primary hover:bg-primary/10"
        >
          <a href="/dashboard">Return to Dashboard</a>
        </Button>
      </div>
    );
  }

  if (isAdmin === null) {
    return (
      <div className="flex h-[80vh] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-primary">Admin Console</h1>
          <p className="text-muted-foreground">
            Manage system performance and user accounts.
          </p>
        </div>
      </div>

      <Tabs defaultValue="dashboard" className="space-y-6">
        <TabsList className="grid w-full grid-cols-2 lg:w-[400px]">
          <TabsTrigger value="dashboard">Dashboard</TabsTrigger>
          <TabsTrigger value="users">User Management</TabsTrigger>
        </TabsList>

        <TabsContent value="dashboard">
          <DashboardView />
        </TabsContent>

        <TabsContent value="users">
          <Card className="rounded-3xl border-none shadow-sm ring-1 ring-border">
            <CardHeader>
              <CardTitle className="text-2xl font-bold text-primary">
                User Accounts
              </CardTitle>
              <CardDescription>
                Manage user accounts and system settings.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="mb-8 grid gap-4 md:grid-cols-3">
                <Button
                  onClick={handleSync}
                  className="h-auto py-4 bg-primary hover:bg-primary/90 text-primary-foreground font-semibold text-lg rounded-xl shadow-sm"
                  disabled={syncing}
                >
                  {syncing ? (
                    <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                  ) : (
                    <RefreshCw className="mr-2 h-5 w-5" />
                  )}
                  Sync from BDM Master
                </Button>

                <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
                  <DialogTrigger asChild>
                    <Button
                      variant="outline"
                      className="h-auto py-4 border-primary text-primary hover:bg-primary/10 font-semibold text-lg rounded-xl"
                    >
                      Create New User
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="sm:max-w-[425px]">
                    <DialogHeader>
                      <DialogTitle>Create New User</DialogTitle>
                      <DialogDescription>
                        Add a new user to the system.
                      </DialogDescription>
                    </DialogHeader>
                    <form
                      onSubmit={handleCreateUser}
                      className="grid gap-4 py-4"
                    >
                      <div className="grid grid-cols-4 items-center gap-4">
                        <Label htmlFor="email" className="text-right">
                          Email
                        </Label>
                        <Input
                          id="email"
                          name="email"
                          type="email"
                          className="col-span-3"
                          required
                        />
                      </div>
                      <div className="grid grid-cols-4 items-center gap-4">
                        <Label htmlFor="fullName" className="text-right">
                          Name
                        </Label>
                        <Input
                          id="fullName"
                          name="fullName"
                          className="col-span-3"
                          required
                        />
                      </div>
                      <div className="grid grid-cols-4 items-center gap-4">
                        <Label htmlFor="password" className="text-right">
                          Password
                        </Label>
                        <Input
                          id="password"
                          name="password"
                          type="password"
                          className="col-span-3"
                          required
                        />
                      </div>
                      <div className="grid grid-cols-4 items-center gap-4">
                        <Label htmlFor="role" className="text-right">
                          Role
                        </Label>
                        <Select name="role" defaultValue="bdm" required>
                          <SelectTrigger className="col-span-3">
                            <SelectValue placeholder="Select a role" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="bdm">BDM (User)</SelectItem>
                            <SelectItem value="admin">Admin</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <DialogFooter>
                        <Button type="submit" disabled={syncing}>
                          {syncing ? "Creating..." : "Create User"}
                        </Button>
                      </DialogFooter>
                    </form>
                  </DialogContent>
                </Dialog>

                <Button
                  variant="outline"
                  className="h-auto py-4 border-primary text-primary hover:bg-primary/10 font-semibold text-lg rounded-xl"
                  onClick={() => setIsManageCustomersOpen(true)}
                >
                  Manage Customer
                  <br />
                  Assignments
                </Button>
              </div>

              <div className="overflow-x-auto overflow-hidden rounded-lg border border-border">
                <table className="w-full text-left text-sm">
                  <thead className="bg-muted text-muted-foreground">
                    <tr>
                      <th className="px-4 py-3 font-medium">User Details</th>
                      <th className="px-4 py-3 font-medium">Role</th>
                      <th className="px-4 py-3 font-medium">Contact</th>
                      <th className="px-4 py-3 font-medium">Status</th>
                      <th className="px-4 py-3 font-medium text-right">
                        Actions
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border bg-card">
                    {loading ? (
                      <tr>
                        <td colSpan={5} className="p-4 text-center">
                          Loading users...
                        </td>
                      </tr>
                    ) : users.length > 0 ? (
                      users.map((user) => {
                        const isBanned =
                          user.banned_until &&
                          new Date(user.banned_until) > new Date();
                        return (
                          <tr key={user.id} className="hover:bg-muted/50">
                            <td className="px-4 py-3">
                              <div className="font-medium text-foreground">
                                {user.full_name}
                              </div>
                              <div className="text-xs text-muted-foreground">
                                {user.email}
                              </div>
                            </td>
                            <td className="px-4 py-3">
                              <div className="flex items-center gap-2">
                                {user.role === "admin" ? (
                                  <ShieldAlert className="h-4 w-4 text-purple-500" />
                                ) : (
                                  <Shield className="h-4 w-4 text-green-500" />
                                )}
                                <span className="capitalize text-foreground">
                                  {user.role}
                                </span>
                              </div>
                            </td>
                            <td className="px-4 py-3 text-muted-foreground">
                              {user.phone || "-"}
                            </td>
                            <td className="px-4 py-3">
                              {isBanned ? (
                                <span className="inline-flex items-center rounded-full bg-red-100 px-2.5 py-0.5 text-xs font-medium text-red-800">
                                  Banned
                                </span>
                              ) : (
                                <span className="inline-flex items-center rounded-full bg-green-100 px-2.5 py-0.5 text-xs font-medium text-green-800">
                                  Active
                                </span>
                              )}
                            </td>
                            <td className="px-4 py-3 text-right">
                              <div className="flex justify-end gap-2">
                                {/* Promote/Demote */}
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  className="h-8 w-8 p-0 text-muted-foreground hover:text-primary"
                                  title={
                                    user.role === "admin"
                                      ? "Demote to User"
                                      : "Promote to Admin"
                                  }
                                  onClick={() =>
                                    handleRoleUpdate(user.id, user.role)
                                  }
                                >
                                  <UserCheck className="h-4 w-4" />
                                </Button>

                                {/* Reset Password */}
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  className="h-8 w-8 p-0 text-muted-foreground hover:text-yellow-600"
                                  title="Reset Password"
                                  onClick={() => openResetDialog(user)}
                                  disabled={user.email === currentUserEmail}
                                >
                                  <Key className="h-4 w-4" />
                                </Button>

                                {/* Ban/Unban */}
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  className={`h-8 w-8 p-0 ${
                                    isBanned
                                      ? "text-red-600"
                                      : "text-muted-foreground"
                                  } hover:text-orange-600`}
                                  title={isBanned ? "Unban User" : "Ban User"}
                                  onClick={() =>
                                    handleToggleBan(user.id, isBanned)
                                  }
                                >
                                  <Ban className="h-4 w-4" />
                                </Button>

                                {/* Delete */}
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  className="h-8 w-8 p-0 text-muted-foreground hover:text-red-600"
                                  title="Delete User"
                                  onClick={() => handleDelete(user.id)}
                                  disabled={user.email === currentUserEmail}
                                >
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              </div>
                            </td>
                          </tr>
                        );
                      })
                    ) : (
                      <tr>
                        <td
                          colSpan={5}
                          className="px-4 py-8 text-center text-muted-foreground bg-muted/20"
                        >
                          No users found.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Reset Password Dialog */}
      <Dialog open={isResetOpen} onOpenChange={setIsResetOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reset Password</DialogTitle>
            <DialogDescription>
              Enter a new password for{" "}
              <strong>{selectedUser?.full_name}</strong> ({selectedUser?.email}
              ).
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="newPassword" className="text-right">
                New Password
              </Label>
              <Input
                id="newPassword"
                type="password"
                className="col-span-3"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsResetOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleResetPassword} disabled={syncing}>
              {syncing ? "Resetting..." : "Reset Password"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Confirmation Dialog */}
      <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{confirmConfig?.title}</DialogTitle>
            <DialogDescription>{confirmConfig?.description}</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmOpen(false)}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleConfirmAction}>
              Confirm
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Manage Customers Dialog */}
      <ManageCustomersDialog
        open={isManageCustomersOpen}
        onOpenChange={setIsManageCustomersOpen}
      />
    </div>
  );
}
