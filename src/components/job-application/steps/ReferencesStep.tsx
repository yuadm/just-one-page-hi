import { References, EmploymentHistory } from '../types';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

interface ReferencesStepProps {
  data: References;
  employmentHistory: EmploymentHistory;
  updateData: (field: keyof References, value: any) => void;
}

export function ReferencesStep({ data, employmentHistory, updateData }: ReferencesStepProps) {
  const updateReference = (refNumber: 'reference1' | 'reference2', field: string, value: string) => {
    updateData(refNumber, { ...data[refNumber], [field]: value });
  };

  // Count employers to determine reference types
  const countEmployers = () => {
    let count = 0;
    
    // Count recent employer if present
    if (employmentHistory.recentEmployer?.company?.trim() || employmentHistory.recentEmployer?.name?.trim()) {
      count += 1;
    }
    
    // Count previous employers
    if (employmentHistory.previousEmployers?.length) {
      count += employmentHistory.previousEmployers.filter(emp => 
        emp.company?.trim() || emp.name?.trim()
      ).length;
    }
    
    return count;
  };

  const employerCount = countEmployers();
  
  // Determine reference types based on employer count
  const getReferenceType = (refNumber: 'reference1' | 'reference2') => {
    if (employerCount >= 2) {
      return 'Employer Reference';
    } else if (employerCount === 1) {
      return refNumber === 'reference1' ? 'Employer Reference' : 'Character Reference';
    } else {
      return 'Character Reference';
    }
  };

  const getHelperText = () => {
    if (employerCount >= 2) {
      return 'Please provide two professional references from previous employers.';
    } else if (employerCount === 1) {
      return 'Please provide one professional reference from your previous employer and one character reference.';
    } else {
      return 'Please provide two character references.';
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-semibold mb-4">References</h3>
        <p className="text-muted-foreground mb-6">
          {getHelperText()}
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>{getReferenceType('reference1')} 1 ** All fields are required</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label>Name *</Label>
              <Input
                value={data.reference1?.name || ''}
                onChange={(e) => updateReference('reference1', 'name', e.target.value)}
                placeholder="Name"
                required
              />
            </div>
            <div>
              <Label>Company *</Label>
              <Input
                value={data.reference1?.company || ''}
                onChange={(e) => updateReference('reference1', 'company', e.target.value)}
                placeholder="Company"
                required
              />
            </div>
            <div>
              <Label>Job Title *</Label>
              <Input
                value={data.reference1?.jobTitle || ''}
                onChange={(e) => updateReference('reference1', 'jobTitle', e.target.value)}
                placeholder="Job Title"
                required
              />
            </div>
            <div>
              <Label>Email *</Label>
              <Input
                type="email"
                value={data.reference1?.email || ''}
                onChange={(e) => updateReference('reference1', 'email', e.target.value)}
                placeholder="Email"
                required
              />
            </div>
            <div>
              <Label>Address *</Label>
              <Input
                value={data.reference1?.address || ''}
                onChange={(e) => updateReference('reference1', 'address', e.target.value)}
                placeholder="Address"
                required
              />
            </div>
            <div>
              <Label>Address2</Label>
              <Input
                value={data.reference1?.address2 || ''}
                onChange={(e) => updateReference('reference1', 'address2', e.target.value)}
                placeholder="Address2"
              />
            </div>
            <div>
              <Label>Town *</Label>
              <Input
                value={data.reference1?.town || ''}
                onChange={(e) => updateReference('reference1', 'town', e.target.value)}
                placeholder="Town"
                required
              />
            </div>
            <div>
              <Label>Contact Number *</Label>
              <Input
                type="tel"
                value={data.reference1?.contactNumber || ''}
                onChange={(e) => {
                  const value = e.target.value.replace(/[^0-9]/g, '');
                  updateReference('reference1', 'contactNumber', value);
                }}
                placeholder="Contact Number"
                required
              />
            </div>
            <div>
              <Label>Postcode *</Label>
              <Input
                value={data.reference1?.postcode || ''}
                onChange={(e) => updateReference('reference1', 'postcode', e.target.value)}
                placeholder="Postcode"
                required
              />
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{getReferenceType('reference2')} 2 ** All fields are required</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label>Name *</Label>
              <Input
                value={data.reference2?.name || ''}
                onChange={(e) => updateReference('reference2', 'name', e.target.value)}
                placeholder="Name"
                required
              />
            </div>
            <div>
              <Label>Company *</Label>
              <Input
                value={data.reference2?.company || ''}
                onChange={(e) => updateReference('reference2', 'company', e.target.value)}
                placeholder="Company"
                required
              />
            </div>
            <div>
              <Label>Job Title *</Label>
              <Input
                value={data.reference2?.jobTitle || ''}
                onChange={(e) => updateReference('reference2', 'jobTitle', e.target.value)}
                placeholder="Job Title"
                required
              />
            </div>
            <div>
              <Label>Email *</Label>
              <Input
                type="email"
                value={data.reference2?.email || ''}
                onChange={(e) => updateReference('reference2', 'email', e.target.value)}
                placeholder="Email"
                required
              />
            </div>
            <div>
              <Label>Address *</Label>
              <Input
                value={data.reference2?.address || ''}
                onChange={(e) => updateReference('reference2', 'address', e.target.value)}
                placeholder="Address"
                required
              />
            </div>
            <div>
              <Label>Address2</Label>
              <Input
                value={data.reference2?.address2 || ''}
                onChange={(e) => updateReference('reference2', 'address2', e.target.value)}
                placeholder="Address2"
              />
            </div>
            <div>
              <Label>Town *</Label>
              <Input
                value={data.reference2?.town || ''}
                onChange={(e) => updateReference('reference2', 'town', e.target.value)}
                placeholder="Town"
                required
              />
            </div>
            <div>
              <Label>Contact Number *</Label>
              <Input
                type="tel"
                value={data.reference2?.contactNumber || ''}
                onChange={(e) => {
                  const value = e.target.value.replace(/[^0-9]/g, '');
                  updateReference('reference2', 'contactNumber', value);
                }}
                placeholder="Contact Number"
                required
              />
            </div>
            <div>
              <Label>Postcode *</Label>
              <Input
                value={data.reference2?.postcode || ''}
                onChange={(e) => updateReference('reference2', 'postcode', e.target.value)}
                placeholder="Postcode"
                required
              />
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}