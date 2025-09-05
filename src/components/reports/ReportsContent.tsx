import { useState, useEffect } from "react";
import { BarChart3, Download, FileSpreadsheet, Filter, ChevronDown, FileX } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DatePickerWithRange } from "@/components/ui/date-picker";
import { DateRange } from "react-day-picker";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Checkbox } from "@/components/ui/checkbox";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";

interface Branch {
  id: string;
  name: string;
}

interface LeaveType {
  id: string;
  name: string;
}

interface DocumentType {
  id: string;
  name: string;
}

interface ComplianceType {
  id: string;
  name: string;
  frequency: string;
  isClientType?: boolean;
}

export function ReportsContent() {
  const [selectedReport, setSelectedReport] = useState<string>("");
  const [dateRange, setDateRange] = useState<DateRange | undefined>();
  const [selectedBranch, setSelectedBranch] = useState<string>("all");
  const [selectedLeaveType, setSelectedLeaveType] = useState<string>("all");
  const [selectedLeaveStatus, setSelectedLeaveStatus] = useState<string>("all");
  const [selectedComplianceType, setSelectedComplianceType] = useState<string>("all");
  const [selectedYear, setSelectedYear] = useState<string>(new Date().getFullYear().toString());
  const [selectedMonths, setSelectedMonths] = useState<string[]>([]);
  const [selectedQuarters, setSelectedQuarters] = useState<string[]>([]);
  const [isExporting, setIsExporting] = useState(false);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [leaveTypes, setLeaveTypes] = useState<LeaveType[]>([]);
  const [documentTypes, setDocumentTypes] = useState<DocumentType[]>([]);
  const [complianceTypes, setComplianceTypes] = useState<ComplianceType[]>([]);
  const [selectedColumns, setSelectedColumns] = useState<{[key: string]: string[]}>({});
  const [isColumnSelectorOpen, setIsColumnSelectorOpen] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    fetchBranches();
    fetchLeaveTypes();
    fetchDocumentTypes();
    fetchComplianceTypes();
  }, []);

  // Re-initialize columns when document types change (for dynamic Documents Report)
  useEffect(() => {
    if (selectedReport === 'documents' && documentTypes.length > 0) {
      initializeSelectedColumns('documents');
    }
  }, [documentTypes, selectedReport]);

  const fetchBranches = async () => {
    try {
      const { data, error } = await supabase
        .from('branches')
        .select('id, name')
        .order('name');

      if (error) throw error;
      setBranches(data || []);
    } catch (error) {
      console.error('Error fetching branches:', error);
      toast({
        title: "Error loading branches",
        description: "Could not fetch branch data. Please try again.",
        variant: "destructive",
      });
    }
  };

  const fetchLeaveTypes = async () => {
    try {
      const { data, error } = await supabase
        .from('leave_types')
        .select('id, name')
        .order('name');

      if (error) throw error;
      setLeaveTypes(data || []);
    } catch (error) {
      console.error('Error fetching leave types:', error);
      toast({
        title: "Error loading leave types",
        description: "Could not fetch leave type data. Please try again.",
        variant: "destructive",
      });
    }
  };

  const fetchDocumentTypes = async () => {
    try {
      const { data, error } = await supabase
        .from('document_types')
        .select('id, name')
        .order('name');

      if (error) throw error;
      setDocumentTypes(data || []);
    } catch (error) {
      console.error('Error fetching document types:', error);
    }
  };

  const fetchComplianceTypes = async () => {
    try {
      // Fetch both employee and client compliance types
      const [employeeTypes, clientTypes] = await Promise.all([
        supabase
          .from('compliance_types')
          .select('id, name, frequency')
          .order('name'),
        supabase
          .from('client_compliance_types')
          .select('id, name, frequency')
          .order('name')
      ]);

      if (employeeTypes.error) throw employeeTypes.error;
      if (clientTypes.error) throw clientTypes.error;

      // Combine both types, marking client types
      const allTypes = [
        ...(employeeTypes.data || []),
        ...(clientTypes.data || []).map(type => ({ ...type, isClientType: true }))
      ];

      setComplianceTypes(allTypes);
    } catch (error) {
      console.error('Error fetching compliance types:', error);
      toast({
        title: "Error loading compliance types",
        description: "Could not fetch compliance type data. Please try again.",
        variant: "destructive",
      });
    }
  };

  const reportTypes = [
    {
      id: "employees",
      name: "Employees Report",
      description: "Complete employee directory with all details",
      icon: "👥",
      fields: ["Name", "Employee Code", "Job Title", "Branch", "Days Taken", "Days Remaining", "Hours", "Email", "Phone"]
    },
    {
      id: "leaves",
      name: "Leaves Report", 
      description: "Leave requests and balances",
      icon: "🌴",
      fields: ["Employee", "Employee Code", "Branch", "Type", "Start Date", "End Date", "Duration", "Days Remaining", "Status", "Reason", "Submitted Date", "Manager Notes", "Approved/Rejected By", "Approved Date", "Rejected Date"]
    },
    {
      id: "documents",
      name: "Documents Report",
      description: "Document expiration tracking",
      icon: "📄",
      fields: ["Employee Name", "Branch", "Status", "Country", "Sponsored", "20 Hours Restriction", ...documentTypes.flatMap(dt => [dt.name, `${dt.name} Days Left`])]
    },
    {
      id: "compliance",
      name: "Compliance Report",
      description: "Compliance task completion status",
      icon: "🛡️",
      fields: ["Task Name", "Employee", "Client", "Branch", "Period", "Completion Date", "Status", "Notes", "Frequency"]
    }
  ];

  // Initialize selected columns when report type changes or document types change
  const initializeSelectedColumns = (reportId: string) => {
    const reportType = reportTypes.find(r => r.id === reportId);
    if (reportType && (!selectedColumns[reportId] || reportId === 'documents')) {
      // For documents report, always reinitialize to get latest document types
      setSelectedColumns(prev => ({
        ...prev,
        [reportId]: [...reportType.fields]
      }));
    }
  };

  // Handle column selection
  const handleColumnToggle = (reportId: string, column: string, checked: boolean) => {
    setSelectedColumns(prev => ({
      ...prev,
      [reportId]: checked 
        ? [...(prev[reportId] || []), column]
        : (prev[reportId] || []).filter(col => col !== column)
    }));
  };

  // Select/Deselect all columns
  const handleSelectAllColumns = (reportId: string, selectAll: boolean) => {
    const reportType = reportTypes.find(r => r.id === reportId);
    if (reportType) {
      setSelectedColumns(prev => ({
        ...prev,
        [reportId]: selectAll ? [...reportType.fields] : []
      }));
    }
  };

  const getCurrentComplianceType = () => {
    return complianceTypes.find(type => type.id === selectedComplianceType);
  };

  const getYearOptions = () => {
    const currentYear = new Date().getFullYear();
    const years = [];
    for (let i = currentYear - 5; i <= currentYear + 1; i++) {
      years.push(i.toString());
    }
    return years;
  };

  const getMonthOptions = () => {
    return [
      { value: "01", label: "January" },
      { value: "02", label: "February" },
      { value: "03", label: "March" },
      { value: "04", label: "April" },
      { value: "05", label: "May" },
      { value: "06", label: "June" },
      { value: "07", label: "July" },
      { value: "08", label: "August" },
      { value: "09", label: "September" },
      { value: "10", label: "October" },
      { value: "11", label: "November" },
      { value: "12", label: "December" }
    ];
  };

  const getQuarterOptions = () => {
    return [
      { value: "Q1", label: "Q1 (Jan-Mar)" },
      { value: "Q2", label: "Q2 (Apr-Jun)" },
      { value: "Q3", label: "Q3 (Jul-Sep)" },
      { value: "Q4", label: "Q4 (Oct-Dec)" }
    ];
  };

  const handleMonthToggle = (month: string) => {
    setSelectedMonths(prev => 
      prev.includes(month) 
        ? prev.filter(m => m !== month)
        : [...prev, month]
    );
  };

  const handleQuarterToggle = (quarter: string) => {
    setSelectedQuarters(prev => 
      prev.includes(quarter) 
        ? prev.filter(q => q !== quarter)
        : [...prev, quarter]
    );
  };

  const calculateDaysLeft = (expiryDate: string): number => {
    const today = new Date();
    const expiry = new Date(expiryDate);
    const diffTime = expiry.getTime() - today.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays;
  };

  const formatDate = (dateString: string): string => {
    // Check if it's a valid date format (YYYY-MM-DD or similar)
    if (dateString && dateString.match(/^\d{4}-\d{2}-\d{2}/)) {
      const date = new Date(dateString);
      if (!isNaN(date.getTime())) {
        return date.toLocaleDateString('en-GB');
      }
    }
    // Return the original string if it's not a valid date
    return dateString || '';
  };

  const generateDocumentHeaders = () => {
    const baseHeaders = ['Employee Name', 'Branch', 'Status', 'Country', 'Sponsored', '20 Hours Restriction'];
    const documentHeaders: string[] = [];
    
    documentTypes.forEach(docType => {
      documentHeaders.push(docType.name);
      documentHeaders.push(`${docType.name} Days Left`);
    });
    
    return [...baseHeaders, ...documentHeaders];
  };

  const generateDocumentRow = (employee: any) => {
    const baseData = {
      'Employee Name': employee.name,
      'Branch': employee.branch,
      'Status': employee.document_tracker?.find((doc: any) => 
        doc.document_types?.name?.toLowerCase().includes('passport')
      )?.nationality_status || '',
      'Country': employee.document_tracker?.find((doc: any) => 
        doc.document_types?.name?.toLowerCase().includes('passport')
      )?.country || '',
      'Sponsored': employee.sponsored ? 'Yes' : 'No',
      '20 Hours Restriction': employee.twenty_hours ? 'Yes' : 'No'
    };

    const documentData: any = {};
    documentTypes.forEach(docType => {
      const doc = employee.document_tracker?.find((d: any) => 
        d.document_types?.name === docType.name
      );
      
      documentData[docType.name] = doc ? formatDate(doc.expiry_date) : '';
      documentData[`${docType.name} Days Left`] = doc ? calculateDaysLeft(doc.expiry_date) : '';
    });

    return { ...baseData, ...documentData };
  };

  const handleExport = async (format: 'xlsx' | 'csv') => {
    if (!selectedReport) {
      toast({
        title: "No report selected",
        description: "Please select a report type before exporting.",
        variant: "destructive",
      });
      return;
    }

    setIsExporting(true);

    try {
      let filename = "";

      switch (selectedReport) {
        case "documents":
          const { data: employeesWithDocs, error: docsError } = await supabase
            .from('employees')
            .select(`
              name,
              branch,
              sponsored,
              twenty_hours,
              document_tracker (
                document_number,
                expiry_date,
                country,
                nationality_status,
                document_types (name)
              )
            `)
            .not('document_tracker', 'is', null)
            .order('name');
          
          if (docsError) throw docsError;

          // Only include employees who actually have document_tracker entries
          const filteredEmployees = (employeesWithDocs || [])
            .filter(emp => emp.document_tracker && emp.document_tracker.length > 0);

          const allEmployees = filteredEmployees
            .filter(emp => !emp.sponsored && !emp.twenty_hours)
            .map(emp => generateDocumentRow(emp));

          const sponsoredAndTwentyHours = filteredEmployees
            .filter(emp => emp.sponsored || emp.twenty_hours)
            .map(emp => generateDocumentRow(emp));

          filename = `documents_report_${new Date().toISOString().split('T')[0]}`;

          let csvContent = '';
          csvContent += 'Sheet1: All Employees\n';
          csvContent += convertToCSV(allEmployees, selectedColumns[selectedReport]) + '\n\n';
          csvContent += 'Sheet2: Sponsored/20 Hours\n';
          csvContent += convertToCSV(sponsoredAndTwentyHours, selectedColumns[selectedReport]);

          downloadFile(csvContent, `${filename}.csv`, 'text/csv');
          break;

        case "employees":
          const { data: employeesData, error: employeesError } = await supabase
            .from('employees')
            .select('name, employee_code, job_title, branch, leave_taken, remaining_leave_days, working_hours, email, phone')
            .order('name');
          
          if (employeesError) throw employeesError;
          
          const transformedEmployeesData = (employeesData || []).map(emp => ({
            'Name': emp.name,
            'Employee Code': emp.employee_code,
            'Job Title': emp.job_title || '',
            'Branch': emp.branch,
            'Days Taken': emp.leave_taken || 0,
            'Days Remaining': emp.remaining_leave_days || 0,
            'Hours': emp.working_hours || '',
            'Email': emp.email || '',
            'Phone': emp.phone || ''
          }));
          
          const csvContentEmployees = convertToCSV(transformedEmployeesData, selectedColumns[selectedReport]);
          filename = `employees_report_${new Date().toISOString().split('T')[0]}`;
          downloadFile(csvContentEmployees, `${filename}.csv`, 'text/csv');
          break;

        case "leaves":
          let query = supabase
            .from('leave_requests')
            .select(`
              *,
              employees!leave_requests_employee_id_fkey (name, employee_code, remaining_leave_days, branch),
              leave_types!leave_requests_leave_type_id_fkey (name)
            `)
            .order('start_date', { ascending: false });

          if (selectedBranch !== "all") {
            query = query.eq('employees.branch', selectedBranch);
          }

          if (selectedLeaveType !== "all") {
            query = query.eq('leave_types.name', selectedLeaveType);
          }

          if (selectedLeaveStatus !== "all") {
            query = query.eq('status', selectedLeaveStatus);
          }

          if (dateRange?.from && dateRange?.to) {
            query = query
              .gte('start_date', dateRange.from.toISOString().split('T')[0])
              .lte('end_date', dateRange.to.toISOString().split('T')[0]);
          }
          
          const { data: leavesData, error: leavesError } = await query;
          
          if (leavesError) throw leavesError;
          
          // Fetch user roles to get emails for approved_by and rejected_by IDs
          const approvedByIds = (leavesData || [])
            .map(leave => leave.approved_by)
            .filter(id => id) as string[];
          
          const rejectedByIds = (leavesData || [])
            .map(leave => leave.rejected_by)
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
          
          const transformedLeavesData = (leavesData || []).map(leave => {
            const approvedByUser = userRoles.find(ur => ur.user_id === leave.approved_by);
            const rejectedByUser = userRoles.find(ur => ur.user_id === leave.rejected_by);
            
            // Determine which email to show based on status
            let actionByEmail = '';
            if (leave.status === 'approved' && approvedByUser) {
              actionByEmail = approvedByUser.email;
            } else if (leave.status === 'rejected' && rejectedByUser) {
              actionByEmail = rejectedByUser.email;
            }
            
            return {
              Employee: leave.employees?.name || '',
              'Employee Code': leave.employees?.employee_code || '',
              Branch: leave.employees?.branch || '',
              Type: leave.leave_types?.name || '',
              'Start Date': new Date(leave.start_date).toLocaleDateString('en-GB'),
              'End Date': new Date(leave.end_date).toLocaleDateString('en-GB'),
              Duration: leave.days_requested || 0,
              'Days Remaining': leave.employees?.remaining_leave_days || 0,
              Status: leave.status || '',
              Reason: leave.notes || '',
              'Submitted Date': new Date(leave.created_at).toLocaleDateString('en-GB'),
              'Manager Notes': leave.manager_notes || '',
              'Approved/Rejected By': actionByEmail,
              'Approved Date': leave.approved_date ? new Date(leave.approved_date).toLocaleDateString('en-GB') : '',
              'Rejected Date': leave.rejected_date ? new Date(leave.rejected_date).toLocaleDateString('en-GB') : ''
            };
          });
          
          const csvContentLeaves = convertToCSV(transformedLeavesData, selectedColumns[selectedReport]);
          filename = `leaves_report_${new Date().toISOString().split('T')[0]}`;
          downloadFile(csvContentLeaves, `${filename}.csv`, 'text/csv');
          break;

        case "compliance":
          const currentComplianceType = getCurrentComplianceType();
          
          if (!currentComplianceType) {
            toast({
              title: "Please select a compliance type",
              description: "You must select a specific compliance type to generate the report.",
              variant: "destructive",
            });
            return;
          }

          const isClientCompliance = currentComplianceType.isClientType;
          let complianceData: any[] = [];
          let complianceError: any = null;

          if (isClientCompliance) {
            // Query client compliance records
            let clientComplianceQuery = supabase
              .from('client_compliance_period_records')
              .select(`
                *,
                clients!client_compliance_period_records_client_id_fkey (name, branches(name)),
                client_compliance_types (name, frequency)
              `)
              .order('completion_date', { ascending: false });

            if (selectedBranch !== "all") {
              clientComplianceQuery = clientComplianceQuery.eq('clients.branches.name', selectedBranch);
            }

            if (selectedComplianceType !== "all") {
              clientComplianceQuery = clientComplianceQuery.eq('client_compliance_type_id', selectedComplianceType);
            }

            // Apply period filters for client compliance
            if (currentComplianceType.frequency.toLowerCase() === 'annual') {
              clientComplianceQuery = clientComplianceQuery.like('period_identifier', `${selectedYear}%`);
            } else if (currentComplianceType.frequency.toLowerCase() === 'monthly' && selectedMonths.length > 0) {
              const monthFilters = selectedMonths.map(month => `${selectedYear}-${month}`);
              clientComplianceQuery = clientComplianceQuery.in('period_identifier', monthFilters);
            } else if (currentComplianceType.frequency.toLowerCase() === 'quarterly' && selectedQuarters.length > 0) {
              const quarterFilters = selectedQuarters.map(quarter => `${selectedYear}-${quarter}`);
              clientComplianceQuery = clientComplianceQuery.in('period_identifier', quarterFilters);
            }
            
            const result = await clientComplianceQuery;
            complianceData = result.data || [];
            complianceError = result.error;
          } else {
            // Query employee compliance records
            let employeeComplianceQuery = supabase
              .from('compliance_period_records')
              .select(`
                *,
                employees!compliance_period_records_employee_id_fkey (name, branch),
                compliance_types (name, frequency)
              `)
              .order('completion_date', { ascending: false });

            if (selectedBranch !== "all") {
              employeeComplianceQuery = employeeComplianceQuery.eq('employees.branch', selectedBranch);
            }

            if (selectedComplianceType !== "all") {
              employeeComplianceQuery = employeeComplianceQuery.eq('compliance_type_id', selectedComplianceType);
            }

            // Apply period filters for employee compliance
            if (currentComplianceType.frequency.toLowerCase() === 'annual') {
              employeeComplianceQuery = employeeComplianceQuery.like('period_identifier', `${selectedYear}%`);
            } else if (currentComplianceType.frequency.toLowerCase() === 'monthly' && selectedMonths.length > 0) {
              const monthFilters = selectedMonths.map(month => `${selectedYear}-${month}`);
              employeeComplianceQuery = employeeComplianceQuery.in('period_identifier', monthFilters);
            } else if (currentComplianceType.frequency.toLowerCase() === 'quarterly' && selectedQuarters.length > 0) {
              const quarterFilters = selectedQuarters.map(quarter => `${selectedYear}-${quarter}`);
              employeeComplianceQuery = employeeComplianceQuery.in('period_identifier', quarterFilters);
            }
            
            const result = await employeeComplianceQuery;
            complianceData = result.data || [];
            complianceError = result.error;
          }
          
          if (complianceError) throw complianceError;
          
          // Transform data based on type (client vs employee)
          const transformedComplianceData = complianceData.map(record => {
            if (isClientCompliance) {
              return {
                'Task Name': record.client_compliance_types?.name || '',
                'Client': record.clients?.name || '',
                'Branch': record.clients?.branches?.name || '',
                'Period': record.period_identifier || '',
                'Completion Date': record.completion_date && record.completion_date.match(/^\d{4}-\d{2}-\d{2}/) 
                  ? new Date(record.completion_date).toLocaleDateString('en-GB') 
                  : record.completion_date || '',
                'Status': record.status || '',
                'Notes': record.notes || '',
                'Frequency': record.client_compliance_types?.frequency || ''
              };
            } else {
              return {
                'Task Name': record.compliance_types?.name || '',
                'Employee': record.employees?.name || '',
                'Branch': record.employees?.branch || '',
                'Period': record.period_identifier || '',
                'Completion Date': record.completion_date && record.completion_date.match(/^\d{4}-\d{2}-\d{2}/) 
                  ? new Date(record.completion_date).toLocaleDateString('en-GB') 
                  : record.completion_date || '',
                'Status': record.status || '',
                'Notes': record.notes || '',
                'Frequency': record.compliance_types?.frequency || ''
              };
            }
          });
          
          const csvContentCompliance = convertToCSV(transformedComplianceData, selectedColumns[selectedReport]);
          filename = `${isClientCompliance ? 'client_' : ''}compliance_report_${new Date().toISOString().split('T')[0]}`;
          downloadFile(csvContentCompliance, `${filename}.csv`, 'text/csv');
          break;
      }

      toast({
        title: "Report exported successfully",
        description: `Your ${selectedReport} report has been downloaded.`,
      });

    } catch (error) {
      console.error('Export error:', error);
      toast({
        title: "Export failed",
        description: "There was an error exporting the report. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsExporting(false);
    }
  };

  const convertToCSV = (data: any[], selectedCols?: string[]): string => {
    if (!data.length) return '';
    
    const allHeaders = Object.keys(data[0]);
    const headers = selectedCols ? allHeaders.filter(h => selectedCols.includes(h)) : allHeaders;
    const csvRows = [headers.join(',')];
    
    for (const row of data) {
      const values = headers.map(header => {
        const value = row[header];
        if (typeof value === 'object' && value !== null) {
          return JSON.stringify(value);
        }
        return `"${String(value).replace(/"/g, '""')}"`;
      });
      csvRows.push(values.join(','));
    }
    
    return csvRows.join('\n');
  };

  const downloadFile = (content: string, filename: string, contentType: string) => {
    const blob = new Blob([content], { type: contentType });
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    window.URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="animate-fade-in">
        <div className="space-y-2">
          <h1 className="text-4xl font-bold bg-gradient-primary bg-clip-text text-transparent">
            Reports & Analytics
          </h1>
          <p className="text-lg text-muted-foreground">
            Generate comprehensive reports and export data for analysis
          </p>
        </div>
      </div>

      {/* Report Configuration */}
      <Card className="card-premium animate-slide-up">
        <CardHeader>
          <CardTitle className="flex items-center gap-3">
            <BarChart3 className="w-6 h-6 text-primary" />
            Report Configuration
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Report Type</label>
              <Select value={selectedReport} onValueChange={(value) => {
                setSelectedReport(value);
                initializeSelectedColumns(value);
              }}>
                <SelectTrigger>
                  <SelectValue placeholder="Select report type" />
                </SelectTrigger>
                <SelectContent>
                  {reportTypes.map((report) => (
                    <SelectItem key={report.id} value={report.id}>
                      <div className="flex items-center gap-2">
                        <span>{report.icon}</span>
                        <span>{report.name}</span>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Branch Filter</label>
              <Select value={selectedBranch} onValueChange={setSelectedBranch}>
                <SelectTrigger>
                  <SelectValue placeholder="Select branch" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Branches</SelectItem>
                  {branches.map((branch) => (
                    <SelectItem key={branch.id} value={branch.name}>
                      {branch.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {selectedReport === "leaves" && (
              <>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Leave Type</label>
                  <Select value={selectedLeaveType} onValueChange={setSelectedLeaveType}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select leave type" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Leave Types</SelectItem>
                      {leaveTypes.map((leaveType) => (
                        <SelectItem key={leaveType.id} value={leaveType.name}>
                          {leaveType.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Leave Status</label>
                  <Select value={selectedLeaveStatus} onValueChange={setSelectedLeaveStatus}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select leave status" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Statuses</SelectItem>
                      <SelectItem value="pending">Pending</SelectItem>
                      <SelectItem value="approved">Approved</SelectItem>
                      <SelectItem value="rejected">Rejected</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </>
            )}

            {selectedReport === "compliance" && (
              <div className="space-y-2">
                <label className="text-sm font-medium">Compliance Type</label>
                <Select value={selectedComplianceType} onValueChange={setSelectedComplianceType}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select compliance type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Compliance Types</SelectItem>
                    {complianceTypes.map((complianceType) => (
                      <SelectItem key={complianceType.id} value={complianceType.id}>
                        {complianceType.name} ({complianceType.frequency})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>

          {selectedReport === "leaves" && (
            <div className="space-y-2">
              <label className="text-sm font-medium">Date Range</label>
              <DatePickerWithRange date={dateRange} setDate={setDateRange} />
            </div>
          )}

          {selectedReport === "compliance" && selectedComplianceType !== "all" && (
            <div className="space-y-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">Year</label>
                <Select value={selectedYear} onValueChange={setSelectedYear}>
                  <SelectTrigger className="w-32">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {getYearOptions().map((year) => (
                      <SelectItem key={year} value={year}>
                        {year}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {getCurrentComplianceType()?.frequency.toLowerCase() === 'monthly' && (
                <div className="space-y-2">
                  <label className="text-sm font-medium">Months</label>
                  <div className="grid grid-cols-3 gap-2">
                    {getMonthOptions().map((month) => (
                      <div key={month.value} className="flex items-center space-x-2">
                        <Checkbox 
                          id={month.value}
                          checked={selectedMonths.includes(month.value)}
                          onCheckedChange={() => handleMonthToggle(month.value)}
                        />
                        <label htmlFor={month.value} className="text-sm">
                          {month.label}
                        </label>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {getCurrentComplianceType()?.frequency.toLowerCase() === 'quarterly' && (
                <div className="space-y-2">
                  <label className="text-sm font-medium">Quarters</label>
                  <div className="grid grid-cols-2 gap-2">
                    {getQuarterOptions().map((quarter) => (
                      <div key={quarter.value} className="flex items-center space-x-2">
                        <Checkbox 
                          id={quarter.value}
                          checked={selectedQuarters.includes(quarter.value)}
                          onCheckedChange={() => handleQuarterToggle(quarter.value)}
                        />
                        <label htmlFor={quarter.value} className="text-sm">
                          {quarter.label}
                        </label>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Column Selection */}
          {selectedReport && (
            <Collapsible open={isColumnSelectorOpen} onOpenChange={setIsColumnSelectorOpen}>
              <CollapsibleTrigger asChild>
                <Button variant="outline" className="w-full justify-between">
                  <span className="flex items-center gap-2">
                    <FileX className="w-4 h-4" />
                    Select Columns ({selectedColumns[selectedReport]?.length || 0} selected)
                  </span>
                  <ChevronDown className={`w-4 h-4 transition-transform ${isColumnSelectorOpen ? 'rotate-180' : ''}`} />
                </Button>
              </CollapsibleTrigger>
              <CollapsibleContent className="space-y-3 pt-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">Choose columns to include:</span>
                  <div className="flex gap-2">
                    <Button 
                      variant="ghost" 
                      size="sm"
                      onClick={() => handleSelectAllColumns(selectedReport, true)}
                    >
                      Select All
                    </Button>
                    <Button 
                      variant="ghost" 
                      size="sm"
                      onClick={() => handleSelectAllColumns(selectedReport, false)}
                    >
                      Deselect All
                    </Button>
                  </div>
                </div>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-3 max-h-60 overflow-y-auto">
                  {reportTypes.find(r => r.id === selectedReport)?.fields.map((field) => (
                    <div key={field} className="flex items-center space-x-2">
                      <Checkbox 
                        id={`${selectedReport}-${field}`}
                        checked={selectedColumns[selectedReport]?.includes(field) || false}
                        onCheckedChange={(checked) => handleColumnToggle(selectedReport, field, checked as boolean)}
                      />
                      <label 
                        htmlFor={`${selectedReport}-${field}`} 
                        className="text-sm leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                      >
                        {field}
                      </label>
                    </div>
                  ))}
                </div>
              </CollapsibleContent>
            </Collapsible>
          )}

          {/* Export Section */}
          {selectedReport && (
            <div className="flex items-center justify-between pt-4 border-t border-border/50">
              <div className="flex items-center gap-2">
                <Filter className="w-4 h-4 text-muted-foreground" />
                <span className="text-sm text-muted-foreground">
                  Ready to export {reportTypes.find(r => r.id === selectedReport)?.name}
                </span>
              </div>
              
              <div className="flex items-center gap-2">
                <Button 
                  variant="outline" 
                  onClick={() => handleExport('csv')}
                  disabled={!selectedReport || isExporting || !selectedColumns[selectedReport]?.length}
                >
                  <Download className="w-4 h-4 mr-2" />
                  Export CSV
                </Button>
                <Button 
                  onClick={() => handleExport('xlsx')}
                  disabled={!selectedReport || isExporting || !selectedColumns[selectedReport]?.length}
                  className="bg-gradient-primary hover:opacity-90"
                >
                  <FileSpreadsheet className="w-4 h-4 mr-2" />
                  Export Excel
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Report Types Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {reportTypes.map((report, index) => (
          <Card 
            key={report.id} 
            className={`card-premium animate-fade-in cursor-pointer transition-all duration-300 hover:shadow-glow ${
              selectedReport === report.id ? 'ring-2 ring-primary border-primary/50' : ''
            }`}
            style={{ animationDelay: `${index * 100}ms` }}
            onClick={() => {
              setSelectedReport(report.id);
              initializeSelectedColumns(report.id);
            }}
          >
            <CardHeader className="pb-3">
              <div className="flex items-center gap-3">
                <div className="text-2xl">{report.icon}</div>
                <div>
                  <CardTitle className="text-lg">{report.name}</CardTitle>
                  <p className="text-sm text-muted-foreground">{report.description}</p>
                </div>
              </div>
            </CardHeader>
            
            <CardContent>
              <div className="space-y-2">
                <h4 className="text-sm font-medium text-foreground">Included Fields:</h4>
                <div className="flex flex-wrap gap-1">
                  {report.fields.map((field) => (
                    <span key={field} className="text-xs px-2 py-1 bg-muted rounded-md">
                      {field}
                    </span>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
