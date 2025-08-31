
import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Leave, Employee, LeaveType } from "../types";

interface Branch {
  id: string;
  name: string;
}

export function useLeaveData() {
  const [leaves, setLeaves] = useState<Leave[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [leaveTypes, setLeaveTypes] = useState<LeaveType[]>([]);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  const fetchData = async () => {
    try {
      setLoading(true);
      
      // Fetch leaves with employee and leave type data - use leave_requests table
      const { data: leavesData, error: leavesError } = await supabase
        .from('leave_requests')
        .select(`
          *,
          employees!leave_requests_employee_id_fkey(id, name, email, employee_code, remaining_leave_days, leave_taken, branch, branch_id),
          leave_types!leave_requests_leave_type_id_fkey(id, name, reduces_balance)
        `)
        .order('created_at', { ascending: false });

      if (leavesError) throw leavesError;

      // Fetch employees
      const { data: employeesData, error: employeesError } = await supabase
        .from('employees')
        .select('id, name, email, employee_code, remaining_leave_days, leave_taken, branch, branch_id')
        .order('name');

      if (employeesError) throw employeesError;

      // Fetch leave types
      const { data: leaveTypesData, error: leaveTypesError } = await supabase
        .from('leave_types')
        .select('*')
        .order('name');

      if (leaveTypesError) throw leaveTypesError;

      // Fetch branches
      const { data: branchesData, error: branchesError } = await supabase
        .from('branches')
        .select('id, name')
        .order('name');

      if (branchesError) throw branchesError;

      console.log('Leave data fetched:', {
        leavesCount: leavesData?.length || 0,
        employeesCount: employeesData?.length || 0,
        leaveTypesCount: leaveTypesData?.length || 0,
        branchesCount: branchesData?.length || 0,
        sampleLeave: leavesData?.[0]
      });

      // Get approved_by and rejected_by user IDs to fetch their details
      const approvedByIds = leavesData
        ?.map(leave => leave.approved_by)
        .filter(id => id) as string[];
      
      const rejectedByIds = leavesData
        ?.map(leave => leave.rejected_by)
        .filter(id => id) as string[];
      
      const allUserIds = [...new Set([...approvedByIds, ...rejectedByIds])];
      
      let userRoles: any[] = [];
      if (allUserIds.length > 0) {
        const { data: userRolesData } = await supabase
          .from('user_roles')
          .select('user_id, email')
          .in('user_id', allUserIds);
        userRoles = userRolesData || [];
      }

      // Transform the data to match our interface
      const transformedLeaves = leavesData?.map(leave => {
        // Calculate days from date range
        const startDate = new Date(leave.start_date);
        const endDate = new Date(leave.end_date);
        const days = Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)) + 1;
        
        const approvedByUser = userRoles.find(ur => ur.user_id === leave.approved_by);
        const rejectedByUser = userRoles.find(ur => ur.user_id === leave.rejected_by);
        
        return {
          ...leave,
          days, // Add calculated days field
          days_requested: leave.days_requested || days, // Use days_requested from DB or calculated
          status: leave.status as 'pending' | 'approved' | 'rejected',
          employee: leave.employees,
          leave_type: leave.leave_types,
          employee_name: leave.employees?.name || '',
          leave_type_name: leave.leave_types?.name || '',
          employee_branch_id: leave.employees?.branch_id || '',
          approved_by_user: approvedByUser || null,
          rejected_by_user: rejectedByUser || null
        };
      }) || [];

      setLeaves(transformedLeaves);
      setEmployees(employeesData || []);
      setLeaveTypes(leaveTypesData || []);
      setBranches(branchesData || []);
    } catch (error) {
      console.error('Error fetching data:', error);
      toast({
        title: "Error loading data",
        description: "Could not fetch leave data. Please try again.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  return {
    leaves,
    employees,
    leaveTypes,
    branches,
    loading,
    refetchData: fetchData
  };
}
