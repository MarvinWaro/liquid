import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { ArrowRight, History, ShieldAlert } from 'lucide-react';

export interface RegionSummary {
    id: string;
    code: string;
    name: string;
}

export interface HEIRegionTransfer {
    id: string;
    from_region: RegionSummary | null;
    to_region: RegionSummary | null;
    effective_date: string;
    memo_reference: string | null;
    reason: string;
    transferred_by: { id: string; name: string } | string | null;
    created_at: string;
}

interface HEIRegionTransferPanelProps {
    showTransferForm: boolean;
    currentRegion?: RegionSummary | null;
    targetRegion?: RegionSummary;
    effectiveDate: string;
    reason: string;
    memoReference: string;
    errors: {
        transfer_effective_date?: string;
        transfer_reason?: string;
        transfer_memo_reference?: string;
    };
    transfers: HEIRegionTransfer[];
    onEffectiveDateChange: (value: string) => void;
    onReasonChange: (value: string) => void;
    onMemoReferenceChange: (value: string) => void;
}

function regionLabel(region: RegionSummary | null | undefined): string {
    return region ? `${region.name} (${region.code})` : 'Unassigned';
}

function formatDate(value: string): string {
    if (!value) return 'Not recorded';

    const dateOnly = value.slice(0, 10);
    const [year, month, day] = dateOnly.split('-').map(Number);
    const date = new Date(year, month - 1, day);
    return Number.isNaN(date.getTime())
        ? value
        : new Intl.DateTimeFormat('en-PH', {
              year: 'numeric',
              month: 'short',
              day: 'numeric',
          }).format(date);
}

function today(): string {
    const date = new Date();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');

    return `${date.getFullYear()}-${month}-${day}`;
}

