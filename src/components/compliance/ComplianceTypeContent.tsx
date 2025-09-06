import { useState, useEffect, useMemo } from "react";
import { useParams, useLocation, useNavigate } from "react-router-dom";
import { ArrowLeft, Calendar, Users, CheckCircle, AlertTriangle, Clock, Shield, Eye, Edit, Trash2, ArrowUpDown, ArrowUp, ArrowDown, Filter, Download, Search } from "lucide-react";
import { usePermissions } from "@/contexts/PermissionsContext";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useCompany } from "@/contexts/CompanyContext";
import { CompliancePeriodView } from "./CompliancePeriodView";
import { AddComplianceRecordModal } from "./AddComplianceRecordModal";
import { EditComplianceRecordModal } from "./EditComplianceRecordModal";
import { format } from "date-fns";
import { generateSpotCheckPdf } from "@/lib/spot-check-pdf";
import { generateSupervisionPdf } from "@/lib/supervision-pdf";
import SpotCheckFormDialog, { SpotCheckFormData } from "./SpotCheckFormDialog";
import SupervisionFormDialog, { SupervisionFormData } from "./SupervisionFormDialog";

interface ComplianceType {
  id: string;
  name: string;
  description: string;
  frequency: string;
  created_at: string;
}

interface Employee {
  id: string;
  name: string;
  branch: string;
  branch_id?: string;
}

interface Branch {
  id: string;
  name: string;
}

interface ComplianceRecord {
  id: string;
  employee_id: string;
  period_identifier: string;
  completion_date: string;
  notes: string;
  status: string;
  created_at: string;
  updated_at: string;
  completed_by: string | null;
  completion_method?: string;
}

interface EmployeeComplianceStatus {
  employee: Employee;
  record: ComplianceRecord | null;
  status: 'compliant' | 'overdue' | 'due' | 'pending';
  currentPeriod: string;
}

type SortField = 'name' | 'branch' | 'completion_status' | 'completion_date';
type SortDirection = 'asc' | 'desc';

