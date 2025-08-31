import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DateTextPicker } from "@/components/ui/date-text-picker";
import { AlertTriangle, CheckCircle, Clock, Edit2, Save, X } from "lucide-react";
import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
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

interface DocumentViewDialogProps {
  document: Document | null;
  open: boolean;
  onClose: () => void;
}

export function DocumentViewDialog({ document, open, onClose }: DocumentViewDialogProps) {
  const [employeeDocuments, setEmployeeDocuments] = useState<Document[]>([]);
  const [loading, setLoading] = useState(false);
  const [editingDocument, setEditingDocument] = useState<string | null>(null);
  const [editingMain, setEditingMain] = useState(false);
  const [editValues, setEditValues] = useState<any>({});
  const [mainEditValues, setMainEditValues] = useState({
    country: '',
    nationality_status: ''
  });
  const { toast } = useToast();

  useEffect(() => {
    if (document && open) {
      fetchEmployeeDocuments(document.employee_id);
      setMainEditValues({
        country: document.country || '',
        nationality_status: document.nationality_status || ''
      });
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

  const startEditing = (docId: string, doc: Document) => {
    setEditingDocument(docId);
    setEditValues({
      document_number: doc.document_number || '',
      issue_date: doc.issue_date || null,
      expiry_date: doc.expiry_date || null
    });
  };

  const startMainEditing = () => {
    setEditingMain(true);
  };

  const cancelEdit = () => {
    setEditingDocument(null);
    setEditingMain(false);
    setEditValues({});
  };

  const saveMainEdit = async () => {
    if (!document) return;
    
    try {
      const { error } = await supabase
        .from('document_tracker')
        .update({
          country: mainEditValues.country || null,
          nationality_status: mainEditValues.nationality_status || null
        })
        .eq('id', document.id);

      if (error) throw error;

      toast({
        title: "Document updated",
        description: "Country and nationality status updated successfully.",
      });

      setEditingMain(false);
      // Refresh the documents
      fetchEmployeeDocuments(document.employee_id);
    } catch (error) {
      console.error('Error updating document:', error);
      toast({
        title: "Error",
        description: "Failed to update document. Please try again.",
        variant: "destructive",
      });
    }
  };

  const saveEdit = async (docId: string) => {
    try {
      // Handle both Date and string values for dates
      let expiryDateValue = '';
      let issueDateValue = '';
      
      // Process expiry date
      if (editValues.expiry_date instanceof Date) {
        expiryDateValue = new Date(editValues.expiry_date.getTime() - editValues.expiry_date.getTimezoneOffset() * 60000).toISOString().split('T')[0];
      } else {
        expiryDateValue = editValues.expiry_date as string;
      }

      // Process issue date
      if (editValues.issue_date instanceof Date) {
        issueDateValue = new Date(editValues.issue_date.getTime() - editValues.issue_date.getTimezoneOffset() * 60000).toISOString().split('T')[0];
      } else {
        issueDateValue = editValues.issue_date as string;
      }

      const { error } = await supabase
        .from('document_tracker')
        .update({
          document_number: editValues.document_number || null,
          issue_date: issueDateValue || null,
          expiry_date: expiryDateValue || null
        })
        .eq('id', docId);

      if (error) throw error;

      toast({
        title: "Document updated",
        description: "Document details updated successfully.",
      });

      setEditingDocument(null);
      setEditValues({});
      // Refresh the documents
      fetchEmployeeDocuments(document.employee_id);
    } catch (error) {
      console.error('Error updating document:', error);
      toast({
        title: "Error",
        description: "Failed to update document. Please try again.",
        variant: "destructive",
      });
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
      <DialogContent className="w-[95vw] max-w-[800px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Document Details</DialogTitle>
        </DialogHeader>
        <div className="space-y-6">
          {/* Employee Information - Read Only */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            <div>
              <label className="text-sm font-medium text-muted-foreground">Employee</label>
              <p className="text-sm font-medium">{document.employees?.name}</p>
            </div>
            <div>
              <label className="text-sm font-medium text-muted-foreground">Email</label>
              <p className="text-sm">{document.employees?.email || 'N/A'}</p>
            </div>
            <div>
              <label className="text-sm font-medium text-muted-foreground">Branch</label>
              <p className="text-sm">{document.employees?.branch}</p>
            </div>
          </div>

          {/* Country and Nationality Status - Editable */}
          <div className="border rounded-lg p-4 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-medium">Additional Information</h3>
              {!editingMain && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={startMainEditing}
                >
                  <Edit2 className="w-4 h-4 mr-2" />
                  Edit
                </Button>
              )}
            </div>
            
            {editingMain ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium text-muted-foreground">Country</label>
                  <Select
                    value={mainEditValues.country}
                    onValueChange={(val) => setMainEditValues({...mainEditValues, country: val})}
                  >
                    <SelectTrigger>
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
                  <label className="text-sm font-medium text-muted-foreground">Nationality Status</label>
                  <Input
                    value={mainEditValues.nationality_status}
                    onChange={(e) => setMainEditValues({...mainEditValues, nationality_status: e.target.value})}
                    placeholder="e.g., British Citizen"
                  />
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium text-muted-foreground">Country</label>
                  <p className="text-sm">{document.country || 'N/A'}</p>
                </div>
                <div>
                  <label className="text-sm font-medium text-muted-foreground">Nationality Status</label>
                  <p className="text-sm">{document.nationality_status || 'N/A'}</p>
                </div>
              </div>
            )}

            {editingMain && (
              <div className="flex gap-2">
                <Button
                  size="sm"
                  onClick={saveMainEdit}
                  className="bg-gradient-primary hover:opacity-90"
                >
                  <Save className="w-4 h-4 mr-2" />
                  Save
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={cancelEdit}
                >
                  <X className="w-4 h-4 mr-2" />
                  Cancel
                </Button>
              </div>
            )}
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
                      <div className="flex items-center gap-2">
                        {getStatusBadge(doc)}
                        {editingDocument !== doc.id && (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => startEditing(doc.id, doc)}
                          >
                            <Edit2 className="w-4 h-4" />
                          </Button>
                        )}
                      </div>
                    </div>
                    
                    {editingDocument === doc.id ? (
                      <div className="space-y-4">
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                          <div className="space-y-2">
                            <label className="text-sm font-medium text-muted-foreground">Document Number</label>
                            <Input
                              value={editValues.document_number || ''}
                              onChange={(e) => setEditValues({...editValues, document_number: e.target.value})}
                              placeholder="e.g., ABC123456"
                            />
                          </div>
                          <div className="space-y-2">
                            <label className="text-sm font-medium text-muted-foreground">Expiry Date</label>
                            <DateTextPicker
                              value={editValues.expiry_date}
                              onChange={(value) => setEditValues({...editValues, expiry_date: value})}
                              placeholder="Pick date or enter text"
                            />
                          </div>
                        </div>
                        <div className="space-y-2">
                          <label className="text-sm font-medium text-muted-foreground">Issue Date</label>
                          <DateTextPicker
                            value={editValues.issue_date}
                            onChange={(value) => setEditValues({...editValues, issue_date: value})}
                            placeholder="Pick date or enter text"
                          />
                        </div>
                        <div className="flex gap-2">
                          <Button
                            size="sm"
                            onClick={() => saveEdit(doc.id)}
                            className="bg-gradient-primary hover:opacity-90"
                          >
                            <Save className="w-4 h-4 mr-2" />
                            Save
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={cancelEdit}
                          >
                            <X className="w-4 h-4 mr-2" />
                            Cancel
                          </Button>
                        </div>
                      </div>
                    ) : (
                      <>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
                          <div>
                            <span className="text-muted-foreground">Document Number:</span>
                            <p className="font-mono">{doc.document_number || 'N/A'}</p>
                          </div>
                          <div>
                            <span className="text-muted-foreground">Expiry Date:</span>
                            <p>{isNaN(Date.parse(doc.expiry_date)) ? doc.expiry_date : new Date(doc.expiry_date).toLocaleDateString()}</p>
                          </div>
                        </div>

                        <div className="text-sm">
                          <div>
                            <span className="text-muted-foreground">Issue Date:</span>
                            <p>{doc.issue_date ? (isNaN(Date.parse(doc.issue_date)) ? doc.issue_date : new Date(doc.issue_date).toLocaleDateString()) : 'N/A'}</p>
                          </div>
                        </div>

                        {doc.notes && (
                          <div className="text-sm">
                            <span className="text-muted-foreground">Notes:</span>
                            <p className="mt-1">{doc.notes}</p>
                          </div>
                        )}
                      </>
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