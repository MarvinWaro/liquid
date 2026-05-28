import { Badge } from '@/components/ui/badge';
import {
    type ChartConfig,
    ChartContainer,
    ChartLegend,
    ChartLegendContent,
    ChartTooltip,
    ChartTooltipContent,
} from '@/components/ui/chart';
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from '@/components/ui/table';
import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from 'recharts';

export interface ToolResult {
    tool: string;
    arguments: Record<string, unknown>;
    result: Record<string, unknown>;
}

interface SummaryMetrics {
    records?: number;
    grantees?: number;
    disbursed?: number;
    liquidated?: number;
    unliquidated?: number;
    for_endorsement?: number;
    liquidation_percentage?: number;
}

const pesoFormatter = new Intl.NumberFormat('en-PH', {
    style: 'currency',
    currency: 'PHP',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
});

const integerFormatter = new Intl.NumberFormat('en-PH');

function isFiniteNumber(value: unknown): value is number {
    return typeof value === 'number' && Number.isFinite(value);
}

function formatCurrency(value: unknown): string {
    return isFiniteNumber(value) ? pesoFormatter.format(value) : '—';
}

function formatInteger(value: unknown): string {
    return isFiniteNumber(value) ? integerFormatter.format(value) : '—';
}

function formatPercent(value: unknown): string {
    return isFiniteNumber(value) ? `${value.toFixed(2)}%` : '—';
}

const compactFormatter = new Intl.NumberFormat('en-US', {
    notation: 'compact',
    maximumFractionDigits: 1,
});

function formatCompact(value: unknown): string {
    return isFiniteNumber(value) ? `₱${compactFormatter.format(value)}` : '';
}

function asString(value: unknown): string {
    return typeof value === 'string' && value.length > 0 ? value : '—';
}

const toolTitles: Record<string, string> = {
    get_liquidation_summary: 'Liquidation Summary',
    list_liquidations: 'Liquidation Records',
    find_liquidation: 'Liquidation Detail',
    list_heis: 'HEI Catalog',
    list_reference_data: 'Reference Data',
};

export function ToolResultDisplay({ results }: { results: ToolResult[] }) {
    if (!results || results.length === 0) return null;

    return (
        <div className="space-y-3">
            {results.map((result, index) => (
                <ToolResultCard key={`${result.tool}-${index}`} result={result} />
            ))}
        </div>
    );
}

function ToolResultCard({ result }: { result: ToolResult }) {
    const { tool, result: data } = result;
    const title = toolTitles[tool] ?? tool;

    return (
        <div className="overflow-hidden rounded-lg border bg-background shadow-sm">
            <div className="flex items-center justify-between border-b bg-muted/40 px-3 py-2">
                <span className="text-xs font-medium tracking-tight text-foreground">
                    {title}
                </span>
                <Badge variant="secondary" className="font-mono text-[10px]">
                    {tool}
                </Badge>
            </div>
            <div className="p-3">{renderToolView(tool, data)}</div>
        </div>
    );
}

function renderToolView(tool: string, data: Record<string, unknown>) {
    switch (tool) {
        case 'get_liquidation_summary':
            return <SummaryView data={data} />;
        case 'list_liquidations':
            return <ListLiquidationsView data={data} />;
        case 'find_liquidation':
            return <FindLiquidationView data={data} />;
        case 'list_heis':
            return <ListHeisView data={data} />;
        case 'list_reference_data':
            return <ReferenceDataView data={data} />;
        default:
            return <UnknownToolView data={data} />;
    }
}

