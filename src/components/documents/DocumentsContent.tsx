import { useState, useEffect, useRef } from "react";
import { Plus, FileText, Search, Filter, AlertTriangle, CheckCircle, Clock, Calendar, Upload, Download, X, FileSpreadsheet, AlertCircle, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DatePicker } from "@/components/ui/date-picker";
import { DateTextPicker } from "@/components/ui/date-text-picker";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Checkbox } from "@/components/ui/checkbox";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { DocumentTable } from "./DocumentTable";
import { DocumentViewDialog } from "./DocumentViewDialog";
import { DocumentEditDialog } from "./DocumentEditDialog";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { usePermissions } from "@/contexts/PermissionsContext";
import { usePagePermissions } from "@/hooks/usePagePermissions";
import Papa from 'papaparse';
import * as XLSX from 'xlsx';
import countries from "world-countries";

// Precomputed country list for the Country select
const COUNTRY_NAMES = countries.map((c) => c.name.common).sort();

interface Document {
  id: string;
  employee_id: string;
  document_type_id: string;
  branch_id: string;
  document_number?: string;
  issue_date?: string;
  expiry_date: string;
  status: string;
  notes?: string;
  country?: string;
  nationality_status?: string;
  employees?: {
    name: string;
    email: string;
    branch: string;
  };
  document_types?: {
    name: string;
  };
}

interface Employee {
  id: string;
  name: string;
  email: string;
  branch: string;
  branch_id: string;
  employee_code: string;
  sponsored?: boolean;
  twenty_hours?: boolean;
}

interface DocumentType {
  id: string;
  name: string;
}

interface Branch {
  id: string;
  name: string;
}

interface ImportDocument {
  employee_name: string;
  branch: string;
  status: string;
  country: string;
  passport_expiry?: string;
  passport_days_left?: string;
  right_to_work_expiry?: string;
  right_to_work_days_left?: string;
  sponsored?: string;
  twenty_hours_restriction?: string;
  error?: string;
}

