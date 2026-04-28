import AppLayout from '@/layouts/app-layout';
import { type BreadcrumbItem } from '@/types';
import { Head } from '@inertiajs/react';
import { useMemo, useRef, useState } from 'react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import { Stepper } from '@/components/ui/stepper';
import { useInitials } from '@/hooks/use-initials';
import { toast } from '@/lib/toast';
import {
    ArrowLeft,
    ArrowRight,
    Building2,
    CheckCircle2,
    FileSpreadsheet,
    FileText,
    Printer,
    Search,
} from 'lucide-react';

const CHED_LOGO_URL = '/assets/img/ched-logo.png';

interface HEI {
    id: string;
    uii: string;
    name: string;
    type: string;
    logo?: string | null;
    user_avatar?: string | null;
    region_id?: string | null;
    region?: { id: string; code: string; name: string } | null;
    status: string;
}

interface Region {
    id: string;
    code: string;
    name: string;
}

interface Program {
    id: string;
    code: string;
    name: string;
    parent_id?: string | null;
}

interface LookupOption {
    id: string;
    code: string;
    name: string;
}

interface Props {
    heis: HEI[];
    regions: Region[];
    programs: Program[];
    academicYears: LookupOption[];
    rcNoteStatuses: LookupOption[];
    documentStatuses: LookupOption[];
    liquidationStatuses: LookupOption[];
    canFilterByRegion: boolean;
    userRole?: string;
}

const breadcrumbs: BreadcrumbItem[] = [{ title: 'Report', href: '/report' }];

// Step keys drive both the stepper labels and the conditional render switch below.
type StepKey = 'hei' | 'program' | 'academic_year' | 'document_status' | 'liquidation_status' | 'rc_notes';

const HEI_STEP = { key: 'hei' as StepKey, label: 'Choose HEI' };
const FILTER_STEPS: { key: StepKey; label: string }[] = [
    { key: 'program', label: 'Program' },
    { key: 'academic_year', label: 'Academic Year' },
    { key: 'document_status', label: 'Document Status' },
    { key: 'liquidation_status', label: 'Liquidation Status' },
    { key: 'rc_notes', label: 'RC Notes' },
];

// Adjust HEI name font-size so very long names still fit two lines without overflow.
// Weight stays consistent (font-medium) across all tiers — only size shrinks.
function getNameSizeClass(name: string): string {
    const len = name.length;
    if (len > 70) return 'text-[11px] font-medium leading-snug';
    if (len > 50) return 'text-xs font-medium leading-snug';
    if (len > 32) return 'text-sm font-medium leading-snug';
    return 'text-sm font-medium leading-snug';
}

