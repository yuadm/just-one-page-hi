import { useParams, useLocation } from "react-router-dom";
import { useState, useEffect } from "react";
import { MainLayout } from "@/components/layout/MainLayout";
import { ClientCompliancePeriodView } from "@/components/clients/ClientCompliancePeriodView";
import { ArrowLeft, Calendar, CheckCircle, Clock, AlertTriangle, Users, Shield } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface ComplianceType {
  id: string;
  name: string;
  description: string;
  frequency: string;
}

interface ComplianceStats {
  totalClients: number;
  completedClients: number;
  dueClients: number;
  overdueClients: number;
  pendingClients: number;
  completionRate: number;
}

interface BranchStats {
  branchName: string;
  completionRate: number;
  totalClients: number;
  completedClients: number;
}

export default function ClientCompliance() {
  const { id } = useParams<{ id: string }>();
  const location = useLocation();
  const navigate = useNavigate();
  const { toast } = useToast();
  
  const [stats, setStats] = useState<ComplianceStats>({
    totalClients: 0,
    completedClients: 0,
    dueClients: 0,
    overdueClients: 0,
    pendingClients: 0,
    completionRate: 0
  });
  const [branchStats, setBranchStats] = useState<BranchStats[]>([]);
  const [currentPeriod, setCurrentPeriod] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [selectedFilter, setSelectedFilter] = useState<string | null>(null);
  
  const complianceType = location.state?.complianceType as ComplianceType;

  useEffect(() => {
    if (id && complianceType) {
      fetchComplianceStats();
    }
  }, [id, complianceType]);

  const getCurrentPeriod = () => {
    const now = new Date();
    switch (complianceType.frequency.toLowerCase()) {
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

  const fetchComplianceStats = async () => {
    try {
      setLoading(true);
      const period = getCurrentPeriod();
      setCurrentPeriod(period);

      // Fetch all clients
      const { data: clients, error: clientsError } = await supabase
        .from('clients')
        .select(`
          *,
          branches (
            name
          )
        `)
        .eq('is_active', true);

      if (clientsError) throw clientsError;

      // Fetch compliance records for current period
      const { data: records, error: recordsError } = await supabase
        .from('client_compliance_period_records')
        .select('*')
        .eq('client_compliance_type_id', id)
        .eq('period_identifier', period);

      if (recordsError) throw recordsError;

      // Calculate overall stats
      const totalClients = clients?.length || 0;
      const completedRecords = records?.filter(r => r.status === 'completed') || [];
      const pendingRecords = records?.filter(r => r.status === 'pending') || [];
      const overdueRecords = records?.filter(r => r.status === 'overdue') || [];
      
      const completedClients = completedRecords.length;
      const pendingClients = pendingRecords.length;
      const overdueClients = overdueRecords.length;
      const dueClients = totalClients - completedClients;
      const completionRate = totalClients > 0 ? (completedClients / totalClients) * 100 : 0;

      setStats({
        totalClients,
        completedClients,
        dueClients,
        overdueClients,
        pendingClients,
        completionRate
      });

      // Calculate branch stats
      const branchMap = new Map<string, { total: number; completed: number; name: string }>();
      
      clients?.forEach(client => {
        const branchName = client.branches?.name || 'Unassigned';
        if (!branchMap.has(client.branch_id || 'unassigned')) {
          branchMap.set(client.branch_id || 'unassigned', {
            total: 0,
            completed: 0,
            name: branchName
          });
        }
        const branch = branchMap.get(client.branch_id || 'unassigned')!;
        branch.total++;

        const clientRecord = records?.find(r => r.client_id === client.id);
        if (clientRecord?.status === 'completed') {
          branch.completed++;
        }
      });

      const branchStatsArray: BranchStats[] = Array.from(branchMap.entries()).map(([_, data]) => ({
        branchName: data.name,
        completionRate: data.total > 0 ? (data.completed / data.total) * 100 : 0,
        totalClients: data.total,
        completedClients: data.completed
      }));

      setBranchStats(branchStatsArray);
    } catch (error) {
      console.error('Error fetching compliance stats:', error);
      toast({
        title: "Error loading data",
        description: "Could not fetch compliance statistics.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  if (!id || !complianceType) {
    return (
      <MainLayout>
        <div className="space-y-6">
          <Button 
            variant="outline" 
            onClick={() => navigate('/compliance')}
            className="flex items-center gap-2"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to Compliance
          </Button>
          <div className="text-center py-12">
            <h1 className="text-2xl font-bold text-foreground mb-4">Compliance Type Not Found</h1>
            <p className="text-muted-foreground">The requested compliance type could not be found.</p>
          </div>
        </div>
      </MainLayout>
    );
  }

  if (loading) {
    return (
      <MainLayout>
        <div className="space-y-6 animate-pulse">
          <div className="h-8 bg-muted rounded w-64"></div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="h-32 bg-muted rounded-xl"></div>
            ))}
          </div>
        </div>
      </MainLayout>
    );
  }

  return (
    <MainLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="space-y-6">
          <Button 
            variant="outline" 
            onClick={() => navigate('/compliance')}
            className="flex items-center gap-2 hover:bg-accent/50 transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to Compliance
          </Button>
          
          <div className="space-y-3">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-gradient-to-br from-primary/10 to-primary/5 border border-primary/20">
                <Shield className="w-6 h-6 text-primary" />
              </div>
              <div>
                <h1 className="text-3xl md:text-4xl font-bold bg-gradient-to-r from-primary via-primary/80 to-primary/60 bg-clip-text text-transparent">
                  {complianceType.name}
                </h1>
                <p className="text-lg text-muted-foreground mt-1">{complianceType.description}</p>
              </div>
            </div>
          </div>
        </div>

        {/* Compliance Requirements Card */}
        <Card className="bg-gradient-to-br from-card via-card/50 to-background border-border/50 shadow-lg">
          <CardHeader className="bg-gradient-to-r from-primary/5 to-primary/10 border-b">
            <CardTitle className="flex items-center gap-3 text-xl">
              <div className="p-2 rounded-lg bg-gradient-to-br from-primary/20 to-primary/10">
                <Calendar className="w-5 h-5 text-primary" />
              </div>
              <span className="bg-gradient-to-r from-primary to-primary/70 bg-clip-text text-transparent font-bold">
                Compliance Requirements
              </span>
            </CardTitle>
          </CardHeader>
          <CardContent className="p-6">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              {/* Frequency */}
              <div className="space-y-3">
                <p className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Frequency</p>
                <Badge className="bg-gradient-to-r from-primary/10 to-primary/5 text-primary border-primary/30 capitalize px-3 py-1 text-sm font-medium">
                  {complianceType.frequency}
                </Badge>
              </div>

              {/* Current Period */}
              <div className="space-y-3">
                <p className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Current Period</p>
                <div className="flex items-center gap-2">
                  <Calendar className="w-4 h-4 text-primary" />
                  <p className="text-lg font-bold text-foreground">{currentPeriod}</p>
                </div>
              </div>

              {/* Client Compliance */}
              <div className="space-y-3">
                <p className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Client Compliance</p>
                <div className="space-y-2">
                  <div className="flex items-baseline gap-1">
                    <span className="text-2xl font-bold text-primary">{stats.completedClients}</span>
                    <span className="text-lg text-muted-foreground">/</span>
                    <span className="text-lg font-semibold">{stats.totalClients}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-full bg-muted rounded-full h-2">
                      <div 
                        className="bg-gradient-to-r from-success to-success/80 h-2 rounded-full transition-all duration-300"
                        style={{ width: `${Math.min(stats.completionRate, 100)}%` }}
                      ></div>
                    </div>
                    <span className="text-sm font-medium text-success">{stats.completionRate.toFixed(0)}%</span>
                  </div>
                </div>
              </div>

              {/* Branch Completion */}
              <div className="space-y-3">
                <p className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Branch Performance</p>
                <div className="space-y-3 max-h-32 overflow-y-auto">
                  {branchStats.map((branch, index) => (
                    <div key={index} className="flex justify-between items-center p-2 rounded-lg bg-gradient-to-r from-muted/30 to-transparent">
                      <span className="text-sm font-medium text-foreground truncate">{branch.branchName}</span>
                      <Badge className="bg-gradient-to-r from-primary/10 to-primary/5 text-primary border-primary/20 text-xs">
                        {branch.completionRate.toFixed(0)}%
                      </Badge>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Statistics Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <Card 
            className={`group cursor-pointer transition-all duration-300 bg-gradient-to-br from-success/5 via-success/3 to-transparent border-success/20 hover:border-success/40 hover:shadow-lg hover:shadow-success/10 ${
              selectedFilter === 'completed' ? 'ring-2 ring-success shadow-lg shadow-success/20 scale-105' : ''
            }`}
            onClick={() => setSelectedFilter(selectedFilter === 'completed' ? null : 'completed')}
          >
            <CardContent className="p-6">
              <div className="flex items-center gap-4">
                <div className="p-3 rounded-xl bg-gradient-to-br from-success/20 to-success/10 group-hover:scale-110 transition-transform duration-200">
                  <CheckCircle className="w-6 h-6 text-success" />
                </div>
                <div>
                  <p className="text-3xl font-bold text-success">{stats.completedClients}</p>
                  <p className="text-sm font-medium text-success/80">Compliant</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card 
            className={`group cursor-pointer transition-all duration-300 bg-gradient-to-br from-warning/5 via-warning/3 to-transparent border-warning/20 hover:border-warning/40 hover:shadow-lg hover:shadow-warning/10 ${
              selectedFilter === 'due' ? 'ring-2 ring-warning shadow-lg shadow-warning/20 scale-105' : ''
            }`}
            onClick={() => setSelectedFilter(selectedFilter === 'due' ? null : 'due')}
          >
            <CardContent className="p-6">
              <div className="flex items-center gap-4">
                <div className="p-3 rounded-xl bg-gradient-to-br from-warning/20 to-warning/10 group-hover:scale-110 transition-transform duration-200">
                  <Clock className="w-6 h-6 text-warning" />
                </div>
                <div>
                  <p className="text-3xl font-bold text-warning">{stats.dueClients}</p>
                  <p className="text-sm font-medium text-warning/80">Due</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card 
            className={`group cursor-pointer transition-all duration-300 bg-gradient-to-br from-destructive/5 via-destructive/3 to-transparent border-destructive/20 hover:border-destructive/40 hover:shadow-lg hover:shadow-destructive/10 ${
              selectedFilter === 'overdue' ? 'ring-2 ring-destructive shadow-lg shadow-destructive/20 scale-105' : ''
            }`}
            onClick={() => setSelectedFilter(selectedFilter === 'overdue' ? null : 'overdue')}
          >
            <CardContent className="p-6">
              <div className="flex items-center gap-4">
                <div className="p-3 rounded-xl bg-gradient-to-br from-destructive/20 to-destructive/10 group-hover:scale-110 transition-transform duration-200">
                  <AlertTriangle className="w-6 h-6 text-destructive" />
                </div>
                <div>
                  <p className="text-3xl font-bold text-destructive">{stats.overdueClients}</p>
                  <p className="text-sm font-medium text-destructive/80">Overdue</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card 
            className={`group cursor-pointer transition-all duration-300 bg-gradient-to-br from-muted/5 via-muted/3 to-transparent border-border/20 hover:border-border/40 hover:shadow-lg ${
              selectedFilter === 'pending' ? 'ring-2 ring-border shadow-lg scale-105' : ''
            }`}
            onClick={() => setSelectedFilter(selectedFilter === 'pending' ? null : 'pending')}
          >
            <CardContent className="p-6">
              <div className="flex items-center gap-4">
                <div className="p-3 rounded-xl bg-gradient-to-br from-muted/20 to-muted/10 group-hover:scale-110 transition-transform duration-200">
                  <Users className="w-6 h-6 text-muted-foreground" />
                </div>
                <div>
                  <p className="text-3xl font-bold text-muted-foreground">{stats.pendingClients}</p>
                  <p className="text-sm font-medium text-muted-foreground/80">Pending</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Period View */}
        <ClientCompliancePeriodView 
          complianceTypeId={id}
          complianceTypeName={complianceType.name}
          frequency={complianceType.frequency}
          selectedFilter={selectedFilter}
        />
      </div>
    </MainLayout>
  );
}