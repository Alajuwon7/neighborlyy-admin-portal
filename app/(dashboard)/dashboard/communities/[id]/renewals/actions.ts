"use server";

import { revalidatePath } from "next/cache";
import { getCommunityWithAuth } from "@/lib/queries";
import { reportMonthStart, validateLeaseRows } from "@/lib/rent-roll";

export type SaveRentRollResult =
  | { error: string }
  | { success: true; saved: number; keptNewer: number; replaced: number };

/**
 * Save a previewed rent roll. The browser parses the CSV (names and other
 * columns never leave it) and sends only unit / lease end / outcome rows;
 * they are re-validated here and saved in one transaction by
 * import_rent_roll (portal migration 036), which runs under the PM's RLS.
 */
export async function saveRentRoll(input: {
  communityId: string;
  reportMonth: string; // YYYY-MM
  fileName: string;
  rows: unknown;
  rowsRejected: number;
}): Promise<SaveRentRollResult> {
  // Redirects away if the caller isn't a PM who manages this community.
  const { supabase, community } = await getCommunityWithAuth(input.communityId);

  const month = reportMonthStart(input.reportMonth);
  if (!month) return { error: "Pick the month this rent roll is for." };

  const rows = validateLeaseRows(input.rows);
  if (!rows) return { error: "Some rows couldn't be read. Re-select the file and try again." };
  if (rows.length === 0) return { error: "There are no valid rows to save." };

  const rejected = Number.isInteger(input.rowsRejected) && input.rowsRejected >= 0 ? input.rowsRejected : 0;
  const fileName = typeof input.fileName === "string" ? input.fileName.slice(0, 200) : null;

  const { data, error } = await supabase.rpc("import_rent_roll", {
    p_community_code: community.community_code,
    p_report_month: month,
    p_file_name: fileName,
    p_rows: rows,
    p_rows_rejected: rejected,
  });

  if (error) {
    console.error("import_rent_roll failed:", error);
    if (/not authori[sz]ed/i.test(error.message)) {
      return { error: "You don't have permission to upload for this community." };
    }
    return { error: "Couldn't save the rent roll. Please try again." };
  }

  const result = (data ?? {}) as { saved?: number; kept_newer?: number; replaced?: number };
  revalidatePath(`/dashboard/communities/${input.communityId}/renewals`);
  revalidatePath(`/dashboard/communities/${input.communityId}/insights`);
  return {
    success: true,
    saved: result.saved ?? 0,
    keptNewer: result.kept_newer ?? 0,
    replaced: result.replaced ?? 0,
  };
}
