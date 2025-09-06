
import { useState } from "react";
import { Plus, Search, Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { LeaveRequestDialog } from "./LeaveRequestDialog";
import { LeaveTable } from "./LeaveTable";
import { LeaveStats } from "./LeaveStats";
import { LeaveDialogs } from "./LeaveDialogs";
import { useLeaveData } from "./hooks/useLeaveData";
import { useLeaveActions } from "./hooks/useLeaveActions";
import { usePermissions } from "@/contexts/PermissionsContext";
import { usePagePermissions } from "@/hooks/usePagePermissions";
import { Leave } from "./types";

export function LeavesContent() {
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [branchFilter, setBranchFilter] = useState<string>('all');
  const [leaveTypeFilter, setLeaveTypeFilter] = useState<string>('all');
  const [dialogOpen, setDialogOpen] = useState(false);
  
  // Dialog states
  const [selectedLeave, setSelectedLeave] = useState<Leave | null>(null);
  const [viewDialogOpen, setViewDialogOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  
  // Sorting states
  const [sortField, setSortField] = useState<'employee_name' | 'leave_type' | 'start_date' | 'days' | 'status' | 'created_at'>('created_at');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');

  const { 
    leaves, 
    loading, 
    branches,
    leaveTypes,
    employees,
    refetchData 
  } = useLeaveData();

  const {
    updateLeaveStatus,
    updateLeave,
    deleteLeave
  } = useLeaveActions({ leaves, employees, leaveTypes, refetchData });

  // Get permissions context
  const { isAdmin, getAccessibleBranches, loading: permissionsLoading, error: permissionsError } = usePermissions();
  const { 
    canViewLeaves, 
    canCreateLeaves, 
    canEditLeaves, 
    canDeleteLeaves, 
    canApproveLeaves 
  } = usePagePermissions();

  // Debug permissions
  console.log('PERMISSIONS DEBUG:', {
    canViewLeaves: canViewLeaves(),
    canCreateLeaves: canCreateLeaves(),
    canEditLeaves: canEditLeaves(),
    canDeleteLeaves: canDeleteLeaves(),
    canApproveLeaves: canApproveLeaves(),
    isAdmin,
    loading: permissionsLoading,
    error: permissionsError,
    accessibleBranches: getAccessibleBranches()
  });

  const filteredLeaves = leaves.filter(leave => {
    const matchesSearch = leave.employee_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         leave.leave_type_name?.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesStatus = statusFilter === 'all' || leave.status === statusFilter;
    const matchesBranch = branchFilter === 'all' || leave.employee_branch_id === branchFilter;
    const matchesLeaveType = leaveTypeFilter === 'all' || leave.leave_type_id === leaveTypeFilter;
    
    // For non-admin users, filter by accessible branches
    const accessibleBranches = getAccessibleBranches();
    
    let hasAccess = true;
    if (!isAdmin) {
      // Get employee's branch ID - try multiple sources
      let employeeBranchId = leave.employee_branch_id;
      
      // If employee_branch_id is empty/null, try to map from branch name
      if (!employeeBranchId && leave.employee?.branch) {
        const matchingBranch = branches.find(b => b.name === leave.employee.branch);
        employeeBranchId = matchingBranch?.id;
      }
      
      console.log('Branch access check:', {
        isAdmin,
        employeeName: leave.employee?.name,
        employeeBranch: leave.employee?.branch,
        employeeBranchId,
        accessibleBranches,
        accessibleBranchesLength: accessibleBranches.length,
        hasAccess: employeeBranchId ? accessibleBranches.includes(employeeBranchId) : true
      });
      
      // If user has accessible branches, check if employee belongs to one of them
      if (accessibleBranches.length > 0) {
        if (employeeBranchId) {
          hasAccess = accessibleBranches.includes(employeeBranchId);
        } else {
          // If no branch ID but has branch name, check by name
          const branchNames = branches
            .filter(b => accessibleBranches.includes(b.id))
            .map(b => b.name);
          hasAccess = leave.employee?.branch ? branchNames.includes(leave.employee.branch) : false;
        }
      }
      // If user has no accessible branches (empty array), they can see all leaves
    }
    
    return matchesSearch && matchesStatus && matchesBranch && matchesLeaveType && hasAccess;
  });

  // Sort leaves with pending first (two-tier sorting)
  const sortedLeaves = [...filteredLeaves].sort((a, b) => {
    // Primary sort: pending leaves first
    const aStatusPriority = a.status === 'pending' ? 0 : 1;
    const bStatusPriority = b.status === 'pending' ? 0 : 1;
    
    if (aStatusPriority !== bStatusPriority) {
      return aStatusPriority - bStatusPriority;
    }
    
    // Secondary sort: apply user's selected sorting within status groups
    let aValue: any = a[sortField];
    let bValue: any = b[sortField];
    
    if (sortField === 'employee_name') {
      aValue = a.employee?.name || '';
      bValue = b.employee?.name || '';
    } else if (sortField === 'leave_type') {
      aValue = a.leave_type?.name || '';
      bValue = b.leave_type?.name || '';
    }
    
    if (sortDirection === 'asc') {
      return aValue > bValue ? 1 : -1;
    } else {
      return aValue < bValue ? 1 : -1;
    }
  });

  const handleSort = (field: typeof sortField) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  };

  const handleViewLeave = (leave: Leave) => {
    setSelectedLeave(leave);
    setViewDialogOpen(true);
  };

  const handleEditLeave = (leave: Leave) => {
    setSelectedLeave(leave);
    setEditDialogOpen(true);
  };

  const handleDeleteLeave = (leave: Leave) => {
    setSelectedLeave(leave);
    setDeleteDialogOpen(true);
  };

  const handleUpdateStatus = async (leaveId: string, status: 'approved' | 'rejected' | 'pending', managerNotes?: string) => {
    await updateLeaveStatus(leaveId, status, managerNotes);
    refetchData();
  };

  const handleUpdateLeave = async (data: {
    employee_id: string;
    leave_type_id: string;
    start_date: string;
    end_date: string;
    days_requested: number;
    notes: string;
  }) => {
    if (selectedLeave) {
      await updateLeave(selectedLeave.id, data);
      setEditDialogOpen(false);
      refetchData();
    }
  };

  const handleDeleteConfirm = async () => {
    if (selectedLeave) {
      await deleteLeave(selectedLeave.id);
      setDeleteDialogOpen(false);
      refetchData();
    }
  };

  const handleStatusFilter = (status: 'all' | 'pending' | 'approved' | 'rejected') => {
    setStatusFilter(status);
  };

  const handleExport = () => {
    const headers = [
      'Employee Name',
      'Leave Type',
      'Start Date',
      'End Date',
      'Days Requested',
      'Status',
      'Manager Notes',
      'Branch',
      'Created Date'
    ];

    const csvData = sortedLeaves.map(leave => [
      leave.employee?.name || '',
      leave.leave_type?.name || '',
      leave.start_date,
      leave.end_date,
      leave.days_requested?.toString() || '',
      leave.status,
      leave.manager_notes || '',
      leave.employee?.branch || '',
      new Date(leave.created_at).toLocaleDateString()
    ]);

    const csvContent = [
      headers.join(','),
      ...csvData.map(row => row.map(cell => `"${cell}"`).join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `leaves-export-${new Date().toISOString().split('T')[0]}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  if (loading) {
    return (
      <div className="space-y-6 animate-pulse">
        <div className="h-8 bg-muted rounded-lg w-64"></div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-24 bg-muted rounded-xl"></div>
          ))}
        </div>
        <div className="h-96 bg-muted rounded-xl"></div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 animate-fade-in">
        <div className="space-y-2">
          <h1 className="text-4xl font-bold bg-gradient-primary bg-clip-text text-transparent">
            Leave Management
          </h1>
          <p className="text-lg text-muted-foreground">
            Manage employee leave requests and time off
          </p>
        </div>
        
        <div className="flex items-center gap-3">
          <Button variant="outline" size="sm" onClick={handleExport}>
            <Download className="w-4 h-4 mr-2" />
            Export
          </Button>
          {canCreateLeaves() && (
            <Button 
              className="bg-gradient-primary hover:opacity-90"
              onClick={() => setDialogOpen(true)}
            >
              <Plus className="w-4 h-4 mr-2" />
              Request Leave
            </Button>
          )}
        </div>
      </div>

      {/* Search and Filters */}
      <div className="flex flex-col sm:flex-row gap-4 animate-slide-up">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Search leaves..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10 bg-card border-input-border"
          />
        </div>
        
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[150px]">
            <SelectValue placeholder="All Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Status</SelectItem>
            <SelectItem value="pending">Pending</SelectItem>
            <SelectItem value="approved">Approved</SelectItem>
            <SelectItem value="rejected">Rejected</SelectItem>
          </SelectContent>
        </Select>

        <Select value={branchFilter} onValueChange={setBranchFilter}>
          <SelectTrigger className="w-[150px]">
            <SelectValue placeholder="All Branches" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Branches</SelectItem>
            {branches.map((branch) => (
              <SelectItem key={branch.id} value={branch.id}>
                {branch.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={leaveTypeFilter} onValueChange={setLeaveTypeFilter}>
          <SelectTrigger className="w-[150px]">
            <SelectValue placeholder="All Types" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Types</SelectItem>
            {leaveTypes.map((type) => (
              <SelectItem key={type.id} value={type.id}>
                {type.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Stats */}
      <LeaveStats leaves={leaves} onStatusFilter={handleStatusFilter} />

      {/* Leave Table */}
      <LeaveTable 
        leaves={sortedLeaves}
        sortField={sortField}
        sortDirection={sortDirection}
        onSort={handleSort}
        onViewLeave={canViewLeaves() ? handleViewLeave : undefined}
        onEditLeave={canEditLeaves() ? handleEditLeave : undefined}
        onDeleteLeave={canDeleteLeaves() ? handleDeleteLeave : undefined}
        onUpdateStatus={canApproveLeaves() ? handleUpdateStatus : undefined}
      />

      {/* Leave Request Dialog */}
      <LeaveRequestDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        onSuccess={refetchData}
      />

      {/* Leave Dialogs */}
      <LeaveDialogs
        selectedLeave={selectedLeave}
        employees={employees}
        leaveTypes={leaveTypes}
        viewDialogOpen={viewDialogOpen}
        editDialogOpen={editDialogOpen}
        deleteDialogOpen={deleteDialogOpen}
        onViewDialogClose={() => setViewDialogOpen(false)}
        onEditDialogClose={() => setEditDialogOpen(false)}
        onDeleteDialogClose={() => setDeleteDialogOpen(false)}
        onUpdateLeave={handleUpdateLeave}
        onDeleteLeave={handleDeleteConfirm}
      />
    </div>
  );
}
