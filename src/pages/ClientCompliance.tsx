import { useParams, useLocation } from "react-router-dom";
import { MainLayout } from "@/components/layout/MainLayout";
import { ClientCompliancePeriodView } from "@/components/clients/ClientCompliancePeriodView";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";

interface ComplianceType {
  id: string;
  name: string;
  description: string;
  frequency: string;
}

export default function ClientCompliance() {
  const { id } = useParams<{ id: string }>();
  const location = useLocation();
  const navigate = useNavigate();
  
  const complianceType = location.state?.complianceType as ComplianceType;

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

  return (
    <MainLayout>
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="space-y-2">
            <Button 
              variant="outline" 
              onClick={() => navigate('/compliance')}
              className="flex items-center gap-2 mb-4"
            >
              <ArrowLeft className="w-4 h-4" />
              Back to Compliance
            </Button>
            <h1 className="text-3xl font-bold text-foreground">{complianceType.name}</h1>
            <p className="text-muted-foreground">{complianceType.description}</p>
            <div className="flex items-center gap-2 text-sm">
              <span className="text-muted-foreground">Frequency:</span>
              <span className="font-medium capitalize">{complianceType.frequency}</span>
            </div>
          </div>
        </div>

        <ClientCompliancePeriodView 
          complianceTypeId={id}
          complianceTypeName={complianceType.name}
          frequency={complianceType.frequency}
        />
      </div>
    </MainLayout>
  );
}