<?php

declare(strict_types=1);

namespace App\Exports;

use OpenSpout\Common\Entity\Cell;
use OpenSpout\Common\Entity\Cell\NumericCell;
use OpenSpout\Common\Entity\Cell\StringCell;
use OpenSpout\Common\Entity\Row;
use OpenSpout\Common\Entity\Style\Border;
use OpenSpout\Common\Entity\Style\BorderPart;
use OpenSpout\Common\Entity\Style\BorderName;
use OpenSpout\Common\Entity\Style\BorderStyle;
use OpenSpout\Common\Entity\Style\BorderWidth;
use OpenSpout\Common\Entity\Style\CellAlignment;
use OpenSpout\Common\Entity\Style\CellVerticalAlignment;
use OpenSpout\Common\Entity\Style\Color;
use OpenSpout\Common\Entity\Style\Style;
use OpenSpout\Writer\CSV\Writer as CsvWriter;
use OpenSpout\Writer\XLSX\Options as XlsxOptions;
use OpenSpout\Writer\XLSX\Writer as XlsxWriter;
use Symfony\Component\HttpFoundation\StreamedResponse;

/**
 * Streams the liquidation monitoring sheet as an XLSX or CSV download.
 *
 * Layout mirrors resources/views/reports/liquidation-print.blade.php
 * (logos are intentionally omitted — OpenSpout does not support images).
 */
class LiquidationReportExporter
{
    private const COLUMN_COUNT = 18;

    private const DATA_HEADERS = [
        'Seq',
        'Program',
        'HEI',
        'Control / Ledger No.',
        'Acad. Year',
        'Sem',
        'Batch',
        'Date Fund Released',
        'Due Date',
        'No. of Grantees',
        'Total Disbursements',
        'Amount Liquidated',
        'Total Unliquidated',
        'Document Status',
        'RC Notes',
        'Liquidation Status',
        '%',
        'Lapsing',
    ];

    public function stream(array $data, string $format, string $filename): StreamedResponse
    {
        $contentType = $format === 'csv'
            ? 'text/csv; charset=UTF-8'
            : 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

        return new StreamedResponse(function () use ($data, $format) {
            if ($format === 'csv') {
                $writer = new CsvWriter();
                $writer->openToFile('php://output');
                $this->writeCsv($writer, $data);
                $writer->close();
            } else {
                [$writer, $options] = $this->buildXlsxWriter();
                $writer->openToFile('php://output');
                $this->writeXlsx($writer, $options, $data);
                $writer->close();
            }
        }, 200, [
            'Content-Type' => $contentType,
            'Content-Disposition' => 'attachment; filename="' . $filename . '"',
            'Cache-Control' => 'no-store, no-cache, must-revalidate, max-age=0',
            'Pragma' => 'no-cache',
        ]);
    }

    // ── XLSX ───────────────────────────────────────────────────────────────

    /** @return array{0: XlsxWriter, 1: XlsxOptions} */
    private function buildXlsxWriter(): array
    {
        $options = new XlsxOptions();
        $widths = [6, 14, 35, 22, 18, 20, 10, 16, 16, 11, 18, 18, 18, 20, 18, 20, 9, 10];
        foreach ($widths as $i => $w) {
            $options->setColumnWidth((float) $w, $i + 1);
        }
        return [new XlsxWriter($options), $options];
    }

