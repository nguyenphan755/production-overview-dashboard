import { saveAs } from 'file-saver';
import ExcelJS from 'exceljs';
import type { SpeedLabStopBlock } from '../types/oee-analytics-lab';
import { getProductionDayLabelDate } from './shiftCalculator';
import { downtimeMinStopLabelVi } from '../constants/downtime-threshold';

type DowntimeReportInput = {
  machineId: string;
  machineName: string;
  selectedStartMs: number;
  selectedEndMs: number;
  /** YYYY-MM-DD — first production day in export filter */
  exportFromYmd: string;
  /** YYYY-MM-DD — last production day in export filter */
  exportToYmd: string;
  shiftLabel: string;
  stopBlocks: SpeedLabStopBlock[];
};

type ExportStopRow = SpeedLabStopBlock & {
  startMs: number;
  endMs: number;
  durationSec: number;
  productionDayYmd: string;
};

type DayGroup = {
  dayYmd: string;
  stops: ExportStopRow[];
  totalSec: number;
};

const ICT_OFFSET_MS = 7 * 60 * 60 * 1000;
const EXCEL_UNIX_EPOCH_DAYS = 25569;
const LAST_COL = 'I';
const COLUMN_COUNT = 9;

/** Minimum width (Excel char units) per column: STT → Hành động */
const COLUMN_MIN_WIDTHS = [5, 12, 13, 13, 12, 10, 14, 22, 22];
const COLUMN_MAX_WIDTHS = [8, 14, 14, 14, 14, 12, 28, 40, 40];
const AUTO_FIT_PADDING = 1.8;

function toExcelIctSerial(ms: number): number {
  return (ms + ICT_OFFSET_MS) / 86_400_000 + EXCEL_UNIX_EPOCH_DAYS;
}

function ymdToExcelDateSerial(ymd: string): number {
  const [y, m, d] = ymd.split('-').map((part) => parseInt(part, 10));
  return toExcelIctSerial(
    new Date(
      `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}T12:00:00+07:00`
    ).getTime()
  );
}

function timeSerialFromMs(ms: number): number {
  const full = toExcelIctSerial(ms);
  return full - Math.floor(full);
}

function formatYmdVi(ymd: string): string {
  const [y, m, d] = ymd.split('-');
  return `${d}/${m}/${y}`;
}

function formatIct(ms: number): string {
  return new Date(ms).toLocaleString('vi-VN', {
    timeZone: 'Asia/Ho_Chi_Minh',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  });
}

function safeFilePart(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9_-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 50);
}

function prepareStopRows(
  stopBlocks: SpeedLabStopBlock[],
  rangeStartMs: number,
  rangeEndMs: number
): ExportStopRow[] {
  return stopBlocks
    .filter((block) => block.endMs > rangeStartMs && block.startMs < rangeEndMs)
    .map((block) => {
      const startMs = Math.max(block.startMs, rangeStartMs);
      const endMs = Math.min(block.endMs, rangeEndMs);
      return {
        ...block,
        startMs,
        endMs,
        durationSec: Math.max(0, (endMs - startMs) / 1000),
        productionDayYmd: getProductionDayLabelDate(new Date(startMs)),
      };
    })
    .sort((a, b) => a.startMs - b.startMs || a.endMs - b.endMs);
}

function groupByProductionDay(stops: ExportStopRow[]): DayGroup[] {
  const map = new Map<string, ExportStopRow[]>();
  for (const stop of stops) {
    const list = map.get(stop.productionDayYmd) ?? [];
    list.push(stop);
    map.set(stop.productionDayYmd, list);
  }
  return [...map.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([dayYmd, dayStops]) => ({
      dayYmd,
      stops: dayStops,
      totalSec: dayStops.reduce((sum, row) => sum + row.durationSec, 0),
    }));
}

function applyHeaderStyle(
  row: import('exceljs').Row,
  fillArgb = 'FF0E2F4F',
  fontSize = 10
) {
  row.eachCell((cell) => {
    cell.font = { name: 'Arial', size: fontSize, bold: true, color: { argb: 'FFFFFFFF' } };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: fillArgb } };
    cell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
    cell.border = {
      top: { style: 'thin', color: { argb: 'FFB4C6E7' } },
      left: { style: 'thin', color: { argb: 'FFB4C6E7' } },
      bottom: { style: 'thin', color: { argb: 'FFB4C6E7' } },
      right: { style: 'thin', color: { argb: 'FFB4C6E7' } },
    };
  });
}

