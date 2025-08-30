import { useState, useEffect } from "react";
import { Calendar, Download, AlertTriangle, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import ClientSpotCheckFormDialog, { ClientSpotCheckFormData } from "./ClientSpotCheckFormDialog";

interface ClientCompliancePeriodViewProps {
  complianceTypeId: string;
  complianceTypeName: string;
  frequency: string;
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

export function ClientCompliancePeriodView({ 
  complianceTypeId, 
  complianceTypeName, 
  frequency 
}: ClientCompliancePeriodViewProps) {
  const [periods, setPeriods] = useState<PeriodData[]>([]);
  const [selectedYear, setSelectedYear] = useState<number>(new Date().getFullYear());
  const [selectedPeriod, setSelectedPeriod] = useState<string>("");
  const [clients, setClients] = useState<Client[]>([]);
  const [records, setRecords] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [spotCheckDialogOpen, setSpotCheckDialogOpen] = useState(false);
  const [selectedClient, setSelectedClient] = useState<Client | null>(null);
  const { toast } = useToast();

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
      const shouldShowDownload = yearsOld >= 5;
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

    try {
      // First, create or update the compliance period record
      const { data: existingRecord } = await supabase
        .from('client_compliance_period_records')
        .select('id')
        .eq('client_compliance_type_id', complianceTypeId)
        .eq('client_id', selectedClient.id)
        .eq('period_identifier', selectedPeriod)
        .single();

      let complianceRecordId;

      if (existingRecord) {
        complianceRecordId = existingRecord.id;
        await supabase
          .from('client_compliance_period_records')
          .update({
            status: 'completed',
            completion_date: data.date,
            completion_method: 'spotcheck'
          })
          .eq('id', complianceRecordId);
      } else {
        const { data: newRecord, error: recordError } = await supabase
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
          .single();

        if (recordError) throw recordError;
        complianceRecordId = newRecord.id;
      }

      // Save the spot check record
      const { error: spotCheckError } = await supabase
        .from('client_spot_check_records')
        .insert({
          client_id: selectedClient.id,
          compliance_record_id: complianceRecordId,
          service_user_name: data.serviceUserName,
          care_workers: data.careWorkers,
          date: data.date,
          time: data.time,
          performed_by: data.performedBy,
          observations: JSON.stringify(data.observations)
        });

      if (spotCheckError) throw spotCheckError;

      toast({
        title: "Spot check completed",
        description: `Spot check for ${selectedClient.name} has been saved successfully.`,
      });

      setSpotCheckDialogOpen(false);
      setSelectedClient(null);
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
      {/* Period Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <h3 className="text-xl font-semibold">Client Compliance Records</h3>
        
        {frequency.toLowerCase() !== 'annual' && (
          <Select value={selectedYear.toString()} onValueChange={(value) => setSelectedYear(parseInt(value))}>
            <SelectTrigger className="w-40">
              <SelectValue placeholder="Select Year" />
            </SelectTrigger>
            <SelectContent>
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
            className={`card-premium transition-all duration-300 cursor-pointer ${
              period.is_current ? 'ring-2 ring-primary border-primary bg-primary/5' : ''
            } ${selectedPeriod === period.period_identifier ? 'ring-2 ring-secondary border-secondary' : ''}`}
            style={{ animationDelay: `${index * 50}ms` }}
            onClick={() => setSelectedPeriod(period.period_identifier)}
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
                  <p className="font-semibold">{period.record_count}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Completion</p>
                  <Badge className={getCompletionBadge(period.completion_rate)}>
                    {period.completion_rate.toFixed(1)}%
                  </Badge>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Client Details for Selected Period */}
      {selectedPeriod && (
        <Card>
          <CardHeader>
            <CardTitle>Clients - {getPeriodLabel(selectedPeriod)}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {clients.map((client) => {
                const record = getClientRecordForPeriod(client.id, selectedPeriod);
                const isCompleted = record?.status === 'completed';
                
                return (
                  <div key={client.id} className="flex flex-col sm:flex-row sm:items-center justify-between p-4 border rounded-lg">
                    <div className="flex-1">
                      <h4 className="font-medium">{client.name}</h4>
                      <p className="text-sm text-muted-foreground">
                        {client.branches?.name || 'Unknown Branch'}
                      </p>
                      {record && (
                        <p className="text-xs text-muted-foreground mt-1">
                          {isCompleted ? `Completed: ${record.completion_date}` : `Status: ${record.status}`}
                        </p>
                      )}
                    </div>
                    
                    <div className="flex items-center gap-2 mt-3 sm:mt-0">
                      <Badge 
                        className={isCompleted 
                          ? "bg-success/10 text-success border-success/20" 
                          : "bg-warning/10 text-warning border-warning/20"
                        }
                      >
                        {isCompleted ? 'Completed' : 'Pending'}
                      </Badge>
                      
                      <Button
                        size="sm"
                        onClick={() => {
                          setSelectedClient(client);
                          setSpotCheckDialogOpen(true);
                        }}
                        className="flex items-center gap-2"
                      >
                        <Plus className="w-4 h-4" />
                        {isCompleted ? 'Update' : 'Complete'}
                      </Button>
                    </div>
                  </div>
                );
              })}
              
              {clients.length === 0 && (
                <div className="text-center py-8 text-muted-foreground">
                  No clients found
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Spot Check Dialog */}
      <ClientSpotCheckFormDialog
        open={spotCheckDialogOpen}
        onOpenChange={setSpotCheckDialogOpen}
        onSubmit={handleSpotCheckSubmit}
        periodIdentifier={selectedPeriod}
        frequency={frequency}
      />
    </div>
  );
}