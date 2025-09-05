import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Search, Download, Eye, Edit, Trash2, Plus, Filter } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import ClientSpotCheckFormDialog from "./ClientSpotCheckFormDialog";
import { ClientSpotCheckViewDialog } from "./ClientSpotCheckViewDialog";
import { ClientDeleteConfirmDialog } from "./ClientDeleteConfirmDialog";
import { generateClientSpotCheckPdf } from "@/lib/client-spot-check-pdf";
import { useCompany } from "@/contexts/CompanyContext";

interface ClientCompliancePeriodDetailsViewProps {
  complianceTypeId: string;
  complianceTypeName: string;
  periodIdentifier: string;
  frequency: string;
  trigger: React.ReactNode;
}

interface Client {
  id: string;
  name: string;
  branch_id: string;
  branches?: {
    name: string;
  };
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
  client_spot_check_records?: any[];
}

export function ClientCompliancePeriodDetailsView({
  complianceTypeId,
  complianceTypeName,
  periodIdentifier,
  frequency,
  trigger
}: ClientCompliancePeriodDetailsViewProps) {
  const [open, setOpen] = useState(false);
  const [clients, setClients] = useState<Client[]>([]);
  const [records, setRecords] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedBranch, setSelectedBranch] = useState<string>("all");
  const [branches, setBranches] = useState<any[]>([]);
  
  // Dialog states
  const [spotCheckDialogOpen, setSpotCheckDialogOpen] = useState(false);
  const [viewDialogOpen, setViewDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [selectedClient, setSelectedClient] = useState<Client | null>(null);
  const [selectedSpotCheckRecord, setSelectedSpotCheckRecord] = useState<any>(null);
  const [editingSpotCheckData, setEditingSpotCheckData] = useState<any>(null);

  const { toast } = useToast();
  const { companySettings } = useCompany();

  useEffect(() => {
    if (open) {
      fetchData();
    }
  }, [open, complianceTypeId, periodIdentifier]);

  const fetchData = async () => {
    try {
      setLoading(true);
      
      // Fetch clients
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

      // Fetch branches for filter
      const { data: branchesData, error: branchesError } = await supabase
        .from('branches')
        .select('*')
        .order('name');

      if (branchesError) throw branchesError;

      // Fetch compliance records for this specific period
      const { data: recordsData, error: recordsError } = await supabase
        .from('client_compliance_period_records')
        .select(`
          *,
          clients (
            id,
            name,
            branch_id,
            branches (
              name
            )
          ),
          client_spot_check_records (
            *
          )
        `)
        .eq('client_compliance_type_id', complianceTypeId)
        .eq('period_identifier', periodIdentifier);

      if (recordsError) throw recordsError;

      setClients(clientsData || []);
      setBranches(branchesData || []);
      setRecords(recordsData || []);
      
    } catch (error) {
      console.error('Error fetching period details:', error);
      toast({
        title: "Error loading data",
        description: "Could not fetch period details.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const getClientRecordForPeriod = (clientId: string) => {
    return records.find(r => r.client_id === clientId);
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
        return 'Completed';
      case 'overdue':
        return 'Overdue';
      case 'pending':
      default:
        return 'Pending';
    }
  };

  const filteredClients = clients.filter(client => {
    const matchesSearch = client.name.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesBranch = selectedBranch === "all" || client.branch_id === selectedBranch;
    return matchesSearch && matchesBranch;
  });

  const handleAddSpotCheck = (client: Client) => {
    setSelectedClient(client);
    setEditingSpotCheckData(null);
    setSpotCheckDialogOpen(true);
  };

  const handleEditSpotCheck = async (client: Client) => {
    // Implementation similar to the parent component
    setSelectedClient(client);
    setSpotCheckDialogOpen(true);
  };

  const handleViewSpotCheck = async (client: Client) => {
    // Implementation similar to the parent component
    setSelectedClient(client);
    setViewDialogOpen(true);
  };

  const handleDeleteSpotCheck = (client: Client) => {
    setSelectedClient(client);
    setDeleteDialogOpen(true);
  };

  const handleDownloadPdf = async (client: Client) => {
    // Implementation similar to the parent component for individual client
    try {
      const record = getClientRecordForPeriod(client.id);
      if (!record || !record.client_spot_check_records?.length) {
        toast({
          title: "No data to download",
          description: "No spot check record found for this client.",
          variant: "destructive",
        });
        return;
      }

      const spotCheckRecord = record.client_spot_check_records[0];
      const pdfData = {
        serviceUserName: spotCheckRecord.service_user_name || client.name,
        date: spotCheckRecord.date || record.completion_date || '',
        completedBy: spotCheckRecord.performed_by || 'Not specified',
        observations: Array.isArray(spotCheckRecord.observations) ? spotCheckRecord.observations : []
      };

      await generateClientSpotCheckPdf(pdfData, {
        name: companySettings?.name,
        logo: companySettings?.logo
      });

      toast({
        title: "Download completed",
        description: `Downloaded spot check for ${client.name}.`,
      });
    } catch (error) {
      console.error('Error downloading PDF:', error);
      toast({
        title: "Download failed",
        description: "Could not download the PDF. Please try again.",
        variant: "destructive",
      });
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger}
      </DialogTrigger>
      <DialogContent className="max-w-6xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle>
            {complianceTypeName} - {periodIdentifier}
          </DialogTitle>
        </DialogHeader>
        
        <div className="flex-1 overflow-y-auto space-y-4">
          {/* Filters */}
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4" />
              <Input
                placeholder="Search clients..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
            <Select value={selectedBranch} onValueChange={setSelectedBranch}>
              <SelectTrigger className="w-full sm:w-48">
                <SelectValue placeholder="Filter by branch" />
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
          </div>

          {/* Clients Table */}
          <div className="border rounded-lg">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Client Name</TableHead>
                  <TableHead>Branch</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Completion Date</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center py-8">
                      Loading clients...
                    </TableCell>
                  </TableRow>
                ) : filteredClients.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                      No clients found
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredClients.map((client) => {
                    const record = getClientRecordForPeriod(client.id);
                    const status = record?.status || 'pending';
                    const hasSpotCheck = record?.client_spot_check_records?.length > 0;
                    
                    return (
                      <TableRow key={client.id}>
                        <TableCell className="font-medium">{client.name}</TableCell>
                        <TableCell>{client.branches?.name || 'Unknown'}</TableCell>
                        <TableCell>
                          <Badge className={getStatusBadge(status)}>
                            {getStatusText(status)}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          {record?.completion_date || '-'}
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            {hasSpotCheck ? (
                              <>
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => handleDownloadPdf(client)}
                                >
                                  <Download className="w-4 h-4" />
                                </Button>
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => handleViewSpotCheck(client)}
                                >
                                  <Eye className="w-4 h-4" />
                                </Button>
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => handleEditSpotCheck(client)}
                                >
                                  <Edit className="w-4 h-4" />
                                </Button>
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => handleDeleteSpotCheck(client)}
                                >
                                  <Trash2 className="w-4 h-4" />
                                </Button>
                              </>
                            ) : (
                              <Button
                                variant="default"
                                size="sm"
                                onClick={() => handleAddSpotCheck(client)}
                              >
                                <Plus className="w-4 h-4 mr-2" />
                                Add Record
                              </Button>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </div>
        </div>

        {/* Dialogs */}
        <ClientSpotCheckFormDialog
          open={spotCheckDialogOpen}
          onOpenChange={setSpotCheckDialogOpen}
          onSubmit={() => {
            setSpotCheckDialogOpen(false);
            fetchData();
          }}
          initialData={editingSpotCheckData}
          periodIdentifier={periodIdentifier}
          frequency={frequency}
        />

        <ClientSpotCheckViewDialog
          open={viewDialogOpen}
          onOpenChange={setViewDialogOpen}
          client={selectedClient}
          spotCheckRecord={selectedSpotCheckRecord}
        />

        <ClientDeleteConfirmDialog
          open={deleteDialogOpen}
          onOpenChange={setDeleteDialogOpen}
          client={selectedClient}
          onConfirm={() => {
            setDeleteDialogOpen(false);
            fetchData();
          }}
        />
      </DialogContent>
    </Dialog>
  );
}