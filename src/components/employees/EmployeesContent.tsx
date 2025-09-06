
import { useState, useEffect, useRef } from "react";
import { Plus, Search, Filter, Mail, Phone, MapPin, Calendar, Users, Building, Clock, User, Upload, Download, X, FileSpreadsheet, AlertCircle, Eye, Edit3, Trash2, Check, Square, RotateCcw, ArrowUpDown, ArrowUp, ArrowDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { Pagination, PaginationContent, PaginationItem, PaginationLink, PaginationNext, PaginationPrevious } from "@/components/ui/pagination";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { usePermissions } from "@/contexts/PermissionsContext";
import { usePagePermissions } from "@/hooks/usePagePermissions";
import Papa from 'papaparse';
import * as XLSX from 'xlsx';

interface Employee {
  id: string;
  name: string;
  email: string;
  phone?: string;
  branch: string;
  employee_code: string;
  job_title?: string;
  employee_type?: string;
  working_hours?: number;
  leave_allowance?: number;
  leave_taken?: number;
  remaining_leave_days?: number;
  hours_restriction?: string;
  created_at?: string;
}

interface ImportEmployee {
  name: string;
  employee_code: string;
  branch: string;
  email?: string;
  phone?: string;
  job_title?: string;
  employee_type?: string;
  working_hours?: number;
  leave_allowance?: number;
  leave_taken?: number;
  remaining_leave_days?: number;
  days_taken?: number;
  days_remaining?: number;
  error?: string;
}

export type EmployeeSortField = 'name' | 'employee_code' | 'branch' | 'working_hours' | 'remaining_leave_days';
export type EmployeeSortDirection = 'asc' | 'desc';

export function EmployeesContent() {
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [branches, setBranches] = useState([]);
  const [loading, setLoading] = useState(true);
  const { getAccessibleBranches, isAdmin } = usePermissions();
  const { canViewEmployees, canCreateEmployees, canEditEmployees, canDeleteEmployees } = usePagePermissions();
  const [searchTerm, setSearchTerm] = useState("");
  const [branchFilter, setBranchFilter] = useState("all");
  const [sortField, setSortField] = useState<EmployeeSortField>('name');
  const [sortDirection, setSortDirection] = useState<EmployeeSortDirection>('asc');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [importDialogOpen, setImportDialogOpen] = useState(false);
  const [previewDialogOpen, setPreviewDialogOpen] = useState(false);
  const [viewDialogOpen, setViewDialogOpen] = useState(false);
  const [editMode, setEditMode] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [selectedEmployee, setSelectedEmployee] = useState<Employee | null>(null);
  const [selectedEmployees, setSelectedEmployees] = useState<string[]>([]);
  const [batchDeleteDialogOpen, setBatchDeleteDialogOpen] = useState(false);
  const [importData, setImportData] = useState<ImportEmployee[]>([]);
  const [dragActive, setDragActive] = useState(false);
  const [importing, setImporting] = useState(false);
  const [resetPasswordDialogOpen, setResetPasswordDialogOpen] = useState(false);
  const [resettingPassword, setResettingPassword] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [newEmployee, setNewEmployee] = useState({
    name: "",
    email: "",
    phone: "",
    branch: "",
    employee_code: "",
    job_title: "",
    employee_type: "regular",
    working_hours: "N/A",
    leave_allowance: 28,
    hours_restriction: ""
  });
  const [editedEmployee, setEditedEmployee] = useState({
    name: "",
    email: "",
    phone: "",
    branch: "",
    employee_code: "",
    job_title: "",
    employee_type: "regular",
    working_hours: "N/A",
    leave_allowance: 28,
    leave_taken: 0,
    remaining_leave_days: 28,
    hours_restriction: ""
  });
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(50);
  const { toast } = useToast();

  useEffect(() => {
    fetchData();
  }, []);

  // Email validation helper functions
  const checkEmailExists = async (email: string, excludeEmployeeId?: string): Promise<{ exists: boolean; existingEmployee?: Employee }> => {
    if (!email || !email.trim()) {
      return { exists: false };
    }

    const normalizedEmail = email.trim().toLowerCase();
    
    try {
      let query = supabase
        .from('employees')
        .select('id, name, email, employee_code, branch')
        .ilike('email', normalizedEmail);
      
      if (excludeEmployeeId) {
        query = query.neq('id', excludeEmployeeId);
      }
      
      const { data, error } = await query;
      
      if (error) {
        console.error('Error checking email existence:', error);
        throw error;
      }
      
      const existingEmployee = data && data.length > 0 ? data[0] : null;
      return { 
        exists: !!existingEmployee, 
        existingEmployee: existingEmployee || undefined 
      };
    } catch (error) {
      console.error('Email check failed:', error);
      throw error;
    }
  };

  const validateEmailUniqueness = async (email: string, excludeEmployeeId?: string): Promise<boolean> => {
    if (!email || !email.trim()) {
      return true; // Empty email is allowed
    }

    try {
      const { exists, existingEmployee } = await checkEmailExists(email, excludeEmployeeId);
      
      if (exists && existingEmployee) {
        toast({
          title: "Email already exists",
          description: `This email is already used by ${existingEmployee.name} (${existingEmployee.employee_code}). Please choose a different email address.`,
          variant: "destructive",
        });
        return false;
      }
      
      return true;
    } catch (error) {
      console.error('Email validation failed:', error);
      toast({
        title: "Validation error",
        description: "Could not validate email uniqueness. Please try again.",
        variant: "destructive",
      });
      return false;
    }
  };

  const hashDefaultPassword = async () => {
    try {
      const { data: hashedPassword, error } = await supabase
        .rpc('hash_password', { password: '123456' });
      
      if (error) throw error;
      return hashedPassword;
    } catch (error) {
      console.error('Error hashing password:', error);
      throw error;
    }
  };

  const resetEmployeePassword = async () => {
    if (!selectedEmployee) return;
    
    try {
      setResettingPassword(true);
      
      const { data, error } = await supabase.functions.invoke('admin-reset-employee-password', {
        body: { employeeId: selectedEmployee.id }
      });

      if (error) throw error;

      toast({
        title: "Password Reset",
        description: "Employee password has been reset to 123456. They will be prompted to change it on next login.",
      });

      setResetPasswordDialogOpen(false);
    } catch (error) {
      console.error('Error resetting password:', error);
      toast({
        title: "Error resetting password",
        description: "Could not reset employee password. Please try again.",
        variant: "destructive",
      });
    } finally {
      setResettingPassword(false);
    }
  };

  const fetchData = async () => {
    try {
      setLoading(true);
      
      // Fetch employees
      const { data: employeesData, error: employeesError } = await supabase
        .from('employees')
        .select('*')
        .order('name');

      if (employeesError) throw employeesError;

      // Fetch branches for the form
      const { data: branchesData, error: branchesError } = await supabase
        .from('branches')
        .select('id, name')
        .order('name');

      if (branchesError) throw branchesError;

      setEmployees(employeesData || []);
      setBranches(branchesData || []);
    } catch (error) {
      console.error('Error fetching data:', error);
      toast({
        title: "Error loading data",
        description: "Could not fetch employee data. Please try again.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const addEmployee = async () => {
    if (!canCreateEmployees()) {
      toast({
        title: "Access denied",
        description: "You don't have permission to create employees.",
        variant: "destructive",
      });
      return;
    }
    
    try {
      if (!newEmployee.name || !newEmployee.email || !newEmployee.branch || !newEmployee.employee_code) {
        toast({
          title: "Missing information",
          description: "Please fill in all required fields.",
          variant: "destructive",
        });
        return;
      }

      // Validate email uniqueness
      const isEmailValid = await validateEmailUniqueness(newEmployee.email);
      if (!isEmailValid) {
        return;
      }

      const { error } = await supabase
        .from('employees')
        .insert([{
          name: newEmployee.name,
          email: newEmployee.email,
          phone: newEmployee.phone || null,
          branch: newEmployee.branch,
          employee_code: newEmployee.employee_code,
          job_title: newEmployee.job_title || null,
          employee_type: newEmployee.employee_type,
          working_hours: newEmployee.working_hours === "N/A" ? null : parseInt(newEmployee.working_hours) || null,
          leave_allowance: newEmployee.leave_allowance,
          leave_taken: 0,
          remaining_leave_days: newEmployee.leave_allowance,
          hours_restriction: newEmployee.hours_restriction || null,
          password_hash: await hashDefaultPassword(),
          must_change_password: true,
          is_active: true,
          failed_login_attempts: 0
        }]);

      if (error) throw error;

      toast({
        title: "Employee added",
        description: "The employee has been added successfully.",
      });

      setDialogOpen(false);
      setNewEmployee({
        name: "",
        email: "",
        phone: "",
        branch: "",
        employee_code: "",
        job_title: "",
        employee_type: "regular",
        working_hours: "N/A",
        leave_allowance: 28,
        hours_restriction: ""
      });
      fetchData();
    } catch (error) {
      console.error('Error adding employee:', error);
      toast({
        title: "Error adding employee",
        description: "Could not add employee. Please try again.",
        variant: "destructive",
      });
    }
  };

  const openViewDialog = (employee: Employee) => {
    setSelectedEmployee(employee);
    setEditedEmployee({
      name: employee.name || "",
      email: employee.email || "",
      phone: employee.phone || "",
      branch: employee.branch || "",
      employee_code: employee.employee_code || "",
      job_title: employee.job_title || "",
      employee_type: employee.employee_type || "regular",
      working_hours: employee.working_hours ? employee.working_hours.toString() : "N/A",
      leave_allowance: employee.leave_allowance || 28,
      leave_taken: employee.leave_taken || 0,
      remaining_leave_days: employee.remaining_leave_days || 28,
      hours_restriction: employee.hours_restriction || ""
    });
    setEditMode(false);
    setViewDialogOpen(true);
  };

  const updateEmployee = async () => {
    if (!canEditEmployees()) {
      toast({
        title: "Access denied",
        description: "You don't have permission to edit employees.",
        variant: "destructive",
      });
      return;
    }
    
    if (!selectedEmployee) return;
    
    try {
      // Validate email uniqueness (excluding current employee)
      const isEmailValid = await validateEmailUniqueness(editedEmployee.email, selectedEmployee.id);
      if (!isEmailValid) {
        return;
      }
      const { error } = await supabase
        .from('employees')
        .update({
          name: editedEmployee.name,
          email: editedEmployee.email,
          phone: editedEmployee.phone || null,
          branch: editedEmployee.branch,
          employee_code: editedEmployee.employee_code,
          job_title: editedEmployee.job_title || null,
          employee_type: editedEmployee.employee_type,
          working_hours: editedEmployee.working_hours === "N/A" ? null : parseInt(editedEmployee.working_hours) || null,
          leave_allowance: editedEmployee.leave_allowance,
          leave_taken: editedEmployee.leave_taken,
          remaining_leave_days: editedEmployee.remaining_leave_days,
          hours_restriction: editedEmployee.hours_restriction || null
        })
        .eq('id', selectedEmployee.id);

      if (error) throw error;

      toast({
        title: "Employee updated",
        description: "The employee has been updated successfully.",
      });

      setEditMode(false);
      setViewDialogOpen(false);
      fetchData();
    } catch (error) {
      console.error('Error updating employee:', error);
      toast({
        title: "Error updating employee",
        description: "Could not update employee. Please try again.",
        variant: "destructive",
      });
    }
  };

  const deleteEmployee = async (employeeId: string) => {
    if (!canDeleteEmployees()) {
      toast({
        title: "Access denied",
        description: "You don't have permission to delete employees.",
        variant: "destructive",
      });
      return;
    }
    
    try {
      const { error } = await supabase
        .from('employees')
        .delete()
        .eq('id', employeeId);

      if (error) throw error;

      toast({
        title: "Employee deleted",
        description: "The employee has been deleted successfully.",
      });

      setDeleteDialogOpen(false);
      setSelectedEmployee(null);
      fetchData();
    } catch (error) {
      console.error('Error deleting employee:', error);
      toast({
        title: "Error deleting employee",
        description: "Could not delete employee. Please try again.",
        variant: "destructive",
      });
    }
  };

  const batchDeleteEmployees = async () => {
    if (!canDeleteEmployees()) {
      toast({
        title: "Access denied",
        description: "You don't have permission to delete employees.",
        variant: "destructive",
      });
      return;
    }
    
    try {
      const { error } = await supabase
        .from('employees')
        .delete()
        .in('id', selectedEmployees);

      if (error) throw error;

      toast({
        title: "Employees deleted",
        description: `Successfully deleted ${selectedEmployees.length} employees.`,
      });

      setBatchDeleteDialogOpen(false);
      setSelectedEmployees([]);
      fetchData();
    } catch (error) {
      console.error('Error deleting employees:', error);
      toast({
        title: "Error deleting employees",
        description: "Could not delete employees. Please try again.",
        variant: "destructive",
      });
    }
  };

  const toggleSelectEmployee = (employeeId: string) => {
    setSelectedEmployees(prev => 
      prev.includes(employeeId) 
        ? prev.filter(id => id !== employeeId)
        : [...prev, employeeId]
    );
  };

  const toggleSelectAll = () => {
    if (selectedEmployees.length === paginatedEmployees.length) {
      setSelectedEmployees([]);
    } else {
      setSelectedEmployees(paginatedEmployees.map(emp => emp.id));
    }
  };

  const handleSort = (field: EmployeeSortField) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  };

  const getSortIcon = (field: EmployeeSortField) => {
    if (sortField !== field) return <ArrowUpDown className="w-4 h-4" />;
    return sortDirection === 'asc' ? <ArrowUp className="w-4 h-4" /> : <ArrowDown className="w-4 h-4" />;
  };

  // Import functionality
  const downloadTemplate = () => {
    const template = [
      {
        'Name': 'John Doe',
        'Employee Code': 'EMP001',
        'Branch': 'Main Office',
        'Email': 'john.doe@company.com',
        'Phone': '+1234567890',
        'Job Title': 'Software Engineer',
        'Employee Type': 'regular',
        'Working Hours': 40,
        'Days Taken': 5,
        'Days Remaining': 23
      }
    ];

    const csvContent = Papa.unparse(template);
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'employee_import_template.csv';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    window.URL.revokeObjectURL(url);

    toast({
      title: "Template downloaded",
      description: "Employee import template has been downloaded.",
    });
  };

  const processFileData = (data: any[]): ImportEmployee[] => {
    return data.map((row, index) => {
      const employee: ImportEmployee = {
        name: '',
        employee_code: '',
        branch: '',
        error: ''
      };

      // Map column names (case-insensitive)
      Object.keys(row).forEach(key => {
        const lowerKey = key.toLowerCase().replace(/\s+/g, '_');
        const value = row[key];

        if (lowerKey.includes('name')) {
          employee.name = value?.toString().trim() || '';
        } else if (lowerKey.includes('employee') && lowerKey.includes('code')) {
          employee.employee_code = value?.toString().trim() || '';
        } else if (lowerKey.includes('branch')) {
          employee.branch = value?.toString().trim() || '';
        } else if (lowerKey.includes('email')) {
          employee.email = value?.toString().trim() || '';
        } else if (lowerKey.includes('phone')) {
          employee.phone = value?.toString().trim() || '';
        } else if (lowerKey.includes('job') && lowerKey.includes('title')) {
          employee.job_title = value?.toString().trim() || '';
        } else if (lowerKey.includes('employee') && lowerKey.includes('type')) {
          employee.employee_type = value?.toString().trim() || 'regular';
        } else if (lowerKey.includes('working') && lowerKey.includes('hours')) {
          employee.working_hours = value ? parseInt(value) : undefined;
        } else if (lowerKey.includes('days') && lowerKey.includes('taken')) {
          employee.days_taken = parseInt(value) || 0;
        } else if (lowerKey.includes('days') && lowerKey.includes('remaining')) {
          employee.days_remaining = parseInt(value) || 28;
        }
      });

      // Validate required fields
      const errors = [];
      if (!employee.name) errors.push('Name is required');
      if (!employee.employee_code) errors.push('Employee Code is required');
      if (!employee.branch) errors.push('Branch is required');

      // Set defaults for leave days if not provided
      if (employee.days_taken === undefined && employee.days_remaining === undefined) {
        employee.leave_taken = 0;
        employee.remaining_leave_days = 28;
        employee.leave_allowance = 28;
      } else {
        employee.leave_taken = employee.days_taken || 0;
        employee.remaining_leave_days = employee.days_remaining || 28;
        employee.leave_allowance = (employee.leave_taken || 0) + (employee.remaining_leave_days || 28);
      }

      employee.error = errors.join(', ');
      return employee;
    });
  };

  const handleFileUpload = (file: File) => {
    const fileExtension = file.name.split('.').pop()?.toLowerCase();
    
    if (fileExtension === 'csv') {
      Papa.parse(file, {
        header: true,
        skipEmptyLines: true,
        complete: (results) => {
          const processedData = processFileData(results.data);
          setImportData(processedData);
          setPreviewDialogOpen(true);
          setImportDialogOpen(false);
        },
        error: (error) => {
          toast({
            title: "Error parsing CSV",
            description: error.message,
            variant: "destructive",
          });
        }
      });
    } else if (fileExtension === 'xlsx' || fileExtension === 'xls') {
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const data = new Uint8Array(e.target?.result as ArrayBuffer);
          const workbook = XLSX.read(data, { type: 'array' });
          const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
          const jsonData = XLSX.utils.sheet_to_json(firstSheet);
          
          const processedData = processFileData(jsonData);
          setImportData(processedData);
          setPreviewDialogOpen(true);
          setImportDialogOpen(false);
        } catch (error) {
          toast({
            title: "Error parsing Excel file",
            description: "Failed to read the Excel file.",
            variant: "destructive",
          });
        }
      };
      reader.readAsArrayBuffer(file);
    } else {
      toast({
        title: "Unsupported file format",
        description: "Please upload a CSV or Excel file.",
        variant: "destructive",
      });
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragActive(false);
    
    const files = e.dataTransfer.files;
    if (files.length > 0) {
      handleFileUpload(files[0]);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setDragActive(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setDragActive(false);
  };

  const handleImportEmployees = async () => {
    setImporting(true);
    
    try {
      // First validate all data including email uniqueness
      const processedData = await Promise.all(
        importData.map(async (emp, index) => {
          let errors = emp.error ? [emp.error] : [];
          
          // Check email uniqueness if email is provided
          if (emp.email && emp.email.trim()) {
            try {
              const { exists, existingEmployee } = await checkEmailExists(emp.email);
              if (exists && existingEmployee) {
                errors.push(`Email already exists (used by ${existingEmployee.name} - ${existingEmployee.employee_code})`);
              }
            } catch (error) {
              console.error('Email validation failed for import:', error);
              errors.push('Email validation failed');
            }
          }
          
          // Check for duplicate emails within import data
          const duplicateInImport = importData.findIndex((otherEmp, otherIndex) => 
            otherIndex !== index && 
            otherEmp.email && 
            emp.email && 
            otherEmp.email.trim().toLowerCase() === emp.email.trim().toLowerCase()
          );
          
          if (duplicateInImport !== -1) {
            errors.push(`Duplicate email found in import data (row ${duplicateInImport + 1})`);
          }
          
          return {
            ...emp,
            error: errors.join(', ')
          };
        })
      );
      
      // Update import data with validation results
      setImportData(processedData);
      
      const validEmployees = processedData.filter(emp => !emp.error);
      
      if (validEmployees.length === 0) {
        toast({
          title: "No valid employees",
          description: "Please fix all errors before importing.",
          variant: "destructive",
        });
        setImporting(false);
        return;
      }
      
      if (validEmployees.length !== processedData.length) {
        toast({
          title: "Some employees have errors",
          description: `${validEmployees.length} of ${processedData.length} employees will be imported. Fix errors and re-import if needed.`,
          variant: "destructive",
        });
      }

      const employeesToInsert = validEmployees.map(emp => ({
        name: emp.name,
        email: emp.email || null,
        phone: emp.phone || null,
        branch: emp.branch,
        employee_code: emp.employee_code,
        job_title: emp.job_title || null,
        employee_type: emp.employee_type || 'regular',
        working_hours: emp.working_hours || null,
        leave_allowance: emp.leave_allowance || 28,
        leave_taken: emp.leave_taken || 0,
        remaining_leave_days: emp.remaining_leave_days || 28,
        password_hash: 'temp',
        must_change_password: true,
        is_active: true,
        failed_login_attempts: 0
      }));

      const { error } = await supabase
        .from('employees')
        .insert(employeesToInsert);

      if (error) throw error;

      toast({
        title: "Import successful", 
        description: `Successfully imported ${validEmployees.length} employees.`,
      });

      setPreviewDialogOpen(false);
      setImportData([]);
      fetchData();
    } catch (error) {
      console.error('Error importing employees:', error);
      toast({
        title: "Import failed",
        description: "Failed to import employees. Please try again.",
        variant: "destructive",
      });
    } finally {
      setImporting(false);
    }
  };

  const getEmployeeTypeColor = (type: string) => {
    switch (type) {
      case 'regular':
        return 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200';
      case 'part-time':
        return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200';
      case 'contract':
        return 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200';
      case 'intern':
        return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200';
      default:
        return 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200';
    }
  };

  const getHoursRestrictionBadge = (restriction: string | null | undefined) => {
    if (!restriction) return null;
    
    return (
      <Badge variant="outline" className="text-xs">
        <Clock className="w-3 h-3 mr-1" />
        {restriction}
      </Badge>
    );
  };

  const handlePageSizeChange = (newPageSize: string) => {
    setPageSize(parseInt(newPageSize));
    setPage(1); // Reset to first page when changing page size
  };

  const filteredEmployees = employees.filter(employee => {
    const searchLower = searchTerm.toLowerCase();
    const matchesSearch = 
      (employee.name || '').toLowerCase().includes(searchLower) ||
      (employee.email || '').toLowerCase().includes(searchLower) ||
      (employee.employee_code || '').toLowerCase().includes(searchLower) ||
      (employee.job_title || '').toLowerCase().includes(searchLower);
    
    const matchesBranch = branchFilter === 'all' || employee.branch === branchFilter;
    
  // For non-admin users, filter by accessible branches
    const accessibleBranches = getAccessibleBranches();
    console.log('Employee filtering - isAdmin:', isAdmin, 'accessibleBranches:', accessibleBranches, 'employee.branch:', employee.branch);
    
    let hasAccess = true;
    if (!isAdmin && accessibleBranches.length > 0) {
      // Check if employee's branch_id is in accessible branches  
      // Map branch name to branch ID since employee uses branch name
      const employeeBranchId = branches.find(b => b.name === employee.branch)?.id;
      hasAccess = accessibleBranches.includes(employeeBranchId || '');
    }
    
    return matchesSearch && matchesBranch && hasAccess;
  }).sort((a, b) => {
    let aVal: any;
    let bVal: any;
    
    switch (sortField) {
      case 'name':
        aVal = a.name || '';
        bVal = b.name || '';
        break;
      case 'employee_code':
        aVal = a.employee_code || '';
        bVal = b.employee_code || '';
        break;
      case 'branch':
        aVal = a.branch || '';
        bVal = b.branch || '';
        break;
      case 'working_hours':
        // Treat null/undefined as 0 for sorting, so N/A entries go to the bottom in ascending order
        aVal = a.working_hours ?? 0;
        bVal = b.working_hours ?? 0;
        break;
      case 'remaining_leave_days':
        aVal = a.remaining_leave_days || 0;
        bVal = b.remaining_leave_days || 0;
        break;
      default:
        return 0;
    }
    
    if (typeof aVal === 'string' && typeof bVal === 'string') {
      const comparison = aVal.localeCompare(bVal);
      return sortDirection === 'asc' ? comparison : -comparison;
    } else {
      const comparison = aVal - bVal;
      return sortDirection === 'asc' ? comparison : -comparison;
    }
  });

  // Pagination logic
  const totalCount = filteredEmployees.length;
  const totalPages = Math.max(1, Math.ceil(totalCount / pageSize));
  const startIndex = (page - 1) * pageSize;
  const endIndex = startIndex + pageSize;
  const paginatedEmployees = filteredEmployees.slice(startIndex, endIndex);

  // Calculate stats
  const totalEmployees = employees.length;
  const regularEmployees = employees.filter(emp => emp.employee_type === 'regular').length;
  const partTimeEmployees = employees.filter(emp => emp.employee_type === 'part-time').length;
  const contractEmployees = employees.filter(emp => emp.employee_type === 'contract').length;

  // Calculate leave stats
  const totalLeaveAllowance = employees.reduce((sum, emp) => sum + (emp.leave_allowance || 0), 0);
  const totalLeaveTaken = employees.reduce((sum, emp) => sum + (Number(emp.leave_taken) || 0), 0);
  const avgLeaveUsage = totalEmployees > 0 ? Math.round((totalLeaveTaken / totalLeaveAllowance) * 100) : 0;

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 animate-fade-in">
        <div className="space-y-2">
          <h1 className="text-4xl font-bold bg-gradient-primary bg-clip-text text-transparent">
            Employee Management
          </h1>
          <p className="text-lg text-muted-foreground">
            Manage your team members and their information
          </p>
        </div>
        
        <div className="flex items-center gap-3">
          {selectedEmployees.length > 0 && canDeleteEmployees() && (
            <Button 
              variant="destructive"
              onClick={() => setBatchDeleteDialogOpen(true)}
            >
              <Trash2 className="w-4 h-4 mr-2" />
              Delete Selected ({selectedEmployees.length})
            </Button>
          )}
          {canCreateEmployees() && (
            <Button 
              variant="outline"
              onClick={() => setImportDialogOpen(true)}
            >
              <Upload className="w-4 h-4 mr-2" />
              Import
            </Button>
          )}
          {canCreateEmployees() && (
            <Button 
              className="bg-gradient-primary hover:opacity-90"
              onClick={() => setDialogOpen(true)}
            >
              <Plus className="w-4 h-4 mr-2" />
              Add Employee
            </Button>
          )}
        </div>
      </div>

      {/* Search and Filters */}
      <div className="flex flex-col sm:flex-row gap-4 animate-slide-up">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Search employees..."
            value={searchTerm}
            onChange={(e) => {setSearchTerm(e.target.value); setPage(1);}}
            className="pl-10 bg-card border-input-border"
          />
        </div>
        <Select value={branchFilter} onValueChange={(val) => {setBranchFilter(val); setPage(1);}}>
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="Filter by branch" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Branches</SelectItem>
            {Array.from(new Set(employees.map(emp => emp.branch))).map(branch => (
              <SelectItem key={branch} value={branch}>{branch}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6 animate-slide-up">
        <Card className="card-premium">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Total Employees</p>
                <p className="text-2xl font-bold">{totalEmployees}</p>
              </div>
              <div className="w-10 h-10 rounded-lg bg-gradient-primary flex items-center justify-center">
                <Users className="w-5 h-5 text-white" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="card-premium">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Regular Staff</p>
                <p className="text-2xl font-bold">{regularEmployees}</p>
              </div>
              <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center">
                <User className="w-5 h-5 text-white" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="card-premium">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Part-time</p>
                <p className="text-2xl font-bold">{partTimeEmployees}</p>
              </div>
              <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-yellow-500 to-yellow-600 flex items-center justify-center">
                <Clock className="w-5 h-5 text-white" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="card-premium">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Contract</p>
                <p className="text-2xl font-bold">{contractEmployees}</p>
              </div>
              <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-purple-500 to-purple-600 flex items-center justify-center">
                <Building className="w-5 h-5 text-white" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Employees Table */}
      <Card className="card-premium animate-fade-in">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            Employee Directory ({totalCount})
          </CardTitle>
        </CardHeader>
        <CardContent>
          {totalCount === 0 ? (
            <div className="text-center py-12">
              <Users className="w-16 h-16 mx-auto text-muted-foreground/50 mb-4" />
              <h3 className="text-lg font-semibold mb-2">No employees found</h3>
              <p className="text-muted-foreground mb-4">
                {searchTerm || branchFilter !== 'all' 
                  ? "Try adjusting your search or filter criteria." 
                  : "Get started by adding an employee."
                }
              </p>
            </div>
          ) : (
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-12">
                      <Checkbox 
                        checked={selectedEmployees.length === paginatedEmployees.length && paginatedEmployees.length > 0}
                        onCheckedChange={toggleSelectAll}
                        aria-label="Select all employees"
                      />
                    </TableHead>
                    <TableHead>
                      <Button 
                        variant="ghost" 
                        className="p-0 h-auto font-medium hover:bg-transparent"
                        onClick={() => handleSort('name')}
                      >
                        Employee {getSortIcon('name')}
                      </Button>
                    </TableHead>
                    <TableHead>
                      <Button 
                        variant="ghost" 
                        className="p-0 h-auto font-medium hover:bg-transparent"
                        onClick={() => handleSort('employee_code')}
                      >
                        Employee Code {getSortIcon('employee_code')}
                      </Button>
                    </TableHead>
                    <TableHead>
                      <Button 
                        variant="ghost" 
                        className="p-0 h-auto font-medium hover:bg-transparent"
                        onClick={() => handleSort('branch')}
                      >
                        Branch {getSortIcon('branch')}
                      </Button>
                    </TableHead>
                    <TableHead>
                      <Button 
                        variant="ghost" 
                        className="p-0 h-auto font-medium hover:bg-transparent"
                        onClick={() => handleSort('working_hours')}
                      >
                        Working Hours {getSortIcon('working_hours')}
                      </Button>
                    </TableHead>
                    <TableHead>
                      <Button 
                        variant="ghost" 
                        className="p-0 h-auto font-medium hover:bg-transparent"
                        onClick={() => handleSort('remaining_leave_days')}
                      >
                        Leave Balance {getSortIcon('remaining_leave_days')}
                      </Button>
                    </TableHead>
                    <TableHead className="w-32">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {paginatedEmployees.map((employee) => {
                    const leaveUsage = employee.leave_allowance 
                      ? Math.round((Number(employee.leave_taken) / employee.leave_allowance) * 100)
                      : 0;
                    
                    return (
                      <TableRow key={employee.id} className="hover:bg-muted/50 transition-colors">
                        <TableCell>
                          <Checkbox 
                            checked={selectedEmployees.includes(employee.id)}
                            onCheckedChange={() => toggleSelectEmployee(employee.id)}
                            aria-label={`Select ${employee.name}`}
                          />
                        </TableCell>
                        <TableCell>
                          <div className="font-medium">{employee.name}</div>
                        </TableCell>
                        <TableCell>
                          <div className="font-mono text-sm">
                            {employee.employee_code}
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1 text-sm">
                            <Building className="w-3 h-3" />
                            {employee.branch}
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="text-sm">
                            {employee.working_hours ? `${employee.working_hours}h/week` : 'N/A'}
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="space-y-3 min-w-[200px]">
                            <div className="flex justify-between items-center text-sm">
                              <span className="text-muted-foreground">Remaining:</span>
                              <span className="font-semibold">{employee.remaining_leave_days || 0} days</span>
                            </div>
                            <div className="space-y-1">
                              <div className="w-full bg-muted rounded-full h-2.5 overflow-hidden">
                                <div 
                                  className="h-full rounded-full transition-all duration-300"
                                  style={{ 
                                    width: `${Math.max(100 - leaveUsage, 0)}%`,
                                    backgroundColor: leaveUsage > 80 ? 'hsl(var(--destructive))' : 
                                                   leaveUsage > 60 ? 'hsl(var(--warning) / 0.8)' : 
                                                   'hsl(var(--primary))'
                                  }}
                                />
                              </div>
                              <div className="flex justify-between text-xs text-muted-foreground">
                                <span>{employee.leave_taken || 0} used</span>
                                <span>{employee.leave_allowance || 0} total</span>
                              </div>
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            {canViewEmployees() && (
                              <Button 
                                variant="outline" 
                                size="sm"
                                onClick={() => openViewDialog(employee)}
                              >
                                <Eye className="w-4 h-4" />
                              </Button>
                            )}
                            {canDeleteEmployees() && (
                              <Button 
                                variant="outline" 
                                size="sm"
                                onClick={() => {
                                  setSelectedEmployee(employee);
                                  setDeleteDialogOpen(true);
                                }}
                              >
                                <Trash2 className="w-4 h-4" />
                              </Button>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
          
          {totalCount > pageSize && (
            <div className="flex items-center justify-between mt-4">
              <div className="flex items-center gap-2">
                <span className="text-sm text-muted-foreground">Items per page:</span>
                <Select value={pageSize.toString()} onValueChange={handlePageSizeChange}>
                  <SelectTrigger className="w-20">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="10">10</SelectItem>
                    <SelectItem value="25">25</SelectItem>
                    <SelectItem value="50">50</SelectItem>
                    <SelectItem value="100">100</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <Pagination>
                <PaginationContent>
                  <PaginationItem>
                    <PaginationPrevious
                      href="#"
                      onClick={(e) => {
                        e.preventDefault();
                        if (page > 1) {
                          setPage(page - 1);
                          window.scrollTo(0, 0);
                        }
                      }}
                    />
                  </PaginationItem>
                  {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                    const start = Math.max(1, Math.min(page - 2, totalPages - 4));
                    const pageNumber = start + i;
                    if (pageNumber > totalPages) return null;
                    return (
                      <PaginationItem key={pageNumber}>
                        <PaginationLink
                          href="#"
                          isActive={pageNumber === page}
                          onClick={(e) => {
                            e.preventDefault();
                            setPage(pageNumber);
                            window.scrollTo(0, 0);
                          }}
                        >
                          {pageNumber}
                        </PaginationLink>
                      </PaginationItem>
                    );
                  })}
                  <PaginationItem>
                    <PaginationNext
                      href="#"
                      onClick={(e) => {
                        e.preventDefault();
                        if (page < totalPages) {
                          setPage(page + 1);
                          window.scrollTo(0, 0);
                        }
                      }}
                    />
                  </PaginationItem>
                </PaginationContent>
              </Pagination>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Add Employee Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="w-[95vw] max-w-[600px] max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Add New Employee</DialogTitle>
            <DialogDescription>
              Add a new employee to the system.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="name">Full Name *</Label>
                <Input
                  id="name"
                  value={newEmployee.name}
                  onChange={(e) => setNewEmployee({...newEmployee, name: e.target.value})}
                  placeholder="Enter full name"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="email">Email *</Label>
                <Input
                  id="email"
                  type="email"
                  value={newEmployee.email}
                  onChange={(e) => setNewEmployee({...newEmployee, email: e.target.value})}
                  placeholder="Enter email address"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="employee_code">Employee Code *</Label>
                <Input
                  id="employee_code"
                  value={newEmployee.employee_code}
                  onChange={(e) => setNewEmployee({...newEmployee, employee_code: e.target.value})}
                  placeholder="e.g., EMP001"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="phone">Phone</Label>
                <Input
                  id="phone"
                  value={newEmployee.phone}
                  onChange={(e) => setNewEmployee({...newEmployee, phone: e.target.value})}
                  placeholder="Enter phone number"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="branch">Branch *</Label>
                <Select
                  value={newEmployee.branch}
                  onValueChange={(value) => setNewEmployee({...newEmployee, branch: value})}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select branch" />
                  </SelectTrigger>
                  <SelectContent>
                    {(() => {
                      const accessibleBranches = getAccessibleBranches();
                      let filteredBranches = branches;
                      
                      if (!isAdmin && accessibleBranches.length > 0) {
                        filteredBranches = branches.filter((branch: any) => 
                          accessibleBranches.includes(branch.id)
                        );
                      }
                      
                      return filteredBranches.map((branch: any) => (
                        <SelectItem key={branch.id} value={branch.name}>
                          {branch.name}
                        </SelectItem>
                      ));
                    })()}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="job_title">Job Title</Label>
                <Input
                  id="job_title"
                  value={newEmployee.job_title}
                  onChange={(e) => setNewEmployee({...newEmployee, job_title: e.target.value})}
                  placeholder="Enter job title"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="employee_type">Employee Type</Label>
                <Select
                  value={newEmployee.employee_type}
                  onValueChange={(value) => setNewEmployee({...newEmployee, employee_type: value})}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="regular">Regular</SelectItem>
                    <SelectItem value="part-time">Part-time</SelectItem>
                    <SelectItem value="contract">Contract</SelectItem>
                    <SelectItem value="intern">Intern</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="working_hours">Working Hours/Week</Label>
                <Input
                  id="working_hours"
                  value={newEmployee.working_hours}
                  onChange={(e) => setNewEmployee({...newEmployee, working_hours: e.target.value})}
                  placeholder="N/A"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="leave_allowance">Annual Leave Allowance (days)</Label>
                <Input
                  id="leave_allowance"
                  type="number"
                  value={newEmployee.leave_allowance}
                  onChange={(e) => setNewEmployee({...newEmployee, leave_allowance: parseInt(e.target.value) || 28})}
                  placeholder="28"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="hours_restriction">Hours Restriction</Label>
                <Input
                  id="hours_restriction"
                  value={newEmployee.hours_restriction}
                  onChange={(e) => setNewEmployee({...newEmployee, hours_restriction: e.target.value})}
                  placeholder="e.g., 20 hours max"
                />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={addEmployee} className="bg-gradient-primary hover:opacity-90">
              Add Employee
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Import Dialog */}
      <Dialog open={importDialogOpen} onOpenChange={setImportDialogOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>Import Employees</DialogTitle>
            <DialogDescription>
              Upload a CSV or Excel file to import multiple employees at once.
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4">
            {/* Template Download */}
            <div className="flex items-center justify-between p-3 bg-muted rounded-lg">
              <div className="flex items-center gap-2">
                <FileSpreadsheet className="w-4 h-4" />
                <span className="text-sm font-medium">Download Template</span>
              </div>
              <Button 
                variant="outline" 
                size="sm" 
                onClick={downloadTemplate}
              >
                <Download className="w-4 h-4 mr-2" />
                Download
              </Button>
            </div>

            {/* Required Fields Info */}
            <Alert>
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                <strong>Required columns:</strong> Name, Employee Code, Branch<br/>
                <strong>Optional:</strong> Phone, Job Title, Employee Type, Working Hours, Days Taken, Days Remaining
              </AlertDescription>
            </Alert>

            {/* Drag and Drop Area */}
            <div
              className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors ${
                dragActive 
                  ? 'border-primary bg-primary/5' 
                  : 'border-muted-foreground/25 hover:border-primary/50'
              }`}
              onDrop={handleDrop}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onClick={() => fileInputRef.current?.click()}
            >
              <Upload className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
              <p className="text-lg font-medium mb-2">
                {dragActive ? 'Drop your file here' : 'Drop your file here or click to browse'}
              </p>
              <p className="text-sm text-muted-foreground">
                Supports CSV and Excel files (.csv, .xlsx, .xls)
              </p>
              <input
                ref={fileInputRef}
                type="file"
                accept=".csv,.xlsx,.xls"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) handleFileUpload(file);
                }}
                className="hidden"
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setImportDialogOpen(false)}>
              Cancel
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Preview Dialog */}
      <Dialog open={previewDialogOpen} onOpenChange={setPreviewDialogOpen}>
        <DialogContent className="sm:max-w-[800px] max-h-[600px]">
          <DialogHeader>
            <DialogTitle>Import Preview</DialogTitle>
            <DialogDescription>
              Review the data before importing. Rows with errors will be skipped.
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4">
            {importData.length > 0 && (
              <div className="flex items-center justify-between">
                <div className="text-sm text-muted-foreground">
                  {importData.filter(emp => !emp.error).length} valid / {importData.length} total employees
                </div>
                {importData.some(emp => emp.error) && (
                  <Badge variant="destructive">
                    {importData.filter(emp => emp.error).length} errors found
                  </Badge>
                )}
              </div>
            )}

            <div className="border rounded-lg max-h-[400px] overflow-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Status</TableHead>
                    <TableHead>Name</TableHead>
                    <TableHead>Employee Code</TableHead>
                    <TableHead>Branch</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>Leave Days</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {importData.map((employee, index) => (
                    <TableRow key={index} className={employee.error ? 'bg-destructive/10' : 'bg-success/10'}>
                      <TableCell>
                        {employee.error ? (
                          <div className="flex items-center gap-1 text-destructive">
                            <X className="w-4 h-4" />
                            <span className="text-xs">Error</span>
                          </div>
                        ) : (
                          <div className="flex items-center gap-1 text-green-600">
                            <span className="w-4 h-4 rounded-full bg-green-600 flex items-center justify-center">
                              <span className="text-white text-xs">✓</span>
                            </span>
                            <span className="text-xs">Valid</span>
                          </div>
                        )}
                      </TableCell>
                      <TableCell>
                        <div className="space-y-1">
                          <div className="font-medium">{employee.name || 'Missing'}</div>
                          {employee.error && (
                            <div className="text-xs text-destructive">{employee.error}</div>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="font-mono text-sm">
                        {employee.employee_code || 'Missing'}
                      </TableCell>
                      <TableCell>{employee.branch || 'Missing'}</TableCell>
                      <TableCell className="text-sm">
                        {employee.email || 'Not provided'}
                      </TableCell>
                      <TableCell className="text-sm">
                        <div className="space-y-1">
                          <div>
                            {employee.remaining_leave_days || 28} / {employee.leave_allowance || 28}
                          </div>
                          <div className="text-xs text-muted-foreground">
                            Used: {employee.leave_taken || 0}
                          </div>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setPreviewDialogOpen(false)}>
              Cancel
            </Button>
            <Button 
              onClick={handleImportEmployees}
              disabled={importing || importData.filter(emp => !emp.error).length === 0}
              className="bg-gradient-primary hover:opacity-90"
            >
              {importing ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                  Importing...
                </>
              ) : (
                `Import ${importData.filter(emp => !emp.error).length} Employees`
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* View/Edit Employee Dialog */}
      <Dialog open={viewDialogOpen} onOpenChange={(open) => {
        if (!open) {
          setEditMode(false);
        }
        setViewDialogOpen(open);
      }}>
        <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center justify-between">
              <span>{editMode ? 'Edit Employee' : 'Employee Details'}</span>
              {!editMode && (
                <div className="flex gap-2">
                  <Button 
                    variant="outline" 
                    size="sm"
                    onClick={() => setResetPasswordDialogOpen(true)}
                  >
                    <RotateCcw className="w-4 h-4 mr-2" />
                    Reset Password
                  </Button>
                  {canEditEmployees() && (
                    <Button 
                      variant="outline" 
                      size="sm"
                      onClick={() => setEditMode(true)}
                    >
                      <Edit3 className="w-4 h-4 mr-2" />
                      Edit
                    </Button>
                  )}
                </div>
              )}
            </DialogTitle>
            <DialogDescription>
              {editMode ? 'Update employee information' : 'View employee details'}
            </DialogDescription>
          </DialogHeader>
          
          {selectedEmployee && (
            <div className="grid gap-4 py-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="view_name">Full Name</Label>
                  {editMode ? (
                    <Input
                      id="view_name"
                      value={editedEmployee.name}
                      onChange={(e) => setEditedEmployee({...editedEmployee, name: e.target.value})}
                    />
                  ) : (
                    <div className="p-2 bg-muted rounded text-sm">{selectedEmployee.name}</div>
                  )}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="view_email">Email</Label>
                  {editMode ? (
                    <Input
                      id="view_email"
                      type="email"
                      value={editedEmployee.email}
                      onChange={(e) => setEditedEmployee({...editedEmployee, email: e.target.value})}
                    />
                  ) : (
                    <div className="p-2 bg-muted rounded text-sm">{selectedEmployee.email || 'N/A'}</div>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="view_employee_code">Employee Code</Label>
                  {editMode ? (
                    <Input
                      id="view_employee_code"
                      value={editedEmployee.employee_code}
                      onChange={(e) => setEditedEmployee({...editedEmployee, employee_code: e.target.value})}
                    />
                  ) : (
                    <div className="p-2 bg-muted rounded text-sm font-mono">{selectedEmployee.employee_code}</div>
                  )}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="view_phone">Phone</Label>
                  {editMode ? (
                    <Input
                      id="view_phone"
                      value={editedEmployee.phone}
                      onChange={(e) => setEditedEmployee({...editedEmployee, phone: e.target.value})}
                    />
                  ) : (
                    <div className="p-2 bg-muted rounded text-sm">{selectedEmployee.phone || 'N/A'}</div>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="view_branch">Branch</Label>
                  {editMode ? (
                    <Select
                      value={editedEmployee.branch}
                      onValueChange={(value) => setEditedEmployee({...editedEmployee, branch: value})}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select branch" />
                      </SelectTrigger>
                      <SelectContent>
                        {branches.map((branch: any) => (
                          <SelectItem key={branch.id} value={branch.name}>
                            {branch.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  ) : (
                    <div className="p-2 bg-muted rounded text-sm">{selectedEmployee.branch}</div>
                  )}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="view_job_title">Job Title</Label>
                  {editMode ? (
                    <Input
                      id="view_job_title"
                      value={editedEmployee.job_title}
                      onChange={(e) => setEditedEmployee({...editedEmployee, job_title: e.target.value})}
                    />
                  ) : (
                    <div className="p-2 bg-muted rounded text-sm">{selectedEmployee.job_title || 'N/A'}</div>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="view_employee_type">Employee Type</Label>
                  {editMode ? (
                    <Select
                      value={editedEmployee.employee_type}
                      onValueChange={(value) => setEditedEmployee({...editedEmployee, employee_type: value})}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select type" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="regular">Regular</SelectItem>
                        <SelectItem value="part-time">Part-time</SelectItem>
                        <SelectItem value="contract">Contract</SelectItem>
                        <SelectItem value="intern">Intern</SelectItem>
                      </SelectContent>
                    </Select>
                  ) : (
                    <div className="p-2 bg-muted rounded text-sm capitalize">{selectedEmployee.employee_type || 'Regular'}</div>
                  )}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="view_working_hours">Working Hours/Week</Label>
                  {editMode ? (
                    <Input
                      id="view_working_hours"
                      value={editedEmployee.working_hours}
                      onChange={(e) => setEditedEmployee({...editedEmployee, working_hours: e.target.value})}
                      placeholder="N/A"
                    />
                  ) : (
                    <div className="p-2 bg-muted rounded text-sm">{selectedEmployee.working_hours || 'N/A'}</div>
                  )}
                </div>
              </div>

              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="view_leave_allowance">Annual Leave Allowance</Label>
                  {editMode ? (
                    <Input
                      id="view_leave_allowance"
                      type="number"
                      value={editedEmployee.leave_allowance}
                      onChange={(e) => setEditedEmployee({...editedEmployee, leave_allowance: parseInt(e.target.value) || 28})}
                      placeholder="28"
                    />
                  ) : (
                    <div className="p-2 bg-muted rounded text-sm">{selectedEmployee.leave_allowance || 28} days</div>
                  )}
                </div>
                
                <div className="space-y-2">
                  <Label>Leave Status</Label>
                  {editMode ? (
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="view_leave_taken">Days Taken</Label>
                        <Input
                          id="view_leave_taken"
                          type="number"
                          min="0"
                          value={editedEmployee.leave_taken}
                          onChange={(e) => {
                            const value = e.target.value;
                            const numValue = value === '' ? 0 : parseInt(value) || 0;
                            setEditedEmployee({...editedEmployee, leave_taken: numValue});
                          }}
                          placeholder="0"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="view_remaining_days">Days Remaining</Label>
                        <Input
                          id="view_remaining_days"
                          type="number"
                          min="0"
                          value={editedEmployee.remaining_leave_days}
                          onChange={(e) => {
                            const value = e.target.value;
                            const numValue = value === '' ? 0 : parseInt(value) || 0;
                            setEditedEmployee({...editedEmployee, remaining_leave_days: numValue});
                          }}
                          placeholder="0"
                        />
                      </div>
                    </div>
                  ) : (
                    <div className="p-2 bg-muted rounded text-sm">
                      <div className="flex justify-between mb-1">
                        <span>Taken: {selectedEmployee.leave_taken === 0 || selectedEmployee.leave_taken ? selectedEmployee.leave_taken : 'N/A'} days</span>
                        <span>Remaining: {selectedEmployee.remaining_leave_days === 0 || selectedEmployee.remaining_leave_days ? selectedEmployee.remaining_leave_days : 'N/A'} days</span>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {(editedEmployee.hours_restriction || editMode) && (
                <div className="space-y-2">
                  <Label htmlFor="view_hours_restriction">Hours Restriction</Label>
                  {editMode ? (
                    <Input
                      id="view_hours_restriction"
                      value={editedEmployee.hours_restriction}
                      onChange={(e) => setEditedEmployee({...editedEmployee, hours_restriction: e.target.value})}
                      placeholder="e.g., 20 hours max"
                    />
                  ) : (
                    <div className="p-2 bg-muted rounded text-sm">{selectedEmployee.hours_restriction || 'None'}</div>
                  )}
                </div>
              )}
            </div>
          )}
          
          <DialogFooter>
            {editMode ? (
              <>
                <Button variant="outline" onClick={() => setEditMode(false)}>
                  Cancel
                </Button>
                <Button onClick={updateEmployee} className="bg-gradient-primary hover:opacity-90">
                  Save Changes
                </Button>
              </>
            ) : (
              <Button variant="outline" onClick={() => setViewDialogOpen(false)}>
                Close
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Employee Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you sure?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. This will permanently delete {selectedEmployee?.name}'s record from the system.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction 
              onClick={() => selectedEmployee && deleteEmployee(selectedEmployee.id)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Batch Delete Dialog */}
      <AlertDialog open={batchDeleteDialogOpen} onOpenChange={setBatchDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Multiple Employees</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. This will permanently delete {selectedEmployees.length} employee(s) from the system.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction 
              onClick={batchDeleteEmployees}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete {selectedEmployees.length} Employee(s)
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Reset Password Dialog */}
      <AlertDialog open={resetPasswordDialogOpen} onOpenChange={setResetPasswordDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Reset Employee Password</AlertDialogTitle>
            <AlertDialogDescription>
              This will reset {selectedEmployee?.name}'s password to the default "123456" and require them to change it on their next login. Are you sure you want to continue?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={resettingPassword}>Cancel</AlertDialogCancel>
            <AlertDialogAction 
              onClick={resetEmployeePassword}
              disabled={resettingPassword}
              className="bg-gradient-primary hover:opacity-90"
            >
              {resettingPassword ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                  Resetting...
                </>
              ) : (
                'Reset Password'
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
