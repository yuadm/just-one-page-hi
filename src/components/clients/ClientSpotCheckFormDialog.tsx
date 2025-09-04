import React, { useMemo, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { format } from "date-fns";
import { useCompany } from "@/contexts/CompanyContext";
import { useToast } from "@/hooks/use-toast";
import { CalendarIcon } from "lucide-react";

export interface ClientSpotCheckObservation {
  id: string;
  label: string;
  value?: "poor" | "fair" | "good" | "very_good" | "excellent" | "not_applicable";
  comments?: string;
  isRequired?: boolean;
}

export interface ClientSpotCheckFormData {
  serviceUserName: string;
  date: string;
  completedBy: string;
  observations: ClientSpotCheckObservation[];
}

interface ClientSpotCheckFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (data: ClientSpotCheckFormData) => void;
  initialData?: ClientSpotCheckFormData | null;
  periodIdentifier?: string;
  frequency?: string;
}

export default function ClientSpotCheckFormDialog({ 
  open, 
  onOpenChange, 
  onSubmit, 
  initialData, 
  periodIdentifier, 
  frequency 
}: ClientSpotCheckFormDialogProps) {
  const { companySettings } = useCompany();
  const { toast } = useToast();

  const [errors, setErrors] = useState<{
    serviceUserName?: string;
    date?: string;
    completedBy?: string;
    observations?: Record<string, string>;
  }>({});

  const [form, setForm] = useState<ClientSpotCheckFormData>({
    serviceUserName: "",
    date: "",
    completedBy: "",
    observations: [],
  });

  const observationItems = useMemo<ClientSpotCheckObservation[]>(
    () => [
      { id: "lighting", label: "Lighting: Assess the adequacy of lighting in all areas of the home.", isRequired: true },
      { id: "home_temperature", label: "Home Temperature: Comment on the comfort level of the home's temperature.", isRequired: true },
      { id: "security_doors_windows", label: "Security of Doors and Windows: Evaluate the security and functionality of doors and windows.", isRequired: true },
      { id: "trip_hazards", label: "Trip Hazards: Identify and assess potential trip hazards.", isRequired: true },
      { id: "mobility", label: "Mobility: Discuss the ease of maneuvering with mobility aids in the home.", isRequired: true },
      { id: "personal_hygiene", label: "Personal Hygiene: Evaluate the service user's personal hygiene.", isRequired: true },
      { id: "incontinence_supplies", label: "Assess the quantity of incontinence pad and Catheter bag.", isRequired: false },
      { id: "skin_health", label: "Skin Health: Note observations regarding the service user's skin condition.", isRequired: true },
      { id: "clothing", label: "Service User's Clothing: Discuss the cleanliness and regularity of change in the service user's clothing.", isRequired: true },
      { id: "kitchen_hygiene", label: "Kitchen Hygiene: Provide details on the state of the kitchen, especially the fridge.", isRequired: true },
      { id: "toilet_area", label: "Toilet Area: Describe the condition and cleanliness of the toilet area.", isRequired: true },
      { id: "bathroom_safety", label: "Bathroom Safety: Describe the safety features in the bathroom.", isRequired: true },
      { id: "bedroom_safety", label: "Bedroom Safety and Comfort: Evaluate the safety and comfort of the service user's bedroom.", isRequired: true },
      { id: "pets_plants", label: "Pets and Plant Care: Comment on the condition and care of any pets or plants.", isRequired: false },
      { id: "pest_infestation", label: "Pest Infestation: Observe any signs of pest infestation.", isRequired: true },
      { id: "medication_storage", label: "Medication Storage: Assess how medications are stored.", isRequired: true },
      { id: "medication_expiry", label: "Medication Expiry and Confusion Risk: Evaluate the presence of excess or expired medications.", isRequired: true },
      { id: "nutrition_hydration", label: "Nutrition and Hydration: Provide insights on the service user's nutrition and hydration.", isRequired: true },
      { id: "mental_wellbeing", label: "Mental and Emotional Well-being: Comment on the service user's mental and emotional state.", isRequired: true },
    ],
    []
  );

  // Initialize form on open
  React.useEffect(() => {
    if (!open) return;

    const baseObservations = observationItems.map((item) => ({ 
      id: item.id, 
      label: item.label, 
      isRequired: item.isRequired 
    } as ClientSpotCheckObservation));

    if (initialData) {
      const mergedObservations = baseObservations.map((base) => {
        const existing = initialData.observations.find((o) => o.id === base.id);
        return existing ? { ...base, value: existing.value, comments: existing.comments } : base;
      });

      setForm({
        serviceUserName: initialData.serviceUserName || "",
        date: initialData.date || "",
        completedBy: initialData.completedBy || "",
        observations: mergedObservations,
      });
    } else {
      setForm((prev) => ({
        ...prev,
        observations: baseObservations,
      }));
    }
  }, [open, initialData, observationItems]);

  const updateField = (key: keyof ClientSpotCheckFormData, value: string) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  const updateObservation = (id: string, changes: Partial<ClientSpotCheckObservation>) => {
    setForm((prev) => ({
      ...prev,
      observations: prev.observations.map((obs) => (obs.id === id ? { ...obs, ...changes } : obs)),
    }));
  };

  const handleSubmit = () => {
    const newErrors: typeof errors = { observations: {} };

    if (!form.serviceUserName) newErrors.serviceUserName = "Required";
    if (!form.date) newErrors.date = "Required";
    if (!form.completedBy) newErrors.completedBy = "Required";

    for (const obs of form.observations) {
      if (!obs.value) {
        newErrors.observations![obs.id] = "Please select an option";
      } else if (obs.isRequired && obs.value === "not_applicable") {
        newErrors.observations![obs.id] = "Not Applicable is not valid for this question";
      } else if (obs.isRequired && !obs.comments?.trim()) {
        newErrors.observations![obs.id] = "Descriptive comment is required";
      } else if (!obs.isRequired && obs.value !== "not_applicable" && !obs.comments?.trim()) {
        newErrors.observations![obs.id] = "Descriptive comment is required unless 'Not Applicable' is selected";
      }
    }

    const hasErrors =
      !!newErrors.serviceUserName ||
      !!newErrors.date ||
      !!newErrors.completedBy ||
      Object.keys(newErrors.observations || {}).length > 0;

    if (hasErrors) {
      setErrors(newErrors);
      toast({ title: "Please fix the highlighted fields", variant: "destructive" });
      return;
    }

    setErrors({});
    onSubmit(form);
    onOpenChange(false);
  };

  const getSelectOptions = (obs: ClientSpotCheckObservation) => {
    const baseOptions = [
      { value: "poor", label: "Poor" },
      { value: "fair", label: "Fair" },
      { value: "good", label: "Good" },
      { value: "very_good", label: "Very Good" },
      { value: "excellent", label: "Excellent" },
    ];

    // Add "Not Applicable" for specific questions
    if (obs.id === "incontinence_supplies" || obs.id === "pets_plants") {
      baseOptions.push({ value: "not_applicable", label: "Not Applicable" });
    }

    return baseOptions;
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[95vw] sm:max-w-2xl md:max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Service Quality Spot Check</DialogTitle>
          <DialogDescription>Complete the client spot check form below</DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          {/* Logo */}
          {companySettings?.logo && (
            <div className="flex justify-center">
              <img
                src={companySettings.logo}
                alt={`${companySettings.name || "Company"} logo`}
                className="h-12 object-contain"
                loading="lazy"
              />
            </div>
          )}

          {/* Header fields */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-1">
              <Label>Service User Name</Label>
              <Input
                value={form.serviceUserName}
                onChange={(e) => updateField("serviceUserName", e.target.value)}
                aria-invalid={!!errors.serviceUserName}
                className={errors.serviceUserName ? "border-destructive focus-visible:ring-destructive" : ""}
              />
              {errors.serviceUserName && <p className="text-destructive text-xs mt-1">{errors.serviceUserName}</p>}
            </div>

            <div className="space-y-1">
              <Label>Date</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className="w-full justify-start text-left font-normal"
                    aria-invalid={!!errors.date}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {form.date ? format(new Date(form.date), "PPP") : "Pick a date"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={form.date ? new Date(form.date) : undefined}
                    onSelect={(date) => date && updateField("date", format(date, "yyyy-MM-dd"))}
                    disabled={(date) => {
                      if (frequency?.toLowerCase() === 'quarterly' && periodIdentifier?.includes('-Q')) {
                        const [y, qStr] = periodIdentifier.split('-Q');
                        const year = parseInt(y);
                        const q = parseInt(qStr);
                        if (!isNaN(year) && !isNaN(q)) {
                          const startMonth = (q - 1) * 3;
                          const minDate = new Date(year, startMonth, 1);
                          const maxDate = new Date(year, startMonth + 3, 0);
                          return date < minDate || date > maxDate;
                        }
                      }
                      return false;
                    }}
                    initialFocus
                    className="p-3 pointer-events-auto"
                  />
                </PopoverContent>
              </Popover>
              {errors.date && <p className="text-destructive text-xs mt-1">{errors.date}</p>}
            </div>

            <div className="space-y-1">
              <Label>Completed By *</Label>
              <Input
                value={form.completedBy}
                onChange={(e) => updateField("completedBy", e.target.value)}
                aria-invalid={!!errors.completedBy}
                className={errors.completedBy ? "border-destructive focus-visible:ring-destructive" : ""}
              />
              {errors.completedBy && <p className="text-destructive text-xs mt-1">{errors.completedBy}</p>}
            </div>
          </div>

          {/* Observation section */}
          <div className="space-y-4">
            <h3 className="text-lg font-semibold">Assessment Questions</h3>
            
            <div className="space-y-4">
              {observationItems.map((item) => {
                const current = form.observations.find((o) => o.id === item.id);
                const err = errors.observations?.[item.id];
                const options = getSelectOptions(item);
                
                return (
                  <div key={item.id} className="rounded-lg border p-4 space-y-3">
                    <div className="font-medium text-sm">{item.label}</div>
                    
                    <div className="space-y-2">
                      <Label>Please Select</Label>
                      <Select
                        value={current?.value || ""}
                        onValueChange={(value) => updateObservation(item.id, { value: value as any })}
                      >
                        <SelectTrigger className={err ? "border-destructive" : ""}>
                          <SelectValue placeholder="Select option" />
                        </SelectTrigger>
                        <SelectContent>
                          {options.map((option) => (
                            <SelectItem key={option.value} value={option.value}>
                              {option.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-2">
                      <Label>
                        Descriptive Comment
                        {item.isRequired ? " *" : 
                         (current?.value !== "not_applicable" ? " *" : "")}
                      </Label>
                      <Textarea
                        placeholder={
                          current?.value === "not_applicable" 
                            ? "Not required for 'Not Applicable'" 
                            : "Enter your comments here"
                        }
                        value={current?.comments || ""}
                        onChange={(e) => updateObservation(item.id, { comments: e.target.value })}
                        disabled={current?.value === "not_applicable"}
                        aria-invalid={!!err}
                        className={err ? "border-destructive focus-visible:ring-destructive" : ""}
                        rows={3}
                      />
                    </div>
                    
                    {err && <p className="text-destructive text-xs">{err}</p>}
                  </div>
                );
              })}
            </div>
          </div>

          <div className="flex flex-col sm:flex-row justify-end gap-3">
            <Button variant="outline" onClick={() => onOpenChange(false)} className="w-full sm:w-auto">
              Cancel
            </Button>
            <Button onClick={handleSubmit} className="w-full sm:w-auto">
              Save Spot Check
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}