
import { useEffect, useState } from 'react';
import { useEmployeeAuth } from '@/contexts/EmployeeAuthContext';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Calendar, FileText, User, LogOut, Clock, CheckCircle, XCircle, Shield } from 'lucide-react';
import { LeaveRequestDialog } from '@/components/employee/LeaveRequestDialog';
import { DocumentUploadDialog } from '@/components/employee/DocumentUploadDialog';
import { CompanyProvider, useCompany } from '@/contexts/CompanyContext';

interface LeaveRequest {
  id: string;
  start_date: string;
  end_date: string;
  status: string;
  notes: string;
  leave_type: { name: string };
  created_at: string;
}

function EmployeeDashboardContent() {
  const { employee, loading, signOut } = useEmployeeAuth();
  const { companySettings } = useCompany();
  const navigate = useNavigate();
  const [leaveRequests, setLeaveRequests] = useState<LeaveRequest[]>([]);
  const [showLeaveDialog, setShowLeaveDialog] = useState(false);
  const [showDocumentDialog, setShowDocumentDialog] = useState(false);

  useEffect(() => {
    if (!loading && !employee) {
      navigate('/employee-login');
      return;
    }
    if (employee) {
      fetchLeaveRequests();
    }
  }, [employee, loading, navigate]);

  const fetchLeaveRequests = async () => {
    if (!employee) return;
    
    try {
      // Fetch leave requests
      const { data: leaveData, error: leaveError } = await supabase
        .from('leave_requests')
        .select(`
          *,
          leave_type:leave_types(name)
        `)
        .eq('employee_id', employee.id)
        .order('created_at', { ascending: false });

      if (leaveError) throw leaveError;
      setLeaveRequests(leaveData || []);

    } catch (error) {
      console.error('Error fetching leave requests:', error);
    }
  };

  const handleSignOut = async () => {
    await signOut();
    navigate('/employee-login');
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'approved': return 'default';
      case 'pending': return 'secondary';
      case 'rejected': return 'destructive';
      default: return 'secondary';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'approved': return <CheckCircle className="w-4 h-4" />;
      case 'pending': return <Clock className="w-4 h-4" />;
      case 'rejected': return <XCircle className="w-4 h-4" />;
      default: return <Clock className="w-4 h-4" />;
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-lg">Loading...</div>
      </div>
    );
  }

  if (!employee) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-xl font-semibold mb-2">Employee Profile Not Found</h2>
          <p className="text-muted-foreground mb-4">Please contact your administrator to set up your employee profile.</p>
          <Button onClick={handleSignOut}>Sign Out</Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary/5 to-secondary/5">
      {/* Header */}
      <header className="bg-white border-b border-border/50 px-6 py-4">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-3">
              {companySettings.logo ? (
                <img
                  src={companySettings.logo}
                  alt={companySettings.name}
                  className="h-10 w-10 object-contain"
                />
              ) : (
                <div className="h-10 w-10 bg-primary/10 rounded-lg flex items-center justify-center">
                  <Shield className="h-6 w-6 text-primary" />
                </div>
              )}
              <div>
                <h1 className="text-xl font-bold">{companySettings.name}</h1>
                <p className="text-sm text-muted-foreground">{companySettings.tagline}</p>
              </div>
            </div>
            <div className="border-l pl-4 ml-4">
              <h2 className="text-lg font-semibold">Employee Dashboard</h2>
              <p className="text-sm text-muted-foreground">Welcome back, {employee.name}!</p>
            </div>
          </div>
          <Button variant="outline" onClick={handleSignOut}>
            <LogOut className="w-4 h-4 mr-2" />
            Sign Out
          </Button>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto p-6 space-y-6">
        {/* Quick Stats */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Leave Allowance</p>
                  <p className="text-2xl font-bold">{employee.leave_allowance}</p>
                </div>
                <Calendar className="w-8 h-8 text-primary" />
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Leave Taken</p>
                  <p className="text-2xl font-bold">{employee.leave_taken}</p>
                </div>
                <Clock className="w-8 h-8 text-warning" />
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Remaining Leave</p>
                  <p className="text-2xl font-bold">{employee.remaining_leave_days}</p>
                </div>
                <CheckCircle className="w-8 h-8 text-success" />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Personal Information */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <User className="w-5 h-5" />
              Personal Information
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <p className="text-sm text-muted-foreground">Name</p>
                <p className="font-medium">{employee.name}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Email</p>
                <p className="font-medium">{employee.email}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Employee Code</p>
                <p className="font-medium">{employee.employee_code}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Branch</p>
                <p className="font-medium">{employee.branch}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Job Title</p>
                <p className="font-medium">{employee.job_title}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Employee Type</p>
                <p className="font-medium">{employee.employee_type}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Leave Management */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Calendar className="w-5 h-5" />
                Leave Management
              </div>
              <div className="flex gap-2">
                <Button onClick={() => setShowLeaveDialog(true)}>
                  Request Leave
                </Button>
                <Button variant="outline" onClick={() => setShowDocumentDialog(true)}>
                  <FileText className="w-4 h-4 mr-2" />
                  Upload Document
                </Button>
              </div>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {leaveRequests.length === 0 ? (
                <p className="text-muted-foreground text-center py-8">No leave requests found.</p>
              ) : (
                leaveRequests.map((leave) => (
                  <div key={leave.id} className="flex items-center justify-between p-4 border rounded-lg">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="font-medium">{leave.leave_type.name}</span>
                        <Badge variant={getStatusColor(leave.status)} className="flex items-center gap-1">
                          {getStatusIcon(leave.status)}
                          {leave.status}
                        </Badge>
                      </div>
                      <p className="text-sm text-muted-foreground">
                        {new Date(leave.start_date).toLocaleDateString()} - {new Date(leave.end_date).toLocaleDateString()}
                      </p>
                      {leave.notes && (
                        <p className="text-sm text-muted-foreground mt-1">{leave.notes}</p>
                      )}
                    </div>
                    <div className="text-right">
                      <p className="text-sm text-muted-foreground">
                        Applied: {new Date(leave.created_at).toLocaleDateString()}
                      </p>
                    </div>
                  </div>
                ))
              )}
            </div>
          </CardContent>
        </Card>
      </main>

      {/* Dialogs */}
      <LeaveRequestDialog
        open={showLeaveDialog}
        onOpenChange={setShowLeaveDialog}
        employeeId={employee.id}
        onSuccess={fetchLeaveRequests}
      />
      
      <DocumentUploadDialog
        open={showDocumentDialog}
        onOpenChange={setShowDocumentDialog}
        employeeId={employee.id}
      />
    </div>
  );
}

export default function EmployeeDashboard() {
  return (
    <CompanyProvider>
      <EmployeeDashboardContent />
    </CompanyProvider>
  );
}