function FiltersSummary({ data }: { data: Record<string, unknown> }) {
    const filters = (data.filters ?? {}) as Record<string, unknown>;
    const unmatched = (data.unmatched_filters ?? {}) as Record<string, unknown>;
    const voided = typeof data.voided_records === 'string' ? data.voided_records : null;

    const appliedEntries = Object.entries(filters).filter(
        ([, value]) => Array.isArray(value) && value.length > 0,
    );
    const unmatchedEntries = Object.entries(unmatched).filter(
        ([, value]) => Array.isArray(value) && value.length > 0,
    );

    if (appliedEntries.length === 0 && unmatchedEntries.length === 0 && !voided) {
        return null;
    }

    return (
        <div className="mb-3 flex flex-wrap gap-1.5 text-[11px]">
            {appliedEntries.map(([key, value]) => (
                <Badge key={key} variant="outline" className="font-normal">
                    <span className="text-muted-foreground">{key}:</span>
                    <span className="ml-1">{(value as string[]).join(', ')}</span>
                </Badge>
            ))}
            {unmatchedEntries.map(([key, value]) => (
                <Badge
                    key={`unmatched-${key}`}
                    variant="destructive"
                    className="font-normal"
                >
                    unmatched {key}: {(value as string[]).join(', ')}
                </Badge>
            ))}
            {voided && (
                <Badge variant="outline" className="font-normal text-muted-foreground">
                    {voided}
                </Badge>
            )}
        </div>
    );
}

