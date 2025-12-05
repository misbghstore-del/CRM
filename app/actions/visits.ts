"use server";

import { createClient } from "@/utils/supabase/server";
import { revalidatePath } from "next/cache";
import { updateCustomerStage } from "./customers";

export type ActionState = {
  error?: string;
  message?: string;
  success?: boolean;
};

export async function createVisit(
  prevState: ActionState | null,
  formData: FormData
) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { error: "You must be logged in to log a visit" };
  }

  const customerId = formData.get("customer") as string;
  const purpose = formData.get("purpose") as string;
  const outcome = formData.get("outcome") as string;
  const notes = formData.get("notes") as string;
  const locationLat = formData.get("location_lat");
  const locationLng = formData.get("location_lng");
  const locationName = formData.get("location_name") as string;
  const photoFile = formData.get("photo") as File;
  const newStage = formData.get("new_stage") as string;

  let photoUrl = null;

  if (photoFile && photoFile.size > 0) {
    const fileExt = photoFile.name.split(".").pop();
    const fileName = `${user.id}/${Date.now()}.${fileExt}`;
    const { error: uploadError } = await supabase.storage
      .from("visit-photos")
      .upload(fileName, photoFile);

    if (!uploadError) {
      const {
        data: { publicUrl },
      } = supabase.storage.from("visit-photos").getPublicUrl(fileName);
      photoUrl = publicUrl;
    }
  }

  const { error } = await supabase.from("visits").insert({
    user_id: user.id,
    customer_id: customerId,
    purpose,
    outcome,
    notes,
    location_lat: locationLat ? parseFloat(locationLat.toString()) : null,
    location_lng: locationLng ? parseFloat(locationLng.toString()) : null,
    location_name: locationName || null,
    photo_url: photoUrl,
    timestamp: new Date().toISOString(),
  });

  if (error) {
    return { error: error.message };
  }

  // Handle Stage Update
  if (newStage && newStage !== "keep_current") {
    await updateCustomerStage(customerId, newStage);
  }

  // Handle Next Step (Create Task)
  const nextStep = formData.get("next_step") as string;
  const nextStepDate = formData.get("next_step_date") as string;

  if (nextStep) {
    const { error: taskError } = await supabase.from("tasks").insert({
      user_id: user.id,
      customer_id: customerId,
      description: nextStep,
      due_date: nextStepDate || null, // Optional due date
      priority: "Normal", // Default priority
      is_completed: false,
    });

    if (taskError) {
      console.error("Error creating task:", taskError);
    }
  }

  // Mark associated task as completed if exists
  const taskId = formData.get("task_id") as string;
  if (taskId) {
    const { error: updateError } = await supabase
      .from("tasks")
      .update({ is_completed: true })
      .eq("id", taskId)
      .eq("user_id", user.id);

    if (updateError) {
      console.error("Error updating task status:", updateError);
    }
  }

  revalidatePath("/dashboard");
  revalidatePath("/visits");
  return { message: "Visit logged successfully", success: true };
}

export async function getVisitsByCustomer(customerId: string) {
  const supabase = await createClient();

  const { data } = await supabase
    .from("visits")
    .select("*")
    .eq("customer_id", customerId)
    .order("timestamp", { ascending: false });

  return data || [];
}
