import { useState } from 'react';

import { msg } from '@lingui/core/macro';
import { useLingui } from '@lingui/react';
import { Trans } from '@lingui/react/macro';
import { DocumentStatus } from '@prisma/client';
import { Bell, BellOff, Loader } from 'lucide-react';

import type { TDocumentMany as TDocumentRow } from '@documenso/lib/types/document';
import { Badge } from '@documenso/ui/primitives/badge';
import { Button } from '@documenso/ui/primitives/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@documenso/ui/primitives/dialog';
import { DropdownMenuItem } from '@documenso/ui/primitives/dropdown-menu';
import { useToast } from '@documenso/ui/primitives/use-toast';

export interface DocumentReminderDialogProps {
  document: TDocumentRow;
  trigger?: React.ReactNode;
}

export const DocumentReminderDialog = ({ document, trigger }: DocumentReminderDialogProps) => {
  const { _ } = useLingui();
  const { toast } = useToast();
  const [isOpen, setIsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  // Mock reminder state - this would come from TRPC query
  const [reminderEnabled, setReminderEnabled] = useState(false);
  const [reminderCount, setReminderCount] = useState(0);
  const maxReminders = 10;

  const isPending = document.status === DocumentStatus.PENDING;
  const pendingRecipients = document.recipients.filter(r => r.signingStatus !== 'SIGNED');

  const handleToggleReminders = async () => {
    setIsLoading(true);
    
    try {
      // Mock API call - this would be replaced with TRPC mutation
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      setReminderEnabled(!reminderEnabled);
      
      toast({
        title: reminderEnabled ? _(msg`Reminders stopped`) : _(msg`Reminders enabled`),
        description: reminderEnabled 
          ? _(msg`Automatic reminders have been stopped for this document`)
          : _(msg`Recipients will receive reminders every 4 days until signing`),
      });
      
      setIsOpen(false);
    } catch (error) {
      toast({
        title: _(msg`Something went wrong`),
        description: _(msg`Unable to update reminder settings`),
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  const defaultTrigger = (
    <DropdownMenuItem disabled={!isPending || pendingRecipients.length === 0} onSelect={(e) => e.preventDefault()}>
      {reminderEnabled ? (
        <>
          <BellOff className="mr-2 h-4 w-4" />
          <Trans>Stop Reminders</Trans>
        </>
      ) : (
        <>
          <Bell className="mr-2 h-4 w-4" />
          <Trans>Enable Reminders</Trans>
        </>
      )}
    </DropdownMenuItem>
  );

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        {trigger || defaultTrigger}
      </DialogTrigger>

      <DialogContent className="w-full max-w-md">
        <DialogHeader>
          <DialogTitle>
            <Trans>Document Reminders</Trans>
          </DialogTitle>
          <DialogDescription>
            <Trans>Manage automatic email reminders for pending signatures</Trans>
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="rounded-lg border p-4">
            <div className="flex items-center justify-between">
              <div>
                <h4 className="font-medium">
                  <Trans>Automatic Reminders</Trans>
                </h4>
                <p className="text-muted-foreground text-sm">
                  <Trans>Send reminders every 4 days until signed</Trans>
                </p>
              </div>
              <Badge variant={reminderEnabled ? 'default' : 'secondary'}>
                {reminderEnabled ? _(msg`Active`) : _(msg`Disabled`)}
              </Badge>
            </div>

            {reminderEnabled && (
              <div className="mt-3 text-sm text-muted-foreground">
                <p>
                  <Trans>
                    Reminders sent: {reminderCount}/{maxReminders}
                  </Trans>
                </p>
                <p>
                  <Trans>
                    Pending recipients: {pendingRecipients.length}
                  </Trans>
                </p>
              </div>
            )}
          </div>

          <div className="flex gap-3">
            <Button
              type="button"
              variant="outline"
              className="flex-1"
              onClick={() => setIsOpen(false)}
            >
              <Trans>Cancel</Trans>
            </Button>
            
            <Button
              type="button"
              className="flex-1"
              onClick={handleToggleReminders}
              disabled={isLoading}
            >
              {isLoading && <Loader className="mr-2 h-4 w-4 animate-spin" />}
              {reminderEnabled ? _(msg`Stop Reminders`) : _(msg`Enable Reminders`)}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}; 