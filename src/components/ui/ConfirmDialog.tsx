import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";

interface ConfirmDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description: string;
  /** Set for actions the backend requires a reason for (e.g. suspend). */
  requireReason?: boolean;
  /** Set for the most destructive actions (e.g. cancel) — user must type this exact phrase. */
  confirmPhrase?: string;
  confirmLabel?: string;
  variant?: "default" | "destructive";
  isPending?: boolean;
  onConfirm: (reason: string | undefined) => void;
}

export function ConfirmDialog({
  open,
  onOpenChange,
  title,
  description,
  requireReason = false,
  confirmPhrase,
  confirmLabel = "Confirm",
  variant = "default",
  isPending = false,
  onConfirm,
}: ConfirmDialogProps) {
  const [reason, setReason] = useState("");
  const [typedPhrase, setTypedPhrase] = useState("");

  const reasonSatisfied = !requireReason || reason.trim().length > 0;
  const phraseSatisfied = !confirmPhrase || typedPhrase === confirmPhrase;
  const canConfirm = reasonSatisfied && phraseSatisfied && !isPending;

  function handleOpenChange(next: boolean) {
    if (!next) {
      setReason("");
      setTypedPhrase("");
    }
    onOpenChange(next);
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {requireReason && (
            <div className="space-y-2">
              <Label htmlFor="confirm-reason">Reason (required)</Label>
              <Textarea
                id="confirm-reason"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="e.g. chargeback on invoice INV-002"
              />
            </div>
          )}

          {confirmPhrase && (
            <div className="space-y-2">
              <Label htmlFor="confirm-phrase">
                Type <span className="font-mono font-semibold">{confirmPhrase}</span> to confirm
              </Label>
              <Input
                id="confirm-phrase"
                value={typedPhrase}
                onChange={(e) => setTypedPhrase(e.target.value)}
                autoComplete="off"
              />
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => handleOpenChange(false)} disabled={isPending}>
            Cancel
          </Button>
          <Button
            variant={variant}
            disabled={!canConfirm}
            onClick={() => onConfirm(requireReason ? reason : undefined)}
          >
            {isPending ? "Working…" : confirmLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
