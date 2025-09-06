-- Leave Management Database Functions (Fixed Version)
-- Run these commands in your Supabase SQL editor

-- Function to get leave settings from system_settings table (internal version without admin check)
CREATE OR REPLACE FUNCTION get_leave_settings_internal()
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    settings_value json;
BEGIN
    -- Get leave settings from system_settings table
    SELECT setting_value INTO settings_value
    FROM system_settings 
    WHERE setting_key = 'leave_settings'
    ORDER BY updated_at DESC
    LIMIT 1;

    -- Return settings or default values
    IF settings_value IS NOT NULL THEN
        RETURN settings_value;
    ELSE
        RETURN json_build_object(
            'default_leave_days', 28,
            'fiscal_year_start_month', 4,
            'fiscal_year_start_day', 1,
            'enable_auto_reset', true,
            'last_auto_reset_at', null
        );
    END IF;
END;
$$;

-- Function to get leave settings from system_settings table (public version with admin check)
CREATE OR REPLACE FUNCTION get_leave_settings()
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    -- Check if user is admin
    IF NOT public.is_admin_user() THEN
        RAISE EXCEPTION 'Access denied. Admin privileges required.';
    END IF;

    RETURN get_leave_settings_internal();
END;
$$;

-- Function to reset all employee leave balances
CREATE OR REPLACE FUNCTION reset_all_leave_balances()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
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
    UPDATE employees 
    SET 
        remaining_leave_days = default_days,
        leave_taken = 0,
        updated_at = NOW()
    WHERE status = 'active' OR status IS NULL;

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

-- Function to run annual reset if needed based on fiscal year
CREATE OR REPLACE FUNCTION run_leave_annual_reset_if_needed()
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    settings_data json;
    fiscal_month integer := 4;
    fiscal_day integer := 1;
    enable_auto boolean := true;
    last_reset_date date;
    current_fiscal_start date;
    reset_count integer;
BEGIN
    -- Check if user is admin
    IF NOT public.is_admin_user() THEN
        RAISE EXCEPTION 'Access denied. Admin privileges required.';
    END IF;

    -- Get fiscal year settings
    SELECT get_leave_settings_internal() INTO settings_data;
    
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

    -- Calculate current fiscal year start date
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
GRANT EXECUTE ON FUNCTION get_leave_settings_internal() TO authenticated;
GRANT EXECUTE ON FUNCTION get_leave_settings() TO authenticated;
GRANT EXECUTE ON FUNCTION reset_all_leave_balances() TO authenticated;
GRANT EXECUTE ON FUNCTION run_leave_annual_reset_if_needed() TO authenticated;