function applyDataRowStyle(row: import('exceljs').Row, zebra: boolean) {
  row.font = { name: 'Arial', size: 10 };
  row.eachCell((cell) => {
    cell.border = {
      top: { style: 'hair', color: { argb: 'FFD9E2F3' } },
      left: { style: 'hair', color: { argb: 'FFD9E2F3' } },
      bottom: { style: 'hair', color: { argb: 'FFD9E2F3' } },
      right: { style: 'hair', color: { argb: 'FFD9E2F3' } },
    };
    if (zebra) {
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF2F6FC' } };
    }
  });
}

function columnLettersToNumber(col: string): number {
  let value = 0;
  for (const ch of col) {
    value = value * 26 + (ch.charCodeAt(0) - 64);
  }
  return value;
}

function parseCellAddress(address: string): { col: number; row: number } | null {
  const match = address.match(/^([A-Z]+)(\d+)$/);
  if (!match) return null;
  return { col: columnLettersToNumber(match[1]), row: parseInt(match[2], 10) };
}

function getMergeSpan(
  sheet: import('exceljs').Worksheet,
  rowNumber: number,
  colNumber: number
): { colSpan: number; startCol: number; endCol: number; isMaster: boolean } | null {
  const merges = sheet.model.merges ?? [];
  for (const range of merges) {
    const [startAddr, endAddr = startAddr] = range.split(':');
    const start = parseCellAddress(startAddr);
    const end = parseCellAddress(endAddr);
    if (!start || !end) continue;
    if (
      rowNumber >= start.row &&
      rowNumber <= end.row &&
      colNumber >= start.col &&
      colNumber <= end.col
    ) {
      return {
        colSpan: end.col - start.col + 1,
        startCol: start.col,
        endCol: end.col,
        isMaster: rowNumber === start.row && colNumber === start.col,
      };
    }
  }
  return null;
}

/** Approximate display width — Vietnamese / full-width chars count slightly wider. */
function measureDisplayText(text: string): number {
  let width = 0;
  for (const ch of text) {
    const code = ch.codePointAt(0) ?? 0;
    width += code > 255 ? 1.15 : 1;
  }
  return width;
}

function measureCellDisplayWidth(cell: import('exceljs').Cell): number {
  const formatted = cell.text?.trim();
  if (formatted) return measureDisplayText(formatted);

  const value = cell.value;
  if (value == null || value === '') return 0;
  if (typeof value === 'number') {
    if (cell.numFmt === 'dd/mm/yyyy') return 10;
    if (cell.numFmt === 'hh:mm:ss') return 8;
    if (cell.numFmt === '[h]:mm:ss') return 9;
    if (cell.numFmt === '0.00') return measureDisplayText(value.toFixed(2));
    return measureDisplayText(String(value));
  }
  if (typeof value === 'string') return measureDisplayText(value);
  if (value instanceof Date) return 19;
  return measureDisplayText(String(value));
}

/** Auto-fit column widths from rendered cell text (handles merged cells). */
function autoFitWorksheetColumns(sheet: import('exceljs').Worksheet, columnCount: number) {
  const maxWidths = Array.from({ length: columnCount }, (_, index) => COLUMN_MIN_WIDTHS[index] ?? 10);

  sheet.eachRow({ includeEmpty: false }, (row) => {
    for (let col = 1; col <= columnCount; col += 1) {
      const merge = getMergeSpan(sheet, row.number, col);
      if (merge && !merge.isMaster) continue;

      const cell = row.getCell(col);
      let width = measureCellDisplayWidth(cell);
      if (merge && merge.colSpan > 1) {
        width /= merge.colSpan;
        for (let mergedCol = merge.startCol; mergedCol <= merge.endCol; mergedCol += 1) {
          maxWidths[mergedCol - 1] = Math.max(maxWidths[mergedCol - 1], width);
        }
      } else {
        maxWidths[col - 1] = Math.max(maxWidths[col - 1], width);
      }
    }
  });

  for (let col = 1; col <= columnCount; col += 1) {
    const minW = COLUMN_MIN_WIDTHS[col - 1] ?? 10;
    const maxW = COLUMN_MAX_WIDTHS[col - 1] ?? 45;
    const fitted = Math.min(maxW, Math.max(minW, maxWidths[col - 1] + AUTO_FIT_PADDING));
    sheet.getColumn(col).width = fitted;
  }
}

function triggerBlobDownload(blob: Blob, filename: string) {
  try {
    saveAs(blob, filename);
    return;
  } catch {
    // saveAs can fail after long async work — fallback to manual anchor click.
  }
  const blobUrl = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = blobUrl;
  anchor.download = filename;
  anchor.rel = 'noopener';
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  window.setTimeout(() => URL.revokeObjectURL(blobUrl), 60_000);
}