export function DocumentsContent() {
  const [documents, setDocuments] = useState<Document[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [documentTypes, setDocumentTypes] = useState<DocumentType[]>([]);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [loading, setLoading] = useState(true);
  const { getAccessibleBranches, isAdmin } = usePermissions();
  const { 
    canViewDocuments,
    canCreateDocuments,
    canEditDocuments,
    canDeleteDocuments,
    canUploadDocuments
  } = usePagePermissions();
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [branchFilter, setBranchFilter] = useState("all");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [viewDialogOpen, setViewDialogOpen] = useState(false);
  const [selectedDocument, setSelectedDocument] = useState<Document | null>(null);
  const [newDocument, setNewDocument] = useState({
    employee_id: "",
    document_type_id: "",
    branch_id: "",
    document_number: "",
    issue_date: null as Date | string | null,
    expiry_date: null as Date | string | null,
    country: "",
    nationality_status: "",
    notes: ""
  });
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [selectedDocumentForEdit, setSelectedDocumentForEdit] = useState<Document | null>(null);
  const [sponsored, setSponsored] = useState(false);
  const [twentyHours, setTwentyHours] = useState(false);
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [importDialogOpen, setImportDialogOpen] = useState(false);
  const [previewDialogOpen, setPreviewDialogOpen] = useState(false);
  const [importData, setImportData] = useState<ImportDocument[]>([]);
  const [importing, setImporting] = useState(false);
  const [dragActive, setDragActive] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [selectedDocuments, setSelectedDocuments] = useState<string[]>([]);
  const [batchDeleteDialogOpen, setBatchDeleteDialogOpen] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    fetchData();
  }, []);

  // Effect to handle pre-population when both employee and document type are selected
  useEffect(() => {
    if (newDocument.employee_id && newDocument.document_type_id) {
      prePopulateDocumentFields();
    }
  }, [newDocument.employee_id, newDocument.document_type_id]);

  const fetchData = async () => {
    try {
      setLoading(true);
      
      const { data: documentsData, error: documentsError } = await supabase
        .from('document_tracker')
        .select(`
          *,
          employees (name, email, branch),
          document_types (name)
        `)
        .order('expiry_date', { ascending: true });

      if (documentsError) throw documentsError;

      const { data: employeesData, error: employeesError } = await supabase
        .from('employees')
        .select('id, name, email, branch, branch_id, employee_code, sponsored, twenty_hours')
        .order('name');

      if (employeesError) throw employeesError;

      const { data: documentTypesData, error: documentTypesError } = await supabase
        .from('document_types')
        .select('id, name')
        .order('name');

      if (documentTypesError) throw documentTypesError;

      const { data: branchesData, error: branchesError } = await supabase
        .from('branches')
        .select('id, name')
        .order('name');

      if (branchesError) throw branchesError;

      console.log('Document Types fetched:', documentTypesData);
      console.log('Employees fetched:', employeesData);

      // Filter employees based on branch access for non-admin users
      const accessibleBranches = getAccessibleBranches();
      let filteredEmployees = employeesData || [];
      
      if (!isAdmin && accessibleBranches.length > 0) {
        filteredEmployees = employeesData?.filter(employee => {
          const employeeBranchId = branchesData?.find(b => b.name === employee.branch)?.id;
          return accessibleBranches.includes(employeeBranchId || '');
        }) || [];
      }

      setDocuments(documentsData || []);
      setEmployees(filteredEmployees);
      setDocumentTypes(documentTypesData || []);
      setBranches(branchesData || []);
    } catch (error) {
      console.error('Error fetching data:', error);
      toast({
        title: "Error loading data",
        description: "Could not fetch document data. Please try again.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  // Helper function to check if a string is a valid date
  const isValidDate = (dateStr: string) => {
    if (!dateStr) return false;
    const date = new Date(dateStr);
    return !isNaN(date.getTime()) && dateStr !== 'N/A' && dateStr !== 'NOT REQUIRED';
  };

  // New function to pre-populate document fields based on existing data
  const prePopulateDocumentFields = () => {
    const existingDocument = documents.find(doc => 
      doc.employee_id === newDocument.employee_id && 
      doc.document_type_id === newDocument.document_type_id
    );

    if (existingDocument) {
      console.log('Pre-populating fields for existing document:', existingDocument);
      setNewDocument(prev => ({
        ...prev,
        document_number: existingDocument.document_number || "",
        issue_date: existingDocument.issue_date && isValidDate(existingDocument.issue_date) ? new Date(existingDocument.issue_date) : existingDocument.issue_date,
        expiry_date: existingDocument.expiry_date && isValidDate(existingDocument.expiry_date) ? new Date(existingDocument.expiry_date) : existingDocument.expiry_date,
        country: existingDocument.country || "",
        nationality_status: existingDocument.nationality_status || "",
        notes: existingDocument.notes || ""
      }));
    } else {
      // Clear fields if no existing document found for this combination
      setNewDocument(prev => ({
        ...prev,
        document_number: "",
        issue_date: null,
        expiry_date: null,
        country: "",
        nationality_status: "",
        notes: ""
      }));
    }
  };

  // Handle employee selection and auto-populate branch
  const handleEmployeeChange = (employeeId: string) => {
    const selectedEmployee = employees.find(emp => emp.id === employeeId);
    console.log('Selected employee:', selectedEmployee);
    
    setNewDocument(prev => ({
      ...prev,
      employee_id: employeeId,
      branch_id: selectedEmployee?.branch_id || "",
      // Reset document type and fields when employee changes
      document_type_id: "",
      document_number: "",
      issue_date: null,
      expiry_date: null,
      country: "",
      nationality_status: "",
      notes: ""
    }));
  };

  // Handle document type selection
  const handleDocumentTypeChange = (documentTypeId: string) => {
    setNewDocument(prev => ({
      ...prev,
      document_type_id: documentTypeId
    }));
    // The useEffect will handle pre-population when both employee and document type are set
  };

  const addDocument = async () => {
    try {
      if (!newDocument.employee_id || !newDocument.document_type_id || !newDocument.expiry_date) {
        toast({
          title: "Missing information",
          description: "Please fill in all required fields.",
          variant: "destructive",
        });
        return;
      }

      // Handle both Date and string values for dates
      let status = 'valid';
      let expiryDateValue = '';
      let issueDateValue = '';
      
      // Process expiry date - can be either Date object or string
      if (newDocument.expiry_date instanceof Date) {
        const expiryDate = newDocument.expiry_date;
        
        // Validate the date
        if (isNaN(expiryDate.getTime())) {
          console.error('Invalid expiry date:', expiryDate);
          toast({
            title: "Invalid date",
            description: "Please enter a valid expiry date.",
            variant: "destructive",
          });
          return;
        }
        
        // Calculate status for date values
        const today = new Date();
        const daysUntilExpiry = Math.ceil((expiryDate.getTime() - today.getTime()) / (1000 * 3600 * 24));
        
        if (daysUntilExpiry < 0) {
          status = 'expired';
        } else if (daysUntilExpiry <= 30) {
          status = 'expiring';
        }
        
        // Convert to ISO date string
        expiryDateValue = new Date(expiryDate.getTime() - expiryDate.getTimezoneOffset() * 60000).toISOString().split('T')[0];
      } else {
        // For text values, save as-is and set status to valid (no calculations)
        expiryDateValue = newDocument.expiry_date as string;
        status = 'valid'; // Don't calculate status for text values
      }

      // Process issue date - can be either Date object or string
      if (newDocument.issue_date instanceof Date) {
        // Validate the date
        if (isNaN(newDocument.issue_date.getTime())) {
          console.error('Invalid issue date:', newDocument.issue_date);
          toast({
            title: "Invalid date",
            description: "Please enter a valid issue date.",
            variant: "destructive",
          });
          return;
        }
        issueDateValue = new Date(newDocument.issue_date.getTime() - newDocument.issue_date.getTimezoneOffset() * 60000).toISOString().split('T')[0];
      } else {
        issueDateValue = newDocument.issue_date as string;
      }

      // Update employee sponsored/twenty_hours status if changed
      if (sponsored || twentyHours) {
        const { error: updateError } = await supabase
          .from('employees')
          .update({ 
            sponsored: sponsored,
            twenty_hours: twentyHours 
          })
          .eq('id', newDocument.employee_id);

        if (updateError) throw updateError;
      }

      const documentData = {
        employee_id: newDocument.employee_id,
        document_type_id: newDocument.document_type_id,
        branch_id: newDocument.branch_id || null,
        document_number: newDocument.document_number || null,
        issue_date: issueDateValue || null,
        expiry_date: expiryDateValue,
        country: newDocument.country || null,
        nationality_status: newDocument.nationality_status || null,
        notes: newDocument.notes || null,
        status
      };
      
      console.log('About to insert document:', documentData);
      
      const { data, error } = await supabase
        .from('document_tracker')
        .insert(documentData)
        .select();

      if (error) {
        console.error('Insert error:', error);
        throw error;
      }

      toast({
        title: "Document added",
        description: "The document has been added successfully.",
      });

      setDialogOpen(false);
      setNewDocument({
        employee_id: "",
        document_type_id: "",
        branch_id: "",
        document_number: "",
        issue_date: null,
        expiry_date: null,
        country: "",
        nationality_status: "",
        notes: ""
      });
      setSponsored(false);
      setTwentyHours(false);
      fetchData();
    } catch (error) {
      console.error('Error adding document:', error);
      toast({
        title: "Error adding document",
        description: "Could not add document. Please try again.",
        variant: "destructive",
      });
    }
  };

  const filteredDocuments = documents.filter(document => {
    const matchesSearch = 
      document.employees?.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      document.employees?.email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      document.document_types?.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      document.document_number?.toLowerCase()?.includes(searchTerm.toLowerCase());
    
    const isValidDate = (dateStr: string) => {
      if (!dateStr) return false;
      // Try parsing as date first
      const date = new Date(dateStr);
      return !isNaN(date.getTime());
    };

    const expiryDate = isValidDate(document.expiry_date) ? new Date(document.expiry_date) : null;
    let documentStatus = 'valid';
    
    if (expiryDate) {
      const today = new Date();
      const daysUntilExpiry = Math.ceil((expiryDate.getTime() - today.getTime()) / (1000 * 3600 * 24));
      
      if (daysUntilExpiry < 0) {
        documentStatus = 'expired';
      } else if (daysUntilExpiry <= 30) {
        documentStatus = 'expiring';
      }
    }
    
    const matchesStatus = statusFilter === 'all' || documentStatus === statusFilter;
    const matchesBranch = branchFilter === 'all' || document.employees?.branch === branchFilter;
    
    // Category filtering
    const employee = employees.find(emp => emp.id === document.employee_id);
    let matchesCategory = true;
    
    if (categoryFilter === 'sponsored') {
      matchesCategory = employee?.sponsored === true;
    } else if (categoryFilter === '20-hours') {
      matchesCategory = employee?.twenty_hours === true;
    }
    
    // For non-admin users, filter by accessible branches
    const accessibleBranches = getAccessibleBranches();
    console.log('Document filtering - isAdmin:', isAdmin, 'accessibleBranches:', accessibleBranches, 'employee.branch:', document.employees?.branch);
    
    let hasAccess = true;
    if (!isAdmin && accessibleBranches.length > 0) {
      // Check if document's employee branch_id is in accessible branches
      // Map branch name to branch ID since document uses branch name
      const employeeBranchId = branches.find(b => b.name === document.employees?.branch)?.id;
      hasAccess = accessibleBranches.includes(employeeBranchId || '');
    }
    
    return matchesSearch && matchesStatus && matchesBranch && matchesCategory && hasAccess;
  });

  // Count unique employees instead of total documents for the grouped view
  const uniqueEmployeeCount = new Set(filteredDocuments.map(doc => doc.employee_id)).size;

  // Function to handle stat card clicks
  const handleStatCardClick = (status: string) => {
    setStatusFilter(status);
  };

  const handleView = (document: Document) => {
    setSelectedDocument(document);
    setViewDialogOpen(true);
  };

  const handleEdit = (document: Document) => {
    setSelectedDocumentForEdit(document);
    setEditDialogOpen(true);
  };

  const handleEditSave = () => {
    fetchData(); // Refresh the data after edit
  };

  const handleDelete = async (document: Document) => {
    if (!canDeleteDocuments()) {
      toast({
        title: "Access denied",
        description: "You don't have permission to delete documents.",
        variant: "destructive",
      });
      return;
    }
    
    try {
      const { error } = await supabase
        .from('document_tracker')
        .delete()
        .eq('id', document.id);

      if (error) throw error;

      toast({
        title: "Document deleted",
        description: "The document has been deleted successfully.",
      });

      fetchData();
    } catch (error) {
      console.error('Error deleting document:', error);
      toast({
        title: "Error deleting document",
        description: "Could not delete document. Please try again.",
        variant: "destructive",
      });
    }
  };

  const batchDeleteDocuments = async () => {
    if (!canDeleteDocuments()) {
      toast({
        title: "Access denied",
        description: "You don't have permission to delete documents.",
        variant: "destructive",
      });
      return;
    }
    
    try {
      const { error } = await supabase
        .from('document_tracker')
        .delete()
        .in('id', selectedDocuments);

      if (error) throw error;

      toast({
        title: "Documents deleted",
        description: `Successfully deleted ${selectedDocuments.length} documents.`,
      });

      setBatchDeleteDialogOpen(false);
      setSelectedDocuments([]);
      fetchData();
    } catch (error) {
      console.error('Error deleting documents:', error);
      toast({
        title: "Error deleting documents",
        description: "Could not delete documents. Please try again.",
        variant: "destructive",
      });
    }
  };

  const toggleSelectDocument = (documentId: string) => {
    setSelectedDocuments(prev => 
      prev.includes(documentId) 
        ? prev.filter(id => id !== documentId)
        : [...prev, documentId]
    );
  };

  const toggleSelectAll = () => {
    if (selectedDocuments.length === filteredDocuments.length) {
      setSelectedDocuments([]);
    } else {
      setSelectedDocuments(filteredDocuments.map(doc => doc.id));
    }
  };

  // Document Import Functions
  const downloadTemplate = () => {
    const template = [
      {
        'Employee Name': 'John Doe',
        'Branch': 'Main Office',
        'Status': 'BRITISH',
        'Country': 'United Kingdom',
        'Passport': '27/10/2030',
        'Passport Days Left': '1991',
        'Right to Work': '14/07/2030',
        'Right to Work Days Left': '1826',
        'Sponsored': 'Yes',
        '20 Hours Restriction': 'No'
      }
    ];

    const csv = Papa.unparse(template);
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', 'document_import_template.csv');
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    window.URL.revokeObjectURL(url);

    toast({
      title: "Template downloaded",
      description: "Document import template has been downloaded.",
    });
  };

  const processDocumentFileData = (data: any[]): ImportDocument[] => {
    return data.map((row, index) => {
      const document: ImportDocument = {
        employee_name: '',
        branch: '',
        status: '',
        country: '',
        error: ''
      };

      // Helper function to process cell values
      const processCellValue = (value: any) => {
        if (value === null || value === undefined || value === '') {
          return 'N/A';
        }
        return value.toString().trim();
      };

      // Map column names (case-insensitive)
      Object.keys(row).forEach(key => {
        const lowerKey = key.toLowerCase().replace(/\s+/g, '_');
        const value = row[key];

        if (lowerKey.includes('employee') && lowerKey.includes('name')) {
          document.employee_name = value?.toString().trim() || '';
        } else if (lowerKey.includes('branch')) {
          document.branch = processCellValue(value);
        } else if (lowerKey.includes('status')) {
          document.status = processCellValue(value);
        } else if (lowerKey.includes('country')) {
          document.country = processCellValue(value);
        } else if (lowerKey.includes('passport') && !lowerKey.includes('days')) {
          document.passport_expiry = processCellValue(value);
        } else if (lowerKey.includes('passport') && lowerKey.includes('days')) {
          document.passport_days_left = processCellValue(value);
        } else if (lowerKey.includes('right') && lowerKey.includes('work') && !lowerKey.includes('days')) {
          document.right_to_work_expiry = processCellValue(value);
        } else if (lowerKey.includes('right') && lowerKey.includes('work') && lowerKey.includes('days')) {
          document.right_to_work_days_left = processCellValue(value);
        } else if (lowerKey.includes('sponsored')) {
          document.sponsored = processCellValue(value);
        } else if (lowerKey.includes('20') && lowerKey.includes('hours')) {
          document.twenty_hours_restriction = processCellValue(value);
        }
      });

      // Validate required fields
      const errors = [];
      if (!document.employee_name) errors.push('Employee Name is required');
      
      // Check if at least one document type has a valid date or text value
      const isValidDateOrText = (dateStr: string) => {
        if (!dateStr) return false;
        
        // Accept text values like "NOT REQUIRED", "N/A", etc.
        if (dateStr.trim().length > 0 && isNaN(Date.parse(dateStr))) {
          return true; // Accept any text that's not a parseable date
        }
        
        // Check if it's a valid DD/MM/YYYY date format
        const parts = dateStr.split('/');
        if (parts.length === 3) {
          const day = parseInt(parts[0]);
          const month = parseInt(parts[1]) - 1;
          const year = parseInt(parts[2]);
          const date = new Date(year, month, day);
          return !isNaN(date.getTime()) && 
                 date.getDate() === day && 
                 date.getMonth() === month && 
                 date.getFullYear() === year;
        }
        return false;
      };

      const hasValidPassportEntry = isValidDateOrText(document.passport_expiry);
      const hasValidRightToWorkEntry = isValidDateOrText(document.right_to_work_expiry);
      
      if (!hasValidPassportEntry && !hasValidRightToWorkEntry) {
        errors.push('At least one document field must have a valid date (DD/MM/YYYY format) or text value');
      }

      // Check if employee exists
      const employee = employees.find(emp => emp.name.toLowerCase() === document.employee_name.toLowerCase());
      if (!employee) {
        errors.push('Employee not found');
      }

      document.error = errors.join(', ');
      return document;
    });
  };

  const handleDocumentFileUpload = (file: File) => {
    const fileExtension = file.name.split('.').pop()?.toLowerCase();
    
    if (fileExtension === 'csv') {
      Papa.parse(file, {
        header: true,
        skipEmptyLines: true,
        complete: (results) => {
          const processedData = processDocumentFileData(results.data);
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
          
          const processedData = processDocumentFileData(jsonData);
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
      handleDocumentFileUpload(files[0]);
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

  const handleImportDocuments = async () => {
    setImporting(true);
    
    try {
      const validDocuments = importData.filter(doc => !doc.error);
      
      if (validDocuments.length === 0) {
        toast({
          title: "No valid documents",
          description: "Please fix the errors in your import data.",
          variant: "destructive",
        });
        setImporting(false);
        return;
      }

      // Helper function to parse DD/MM/YYYY date format
      const parseDate = (dateStr: string) => {
        if (!dateStr || dateStr === 'N/A') return null;
        const parts = dateStr.split('/');
        if (parts.length === 3) {
          const day = parseInt(parts[0]);
          const month = parseInt(parts[1]) - 1; // Month is 0-indexed
          const year = parseInt(parts[2]);
          // Validate the date components
          if (isNaN(day) || isNaN(month) || isNaN(year)) return null;
          // Create date at noon UTC to avoid timezone issues
          const date = new Date(year, month, day, 12, 0, 0);
          // Verify the date is valid and matches input
          if (date.getDate() !== day || date.getMonth() !== month || date.getFullYear() !== year) {
            return null;
          }
          return date;
        }
        return null;
      };

      // Get document types
      const passportType = documentTypes.find(type => type.name.toLowerCase().includes('passport'));
      const rightToWorkType = documentTypes.find(type => type.name.toLowerCase().includes('right to work'));

      const documentsToInsert = [];
      const employeesToUpdate = [];

      for (const doc of validDocuments) {
        const employee = employees.find(emp => emp.name.toLowerCase() === doc.employee_name.toLowerCase());
        if (!employee) continue;

        // Update employee sponsored and twenty_hours status
        const sponsored = doc.sponsored?.toLowerCase() === 'yes';
        const twentyHours = doc.twenty_hours_restriction?.toLowerCase() === 'yes';
        
        if (employee.sponsored !== sponsored || employee.twenty_hours !== twentyHours) {
          employeesToUpdate.push({
            id: employee.id,
            sponsored,
            twenty_hours: twentyHours
          });
        }

        // Create passport document if expiry date exists
        if (doc.passport_expiry && passportType) {
          const expiryDate = parseDate(doc.passport_expiry);
          let status = 'valid';
          let expiryDateValue = doc.passport_expiry;
          
          if (expiryDate) {
            // Valid date - calculate status and convert to ISO format
            const today = new Date();
            const daysUntilExpiry = Math.ceil((expiryDate.getTime() - today.getTime()) / (1000 * 3600 * 24));
            
            if (daysUntilExpiry < 0) {
              status = 'expired';
            } else if (daysUntilExpiry <= 30) {
              status = 'expiring';
            }
            expiryDateValue = expiryDate.toISOString().split('T')[0];
          } else {
            // Text value - keep as is, don't calculate status
            expiryDateValue = doc.passport_expiry;
          }

          documentsToInsert.push({
            employee_id: employee.id,
            document_type_id: passportType.id,
            branch_id: employee.branch_id,
            expiry_date: expiryDateValue,
            country: doc.country || null,
            nationality_status: doc.status || null,
            status
          });
        }

        // Create right to work document if expiry date exists
        if (doc.right_to_work_expiry && rightToWorkType) {
          const expiryDate = parseDate(doc.right_to_work_expiry);
          let status = 'valid';
          let expiryDateValue = doc.right_to_work_expiry;
          
          if (expiryDate) {
            // Valid date - calculate status and convert to ISO format
            const today = new Date();
            const daysUntilExpiry = Math.ceil((expiryDate.getTime() - today.getTime()) / (1000 * 3600 * 24));
            
            if (daysUntilExpiry < 0) {
              status = 'expired';
            } else if (daysUntilExpiry <= 30) {
              status = 'expiring';
            }
            expiryDateValue = expiryDate.toISOString().split('T')[0];
          } else {
            // Text value - keep as is, don't calculate status
            expiryDateValue = doc.right_to_work_expiry;
          }

          documentsToInsert.push({
            employee_id: employee.id,
            document_type_id: rightToWorkType.id,
            branch_id: employee.branch_id,
            expiry_date: expiryDateValue,
            country: doc.country || null,
            nationality_status: doc.status || null,
            status
          });
        }
      }

      // Update employees
      for (const empUpdate of employeesToUpdate) {
        await supabase
          .from('employees')
          .update({ 
            sponsored: empUpdate.sponsored,
            twenty_hours: empUpdate.twenty_hours 
          })
          .eq('id', empUpdate.id);
      }

      // Insert documents
      if (documentsToInsert.length > 0) {
        const { error } = await supabase
          .from('document_tracker')
          .insert(documentsToInsert);

        if (error) throw error;
      }

      toast({
        title: "Documents imported successfully",
        description: `${documentsToInsert.length} documents have been imported and ${employeesToUpdate.length} employees updated.`,
      });

      setPreviewDialogOpen(false);
      setImportData([]);
      fetchData();
    } catch (error) {
      console.error('Error importing documents:', error);
      toast({
        title: "Error importing documents",
        description: "An error occurred while importing documents. Please try again.",
        variant: "destructive",
      });
    } finally {
      setImporting(false);
    }
  };

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
            Document Tracker
          </h1>
          <p className="text-lg text-muted-foreground">
            Monitor employee documents and expiration dates
          </p>
        </div>
        
        <div className="flex items-center gap-3">
          {selectedDocuments.length > 0 && canDeleteDocuments() && (
            <Button 
              variant="destructive"
              onClick={() => setBatchDeleteDialogOpen(true)}
            >
              <Trash2 className="w-4 h-4 mr-2" />
              Delete Selected ({selectedDocuments.length})
            </Button>
          )}
          {canUploadDocuments() && (
            <Button 
              variant="outline"
              onClick={() => setImportDialogOpen(true)}
            >
              <Upload className="w-4 h-4 mr-2" />
              Import Documents
            </Button>
          )}
          {canCreateDocuments() && (
            <Button 
              className="bg-gradient-primary hover:opacity-90"
              onClick={() => setDialogOpen(true)}
            >
              <Plus className="w-4 h-4 mr-2" />
              Add Document
            </Button>
          )}
        </div>
      </div>

      {/* Search and Filters */}
      <div className="flex flex-col sm:flex-row gap-4 animate-slide-up">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Search documents..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10 bg-card border-input-border"
          />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="Filter by status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Status</SelectItem>
            <SelectItem value="valid">Valid</SelectItem>
            <SelectItem value="expiring">Expiring Soon</SelectItem>
            <SelectItem value="expired">Expired</SelectItem>
          </SelectContent>
        </Select>
        <Select value={branchFilter} onValueChange={setBranchFilter}>
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="Filter by branch" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Branches</SelectItem>
            {[...new Set(documents.map(doc => doc.employees?.branch).filter(Boolean))].map((branch) => (
              <SelectItem key={branch} value={branch!}>
                {branch}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6 animate-slide-up">
        <Card 
          className="card-premium cursor-pointer hover:shadow-lg transition-shadow"
          onClick={() => handleStatCardClick('all')}
        >
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Total Documents</p>
                <p className="text-2xl font-bold">{documents.length}</p>
              </div>
              <div className="w-10 h-10 rounded-lg bg-gradient-primary flex items-center justify-center">
                <FileText className="w-5 h-5 text-white" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card 
          className="card-premium cursor-pointer hover:shadow-lg transition-shadow"
          onClick={() => handleStatCardClick('valid')}
        >
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Valid</p>
                <p className="text-2xl font-bold">
                  {documents.filter(doc => {
                    const daysUntilExpiry = Math.ceil((new Date(doc.expiry_date).getTime() - new Date().getTime()) / (1000 * 3600 * 24));
                    return daysUntilExpiry > 30;
                  }).length}
                </p>
              </div>
              <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-green-500 to-green-600 flex items-center justify-center">
                <CheckCircle className="w-5 h-5 text-white" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card 
          className="card-premium cursor-pointer hover:shadow-lg transition-shadow"
          onClick={() => handleStatCardClick('expiring')}
        >
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Expiring Soon</p>
                <p className="text-2xl font-bold">
                  {documents.filter(doc => {
                    const daysUntilExpiry = Math.ceil((new Date(doc.expiry_date).getTime() - new Date().getTime()) / (1000 * 3600 * 24));
                    return daysUntilExpiry >= 0 && daysUntilExpiry <= 30;
                  }).length}
                </p>
              </div>
              <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-yellow-500 to-yellow-600 flex items-center justify-center">
                <Clock className="w-5 h-5 text-white" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card 
          className="card-premium cursor-pointer hover:shadow-lg transition-shadow"
          onClick={() => handleStatCardClick('expired')}
        >
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Expired</p>
                <p className="text-2xl font-bold">
                  {documents.filter(doc => {
                    const daysUntilExpiry = Math.ceil((new Date(doc.expiry_date).getTime() - new Date().getTime()) / (1000 * 3600 * 24));
                    return daysUntilExpiry < 0;
                  }).length}
                </p>
              </div>
              <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-red-500 to-red-600 flex items-center justify-center">
                <AlertTriangle className="w-5 h-5 text-white" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Documents Table with Tabs */}
      <Card className="card-premium animate-fade-in">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Document Registry ({new Set(filteredDocuments.map(doc => doc.employee_id)).size} employees({filteredDocuments.length} documents))
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Tabs value={categoryFilter} onValueChange={setCategoryFilter} className="mb-4">
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="all">All</TabsTrigger>
              <TabsTrigger value="sponsored">Sponsored</TabsTrigger>
              <TabsTrigger value="20-hours">20 Hours</TabsTrigger>
            </TabsList>
            <TabsContent value={categoryFilter} className="mt-4">
              {filteredDocuments.length === 0 ? (
                <div className="text-center py-12">
                  <FileText className="w-16 h-16 mx-auto text-muted-foreground/50 mb-4" />
                  <h3 className="text-lg font-semibold mb-2">No documents found</h3>
                  <p className="text-muted-foreground mb-4">
                    {searchTerm || statusFilter !== 'all' || branchFilter !== 'all' || categoryFilter !== 'all'
                      ? "Try adjusting your search or filter criteria." 
                      : "Get started by adding a document."
                    }
                  </p>
                </div>
              ) : (
        <DocumentTable
          documents={filteredDocuments}
          employees={employees}
          documentTypes={documentTypes}
          selectedDocuments={selectedDocuments}
          onView={canViewDocuments() ? handleView : undefined}
          onEdit={canEditDocuments() ? handleEdit : undefined}
          onDelete={canDeleteDocuments() ? handleDelete : undefined}
          onSelectDocument={toggleSelectDocument}
          onSelectAll={toggleSelectAll}
        />
              )}
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>

      {/* Add Document Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-[600px]">
          <DialogHeader>
            <DialogTitle>Add New Document</DialogTitle>
            <DialogDescription>
              Add a new document to track for an employee. Fields will auto-populate if the employee already has this document type.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="employee">Employee</Label>
                <Select
                  value={newDocument.employee_id}
                  onValueChange={handleEmployeeChange}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select employee" />
                  </SelectTrigger>
                  <SelectContent>
                    {employees.map((emp) => (
                      <SelectItem key={emp.id} value={emp.id}>
                        {emp.name} ({emp.branch})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="document_type">Document Type</Label>
                <Select
                  value={newDocument.document_type_id}
                  onValueChange={handleDocumentTypeChange}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select type" />
                  </SelectTrigger>
                  <SelectContent>
                    {documentTypes.map((type) => (
                      <SelectItem key={type.id} value={type.id}>
                        {type.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="document_number">Document Number</Label>
              <Input
                id="document_number"
                value={newDocument.document_number}
                onChange={(e) => setNewDocument({...newDocument, document_number: e.target.value})}
                placeholder="e.g., ABC123456"
              />
            </div>
            
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Issue Date</Label>
                <DateTextPicker
                  value={newDocument.issue_date}
                  onChange={(value) => setNewDocument({...newDocument, issue_date: value})}
                  placeholder="Pick date or enter text (e.g., N/A)"
                />
              </div>
              <div className="space-y-2">
                <Label>Expiry Date *</Label>
                <DateTextPicker
                  value={newDocument.expiry_date}
                  onChange={(value) => setNewDocument({...newDocument, expiry_date: value})}
                  placeholder="Pick date or enter text (e.g., NOT REQUIRED)"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="country">Country</Label>
                <Select
                  value={newDocument.country}
                  onValueChange={(val) => setNewDocument({ ...newDocument, country: val })}
                >
                  <SelectTrigger id="country">
                    <SelectValue placeholder="Select country" />
                  </SelectTrigger>
                  <SelectContent className="z-50">
                    {COUNTRY_NAMES.map((name) => (
                      <SelectItem key={name} value={name}>
                        {name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="nationality_status">Nationality Status</Label>
                <Input
                  id="nationality_status"
                  value={newDocument.nationality_status}
                  onChange={(e) => setNewDocument({...newDocument, nationality_status: e.target.value})}
                  placeholder="e.g., British Citizen"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="notes">Notes</Label>
              <Input
                id="notes"
                value={newDocument.notes}
                onChange={(e) => setNewDocument({...newDocument, notes: e.target.value})}
                placeholder="Additional information..."
              />
            </div>

            {/* Employee Status Options */}
            <div className="space-y-3 p-4 border rounded-lg bg-gradient-subtle border-primary/20">
              <h4 className="text-sm font-semibold text-foreground">Employee Status</h4>
              
              <div className="grid grid-cols-2 gap-4">
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="sponsored"
                    checked={sponsored}
                    onCheckedChange={(checked) => setSponsored(checked === true)}
                  />
                  <Label htmlFor="sponsored" className="text-sm font-medium cursor-pointer">
                    Sponsored Employee
                  </Label>
                </div>
                
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="twenty-hours"
                  checked={twentyHours}
                  onCheckedChange={(checked) => setTwentyHours(checked === true)}
                />
                <Label htmlFor="twenty-hours" className="text-sm font-medium cursor-pointer">
                  20 Hours Restriction
                </Label>
              </div>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={addDocument} className="bg-gradient-primary hover:opacity-90">
              Add Document
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Document View Dialog */}
      <DocumentViewDialog
        document={selectedDocument}
        open={viewDialogOpen}
        onClose={() => setViewDialogOpen(false)}
      />

      {/* Document Edit Dialog */}
      <DocumentEditDialog
        document={selectedDocumentForEdit}
        open={editDialogOpen}
        onClose={() => setEditDialogOpen(false)}
        onSave={handleEditSave}
        employees={employees}
        documentTypes={documentTypes}
        branches={branches}
      />

      {/* Import Dialog */}
      <Dialog open={importDialogOpen} onOpenChange={setImportDialogOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>Import Documents</DialogTitle>
            <DialogDescription>
              Upload a CSV or Excel file to import multiple documents at once.
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
                <strong>Required columns:</strong> Employee Name, Branch<br/>
                <strong>Optional:</strong> Status, Country, Passport, Right to Work, Sponsored, 20 Hours Restriction<br/>
                <strong>Note:</strong> Employee must exist in the system (using Employee Name). Date format: DD/MM/YYYY
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
                  if (file) handleDocumentFileUpload(file);
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
        <DialogContent className="sm:max-w-[900px] max-h-[600px]">
          <DialogHeader>
            <DialogTitle>Import Preview</DialogTitle>
            <DialogDescription>
              Review the document data before importing. Rows with errors will be skipped.
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4">
            {importData.length > 0 && (
              <div className="flex items-center justify-between">
                <div className="text-sm text-muted-foreground">
                  {importData.filter(doc => !doc.error).length} valid / {importData.length} total documents
                </div>
                {importData.some(doc => doc.error) && (
                  <Badge variant="destructive">
                    {importData.filter(doc => doc.error).length} errors found
                  </Badge>
                )}
              </div>
            )}

            <div className="border rounded-lg max-h-[400px] overflow-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Status</TableHead>
                    <TableHead>Employee Name</TableHead>
                    <TableHead>Branch</TableHead>
                    <TableHead>Country</TableHead>
                    <TableHead>Passport</TableHead>
                    <TableHead>Right to Work</TableHead>
                    <TableHead>Sponsored</TableHead>
                    <TableHead>20 Hours</TableHead>
                    <TableHead>Error Details</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {importData.map((document, index) => (
                    <TableRow key={index} className={document.error ? 'bg-destructive/10' : 'bg-success/10'}>
                      <TableCell>
                        {document.error ? (
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
                        {document.employee_name || (
                          <span className="text-muted-foreground">-</span>
                        )}
                      </TableCell>
                      <TableCell>
                        {document.branch || (
                          <span className="text-muted-foreground">-</span>
                        )}
                      </TableCell>
                      <TableCell>
                        {document.country || (
                          <span className="text-muted-foreground">-</span>
                        )}
                      </TableCell>
                      <TableCell>
                        {document.passport_expiry || (
                          <span className="text-muted-foreground">-</span>
                        )}
                      </TableCell>
                      <TableCell>
                        {document.right_to_work_expiry || (
                          <span className="text-muted-foreground">-</span>
                        )}
                      </TableCell>
                      <TableCell>
                        {document.sponsored || (
                          <span className="text-muted-foreground">-</span>
                        )}
                      </TableCell>
                       <TableCell>
                         {document.twenty_hours_restriction || (
                           <span className="text-muted-foreground">-</span>
                         )}
                       </TableCell>
                       <TableCell>
                         {document.error ? (
                           <span className="text-xs text-destructive">{document.error}</span>
                         ) : (
                           <span className="text-xs text-green-600">✓ Valid</span>
                         )}
                       </TableCell>
                     </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>

            {importData.some(doc => doc.error) && (
              <div className="bg-destructive/10 p-3 rounded-lg">
                <h4 className="font-medium text-destructive mb-2">Errors found:</h4>
                <ul className="text-sm text-destructive space-y-1">
                  {importData.filter(doc => doc.error).map((document, index) => (
                    <li key={index}>
                      Row {index + 1}: {document.error}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setPreviewDialogOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleImportDocuments}
              disabled={importing || importData.filter(doc => !doc.error).length === 0}
              className="bg-gradient-primary hover:opacity-90"
            >
              {importing ? "Importing..." : `Import ${importData.filter(doc => !doc.error).length} Documents`}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Batch Delete Dialog */}
      <AlertDialog open={batchDeleteDialogOpen} onOpenChange={setBatchDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Selected Documents</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete {selectedDocuments.length} selected document{selectedDocuments.length !== 1 ? 's' : ''}? 
              This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={batchDeleteDocuments}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete Documents
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
