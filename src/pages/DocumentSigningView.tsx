import { useParams, useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState, useRef } from "react";
import SignatureCanvas from "react-signature-canvas";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { toast } from "sonner";
import { 
  Loader2, 
  FileText, 
  PenTool, 
  CheckCircle2, 
  Shield, 
  User, 
  Calendar, 
  RotateCcw,
  Eye,
  Smartphone,
  Clock,
  Mail,
  Download,
  Lock
} from "lucide-react";
import { PDFDocument } from "pdf-lib";
import { EnhancedPDFViewer } from "@/components/document-signing/EnhancedPDFViewer";
import "@/lib/pdf-config";

interface SigningRequestData {
  id: string;
  template_id: string;
  title: string;
  message: string;
  status: string;
  document_templates: {
    name: string;
    file_path: string;
  };
  signing_request_recipients: {
    id: string;
    recipient_name: string;
    recipient_email: string;
    status: string;
    access_token: string;
    expired_at?: string;
    access_count?: number;
  }[];
}

interface TemplateField {
  id: string;
  field_name: string;
  field_type: string;
  x_position: number;
  y_position: number;
  width: number;
  height: number;
  page_number: number;
  is_required: boolean;
  placeholder_text?: string;
}

export default function DocumentSigningView() {
  const { token } = useParams<{ token: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [currentPage, setCurrentPage] = useState(1);
  const [scale, setScale] = useState(1.0);
  const [pdfUrl, setPdfUrl] = useState<string>("");
  const [fieldValues, setFieldValues] = useState<Record<string, string>>({});
  const [signatures, setSignatures] = useState<Record<string, string>>({});
  const [isSigningInProgress, setIsSigningInProgress] = useState(false);
  const [hasBeenSigned, setHasBeenSigned] = useState(false);
  const [selectedField, setSelectedField] = useState<string | null>(null);
  const [showFieldModal, setShowFieldModal] = useState(false);
  const [isMobileView, setIsMobileView] = useState(false);
  const signatureRefs = useRef<Record<string, SignatureCanvas | null>>({});

  // Check if mobile view
  useEffect(() => {
    const checkMobileView = () => {
      setIsMobileView(window.innerWidth < 768);
    };
    
    checkMobileView();
    window.addEventListener('resize', checkMobileView);
    return () => window.removeEventListener('resize', checkMobileView);
  }, []);

  // Fetch signing request data
  const { data: signingData, isLoading, error } = useQuery({
    queryKey: ["signing-request", token],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("signing_requests")
        .select(`
          *,
          document_templates (name, file_path),
          signing_request_recipients (*)
        `)
        .eq("signing_token", token)
        .single();

      if (error) throw error;
      
      // Track access for expiration checking
      if (data?.signing_request_recipients?.[0]) {
        await supabase
          .from("signing_request_recipients")
          .update({ 
            access_count: (data.signing_request_recipients[0].access_count || 0) + 1 
          })
          .eq("id", data.signing_request_recipients[0].id);
      }
      
      return data as SigningRequestData;
    },
    enabled: !!token,
  });

  // Fetch template fields
  const { data: templateFields } = useQuery({
    queryKey: ["template-fields", signingData?.template_id],
    queryFn: async () => {
      if (!signingData?.template_id) return [];
      
      console.log("Fetching template fields for template_id:", signingData.template_id);
      
      const { data, error } = await supabase
        .from("template_fields")
        .select("*")
        .eq("template_id", signingData.template_id)
        .order("page_number");

      if (error) {
        console.error("Error fetching template fields:", error);
        throw error;
      }
      
      console.log("Template fields data:", data);
      return data as TemplateField[];
    },
    enabled: !!signingData?.template_id,
  });

  // Load PDF when data is available
  useEffect(() => {
    if (signingData?.document_templates?.file_path) {
      const url = `${supabase.storage.from("company-assets").getPublicUrl(signingData.document_templates.file_path).data.publicUrl}`;
      setPdfUrl(url);
    }
  }, [signingData]);

  // Complete signing mutation
  const completeSigning = useMutation({
    mutationFn: async () => {
      if (!signingData || !templateFields) return;

      const recipient = signingData.signing_request_recipients[0];
      if (!recipient) throw new Error("No recipient found");

      // Generate final PDF with filled fields and signatures
      const originalPdfUrl = `${supabase.storage.from("company-assets").getPublicUrl(signingData.document_templates.file_path).data.publicUrl}`;
      const originalPdfResponse = await fetch(originalPdfUrl);
      const originalPdfBytes = await originalPdfResponse.arrayBuffer();

      const pdfDoc = await PDFDocument.load(originalPdfBytes);
      const pages = pdfDoc.getPages();

      // Add field values and signatures to the PDF
      for (const field of templateFields) {
        const page = pages[field.page_number - 1];
        if (!page) continue;

        const value = field.field_type === "signature" ? signatures[field.id] : fieldValues[field.id];
        if (!value) continue;

        // Get page dimensions for coordinate conversion
        const { height: pageHeight } = page.getSize();
        
        // Convert web coordinates to PDF coordinates (Y-axis is flipped in PDF)
        const pdfX = field.x_position;
        const pdfY = pageHeight - field.y_position - field.height;

        if (field.field_type === "signature") {
          // Handle signature fields - convert base64 to image and embed
          try {
            const signatureData = value.split(',')[1]; // Remove data:image/png;base64, prefix
            const signatureBytes = Uint8Array.from(atob(signatureData), c => c.charCodeAt(0));
            const signatureImage = await pdfDoc.embedPng(signatureBytes);
            
            page.drawImage(signatureImage, {
              x: pdfX,
              y: pdfY,
              width: field.width,
              height: field.height,
            });
          } catch (error) {
            console.error("Error adding signature:", error);
          }
        } else if (field.field_type === "checkbox") {
          // Handle checkbox fields
          if (value === "true") {
            page.drawText("✓", {
              x: pdfX + 2,
              y: pdfY + 5,
              size: field.height - 4,
            });
          }
        } else {
          // Handle text fields
          page.drawText(value.toString(), {
            x: pdfX,
            y: pdfY + (field.height / 2) - 6, // Center text vertically
            size: Math.min(12, field.height - 4),
          });
        }
      }

      // Generate the final PDF
      const finalPdfBytes = await pdfDoc.save();
      const finalPdfBlob = new Blob([finalPdfBytes], { type: 'application/pdf' });

      // Upload the final PDF to storage
      const fileName = `${Date.now()}_${signingData.title}_signed.pdf`;
      const { error: uploadError } = await supabase.storage
        .from("company-assets")
        .upload(`signed-documents/${fileName}`, finalPdfBlob);

      if (uploadError) throw uploadError;

      // Update recipient status to signed and mark as expired
      const { error: updateError } = await supabase
        .from("signing_request_recipients")
        .update({
          status: "signed",
          signed_at: new Date().toISOString(),
          expired_at: new Date().toISOString(), // Immediately expire the link
        })
        .eq("id", recipient.id);

      if (updateError) throw updateError;

      // Create signed document record with field data
      const signedDocumentData = {
        signing_request_id: signingData.id,
        final_document_path: `signed-documents/${fileName}`,
        completion_data: {
          recipient_id: recipient.id,
          field_data: {
            ...fieldValues,
            ...signatures,
          },
        },
        completed_at: new Date().toISOString(),
      };

      const { error: docError } = await supabase
        .from("signed_documents")
        .insert(signedDocumentData);

      if (docError) throw docError;

      // Send completion notification
      await supabase.functions.invoke("send-completion-notification", {
        body: {
          documentTitle: signingData.title,
          recipientName: recipient.recipient_name,
          recipientEmail: recipient.recipient_email,
        },
      });
    },
    onSuccess: () => {
      setHasBeenSigned(true); // Immediately mark as signed locally
      toast.success("Document signed successfully!");
      queryClient.invalidateQueries({ queryKey: ["signing-request", token] });
      // Close the tab/window or redirect to success page
      setTimeout(() => {
        window.close();
        // If window.close() doesn't work (e.g., not opened by JS), redirect
        if (!window.closed) {
          navigate("/", { replace: true });
        }
      }, 2000);
    },
    onError: (error: any) => {
      console.error("Error signing document:", error);
      toast.error("Failed to sign document: " + error.message);
      setIsSigningInProgress(false); // Reset signing state on error
    },
  });

  const handleFieldChange = (fieldId: string, value: string) => {
    setFieldValues(prev => ({ ...prev, [fieldId]: value }));
  };

  const handleSignature = (fieldId: string) => {
    const canvas = signatureRefs.current[fieldId];
    if (canvas && !canvas.isEmpty()) {
      const dataURL = canvas.toDataURL();
      setSignatures(prev => ({ ...prev, [fieldId]: dataURL }));
      toast.success("Signature captured successfully!");
    }
  };

  const clearSignature = (fieldId: string) => {
    const canvas = signatureRefs.current[fieldId];
    if (canvas) {
      canvas.clear();
    }
    setSignatures(prev => {
      const newSignatures = { ...prev };
      delete newSignatures[fieldId];
      return newSignatures;
    });
  };

  const handleFieldClick = (fieldId: string) => {
    setSelectedField(fieldId);
    setShowFieldModal(true);
  };

  const closeFieldModal = () => {
    setShowFieldModal(false);
    setSelectedField(null);
  };

  const handleSubmit = () => {
    if (!templateFields || isSigningInProgress) return;

    // Prevent multiple submissions
    if (completeSigning.isPending) {
      toast.error("Document is already being signed, please wait...");
      return;
    }

    // Check required fields
    const requiredFields = templateFields.filter(field => field.is_required);
    const missingFields = requiredFields.filter(field => {
      if (field.field_type === "signature") {
        return !signatures[field.id];
      }
      if (field.field_type === "checkbox") {
        return !fieldValues[field.id]; // Checkbox can be true or false, just check if it's set
      }
      return !fieldValues[field.id];
    });

    if (missingFields.length > 0) {
      toast.error("Please fill all required fields");
      return;
    }

    // Set signing in progress to prevent multiple clicks
    setIsSigningInProgress(true);
    completeSigning.mutate();
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-primary/5 via-background to-accent/5 flex items-center justify-center p-4">
        <Card className="w-full max-w-md shadow-2xl border-0 bg-white/80 backdrop-blur-sm">
          <CardContent className="p-8 text-center">
            <div className="relative mb-6">
              <div className="absolute inset-0 bg-gradient-to-r from-primary to-accent rounded-full animate-pulse opacity-20"></div>
              <Loader2 className="h-12 w-12 animate-spin mx-auto text-primary relative z-10" />
            </div>
            <h2 className="text-xl font-semibold mb-2">Preparing Your Document</h2>
            <p className="text-muted-foreground mb-4">We're loading your secure document for signing</p>
            <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
              <Shield className="h-4 w-4" />
              <span>Encrypted & Secure</span>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (error || !signingData) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-destructive/5 via-background to-muted/5 flex items-center justify-center p-4">
        <Card className="w-full max-w-md shadow-2xl border-0 bg-white/80 backdrop-blur-sm">
          <CardHeader className="text-center pb-4">
            <div className="mx-auto w-16 h-16 bg-destructive/10 rounded-full flex items-center justify-center mb-4">
              <Lock className="h-8 w-8 text-destructive" />
            </div>
            <CardTitle className="text-destructive text-xl">Document Not Found</CardTitle>
          </CardHeader>
          <CardContent className="text-center">
            <p className="text-muted-foreground mb-6">The signing link is invalid, expired, or no longer available.</p>
            <Button onClick={() => navigate("/")} className="w-full">Return to Home</Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const recipient = signingData.signing_request_recipients[0];
  const isAlreadySigned = recipient?.status === "signed" || hasBeenSigned;
  const isExpired = recipient?.expired_at !== null;
  const hasAccessedAfterSigning = recipient?.status === "signed" && (recipient?.access_count || 0) > 1;

  if (isAlreadySigned || isExpired) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-green-50 via-background to-emerald-50 flex items-center justify-center p-4">
        <Card className="w-full max-w-md shadow-2xl border-0 bg-white/80 backdrop-blur-sm">
          <CardHeader className="text-center pb-4">
            <div className="mx-auto w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mb-4">
              <CheckCircle2 className="h-8 w-8 text-green-600" />
            </div>
            <CardTitle className="text-green-600 text-xl">
              {isExpired ? "Link Expired" : "Document Signed Successfully"}
            </CardTitle>
          </CardHeader>
          <CardContent className="text-center">
            <p className="text-muted-foreground mb-6">
              {isExpired 
                ? "This signing link has expired and is no longer accessible." 
                : "This document has been successfully signed and completed."
              }
            </p>
            <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground mb-6">
              <Shield className="h-4 w-4" />
              <span>Secured & Encrypted</span>
            </div>
            <Button onClick={() => navigate("/")} className="w-full">Return to Home</Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Calculate form completion
  const requiredFields = templateFields?.filter(field => field.is_required) || [];
  const completedRequiredFields = requiredFields.filter(field => {
    if (field.field_type === "signature") {
      return signatures[field.id];
    }
    return fieldValues[field.id];
  });
  const isFormComplete = requiredFields.length > 0 && completedRequiredFields.length === requiredFields.length;

  const selectedFieldData = templateFields?.find(field => field.id === selectedField);
  const completionPercentage = requiredFields.length > 0 ? (completedRequiredFields.length / requiredFields.length) * 100 : 100;

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary/5 via-background to-accent/10">
      {/* Modern Header */}
      <div className="bg-white/80 backdrop-blur-md border-b border-primary/10 sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 py-4">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-gradient-to-r from-primary to-accent rounded-xl flex items-center justify-center">
                <FileText className="h-5 w-5 text-white" />
              </div>
              <div>
                <h1 className="font-bold text-xl text-foreground">{signingData.title}</h1>
                <p className="text-sm text-muted-foreground">{signingData.document_templates.name}</p>
              </div>
            </div>
            
            <div className="flex items-center gap-3">
              <Badge variant="outline" className="flex items-center gap-1.5 bg-green-50 text-green-700 border-green-200">
                <Shield className="h-3 w-3" />
                <span className="hidden sm:inline">Secure Signing</span>
                <span className="sm:hidden">Secure</span>
              </Badge>
              
              {isMobileView && (
                <Badge variant="outline" className="flex items-center gap-1 bg-blue-50 text-blue-700 border-blue-200">
                  <Smartphone className="h-3 w-3" />
                  Mobile Optimized
                </Badge>
              )}
            </div>
          </div>
          
          {/* Progress Section */}
          <div className="mt-4 space-y-2">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Clock className="h-4 w-4" />
                <span>Progress: {completedRequiredFields.length} of {requiredFields.length} fields completed</span>
              </div>
              <div className="text-sm font-medium text-primary">
                {Math.round(completionPercentage)}% Complete
              </div>
            </div>
            
            <div className="relative">
              <div className="w-full bg-muted/50 rounded-full h-2 overflow-hidden">
                <div 
                  className="h-full bg-gradient-to-r from-primary to-accent transition-all duration-500 ease-out"
                  style={{ width: `${completionPercentage}%` }}
                />
              </div>
              {completionPercentage === 100 && (
                <div className="absolute -top-1 right-0 animate-bounce">
                  <CheckCircle2 className="h-4 w-4 text-green-600" />
                </div>
              )}
            </div>
          </div>
          
          {signingData.message && (
            <div className="mt-3 p-3 bg-primary/5 rounded-lg border border-primary/10">
              <p className="text-sm text-primary/80 italic">"{signingData.message}"</p>
            </div>
          )}
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-4 py-6">
        {isMobileView ? (
          /* Mobile Layout */
          <div className="space-y-6">
            {/* Document Viewer */}
            <Card className="shadow-xl border-0 bg-white/80 backdrop-blur-sm">
              <CardHeader className="bg-gradient-to-r from-primary/5 to-accent/5">
                <CardTitle className="flex items-center gap-2">
                  <Eye className="h-5 w-5" />
                  Review Document
                </CardTitle>
                <p className="text-sm text-muted-foreground">
                  Tap the highlighted areas to complete fields
                </p>
              </CardHeader>
              <CardContent className="p-0">
                <div className="h-[60vh]">
                  {pdfUrl && (
                    <EnhancedPDFViewer
                      pdfUrl={pdfUrl}
                      currentPage={currentPage}
                      onPageChange={setCurrentPage}
                      scale={scale}
                      onScaleChange={setScale}
                      className="h-full"
                      showToolbar={true}
                      overlayContent={
                        <>
                          {templateFields
                            ?.filter(field => field.page_number === currentPage)
                            .map((field) => {
                              const isCompleted = field.field_type === "signature" 
                                ? signatures[field.id] 
                                : fieldValues[field.id];
                              
                              return (
                                <div
                                  key={field.id}
                                  onClick={() => handleFieldClick(field.id)}
                                  className={`absolute border-2 rounded-lg cursor-pointer flex items-center justify-center text-xs font-medium transition-all duration-200 hover:scale-105 ${
                                    isCompleted
                                      ? "border-green-400 bg-green-100/90 text-green-700"
                                      : field.is_required
                                      ? "border-red-400 bg-red-100/90 text-red-700 animate-pulse"
                                      : "border-blue-400 bg-blue-100/90 text-blue-700"
                                  }`}
                                  style={{
                                    left: field.x_position * scale,
                                    top: field.y_position * scale,
                                    width: field.width * scale,
                                    height: field.height * scale,
                                    zIndex: 10
                                  }}
                                  title={`${field.field_name}${field.is_required ? ' (Required)' : ''}`}
                                >
                                  {isCompleted ? (
                                    <CheckCircle2 className="h-4 w-4" />
                                  ) : (
                                    <>
                                      {field.field_type === "signature" ? <PenTool className="h-3 w-3" /> : 
                                       field.field_type === "checkbox" ? "☐" :
                                       field.field_type === "date" ? <Calendar className="h-3 w-3" /> : "📝"}
                                      <span className="ml-1 truncate text-[10px]">
                                        {field.field_name}
                                      </span>
                                    </>
                                  )}
                                </div>
                              );
                            })}
                        </>
                      }
                    />
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Fields Summary Card */}
            <Card className="shadow-xl border-0 bg-white/80 backdrop-blur-sm">
              <CardHeader className="bg-gradient-to-r from-accent/5 to-primary/5">
                <CardTitle className="flex items-center gap-2">
                  <User className="h-5 w-5" />
                  Required Information
                </CardTitle>
              </CardHeader>
              <CardContent className="p-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {templateFields?.filter(field => field.is_required).map((field) => {
                    const isCompleted = field.field_type === "signature" 
                      ? signatures[field.id] 
                      : fieldValues[field.id];
                    
                    return (
                      <Button
                        key={field.id}
                        variant={isCompleted ? "default" : "outline"}
                        onClick={() => handleFieldClick(field.id)}
                        className={`h-auto p-3 justify-start gap-2 ${
                          isCompleted 
                            ? "bg-green-600 hover:bg-green-700" 
                            : "border-red-200 hover:border-red-300"
                        }`}
                      >
                        {isCompleted ? (
                          <CheckCircle2 className="h-4 w-4" />
                        ) : (
                          <div className="h-4 w-4 rounded-full border-2 border-current" />
                        )}
                        <div className="text-left">
                          <div className="font-medium text-sm">{field.field_name}</div>
                          <div className="text-xs opacity-70">
                            {field.field_type === "signature" ? "Signature required" : "Information required"}
                          </div>
                        </div>
                      </Button>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          </div>
        ) : (
          /* Desktop Layout */
          <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
            {/* PDF Viewer */}
            <div className="lg:col-span-3">
              <Card className="shadow-xl border-0 bg-white/80 backdrop-blur-sm h-[800px]">
                <CardHeader className="bg-gradient-to-r from-primary/5 to-accent/5 pb-4">
                  <CardTitle className="flex items-center gap-2">
                    <Eye className="h-5 w-5" />
                    Document Review
                  </CardTitle>
                  <p className="text-sm text-muted-foreground">
                    Click on highlighted fields to complete them
                  </p>
                </CardHeader>
                <CardContent className="h-full p-0">
                  {pdfUrl && (
                    <EnhancedPDFViewer
                      pdfUrl={pdfUrl}
                      currentPage={currentPage}
                      onPageChange={setCurrentPage}
                      scale={scale}
                      onScaleChange={setScale}
                      className="h-full"
                      showToolbar={true}
                      overlayContent={
                        <>
                          {templateFields
                            ?.filter(field => field.page_number === currentPage)
                            .map((field) => {
                              const isCompleted = field.field_type === "signature" 
                                ? signatures[field.id] 
                                : fieldValues[field.id];
                              
                              return (
                                <div
                                  key={field.id}
                                  onClick={() => handleFieldClick(field.id)}
                                  className={`absolute border-2 rounded-lg cursor-pointer flex items-center justify-center text-xs font-medium transition-all duration-200 hover:scale-105 hover:shadow-lg ${
                                    isCompleted
                                      ? "border-green-400 bg-green-100/90 text-green-700 shadow-green-200/50"
                                      : field.is_required
                                      ? "border-red-400 bg-red-100/90 text-red-700 animate-pulse"
                                      : "border-blue-400 bg-blue-100/90 text-blue-700"
                                  }`}
                                  style={{
                                    left: field.x_position * scale,
                                    top: field.y_position * scale,
                                    width: field.width * scale,
                                    height: field.height * scale,
                                    zIndex: 10
                                  }}
                                  title={`${field.field_name}${field.is_required ? ' (Required)' : ''}`}
                                >
                                  {isCompleted ? (
                                    <CheckCircle2 className="h-4 w-4" />
                                  ) : (
                                    <>
                                      {field.field_type === "signature" ? <PenTool className="h-4 w-4" /> : 
                                       field.field_type === "checkbox" ? "☐" :
                                       field.field_type === "date" ? <Calendar className="h-4 w-4" /> : "📝"}
                                      <span className="ml-1 truncate">
                                        {field.field_name}
                                      </span>
                                    </>
                                  )}
                                </div>
                              );
                            })}
                        </>
                      }
                    />
                  )}
                </CardContent>
              </Card>
            </div>

            {/* Form Fields Sidebar */}
            <div className="lg:col-span-1">
              <Card className="sticky top-4 shadow-xl border-0 bg-white/80 backdrop-blur-sm">
                <CardHeader className="bg-gradient-to-r from-accent/5 to-primary/5">
                  <CardTitle className="flex items-center gap-2">
                    <User className="h-5 w-5" />
                    Complete the Form
                  </CardTitle>
                  <p className="text-sm text-muted-foreground">
                    Fill in all required fields to sign the document
                  </p>
                </CardHeader>
                <CardContent className="space-y-4 max-h-[600px] overflow-y-auto">
                  {/* Quick Status Overview */}
                  <div className="grid grid-cols-3 gap-2 mb-4">
                    <div className="text-center p-2 bg-green-50 rounded-lg border border-green-200">
                      <div className="text-lg font-bold text-green-600">{completedRequiredFields.length}</div>
                      <div className="text-xs text-green-600">Completed</div>
                    </div>
                    <div className="text-center p-2 bg-orange-50 rounded-lg border border-orange-200">
                      <div className="text-lg font-bold text-orange-600">{requiredFields.length - completedRequiredFields.length}</div>
                      <div className="text-xs text-orange-600">Remaining</div>
                    </div>
                    <div className="text-center p-2 bg-blue-50 rounded-lg border border-blue-200">
                      <div className="text-lg font-bold text-blue-600">{templateFields?.length || 0}</div>
                      <div className="text-xs text-blue-600">Total Fields</div>
                    </div>
                  </div>

                  <Separator />

                  {/* Field List */}
                  {templateFields && templateFields.length > 0 ? (
                    <div className="space-y-3">
                      {templateFields.filter(field => field.is_required).map((field) => {
                        const isCompleted = field.field_type === "signature" 
                          ? signatures[field.id] 
                          : fieldValues[field.id];
                        
                        return (
                          <div 
                            key={field.id} 
                            className={`p-3 rounded-lg border-2 transition-all duration-200 cursor-pointer hover:shadow-md ${
                              isCompleted 
                                ? "border-green-300 bg-green-50" 
                                : "border-red-300 bg-red-50 animate-pulse"
                            }`}
                            onClick={() => {
                              setCurrentPage(field.page_number);
                              handleFieldClick(field.id);
                            }}
                          >
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-2">
                                {isCompleted ? (
                                  <CheckCircle2 className="h-4 w-4 text-green-600" />
                                ) : (
                                  <div className="h-4 w-4 rounded-full border-2 border-red-400" />
                                )}
                                <div>
                                  <div className="font-medium text-sm">{field.field_name}</div>
                                  <div className="text-xs text-muted-foreground">
                                    Page {field.page_number} • {field.field_type}
                                  </div>
                                </div>
                              </div>
                              {!isCompleted && <span className="text-red-500 text-xs font-bold">Required</span>}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <p className="text-muted-foreground text-sm text-center py-4">No form fields found for this document.</p>
                  )}

                  <Separator />

                  {/* Action Buttons */}
                  <div className="space-y-3">
                    <Button
                      onClick={handleSubmit}
                      disabled={completeSigning.isPending || !isFormComplete || isSigningInProgress}
                      className="w-full h-12 text-base font-semibold bg-gradient-to-r from-green-600 to-green-700 hover:from-green-700 hover:to-green-800"
                      size="lg"
                    >
                      {completeSigning.isPending ? (
                        <>
                          <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                          Signing Document...
                        </>
                      ) : isFormComplete ? (
                        <>
                          <PenTool className="mr-2 h-5 w-5" />
                          Sign Document
                        </>
                      ) : (
                        <>
                          Complete {requiredFields.length - completedRequiredFields.length} more field{requiredFields.length - completedRequiredFields.length !== 1 ? 's' : ''}
                        </>
                      )}
                    </Button>
                    
                    <Button
                      variant="outline"
                      onClick={() => navigate("/")}
                      className="w-full"
                      disabled={completeSigning.isPending}
                    >
                      Cancel Signing
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        )}

        {/* Field Modal for Mobile/Focus Mode */}
        <Dialog open={showFieldModal} onOpenChange={closeFieldModal}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                {selectedFieldData?.field_type === "signature" ? (
                  <PenTool className="h-5 w-5" />
                ) : selectedFieldData?.field_type === "checkbox" ? (
                  "☐"
                ) : selectedFieldData?.field_type === "date" ? (
                  <Calendar className="h-5 w-5" />
                ) : (
                  "📝"
                )}
                {selectedFieldData?.field_name}
                {selectedFieldData?.is_required && <Badge variant="destructive">Required</Badge>}
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              {selectedFieldData && (
                <>
                  <div className="text-sm text-muted-foreground">
                    Page {selectedFieldData.page_number} • {selectedFieldData.field_type}
                    {selectedFieldData.placeholder_text && (
                      <div className="mt-1 text-xs italic">"{selectedFieldData.placeholder_text}"</div>
                    )}
                  </div>

                  {selectedFieldData.field_type === "signature" ? (
                    <div className="space-y-3">
                      <Label>Please sign below:</Label>
                      <div className="border border-dashed border-gray-300 rounded-lg p-4 bg-white">
                        <SignatureCanvas
                          ref={(ref) => (signatureRefs.current[selectedFieldData.id] = ref)}
                          canvasProps={{
                            width: 350,
                            height: 150,
                            className: "w-full h-32 border rounded",
                          }}
                          onEnd={() => handleSignature(selectedFieldData.id)}
                        />
                      </div>
                      <div className="flex gap-2">
                        <Button
                          variant="outline"
                          onClick={() => clearSignature(selectedFieldData.id)}
                          className="flex-1"
                        >
                          <RotateCcw className="h-4 w-4 mr-2" />
                          Clear
                        </Button>
                        <Button
                          onClick={() => {
                            handleSignature(selectedFieldData.id);
                            closeFieldModal();
                          }}
                          className="flex-1"
                          disabled={!signatureRefs.current[selectedFieldData.id]}
                        >
                          <CheckCircle2 className="h-4 w-4 mr-2" />
                          Confirm
                        </Button>
                      </div>
                    </div>
                  ) : selectedFieldData.field_type === "checkbox" ? (
                    <div className="space-y-3">
                      <div className="flex items-center space-x-3">
                        <Checkbox
                          id={selectedFieldData.id}
                          checked={fieldValues[selectedFieldData.id] === "true"}
                          onCheckedChange={(checked) => {
                            handleFieldChange(selectedFieldData.id, checked.toString());
                            setTimeout(closeFieldModal, 300);
                          }}
                          className="w-5 h-5"
                        />
                        <Label htmlFor={selectedFieldData.id} className="text-base">
                          {selectedFieldData.placeholder_text || "Check if applicable"}
                        </Label>
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      <Label>Enter information:</Label>
                      <Input
                        type={selectedFieldData.field_type === "date" ? "date" : "text"}
                        value={fieldValues[selectedFieldData.id] || ""}
                        onChange={(e) => handleFieldChange(selectedFieldData.id, e.target.value)}
                        placeholder={selectedFieldData.placeholder_text || `Enter ${selectedFieldData.field_name.toLowerCase()}`}
                        className="text-base"
                        autoFocus
                      />
                      <Button
                        onClick={closeFieldModal}
                        className="w-full"
                        disabled={selectedFieldData.is_required && !fieldValues[selectedFieldData.id]}
                      >
                        <CheckCircle2 className="h-4 w-4 mr-2" />
                        Confirm
                      </Button>
                    </div>
                  )}
                </>
              )}
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}