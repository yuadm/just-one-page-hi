
import { useState, useEffect } from "react";
import { Plus, Edit, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";

interface ComplianceType {
  id: string;
  name: string;
  description?: string;
  frequency: string;
  has_questionnaire: boolean;
  created_at: string;
  updated_at: string;
  // Track which table(s) this type exists in
  in_employee_table?: boolean;
  in_client_table?: boolean;
}

const FREQUENCY_OPTIONS = [
  { value: "annual", label: "Annual" },
  { value: "monthly", label: "Monthly" },
  { value: "quarterly", label: "Quarterly" },
  { value: "bi-annual", label: "Bi-Annual" },
  { value: "weekly", label: "Weekly" },
];

const USE_FOR_OPTIONS = [
  { value: "employees", label: "Employees Only" },
  { value: "clients", label: "Clients Only" },
  { value: "both", label: "Both Employees & Clients" },
];

// Enhanced notification system
const notifyCompliancePageUpdate = () => {
  const timestamp = Date.now().toString();
  
  // Set a flag in localStorage for cross-tab communication
  localStorage.setItem('compliance-types-updated', timestamp);
  
  // Dispatch a custom event for same-tab communication
  const event = new CustomEvent('compliance-types-updated', {
    detail: { timestamp }
  });
  window.dispatchEvent(event);
  
  // Also trigger a storage event manually for same-tab updates
  window.dispatchEvent(new StorageEvent('storage', {
    key: 'compliance-types-updated',
    newValue: timestamp,
    storageArea: localStorage
  }));
  
  console.log('Notified compliance page of update at:', timestamp);
};

export function ComplianceTypeManagement() {
  const [complianceTypes, setComplianceTypes] = useState<ComplianceType[]>([]);
  const [loading, setLoading] = useState(true);
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [editingComplianceType, setEditingComplianceType] = useState<ComplianceType | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [complianceTypeToDelete, setComplianceTypeToDelete] = useState<ComplianceType | null>(null);
  const [newComplianceType, setNewComplianceType] = useState({
    name: "",
    description: "",
    frequency: "",
    has_questionnaire: false,
    useFor: "employees" as "employees" | "clients" | "both"
  });
  const { toast } = useToast();

  useEffect(() => {
    fetchComplianceTypes();
  }, []);

  const fetchComplianceTypes = async () => {
    try {
      console.log('Fetching compliance types from both tables...');
      
      // Fetch from both tables and merge results
      const [employeeTypesResult, clientTypesResult] = await Promise.all([
        supabase.from('compliance_types').select('*').order('name'),
        supabase.from('client_compliance_types').select('*').order('name')
      ]);

      if (employeeTypesResult.error) {
        console.error('Error fetching employee compliance types:', employeeTypesResult.error);
        toast({
          title: "Error",
          description: `Failed to fetch employee compliance types: ${employeeTypesResult.error.message}`,
          variant: "destructive",
        });
        return;
      }

      if (clientTypesResult.error) {
        console.error('Error fetching client compliance types:', clientTypesResult.error);
        toast({
          title: "Error", 
          description: `Failed to fetch client compliance types: ${clientTypesResult.error.message}`,
          variant: "destructive",
        });
        return;
      }

      // Create a map to merge the results
      const typeMap = new Map<string, ComplianceType>();
      
      // Add employee types
      employeeTypesResult.data?.forEach(type => {
        typeMap.set(type.id, {
          ...type,
          in_employee_table: true,
          in_client_table: false
        });
      });
      
      // Add or update with client types
      clientTypesResult.data?.forEach(type => {
        const existing = typeMap.get(type.id);
        if (existing) {
          existing.in_client_table = true;
        } else {
          typeMap.set(type.id, {
            ...type,
            in_employee_table: false,
            in_client_table: true
          });
        }
      });

      const mergedTypes = Array.from(typeMap.values()).sort((a, b) => a.name.localeCompare(b.name));
      setComplianceTypes(mergedTypes);
    } catch (error) {
      console.error('Error fetching compliance types:', error);
      toast({
        title: "Error",
        description: "Failed to fetch compliance types",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleAddComplianceType = async () => {
    if (!newComplianceType.name.trim() || !newComplianceType.frequency) return;

    try {
      console.log('Adding compliance type:', newComplianceType);
      
      const typeData = {
        name: newComplianceType.name,
        description: newComplianceType.description || null,
        frequency: newComplianceType.frequency,
        has_questionnaire: newComplianceType.has_questionnaire
      };

      let addedType: ComplianceType | null = null;

      if (newComplianceType.useFor === 'employees' || newComplianceType.useFor === 'both') {
        const { data, error } = await supabase
          .from('compliance_types')
          .insert([typeData])
          .select()
          .single();

        if (error) {
          console.error('Error adding employee compliance type:', error);
          toast({
            title: "Error",
            description: `Failed to add employee compliance type: ${error.message}`,
            variant: "destructive",
          });
          return;
        }
        addedType = { ...data, in_employee_table: true, in_client_table: false };
      }

      if (newComplianceType.useFor === 'clients' || newComplianceType.useFor === 'both') {
        // For 'both', use the same ID from the employee table
        const insertData = addedType ? { ...typeData, id: addedType.id } : typeData;
        
        const { data, error } = await supabase
          .from('client_compliance_types')
          .insert([insertData])
          .select()
          .single();

        if (error) {
          console.error('Error adding client compliance type:', error);
          toast({
            title: "Error",
            description: `Failed to add client compliance type: ${error.message}`,
            variant: "destructive",
          });
          return;
        }
        
        if (addedType) {
          addedType.in_client_table = true;
        } else {
          addedType = { ...data, in_employee_table: false, in_client_table: true };
        }
      }

      if (addedType) {
        setComplianceTypes([...complianceTypes, addedType]);
        setNewComplianceType({ name: "", description: "", frequency: "", has_questionnaire: false, useFor: "employees" });
        setIsAddDialogOpen(false);
        
        // Notify compliance page of the change
        notifyCompliancePageUpdate();
        
        toast({
          title: "Success",
          description: `Compliance type added successfully for ${newComplianceType.useFor}`,
        });
      }
    } catch (error) {
      console.error('Error adding compliance type:', error);
      toast({
        title: "Error",
        description: "Failed to add compliance type",
        variant: "destructive",
      });
    }
  };

  const handleEditComplianceType = async () => {
    if (!editingComplianceType || !editingComplianceType.name.trim() || !editingComplianceType.frequency) return;

    try {
      console.log('Updating compliance type:', editingComplianceType);
      
      const updateData = {
        name: editingComplianceType.name,
        description: editingComplianceType.description || null,
        frequency: editingComplianceType.frequency,
        has_questionnaire: editingComplianceType.has_questionnaire
      };

      const promises = [];

      if (editingComplianceType.in_employee_table) {
        promises.push(
          supabase
            .from('compliance_types')
            .update(updateData)
            .eq('id', editingComplianceType.id)
        );
      }

      if (editingComplianceType.in_client_table) {
        promises.push(
          supabase
            .from('client_compliance_types')
            .update(updateData)
            .eq('id', editingComplianceType.id)
        );
      }

      const results = await Promise.all(promises);
      
      for (const result of results) {
        if (result.error) {
          console.error('Error updating compliance type:', result.error);
          toast({
            title: "Error",
            description: `Failed to update compliance type: ${result.error.message}`,
            variant: "destructive",
          });
          return;
        }
      }

      console.log('Compliance type updated successfully');
      setComplianceTypes(complianceTypes.map(type => 
        type.id === editingComplianceType.id ? editingComplianceType : type
      ));
      setEditingComplianceType(null);
      setIsEditDialogOpen(false);
      
      // Notify compliance page of the change
      notifyCompliancePageUpdate();
      
      toast({
        title: "Success",
        description: "Compliance type updated successfully",
      });
    } catch (error) {
      console.error('Error updating compliance type:', error);
      toast({
        title: "Error",
        description: "Failed to update compliance type",
        variant: "destructive",
      });
    }
  };

  const handleDeleteClick = (complianceType: ComplianceType) => {
    setComplianceTypeToDelete(complianceType);
    setDeleteDialogOpen(true);
  };

  const handleDeleteConfirm = async () => {
    if (!complianceTypeToDelete) return;

    try {
      console.log('Deleting compliance type:', complianceTypeToDelete);
      
      const promises = [];

      if (complianceTypeToDelete.in_employee_table) {
        promises.push(
          supabase
            .from('compliance_types')
            .delete()
            .eq('id', complianceTypeToDelete.id)
        );
      }

      if (complianceTypeToDelete.in_client_table) {
        promises.push(
          supabase
            .from('client_compliance_types')
            .delete()
            .eq('id', complianceTypeToDelete.id)
        );
      }

      const results = await Promise.all(promises);
      
      for (const result of results) {
        if (result.error) {
          console.error('Error deleting compliance type:', result.error);
          toast({
            title: "Error",
            description: `Failed to delete compliance type: ${result.error.message}`,
            variant: "destructive",
          });
          return;
        }
      }

      console.log('Compliance type deleted successfully');
      setComplianceTypes(complianceTypes.filter(type => type.id !== complianceTypeToDelete.id));
      
      // Notify compliance page of the change
      notifyCompliancePageUpdate();
      
      toast({
        title: "Success",
        description: "Compliance type deleted successfully",
      });
    } catch (error) {
      console.error('Error deleting compliance type:', error);
      toast({
        title: "Error",
        description: "Failed to delete compliance type",
        variant: "destructive",
      });
    } finally {
      setDeleteDialogOpen(false);
      setComplianceTypeToDelete(null);
    }
  };

  if (loading) {
    return <div>Loading compliance types...</div>;
  }

  return (
    <>
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h4 className="font-semibold">Compliance Types</h4>
          <Button onClick={() => setIsAddDialogOpen(true)} className="bg-gradient-primary hover:opacity-90">
            <Plus className="w-4 h-4 mr-2" />
            Add Compliance Type
          </Button>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {complianceTypes.length > 0 ? (
            complianceTypes.map((complianceType) => (
              <div key={complianceType.id} className="p-4 border rounded-lg space-y-2">
                <div className="flex items-center justify-between">
                  <h5 className="font-medium">{complianceType.name}</h5>
                </div>
                {complianceType.description && (
                  <p className="text-sm text-muted-foreground">{complianceType.description}</p>
                )}
                <div className="flex items-center gap-4 text-sm">
                  <div>
                    <span className="font-medium">Frequency:</span> {
                      FREQUENCY_OPTIONS.find(opt => opt.value === complianceType.frequency)?.label || complianceType.frequency
                    }
                  </div>
                  {complianceType.has_questionnaire && (
                    <div className="bg-green-100 text-green-800 px-2 py-1 rounded-full text-xs">
                      Questionnaire Enabled
                    </div>
                  )}
                </div>
                <div className="flex items-center gap-2 text-xs">
                  <span className="font-medium">Used for:</span>
                  <div className="flex gap-1">
                    {complianceType.in_employee_table && (
                      <div className="bg-blue-100 text-blue-800 px-2 py-1 rounded-full">
                        Employees
                      </div>
                    )}
                    {complianceType.in_client_table && (
                      <div className="bg-purple-100 text-purple-800 px-2 py-1 rounded-full">
                        Clients
                      </div>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Button 
                    variant="ghost" 
                    size="sm"
                    onClick={() => {
                      setEditingComplianceType(complianceType);
                      setIsEditDialogOpen(true);
                    }}
                  >
                    <Edit className="w-4 h-4 mr-1" />
                    Edit
                  </Button>
                  <Button 
                    variant="ghost" 
                    size="sm"
                    onClick={() => handleDeleteClick(complianceType)}
                  >
                    <Trash2 className="w-4 h-4 mr-1" />
                    Delete
                  </Button>
                </div>
              </div>
            ))
          ) : (
            <div className="col-span-2 text-center py-8 text-muted-foreground">
              No compliance types found. Add your first compliance type to get started.
            </div>
          )}
        </div>
      </div>

      {/* Add Compliance Type Dialog */}
      <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add New Compliance Type</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="compliance-type-name">Compliance Type Name</Label>
              <Input
                id="compliance-type-name"
                value={newComplianceType.name}
                onChange={(e) => setNewComplianceType(prev => ({ ...prev, name: e.target.value }))}
                placeholder="Enter compliance type name"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="compliance-type-description">Description (Optional)</Label>
              <Textarea
                id="compliance-type-description"
                value={newComplianceType.description}
                onChange={(e) => setNewComplianceType(prev => ({ ...prev, description: e.target.value }))}
                placeholder="Enter description"
                rows={3}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="compliance-type-frequency">Frequency</Label>
              <Select 
                value={newComplianceType.frequency} 
                onValueChange={(value) => setNewComplianceType(prev => ({ ...prev, frequency: value }))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select frequency" />
                </SelectTrigger>
                <SelectContent>
                  {FREQUENCY_OPTIONS.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="compliance-type-use-for">Use For</Label>
              <Select 
                value={newComplianceType.useFor} 
                onValueChange={(value: "employees" | "clients" | "both") => setNewComplianceType(prev => ({ ...prev, useFor: value }))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select who this applies to" />
                </SelectTrigger>
                <SelectContent>
                  {USE_FOR_OPTIONS.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                Choose whether this compliance type applies to employees, clients, or both. Selecting "Both" ensures the type can be used in either context without foreign key errors.
              </p>
            </div>
            
            <div className="space-y-3">
              <div className="flex items-center space-x-2">
                <Switch
                  id="has-questionnaire"
                  checked={newComplianceType.has_questionnaire}
                  onCheckedChange={(checked) => setNewComplianceType(prev => ({ ...prev, has_questionnaire: checked }))}
                />
                <Label htmlFor="has-questionnaire">Enable Questionnaire</Label>
              </div>
              <p className="text-sm text-muted-foreground">
                When enabled, users can complete a questionnaire for this compliance type instead of just entering dates.
              </p>
            </div>
            
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setIsAddDialogOpen(false)}>
                Cancel
              </Button>
              <Button 
                onClick={handleAddComplianceType} 
                disabled={!newComplianceType.name.trim() || !newComplianceType.frequency || !newComplianceType.useFor}
                className="bg-gradient-primary hover:opacity-90"
              >
                Add Compliance Type
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Edit Compliance Type Dialog */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Compliance Type</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="edit-compliance-type-name">Compliance Type Name</Label>
              <Input
                id="edit-compliance-type-name"
                value={editingComplianceType?.name || ""}
                onChange={(e) => setEditingComplianceType(prev => prev ? { ...prev, name: e.target.value } : null)}
                placeholder="Enter compliance type name"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-compliance-type-description">Description (Optional)</Label>
              <Textarea
                id="edit-compliance-type-description"
                value={editingComplianceType?.description || ""}
                onChange={(e) => setEditingComplianceType(prev => prev ? { ...prev, description: e.target.value } : null)}
                placeholder="Enter description"
                rows={3}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-compliance-type-frequency">Frequency</Label>
              <Select 
                value={editingComplianceType?.frequency || ""} 
                onValueChange={(value) => setEditingComplianceType(prev => prev ? { ...prev, frequency: value } : null)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select frequency" />
                </SelectTrigger>
                <SelectContent>
                  {FREQUENCY_OPTIONS.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            
            <div className="space-y-3">
              <div className="flex items-center space-x-2">
                <Switch
                  id="edit-has-questionnaire"
                  checked={editingComplianceType?.has_questionnaire || false}
                  onCheckedChange={(checked) => setEditingComplianceType(prev => prev ? { ...prev, has_questionnaire: checked } : null)}
                />
                <Label htmlFor="edit-has-questionnaire">Enable Questionnaire</Label>
              </div>
              <p className="text-sm text-muted-foreground">
                When enabled, users can complete a questionnaire for this compliance type instead of just entering dates.
              </p>
            </div>
            
            <div className="space-y-2">
              <Label>Currently Used For</Label>
              <div className="flex gap-2 text-xs">
                {editingComplianceType?.in_employee_table && (
                  <div className="bg-blue-100 text-blue-800 px-2 py-1 rounded-full">
                    Employees
                  </div>
                )}
                {editingComplianceType?.in_client_table && (
                  <div className="bg-purple-100 text-purple-800 px-2 py-1 rounded-full">
                    Clients
                  </div>
                )}
              </div>
              <p className="text-xs text-muted-foreground">
                This compliance type exists in the tables shown above. Changes will be applied to all relevant tables.
              </p>
            </div>
            
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setIsEditDialogOpen(false)}>
                Cancel
              </Button>
              <Button 
                onClick={handleEditComplianceType} 
                disabled={!editingComplianceType?.name.trim() || !editingComplianceType?.frequency}
                className="bg-gradient-primary hover:opacity-90"
              >
                Save Changes
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Compliance Type</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete the compliance type "{complianceTypeToDelete?.name}"? 
              This action cannot be undone and may affect existing compliance records using this type.
              {complianceTypeToDelete && (
                <div className="mt-2 p-2 bg-muted rounded text-sm">
                  <p className="font-medium mb-1">This will delete from:</p>
                  <div className="flex gap-2">
                    {complianceTypeToDelete.in_employee_table && (
                      <span className="bg-blue-100 text-blue-800 px-2 py-1 rounded-full text-xs">
                        Employee compliance table
                      </span>
                    )}
                    {complianceTypeToDelete.in_client_table && (
                      <span className="bg-purple-100 text-purple-800 px-2 py-1 rounded-full text-xs">
                        Client compliance table
                      </span>
                    )}
                  </div>
                </div>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteConfirm}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete Compliance Type
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
