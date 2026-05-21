-- 018_transactions_and_rls.sql
-- Phase 11: Reliability & Failure Prevention Hardening

-- 1. Create a secure RPC function for Atomic Mock Processing
-- This ensures that when AUTOPSY finishes, the Mock, ATLAS, and MEMORY updates
-- all succeed or all fail together. No partial writes allowed.

CREATE OR REPLACE FUNCTION process_autopsy_transaction(
    p_user_id uuid,
    p_mock_id uuid,
    p_score int,
    p_recoverable_marks int,
    p_atlas_updates jsonb[],
    p_memory_cards jsonb[]
) RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    -- Start Transaction Block
    
    -- 1. Update Mock Test record
    UPDATE mock_tests 
    SET 
        status = 'completed',
        score = p_score,
        recoverable_marks = p_recoverable_marks,
        processed_at = now()
    WHERE id = p_mock_id AND user_id = p_user_id;

    -- 2. Bulk update ATLAS nodes
    -- Assuming p_atlas_updates is an array of objects: { "node_id": uuid, "mastery_delta": float }
    IF array_length(p_atlas_updates, 1) > 0 THEN
        FOR i IN 1 .. array_length(p_atlas_updates, 1) LOOP
            UPDATE atlas_nodes
            SET 
                mastery_level = LEAST(1.0, mastery_level + (p_atlas_updates[i]->>'mastery_delta')::float),
                last_tested_at = now()
            WHERE id = (p_atlas_updates[i]->>'node_id')::uuid 
            AND user_id = p_user_id;
        END LOOP;
    END IF;

    -- 3. Bulk insert MEMORY cards (FSRS-5)
    -- Assuming p_memory_cards is an array of objects: { "front": text, "back": text, "tags": text[] }
    IF array_length(p_memory_cards, 1) > 0 THEN
        FOR i IN 1 .. array_length(p_memory_cards, 1) LOOP
            INSERT INTO revision_cards (
                user_id,
                front,
                back,
                tags,
                state,
                stability,
                difficulty,
                elapsed_days,
                scheduled_days,
                reps,
                lapses
            ) VALUES (
                p_user_id,
                p_memory_cards[i]->>'front',
                p_memory_cards[i]->>'back',
                ARRAY(SELECT jsonb_array_elements_text(p_memory_cards[i]->'tags')),
                0, -- New card state = 0
                0,
                0,
                0,
                0,
                0,
                0
            );
        END LOOP;
    END IF;

    -- If we got here, everything succeeded. The transaction will commit.
    RETURN true;
EXCEPTION
    WHEN OTHERS THEN
        -- If anything fails, Postgres automatically rolls back the transaction.
        -- We log the error and raise it so the client knows it failed.
        RAISE WARNING 'process_autopsy_transaction failed: %', SQLERRM;
        RAISE EXCEPTION 'Transaction failed and was rolled back.';
END;
$$;
