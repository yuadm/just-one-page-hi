import { useState, useEffect, ReactNode } from "react";
import { CalendarIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { format, isValid } from "date-fns";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { usePermissions } from "@/contexts/PermissionsContext";
import { useCompany } from "@/contexts/CompanyContext";
import ClientSpotCheckFormDialog, { ClientSpotCheckFormData } from "@/components/clients/ClientSpotCheckFormDialog";
import { generateClientSpotCheckPdf } from "@/lib/client-spot-check-pdf";

interface AddClientComplianceRecordModalProps {
  clientId?: string;
  clientName?: string;
  complianceTypeId: string;
  complianceTypeName: string;
  frequency: string;
  periodIdentifier?: string;
  onRecordAdded: () => void;
  trigger?: ReactNode;
}

export function AddClientComplianceRecordModal({
  clientId,
  clientName,
  complianceTypeId,
  complianceTypeName,
  frequency,
  periodIdentifier,
  onRecordAdded,
  trigger
}: AddClientComplianceRecordModalProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [completionDate, setCompletionDate] = useState<Date>(new Date());
  const [notes, setNotes] = useState('');
  const [recordType, setRecordType] = useState<'date' | 'new' | 'spotcheck'>('date');
  const [newText, setNewText] = useState('');
  const [spotcheckOpen, setSpotcheckOpen] = useState(false);
  const [spotcheckData, setSpotcheckData] = useState<ClientSpotCheckFormData | null>(null);
  const [selectedClientId, setSelectedClientId] = useState(clientId || '');
  const [selectedClientName, setSelectedClientName] = useState(clientName || '');
  const [selectedPeriod, setSelectedPeriod] = useState(periodIdentifier || getCurrentPeriodIdentifier(frequency));
  const [clients, setClients] = useState<Array<{id: string, name: string, branch: string}>>([]);
  const [branches, setBranches] = useState<Array<{id: string, name: string}>>([]);
  const { toast } = useToast();
  const { getAccessibleBranches, isAdmin } = usePermissions();
  const { companySettings } = useCompany();

  // Fetch clients if not provided
  useEffect(() => {
    if (!clientId) {
      fetchClients();
    }
  }, [clientId]);

  const fetchClients = async () => {
    try {
      // Fetch clients
      const { data: clientsData, error: clientsError } = await supabase
        .from('clients')
        .select('id, name, branches(name)')
        .order('name');
      
      if (clientsError) throw clientsError;

      // Fetch branches
      const { data: branchesData, error: branchesError } = await supabase
        .from('branches')
        .select('id, name')
        .order('name');
      
      if (branchesError) throw branchesError;

      // Filter clients based on branch access for non-admin users
      const accessibleBranches = getAccessibleBranches();
      let filteredClients = clientsData || [];
      
      if (!isAdmin && accessibleBranches.length > 0) {
        filteredClients = clientsData?.filter(client => {
          const clientBranchId = branchesData?.find(b => b.name === client.branches?.name)?.id;
          return accessibleBranches.includes(clientBranchId || '');
        }) || [];
      }

      // Transform data for easier display
      const transformedClients = filteredClients.map(client => ({
        id: client.id,
        name: client.name,
        branch: client.branches?.name || 'No Branch'
      }));

      setClients(transformedClients);
      setBranches(branchesData || []);
    } catch (error) {
      console.error('Error fetching clients:', error);
    }
  };

  function getCurrentPeriodIdentifier(freq: string): string {
    const now = new Date();
    const year = now.getFullYear();
    const month = now.getMonth() + 1;
    const quarter = Math.ceil(month / 3);

    switch (freq?.toLowerCase()) {
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
  }

  // Calculate valid date range based on period and frequency
  const getValidDateRange = () => {
    const now = new Date();
    const period = selectedPeriod;
    
    // Add null check for frequency and period
    if (!frequency || !period) {
      console.warn('Frequency or period is undefined, using default year range');
      const currentYear = now.getFullYear();
      return {
        minDate: new Date(currentYear, 0, 1),
        maxDate: now
      };
    }
    
    let minDate: Date;
    let maxDate: Date;
    
    try {
      if (frequency.toLowerCase() === 'annual') {
        // For annual: entire year is selectable
        const year = parseInt(period);
        if (isNaN(year)) throw new Error('Invalid year');
        minDate = new Date(year, 0, 1); // January 1st
        maxDate = new Date(year, 11, 31); // December 31st
      } else if (frequency.toLowerCase() === 'monthly') {
        // For monthly: only that specific month
        const [year, month] = period.split('-');
        const yearNum = parseInt(year);
        const monthNum = parseInt(month);
        if (isNaN(yearNum) || isNaN(monthNum)) throw new Error('Invalid date components');
        const monthIndex = monthNum - 1; // Month is 0-indexed
        minDate = new Date(yearNum, monthIndex, 1);
        maxDate = new Date(yearNum, monthIndex + 1, 0); // Last day of month
      } else if (frequency.toLowerCase() === 'quarterly') {
        // For quarterly: only that specific quarter
        const [year, quarterStr] = period.split('-Q');
        const yearNum = parseInt(year);
        const quarter = parseInt(quarterStr);
        if (isNaN(yearNum) || isNaN(quarter)) throw new Error('Invalid date components');
        const startMonth = (quarter - 1) * 3;
        const endMonth = startMonth + 2;
        minDate = new Date(yearNum, startMonth, 1);
        maxDate = new Date(yearNum, endMonth + 1, 0); // Last day of quarter
      } else if (frequency.toLowerCase() === 'bi-annual') {
        // For bi-annual: the specific half year
        const [year, halfStr] = period.split('-H');
        const yearNum = parseInt(year);
        const half = parseInt(halfStr);
        if (isNaN(yearNum) || isNaN(half)) throw new Error('Invalid date components');
        const startMonth = half === 1 ? 0 : 6;
        const endMonth = half === 1 ? 5 : 11;
        minDate = new Date(yearNum, startMonth, 1);
        maxDate = new Date(yearNum, endMonth + 1, 0); // Last day of half
      } else {
        // Default fallback
        const year = parseInt(period) || now.getFullYear();
        minDate = new Date(year, 0, 1);
        maxDate = new Date(year, 11, 31);
      }
      
      // Validate the dates
      if (!isValid(minDate) || !isValid(maxDate)) {
        throw new Error('Invalid calculated dates');
      }
      
      return { minDate, maxDate };
    } catch (error) {
      console.error('Error calculating date range:', error);
      // Fallback to current year
      const currentYear = now.getFullYear();
      return {
        minDate: new Date(currentYear, 0, 1),
        maxDate: now
      };
    }
  };

  const { minDate, maxDate } = getValidDateRange();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Validate required fields
    if (!selectedClientId || !selectedPeriod) {
      toast({
        title: "Missing information",
        description: "Please select a client and period.",
        variant: "destructive",
      });
      return;
    }
    
    if (recordType === 'date') {
      // Validate date is within the allowed range
      if (!isValid(completionDate) || completionDate < minDate || completionDate > maxDate) {
        const minDateStr = isValid(minDate) ? format(minDate, 'dd/MM/yyyy') : 'Invalid';
        const maxDateStr = isValid(maxDate) ? format(maxDate, 'dd/MM/yyyy') : 'Invalid';
        toast({
          title: "Invalid date",
          description: `Please select a valid date between ${minDateStr} and ${maxDateStr} for this ${frequency?.toLowerCase() || 'compliance'} period.`,
          variant: "destructive",
        });
        return;
      }
    } else if (recordType === 'new') {
      // For "new" type, validate that text is entered
      if (!newText.trim()) {
        toast({
          title: "Text required",
          description: "Please enter text for the new record type.",
          variant: "destructive",
        });
        return;
      }
    } else if (recordType === 'spotcheck') {
      if (!spotcheckData) {
        toast({
          title: "Spot check incomplete",
          description: "Please complete the spot check form.",
          variant: "destructive",
        });
        return;
      }
    }

    setIsLoading(true);

    try {
      // Save spot check form when provided
      if (recordType === 'spotcheck' && spotcheckData) {
        // First create/update the compliance record
        const { data: updated, error: updateError } = await supabase
          .from('client_compliance_period_records')
          .update({
            status: 'completed',
            completion_date: spotcheckData.date,
            completion_method: 'spotcheck',
            notes: notes.trim() || null
          })
          .eq('client_compliance_type_id', complianceTypeId)
          .eq('client_id', selectedClientId)
          .eq('period_identifier', selectedPeriod)
          .select('id');

        let complianceRecordId: string;

        if (updated && updated.length > 0) {
          complianceRecordId = updated[0].id;
        } else {
          const { data: inserted, error: insertError } = await supabase
            .from('client_compliance_period_records')
            .insert({
              client_compliance_type_id: complianceTypeId,
              client_id: selectedClientId,
              period_identifier: selectedPeriod,
              status: 'completed',
              completion_date: spotcheckData.date,
              completion_method: 'spotcheck',
              notes: notes.trim() || null
            })
            .select('id')
            .maybeSingle();

          if (insertError) throw insertError;
          if (!inserted) throw new Error('Failed to create compliance record');
          complianceRecordId = inserted.id;
        }

        // Save the spot check record
        await supabase.from('client_spot_check_records').insert({
          client_id: selectedClientId,
          compliance_record_id: complianceRecordId,
          service_user_name: spotcheckData.serviceUserName,
          care_workers: '',
          date: spotcheckData.date,
          time: '',
          performed_by: spotcheckData.completedBy,
          observations: spotcheckData.observations as any
        });
      } else {
        // Save regular compliance record
        const recordData = {
          client_id: selectedClientId,
          client_compliance_type_id: complianceTypeId,
          period_identifier: selectedPeriod,
          completion_date:
            recordType === 'date'
              ? format(completionDate, 'yyyy-MM-dd')
              : newText,
          completion_method: recordType === 'date' ? 'date_entry' : 'text_entry',
          notes: notes.trim() || null,
          status: 'completed',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        };

        const { error } = await supabase
          .from('client_compliance_period_records')
          .insert(recordData);

        if (error) throw error;
      }

      toast({
        title: "Record added successfully",
        description: `Compliance record for ${selectedClientName || 'client'} has been added.`,
      });

      setIsOpen(false);
      setCompletionDate(new Date());
      setNotes('');
      setRecordType('date');
      setNewText('');
      setSpotcheckData(null);
      onRecordAdded();
    } catch (error) {
      console.error('Error adding compliance record:', error);
      toast({
        title: "Error adding record",
        description: "Could not add compliance record. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleDownloadPDF = async () => {
    if (recordType === 'spotcheck' && spotcheckData) {
      try {
        // Transform observations to match PDF interface
        const pdfData = {
          ...spotcheckData,
          observations: spotcheckData.observations.map(obs => ({
            label: obs.label,
            value: obs.value || 'not_applicable',
            comments: obs.comments
          }))
        };
        
        await generateClientSpotCheckPdf(pdfData, {
          name: companySettings?.name,
          logo: companySettings?.logo
        });
        
        toast({
          title: "PDF downloaded",
          description: "Client spot check PDF has been downloaded successfully.",
        });
      } catch (error) {
        console.error('Error generating PDF:', error);
        toast({
          title: "PDF generation failed",
          description: "Could not generate the PDF. Please try again.",
          variant: "destructive",
        });
      }
    }
  };

  const defaultTrigger = (
    <Button>
      Add Compliance Record
    </Button>
  );

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        {trigger || defaultTrigger}
      </DialogTrigger>
      <DialogContent className="w-[95vw] max-w-md sm:max-w-lg md:max-w-xl lg:max-w-2xl mx-auto max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Add Client Compliance Record</DialogTitle>
          <DialogDescription>
            Add a new compliance record for {complianceTypeName}
          </DialogDescription>
        </DialogHeader>
        
        <form onSubmit={handleSubmit} className="space-y-4">
          {!clientId && (
            <div className="space-y-2">
              <Label htmlFor="client">Client</Label>
              <Select value={selectedClientId} onValueChange={(value) => {
                setSelectedClientId(value);
                const client = clients.find(cl => cl.id === value);
                setSelectedClientName(client?.name || '');
              }}>
                <SelectTrigger>
                  <SelectValue placeholder="Select a client" />
                </SelectTrigger>
                <SelectContent>
                  {clients.map((client) => (
                    <SelectItem key={client.id} value={client.id}>
                      {client.name} ({client.branch || 'No Branch'})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {clientId && (
            <div className="space-y-2">
              <Label htmlFor="client">Client</Label>
              <Input
                id="client"
                value={selectedClientName}
                disabled
                className="bg-muted"
              />
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="period">Period</Label>
            <Input
              id="period"
              value={selectedPeriod}
              onChange={(e) => setSelectedPeriod(e.target.value)}
              placeholder="Enter period identifier"
            />
          </div>

          <div className="space-y-3">
            <Label>Record Type</Label>
            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                variant={recordType === 'date' ? 'default' : 'outline'}
                onClick={() => setRecordType('date')}
                className="flex-1 min-w-[140px]"
              >
                Date
              </Button>
              <Button
                type="button"
                variant={recordType === 'new' ? 'default' : 'outline'}
                onClick={() => setRecordType('new')}
                className="flex-1 min-w-[140px]"
              >
                New (before client onboarded)
              </Button>
              {complianceTypeName?.toLowerCase().includes('spot') && (
                <Button
                  type="button"
                  variant={recordType === 'spotcheck' ? 'default' : 'outline'}
                  onClick={() => {
                    setRecordType('spotcheck');
                    setSpotcheckOpen(true);
                  }}
                  className="flex-1 min-w-[140px]"
                >
                  Complete Spot Check
                </Button>
              )}
            </div>
          </div>

          {recordType === 'date' && (
            <div className="space-y-2">
              <Label>Completion Date</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn(
                      "w-full justify-start text-left font-normal",
                      !completionDate && "text-muted-foreground"
                    )}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {completionDate ? (
                      format(completionDate, "PPP")
                    ) : (
                      <span>Pick a date</span>
                    )}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={completionDate}
                    onSelect={(date) => date && setCompletionDate(date)}
                    disabled={(date) => date < minDate || date > maxDate}
                    initialFocus
                  />
                  <div className="p-3 border-t text-xs text-muted-foreground">
                    Valid range: {format(minDate, 'dd/MM/yyyy')} - {format(maxDate, 'dd/MM/yyyy')}
                  </div>
                </PopoverContent>
              </Popover>
            </div>
          )}

          {recordType === 'new' && (
            <div className="space-y-2">
              <Label htmlFor="newText">Completion Text</Label>
              <Input
                id="newText"
                value={newText}
                onChange={(e) => setNewText(e.target.value)}
                placeholder="Enter completion details"
              />
            </div>
          )}

          {recordType === 'spotcheck' && (
            <div className="space-y-2">
              <Button
                type="button"
                onClick={() => setSpotcheckOpen(true)}
                variant="outline"
                className="w-full"
              >
                {spotcheckData ? 'Edit Spot Check Form' : 'Complete Spot Check Form'}
              </Button>
              {spotcheckData && (
                <div className="text-sm text-muted-foreground">
                  Spot check completed for {spotcheckData.serviceUserName} on {spotcheckData.date}
                </div>
              )}
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="notes">Notes (Optional)</Label>
            <Textarea
              id="notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Add any additional notes..."
              rows={3}
            />
          </div>

          <div className="flex gap-2 justify-end">
            <Button type="button" variant="outline" onClick={() => setIsOpen(false)}>
              Cancel
            </Button>
            {recordType === 'spotcheck' && spotcheckData && (
              <Button type="button" variant="outline" onClick={handleDownloadPDF}>
                Download PDF
              </Button>
            )}
            <Button type="submit" disabled={isLoading}>
              {isLoading ? 'Adding...' : 'Add Record'}
            </Button>
          </div>
        </form>

        <ClientSpotCheckFormDialog
          open={spotcheckOpen}
          onOpenChange={setSpotcheckOpen}
          onSubmit={(data) => {
            setSpotcheckData(data);
            setSpotcheckOpen(false);
          }}
        />
      </DialogContent>
    </Dialog>
  );
}