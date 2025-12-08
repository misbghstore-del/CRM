"use server";

import { createClient } from "@/utils/supabase/server";
import { revalidatePath } from "next/cache";

export type ActionState = {
  error?: string;
  message?: string;
  success?: boolean;
};

export async function createCustomer(
  prevState: ActionState | null,
  formData: FormData
) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { error: "You must be logged in to create a customer" };
  }

  const name = formData.get("name") as string;
  const type = formData.get("type") as string;
  const contact_person = formData.get("contact_person") as string;
  const phone = formData.get("phone") as string;
  const address = formData.get("address") as string;
  const city = formData.get("city") as string;
  const site_description = formData.get("site_description") as string;
  const architect_id = formData.get("architect_id") as string;
  const builder_id = formData.get("builder_id") as string;
  const dealer_id = formData.get("dealer_id") as string;
  const location_lat = formData.get("location_lat");
  const location_lng = formData.get("location_lng");
  const sitePhotoFile = formData.get("site_photo") as File;
  const profession = formData.get("profession") as string;

  let stage = "New Lead";
  if (type === "Professional") {
    stage = "Active";
  } else if (type === "Site") {
    stage = "Active"; // Or 'New' or whatever the default is for Site
  }

  let site_photo_url = null;
  if (sitePhotoFile && sitePhotoFile.size > 0) {
    const fileExt = sitePhotoFile.name.split(".").pop();
    const fileName = `${user.id}/${Date.now()}.${fileExt}`;
    const { error: uploadError } = await supabase.storage
      .from("visit-photos") // Reusing visit-photos bucket for now, or create 'customer-photos'
      .upload(fileName, sitePhotoFile);

    if (!uploadError) {
      const {
        data: { publicUrl },
      } = supabase.storage.from("visit-photos").getPublicUrl(fileName);
      site_photo_url = publicUrl;
    }
  }

  const { error } = await supabase.from("customers").insert({
    name,
    type,
    contact_person,
    phone,
    address,
    city,
    stage,
    assigned_to: user.id,
    created_by: user.id,
    meeting_count: 0,
    site_description: site_description || null,
    architect_id: architect_id || null,
    builder_id: builder_id || null,
    dealer_id: dealer_id || null,
    site_photo_url: site_photo_url,
    location_lat: location_lat ? parseFloat(location_lat.toString()) : null,
    location_lng: location_lng ? parseFloat(location_lng.toString()) : null,
    profession: profession || null,
  });

  if (error) {
    return { error: error.message };
  }

  revalidatePath("/customers");
  return { message: "Customer created successfully", success: true };
}

export async function updateCustomerStage(
  customerId: string,
  stage: string,
  meetingCount?: number,
  closingStatus?: "Converted" | "Not Converted"
) {
  const supabase = await createClient();

  const updateData: { stage: string; meeting_count?: number; type?: string } = {
    stage,
  };

  if (meetingCount !== undefined) {
    updateData.meeting_count = meetingCount;
  }

  // If closing, we might want to store the status in notes or a separate field.
  // For now, let's append it to the stage or just keep it as 'Closed - Converted' ?
  // The requirement says "closing status the lead is converted or not converted".
  // Let's store it in the stage string for simplicity: 'Closed - Converted' or 'Closed - Not Converted'
  if (stage === "Closed" && closingStatus) {
    updateData.stage = `Closed - ${closingStatus}`;

    // Auto-convert Prospect Dealer to Dealer when converted
    if (closingStatus === "Converted") {
      const { data: customer } = await supabase
        .from("customers")
        .select("type")
        .eq("id", customerId)
        .single();

      if (customer?.type === "Prospect Dealer") {
        updateData.type = "Dealer";
      }
    }
  }

  const { error } = await supabase
    .from("customers")
    .update(updateData)
    .eq("id", customerId);

  if (error) {
    return { error: error.message };
  }

  revalidatePath(`/customers/${customerId}`);
  revalidatePath("/customers");
  return { message: "Stage updated successfully", success: true };
}

export async function updateCustomer(customerId: string, formData: FormData) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { error: "You must be logged in to update a customer" };
  }

  const name = formData.get("name") as string;
  const contact_person = formData.get("contact_person") as string;
  const phone = formData.get("phone") as string;
  const address = formData.get("address") as string;
  const city = formData.get("city") as string;

  const { error } = await supabase
    .from("customers")
    .update({
      name,
      contact_person,
      phone,
      address,
      city,
      last_edited_by: user.id,
      last_edited_at: new Date().toISOString(),
    })
    .eq("id", customerId);

  if (error) {
    return { error: error.message };
  }

  revalidatePath(`/customers/${customerId}`);
  revalidatePath("/customers");
  return { message: "Customer updated successfully", success: true };
}
