
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { AlertTriangle, CheckCircle, Clock } from "lucide-react";
import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";

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

interface DocumentViewDialogProps {
  document: Document | null;
  open: boolean;
  onClose: () => void;
}

export function DocumentViewDialog({ document, open, onClose }: DocumentViewDialogProps) {
  const [employeeDocuments, setEmployeeDocuments] = useState<Document[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (document && open) {
      fetchEmployeeDocuments(document.employee_id);
    }
  }, [document, open]);

  const fetchEmployeeDocuments = async (employeeId: string) => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('document_tracker')
        .select(`
          *,
          employees (name, email, branch),
          document_types (name)
        `)
        .eq('employee_id', employeeId);

      if (error) throw error;
      setEmployeeDocuments(data || []);
    } catch (error) {
      console.error('Error fetching employee documents:', error);
    } finally {
      setLoading(false);
    }
  };

  if (!document) return null;

  const getStatusBadge = (document: Document) => {
    // If expiry_date is not a valid date (text entry), show as valid
    if (isNaN(Date.parse(document.expiry_date))) {
      return <Badge className="bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200">
        <CheckCircle className="w-3 h-3 mr-1" />
        Valid
      </Badge>;
    }

    const expiryDate = new Date(document.expiry_date);
    const today = new Date();
    const daysUntilExpiry = Math.ceil((expiryDate.getTime() - today.getTime()) / (1000 * 3600 * 24));

    if (daysUntilExpiry < 0) {
      return <Badge className="bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200">
        <AlertTriangle className="w-3 h-3 mr-1" />
        Expired
      </Badge>;
    } else if (daysUntilExpiry <= 30) {
      return <Badge className="bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200">
        <Clock className="w-3 h-3 mr-1" />
        Expiring ({daysUntilExpiry} days)
      </Badge>;
    } else {
      return <Badge className="bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200">
        <CheckCircle className="w-3 h-3 mr-1" />
        Valid
      </Badge>;
    }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[600px]">
        <DialogHeader>
          <DialogTitle>Document Details</DialogTitle>
        </DialogHeader>
        <div className="space-y-6">
          {/* Employee Information */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-sm font-medium text-muted-foreground">Employee</label>
              <p className="text-sm font-medium">{document.employees?.name}</p>
            </div>
            <div>
              <label className="text-sm font-medium text-muted-foreground">Email</label>
              <p className="text-sm">{document.employees?.email || 'N/A'}</p>
            </div>
          </div>

          <div>
            <label className="text-sm font-medium text-muted-foreground">Branch</label>
            <p className="text-sm">{document.employees?.branch}</p>
          </div>

          {/* All Document Types for Employee */}
          <div>
            <label className="text-sm font-medium text-muted-foreground">All Document Types</label>
            {loading ? (
              <p className="text-sm text-muted-foreground">Loading documents...</p>
            ) : (
              <div className="space-y-4 mt-2">
                {employeeDocuments.map((doc) => (
                  <div key={doc.id} className="p-4 border rounded-lg space-y-3">
                    <div className="flex items-center justify-between">
                      <h4 className="font-medium">{doc.document_types?.name}</h4>
                      {getStatusBadge(doc)}
                    </div>
                    
                    <div className="grid grid-cols-2 gap-4 text-sm">
                      <div>
                        <span className="text-muted-foreground">Document Number:</span>
                        <p className="font-mono">{doc.document_number || 'N/A'}</p>
                      </div>
                      <div>
                        <span className="text-muted-foreground">Expiry Date:</span>
                        <p>{isNaN(Date.parse(doc.expiry_date)) ? doc.expiry_date : new Date(doc.expiry_date).toLocaleDateString()}</p>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4 text-sm">
                      <div>
                        <span className="text-muted-foreground">Issue Date:</span>
                        <p>{doc.issue_date ? (isNaN(Date.parse(doc.issue_date)) ? doc.issue_date : new Date(doc.issue_date).toLocaleDateString()) : 'N/A'}</p>
                      </div>
                      <div>
                        <span className="text-muted-foreground">Country:</span>
                        <p>{doc.country || 'N/A'}</p>
                      </div>
                    </div>

                    <div className="text-sm">
                      <span className="text-muted-foreground">Nationality Status:</span>
                      <p>{doc.nationality_status || 'N/A'}</p>
                    </div>

                    {doc.notes && (
                      <div className="text-sm">
                        <span className="text-muted-foreground">Notes:</span>
                        <p className="mt-1">{doc.notes}</p>
                      </div>
                    )}
                  </div>
                ))}
                {employeeDocuments.length === 0 && (
                  <p className="text-sm text-muted-foreground">No documents found for this employee.</p>
                )}
              </div>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