    private function writeXlsx(XlsxWriter $writer, XlsxOptions $options, array $data): void
    {
        $sheet = $writer->getCurrentSheet();
        $sheet->setName('Liquidation Report');

        $titleStyle = (new Style())
            ->withFontBold(true)
            ->withFontSize(12)
            ->withCellAlignment(CellAlignment::CENTER);
        $subTitleStyle = (new Style())
            ->withFontSize(10)
            ->withCellAlignment(CellAlignment::CENTER);
        $reportTitleStyle = (new Style())
            ->withFontBold(true)
            ->withFontSize(13)
            ->withCellAlignment(CellAlignment::CENTER);
        $subtleCenter = (new Style())
            ->withFontItalic(true)
            ->withFontSize(9)
            ->withCellAlignment(CellAlignment::CENTER);

        $rowNum = 0; // 1-indexed count of rows written

        // Title block
        $writer->addRow($this->paddedRow(['Republic of the Philippines'], $subTitleStyle));
        $rowNum++;
        $writer->addRow($this->paddedRow(['Commission on Higher Education'], $titleStyle));
        $rowNum++;
        $writer->addRow($this->paddedRow([$data['regionName'] ?? ''], $subTitleStyle));
        $rowNum++;
        $writer->addRow($this->paddedRow([]));
        $rowNum++;

        // Report title
        $writer->addRow($this->paddedRow(['LIQUIDATION MONITORING SHEET'], $reportTitleStyle));
        $rowNum++;

        if (!empty($data['activeFilters'])) {
            $writer->addRow($this->paddedRow([$data['activeFilters']], $subtleCenter));
            $rowNum++;
        }

        $liquidations = $data['liquidations'] ?? collect();
        $generated = 'Generated on ' . now()->format('F d, Y h:i A')
            . ' — ' . $liquidations->count() . ' record(s)';
        if (!empty($data['truncated'])) {
            $generated .= ' — showing first ' . number_format($data['rowCap'])
                . ' of ' . number_format($data['totalMatching'])
                . '. Narrow filters to see the rest.';
        }
        $writer->addRow($this->paddedRow([$generated], $subtleCenter));
        $rowNum++;
        $writer->addRow($this->paddedRow([]));
        $rowNum++;

        // Merge all header rows across full width. Columns are 0-indexed, rows 1-indexed.
        for ($r = 1; $r <= $rowNum; $r++) {
            $options->mergeCells(0, $r, self::COLUMN_COUNT - 1, $r);
        }

        // Program Summary
        $programSummary = $data['programSummary'] ?? collect();
        if ($programSummary->isNotEmpty()) {
            $summaryHeaderStyle = $this->summaryHeaderStyle();
            $summaryBodyStyle = $this->borderedStyle();
            $summaryMoneyStyle = $this->borderedStyle()->withFormat('#,##0.00');
            $summaryPctStyle = $this->borderedStyle()->withFormat('0.00%');
            $summaryTotalText = $summaryBodyStyle
                ->withFontBold(true)
                ->withBackgroundColor('F3F4F6');
            $summaryTotalMoney = $summaryMoneyStyle
                ->withFontBold(true)
                ->withBackgroundColor('F3F4F6');
            $summaryTotalPct = $summaryPctStyle
                ->withFontBold(true)
                ->withBackgroundColor('F3F4F6');

            $writer->addRow($this->styledRow(
                ['Program', 'Records', 'Total Disbursements', 'Amount Liquidated', 'Unliquidated', '% Age of Liquidation'],
                $summaryHeaderStyle
            ));
            $rowNum++;

            foreach ($programSummary as $ps) {
                $writer->addRow(new Row([
                    new StringCell((string) $ps['program_code'], $summaryBodyStyle),
                    new NumericCell((int) $ps['count'], $summaryBodyStyle),
                    new NumericCell((float) $ps['disbursements'], $summaryMoneyStyle),
                    new NumericCell((float) $ps['liquidated'], $summaryMoneyStyle),
                    new NumericCell((float) $ps['unliquidated'], $summaryMoneyStyle),
                    new NumericCell(((float) $ps['percentage']) / 100, $summaryPctStyle),
                ]));
                $rowNum++;
            }

            $totals = $data['totals'];
            $pct = $totals['disbursements'] > 0
                ? (($totals['liquidated'] + $totals['for_endorsement']) / $totals['disbursements'])
                : 0.0;
            $writer->addRow(new Row([
                new StringCell('TOTAL', $summaryTotalText),
                new StringCell('', $summaryTotalText),
                new NumericCell((float) $totals['disbursements'], $summaryTotalMoney),
                new NumericCell((float) $totals['liquidated'], $summaryTotalMoney),
                new NumericCell((float) $totals['unliquidated'], $summaryTotalMoney),
                new NumericCell((float) $pct, $summaryTotalPct),
            ]));
            $rowNum++;

            $writer->addRow($this->paddedRow([]));
            $rowNum++;
            $writer->addRow($this->paddedRow([]));
            $rowNum++;
        }

        // Data header
        $dataHeaderStyle = $this->dataHeaderStyle();
        $writer->addRow($this->styledRow(self::DATA_HEADERS, $dataHeaderStyle));
        $rowNum++;

        $bodyCenter = $this->borderedStyle()->withCellAlignment(CellAlignment::CENTER);
        $bodyLeft = $this->borderedStyle();
        $moneyStyle = $this->borderedStyle()
            ->withFormat('#,##0.00')
            ->withCellAlignment(CellAlignment::RIGHT);
        $pctStyle = $this->borderedStyle()
            ->withFormat('0.00%')
            ->withCellAlignment(CellAlignment::CENTER);

        foreach ($liquidations as $index => $row) {
            $writer->addRow(new Row([
                new NumericCell($index + 1, $bodyCenter),
                new StringCell((string) ($row['program_code'] ?? ''), $bodyCenter),
                new StringCell((string) ($row['hei_name'] ?? ''), $bodyLeft),
                new StringCell((string) ($row['control_no'] ?? ''), $bodyCenter),
                new StringCell((string) ($row['academic_year'] ?? ''), $bodyCenter),
                new StringCell((string) ($row['semester'] ?? ''), $bodyCenter),
                new StringCell((string) ($row['batch_no'] ?? ''), $bodyCenter),
                new StringCell((string) ($row['date_fund_released'] ?? ''), $bodyCenter),
                new StringCell((string) ($row['due_date'] ?? ''), $bodyCenter),
                new NumericCell((int) ($row['number_of_grantees'] ?? 0), $bodyCenter),
                new NumericCell((float) ($row['_raw_disbursements'] ?? 0), $moneyStyle),
                new NumericCell((float) ($row['_raw_liquidated'] ?? 0), $moneyStyle),
                new NumericCell((float) ($row['_raw_unliquidated'] ?? 0), $moneyStyle),
                new StringCell((string) ($row['document_status'] ?? ''), $bodyCenter),
                new StringCell((string) ($row['rc_notes'] ?? ''), $bodyCenter),
                new StringCell((string) ($row['liquidation_status'] ?? ''), $bodyCenter),
                new NumericCell(((float) ($row['percentage'] ?? 0)) / 100, $pctStyle),
                new StringCell($row['lapsing'] ? (string) $row['lapsing'] : '', $bodyCenter),
            ]));
            $rowNum++;
        }

        // Grand total row
        if ($liquidations->isNotEmpty()) {
            $totals = $data['totals'];
            $pct = $totals['disbursements'] > 0
                ? (($totals['liquidated'] + $totals['for_endorsement']) / $totals['disbursements'])
                : 0.0;

            $totalText = $this->borderedStyle()
                ->withFontBold(true)
                ->withBackgroundColor('F3F4F6')
                ->withCellAlignment(CellAlignment::CENTER);
            $totalMoney = $this->borderedStyle()
                ->withFontBold(true)
                ->withBackgroundColor('F3F4F6')
                ->withFormat('#,##0.00')
                ->withCellAlignment(CellAlignment::RIGHT);
            $totalPct = $this->borderedStyle()
                ->withFontBold(true)
                ->withBackgroundColor('F3F4F6')
                ->withFormat('0.00%')
                ->withCellAlignment(CellAlignment::CENTER);

            $cells = [];
            for ($i = 0; $i < 9; $i++) {
                $cells[] = new StringCell('', $totalText);
            }
            $cells[] = new StringCell('TOTAL', $totalText);
            $cells[] = new NumericCell((float) $totals['disbursements'], $totalMoney);
            $cells[] = new NumericCell((float) $totals['liquidated'], $totalMoney);
            $cells[] = new NumericCell((float) $totals['unliquidated'], $totalMoney);
            for ($i = 0; $i < 3; $i++) {
                $cells[] = new StringCell('', $totalText);
            }
            $cells[] = new NumericCell((float) $pct, $totalPct);
            $cells[] = new StringCell('', $totalText);
            $writer->addRow(new Row($cells));
            $rowNum++;
        }

        // Footer
        $writer->addRow($this->paddedRow([]));
        $rowNum++;
        $footerStyle = (new Style())->withFontItalic(true)->withFontSize(9);
        $footerCells = array_fill(0, self::COLUMN_COUNT, '');
        $footerCells[0] = 'UniFAST Liquidation Management System';
        $footerCells[16] = 'Printed by:';
        $footerCells[17] = (string) ($data['printedBy'] ?? '');
        $writer->addRow($this->styledRow($footerCells, $footerStyle));
    }

