import { useState, useEffect, useMemo } from "react";
import { Calendar, Download, AlertTriangle, Plus, Eye, Edit, Trash2, Filter, Users, Search, ArrowUpDown, ArrowUp, ArrowDown, CheckCircle, Clock, Shield } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useCompany } from "@/contexts/CompanyContext";
import ClientSpotCheckFormDialog, { ClientSpotCheckFormData } from "./ClientSpotCheckFormDialog";
import { ClientSpotCheckViewDialog } from "./ClientSpotCheckViewDialog";
import { ClientDeleteConfirmDialog } from "./ClientDeleteConfirmDialog";
import { generateClientSpotCheckPdf } from "@/lib/client-spot-check-pdf";

import { AddClientComplianceRecordModal } from "./AddClientComplianceRecordModal";

interface ClientCompliancePeriodViewProps {
  complianceTypeId: string;
  complianceTypeName: string;
  frequency: string;
  selectedFilter?: string | null;
}

interface PeriodData {
  period_identifier: string;
  year: number;
  record_count: number;
  completion_rate: number;
  download_available: boolean;
  archive_due_date?: string;
  download_available_date?: string;
  is_current: boolean;
}

interface Client {
  id: string;
  name: string;
  branch_id: string;
  branches?: {
    name: string;
  };
}

interface ClientSpotCheckRecord {
  id?: string;
  service_user_name?: string;
  care_workers?: string;
  date?: string;
  time?: string;
  performed_by?: string;
  observations?: any[];
}

interface ClientComplianceRecord {
  id: string;
  client_id: string;
  period_identifier: string;
  status: string;
  completion_date?: string;
  completion_method?: string;
  notes?: string;
  clients?: Client;
  client_spot_check_records?: ClientSpotCheckRecord[];
}