export async function exportDowntimeReport(input: DowntimeReportInput): Promise<void> {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'Production Overview Dashboard';
  workbook.created = new Date();
  workbook.modified = new Date();
  workbook.company = 'CADIVI';

  const sheet = workbook.addWorksheet('Báo cáo downtime', {
    pageSetup: {
      paperSize: 9,
      orientation: 'landscape',
      fitToPage: true,
      fitToWidth: 1,
      fitToHeight: 0,
      margins: { left: 0.25, right: 0.25, top: 0.5, bottom: 0.5, header: 0.2, footer: 0.2 },
    },
  });

  sheet.properties.defaultRowHeight = 20;

  const stops = prepareStopRows(input.stopBlocks, input.selectedStartMs, input.selectedEndMs);
  const dayGroups = groupByProductionDay(stops);
  const totalStops = stops.length;
  const totalDurationSec = stops.reduce((sum, row) => sum + row.durationSec, 0);

  sheet.mergeCells(`A1:${LAST_COL}1`);
  const title = sheet.getCell('A1');
  title.value = 'BÁO CÁO PHÂN TÍCH DOWNTIME SẢN XUẤT';
  title.font = { name: 'Arial', size: 16, bold: true, color: { argb: 'FFFFFFFF' } };
  title.alignment = { horizontal: 'center', vertical: 'middle' };
  title.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF0E2F4F' } };
  sheet.getRow(1).height = 30;

  const metadata: Array<[string, string, string, string]> = [
    ['Mã máy', input.machineId, 'Tên máy / dây chuyền', input.machineName],
    [
      'Khoảng ngày chọn',
      `${formatYmdVi(input.exportFromYmd)} → ${formatYmdVi(input.exportToYmd)}`,
      'Số ngày có dữ liệu',
      String(dayGroups.length),
    ],
    [
      'Ghi chú',
      input.shiftLabel,
      'Tiêu chí',
      'Đoạn dừng ' + downtimeMinStopLabelVi() + ' · dữ liệu raw oee_calculations (~1 Hz)',
    ],
    [
      'Thời gian xuất',
      formatIct(Date.now()),
      'Tổng lần dừng',
      String(totalStops),
    ],
  ];

  metadata.forEach((values, index) => {
    const rowNumber = index + 3;
    sheet.mergeCells(`B${rowNumber}:D${rowNumber}`);
    sheet.mergeCells(`F${rowNumber}:${LAST_COL}${rowNumber}`);
    sheet.getCell(`A${rowNumber}`).value = values[0];
    sheet.getCell(`B${rowNumber}`).value = values[1];
    sheet.getCell(`E${rowNumber}`).value = values[2];
    sheet.getCell(`F${rowNumber}`).value = values[3];
    for (const labelCell of [`A${rowNumber}`, `E${rowNumber}`]) {
      sheet.getCell(labelCell).font = { name: 'Arial', bold: true, color: { argb: 'FF0E2F4F' } };
      sheet.getCell(labelCell).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFDDEBF7' } };
    }
  });

  let rowNumber = 8;
  sheet.getCell(`A${rowNumber}`).value = 'TỔNG HỢP THEO NGÀY';
  sheet.getCell(`A${rowNumber}`).font = { name: 'Arial', bold: true, color: { argb: 'FFFFFFFF' } };
  sheet.getCell(`A${rowNumber}`).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF4472C4' } };
  sheet.mergeCells(`B${rowNumber}:${LAST_COL}${rowNumber}`);
  sheet.getCell(`B${rowNumber}`).value =
    `Tổng ${totalStops} lần dừng · ${(totalDurationSec / 60).toFixed(1)} phút · ${dayGroups.length} ngày`;
  sheet.getCell(`B${rowNumber}`).font = { name: 'Arial', bold: true, color: { argb: 'FFFFFFFF' } };
  sheet.getCell(`B${rowNumber}`).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF4472C4' } };

  rowNumber += 1;
  const summaryHeader = sheet.getRow(rowNumber);
  summaryHeader.values = ['Ngày', 'Số lần dừng', 'Tổng thời lượng', 'Tổng phút', '', '', '', '', ''];
  applyHeaderStyle(summaryHeader, 'FF5B7EA6');
  rowNumber += 1;

  for (const group of dayGroups) {
    const row = sheet.getRow(rowNumber);
    row.getCell(1).value = ymdToExcelDateSerial(group.dayYmd);
    row.getCell(1).numFmt = 'dd/mm/yyyy';
    row.getCell(2).value = group.stops.length;
    row.getCell(3).value = group.totalSec / 86_400;
    row.getCell(3).numFmt = '[h]:mm:ss';
    row.getCell(4).value = group.totalSec / 60;
    row.getCell(4).numFmt = '0.00';
    applyDataRowStyle(row, rowNumber % 2 === 0);
    rowNumber += 1;
  }

  rowNumber += 1;
  sheet.getCell(`A${rowNumber}`).value = 'CHI TIẾT TỪNG LẦN DỪNG (theo ngày)';
  sheet.getCell(`A${rowNumber}`).font = { name: 'Arial', bold: true, color: { argb: 'FFFFFFFF' } };
  sheet.getCell(`A${rowNumber}`).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF4472C4' } };
  sheet.mergeCells(`B${rowNumber}:${LAST_COL}${rowNumber}`);
  sheet.getCell(`B${rowNumber}`).value =
    'Mỗi ngày: số thứ tự lần dừng · giờ bắt đầu → giờ kết thúc';
  sheet.getCell(`B${rowNumber}`).font = { name: 'Arial', italic: true, color: { argb: 'FFFFFFFF' } };
  sheet.getCell(`B${rowNumber}`).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF4472C4' } };
  rowNumber += 1;

  const detailHeaderRowNumber = rowNumber;
  const detailHeader = sheet.getRow(rowNumber);
  detailHeader.values = [
    'STT',
    'Ngày',
    'Giờ bắt đầu',
    'Giờ kết thúc',
    'Thời lượng',
    'Số phút',
    'Phân loại',
    'Nguyên nhân',
    'Hành động',
  ];
  applyHeaderStyle(detailHeader);
  rowNumber += 1;

  for (const group of dayGroups) {
    const banner = sheet.getRow(rowNumber);
    sheet.mergeCells(`A${rowNumber}:${LAST_COL}${rowNumber}`);
    banner.getCell(1).value =
      `Ngày ${formatYmdVi(group.dayYmd)} — ${group.stops.length} lần dừng · tổng ${(group.totalSec / 60).toFixed(1)} phút`;
    banner.getCell(1).font = { name: 'Arial', bold: true, color: { argb: 'FF0E2F4F' } };
    banner.getCell(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE2EFDA' } };
    banner.getCell(1).alignment = { horizontal: 'left' };
    rowNumber += 1;

    group.stops.forEach((stop, index) => {
      const row = sheet.getRow(rowNumber);
      row.values = [
        index + 1,
        ymdToExcelDateSerial(group.dayYmd),
        timeSerialFromMs(stop.startMs),
        timeSerialFromMs(stop.endMs),
        stop.durationSec / 86_400,
        stop.durationSec / 60,
        '',
        '',
        '',
      ];
      row.getCell(2).numFmt = 'dd/mm/yyyy';
      row.getCell(3).numFmt = 'hh:mm:ss';
      row.getCell(4).numFmt = 'hh:mm:ss';
      row.getCell(5).numFmt = '[h]:mm:ss';
      row.getCell(6).numFmt = '0.00';
      row.getCell(1).alignment = { horizontal: 'center' };
      row.getCell(2).alignment = { horizontal: 'center' };
      row.getCell(3).alignment = { horizontal: 'center' };
      row.getCell(4).alignment = { horizontal: 'center' };
      row.getCell(5).alignment = { horizontal: 'center' };
      applyDataRowStyle(row, index % 2 === 1);
      rowNumber += 1;
    });
  }

  autoFitWorksheetColumns(sheet, COLUMN_COUNT);

  sheet.views = [{ state: 'frozen', ySplit: detailHeaderRowNumber, activeCell: `A${detailHeaderRowNumber + 1}` }];
  sheet.autoFilter = { from: `A${detailHeaderRowNumber}`, to: `${LAST_COL}${rowNumber - 1}` };
  sheet.pageSetup.printArea = `A1:${LAST_COL}${rowNumber - 1}`;
  sheet.pageSetup.printTitlesRow = `${detailHeaderRowNumber}:${detailHeaderRowNumber}`;

  const buffer = await workbook.xlsx.writeBuffer();
  const blob = new Blob([buffer], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
  const machinePart = safeFilePart(input.machineName || input.machineId) || 'machine';
  const fromPart = safeFilePart(input.exportFromYmd) || 'from';
  const toPart = safeFilePart(input.exportToYmd) || 'to';
  const filename = `bao-cao-downtime-${machinePart}-${fromPart}_${toPart}-${timestamp}.xlsx`;
  triggerBlobDownload(blob, filename);
}
