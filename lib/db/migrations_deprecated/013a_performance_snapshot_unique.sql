-- Add unique constraint to performance_snapshots on (user_id, date)
ALTER TABLE performance_snapshots ADD CONSTRAINT perf_snap_user_date UNIQUE (user_id, date);