export function ClientCompliancePeriodView({ 
  complianceTypeId, 
  complianceTypeName, 
  frequency,
  selectedFilter
}: ClientCompliancePeriodViewProps) {
  const [periods, setPeriods] = useState<PeriodData[]>([]);
  const [selectedYear, setSelectedYear] = useState<number>(new Date().getFullYear());
  const [selectedPeriod, setSelectedPeriod] = useState<string>("");
  const [clients, setClients] = useState<Client[]>([]);
  const [records, setRecords] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [spotCheckDialogOpen, setSpotCheckDialogOpen] = useState(false);
  const [selectedClient, setSelectedClient] = useState<Client | null>(null);
  const [selectedBranch, setSelectedBranch] = useState<string>("all");
  const [activeTab, setActiveTab] = useState<"status" | "periods">("status");
  const [searchTerm, setSearchTerm] = useState("");
  const [sortField, setSortField] = useState<'name' | 'branch' | 'status' | 'completion_date'>('name');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');
  const [viewDialogOpen, setViewDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [selectedSpotCheckRecord, setSelectedSpotCheckRecord] = useState<any>(null);
  const [editingSpotCheckData, setEditingSpotCheckData] = useState<any>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const { toast } = useToast();
  const { companySettings } = useCompany();

  useEffect(() => {
    fetchData();
  }, [complianceTypeId, frequency, selectedYear]);

  const fetchData = async () => {
    try {
      setLoading(true);
      
      // Fetch clients instead of employees
      const { data: clientsData, error: clientsError } = await supabase
        .from('clients')
        .select(`
          *,
          branches (
            name
          )
        `)
        .order('name');

      if (clientsError) throw clientsError;

      // Fetch client compliance records
      const { data: recordsData, error: recordsError } = await supabase
        .from('client_compliance_period_records')
        .select('*')
        .eq('client_compliance_type_id', complianceTypeId)
        .order('completion_date', { ascending: false });

      if (recordsError) throw recordsError;

      setClients(clientsData || []);
      setRecords(recordsData || []);
      
      generatePeriods(clientsData || [], recordsData || []);
    } catch (error) {
      console.error('Error fetching data:', error);
      toast({
        title: "Error loading data",
        description: "Could not fetch client compliance data.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const getCurrentPeriod = () => {
    const now = new Date();
    switch (frequency.toLowerCase()) {
      case 'quarterly':
        return `${now.getFullYear()}-Q${Math.ceil((now.getMonth() + 1) / 3)}`;
      case 'annual':
        return now.getFullYear().toString();
      case 'monthly':
        return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
      default:
        return now.getFullYear().toString();
    }
  };

  const calculatePeriodStats = (periodId: string, clientsData: Client[], recordsData: any[]) => {
    const totalClients = clientsData.length;
    const periodRecords = recordsData.filter(record => record.period_identifier === periodId);
    const completedRecords = periodRecords.filter(record => 
      record.status === 'completed' || record.completion_date
    );
    
    return {
      record_count: periodRecords.length,
      completion_rate: totalClients > 0 ? (completedRecords.length / totalClients) * 100 : 0
    };
  };

  const generatePeriods = (clientsData: Client[], recordsData: any[]) => {
    const currentYear = new Date().getFullYear();
    const periods: PeriodData[] = [];
    
    const startYear = Math.max(2025, currentYear - 5);
    const endYear = currentYear;
    
    for (let year = endYear; year >= startYear; year--) {
      const isCurrentYear = year === currentYear;
      const yearsOld = currentYear - year;
      const shouldShowDownload = yearsOld >= 1; // Changed from >= 5 to >= 1 for easier testing
      const archiveDueYear = year + 6;
      
      switch (frequency.toLowerCase()) {
        case 'quarterly':
          if (year === selectedYear) {
            const currentQuarter = year === currentYear ? Math.ceil((new Date().getMonth() + 1) / 3) : 4;
            for (let quarter = currentQuarter; quarter >= 1; quarter--) {
              const periodId = `${year}-Q${quarter}`;
              const isCurrentQuarter = year === currentYear && quarter === Math.ceil((new Date().getMonth() + 1) / 3);
              const quarterStats = calculatePeriodStats(periodId, clientsData, recordsData);
              periods.push({
                period_identifier: periodId,
                year,
                record_count: quarterStats.record_count,
                completion_rate: quarterStats.completion_rate,
                download_available: shouldShowDownload,
                archive_due_date: shouldShowDownload ? `${archiveDueYear}-01-01` : undefined,
                download_available_date: shouldShowDownload ? `${archiveDueYear - 1}-10-01` : undefined,
                is_current: isCurrentQuarter
              });
            }
          }
          break;
        
        case 'annual':
          const annualStats = calculatePeriodStats(year.toString(), clientsData, recordsData);
          periods.push({
            period_identifier: year.toString(),
            year,
            record_count: annualStats.record_count,
            completion_rate: annualStats.completion_rate,
            download_available: shouldShowDownload,
            archive_due_date: shouldShowDownload ? `${archiveDueYear}-01-01` : undefined,
            download_available_date: shouldShowDownload ? `${archiveDueYear - 1}-10-01` : undefined,
            is_current: isCurrentYear
          });
          break;
      }
    }
    
    setPeriods(periods);
    if (periods.length > 0 && !selectedPeriod) {
      const currentPeriod = periods.find(p => p.is_current) || periods[0];
      setSelectedPeriod(currentPeriod.period_identifier);
    }
  };

  const handleSpotCheckSubmit = async (data: ClientSpotCheckFormData) => {
    if (!selectedClient || !selectedPeriod) return;
    if (!complianceTypeId) {
      toast({
        title: "Setup required",
        description: "Client compliance type is not linked. Please configure it in Settings.",
        variant: "destructive",
      });
      return;
    }

    console.log('Saving spot check with complianceTypeId:', complianceTypeId);

    try {
      // Create or update the compliance period record without a pre-fetch to avoid 406/409
      const { data: updated, error: updateError } = await supabase
        .from('client_compliance_period_records')
        .update({
          status: 'completed',
          completion_date: data.date,
          completion_method: 'spotcheck'
        })
        .eq('client_compliance_type_id', complianceTypeId)
        .eq('client_id', selectedClient.id)
        .eq('period_identifier', selectedPeriod)
        .select('id');

      if (updateError) throw updateError;

      let complianceRecordId: string;

      if (updated && updated.length > 0) {
        complianceRecordId = updated[0].id;
      } else {
        const { data: inserted, error: insertError } = await supabase
          .from('client_compliance_period_records')
          .insert({
            client_compliance_type_id: complianceTypeId,
            client_id: selectedClient.id,
            period_identifier: selectedPeriod,
            status: 'completed',
            completion_date: data.date,
            completion_method: 'spotcheck'
          })
          .select('id')
          .maybeSingle();

        if (insertError) throw insertError;
        if (!inserted) throw new Error('Failed to create compliance record');
        complianceRecordId = inserted.id;
      }

      // Save the spot check record
      const { error: spotCheckError } = await supabase
        .from('client_spot_check_records')
        .insert({
          client_id: selectedClient.id,
          compliance_record_id: complianceRecordId,
          service_user_name: data.serviceUserName,
          care_workers: '', // Remove from form but keep for database compatibility
          date: data.date,
          time: '', // Remove from form but keep for database compatibility  
          performed_by: data.completedBy, // Use completedBy value for performed_by field
          observations: data.observations as any
        });

      if (spotCheckError) throw spotCheckError;

      toast({
        title: "Spot check completed",
        description: `Spot check for ${selectedClient.name} has been saved successfully.`,
      });

      setSpotCheckDialogOpen(false);
      setSelectedClient(null);
      setEditingSpotCheckData(null);
      fetchData();
    } catch (error) {
      console.error('Error saving spot check:', error);
      toast({
        title: "Error saving spot check",
        description: "Could not save the spot check. Please try again.",
        variant: "destructive",
      });
    }
  };

  const handleEditSpotCheck = async (client: Client) => {
    try {
      // First, fetch the compliance record for this client and period
      const { data: complianceRecord, error: complianceError } = await supabase
        .from('client_compliance_period_records')
        .select('*')
        .eq('client_compliance_type_id', complianceTypeId)
        .eq('client_id', client.id)
        .eq('period_identifier', selectedPeriod)
        .maybeSingle();

      if (complianceError) throw complianceError;

      if (!complianceRecord) {
        setEditingSpotCheckData(null);
        setSelectedClient(client);
        setSpotCheckDialogOpen(true);
        return;
      }

      // Now fetch the existing spot check record for this compliance record
      const { data: spotCheckRecord, error } = await supabase
        .from('client_spot_check_records')
        .select('*')
        .eq('compliance_record_id', complianceRecord.id)
        .maybeSingle();

      if (error) throw error;

      if (spotCheckRecord) {
        // Transform the database record to match the form data structure
        const formData = {
          serviceUserName: spotCheckRecord.service_user_name || '',
          date: spotCheckRecord.date || '',
          completedBy: spotCheckRecord.performed_by || '',
          observations: spotCheckRecord.observations || []
        };
        setEditingSpotCheckData(formData);
      } else {
        setEditingSpotCheckData(null);
      }

      setSelectedClient(client);
      setSpotCheckDialogOpen(true);
    } catch (error) {
      console.error('Error fetching spot check data:', error);
      toast({
        title: "Error loading data",
        description: "Could not load existing spot check data.",
        variant: "destructive",
      });
    }
  };

  const handleDownloadPeriod = async (period: PeriodData) => {
    try {
      // Fetch all client compliance records for this period
      const { data: periodRecords, error: recordsError } = await supabase
        .from('client_compliance_period_records')
        .select(`
          *,
          clients (
            name,
            branches (
              name
            )
          ),
          client_spot_check_records (
            *
          )
        `)
        .eq('client_compliance_type_id', complianceTypeId)
        .eq('period_identifier', period.period_identifier)
        .eq('status', 'completed');

      if (recordsError) throw recordsError;

      if (!periodRecords || periodRecords.length === 0) {
        toast({
          title: "No data to download",
          description: "No completed compliance records found for this period.",
          variant: "destructive",
        });
        return;
      }

      let downloadCount = 0;

      // Generate PDF for each completed record
      for (const record of periodRecords) {
        if (record.client_spot_check_records && record.client_spot_check_records.length > 0) {
          const spotCheckRecord = record.client_spot_check_records[0];
          
          // Transform the data to match the client PDF format
          const pdfData = {
            serviceUserName: (spotCheckRecord as any)?.service_user_name || record.clients?.name || 'Unknown',
            date: (spotCheckRecord as any)?.date || record.completion_date || '',
            completedBy: (spotCheckRecord as any)?.performed_by || 'Not specified',
            observations: Array.isArray((spotCheckRecord as any)?.observations) ? (spotCheckRecord as any).observations : []
          };

          // Generate PDF using client-specific generator
          await generateClientSpotCheckPdf(pdfData, {
            name: companySettings?.name,
            logo: companySettings?.logo
          });
          
          downloadCount++;
        }
      }

      if (downloadCount === 0) {
        toast({
          title: "No spot check data found",
          description: "No spot check records found for completed compliance records.",
          variant: "destructive",
        });
        return;
      }

      toast({
        title: "Download completed",
        description: `Downloaded ${downloadCount} compliance records for ${getPeriodLabel(period.period_identifier)}.`,
      });

    } catch (error) {
      console.error('Error downloading period data:', error);
      toast({
        title: "Download failed",
        description: "Could not download the compliance records. Please try again.",
        variant: "destructive",
      });
    }
  };

  const getPeriodLabel = (periodId: string) => {
    switch (frequency.toLowerCase()) {
      case 'quarterly':
        return periodId.replace('-', ' ');
      case 'annual':
        return `Year ${periodId}`;
      default:
        return periodId;
    }
  };

  const getAvailableYears = () => {
    const currentYear = new Date().getFullYear();
    const startYear = Math.max(2025, currentYear - 5);
    const years = [];
    for (let year = currentYear; year >= startYear; year--) {
      years.push(year);
    }
    return years;
  };

  const getCompletionBadge = (rate: number) => {
    if (rate >= 90) return "bg-success/10 text-success border-success/20";
    if (rate >= 70) return "bg-warning/10 text-warning border-warning/20";
    return "bg-destructive/10 text-destructive border-destructive/20";
  };

  const getClientRecordForPeriod = (clientId: string, periodId: string) => {
    return records.find(r => 
      r.client_id === clientId && 
      r.period_identifier === periodId
    );
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'completed':
        return "bg-success/10 text-success border-success/20";
      case 'overdue':
        return "bg-destructive/10 text-destructive border-destructive/20";
      case 'pending':
      default:
        return "bg-warning/10 text-warning border-warning/20";
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case 'completed':
        return 'Compliant';
      case 'overdue':
        return 'Overdue';
      case 'pending':
      default:
        return 'Due';
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed':
        return 'bg-success/5 border-success/20';
      case 'overdue':
        return 'bg-destructive/5 border-destructive/20';
      case 'pending':
      default:
        return 'bg-warning/5 border-warning/20';
    }
  };

  // Filtered and sorted clients
  const filteredAndSortedClients = useMemo(() => {
    let filtered = clients;

    // Apply search filter
    if (searchTerm.trim()) {
      filtered = filtered.filter(client =>
        client.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        client.branches?.name?.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    // Filter by branch
    if (selectedBranch !== "all") {
      filtered = filtered.filter(client => client.branch_id === selectedBranch);
    }

    // Filter by status if selectedFilter is provided
    if (selectedFilter) {
      filtered = filtered.filter(client => {
        const record = getClientRecordForPeriod(client.id, selectedPeriod);
        const status = record?.status || 'pending';
        
        switch (selectedFilter) {
          case 'completed':
            return status === 'completed';
          case 'due':
            return status === 'pending';
          case 'overdue':
            return status === 'overdue';
          case 'pending':
            return status === 'pending';
          default:
            return true;
        }
      });
    }

    // Apply sorting
    return filtered.sort((a, b) => {
      let aValue: any;
      let bValue: any;

      switch (sortField) {
        case 'name':
          aValue = a.name;
          bValue = b.name;
          break;
        case 'branch':
          aValue = a.branches?.name || 'Unassigned';
          bValue = b.branches?.name || 'Unassigned';
          break;
        case 'status':
          const aRecord = getClientRecordForPeriod(a.id, selectedPeriod);
          const bRecord = getClientRecordForPeriod(b.id, selectedPeriod);
          const statusOrder = { 'completed': 3, 'pending': 2, 'overdue': 1 };
          aValue = statusOrder[aRecord?.status || 'pending'] || 0;
          bValue = statusOrder[bRecord?.status || 'pending'] || 0;
          break;
        case 'completion_date':
          const aRecordDate = getClientRecordForPeriod(a.id, selectedPeriod);
          const bRecordDate = getClientRecordForPeriod(b.id, selectedPeriod);
          aValue = aRecordDate?.completion_date ? new Date(aRecordDate.completion_date).getTime() : 0;
          bValue = bRecordDate?.completion_date ? new Date(bRecordDate.completion_date).getTime() : 0;
          break;
        default:
          aValue = a.name;
          bValue = b.name;
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
  }, [clients, searchTerm, selectedBranch, selectedFilter, selectedPeriod, sortField, sortDirection]);

  const getUniqueBranches = () => {
    const branches = clients.map(client => ({
      id: client.branch_id || 'unassigned',
      name: client.branches?.name || 'Unassigned'
    }));
    
    // Remove duplicates
    const uniqueBranches = branches.filter((branch, index, self) => 
      index === self.findIndex(b => b.id === branch.id)
    );
    
    return uniqueBranches;
  };

  const handleSort = (field: 'name' | 'branch' | 'status' | 'completion_date') => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  };

  const getSortIcon = (field: 'name' | 'branch' | 'status' | 'completion_date') => {
    if (sortField !== field) {
      return <ArrowUpDown className="w-4 h-4" />;
    }
    return sortDirection === 'asc' 
      ? <ArrowUp className="w-4 h-4" />
      : <ArrowDown className="w-4 h-4" />;
  };

  if (loading) {
    return (
      <div className="space-y-4 animate-pulse">
        <div className="h-8 bg-muted rounded w-64"></div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <div key={i} className="h-32 bg-muted rounded-xl"></div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Navigation Tabs */}
      <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as "status" | "periods")} className="w-full">
        <TabsList className="grid w-full grid-cols-2 bg-gradient-to-r from-muted/50 to-muted/30 p-1">
          <TabsTrigger 
            value="status" 
            className="flex items-center gap-2 data-[state=active]:bg-gradient-to-r data-[state=active]:from-primary data-[state=active]:to-primary/80 data-[state=active]:text-primary-foreground"
          >
            <Users className="w-4 h-4" />
            Client Compliance Status
          </TabsTrigger>
          <TabsTrigger 
            value="periods"
            className="flex items-center gap-2 data-[state=active]:bg-gradient-to-r data-[state=active]:from-primary data-[state=active]:to-primary/80 data-[state=active]:text-primary-foreground"
          >
            <Calendar className="w-4 h-4" />
            Period Records
          </TabsTrigger>
        </TabsList>

        <TabsContent value="status" className="space-y-6">
          {selectedPeriod && (
            <div className="space-y-6">
              <div className="flex flex-col space-y-4">
                <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
                  <div className="space-y-1">
                    <h3 className="text-2xl font-bold bg-gradient-to-r from-primary via-primary/80 to-primary/60 bg-clip-text text-transparent">
                      Client Compliance Overview
                    </h3>
                    <p className="text-muted-foreground">Current Period: {getPeriodLabel(selectedPeriod)}</p>
                  </div>
                </div>
                
                <Card className="bg-gradient-to-br from-card via-card/50 to-background border-border/50 shadow-lg">
                  <CardHeader className="bg-gradient-to-r from-primary/5 to-primary/10 border-b">
                    <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
                      <div className="flex items-center gap-3">
                        <div className="p-2 rounded-lg bg-gradient-to-br from-primary/20 to-primary/10">
                          <Shield className="w-5 h-5 text-primary" />
                        </div>
                        <CardTitle className="bg-gradient-to-r from-primary to-primary/70 bg-clip-text text-transparent font-bold">
                          Client Compliance Status
                        </CardTitle>
                      </div>
                      
                      <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
                        {/* Search */}
                        <div className="relative">
                          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                          <Input
                            placeholder="Search clients..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="pl-10 w-64 bg-background border-border/50 focus:border-primary/50"
                          />
                        </div>
                        
                        {/* Branch Filter */}
                        <div className="flex items-center gap-2">
                          <Filter className="w-4 h-4 text-muted-foreground" />
                          <Select value={selectedBranch} onValueChange={setSelectedBranch}>
                            <SelectTrigger className="w-40 bg-background border-border/50 focus:border-primary/50">
                              <SelectValue placeholder="All Branches" />
                            </SelectTrigger>
                            <SelectContent className="bg-background border shadow-lg z-50">
                              <SelectItem value="all">All Branches</SelectItem>
                              {getUniqueBranches().map((branch) => (
                                <SelectItem key={branch.id} value={branch.id}>
                                  {branch.name}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                      </div>
                    </div>
                  </CardHeader>
                  
                  <CardContent className="p-0">
                    <Table>
                      <TableHeader>
                        <TableRow className="bg-gradient-to-r from-muted/50 to-muted/30 hover:bg-muted/60">
                          <TableHead 
                            className="font-semibold cursor-pointer hover:bg-muted/20 transition-colors"
                            onClick={() => handleSort('name')}
                          >
                            <div className="flex items-center gap-2">
                              Client Name
                              {getSortIcon('name')}
                            </div>
                          </TableHead>
                          <TableHead 
                            className="font-semibold cursor-pointer hover:bg-muted/20 transition-colors"
                            onClick={() => handleSort('branch')}
                          >
                            <div className="flex items-center gap-2">
                              Branch
                              {getSortIcon('branch')}
                            </div>
                          </TableHead>
                          <TableHead 
                            className="font-semibold cursor-pointer hover:bg-muted/20 transition-colors"
                            onClick={() => handleSort('status')}
                          >
                            <div className="flex items-center gap-2">
                              Status
                              {getSortIcon('status')}
                            </div>
                          </TableHead>
                          <TableHead 
                            className="font-semibold cursor-pointer hover:bg-muted/20 transition-colors"
                            onClick={() => handleSort('completion_date')}
                          >
                            <div className="flex items-center gap-2">
                              Completion Date
                              {getSortIcon('completion_date')}
                            </div>
                          </TableHead>
                          <TableHead className="font-semibold">Notes</TableHead>
                          <TableHead className="font-semibold">Actions</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {filteredAndSortedClients.map((client) => {
                          const record = getClientRecordForPeriod(client.id, selectedPeriod);
                          const status = record?.status || 'pending';
                          const isCompleted = status === 'completed';
                      
                            return (
                              <TableRow key={client.id} className={`group hover:bg-gradient-to-r hover:from-muted/20 hover:to-transparent transition-all duration-200 border-b border-border/50 ${getStatusColor(status)}`}>
                               <TableCell className="font-semibold text-foreground">{client.name}</TableCell>
                               <TableCell className="text-muted-foreground">{client.branches?.name || 'Unassigned'}</TableCell>
                               <TableCell>
                                 <Badge className={`${getStatusBadge(status)} font-medium`}>
                                   {getStatusText(status)}
                                 </Badge>
                               </TableCell>
                               <TableCell className="text-muted-foreground">
                                 {record?.completion_date && record.completion_date !== '' 
                                   ? record.completion_date 
                                   : '-'
                                 }
                               </TableCell>
                               <TableCell className="text-muted-foreground">
                                 <div className="max-w-xs truncate">
                                   {record?.notes || '-'}
                                 </div>
                               </TableCell>
                               <TableCell>
                                 <div className="flex items-center gap-2">
                                    {isCompleted ? (
                                      <>
                                        <Button 
                                          variant="ghost" 
                                          size="sm" 
                                          className="h-8 w-8 p-0"
                                          onClick={async () => {
                                            try {
                                              const record = getClientRecordForPeriod(client.id, selectedPeriod);
                                              if (!record) return;
                                              
                                              // Fetch the client spot check record
                                              const { data: spotCheckData, error } = await supabase
                                                .from('client_spot_check_records')
                                                .select('*')
                                                .eq('compliance_record_id', record.id)
                                                .maybeSingle();
                                              
                                              if (error) throw error;
                                              if (!spotCheckData) {
                                                toast({
                                                  title: "No spot check data",
                                                  description: "No spot check record found for this client.",
                                                  variant: "destructive",
                                                });
                                                return;
                                              }
                                              
                                               // Transform data for PDF generation
                                                const pdfData = {
                                                  serviceUserName: spotCheckData.service_user_name || client.name || 'Unknown',
                                                  date: spotCheckData.date || record.completion_date || '',
                                                  completedBy: spotCheckData.performed_by || 'Not specified',
                                                  observations: Array.isArray(spotCheckData.observations) ? spotCheckData.observations as any[] : []
                                                };
                                               
                                               // Generate PDF using client-specific generator
                                               await generateClientSpotCheckPdf(pdfData, {
                                                 name: companySettings?.name,
                                                 logo: companySettings?.logo
                                               });
                                              
                                              toast({
                                                title: "PDF Downloaded",
                                                description: `Spot check record for ${client.name} has been downloaded.`,
                                              });
                                              
                                            } catch (error) {
                                              console.error('Error downloading client PDF:', error);
                                              toast({
                                                title: "Download failed",
                                                description: "Could not download the PDF. Please try again.",
                                                variant: "destructive",
                                              });
                                            }
                                          }}
                                        >
                                          <Download className="w-4 h-4" />
                                        </Button>
                                        <Button 
                                          variant="ghost" 
                                          size="sm" 
                                          className="h-8 w-8 p-0"
                                          onClick={async () => {
                                            try {
                                              const record = getClientRecordForPeriod(client.id, selectedPeriod);
                                              if (!record) return;
                                              
                                              // Fetch the client spot check record
                                              const { data: spotCheckData, error } = await supabase
                                                .from('client_spot_check_records')
                                                .select('*')
                                                .eq('compliance_record_id', record.id)
                                                .maybeSingle();
                                              
                                              if (error) throw error;
                                              if (!spotCheckData) {
                                                toast({
                                                  title: "No spot check data",
                                                  description: "No spot check record found for this client.",
                                                  variant: "destructive",
                                                });
                                                return;
                                              }
                                              
                                              setSelectedClient(client);
                                              setSelectedSpotCheckRecord(spotCheckData);
                                              setViewDialogOpen(true);
                                              
                                            } catch (error) {
                                              console.error('Error viewing client record:', error);
                                              toast({
                                                title: "View failed",
                                                description: "Could not load the client record. Please try again.",
                                                variant: "destructive",
                                              });
                                            }
                                          }}
                                        >
                                          <Eye className="w-4 h-4" />
                                        </Button>
                                        <Button 
                                          variant="ghost" 
                                          size="sm" 
                                          className="h-8 w-8 p-0"
                                          onClick={() => {
                                            handleEditSpotCheck(client);
                                          }}
                                        >
                                          <Edit className="w-4 h-4" />
                                        </Button>
                                        <Button 
                                          variant="ghost" 
                                          size="sm" 
                                          className="h-8 w-8 p-0 text-destructive hover:bg-destructive/10"
                                          onClick={() => {
                                            setSelectedClient(client);
                                            setDeleteDialogOpen(true);
                                          }}
                                        >
                                          <Trash2 className="w-4 h-4" />
                                        </Button>
                                     </>
                                    ) : (
                                      <AddClientComplianceRecordModal
                                        clientId={client.id}
                                        clientName={client.name}
                                        complianceTypeId={complianceTypeId}
                                        complianceTypeName={complianceTypeName || ''}
                                        frequency={frequency}
                                        periodIdentifier={selectedPeriod}
                                        onRecordAdded={fetchData}
                                        trigger={
                                          <Button variant="outline" size="sm">
                                            Add Record
                                          </Button>
                                        }
                                      />
                                    )}
                                 </div>
                               </TableCell>
                             </TableRow>
                           );
                         })}
                       
                         {filteredAndSortedClients.length === 0 && (
                           <TableRow>
                             <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                               No clients found
                             </TableCell>
                           </TableRow>
                         )}
                       </TableBody>
                     </Table>
                   </CardContent>
                 </Card>
               </div>
             </div>
           )}
         </TabsContent>

         <TabsContent value="periods" className="space-y-6">
        <div className="space-y-6">
          {/* Period Controls */}
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <h3 className="text-xl font-semibold">Client Compliance Records</h3>
            
            {frequency.toLowerCase() !== 'annual' && (
              <Select value={selectedYear.toString()} onValueChange={(value) => setSelectedYear(parseInt(value))}>
                <SelectTrigger className="w-40 bg-background border border-input">
                  <SelectValue placeholder="Select Year" />
                </SelectTrigger>
                <SelectContent className="bg-background border shadow-lg z-50">
                  {getAvailableYears().map((year) => (
                    <SelectItem key={year} value={year.toString()}>
                      {year}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>

          {/* Periods Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {periods.map((period, index) => (
              <Card 
                key={period.period_identifier} 
                className={`card-premium transition-all duration-300 cursor-pointer hover:shadow-lg ${
                  period.is_current ? 'ring-2 ring-primary border-primary bg-primary/5' : ''
                } ${selectedPeriod === period.period_identifier ? 'ring-2 ring-secondary border-secondary' : ''}`}
                style={{ animationDelay: `${index * 50}ms` }}
                onClick={() => {
                  setSelectedPeriod(period.period_identifier);
                  setActiveTab("status");
                }}
              >
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-lg flex items-center gap-2">
                      <Calendar className="w-5 h-5" />
                      {getPeriodLabel(period.period_identifier)}
                    </CardTitle>
                    {period.is_current && (
                      <Badge className="bg-primary/10 text-primary border-primary/20">
                        Current
                      </Badge>
                    )}
                  </div>
                </CardHeader>
                
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <p className="text-muted-foreground">Records</p>
                      <p className="font-semibold text-lg">{period.record_count}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Completion</p>
                      <Badge className={getCompletionBadge(period.completion_rate)}>
                        {period.completion_rate.toFixed(1)}%
                      </Badge>
                    </div>
                  </div>

                  {/* Archive Warning */}
                  {period.archive_due_date && (
                    <div className="flex items-center gap-2 p-2 bg-warning/10 rounded-lg">
                      <AlertTriangle className="w-4 h-4 text-warning" />
                      <span className="text-sm text-warning">
                        Archive due: {new Date(period.archive_due_date).toLocaleDateString()}
                      </span>
                    </div>
                  )}

                  {/* Download Button */}
                  {period.download_available && (
                    <Button 
                      variant="outline" 
                      size="sm" 
                      className="w-full"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDownloadPeriod(period);
                      }}
                    >
                      <Download className="w-4 h-4 mr-2" />
                      Download Archive
                    </Button>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>

          {/* Legend */}
          <Card className="card-premium">
            <CardContent className="p-4">
              <div className="flex flex-wrap gap-4 text-sm">
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 bg-primary rounded-full"></div>
                  <span>Current Period</span>
                </div>
                <div className="flex items-center gap-2">
                  <Download className="w-4 h-4 text-muted-foreground" />
                  <span>Download Available (3 months before deletion)</span>
                </div>
                <div className="flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 text-warning" />
                  <span>Archive Due</span>
                </div>
              </div>
            </CardContent>
          </Card>
          </div>
        </TabsContent>
      </Tabs>

      {/* Spot Check Dialog */}
      <ClientSpotCheckFormDialog
        open={spotCheckDialogOpen}
        onOpenChange={(open) => {
          setSpotCheckDialogOpen(open);
          if (!open) {
            setEditingSpotCheckData(null);
            setSelectedClient(null);
          }
        }}
        onSubmit={handleSpotCheckSubmit}
        initialData={editingSpotCheckData}
        periodIdentifier={selectedPeriod}
        frequency={frequency}
      />

      {/* View Spot Check Dialog */}
      <ClientSpotCheckViewDialog
        open={viewDialogOpen}
        onOpenChange={setViewDialogOpen}
        client={selectedClient}
        spotCheckRecord={selectedSpotCheckRecord}
      />

      {/* Delete Confirmation Dialog */}
      <ClientDeleteConfirmDialog
        open={deleteDialogOpen}
        onOpenChange={setDeleteDialogOpen}
        client={selectedClient}
        isDeleting={isDeleting}
        onConfirm={async () => {
          if (!selectedClient) return;
          
          try {
            setIsDeleting(true);
            const record = getClientRecordForPeriod(selectedClient.id, selectedPeriod);
            if (!record) return;
            
            // Delete the spot check record first
            const { error: spotCheckError } = await supabase
              .from('client_spot_check_records')
              .delete()
              .eq('compliance_record_id', record.id);
            
            if (spotCheckError) throw spotCheckError;
            
            // Delete the compliance record
            const { error: complianceError } = await supabase
              .from('client_compliance_period_records')
              .delete()
              .eq('id', record.id);
            
            if (complianceError) throw complianceError;
            
            toast({
              title: "Record deleted",
              description: `Spot check record for ${selectedClient.name} has been deleted.`,
            });
            
            setDeleteDialogOpen(false);
            setSelectedClient(null);
            // Refresh the data
            fetchData();
            
          } catch (error) {
            console.error('Error deleting client record:', error);
            toast({
              title: "Delete failed",
              description: "Could not delete the record. Please try again.",
              variant: "destructive",
            });
          } finally {
            setIsDeleting(false);
          }
        }}
      />
    </div>
  );
}