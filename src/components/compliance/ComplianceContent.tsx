import { useState, useEffect } from "react";
import { Shield, Plus, Calendar, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useNavigate } from "react-router-dom";
import { usePermissions } from "@/contexts/PermissionsContext";
import { usePagePermissions } from "@/hooks/usePagePermissions";

interface ComplianceType {
  id: string;
  name: string;
  description: string;
  frequency: string;
  created_at: string;
}

export function ComplianceContent() {
  const [complianceTypes, setComplianceTypes] = useState<ComplianceType[]>([]);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();
  const navigate = useNavigate();
  const { hasPageAccess } = usePermissions();
  const { 
    canViewCompliance,
    canCreateCompliance,
    canEditCompliance,
    canDeleteCompliance
  } = usePagePermissions();

  useEffect(() => {
    fetchComplianceTypes();

    // Listen for storage events to refresh when settings change (cross-tab)
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === 'compliance-types-updated') {
        console.log('Compliance types updated (cross-tab), refreshing...');
        fetchComplianceTypes();
        // Clear the storage item after handling
        localStorage.removeItem('compliance-types-updated');
      }
    };

    // Listen for custom events on the same tab
    const handleCustomRefresh = () => {
      console.log('Compliance types updated (same tab), refreshing...');
      fetchComplianceTypes();
    };

    // Listen for focus events to refresh when returning to the page
    const handleFocus = () => {
      console.log('Window focused, checking for updates...');
      const lastUpdate = localStorage.getItem('compliance-types-updated');
      if (lastUpdate) {
        console.log('Found pending updates, refreshing...');
        fetchComplianceTypes();
        localStorage.removeItem('compliance-types-updated');
      }
    };

    window.addEventListener('storage', handleStorageChange);
    window.addEventListener('compliance-types-updated', handleCustomRefresh);
    window.addEventListener('focus', handleFocus);

    return () => {
      window.removeEventListener('storage', handleStorageChange);
      window.removeEventListener('compliance-types-updated', handleCustomRefresh);
      window.removeEventListener('focus', handleFocus);
    };
  }, []);

  const fetchComplianceTypes = async () => {
    try {
      console.log('Fetching compliance types...');
      setLoading(true);
      
      const { data, error } = await supabase
        .from('compliance_types')
        .select('*')
        .order('name');

      console.log('Supabase response:', { data, error });

      if (error) {
        console.error('Supabase error:', error);
        toast({
          title: "Error loading compliance types",
          description: `Database error: ${error.message}`,
          variant: "destructive",
        });
        return;
      }

      console.log('Compliance types fetched:', data);
      setComplianceTypes(data || []);
    } catch (error) {
      console.error('Error fetching compliance types:', error);
      toast({
        title: "Error loading compliance types",
        description: "Could not fetch compliance types. Please try again.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  // Force refresh function
  const handleRefresh = () => {
    console.log('Manual refresh triggered');
    fetchComplianceTypes();
  };

  const getFrequencyIcon = (frequency: string) => {
    switch (frequency.toLowerCase()) {
      case 'weekly':
        return <Calendar className="w-5 h-5 text-primary" />;
      case 'monthly':
        return <Calendar className="w-5 h-5 text-success" />;
      case 'quarterly':
        return <Calendar className="w-5 h-5 text-warning" />;
      case 'bi-annual':
        return <Calendar className="w-5 h-5 text-destructive" />;
      case 'annual':
        return <Calendar className="w-5 h-5 text-destructive" />;
      default:
        return <Calendar className="w-5 h-5 text-muted-foreground" />;
    }
  };

  const handleComplianceTypeClick = (complianceType: ComplianceType) => {
    console.log('Navigating to compliance type:', complianceType.id);
    // Check if this is a client compliance type
    if (complianceType.name.toLowerCase().includes('client')) {
      navigate(`/client-compliance/${complianceType.id}`, { state: { complianceType } });
    } else {
      navigate(`/compliance/${complianceType.id}`, { state: { complianceType } });
    }
  };

  const handleAddType = () => {
    console.log('Add Type button clicked');
    navigate('/settings');
  };

  const handleViewOverdue = () => {
    console.log('View Overdue button clicked');
    toast({
      title: "View Overdue",
      description: "View overdue compliance functionality will be implemented soon.",
    });
  };

  if (loading) {
    return (
      <div className="space-y-6 animate-pulse">
        <div className="h-8 bg-muted rounded-lg w-64"></div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <div key={i} className="h-48 bg-muted rounded-xl"></div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 animate-fade-in">
        <div className="space-y-2">
          <h1 className="text-4xl font-bold bg-gradient-primary bg-clip-text text-transparent">
            Compliance Types
          </h1>
          <p className="text-lg text-muted-foreground">
            Select a compliance type to view and manage its requirements
          </p>
        </div>
        
        <div className="flex items-center gap-3">
          <Button variant="outline" size="sm" onClick={handleRefresh}>
            <Shield className="w-4 h-4 mr-2" />
            Refresh
          </Button>
        </div>
      </div>

      {/* Compliance Types Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {complianceTypes.map((type, index) => (
          <Card 
            key={type.id} 
            className="card-premium animate-fade-in hover:shadow-glow transition-all duration-300 cursor-pointer" 
            style={{ animationDelay: `${index * 100}ms` }}
            onClick={() => handleComplianceTypeClick(type)}
          >
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  {getFrequencyIcon(type.frequency)}
                  <div>
                    <CardTitle className="text-lg">{type.name}</CardTitle>
                    <p className="text-sm text-muted-foreground capitalize">{type.frequency}</p>
                  </div>
                </div>
              </div>
            </CardHeader>
            
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <p className="text-sm text-muted-foreground line-clamp-2">
                  {type.description}
                </p>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Frequency:</span>
                  <span className="font-medium capitalize">{type.frequency}</span>
                </div>
              </div>

              <div className="pt-3 border-t border-border/50">
                <Button className="w-full bg-gradient-primary hover:opacity-90" size="sm">
                  View Details
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {complianceTypes.length === 0 && !loading && (
        <div className="text-center py-12 animate-fade-in">
          <Shield className="w-16 h-16 mx-auto text-muted-foreground/50 mb-4" />
          <h3 className="text-lg font-semibold mb-2">No compliance types found</h3>
          <p className="text-muted-foreground mb-4">
            Get started by creating your first compliance type in Settings.
          </p>
        </div>
      )}
    </div>
  );
}