export function ComplianceTypeContent() {
  const { id } = useParams<{ id: string }>();
  const location = useLocation();
  const navigate = useNavigate();
  const { toast } = useToast();
  const { getAccessibleBranches, isAdmin } = usePermissions();
  const { companySettings } = useCompany();
  
  const [complianceType, setComplianceType] = useState<ComplianceType | null>(
    location.state?.complianceType || null
  );
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [records, setRecords] = useState<ComplianceRecord[]>([]);
  const [employeeStatusList, setEmployeeStatusList] = useState<EmployeeComplianceStatus[]>([]);
  const [loading, setLoading] = useState(true);
  const [filteredStatus, setFilteredStatus] = useState<'compliant' | 'overdue' | 'due' | 'pending' | null>(null);
  const [sortField, setSortField] = useState<SortField>('name');
  const [sortDirection, setSortDirection] = useState<SortDirection>('asc');
  const [branchFilter, setBranchFilter] = useState<string>('all');
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [completedByUsers, setCompletedByUsers] = useState<{ [key: string]: { name: string; created_at: string } }>({});

// Spot check edit state
const [spotcheckEditOpen, setSpotcheckEditOpen] = useState(false);
const [spotcheckInitialData, setSpotcheckInitialData] = useState<SpotCheckFormData | null>(null);
const [spotcheckRowId, setSpotcheckRowId] = useState<string | null>(null);
const [spotcheckTarget, setSpotcheckTarget] = useState<{ employeeId: string; period: string } | null>(null);
// Supervision edit state
const [supervisionEditOpen, setSupervisionEditOpen] = useState(false);
const [supervisionInitialData, setSupervisionInitialData] = useState<SupervisionFormData | null>(null);
const [supervisionTarget, setSupervisionTarget] = useState<{ recordId: string } | null>(null);

  // Get unique branches for filter - filtered by user access
  const uniqueBranches = useMemo(() => {
    const accessibleBranches = getAccessibleBranches();
    let branchNames = [...new Set(employeeStatusList.map(emp => emp.employee.branch))];
    
    // Filter branches based on user permissions
    if (!isAdmin && accessibleBranches.length > 0) {
      branchNames = branchNames.filter(branchName => {
        const branchId = branches.find(b => b.name === branchName)?.id;
        return accessibleBranches.includes(branchId || '');
      });
    }
    
    return branchNames.sort();
  }, [employeeStatusList, branches, getAccessibleBranches, isAdmin]);

  // Filtered and sorted employees
  const filteredAndSortedEmployees = useMemo(() => {
    let filtered = employeeStatusList;

    // Apply search filter
    if (searchTerm.trim()) {
      filtered = filtered.filter(item =>
        item.employee.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        item.employee.branch.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    // Apply status filter
    if (filteredStatus) {
      filtered = filtered.filter(item => item.status === filteredStatus);
    }

    // Apply branch filter
    if (branchFilter !== 'all') {
      filtered = filtered.filter(item => item.employee.branch === branchFilter);
    }

    // For non-admin users, filter by accessible branches
    const accessibleBranches = getAccessibleBranches();
    if (!isAdmin && accessibleBranches.length > 0) {
      // Filter employees by accessible branches
      filtered = filtered.filter(item => {
        // Map branch name to branch ID and check if it's in accessible branches
        const employeeBranchId = branches.find(b => b.name === item.employee.branch)?.id;
        return accessibleBranches.includes(employeeBranchId || '');
      });
    }

    // Apply sorting
    return filtered.sort((a, b) => {
      let aValue: any;
      let bValue: any;

      switch (sortField) {
        case 'name':
          aValue = a.employee.name;
          bValue = b.employee.name;
          break;
        case 'branch':
          aValue = a.employee.branch;
          bValue = b.employee.branch;
          break;
        case 'completion_status':
          const statusOrder = { 'compliant': 3, 'due': 2, 'overdue': 1, 'pending': 0 };
          aValue = statusOrder[a.status] || 0;
          bValue = statusOrder[b.status] || 0;
          break;
        case 'completion_date':
          // Safely handle dates and text values for sorting
          aValue = a.record?.completion_date ? (() => {
            const date = new Date(a.record.completion_date);
            return isNaN(date.getTime()) ? 0 : date.getTime();
          })() : 0;
          bValue = b.record?.completion_date ? (() => {
            const date = new Date(b.record.completion_date);
            return isNaN(date.getTime()) ? 0 : date.getTime();
          })() : 0;
          break;
        default:
          aValue = a.employee.name;
          bValue = b.employee.name;
      }

      if (typeof aValue === 'string' && typeof bValue === 'string') {
        return sortDirection === 'asc' 
          ? aValue.localeCompare(bValue)
          : bValue.localeCompare(aValue);
      }

      if (sortDirection === 'asc') {
        return aValue < bValue ? -1 : aValue > bValue ? 1 : 0;
      } else {
        return aValue > bValue ? -1 : aValue < bValue ? 1 : 0;
      }
    });
  }, [employeeStatusList, searchTerm, filteredStatus, branchFilter, sortField, sortDirection]);

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  };

  const getSortIcon = (field: SortField) => {
    if (sortField !== field) {
      return <ArrowUpDown className="w-4 h-4" />;
    }
    return sortDirection === 'asc' 
      ? <ArrowUp className="w-4 h-4" />
      : <ArrowDown className="w-4 h-4" />;
  };

  useEffect(() => {
    if (!complianceType && id) {
      fetchComplianceType();
    } else {
      fetchData();
    }
  }, [id, complianceType]);

  const fetchComplianceType = async () => {
    if (!id) return;
    
    try {
      const { data, error } = await supabase
        .from('compliance_types')
        .select('*')
        .eq('id', id)
        .single();

      if (error) throw error;

      setComplianceType(data);
      fetchData();
    } catch (error) {
      console.error('Error fetching compliance type:', error);
      toast({
        title: "Error loading compliance type",
        description: "Could not fetch compliance type details.",
        variant: "destructive",
      });
      setLoading(false);
    }
  };

  const fetchData = async () => {
    if (!id) return;

    try {
      setLoading(true);
      
      // Fetch all employees
      const { data: employeesData, error: employeesError } = await supabase
        .from('employees')
        .select('id, name, branch, branch_id')
        .order('name');

      if (employeesError) throw employeesError;

      // Fetch branches
      const { data: branchesData, error: branchesError } = await supabase
        .from('branches')
        .select('id, name')
        .order('name');

      if (branchesError) throw branchesError;

      // Fetch compliance records for this type
      const { data: recordsData, error: recordsError } = await supabase
        .from('compliance_period_records')
        .select('*')
        .eq('compliance_type_id', id)
        .order('completion_date', { ascending: false });

      if (recordsError) throw recordsError;

      setEmployees(employeesData || []);
      setBranches(branchesData || []);
      setRecords(recordsData || []);
      
      // Fetch user details for completed_by
      if (recordsData && recordsData.length > 0) {
        const userIds = recordsData
          .map(record => record.completed_by)
          .filter(Boolean);
        
        if (userIds.length > 0) {
          const { data: usersData, error: usersError } = await supabase
            .from('employees')
            .select('id, name')
            .in('id', userIds);

          if (usersError) {
            console.error('Error fetching user data:', usersError);
          } else if (usersData) {
            const usersMap: { [key: string]: { name: string; created_at: string } } = {};
            recordsData.forEach(record => {
              if (record.completed_by) {
                const user = usersData.find(u => u.id === record.completed_by);
                if (user) {
                  usersMap[record.id] = {
                    name: user.name,
                    created_at: record.created_at
                  };
                }
              }
            });
            setCompletedByUsers(usersMap);
          }
        }
      }
      
      // Calculate employee compliance status
      if (complianceType) {
        calculateEmployeeStatus(employeesData || [], recordsData || []);
      }
    } catch (error) {
      console.error('Error fetching data:', error);
      toast({
        title: "Error loading data",
        description: "Could not fetch employee and compliance data.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const getCurrentPeriodIdentifier = (frequency: string): string => {
    const now = new Date();
    const year = now.getFullYear();
    const month = now.getMonth() + 1;
    const quarter = Math.ceil(month / 3);

    switch (frequency.toLowerCase()) {
      case 'annual':
        return year.toString();
      case 'monthly':
        return `${year}-${month.toString().padStart(2, '0')}`;
      case 'quarterly':
        return `${year}-Q${quarter}`;
      case 'bi-annual':
        return `${year}-H${month <= 6 ? '1' : '2'}`;
      default:
        return year.toString();
    }
  };

  const calculateEmployeeStatus = (employeesData: Employee[], recordsData: ComplianceRecord[]) => {
    if (!complianceType) return;

    const currentPeriod = getCurrentPeriodIdentifier(complianceType.frequency);
    
    const statusList: EmployeeComplianceStatus[] = employeesData.map(employee => {
      // Find the latest record for this employee in the current period
      const currentRecord = recordsData.find(record => 
        record.employee_id === employee.id && 
        record.period_identifier === currentPeriod
      );

      let status: 'compliant' | 'overdue' | 'due' | 'pending' = 'pending';

      if (currentRecord) {
        // A record is compliant if it has a completion_date (text or valid date) or status is completed
        if (currentRecord.status === 'completed' || currentRecord.completion_date) {
          status = 'compliant';
        } else if (currentRecord.status === 'overdue') {
          status = 'overdue';
        } else {
          status = 'due';
        }
      } else {
        // Check if we're past the period (this would be overdue)
        const now = new Date();
        const isOverdue = isPeriodOverdue(currentPeriod, complianceType.frequency, now);
        status = isOverdue ? 'overdue' : 'due';
      }

      return {
        employee,
        record: currentRecord || null,
        status,
        currentPeriod
      };
    });

    setEmployeeStatusList(statusList);
  };

  const isPeriodOverdue = (periodIdentifier: string, frequency: string, currentDate: Date): boolean => {
    const now = currentDate;
    
    switch (frequency.toLowerCase()) {
      case 'annual': {
        const year = parseInt(periodIdentifier);
        const endOfYear = new Date(year, 11, 31); // December 31st
        return now > endOfYear;
      }
      case 'monthly': {
        const [year, month] = periodIdentifier.split('-').map(Number);
        const endOfMonth = new Date(year, month, 0); // Last day of the month
        return now > endOfMonth;
      }
      case 'quarterly': {
        const [year, quarterStr] = periodIdentifier.split('-');
        const quarter = parseInt(quarterStr.replace('Q', ''));
        const endMonth = quarter * 3; // Q1=3, Q2=6, Q3=9, Q4=12
        const endOfQuarter = new Date(parseInt(year), endMonth, 0); // Last day of quarter
        return now > endOfQuarter;
      }
      case 'bi-annual': {
        const [year, halfStr] = periodIdentifier.split('-');
        const half = parseInt(halfStr.replace('H', ''));
        const endMonth = half === 1 ? 6 : 12;
        const endOfHalf = new Date(parseInt(year), endMonth, 0);
        return now > endOfHalf;
      }
      default:
        return false;
    }
  };

  const getFrequencyIcon = (frequency: string) => {
    switch (frequency.toLowerCase()) {
      case 'weekly':
        return <Calendar className="w-6 h-6 text-primary" />;
      case 'monthly':
        return <Calendar className="w-6 h-6 text-success" />;
      case 'quarterly':
        return <Calendar className="w-6 h-6 text-warning" />;
      case 'bi-annual':
        return <Calendar className="w-6 h-6 text-destructive" />;
      case 'annual':
        return <Calendar className="w-6 h-6 text-destructive" />;
      default:
        return <Clock className="w-6 h-6 text-muted-foreground" />;
    }
  };

  const getFrequencyColor = (frequency: string) => {
    switch (frequency.toLowerCase()) {
      case 'weekly':
        return 'bg-primary/10 text-primary border-primary/20';
      case 'monthly':
        return 'bg-success/10 text-success border-success/20';
      case 'quarterly':
        return 'bg-warning/10 text-warning border-warning/20';
      case 'bi-annual':
      case 'annual':
        return 'bg-destructive/10 text-destructive border-destructive/20';
      default:
        return 'bg-muted text-muted-foreground border-border';
    }
  };

  const getStatusBadge = (status: 'compliant' | 'overdue' | 'due' | 'pending') => {
    switch (status) {
      case 'compliant':
        return <Badge className="bg-success/10 text-success border-success/20">Compliant</Badge>;
      case 'overdue':
        return <Badge className="bg-destructive/10 text-destructive border-destructive/20">Overdue</Badge>;
      case 'due':
        return <Badge className="bg-warning/10 text-warning border-warning/20">Due</Badge>;
      case 'pending':
        return <Badge className="bg-muted text-muted-foreground border-border">Pending</Badge>;
      default:
        return <Badge className="bg-muted text-muted-foreground border-border">{status}</Badge>;
    }
  };

  const getStatusColor = (status: 'compliant' | 'overdue' | 'due' | 'pending') => {
    switch (status) {
      case 'compliant':
        return 'bg-success/5 border-success/20';
      case 'overdue':
        return 'bg-destructive/5 border-destructive/20';
      case 'due':
        return 'bg-warning/5 border-warning/20';
      default:
        return '';
    }
  };

  const handleDeleteRecord = async (recordId: string) => {
    try {
      const { error } = await supabase
        .from('compliance_period_records')
        .delete()
        .eq('id', recordId);

      if (error) throw error;

      toast({
        title: "Record deleted",
        description: "Compliance record has been permanently deleted.",
      });

      fetchData();
    } catch (error) {
      console.error('Error deleting compliance record:', error);
      toast({
        title: "Error deleting record",
        description: "Could not delete compliance record. Please try again.",
        variant: "destructive",
      });
    }
  };

const handleDownloadSpotCheck = async (employeeId: string, period: string) => {
  if (!id) return;
  try {
    const { data, error } = await supabase
      .from('spot_check_records')
      .select('service_user_name, care_worker1, care_worker2, check_date, time_from, time_to, carried_by, observations')
      .eq('employee_id', employeeId)
      .eq('compliance_type_id', id)
      .eq('period_identifier', period)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) throw error;

    if (!data) {
      toast({ title: 'No spot check found', description: 'No spot check form was saved for this period.', variant: 'destructive' });
      return;
    }

    const formData = {
      serviceUserName: (data as any).service_user_name || '',
      careWorker1: (data as any).care_worker1 || '',
      careWorker2: (data as any).care_worker2 || '',
      date: (data as any).check_date || '',
      timeFrom: (data as any).time_from || '',
      timeTo: (data as any).time_to || '',
      carriedBy: (data as any).carried_by || '',
      observations: ((data as any).observations as any) || [],
    } as import('./SpotCheckFormDialog').SpotCheckFormData;

    await generateSpotCheckPdf(formData, companySettings);
  } catch (err) {
    console.error('Error generating spot check PDF:', err);
    toast({ title: 'Error', description: 'Could not generate the spot check PDF.', variant: 'destructive' });
  }
};

const handleDownloadSupervision = async (record: ComplianceRecord) => {
  try {
    if (!record.notes) {
      toast({ title: 'No data', description: 'No supervision form data found.', variant: 'destructive' });
      return;
    }
    const data = JSON.parse(record.notes) as SupervisionFormData;
    await generateSupervisionPdf(data, companySettings);
  } catch (err) {
    console.error('Error generating supervision PDF:', err);
    toast({ title: 'Error', description: 'Could not generate the supervision PDF.', variant: 'destructive' });
  }
};

const handleOpenSupervisionEdit = (record: ComplianceRecord) => {
  try {
    const init: SupervisionFormData | null = record.notes ? JSON.parse(record.notes) : null;
    setSupervisionInitialData(init);
    setSupervisionTarget({ recordId: record.id });
    setSupervisionEditOpen(true);
  } catch (err) {
    console.error('Error loading supervision form:', err);
    toast({ title: 'Error', description: 'Could not load supervision form.', variant: 'destructive' });
  }
};

const handleSaveSupervisionEdit = async (formData: SupervisionFormData) => {
  if (!supervisionTarget) return;
  try {
    const { error } = await supabase
      .from('compliance_period_records')
      .update({
        completion_date: formData.dateOfSupervision,
        completion_method: 'supervision',
        updated_at: new Date().toISOString(),
        notes: JSON.stringify(formData),
        status: formData.officeComplete ? 'completed' : 'pending',
      })
      .eq('id', supervisionTarget.recordId);
    if (error) throw error;
    toast({ title: 'Supervision updated', description: 'The supervision form has been saved.' });
    setSupervisionEditOpen(false);
    setSupervisionInitialData(null);
    setSupervisionTarget(null);
    fetchData();
  } catch (err) {
    console.error('Error saving supervision form:', err);
    toast({ title: 'Error', description: 'Could not save the supervision form.', variant: 'destructive' });
  }
};

const handleOpenSpotcheckEdit = async (employeeId: string, period: string) => {
  if (!id) return;
  try {
    const { data, error } = await supabase
      .from('spot_check_records')
      .select('id, service_user_name, care_worker1, care_worker2, check_date, time_from, time_to, carried_by, observations')
      .eq('employee_id', employeeId)
      .eq('compliance_type_id', id)
      .eq('period_identifier', period)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) throw error;

    const initial: SpotCheckFormData = {
      serviceUserName: (data as any)?.service_user_name || '',
      careWorker1: (data as any)?.care_worker1 || '',
      careWorker2: (data as any)?.care_worker2 || '',
      date: (data as any)?.check_date || '',
      timeFrom: (data as any)?.time_from || '',
      timeTo: (data as any)?.time_to || '',
      carriedBy: (data as any)?.carried_by || '',
      observations: (((data as any)?.observations) as any) || [],
    };

    setSpotcheckInitialData(initial);
    setSpotcheckRowId((data as any)?.id || null);
    setSpotcheckTarget({ employeeId, period });
    setSpotcheckEditOpen(true);
  } catch (err) {
    console.error('Error loading spot check form:', err);
    toast({ title: 'Error', description: 'Could not load spot check form.', variant: 'destructive' });
  }
};

const handleSaveSpotcheckEdit = async (formData: SpotCheckFormData) => {
  if (!id || !spotcheckTarget) return;
  try {
    const observationsPayload: any = formData.observations ? JSON.parse(JSON.stringify(formData.observations)) : null;

    if (spotcheckRowId) {
      const { error: updateErr } = await supabase
        .from('spot_check_records')
        .update({
          service_user_name: formData.serviceUserName,
          care_worker1: formData.careWorker1,
          care_worker2: formData.careWorker2 || null,
          check_date: formData.date,
          time_from: formData.timeFrom,
          time_to: formData.timeTo,
          carried_by: formData.carriedBy,
          observations: observationsPayload,
        })
        .eq('id', spotcheckRowId);
      if (updateErr) throw updateErr;
    } else {
      const { error: insertErr } = await supabase
        .from('spot_check_records')
        .insert({
          service_user_name: formData.serviceUserName,
          care_worker1: formData.careWorker1,
          care_worker2: formData.careWorker2 || null,
          check_date: formData.date,
          time_from: formData.timeFrom,
          time_to: formData.timeTo,
          carried_by: formData.carriedBy,
          observations: observationsPayload,
          employee_id: spotcheckTarget.employeeId,
          compliance_type_id: id,
          period_identifier: spotcheckTarget.period,
        });
      if (insertErr) throw insertErr;
    }

    const { error: recErr } = await supabase
      .from('compliance_period_records')
      .update({
        completion_date: formData.date,
        completion_method: 'spotcheck',
        updated_at: new Date().toISOString(),
        status: 'completed',
      })
      .eq('employee_id', spotcheckTarget.employeeId)
      .eq('compliance_type_id', id)
      .eq('period_identifier', spotcheckTarget.period);
    if (recErr) throw recErr;

    toast({ title: 'Spot check updated', description: 'The spot check form has been saved.' });
    setSpotcheckEditOpen(false);
    setSpotcheckRowId(null);
    setSpotcheckInitialData(null);
    setSpotcheckTarget(null);
    fetchData();
  } catch (err) {
    console.error('Error saving spot check form:', err);
    toast({ title: 'Error', description: 'Could not save the spot check form.', variant: 'destructive' });
  }
};

const handleStatusCardClick = (status: 'compliant' | 'overdue' | 'due' | 'pending') => {
  setFilteredStatus(filteredStatus === status ? null : status);
};

  const getFilteredEmployeeList = () => {
    return filteredAndSortedEmployees;
  };

  // Filter employee status list based on user permissions for stats calculation
  const filteredEmployeeStatusForStats = useMemo(() => {
    const accessibleBranches = getAccessibleBranches();
    if (!isAdmin && accessibleBranches.length > 0) {
      return employeeStatusList.filter(item => {
        const employeeBranchId = branches.find(b => b.name === item.employee.branch)?.id;
        return accessibleBranches.includes(employeeBranchId || '');
      });
    }
    return employeeStatusList;
  }, [employeeStatusList, branches, getAccessibleBranches, isAdmin]);

  if (loading) {
    return (
      <div className="space-y-6 animate-pulse">
        <div className="h-8 bg-muted rounded-lg w-64"></div>
        <div className="h-48 bg-muted rounded-xl"></div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-32 bg-muted rounded-xl"></div>
          ))}
        </div>
      </div>
    );
  }

  if (!complianceType) {
    return (
      <div className="text-center py-12">
        <Shield className="w-16 h-16 mx-auto text-muted-foreground/50 mb-4" />
        <h3 className="text-lg font-semibold mb-2">Compliance type not found</h3>
        <Button onClick={() => navigate('/compliance')} variant="outline">
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back to Compliance
        </Button>
      </div>
    );
  }

  // Calculate stats from filtered employee status list
  const compliantCount = filteredEmployeeStatusForStats.filter(item => item.status === 'compliant').length;
  const overdueCount = filteredEmployeeStatusForStats.filter(item => item.status === 'overdue').length;
  const dueCount = filteredEmployeeStatusForStats.filter(item => item.status === 'due').length;
  const pendingCount = filteredEmployeeStatusForStats.filter(item => item.status === 'pending').length;
  const totalEmployeeCount = filteredEmployeeStatusForStats.length;

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 animate-fade-in">
        <div className="space-y-2">
          <div className="flex items-center gap-3">
            <Button 
              variant="ghost" 
              size="sm" 
              onClick={() => navigate('/compliance')}
              className="p-2"
            >
              <ArrowLeft className="w-4 h-4" />
            </Button>
            <h1 className="text-4xl font-bold bg-gradient-primary bg-clip-text text-transparent">
              {complianceType.name}
            </h1>
          </div>
          <p className="text-lg text-muted-foreground ml-11">
            {complianceType.description}
          </p>
        </div>
      </div>

      {/* Compliance Type Details */}
      <Card className="card-premium animate-slide-up">
        <CardHeader>
          <CardTitle className="flex items-center gap-3">
            <Calendar className="w-6 h-6 text-primary" />
            Compliance Requirements
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-4">
              <div>
                <h3 className="font-semibold text-foreground mb-2">Frequency</h3>
                <Badge className={`capitalize`}>
                  {complianceType.frequency}
                </Badge>
              </div>
              
              <div>
                <h3 className="font-semibold text-foreground mb-2">Current Period</h3>
                <Badge variant="secondary">
                  {getCurrentPeriodIdentifier(complianceType.frequency)}
                </Badge>
              </div>
            </div>

            <div className="space-y-4">
              <div>
                <h3 className="font-semibold text-foreground mb-2">Employee Compliance</h3>
                <p className="text-2xl font-bold text-foreground">
                  {compliantCount}/{totalEmployeeCount}
                </p>
                <p className="text-sm text-muted-foreground">
                  {totalEmployeeCount > 0 ? Math.round((compliantCount / totalEmployeeCount) * 100) : 0}% compliant
                </p>
              </div>
              
              <div>
                <h3 className="font-semibold text-foreground mb-2">Branch Completion</h3>
                <div className="space-y-2">
                  {uniqueBranches.map((branch) => {
                    const branchEmployees = filteredEmployeeStatusForStats.filter(item => item.employee.branch === branch);
                    const branchCompliant = branchEmployees.filter(item => item.status === 'compliant').length;
                    const branchTotal = branchEmployees.length;
                    const percentage = branchTotal > 0 ? Math.round((branchCompliant / branchTotal) * 100) : 0;
                    
                    return (
                      <div key={branch} className="flex justify-between items-center">
                        <span className="text-sm text-muted-foreground">{branch}</span>
                        <span className="text-sm font-medium">{percentage}%</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Stats Overview */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6 animate-slide-up">
        <Card 
          className={`card-premium border-success/20 bg-gradient-to-br from-success-soft to-card cursor-pointer transition-all duration-300 hover:shadow-glow ${
            filteredStatus === 'compliant' ? 'ring-2 ring-success' : ''
          }`}
          onClick={() => handleStatusCardClick('compliant')}
        >
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Compliant</p>
                <p className="text-2xl font-bold text-success">{compliantCount}</p>
              </div>
              <CheckCircle className="w-8 h-8 text-success" />
            </div>
          </CardContent>
        </Card>

        <Card 
          className={`card-premium border-warning/20 bg-gradient-to-br from-warning-soft to-card cursor-pointer transition-all duration-300 hover:shadow-glow ${
            filteredStatus === 'due' ? 'ring-2 ring-warning' : ''
          }`}
          onClick={() => handleStatusCardClick('due')}
        >
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Due</p>
                <p className="text-2xl font-bold text-warning">{dueCount}</p>
              </div>
              <Clock className="w-8 h-8 text-warning" />
            </div>
          </CardContent>
        </Card>

        <Card 
          className={`card-premium border-destructive/20 bg-gradient-to-br from-destructive-soft to-card cursor-pointer transition-all duration-300 hover:shadow-glow ${
            filteredStatus === 'overdue' ? 'ring-2 ring-destructive' : ''
          }`}
          onClick={() => handleStatusCardClick('overdue')}
        >
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Overdue</p>
                <p className="text-2xl font-bold text-destructive">{overdueCount}</p>
              </div>
              <AlertTriangle className="w-8 h-8 text-destructive" />
            </div>
          </CardContent>
        </Card>

        <Card 
          className={`card-premium border-muted/20 cursor-pointer transition-all duration-300 hover:shadow-glow ${
            filteredStatus === 'pending' ? 'ring-2 ring-muted-foreground' : ''
          }`}
          onClick={() => handleStatusCardClick('pending')}
        >
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Pending</p>
                <p className="text-2xl font-bold text-muted-foreground">{pendingCount}</p>
              </div>
              <Users className="w-8 h-8 text-muted-foreground" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Tabs for Employee Records and Period View */}
      <Tabs defaultValue="employees" className="space-y-6">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="employees">Employee Compliance Status</TabsTrigger>
          <TabsTrigger value="periods">Period Records</TabsTrigger>
        </TabsList>

        <TabsContent value="employees" className="space-y-6">
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <div className="space-y-1">
                <h2 className="text-2xl font-bold text-foreground">
                  All Employees - Current Period: {getCurrentPeriodIdentifier(complianceType?.frequency || '')}
                </h2>
                {filteredStatus && (
                  <p className="text-sm text-muted-foreground">
                    Showing {filteredStatus} employees only. Click the card again to show all.
                  </p>
                )}
              </div>
            </div>
            
            <Card className="card-premium">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="flex items-center gap-3">
                    <Users className="w-6 h-6" />
                    Employee Compliance Status
                  </CardTitle>
                  <div className="flex items-center gap-4">
                    {/* Search */}
                    <div className="relative">
                      <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                      <Input
                        placeholder="Search employees..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="pl-10 w-64 bg-background border-border/50 focus:border-primary/50"
                      />
                    </div>
                    
                    {/* Branch Filter */}
                    <div className="flex items-center gap-2">
                      <Filter className="w-4 h-4" />
                      <Select value={branchFilter} onValueChange={setBranchFilter}>
                        <SelectTrigger className="w-40">
                          <SelectValue placeholder="Filter by branch" />
                        </SelectTrigger>
                       <SelectContent>
                          <SelectItem value="all">All Branches</SelectItem>
                          {/* Only show branches that the user has access to */}
                          {(() => {
                            const accessibleBranches = getAccessibleBranches();
                            const branchesToShow = isAdmin 
                              ? uniqueBranches 
                              : uniqueBranches.filter(branchName => {
                                  const branchId = branches.find(b => b.name === branchName)?.id;
                                  return accessibleBranches.includes(branchId || '');
                                });
                            
                            return branchesToShow.map((branch) => (
                              <SelectItem key={branch} value={branch}>
                                {branch}
                              </SelectItem>
                            ));
                          })()}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="p-0">{getFilteredEmployeeList().length === 0 ? (
                <div className="p-12 text-center">
                  <Users className="w-16 h-16 mx-auto text-muted-foreground/50 mb-4" />
                  <h3 className="text-lg font-semibold mb-2">
                    {searchTerm.trim() ? 'No employees match your search' : (filteredStatus ? `No ${filteredStatus} employees found` : 'No employees found')}
                  </h3>
                  <p className="text-muted-foreground mb-4">
                    {searchTerm.trim() 
                      ? `Try adjusting your search criteria or clearing the search to see all employees.`
                      : (filteredStatus 
                        ? `No employees have ${filteredStatus} status for this compliance type.`
                        : 'No employees are available for compliance tracking.'
                      )
                    }
                  </p>
                  {searchTerm.trim() && (
                    <Button 
                      variant="outline" 
                      onClick={() => setSearchTerm('')}
                      className="mt-2"
                    >
                      Clear Search
                    </Button>
                  )}
                </div>
              ) : (
                <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead 
                          className="cursor-pointer hover:bg-muted/50"
                          onClick={() => handleSort('name')}
                        >
                          <div className="flex items-center gap-2">
                            Employee
                            {getSortIcon('name')}
                          </div>
                        </TableHead>
                        <TableHead 
                          className="cursor-pointer hover:bg-muted/50"
                          onClick={() => handleSort('branch')}
                        >
                          <div className="flex items-center gap-2">
                            Branch
                            {getSortIcon('branch')}
                          </div>
                        </TableHead>
                        <TableHead 
                          className="cursor-pointer hover:bg-muted/50"
                          onClick={() => handleSort('completion_status')}
                        >
                          <div className="flex items-center gap-2">
                            Status
                            {getSortIcon('completion_status')}
                          </div>
                        </TableHead>
                        <TableHead 
                          className="cursor-pointer hover:bg-muted/50"
                          onClick={() => handleSort('completion_date')}
                        >
                          <div className="flex items-center gap-2">
                            Completion Date
                            {getSortIcon('completion_date')}
                          </div>
                        </TableHead>
                        <TableHead>Notes</TableHead>
                        <TableHead className="text-right">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {getFilteredEmployeeList().map((item) => (
                        <TableRow key={item.employee.id} className={getStatusColor(item.status)}>
                          <TableCell className="font-medium">
                            {item.employee.name}
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline">
                              {item.employee.branch}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            {getStatusBadge(item.status)}
                          </TableCell>
                          <TableCell>
                            {item.record ? (() => {
                              const date = new Date(item.record.completion_date);
                              return isNaN(date.getTime()) 
                                ? item.record.completion_date 
                                : date.toLocaleDateString();
                            })() : '-'}
                          </TableCell>
                          <TableCell className="max-w-xs">
                             <div className="truncate" title={(() => {
                               if (!item.record?.notes) return '';
                               if (item.record?.completion_method === 'supervision' || item.record?.completion_method === 'annual_appraisal') {
                                 try {
                                   const j = JSON.parse(item.record.notes);
                                   const txt = (j?.freeTextNotes || '').toString().trim();
                                   return txt || '';
                                 } catch {
                                   return '';
                                 }
                               }
                               return item.record?.notes || '';
                             })()}>
                               {(() => {
                                 if (!item.record?.notes) return '-';
                                 if (item.record?.completion_method === 'supervision' || item.record?.completion_method === 'annual_appraisal') {
                                   try {
                                     const j = JSON.parse(item.record.notes);
                                     const txt = (j?.freeTextNotes || '').toString().trim();
                                     return txt || '-';
                                   } catch {
                                     return '-';
                                   }
                                 }
                                 return item.record?.notes || '-';
                               })()}
                             </div>
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center justify-end gap-2">
                              {!item.record && (
                                <AddComplianceRecordModal
                                  employeeId={item.employee.id}
                                  employeeName={item.employee.name}
                                  complianceTypeId={complianceType?.id || ''}
                                  complianceTypeName={complianceType?.name || ''}
                                  frequency={complianceType?.frequency || ''}
                                  periodIdentifier={item.currentPeriod}
                                  onRecordAdded={fetchData}
                                  trigger={
                                    <Button variant="outline" size="sm" className="hover-scale">
                                      Add Record
                                    </Button>
                                  }
                                />
                              )}
                              
{item.record && (
  <>
    {item.record.completion_method === 'spotcheck' && (
      <Button
        variant="ghost"
        size="sm"
        className="hover-scale"
        onClick={() => handleDownloadSpotCheck(item.employee.id, item.record!.period_identifier)}
      >
        <Download className="w-4 h-4" />
      </Button>
    )}
    {item.record.completion_method === 'supervision' && (
      <Button
        variant="ghost"
        size="sm"
        className="hover-scale"
        onClick={() => handleDownloadSupervision(item.record!)}
      >
        <Download className="w-4 h-4" />
      </Button>
    )}
    {item.record.completion_method === 'annual_appraisal' && item.record.status === 'completed' && (
      <Button
        variant="ghost"
        size="sm"
        className="hover-scale"
        onClick={() => {
          if (item.record?.notes) {
            try {
              const parsedData = JSON.parse(item.record.notes);
              import('@/lib/annual-appraisal-pdf').then(({ generateAnnualAppraisalPDF }) => {
                generateAnnualAppraisalPDF(parsedData, item.employee.name, {
                  name: companySettings?.name,
                  logo: companySettings?.logo
                });
              });
            } catch (error) {
              console.error('Error generating PDF:', error);
              toast({
                title: "Error generating PDF",
                description: "Could not generate annual appraisal PDF.",
                variant: "destructive",
              });
            }
          }
        }}
      >
        <Download className="w-4 h-4" />
      </Button>
    )}
    {item.record.completion_method === 'supervision' && item.record.status !== 'completed' && (
      <Badge className="bg-warning/10 text-warning border-warning/20">Not completed</Badge>
    )}
    {/* View Dialog */}
                                  <Dialog>
                                    <DialogTrigger asChild>
                                      <Button variant="ghost" size="sm" className="hover-scale">
                                        <Eye className="w-4 h-4" />
                                      </Button>
                                    </DialogTrigger>
                                    <DialogContent className="max-w-md">
                                      <DialogHeader>
                                        <DialogTitle className="flex items-center gap-2">
                                          <Eye className="w-5 h-5" />
                                          Compliance Record Details
                                        </DialogTitle>
                                        <DialogDescription>
                                          View details for this compliance record.
                                        </DialogDescription>
                                      </DialogHeader>
                                      <div className="space-y-4">
                                        <div className="grid grid-cols-2 gap-4">
                                          <div>
                                            <h4 className="font-semibold text-sm text-muted-foreground">Employee</h4>
                                            <p className="font-medium">{item.employee.name}</p>
                                          </div>
                                          <div>
                                            <h4 className="font-semibold text-sm text-muted-foreground">Branch</h4>
                                            <p className="font-medium">{item.employee.branch}</p>
                                          </div>
                                          <div>
                                            <h4 className="font-semibold text-sm text-muted-foreground">Period</h4>
                                            <p className="font-medium">{item.record.period_identifier}</p>
                                          </div>
                                          <div>
                                            <h4 className="font-semibold text-sm text-muted-foreground">Status</h4>
                                            {getStatusBadge(item.status)}
                                          </div>
                                           <div>
                                             <h4 className="font-semibold text-sm text-muted-foreground">Completion Date</h4>
<p className="font-medium">{(() => {
  const date = new Date(item.record.completion_date);
  return isNaN(date.getTime()) 
    ? item.record.completion_date 
    : date.toLocaleDateString();
})()}</p>
                                           </div>
                                          <div>
                                            <h4 className="font-semibold text-sm text-muted-foreground">Created</h4>
                                            <p className="font-medium">{new Date(item.record.created_at).toLocaleDateString()}</p>
                                          </div>
                                        </div>
                                        {completedByUsers[item.record.id] && (
                                          <div className="border-t pt-4">
                                            <h4 className="font-semibold text-sm text-muted-foreground mb-2">Inputted By</h4>
                                            <div className="bg-muted p-3 rounded-md">
                                              <p className="font-medium">{completedByUsers[item.record.id].name}</p>
                                              <p className="text-sm text-muted-foreground">
                                                {new Date(completedByUsers[item.record.id].created_at).toLocaleDateString()} at{' '}
                                                {new Date(completedByUsers[item.record.id].created_at).toLocaleTimeString()}
                                              </p>
                                            </div>
                                          </div>
                                        )}
                                        {item.record.notes && (
                                          <div>
                                            <h4 className="font-semibold text-sm text-muted-foreground mb-2">Notes</h4>
                                             <p className="text-sm bg-muted p-3 rounded-md">
                                               {(() => {
                                                 if (!item.record?.notes) return '';
                                                 if (item.record?.completion_method === 'supervision' || item.record?.completion_method === 'annual_appraisal') {
                                                   try {
                                                     const j = JSON.parse(item.record.notes);
                                                     const txt = (j?.freeTextNotes || '').toString().trim();
                                                     return txt || '';
                                                   } catch {
                                                     return '';
                                                   }
                                                 }
                                                 return item.record?.notes || '';
                                               })()}
                                             </p>
                                          </div>
                                        )}
                                      </div>
                                    </DialogContent>
                                  </Dialog>

{/* Edit Record */}
{item.record.completion_method === 'spotcheck' ? (
  <Button
    variant="ghost"
    size="sm"
    className="hover-scale"
    onClick={() => handleOpenSpotcheckEdit(item.employee.id, item.record!.period_identifier)}
  >
    <Edit className="w-4 h-4" />
  </Button>
) : item.record.completion_method === 'supervision' ? (
  <Button
    variant="ghost"
    size="sm"
    className="hover-scale"
    onClick={() => handleOpenSupervisionEdit(item.record!)}
  >
    <Edit className="w-4 h-4" />
  </Button>
) : (
  <EditComplianceRecordModal
    record={item.record}
    employeeName={item.employee.name}
    complianceTypeName={complianceType?.name || ''}
    frequency={complianceType?.frequency || ''}
    onRecordUpdated={fetchData}
    trigger={
      <Button variant="ghost" size="sm" className="hover-scale">
        <Edit className="w-4 h-4" />
      </Button>
    }
  />
)}

                                  {/* Delete Dialog */}
                                  <AlertDialog>
                                    <AlertDialogTrigger asChild>
                                      <Button variant="ghost" size="sm" className="hover-scale text-destructive hover:text-destructive">
                                        <Trash2 className="w-4 h-4" />
                                      </Button>
                                    </AlertDialogTrigger>
                                    <AlertDialogContent>
                                      <AlertDialogHeader>
                                        <AlertDialogTitle className="flex items-center gap-2">
                                          <AlertTriangle className="w-5 h-5 text-destructive" />
                                          Delete Compliance Record?
                                        </AlertDialogTitle>
                                        <AlertDialogDescription>
                                          This action cannot be undone. This will permanently delete the compliance record for {item.employee.name}.
                                        </AlertDialogDescription>
                                      </AlertDialogHeader>
                                      <AlertDialogFooter>
                                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                                        <AlertDialogAction 
                                          className="bg-destructive hover:bg-destructive/90"
                                          onClick={() => handleDeleteRecord(item.record!.id)}
                                        >
                                          Delete Record
                                        </AlertDialogAction>
                                      </AlertDialogFooter>
                                    </AlertDialogContent>
                                  </AlertDialog>
                                
                                  </>
                              )}
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                     </TableBody>
                   </Table>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="periods" className="space-y-6">
          <CompliancePeriodView 
            complianceTypeId={complianceType?.id || ''} 
            complianceTypeName={complianceType?.name || ''}
            frequency={complianceType?.frequency || ''} 
          />
        </TabsContent>
      </Tabs>

{/* Spot Check Edit Dialog */}
<SpotCheckFormDialog
  open={spotcheckEditOpen}
  onOpenChange={setSpotcheckEditOpen}
  initialData={spotcheckInitialData || undefined}
  periodIdentifier={spotcheckTarget?.period}
  frequency={complianceType?.frequency}
  onSubmit={handleSaveSpotcheckEdit}
/>
{/* Supervision Edit Dialog */}
<SupervisionFormDialog
  open={supervisionEditOpen}
  onOpenChange={setSupervisionEditOpen}
  initialData={supervisionInitialData || undefined}
  onSubmit={handleSaveSupervisionEdit}
/>
    </div>
  );
}
