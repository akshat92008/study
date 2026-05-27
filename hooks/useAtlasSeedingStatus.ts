// hooks/useAtlasSeedingStatus.ts
/**
 * React hook to monitor Atlas seeding status for the current user.
 * It polls the `profiles` table for the columns added in migration 034_seeding_status.sql:
 *   - atlas_seeding_status (pending | seeding | complete | failed)
 *   - atlas_seeding_concepts_total (total concepts to seed)
 *   - atlas_seeding_concepts_done (how many concepts have been seeded)
 *
 * The hook returns an object containing the current status string, total concepts,
 * done concepts, and a derived progress percentage (0-100). It uses Supabase client
 * (`@/lib/supabase/client`) to query the `profiles` table for the authenticated user.
 *
 * Usage example:
 *   const { status, total, done, progress } = useAtlasSeedingStatus();
 *   // render UI based on `status` and `progress`
 */
import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";

// Define the shape of the status data
export interface AtlasSeedingStatus {
  status: "pending" | "seeding" | "complete" | "failed";
  total: number;
  done: number;
  progress: number; // percentage 0-100
  isSeeding: boolean;
  isComplete: boolean;
  progressPercent: number;
  conceptsDone: number;
  conceptsTotal: number;
}

/**
 * Hook to retrieve and continuously poll the seeding status for the logged‑in user.
 * It polls every 5 seconds – a reasonable interval to keep UI responsive without
 * overloading the database.
 */
export function useAtlasSeedingStatus(): AtlasSeedingStatus {
  const [status, setStatus] = useState<AtlasSeedingStatus>({
    status: "pending",
    total: 0,
    done: 0,
    progress: 0,
    isSeeding: false,
    isComplete: false,
    progressPercent: 0,
    conceptsDone: 0,
    conceptsTotal: 0,
  });

  useEffect(() => {
    // Initialise Supabase client – it respects the user's auth session stored in cookies.
    const supabase = createClient();

    // Helper to fetch the latest values from the `profiles` table.
    const fetchStatus = async () => {
      // The `auth.user()` method returns the current session user.
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        // Not logged in – keep status as pending.
        setStatus((prev) => ({ ...prev, status: "pending" }));
        return;
      }

      const { data, error } = await supabase
        .from("profiles")
        .select(
          "atlas_seeding_status, atlas_seeding_concepts_total, atlas_seeding_concepts_done"
        )
        .eq("id", user.id)
        .single();

      if (error) {
        console.error("Error fetching seeding status:", error);
        // In case of an error, we maintain the last known state.
        return;
      }

      const currStatus: "pending" | "seeding" | "complete" | "failed" =
        data?.atlas_seeding_status ?? "pending";
      const total = Number(data?.atlas_seeding_concepts_total) || 0;
      const done = Number(data?.atlas_seeding_concepts_done) || 0;
      const progress = total > 0 ? Math.round((done / total) * 100) : 0;

      setStatus({
        status: currStatus,
        total,
        done,
        progress,
        isSeeding: currStatus === "seeding",
        isComplete: currStatus === "complete",
        progressPercent: progress,
        conceptsDone: done,
        conceptsTotal: total,
      });
    };

    // Initial fetch
    fetchStatus();
    // Poll every 5 seconds
    const interval = setInterval(fetchStatus, 5000);
    return () => clearInterval(interval);
  }, []);

  return status;
}
