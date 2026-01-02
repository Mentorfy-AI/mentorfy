'use client';

import { useState } from 'react';
import { useOrganization } from '@clerk/nextjs';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '@/components/ui/tabs';
import {
  Plus,
  Mail,
  Upload,
  FileText,
  X,
  CheckCircle,
  AlertCircle,
  Loader2,
} from 'lucide-react';

export function InviteStudentButton() {
  const { organization } = useOrganization();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  // Individual email state
  const [emailInput, setEmailInput] = useState('');
  const [emailList, setEmailList] = useState<string[]>([]);

  // CSV upload state
  const [csvFile, setCsvFile] = useState<File | null>(null);
  const [csvPreview, setCsvPreview] = useState<string[]>([]);

  // UI state
  const [validationErrors, setValidationErrors] = useState<string[]>([]);
  const [successMessage, setSuccessMessage] = useState('');

  const validateEmail = (email: string) => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  };

  const handleAddEmail = () => {
    const email = emailInput.trim();
    if (!email) return;

    if (!validateEmail(email)) {
      setValidationErrors(['Please enter a valid email address']);
      return;
    }

    if (emailList.includes(email)) {
      setValidationErrors(['This email is already in the list']);
      return;
    }

    setEmailList([...emailList, email]);
    setEmailInput('');
    setValidationErrors([]);
  };

  const handleRemoveEmail = (emailToRemove: string) => {
    setEmailList(emailList.filter((email) => email !== emailToRemove));
  };

  const handleCsvUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (!file.name.endsWith('.csv')) {
      setValidationErrors(['Please upload a CSV file']);
      return;
    }

    setCsvFile(file);
    const reader = new FileReader();
    reader.onload = (e) => {
      const text = e.target?.result as string;
      const lines = text.split('\n').filter((line) => line.trim());
      const emails = lines
        .map((line) => line.split(',')[0].trim())
        .filter((email) => email);

      const invalidEmails = emails.filter((email) => !validateEmail(email));
      if (invalidEmails.length > 0) {
        setValidationErrors([
          `Invalid email addresses found: ${invalidEmails.slice(0, 3).join(', ')}${
            invalidEmails.length > 3 ? '...' : ''
          }`,
        ]);
        return;
      }

      setCsvPreview(emails);
      setValidationErrors([]);
    };
    reader.readAsText(file);
  };

  const handleInviteUsers = async () => {
    if (!organization) {
      setValidationErrors(['No active organization']);
      return;
    }

    const allEmails = [...emailList, ...csvPreview];
    if (allEmails.length === 0) {
      setValidationErrors(['Please add at least one email address']);
      return;
    }

    setLoading(true);
    setValidationErrors([]);

    try {
      // Send invitations via API route (server-side Clerk SDK)
      const response = await fetch('/api/organizations/invitations', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          emails: allEmails,
          role: 'org:student',
        }),
      });

      const data = await response.json();

      console.log('[INVITE] Response status:', response.status);
      console.log('[INVITE] Response data:', data);

      if (!response.ok) {
        console.error('[INVITE] Error response:', data);
        setValidationErrors([data.error || 'Failed to send invitations']);
        return;
      }

      const { results } = data;

      if (!results) {
        console.error('[INVITE] No results in response:', data);
        setValidationErrors(['Invalid response from server']);
        return;
      }

      if (results.totalFailed === 0) {
        setSuccessMessage(
          `Successfully invited ${results.totalSent} user${results.totalSent > 1 ? 's' : ''}!`
        );
        resetModalState();
        setTimeout(() => {
          setOpen(false);
          setSuccessMessage('');
        }, 2000);
      } else {
        const successCount = results.totalSent;
        const failureCount = results.totalFailed;

        console.warn('[INVITE] Some failures:', results.failed);

        // Build detailed error messages
        const errorMessages: string[] = [];

        if (successCount > 0) {
          errorMessages.push(
            `${successCount} invitation${successCount !== 1 ? 's' : ''} sent successfully.`
          );
        }

        if (failureCount > 0) {
          // Show the first specific error message
          const firstError = results.failed[0];
          if (firstError && firstError.error) {
            errorMessages.push(firstError.error);
          } else {
            errorMessages.push(`${failureCount} invitation${failureCount !== 1 ? 's' : ''} failed.`);
          }
        }

        setValidationErrors(errorMessages);
      }
    } catch (error) {
      console.error('Failed to invite users:', error);
      setValidationErrors(['Failed to send invitations. Please try again.']);
    } finally {
      setLoading(false);
    }
  };

  const resetModalState = () => {
    setEmailList([]);
    setCsvPreview([]);
    setCsvFile(null);
    setEmailInput('');
    setValidationErrors([]);
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(isOpen) => {
        setOpen(isOpen);
        if (!isOpen) {
          resetModalState();
          setSuccessMessage('');
        }
      }}
    >
      <DialogTrigger asChild>
        <Button className="bg-primary hover:bg-primary/90">
          <Plus className="h-4 w-4 mr-2" />
          Invite Users
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Mail className="h-5 w-5" />
            Invite Users to {organization?.name}
          </DialogTitle>
          <DialogDescription>
            Send invitation emails to users. They will receive a link to join
            your organization.
          </DialogDescription>
        </DialogHeader>

        {successMessage && (
          <Alert className="border-green-200 bg-green-50">
            <CheckCircle className="h-4 w-4 text-green-600" />
            <AlertDescription className="text-green-800">
              {successMessage}
            </AlertDescription>
          </Alert>
        )}

        {validationErrors.length > 0 && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              {validationErrors.map((error, index) => (
                <div key={index}>{error}</div>
              ))}
            </AlertDescription>
          </Alert>
        )}

        <Tabs defaultValue="individual" className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="individual" className="flex items-center gap-2">
              <Mail className="h-4 w-4" />
              Individual Emails
            </TabsTrigger>
            <TabsTrigger value="csv" className="flex items-center gap-2">
              <Upload className="h-4 w-4" />
              CSV Upload
            </TabsTrigger>
          </TabsList>

          <TabsContent value="individual" className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">Email Address</Label>
              <div className="flex gap-2">
                <Input
                  id="email"
                  type="email"
                  placeholder="user@example.com"
                  value={emailInput}
                  onChange={(e) => setEmailInput(e.target.value)}
                  onKeyPress={(e) => e.key === 'Enter' && handleAddEmail()}
                  disabled={loading}
                />
                <Button
                  onClick={handleAddEmail}
                  variant="outline"
                  disabled={loading}
                >
                  <Plus className="h-4 w-4" />
                </Button>
              </div>
              <p className="text-sm text-muted-foreground">
                Enter email addresses one at a time. Press Enter or click + to add.
              </p>
            </div>

            {emailList.length > 0 && (
              <div className="space-y-2">
                <Label>Added Emails ({emailList.length})</Label>
                <div className="max-h-40 overflow-y-auto border rounded-lg p-3 space-y-2">
                  {emailList.map((email, index) => (
                    <div
                      key={index}
                      className="flex items-center justify-between bg-muted/50 rounded px-3 py-2"
                    >
                      <span className="text-sm">{email}</span>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleRemoveEmail(email)}
                        disabled={loading}
                      >
                        <X className="h-3 w-3" />
                      </Button>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </TabsContent>

          <TabsContent value="csv" className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="csv-file">CSV File</Label>
              <div className="border-2 border-dashed border-muted-foreground/25 rounded-lg p-8">
                <Input
                  id="csv-file"
                  type="file"
                  accept=".csv"
                  onChange={handleCsvUpload}
                  className="hidden"
                  disabled={loading}
                />
                <Label htmlFor="csv-file" className="cursor-pointer flex flex-col items-center gap-3">
                  <FileText className="h-12 w-12 text-muted-foreground" />
                  <div className="text-center space-y-1">
                    <div className="text-sm font-medium">
                      Click to upload CSV file
                    </div>
                    <div className="text-xs text-muted-foreground">
                      CSV should have emails (column 1), first names (column 2), and last names (column 3)
                    </div>
                  </div>
                </Label>
              </div>
            </div>

            <div className="bg-muted/50 rounded-lg p-4 space-y-2">
              <h4 className="text-sm font-medium flex items-center gap-2">
                <FileText className="h-4 w-4" />
                CSV Format Requirements
              </h4>
              <ul className="text-xs text-muted-foreground space-y-1">
                <li>• First column: Email addresses (required)</li>
                <li>• Second column: First name (optional)</li>
                <li>• Third column: Last name (optional)</li>
                <li>• One user per row</li>
                <li>• Example: user1@email.com,John,Doe</li>
              </ul>
            </div>

            {csvPreview.length > 0 && (
              <div className="space-y-2">
                <Label>Preview ({csvPreview.length} emails found)</Label>
                <div className="max-h-40 overflow-y-auto border rounded-lg p-3">
                  {csvPreview.slice(0, 10).map((email, index) => (
                    <div
                      key={index}
                      className="text-sm py-1 border-b last:border-b-0"
                    >
                      {email}
                    </div>
                  ))}
                  {csvPreview.length > 10 && (
                    <div className="text-xs text-muted-foreground pt-2">
                      ... and {csvPreview.length - 10} more
                    </div>
                  )}
                </div>
              </div>
            )}
          </TabsContent>
        </Tabs>

        <div className="flex justify-end gap-2 pt-4 border-t">
          <Button
            variant="outline"
            onClick={() => setOpen(false)}
            disabled={loading}
          >
            Cancel
          </Button>
          <Button
            onClick={handleInviteUsers}
            disabled={
              loading || (emailList.length === 0 && csvPreview.length === 0)
            }
          >
            {loading ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Sending...
              </>
            ) : (
              <>
                Invite {emailList.length + csvPreview.length} User
                {emailList.length + csvPreview.length !== 1 ? 's' : ''}
              </>
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