    // ── CSV ────────────────────────────────────────────────────────────────

    private function writeCsv(CsvWriter $writer, array $data): void
    {
        $writer->addRow(Row::fromValues(['Republic of the Philippines']));
        $writer->addRow(Row::fromValues(['Commission on Higher Education']));
        $writer->addRow(Row::fromValues([$data['regionName'] ?? '']));
        $writer->addRow(Row::fromValues([]));
        $writer->addRow(Row::fromValues(['LIQUIDATION MONITORING SHEET']));
        if (!empty($data['activeFilters'])) {
            $writer->addRow(Row::fromValues([$data['activeFilters']]));
        }

        $liquidations = $data['liquidations'] ?? collect();
        $generated = 'Generated on ' . now()->format('F d, Y h:i A')
            . ' — ' . $liquidations->count() . ' record(s)';
        if (!empty($data['truncated'])) {
            $generated .= ' — showing first ' . number_format($data['rowCap'])
                . ' of ' . number_format($data['totalMatching'])
                . '. Narrow filters to see the rest.';
        }
        $writer->addRow(Row::fromValues([$generated]));
        $writer->addRow(Row::fromValues([]));

        $programSummary = $data['programSummary'] ?? collect();
        if ($programSummary->isNotEmpty()) {
            $writer->addRow(Row::fromValues([
                'Program', 'Records', 'Total Disbursements', 'Amount Liquidated', 'Unliquidated', '% Age of Liquidation',
            ]));
            foreach ($programSummary as $ps) {
                $writer->addRow(Row::fromValues([
                    $ps['program_code'],
                    (int) $ps['count'],
                    number_format((float) $ps['disbursements'], 2, '.', ''),
                    number_format((float) $ps['liquidated'], 2, '.', ''),
                    number_format((float) $ps['unliquidated'], 2, '.', ''),
                    $ps['percentage'] . '%',
                ]));
            }

            $totals = $data['totals'];
            $pct = $totals['disbursements'] > 0
                ? round((($totals['liquidated'] + $totals['for_endorsement']) / $totals['disbursements']) * 100, 2)
                : 0;
            $writer->addRow(Row::fromValues([
                'TOTAL', '',
                number_format((float) $totals['disbursements'], 2, '.', ''),
                number_format((float) $totals['liquidated'], 2, '.', ''),
                number_format((float) $totals['unliquidated'], 2, '.', ''),
                $pct . '%',
            ]));
            $writer->addRow(Row::fromValues([]));
            $writer->addRow(Row::fromValues([]));
        }

        $writer->addRow(Row::fromValues(self::DATA_HEADERS));

        foreach ($liquidations as $index => $row) {
            $writer->addRow(Row::fromValues([
                $index + 1,
                $row['program_code'] ?? '',
                $row['hei_name'] ?? '',
                $row['control_no'] ?? '',
                $row['academic_year'] ?? '',
                $row['semester'] ?? '',
                $row['batch_no'] ?? '',
                $row['date_fund_released'] ?? '',
                $row['due_date'] ?? '',
                (int) ($row['number_of_grantees'] ?? 0),
                number_format((float) ($row['_raw_disbursements'] ?? 0), 2, '.', ''),
                number_format((float) ($row['_raw_liquidated'] ?? 0), 2, '.', ''),
                number_format((float) ($row['_raw_unliquidated'] ?? 0), 2, '.', ''),
                $row['document_status'] ?? '',
                $row['rc_notes'] ?? '',
                $row['liquidation_status'] ?? '',
                ($row['percentage'] ?? 0) . '%',
                $row['lapsing'] ?: '',
            ]));
        }

        if ($liquidations->isNotEmpty()) {
            $totals = $data['totals'];
            $pct = $totals['disbursements'] > 0
                ? round((($totals['liquidated'] + $totals['for_endorsement']) / $totals['disbursements']) * 100, 2)
                : 0;
            $writer->addRow(Row::fromValues([
                '', '', '', '', '', '', '', '', '', 'TOTAL',
                number_format((float) $totals['disbursements'], 2, '.', ''),
                number_format((float) $totals['liquidated'], 2, '.', ''),
                number_format((float) $totals['unliquidated'], 2, '.', ''),
                '', '', '',
                $pct . '%',
                '',
            ]));
        }

        $writer->addRow(Row::fromValues([]));
        $writer->addRow(Row::fromValues([
            'UniFAST Liquidation Management System',
            '', '', '', '', '', '', '', '', '', '', '', '', '', '', '',
            'Printed by:', (string) ($data['printedBy'] ?? ''),
        ]));
    }

