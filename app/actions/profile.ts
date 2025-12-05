"use server";

import { createClient } from "@/utils/supabase/server";
import { revalidatePath } from "next/cache";

export type ActionState = {
  error?: string;
  message?: string;
  success?: boolean;
};

export async function updateProfile(
  prevState: ActionState | null,
  formData: FormData
) {
  const supabase = await createClient();

  const fullName = formData.get("fullName") as string;
  const phone = formData.get("phone") as string;

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    return { error: "Not authenticated" };
  }

  // Update public.profiles
  const { error: updateError } = await supabase
    .from("profiles")
    .update({
      full_name: fullName,
      phone: phone,
      updated_at: new Date().toISOString(),
    })
    .eq("id", user.id);

  if (updateError) {
    console.error("Profile update error:", updateError);
    return { error: "Failed to update profile" };
  }

  // Update Auth User Metadata (optional, but good for consistency)
  const { error: metadataError } = await supabase.auth.updateUser({
    data: { full_name: fullName },
  });

  if (metadataError) {
    console.error("Metadata update error:", metadataError);
    // We don't fail the whole request if this fails, as the DB update is more important for the app
  }

  revalidatePath("/profile");
  revalidatePath("/(main)", "layout"); // Revalidate layout to update header name if needed

  return { success: true, message: "Profile updated successfully" };
}