export function HEIRegionTransferPanel({
    showTransferForm,
    currentRegion,
    targetRegion,
    effectiveDate,
    reason,
    memoReference,
    errors,
    transfers,
    onEffectiveDateChange,
    onReasonChange,
    onMemoReferenceChange,
}: HEIRegionTransferPanelProps) {
    return (
        <>
            {showTransferForm && (
                <div className="space-y-4 rounded-lg border border-amber-200 bg-amber-50/50 p-4 dark:border-amber-900/70 dark:bg-amber-950/20">
                    <Alert className="border-amber-300 bg-background/70 dark:border-amber-800">
                        <ShieldAlert className="text-amber-700 dark:text-amber-400" />
                        <AlertTitle>
                            Confirm official region transfer
                        </AlertTitle>
                        <AlertDescription>
                            <p>
                                Saving will immediately move this HEI from{' '}
                                <strong>{regionLabel(currentRegion)}</strong> to{' '}
                                <strong>{regionLabel(targetRegion)}</strong> for
                                new entries and official reporting. Historical
                                liquidations retain their original
                                processing-region access. This creates an
                                immutable audit record.
                            </p>
                        </AlertDescription>
                    </Alert>

                    <div className="grid gap-4 sm:grid-cols-2">
                        <div>
                            <Label htmlFor="transfer_effective_date">
                                Effective date *
                            </Label>
                            <Input
                                id="transfer_effective_date"
                                type="date"
                                required
                                max={today()}
                                value={effectiveDate}
                                onChange={(event) =>
                                    onEffectiveDateChange(event.target.value)
                                }
                                aria-invalid={Boolean(
                                    errors.transfer_effective_date,
                                )}
                                aria-describedby={
                                    errors.transfer_effective_date
                                        ? 'transfer_effective_date-error'
                                        : undefined
                                }
                                className={
                                    errors.transfer_effective_date
                                        ? 'border-red-500'
                                        : ''
                                }
                            />
                            {errors.transfer_effective_date && (
                                <p
                                    id="transfer_effective_date-error"
                                    className="mt-1 text-sm text-red-500"
                                >
                                    {errors.transfer_effective_date}
                                </p>
                            )}
                        </div>

                        <div>
                            <Label htmlFor="transfer_memo_reference">
                                Memo reference
                            </Label>
                            <Input
                                id="transfer_memo_reference"
                                value={memoReference}
                                onChange={(event) =>
                                    onMemoReferenceChange(event.target.value)
                                }
                                maxLength={255}
                                placeholder="e.g., Memorandum No. 2026-001"
                                aria-invalid={Boolean(
                                    errors.transfer_memo_reference,
                                )}
                                aria-describedby={
                                    errors.transfer_memo_reference
                                        ? 'transfer_memo_reference-error'
                                        : undefined
                                }
                                className={
                                    errors.transfer_memo_reference
                                        ? 'border-red-500'
                                        : ''
                                }
                            />
                            {errors.transfer_memo_reference && (
                                <p
                                    id="transfer_memo_reference-error"
                                    className="mt-1 text-sm text-red-500"
                                >
                                    {errors.transfer_memo_reference}
                                </p>
                            )}
                        </div>
                    </div>

                    <div>
                        <Label htmlFor="transfer_reason">
                            Transfer reason *
                        </Label>
                        <Textarea
                            id="transfer_reason"
                            required
                            value={reason}
                            onChange={(event) =>
                                onReasonChange(event.target.value)
                            }
                            maxLength={2000}
                            rows={4}
                            placeholder="Record the official reason for this transfer."
                            aria-invalid={Boolean(errors.transfer_reason)}
                            aria-describedby={
                                errors.transfer_reason
                                    ? 'transfer_reason-error'
                                    : undefined
                            }
                            className={
                                errors.transfer_reason ? 'border-red-500' : ''
                            }
                        />
                        <div className="mt-1 flex justify-between gap-4 text-xs">
                            <span
                                id="transfer_reason-error"
                                className="text-red-500"
                            >
                                {errors.transfer_reason}
                            </span>
                            <span className="ml-auto text-muted-foreground">
                                {reason.length}/2,000
                            </span>
                        </div>
                    </div>
                </div>
            )}

            {transfers.length > 0 && (
                <section className="space-y-3 border-t pt-4">
                    <div className="flex items-center gap-2">
                        <History className="h-4 w-4 text-muted-foreground" />
                        <div>
                            <h3 className="text-sm font-medium">
                                Region transfer history
                            </h3>
                            <p className="text-xs text-muted-foreground">
                                Permanent audit trail, newest transfer first.
                            </p>
                        </div>
                    </div>

                    <div className="max-h-64 space-y-3 overflow-y-auto pr-1">
                        {transfers.map((transfer) => {
                            const transferredBy =
                                transfer.transferred_by &&
                                typeof transfer.transferred_by === 'object'
                                    ? transfer.transferred_by.name
                                    : 'System';

                            return (
                                <article
                                    key={transfer.id}
                                    className="rounded-md border bg-muted/20 p-3 text-sm"
                                >
                                    <div className="flex flex-wrap items-center gap-2 font-medium">
                                        <span>
                                            {regionLabel(transfer.from_region)}
                                        </span>
                                        <ArrowRight className="h-3.5 w-3.5 text-muted-foreground" />
                                        <span>
                                            {regionLabel(transfer.to_region)}
                                        </span>
                                    </div>
                                    <div className="mt-1 text-xs text-muted-foreground">
                                        Effective{' '}
                                        {formatDate(transfer.effective_date)} -
                                        recorded by {transferredBy}
                                    </div>
                                    {transfer.memo_reference && (
                                        <div className="mt-2 text-xs">
                                            <span className="font-medium">
                                                Memo:
                                            </span>{' '}
                                            {transfer.memo_reference}
                                        </div>
                                    )}
                                    <p className="mt-2 text-xs whitespace-pre-wrap text-muted-foreground">
                                        {transfer.reason}
                                    </p>
                                </article>
                            );
                        })}
                    </div>
                </section>
            )}
        </>
    );
}
