<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Liquidation Monitoring Sheet</title>
    <link rel="icon" href="/assets/img/unifast.png" type="image/png">
    <style>
        @page {
            size: legal landscape;
            margin: 0.3in 0.25in;
        }

        * { margin: 0; padding: 0; box-sizing: border-box; }

        body {
            font-family: 'Arial Narrow', Arial, Helvetica, sans-serif;
            font-size: 8pt;
            color: #000;
            -webkit-print-color-adjust: exact;
            print-color-adjust: exact;
        }

        /* ── Header ─────────────────────────────── */
        .report-header {
            text-align: center;
            margin-bottom: 6px;
            position: relative;
        }

        .report-header .header-text {
            text-align: center;
            line-height: 1.3;
        }

        .report-header .header-text p {
            margin: 0;
        }

        .report-header .logo-left,
        .report-header .logo-right {
            position: absolute;
            top: 50%;
            transform: translateY(-50%);
            height: 50px;
            width: auto;
        }

        .report-header .logo-left {
            left: 30%;
        }

        .report-header .logo-right {
            right: 30%;
        }

        .report-header .republic {
            font-size: 9pt;
        }

        .report-header .ched {
            font-size: 10pt;
            font-weight: bold;
        }

        .report-header .office {
            font-size: 9pt;
        }

        .report-title {
            text-align: center;
            margin: 10px 0 6px;
        }

        .report-title h2 {
            font-size: 11pt;
            font-weight: bold;
            text-transform: uppercase;
            letter-spacing: 0.5px;
        }

        .report-title .subtitle {
            font-size: 8.5pt;
            color: #333;
            margin-top: 1px;
        }

        .filter-info {
            font-size: 7.5pt;
            color: #555;
            text-align: center;
            margin-bottom: 10px;
            font-style: italic;
        }

        /* ── Program Summary ────────────────────── */
        .program-summary {
            width: auto;
            border-collapse: collapse;
            font-size: 7pt;
            margin: 0 auto 12px;
        }

        .program-summary th {
            background-color: #dbeafe;
            font-size: 6.5pt;
            font-weight: bold;
            text-align: center;
            text-transform: uppercase;
            padding: 3px 8px;
            border: 1px solid #555;
            white-space: nowrap;
        }

        .program-summary td {
            padding: 2px 8px;
            border: 1px solid #555;
            font-size: 7pt;
        }

        .program-summary .summary-program {
            font-weight: bold;
            text-align: left;
        }

        .program-summary .summary-total td {
            font-weight: bold;
            background-color: #eff6ff;
            border-top: 2px solid #333;
        }

        /* ── Table ──────────────────────────────── */
        table {
            width: 100%;
            border-collapse: collapse;
            font-size: 6.5pt;
        }

        th, td {
            border: 1px solid #555;
            padding: 2px 3px;
            vertical-align: middle;
        }

        th {
            background-color: #fde68a;
            font-size: 6.5pt;
            font-weight: bold;
            text-align: center;
            text-transform: uppercase;
            line-height: 1.2;
            white-space: nowrap;
        }

        td {
            font-size: 6.5pt;
            line-height: 1.2;
        }

        .text-center { text-align: center; }
        .text-right { text-align: right; }
        .text-left { text-align: left; }
        .font-mono { font-family: 'Consolas', 'Courier New', monospace; }
        .nowrap { white-space: nowrap; }

        /* Compact columns shrink, financial columns get remaining space */
        .col-seq { width: 1.5%; }
        .col-program { width: 3%; }
        .col-hei { width: 10%; }
        .col-control { width: 6.5%; }
        .col-ay { width: 4%; }
        .col-sem { width: 2.5%; }
        .col-batch { width: 2%; }
        .col-date { width: 5%; }
        .col-grantees { width: 3%; }
        .col-amount { width: 8.5%; }
        .col-status { width: 6%; }
        .col-rcnotes { width: 6%; }
        .col-liqstatus { width: 6.5%; }
        .col-pct { width: 4%; }
        .col-lapsing { width: 3.5%; }

        /* Totals table — separate so it only appears on the last page */
        .totals-table {
            width: 100%;
            border-collapse: collapse;
            font-size: 6.5pt;
            margin-top: -1px;
        }

        .totals-row td {
            font-weight: bold;
            background-color: #fef9c3;
            border: 1px solid #555;
            border-top: 2px solid #333;
            padding: 3px 4px;
            font-size: 7.5pt;
        }

        /* Footer */
        .report-footer {
            margin-top: 8px;
            font-size: 7pt;
            color: #666;
            display: flex;
            justify-content: space-between;
        }

        /* Print-specific */
        @media print {
            body { background: #fff; padding: 0; }
            .no-print { display: none !important; }
        }

        /* Screen preview toolbar */
        .print-toolbar {
            position: fixed;
            top: 0;
            left: 0;
            right: 0;
            background: #1e293b;
            color: #fff;
            padding: 10px 20px;
            display: flex;
            align-items: center;
            gap: 12px;
            z-index: 1000;
            box-shadow: 0 2px 8px rgba(0,0,0,0.2);
        }

        .print-toolbar button {
            background: #3b82f6;
            color: #fff;
            border: none;
            padding: 8px 20px;
            border-radius: 6px;
            font-size: 13px;
            font-weight: 600;
            cursor: pointer;
        }

        .print-toolbar button:hover { background: #2563eb; }

        .print-toolbar span {
            font-size: 13px;
            opacity: 0.8;
        }

        @media screen {
            body { padding-top: 56px; background: #f1f5f9; }
            .page-wrap {
                max-width: 14in;
                margin: 20px auto;
                background: #fff;
                padding: 0.4in 0.3in;
                box-shadow: 0 2px 12px rgba(0,0,0,0.1);
            }
        }
    </style>
</head>
<body>
    {{-- Screen-only toolbar --}}
    <div class="print-toolbar no-print">
        <button onclick="window.print()">Print Report</button>
        <span>{{ $liquidations->count() }} record(s) &mdash; Landscape, Long Bond Paper (Legal)</span>
    </div>

    <div class="page-wrap">
        {{-- Report Header --}}
        <div class="report-header">
            <img src="{{ asset('assets/img/ched-logo.png') }}" alt="CHED" class="logo-left">
            <div class="header-text">
                <p class="republic">Republic of the Philippines</p>
                <p class="ched">Commission on Higher Education</p>
                <p class="office">{{ $regionName }}</p>
            </div>
            <img src="{{ asset('assets/img/bagong-pilipinas.png') }}" alt="Bagong Pilipinas" class="logo-right">
        </div>

        <div class="report-title">
            <h2>Liquidation Monitoring Sheet</h2>
            @if($activeFilters)
                <p class="subtitle">{{ $activeFilters }}</p>
            @endif
        </div>

        <div class="filter-info">
            Generated on {{ now()->format('F d, Y h:i A') }}
            &mdash; {{ $liquidations->count() }} record(s)
            @if(!empty($truncated) && $truncated)
                <strong>
                    &mdash; showing first {{ number_format($rowCap) }} of {{ number_format($totalMatching) }}. Narrow filters to see the rest.
                </strong>
            @endif
        </div>

        @php
            $cols = [1.5, 3, 10, 6.5, 4, 2.5, 2, 5, 5, 3, 8.5, 8.5, 8.5, 6, 6, 6.5, 4, 3.5];
            // Smart currency format: drop .00 but keep real cents (e.g. 756,490.50)
            function printMoney(float $val): string {
                return fmod($val, 1) == 0
                    ? number_format($val, 0)
                    : number_format($val, 2);
            }
        @endphp

        {{-- Program Summary (consolidated per-program totals) --}}
        @if($programSummary->isNotEmpty())
        <table class="program-summary">
            <thead>
                <tr>
                    <th>Program</th>
                    <th>Records</th>
                    <th>Total Disbursements</th>
                    <th>Amount Liquidated</th>
                    <th>Unliquidated</th>
                    <th>% Age of Liquidation</th>
                </tr>
            </thead>
            <tbody>
                @foreach($programSummary as $ps)
                <tr>
                    <td class="summary-program">{{ $ps['program_code'] }}</td>
                    <td class="text-center">{{ $ps['count'] }}</td>
                    <td class="text-right font-mono nowrap">{{ printMoney($ps['disbursements']) }}</td>
                    <td class="text-right font-mono nowrap">{{ printMoney($ps['liquidated']) }}</td>
                    <td class="text-right font-mono nowrap">{{ printMoney($ps['unliquidated']) }}</td>
                    <td class="text-center font-mono">{{ $ps['percentage'] }}%</td>
                </tr>
                @endforeach
                <tr class="summary-total">
                    <td class="text-right" colspan="2">TOTAL</td>
                    <td class="text-right font-mono nowrap">{{ printMoney($totals['disbursements']) }}</td>
                    <td class="text-right font-mono nowrap">{{ printMoney($totals['liquidated']) }}</td>
                    <td class="text-right font-mono nowrap">{{ printMoney($totals['unliquidated']) }}</td>
                    <td class="text-center font-mono">{{ $totals['disbursements'] > 0 ? round((($totals['liquidated'] + $totals['for_endorsement']) / $totals['disbursements']) * 100, 2) : 0 }}%</td>
                </tr>
            </tbody>
        </table>
        @endif

        {{-- Data Table --}}
        <table>
            <colgroup>
                @foreach($cols as $w)<col style="width:{{ $w }}%">@endforeach
            </colgroup>
            <thead>
                <tr>
                    <th class="col-seq">Seq</th>
                    <th class="col-program">Program</th>
                    <th class="col-hei">HEI</th>
                    <th class="col-control">Control /<br>Ledger No.</th>
                    <th class="col-ay">Acad.<br>Year</th>
                    <th class="col-sem">Sem</th>
                    <th class="col-batch">Batch</th>
                    <th class="col-date">Date Fund<br>Released</th>
                    <th class="col-date">Due Date</th>
                    <th class="col-grantees">No. of<br>Grantees</th>
                    <th class="col-amount">Total<br>Disbursements</th>
                    <th class="col-amount">Amount<br>Liquidated</th>
                    <th class="col-amount">Total<br>Unliquidated</th>
                    <th class="col-status">Document<br>Status</th>
                    <th class="col-rcnotes">RC Notes</th>
                    <th class="col-liqstatus">Liquidation<br>Status</th>
                    <th class="col-pct">%</th>
                    <th class="col-lapsing">Lapsing</th>
                </tr>
            </thead>
            <tbody>
                @forelse($liquidations as $index => $row)
                    <tr>
                        <td class="text-center">{{ $index + 1 }}</td>
                        <td class="text-center" style="font-weight: 600;">{{ $row['program_code'] }}</td>
                        <td class="text-left">{{ $row['hei_name'] }}</td>
                        <td class="font-mono text-center">{{ $row['control_no'] }}</td>
                        <td class="text-center nowrap">{{ $row['academic_year'] }}</td>
                        <td class="text-center">{{ $row['semester'] }}</td>
                        <td class="text-center">{{ $row['batch_no'] }}</td>
                        <td class="text-center nowrap">{{ $row['date_fund_released'] }}</td>
                        <td class="text-center nowrap">{{ $row['due_date'] }}</td>
                        <td class="text-center">{{ $row['number_of_grantees'] }}</td>
                        <td class="text-right font-mono nowrap">{{ printMoney($row['_raw_disbursements']) }}</td>
                        <td class="text-right font-mono nowrap">{{ printMoney($row['_raw_liquidated']) }}</td>
                        <td class="text-right font-mono nowrap">{{ printMoney($row['_raw_unliquidated']) }}</td>
                        <td class="text-center">{{ $row['document_status'] }}</td>
                        <td class="text-center">{{ $row['rc_notes'] }}</td>
                        <td class="text-center">{{ $row['liquidation_status'] }}</td>
                        <td class="text-center font-mono nowrap">{{ $row['percentage'] }}%</td>
                        <td class="text-center">{{ $row['lapsing'] ?: '' }}</td>
                    </tr>
                @empty
                    <tr>
                        <td colspan="18" class="text-center" style="padding: 20px; color: #999;">No records found for the selected filters.</td>
                    </tr>
                @endforelse
            </tbody>
        </table>

        <div class="report-footer">
            <span>UniFAST Liquidation Management System</span>
            <span>Printed by: {{ $printedBy }}</span>
        </div>
    </div>
</body>
</html>
