"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/utils/supabase/client";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
  CardFooter,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, User, Phone, Mail, Shield } from "lucide-react";
import { updateProfile } from "@/app/actions/profile";
import { useRouter } from "next/navigation";

interface Profile {
  id: string;
  full_name: string | null;
  phone: string | null;
  role: string;
  email?: string;
}

export default function ProfilePage() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [profile, setProfile] = useState<Profile | null>(null);

  const router = useRouter();

  useEffect(() => {
    const fetchProfile = async () => {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) {
        router.push("/login");
        return;
      }

      const { data } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", user.id)
        .single();

      if (data) {
        setProfile({ ...data, email: user.email });
      }
      setLoading(false);
    };
    fetchProfile();
  }, [router]);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setSaving(true);
    const formData = new FormData(e.currentTarget);

    const result = await updateProfile(null, formData);

    if (result?.error) {
      alert(result.error);
    } else {
      alert(result?.message || "Profile updated");
      // Refresh local state to reflect changes immediately if needed,
      // though revalidatePath should handle it on next navigation.
      // We can also just update the local profile state.
      setProfile((prev) => {
        if (!prev) return null;
        return {
          ...prev,
          full_name: formData.get("fullName") as string,
          phone: formData.get("phone") as string,
        };
      });
    }
    setSaving(false);
  };

  if (loading) {
    return (
      <div className="flex h-[50vh] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-lime-500" />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <Card className="rounded-3xl border-none shadow-sm ring-1 ring-border">
        <CardHeader>
          <CardTitle className="text-2xl font-bold text-lime-500">
            My Profile
          </CardTitle>
          <CardDescription>
            Manage your personal information and contact details.
          </CardDescription>
        </CardHeader>
        <form onSubmit={handleSubmit}>
          <CardContent className="space-y-6">
            <div className="grid gap-2">
              <Label
                htmlFor="email"
                className="flex items-center gap-2 text-muted-foreground"
              >
                <Mail className="h-4 w-4" /> Email Address
              </Label>
              <Input
                id="email"
                value={profile?.email || ""}
                disabled
                className="bg-muted text-muted-foreground"
              />
              <p className="text-xs text-muted-foreground">
                Email cannot be changed.
              </p>
            </div>

            <div className="grid gap-2">
              <Label
                htmlFor="role"
                className="flex items-center gap-2 text-muted-foreground"
              >
                <Shield className="h-4 w-4" /> Role
              </Label>
              <div className="flex items-center gap-2 rounded-md border border-border bg-muted px-3 py-2 text-sm text-muted-foreground">
                <span
                  className={`h-2 w-2 rounded-full ${
                    profile?.role === "admin" ? "bg-purple-500" : "bg-green-500"
                  }`}
                />
                <span className="capitalize">{profile?.role || "User"}</span>
              </div>
            </div>

            <div className="grid gap-2">
              <Label
                htmlFor="fullName"
                className="flex items-center gap-2 text-muted-foreground"
              >
                <User className="h-4 w-4" /> Full Name
              </Label>
              <Input
                id="fullName"
                name="fullName"
                defaultValue={profile?.full_name || ""}
                required
                className="bg-background"
              />
            </div>

            <div className="grid gap-2">
              <Label
                htmlFor="phone"
                className="flex items-center gap-2 text-muted-foreground"
              >
                <Phone className="h-4 w-4" /> Contact Number
              </Label>
              <Input
                id="phone"
                name="phone"
                defaultValue={profile?.phone || ""}
                placeholder="+1 (555) 000-0000"
                className="bg-background"
              />
            </div>
          </CardContent>
          <CardFooter className="flex justify-end border-t border-border bg-muted/50 p-6">
            <Button
              type="submit"
              className="bg-lime-500 hover:bg-lime-600 text-white font-semibold rounded-xl"
              disabled={saving}
            >
              {saving ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Saving...
                </>
              ) : (
                "Save Changes"
              )}
            </Button>
          </CardFooter>
        </form>
      </Card>
    </div>
  );
}
