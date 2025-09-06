-- Leave Management Database Functions
-- Run these commands in your Supabase SQL editor

-- Function to get leave settings from system_settings table
CREATE OR REPLACE FUNCTION get_leave_settings()
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    settings_record RECORD;
    result json;
BEGIN
    -- Check if user is admin
    IF NOT is_admin_user() THEN
        RAISE EXCEPTION 'Access denied. Admin privileges required.';
    END IF;

    -- Get leave settings from system_settings table
    SELECT setting_value INTO settings_record
    FROM system_settings 
    WHERE setting_key = 'leave_settings'
    ORDER BY updated_at DESC
    LIMIT 1;

    -- Return settings or default values
    IF settings_record IS NOT NULL THEN
        result := settings_record.setting_value;
    ELSE
        result := json_build_object(
            'default_leave_days', 28,
            'fiscal_year_start_month', 4,
            'fiscal_year_start_day', 1,
            'enable_auto_reset', true,
            'last_auto_reset_at', null
        );
    END IF;

    RETURN result;
END;
$$;

-- Function to reset all employee leave balances
CREATE OR REPLACE FUNCTION reset_all_leave_balances()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    updated_count integer := 0;
    settings_data json;
    default_days integer := 28;
BEGIN
    -- Check if user is admin
    IF NOT is_admin_user() THEN
        RAISE EXCEPTION 'Access denied. Admin privileges required.';
    END IF;

    -- Get default leave days from settings
    SELECT get_leave_settings() INTO settings_data;
    IF settings_data IS NOT NULL AND settings_data->>'default_leave_days' IS NOT NULL THEN
        default_days := (settings_data->>'default_leave_days')::integer;
    END IF;

    -- Update all active employees' leave balances
    UPDATE employees 
    SET 
        remaining_leave_days = default_days,
        leave_taken = 0,
        updated_at = NOW()
    WHERE status = 'active' OR status IS NULL;

    GET DIAGNOSTICS updated_count = ROW_COUNT;

    -- Update last_auto_reset_at in settings
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
    )
    ON CONFLICT (setting_key) 
    DO UPDATE SET 
        setting_value = jsonb_set(
            COALESCE(EXCLUDED.setting_value::jsonb, '{}'::jsonb),
            '{last_auto_reset_at}',
            to_jsonb(NOW()::text)
        ),
        updated_at = NOW();

    RETURN updated_count;
END;
$$;

-- Function to run annual reset if needed based on fiscal year
CREATE OR REPLACE FUNCTION run_leave_annual_reset_if_needed()
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    settings_data json;
    fiscal_month integer := 4;
    fiscal_day integer := 1;
    enable_auto boolean := true;
    last_reset_date date;
    current_fiscal_start date;
    previous_fiscal_start date;
    reset_count integer;
BEGIN
    -- Check if user is admin
    IF NOT is_admin_user() THEN
        RAISE EXCEPTION 'Access denied. Admin privileges required.';
    END IF;

    -- Get fiscal year settings
    SELECT get_leave_settings() INTO settings_data;
    
    IF settings_data IS NOT NULL THEN
        fiscal_month := COALESCE((settings_data->>'fiscal_year_start_month')::integer, 4);
        fiscal_day := COALESCE((settings_data->>'fiscal_year_start_day')::integer, 1);
        enable_auto := COALESCE((settings_data->>'enable_auto_reset')::boolean, true);
        
        IF settings_data->>'last_auto_reset_at' IS NOT NULL THEN
            last_reset_date := (settings_data->>'last_auto_reset_at')::date;
        END IF;
    END IF;

    -- If auto reset is disabled, return early
    IF NOT enable_auto THEN
        RETURN 'auto_reset_disabled';
    END IF;

    -- Calculate current and previous fiscal year start dates
    current_fiscal_start := make_date(
        CASE 
            WHEN EXTRACT(MONTH FROM CURRENT_DATE) >= fiscal_month 
                 AND (EXTRACT(MONTH FROM CURRENT_DATE) > fiscal_month 
                      OR EXTRACT(DAY FROM CURRENT_DATE) >= fiscal_day)
            THEN EXTRACT(YEAR FROM CURRENT_DATE)::integer
            ELSE EXTRACT(YEAR FROM CURRENT_DATE)::integer - 1
        END,
        fiscal_month,
        fiscal_day
    );

    previous_fiscal_start := make_date(
        EXTRACT(YEAR FROM current_fiscal_start)::integer - 1,
        fiscal_month,
        fiscal_day
    );

    -- Check if reset is needed
    -- Reset if: current date >= fiscal start AND (no previous reset OR last reset was before current fiscal year)
    IF CURRENT_DATE >= current_fiscal_start 
       AND (last_reset_date IS NULL OR last_reset_date < current_fiscal_start) THEN
        
        -- Perform the reset
        SELECT reset_all_leave_balances() INTO reset_count;
        
        RETURN 'reset_performed';
    ELSE
        RETURN 'no_reset_needed';
    END IF;
END;
$$;

-- Grant execute permissions to authenticated users (admin check is inside functions)
GRANT EXECUTE ON FUNCTION get_leave_settings() TO authenticated;
GRANT EXECUTE ON FUNCTION reset_all_leave_balances() TO authenticated;
GRANT EXECUTE ON FUNCTION run_leave_annual_reset_if_needed() TO authenticated;

-- Optional: Create a cron job to run annual reset check daily (requires pg_cron extension)
-- Uncomment the following lines if you want automatic daily checks:
-- SELECT cron.schedule('daily-leave-reset-check', '0 2 * * *', 'SELECT run_leave_annual_reset_if_needed();');