export default function Report({
    heis,
    regions,
    programs,
    academicYears,
    rcNoteStatuses,
    documentStatuses,
    liquidationStatuses,
    canFilterByRegion,
    userRole,
}: Props) {
    const getInitials = useInitials();

    // HEI users only ever report on their own institution — skip Step 1 entirely.
    const isHeiUser = userRole === 'HEI';
    const STEPS = isHeiUser ? FILTER_STEPS : [HEI_STEP, ...FILTER_STEPS];

    // Stepper state
    const [currentStep, setCurrentStep] = useState(1);
    const [selectedHeiId, setSelectedHeiId] = useState<string | null>(
        isHeiUser && heis.length > 0 ? heis[0].id : null,
    );
    const [selectedPrograms, setSelectedPrograms] = useState<string[]>([]);
    const [selectedAcademicYears, setSelectedAcademicYears] = useState<string[]>([]);
    const [selectedDocStatuses, setSelectedDocStatuses] = useState<string[]>([]);
    const [selectedLiqStatuses, setSelectedLiqStatuses] = useState<string[]>([]);
    const [selectedRcNotes, setSelectedRcNotes] = useState<string[]>([]);

    // Step 1 card filters
    const [searchQuery, setSearchQuery] = useState('');
    const [typeFilter, setTypeFilter] = useState('all');
    const [regionFilter, setRegionFilter] = useState('all');
    const [statusFilter, setStatusFilter] = useState('all');

    // Excel/CSV export progress
    const [exportKind, setExportKind] = useState<'excel' | 'csv' | null>(null);
    const exportAbortRef = useRef<AbortController | null>(null);

    const filteredHeis = useMemo(() => {
        const q = searchQuery.trim().toLowerCase();
        return heis.filter((hei) => {
            if (q) {
                const matches =
                    hei.name.toLowerCase().includes(q) ||
                    hei.uii.toLowerCase().includes(q) ||
                    (hei.region?.name?.toLowerCase().includes(q) ?? false);
                if (!matches) return false;
            }
            if (typeFilter !== 'all' && hei.type !== typeFilter) return false;
            if (regionFilter !== 'all' && hei.region_id !== regionFilter) return false;
            if (statusFilter !== 'all' && hei.status !== statusFilter) return false;
            return true;
        });
    }, [heis, searchQuery, typeFilter, regionFilter, statusFilter]);

    const selectedHei = useMemo(
        () => heis.find((h) => h.id === selectedHeiId) ?? null,
        [heis, selectedHeiId],
    );

    const togglePill = (
        list: string[],
        setter: (v: string[]) => void,
        value: string,
    ) => {
        setter(list.includes(value) ? list.filter((v) => v !== value) : [...list, value]);
    };

    const buildReportQueryString = () => {
        const params = new URLSearchParams();
        if (selectedHeiId) params.append('hei[]', selectedHeiId);
        selectedPrograms.forEach((v) => params.append('program[]', v));
        selectedAcademicYears.forEach((v) => params.append('academic_year[]', v));
        selectedDocStatuses.forEach((v) => params.append('document_status[]', v));
        selectedLiqStatuses.forEach((v) => params.append('liquidation_status[]', v));
        selectedRcNotes.forEach((v) => params.append('rc_note_status[]', v));
        return params.toString();
    };

    const handlePrint = () => {
        const qs = buildReportQueryString();
        const url = route('liquidation.print-report') + (qs ? `?${qs}` : '');
        const newTab = window.open('', '_blank');
        if (!newTab) {
            window.open(url, '_blank');
            return;
        }
        newTab.document.write(`<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8" />
<title>Generating Liquidation Report…</title>
<style>
  html, body { height: 100%; margin: 0; }
  body { display: flex; align-items: center; justify-content: center;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    background: #f8fafc; color: #0f172a; }
  .loader { text-align: center; max-width: 420px; padding: 32px; }
  .spinner { width: 56px; height: 56px; margin: 0 auto 20px;
    border: 5px solid #e2e8f0; border-top-color: #2563eb; border-radius: 50%;
    animation: spin 0.9s linear infinite; }
  h2 { font-size: 18px; font-weight: 600; margin: 0 0 8px; }
  p  { font-size: 13px; margin: 0; color: #475569; line-height: 1.5; }
  @keyframes spin { to { transform: rotate(360deg); } }
</style>
</head>
<body>
  <div class="loader">
    <div class="spinner"></div>
    <h2>Generating Liquidation Report</h2>
    <p>Preparing the printable monitoring sheet. This may take a few seconds — please don't close this tab.</p>
  </div>
</body>
</html>`);
        newTab.document.close();
        newTab.location.href = url;
    };

    const downloadReport = async (kind: 'excel' | 'csv') => {
        if (exportKind) return;
        const qs = buildReportQueryString();
        const routeName = kind === 'excel' ? 'liquidation.export-excel' : 'liquidation.export-csv';
        const url = route(routeName) + (qs ? `?${qs}` : '');
        const fallbackName = `liquidation-report-${new Date().toISOString().slice(0, 10)}.${kind === 'excel' ? 'xlsx' : 'csv'}`;
        const label = kind === 'excel' ? 'Excel' : 'CSV';

        const controller = new AbortController();
        exportAbortRef.current = controller;
        setExportKind(kind);
        const toastId = toast.loading(`Preparing ${label} export — this may take a while…`, {
            duration: Infinity,
            action: { label: 'Cancel', onClick: () => controller.abort() },
        });

        let blobUrl: string | null = null;
        try {
            const res = await fetch(url, {
                credentials: 'same-origin',
                headers: { Accept: '*/*' },
                signal: controller.signal,
            });
            if (!res.ok) {
                throw new Error(
                    res.status === 403
                        ? 'You are not allowed to export this report.'
                        : `Export failed (${res.status}).`,
                );
            }
            const disposition = res.headers.get('Content-Disposition') || '';
            const match = disposition.match(/filename\*?=(?:UTF-8'')?"?([^";]+)"?/i);
            const filename = match ? decodeURIComponent(match[1]) : fallbackName;
            const blob = await res.blob();
            blobUrl = URL.createObjectURL(blob);
            const anchor = document.createElement('a');
            anchor.href = blobUrl;
            anchor.download = filename;
            document.body.appendChild(anchor);
            anchor.click();
            anchor.remove();
            toast.dismiss(toastId);
            toast.success(`${label} downloaded`);
        } catch (e: unknown) {
            toast.dismiss(toastId);
            const err = e as { name?: string; message?: string };
            if (err?.name === 'AbortError') {
                toast.info(`${label} export cancelled.`);
            } else {
                toast.error(err?.message || `${label} export failed.`);
            }
        } finally {
            if (blobUrl) URL.revokeObjectURL(blobUrl);
            if (exportAbortRef.current === controller) exportAbortRef.current = null;
            setExportKind(null);
        }
    };

    const stepKey = STEPS[currentStep - 1]?.key;
    const canAdvance = stepKey === 'hei' ? Boolean(selectedHeiId) : true;
    const isFinalStep = currentStep === STEPS.length;

    return (
        <AppLayout breadcrumbs={breadcrumbs}>
            <Head title="Report" />

            <div className="w-full py-8">
                <div className="mx-auto w-full max-w-[95%] space-y-6">
                    {/* Header */}
                    <div>
                        <h2 className="text-xl font-semibold tracking-tight">Generate Report</h2>
                        <p className="mt-1 text-sm text-muted-foreground">
                            Walk through the steps to filter and export a liquidation report.
                        </p>
                    </div>

                    {/* Stepper */}
                    <div className="rounded-lg border bg-card px-6 py-5">
                        <Stepper steps={STEPS} currentStep={currentStep} />
                    </div>

                    {/* Step content */}
                    {stepKey === 'hei' && (
                        <Step1Heis
                            heis={filteredHeis}
                            regions={regions}
                            canFilterByRegion={canFilterByRegion}
                            selectedHeiId={selectedHeiId}
                            onSelect={setSelectedHeiId}
                            searchQuery={searchQuery}
                            setSearchQuery={setSearchQuery}
                            typeFilter={typeFilter}
                            setTypeFilter={setTypeFilter}
                            regionFilter={regionFilter}
                            setRegionFilter={setRegionFilter}
                            statusFilter={statusFilter}
                            setStatusFilter={setStatusFilter}
                            getInitials={getInitials}
                        />
                    )}

                    {stepKey === 'program' && (
                        <StepPills
                            title="Select Program(s)"
                            description="Leave empty to include all programs available to you."
                            options={programs.map((p) => ({ value: p.id, label: `${p.code} — ${p.name}` }))}
                            selected={selectedPrograms}
                            onToggle={(v) => togglePill(selectedPrograms, setSelectedPrograms, v)}
                            onClear={() => setSelectedPrograms([])}
                            emptyHint="No programs available for your role."
                        />
                    )}

                    {stepKey === 'academic_year' && (
                        <StepPills
                            title="Academic Year"
                            description="Leave empty to include all academic years."
                            options={academicYears.map((ay) => ({ value: ay.id, label: ay.name }))}
                            selected={selectedAcademicYears}
                            onToggle={(v) => togglePill(selectedAcademicYears, setSelectedAcademicYears, v)}
                            onClear={() => setSelectedAcademicYears([])}
                        />
                    )}

                    {stepKey === 'document_status' && (
                        <StepPills
                            title="Document Status"
                            description="Leave empty to include all document statuses."
                            options={documentStatuses.map((s) => ({ value: s.code, label: s.name }))}
                            selected={selectedDocStatuses}
                            onToggle={(v) => togglePill(selectedDocStatuses, setSelectedDocStatuses, v)}
                            onClear={() => setSelectedDocStatuses([])}
                        />
                    )}

                    {stepKey === 'liquidation_status' && (
                        <StepPills
                            title="Liquidation Status"
                            description="Leave empty to include all liquidation statuses."
                            options={liquidationStatuses.map((s) => ({ value: s.code, label: s.name }))}
                            selected={selectedLiqStatuses}
                            onToggle={(v) => togglePill(selectedLiqStatuses, setSelectedLiqStatuses, v)}
                            onClear={() => setSelectedLiqStatuses([])}
                        />
                    )}

                    {stepKey === 'rc_notes' && (
                        <StepPills
                            title="RC Notes"
                            description="Leave empty to include all RC note statuses."
                            options={rcNoteStatuses.map((s) => ({ value: s.code, label: s.name }))}
                            selected={selectedRcNotes}
                            onToggle={(v) => togglePill(selectedRcNotes, setSelectedRcNotes, v)}
                            onClear={() => setSelectedRcNotes([])}
                        />
                    )}

                    {/* Selection summary on every step except the HEI picker itself */}
                    {stepKey !== 'hei' && selectedHei && (
                        <div className="flex items-center gap-3 rounded-lg border bg-muted/30 px-4 py-2.5 text-xs">
                            <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                            <span className="text-muted-foreground">Selected HEI:</span>
                            <span className="font-medium">{selectedHei.name}</span>
                            <span className="font-mono text-muted-foreground">{selectedHei.uii}</span>
                        </div>
                    )}

                    {/* Footer navigation — sticky so Next is always reachable on long HEI lists */}
                    <div className="sticky bottom-0 z-10 -mx-[2.5%] flex flex-col items-stretch gap-3 border-t bg-background/95 px-[2.5%] py-3 backdrop-blur supports-[backdrop-filter]:bg-background/80 sm:flex-row sm:items-center sm:justify-between">
                        <Button
                            variant="outline"
                            onClick={() => setCurrentStep((s) => Math.max(1, s - 1))}
                            disabled={currentStep === 1}
                            className="gap-1.5"
                        >
                            <ArrowLeft className="h-4 w-4" />
                            Back
                        </Button>

                        {!isFinalStep ? (
                            <Button
                                onClick={() => setCurrentStep((s) => Math.min(STEPS.length, s + 1))}
                                disabled={!canAdvance}
                                className="gap-1.5"
                            >
                                Next
                                <ArrowRight className="h-4 w-4" />
                            </Button>
                        ) : (
                            <div className="flex flex-wrap items-center gap-2">
                                <Button onClick={handlePrint} className="gap-1.5">
                                    <Printer className="h-4 w-4" />
                                    Print
                                </Button>
                                <Button
                                    onClick={() => downloadReport('excel')}
                                    disabled={exportKind !== null}
                                    variant="outline"
                                    className="gap-1.5"
                                >
                                    <FileSpreadsheet className="h-4 w-4" />
                                    {exportKind === 'excel' ? 'Preparing…' : 'Excel'}
                                </Button>
                                <Button
                                    onClick={() => downloadReport('csv')}
                                    disabled={exportKind !== null}
                                    variant="outline"
                                    className="gap-1.5"
                                >
                                    <FileText className="h-4 w-4" />
                                    {exportKind === 'csv' ? 'Preparing…' : 'CSV'}
                                </Button>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </AppLayout>
    );
}

/* ── Step 1: HEI cards grid ─────────────────────────────────────────── */
interface Step1Props {
    heis: HEI[];
    regions: Region[];
    canFilterByRegion: boolean;
    selectedHeiId: string | null;
    onSelect: (id: string) => void;
    searchQuery: string;
    setSearchQuery: (v: string) => void;
    typeFilter: string;
    setTypeFilter: (v: string) => void;
    regionFilter: string;
    setRegionFilter: (v: string) => void;
    statusFilter: string;
    setStatusFilter: (v: string) => void;
    getInitials: (name: string) => string;
}

function Step1Heis({
    heis,
    regions,
    canFilterByRegion,
    selectedHeiId,
    onSelect,
    searchQuery,
    setSearchQuery,
    typeFilter,
    setTypeFilter,
    regionFilter,
    setRegionFilter,
    statusFilter,
    setStatusFilter,
    getInitials,
}: Step1Props) {
    return (
        <div className="space-y-4">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                    <h3 className="text-base font-semibold">Choose a school</h3>
                    <p className="text-xs text-muted-foreground">
                        Click a card to select. {heis.length} school{heis.length === 1 ? '' : 's'} shown.
                    </p>
                </div>
                <div className="relative w-full sm:w-72">
                    <Search className="absolute top-2.5 left-2.5 h-4 w-4 text-muted-foreground" />
                    <Input
                        type="search"
                        placeholder="Search by name, UII, or region..."
                        className="bg-background pl-9"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                    />
                </div>
            </div>

            <div className="flex flex-wrap gap-3">
                <Select value={typeFilter} onValueChange={setTypeFilter}>
                    <SelectTrigger className="w-40 bg-background">
                        <SelectValue placeholder="All Types" />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="all">All Types</SelectItem>
                        <SelectItem value="Private">Private</SelectItem>
                        <SelectItem value="SUC">SUC</SelectItem>
                        <SelectItem value="LUC">LUC</SelectItem>
                    </SelectContent>
                </Select>

                {canFilterByRegion && (
                    <Select value={regionFilter} onValueChange={setRegionFilter}>
                        <SelectTrigger className="w-44 bg-background">
                            <SelectValue placeholder="All Regions" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="all">All Regions</SelectItem>
                            {regions.map((r) => (
                                <SelectItem key={r.id} value={r.id}>
                                    {r.code} — {r.name}
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                )}

                <Select value={statusFilter} onValueChange={setStatusFilter}>
                    <SelectTrigger className="w-36 bg-background">
                        <SelectValue placeholder="All Status" />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="all">All Status</SelectItem>
                        <SelectItem value="active">Active</SelectItem>
                        <SelectItem value="inactive">Inactive</SelectItem>
                    </SelectContent>
                </Select>
            </div>

            {heis.length === 0 ? (
                <div className="flex flex-col items-center justify-center gap-3 rounded-lg border bg-card py-16 text-center">
                    <Building2 className="h-8 w-8 text-muted-foreground/50" />
                    <p className="text-sm text-muted-foreground">
                        No schools found matching your filters.
                    </p>
                </div>
            ) : (
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                    {heis.map((hei) => {
                        const isSelected = hei.id === selectedHeiId;
                        return (
                            <button
                                key={hei.id}
                                type="button"
                                onClick={() => onSelect(hei.id)}
                                className={`flex items-center gap-3 rounded-lg border bg-card p-3 text-left transition-all hover:bg-muted/40 ${
                                    isSelected
                                        ? 'border-primary ring-2 ring-primary/30'
                                        : 'border-border'
                                }`}
                            >
                                <Avatar className="h-12 w-12 shrink-0 bg-muted">
                                    <AvatarImage
                                        src={hei.logo ? `/storage/${hei.logo}` : (hei.user_avatar || CHED_LOGO_URL)}
                                        alt={hei.name}
                                    />
                                    <AvatarFallback className="bg-muted text-muted-foreground text-xs font-medium">
                                        {getInitials(hei.name)}
                                    </AvatarFallback>
                                </Avatar>
                                <div className="min-w-0 flex-1">
                                    <p
                                        className={`text-foreground line-clamp-2 break-words ${getNameSizeClass(hei.name)}`}
                                        title={hei.name}
                                    >
                                        {hei.name}
                                    </p>
                                    <p className="mt-0.5 truncate font-mono text-[11px] text-muted-foreground">
                                        {hei.uii}
                                    </p>
                                </div>
                                {isSelected && (
                                    <CheckCircle2 className="h-5 w-5 shrink-0 text-primary" />
                                )}
                            </button>
                        );
                    })}
                </div>
            )}
        </div>
    );
}

/* ── Steps 2–5: pill toggle list ────────────────────────────────────── */
interface PillOption {
    value: string;
    label: string;
}

interface StepPillsProps {
    title: string;
    description: string;
    options: PillOption[];
    selected: string[];
    onToggle: (v: string) => void;
    onClear: () => void;
    emptyHint?: string;
}

function StepPills({ title, description, options, selected, onToggle, onClear, emptyHint }: StepPillsProps) {
    return (
        <div className="rounded-lg border bg-card p-6">
            <div className="mb-4 flex items-start justify-between gap-3">
                <div>
                    <h3 className="text-base font-semibold">{title}</h3>
                    <p className="mt-0.5 text-xs text-muted-foreground">{description}</p>
                </div>
                {selected.length > 0 && (
                    <Button variant="ghost" size="sm" onClick={onClear} className="h-7 text-xs">
                        Clear ({selected.length})
                    </Button>
                )}
            </div>
            {options.length === 0 ? (
                <p className="text-sm text-muted-foreground italic">
                    {emptyHint ?? 'No options available.'}
                </p>
            ) : (
                <div className="flex flex-wrap gap-2">
                    {options.map((opt) => {
                        const isSelected = selected.includes(opt.value);
                        return (
                            <button
                                key={opt.value}
                                type="button"
                                onClick={() => onToggle(opt.value)}
                                className={`rounded-full border px-3 py-1.5 text-xs font-medium transition-colors ${
                                    isSelected
                                        ? 'border-primary bg-primary text-primary-foreground'
                                        : 'border-border bg-background text-foreground hover:bg-muted/60'
                                }`}
                            >
                                {opt.label}
                            </button>
                        );
                    })}
                </div>
            )}
        </div>
    );
}
