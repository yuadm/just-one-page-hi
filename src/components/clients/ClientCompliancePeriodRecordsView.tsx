import { useState, useEffect } from "react";
import { Calendar, Download, AlertTriangle, Eye } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { ClientCompliancePeriodDetailsView } from "./ClientCompliancePeriodDetailsView";
import { generateClientSpotCheckPdf } from "@/lib/client-spot-check-pdf";
import { useCompany } from "@/contexts/CompanyContext";

interface ClientCompliancePeriodRecordsViewProps {
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

export function ClientCompliancePeriodRecordsView({ 
  complianceTypeId, 
  complianceTypeName, 
  frequency 
}: ClientCompliancePeriodRecordsViewProps) {
  const [periods, setPeriods] = useState<PeriodData[]>([]);
  const [selectedYear, setSelectedYear] = useState<number>(new Date().getFullYear());
  const [loading, setLoading] = useState(true);
  const [clients, setClients] = useState<any[]>([]);
  const [records, setRecords] = useState<any[]>([]);
  const { toast } = useToast();
  const { companySettings } = useCompany();

  useEffect(() => {
    fetchData();
  }, [complianceTypeId, frequency, selectedYear]);

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

  const calculatePeriodStats = (periodId: string, clientsData: any[], recordsData: any[]) => {
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

  const generatePeriods = (clientsData: any[], recordsData: any[]) => {
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
        <h3 className="text-xl font-semibold">Client Compliance Period Records</h3>
        
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
        {periods.map((period, index) => {
          const showDownload = period.download_available && period.download_available_date;
          
          return (
            <Card 
              key={period.period_identifier} 
              className={`card-premium transition-all duration-300 ${
                period.is_current ? 'ring-2 ring-primary border-primary bg-primary/5' : ''
              }`}
              style={{ animationDelay: `${index * 50}ms` }}
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
                {showDownload && (
                  <Button 
                    variant="outline" 
                    size="sm" 
                    className="w-full"
                    onClick={() => handleDownloadPeriod(period)}
                  >
                    <Download className="w-4 h-4 mr-2" />
                    Download Archive
                  </Button>
                )}

                {/* View Details Button for current periods */}
                {!period.download_available && (
                  <ClientCompliancePeriodDetailsView
                    complianceTypeId={complianceTypeId}
                    complianceTypeName={complianceTypeName}
                    periodIdentifier={period.period_identifier}
                    frequency={frequency}
                    trigger={
                      <Button 
                        variant="default" 
                        size="sm" 
                        className="w-full bg-gradient-primary hover:opacity-90"
                      >
                        <Eye className="w-4 h-4 mr-2" />
                        View Details
                      </Button>
                    }
                  />
                )}
              </CardContent>
            </Card>
          );
        })}
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
  );
}