    // ── Style helpers ──────────────────────────────────────────────────────

    private function borderedStyle(): Style
    {
        $border = new Border(
            new BorderPart(BorderName::TOP, 'CCCCCC', BorderWidth::THIN, BorderStyle::SOLID),
            new BorderPart(BorderName::BOTTOM, 'CCCCCC', BorderWidth::THIN, BorderStyle::SOLID),
            new BorderPart(BorderName::LEFT, 'CCCCCC', BorderWidth::THIN, BorderStyle::SOLID),
            new BorderPart(BorderName::RIGHT, 'CCCCCC', BorderWidth::THIN, BorderStyle::SOLID),
        );
        return (new Style())
            ->withBorder($border)
            ->withCellVerticalAlignment(CellVerticalAlignment::CENTER);
    }

    private function summaryHeaderStyle(): Style
    {
        return $this->borderedStyle()
            ->withFontBold(true)
            ->withBackgroundColor('E5E7EB')
            ->withCellAlignment(CellAlignment::CENTER);
    }

    private function dataHeaderStyle(): Style
    {
        return $this->borderedStyle()
            ->withFontBold(true)
            ->withFontColor(Color::WHITE)
            ->withBackgroundColor('1F2937')
            ->withCellAlignment(CellAlignment::CENTER)
            ->withCellVerticalAlignment(CellVerticalAlignment::CENTER)
            ->withShouldWrapText(true);
    }

    /** Build a row padded to COLUMN_COUNT so merges line up. */
    private function paddedRow(array $values, ?Style $style = null): Row
    {
        $padded = array_pad($values, self::COLUMN_COUNT, '');
        return $style ? $this->styledRow($padded, $style) : Row::fromValues($padded);
    }

    /** Build a row where every cell shares the same style. */
    private function styledRow(array $values, Style $style): Row
    {
        $cells = array_map(
            fn ($v) => Cell::fromValue($v, $style),
            $values
        );
        return new Row(array_values($cells));
    }
}
