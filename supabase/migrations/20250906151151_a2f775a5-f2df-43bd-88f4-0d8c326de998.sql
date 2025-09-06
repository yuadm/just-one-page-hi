-- Fix the reset_all_leave_balances function to remove updated_at reference
CREATE OR REPLACE FUNCTION reset_all_leave_balances()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
    updated_count integer := 0;
    settings_data json;
    default_days integer := 28;
    existing_settings_id uuid;
BEGIN
    -- Check if user is admin
    IF NOT public.is_admin_user() THEN
        RAISE EXCEPTION 'Access denied. Admin privileges required.';
    END IF;

    -- Get default leave days from settings
    SELECT get_leave_settings_internal() INTO settings_data;
    IF settings_data IS NOT NULL AND settings_data->>'default_leave_days' IS NOT NULL THEN
        default_days := (settings_data->>'default_leave_days')::integer;
    END IF;

    -- Update all active employees' leave balances
    -- Fix: Remove updated_at since employees table doesn't have this column
    UPDATE employees 
    SET 
        remaining_leave_days = default_days,
        leave_taken = 0
    WHERE is_active = true OR is_active IS NULL;

    GET DIAGNOSTICS updated_count = ROW_COUNT;

    -- Update last_auto_reset_at in settings
    -- First check if record exists
    SELECT id INTO existing_settings_id
    FROM system_settings 
    WHERE setting_key = 'leave_settings'
    LIMIT 1;

    IF existing_settings_id IS NOT NULL THEN
        -- Update existing record
        UPDATE system_settings 
        SET 
            setting_value = jsonb_set(
                COALESCE(setting_value::jsonb, '{}'::jsonb),
                '{last_auto_reset_at}',
                to_jsonb(NOW()::text)
            ),
            updated_at = NOW()
        WHERE id = existing_settings_id;
    ELSE
        -- Insert new record
        INSERT INTO system_settings (setting_key, setting_value, description, created_at, updated_at)
        VALUES (
            'leave_settings',
            jsonb_set(
                COALESCE(settings_data::jsonb, '{}'::jsonb),
                '{last_auto_reset_at}',
                to_jsonb(NOW()::text)
            ),
            'Leave management settings',
            NOW(),
            NOW()
        );
    END IF;

    RETURN updated_count;
END;
$$;