function SummaryView({ data }: { data: Record<string, unknown> }) {
    const totals = (data.totals ?? {}) as SummaryMetrics;
    const breakdown = Array.isArray(data.breakdown)
        ? (data.breakdown as Array<SummaryMetrics & { label: string }>)
        : [];
    const groupedBy = typeof data.grouped_by === 'string' ? data.grouped_by : 'group';

    return (
        <div>
            <FiltersSummary data={data} />

            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                <Metric label="Records" value={formatInteger(totals.records)} />
                <Metric label="Grantees" value={formatInteger(totals.grantees)} />
                <Metric label="Disbursed" value={formatCurrency(totals.disbursed)} />
                <Metric label="Liquidated" value={formatCurrency(totals.liquidated)} />
                <Metric label="Unliquidated" value={formatCurrency(totals.unliquidated)} />
                <Metric
                    label="For Endorsement"
                    value={formatCurrency(totals.for_endorsement)}
                />
                <Metric
                    label="Liquidation %"
                    value={formatPercent(totals.liquidation_percentage)}
                    accent
                />
            </div>

            {breakdown.length >= 2 && <SummaryChart breakdown={breakdown} />}

            {breakdown.length > 0 && (
                <div className="mt-3">
                    <p className="mb-1.5 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                        Breakdown by {groupedBy.replace(/_/g, ' ')}
                    </p>
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Label</TableHead>
                                <TableHead className="text-right">Records</TableHead>
                                <TableHead className="text-right">Grantees</TableHead>
                                <TableHead className="text-right">Disbursed</TableHead>
                                <TableHead className="text-right">Liquidated</TableHead>
                                <TableHead className="text-right">Unliquidated</TableHead>
                                <TableHead className="text-right">For Endorsement</TableHead>
                                <TableHead className="text-right">% Liquidation</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {breakdown.map((row, i) => (
                                <TableRow key={`${row.label}-${i}`}>
                                    <TableCell className="font-medium">{row.label}</TableCell>
                                    <TableCell className="text-right tabular-nums">
                                        {formatInteger(row.records)}
                                    </TableCell>
                                    <TableCell className="text-right tabular-nums">
                                        {formatInteger(row.grantees)}
                                    </TableCell>
                                    <TableCell className="text-right tabular-nums">
                                        {formatCurrency(row.disbursed)}
                                    </TableCell>
                                    <TableCell className="text-right tabular-nums">
                                        {formatCurrency(row.liquidated)}
                                    </TableCell>
                                    <TableCell className="text-right tabular-nums">
                                        {formatCurrency(row.unliquidated)}
                                    </TableCell>
                                    <TableCell className="text-right tabular-nums">
                                        {formatCurrency(row.for_endorsement)}
                                    </TableCell>
                                    <TableCell className="text-right tabular-nums">
                                        {formatPercent(row.liquidation_percentage)}
                                    </TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                </div>
            )}
        </div>
    );
}

const summaryChartConfig = {
    disbursed: { label: 'Disbursed', color: 'var(--chart-1)' },
    liquidated: { label: 'Liquidated', color: 'var(--chart-2)' },
    unliquidated: { label: 'Unliquidated', color: 'var(--chart-3)' },
    for_endorsement: { label: 'For Endorsement', color: 'var(--chart-4)' },
} satisfies ChartConfig;

function SummaryChart({
    breakdown,
}: {
    breakdown: Array<SummaryMetrics & { label: string }>;
}) {
    const data = breakdown.map((row) => ({
        label: row.label,
        disbursed: isFiniteNumber(row.disbursed) ? row.disbursed : 0,
        liquidated: isFiniteNumber(row.liquidated) ? row.liquidated : 0,
        unliquidated: isFiniteNumber(row.unliquidated) ? row.unliquidated : 0,
        for_endorsement: isFiniteNumber(row.for_endorsement)
            ? row.for_endorsement
            : 0,
    }));

    return (
        <div className="mt-3">
            <p className="mb-1.5 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                Visualization
            </p>
            <ChartContainer
                config={summaryChartConfig}
                className="aspect-auto h-[280px] w-full"
            >
                <BarChart data={data} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
                    <CartesianGrid vertical={false} strokeDasharray="3 3" />
                    <XAxis
                        dataKey="label"
                        tickLine={false}
                        axisLine={false}
                        tickMargin={8}
                        interval={0}
                        angle={data.length > 6 ? -20 : 0}
                        textAnchor={data.length > 6 ? 'end' : 'middle'}
                        height={data.length > 6 ? 56 : 28}
                        className="text-[10px]"
                    />
                    <YAxis
                        tickLine={false}
                        axisLine={false}
                        tickFormatter={formatCompact}
                        width={64}
                        className="text-[10px]"
                    />
                    <ChartTooltip
                        cursor={{ fillOpacity: 0.1 }}
                        content={
                            <ChartTooltipContent
                                formatter={(value) => formatCurrency(value)}
                            />
                        }
                    />
                    <ChartLegend content={<ChartLegendContent />} />
                    <Bar
                        dataKey="disbursed"
                        fill="var(--color-disbursed)"
                        radius={[4, 4, 0, 0]}
                    />
                    <Bar
                        dataKey="liquidated"
                        fill="var(--color-liquidated)"
                        radius={[4, 4, 0, 0]}
                    />
                    <Bar
                        dataKey="unliquidated"
                        fill="var(--color-unliquidated)"
                        radius={[4, 4, 0, 0]}
                    />
                    <Bar
                        dataKey="for_endorsement"
                        fill="var(--color-for_endorsement)"
                        radius={[4, 4, 0, 0]}
                    />
                </BarChart>
            </ChartContainer>
        </div>
    );
}

function Metric({
    label,
    value,
    accent = false,
}: {
    label: string;
    value: string;
    accent?: boolean;
}) {
    return (
        <div className="rounded-md border bg-card px-2.5 py-2">
            <p className="text-[10px] uppercase tracking-wide text-muted-foreground">
                {label}
            </p>
            <p
                className={
                    accent
                        ? 'mt-0.5 text-sm font-semibold tabular-nums text-primary'
                        : 'mt-0.5 text-sm font-semibold tabular-nums'
                }
            >
                {value}
            </p>
        </div>
    );
}

interface LiquidationRecord {
    control_no?: string;
    hei?: { uii?: string; name?: string } | null;
    program?: string;
    academic_year?: string;
    semester?: string;
    batch_no?: string;
    document_status?: string;
    liquidation_status?: string;
    rc_note_status?: string;
    date_submitted?: string;
    number_of_grantees?: number;
    amount_received?: number;
    amount_liquidated?: number;
    unliquidated?: number;
}

function ListLiquidationsView({ data }: { data: Record<string, unknown> }) {
    const records = Array.isArray(data.records)
        ? (data.records as LiquidationRecord[])
        : [];
    const page = isFiniteNumber(data.page) ? data.page : 1;
    const perPage = isFiniteNumber(data.per_page) ? data.per_page : 0;
    const total = isFiniteNumber(data.total_matching) ? data.total_matching : 0;
    const hasMore = data.has_more === true;

    return (
        <div>
            <FiltersSummary data={data} />
            <p className="mb-2 text-[11px] text-muted-foreground">
                Showing {records.length} of {formatInteger(total)} matching record
                {total === 1 ? '' : 's'} · page {page} · {perPage} per page
                {hasMore ? ' · more available' : ''}
            </p>

            {records.length === 0 ? (
                <p className="text-sm text-muted-foreground">No records match.</p>
            ) : (
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>Control No.</TableHead>
                            <TableHead>HEI</TableHead>
                            <TableHead>Program</TableHead>
                            <TableHead>AY</TableHead>
                            <TableHead>Status</TableHead>
                            <TableHead>RC Note</TableHead>
                            <TableHead className="text-right">Received</TableHead>
                            <TableHead className="text-right">Liquidated</TableHead>
                            <TableHead className="text-right">Unliquidated</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {records.map((row, i) => (
                            <TableRow key={`${row.control_no ?? 'row'}-${i}`}>
                                <TableCell className="font-mono text-xs">
                                    {asString(row.control_no)}
                                </TableCell>
                                <TableCell>{asString(row.hei?.name)}</TableCell>
                                <TableCell>{asString(row.program)}</TableCell>
                                <TableCell>{asString(row.academic_year)}</TableCell>
                                <TableCell>{asString(row.liquidation_status)}</TableCell>
                                <TableCell>{asString(row.rc_note_status)}</TableCell>
                                <TableCell className="text-right tabular-nums">
                                    {formatCurrency(row.amount_received)}
                                </TableCell>
                                <TableCell className="text-right tabular-nums">
                                    {formatCurrency(row.amount_liquidated)}
                                </TableCell>
                                <TableCell className="text-right tabular-nums">
                                    {formatCurrency(row.unliquidated)}
                                </TableCell>
                            </TableRow>
                        ))}
                    </TableBody>
                </Table>
            )}
        </div>
    );
}

function FindLiquidationView({ data }: { data: Record<string, unknown> }) {
    const found = data.found === true;
    const controlNo = typeof data.control_no === 'string' ? data.control_no : '';
    const message = typeof data.message === 'string' ? data.message : null;

    if (!found) {
        return (
            <div>
                <p className="text-sm">
                    <span className="font-mono text-xs text-muted-foreground">
                        {controlNo}
                    </span>{' '}
                    — not found.
                </p>
                {message && (
                    <p className="mt-1 text-xs text-muted-foreground">{message}</p>
                )}
            </div>
        );
    }

    const record = (data.record ?? {}) as LiquidationRecord;

    return (
        <div className="space-y-2">
            <p className="font-mono text-xs text-muted-foreground">{controlNo}</p>
            <dl className="grid grid-cols-2 gap-x-4 gap-y-1.5 text-sm sm:grid-cols-3">
                <Field label="HEI" value={asString(record.hei?.name)} />
                <Field label="UII" value={asString(record.hei?.uii)} mono />
                <Field label="Program" value={asString(record.program)} />
                <Field label="Academic Year" value={asString(record.academic_year)} />
                <Field label="Semester" value={asString(record.semester)} />
                <Field label="Batch" value={asString(record.batch_no)} />
                <Field
                    label="Liquidation Status"
                    value={asString(record.liquidation_status)}
                />
                <Field
                    label="Document Status"
                    value={asString(record.document_status)}
                />
                <Field label="RC Note" value={asString(record.rc_note_status)} />
                <Field
                    label="Date Submitted"
                    value={asString(record.date_submitted)}
                />
                <Field
                    label="Grantees"
                    value={formatInteger(record.number_of_grantees)}
                />
                <Field
                    label="Amount Received"
                    value={formatCurrency(record.amount_received)}
                />
                <Field
                    label="Amount Liquidated"
                    value={formatCurrency(record.amount_liquidated)}
                />
                <Field
                    label="Unliquidated"
                    value={formatCurrency(record.unliquidated)}
                />
            </dl>
        </div>
    );
}

function Field({
    label,
    value,
    mono = false,
}: {
    label: string;
    value: string;
    mono?: boolean;
}) {
    return (
        <div>
            <dt className="text-[10px] uppercase tracking-wide text-muted-foreground">
                {label}
            </dt>
            <dd
                className={
                    mono
                        ? 'font-mono text-xs tabular-nums'
                        : 'text-sm tabular-nums'
                }
            >
                {value}
            </dd>
        </div>
    );
}

interface HeiRecord {
    uii?: string;
    name?: string;
    type?: string;
    status?: string;
    region?: string;
}

function ListHeisView({ data }: { data: Record<string, unknown> }) {
    const heis = Array.isArray(data.heis) ? (data.heis as HeiRecord[]) : [];
    const total = isFiniteNumber(data.total_matching) ? data.total_matching : 0;
    const page = isFiniteNumber(data.page) ? data.page : 1;
    const perPage = isFiniteNumber(data.per_page) ? data.per_page : 0;
    const hasMore = data.has_more === true;

    return (
        <div>
            <FiltersSummary data={data} />
            <p className="mb-2 text-[11px] text-muted-foreground">
                Showing {heis.length} of {formatInteger(total)} HEI
                {total === 1 ? '' : 's'} · page {page} · {perPage} per page
                {hasMore ? ' · more available' : ''}
            </p>

            {heis.length === 0 ? (
                <p className="text-sm text-muted-foreground">No HEIs match.</p>
            ) : (
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>UII</TableHead>
                            <TableHead>Name</TableHead>
                            <TableHead>Type</TableHead>
                            <TableHead>Region</TableHead>
                            <TableHead>Status</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {heis.map((hei, i) => (
                            <TableRow key={`${hei.uii ?? 'hei'}-${i}`}>
                                <TableCell className="font-mono text-xs">
                                    {asString(hei.uii)}
                                </TableCell>
                                <TableCell>{asString(hei.name)}</TableCell>
                                <TableCell>{asString(hei.type)}</TableCell>
                                <TableCell>{asString(hei.region)}</TableCell>
                                <TableCell>{asString(hei.status)}</TableCell>
                            </TableRow>
                        ))}
                    </TableBody>
                </Table>
            )}
        </div>
    );
}

const referenceCategoryLabels: Record<string, string> = {
    programs: 'Programs',
    regions: 'Regions',
    academic_years: 'Academic Years',
    document_statuses: 'Document Statuses',
    liquidation_statuses: 'Liquidation Statuses',
    rc_note_statuses: 'RC Note Statuses',
};

function ReferenceDataView({ data }: { data: Record<string, unknown> }) {
    const categories = Object.keys(referenceCategoryLabels).filter(
        (key) => Array.isArray(data[key]) && (data[key] as unknown[]).length > 0,
    );

    if (categories.length === 0) {
        return <p className="text-sm text-muted-foreground">No reference data.</p>;
    }

    return (
        <div className="grid gap-3 sm:grid-cols-2">
            {categories.map((key) => {
                const items = data[key] as Array<
                    string | { code?: string; name?: string }
                >;
                return (
                    <div key={key}>
                        <p className="mb-1 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                            {referenceCategoryLabels[key]}
                            <span className="ml-1 font-normal text-muted-foreground/70">
                                ({items.length})
                            </span>
                        </p>
                        <ul className="space-y-0.5 text-sm">
                            {items.map((item, i) => (
                                <li key={i} className="flex gap-2">
                                    {typeof item === 'string' ? (
                                        <span>{item}</span>
                                    ) : (
                                        <>
                                            <span className="font-mono text-xs text-muted-foreground">
                                                {asString(item.code)}
                                            </span>
                                            <span>{asString(item.name)}</span>
                                        </>
                                    )}
                                </li>
                            ))}
                        </ul>
                    </div>
                );
            })}
        </div>
    );
}

function UnknownToolView({ data }: { data: Record<string, unknown> }) {
    return (
        <pre className="overflow-x-auto text-xs">
            {JSON.stringify(data, null, 2)}
        </pre>
    );
}
