import type { AnnotationOptions } from 'chartjs-plugin-annotation';
import type { ProductSpeedNote, SpeedReferenceLines } from './equipment-speed-analysis-chart';
import { productNoteBandColor } from './equipment-speed-analysis-chart';

export type SpeedReferenceAnnotationWindow = {
  windowStartMs: number;
  windowEndMs: number;
  yMin: number;
  yMax: number;
};

export type SpeedLabChartOverlay = {
  referenceLines?: SpeedReferenceLines | null;
  proposedTargetSpeed?: number | null;
  productNotes?: ProductSpeedNote[];
};

/** Guide lines — behind speed datasets so they do not cover the trend line. */
function guideLineAnnotation(
  y: number,
  borderColor: string,
  borderDash?: number[]
): AnnotationOptions {
  return {
    type: 'line',
    yMin: y,
    yMax: y,
    borderColor,
    ...(borderDash ? { borderDash } : {}),
    borderWidth: 2,
    drawTime: 'beforeDatasetsDraw',
  };
}

/** Text label at right edge — after datasets, no line stroke. */
function guideLabelAnnotation(
  y: number,
  content: string,
  color: string,
  windowStartMs: number,
  windowEndMs: number,
  align: 'start' | 'end' = 'end'
): AnnotationOptions {
  return {
    type: 'label',
    drawTime: 'afterDatasetsDraw',
    xValue: align === 'end' ? windowEndMs : windowStartMs,
    yValue: y,
    content,
    color,
    font: { size: 11, weight: 'bold' },
    position: { x: align, y: 'center' },
    xAdjust: align === 'end' ? -4 : 4,
    backgroundColor: 'rgba(10, 30, 58, 0.75)',
    padding: 4,
  };
}

/** Horizontal V_KTCN / V_design guide lines + standard/optimal bands (Equipment Details parity). */
export function buildSpeedReferenceAnnotations(
  refs: SpeedReferenceLines,
  win: SpeedReferenceAnnotationWindow
): Record<string, AnnotationOptions> {
  const { windowStartMs, windowEndMs, yMin, yMax } = win;
  const annotations: Record<string, AnnotationOptions> = {};

  if (refs.vKtcn != null && refs.vKtcn > 0) {
    annotations.bandVktcn = {
      type: 'box',
      xMin: windowStartMs,
      xMax: windowEndMs,
      yMin,
      yMax: refs.vKtcn,
      backgroundColor: 'rgba(79, 255, 188, 0.12)',
      borderWidth: 0,
      drawTime: 'beforeDatasetsDraw',
    };
  }

  if (refs.vKtcn != null && refs.vDesign != null && refs.vDesign > refs.vKtcn) {
    annotations.bandVdesign = {
      type: 'box',
      xMin: windowStartMs,
      xMax: windowEndMs,
      yMin: refs.vKtcn,
      yMax: refs.vDesign,
      backgroundColor: 'rgba(239, 68, 68, 0.08)',
      borderWidth: 0,
      drawTime: 'beforeDatasetsDraw',
    };
  }

  if (refs.vKtcn != null && refs.vKtcn > 0) {
    annotations.lineVktcn = guideLineAnnotation(refs.vKtcn, 'rgba(79, 255, 188, 0.7)');
    annotations.labelVktcn = guideLabelAnnotation(
      refs.vKtcn,
      'V_KTCN',
      '#4FFFBC',
      windowStartMs,
      windowEndMs
    );
  }

  if (refs.vDesign != null && refs.vDesign > 0 && refs.vDesign <= yMax) {
    annotations.lineVdesign = guideLineAnnotation(refs.vDesign, 'rgba(255, 255, 255, 0.7)');
    annotations.labelVdesign = guideLabelAnnotation(
      refs.vDesign,
      'V_design',
      '#ffffff',
      windowStartMs,
      windowEndMs
    );
  }

  return annotations;
}

/** V_KTCN/V_design + ICT đề xuất + dải PO — overlay only, không đổi datasets Speed Lab. */
export function buildSpeedLabChartAnnotations(
  overlay: SpeedLabChartOverlay,
  win: SpeedReferenceAnnotationWindow
): Record<string, AnnotationOptions> {
  const annotations: Record<string, AnnotationOptions> = overlay.referenceLines
    ? buildSpeedReferenceAnnotations(overlay.referenceLines, win)
    : {};

  const { windowStartMs, windowEndMs, yMin, yMax } = win;

  if (overlay.proposedTargetSpeed != null && overlay.proposedTargetSpeed > 0) {
    annotations.lineProposed = guideLineAnnotation(overlay.proposedTargetSpeed, 'rgba(255, 184, 108, 0.6)', [
      5, 5,
    ]);
    annotations.labelProposed = guideLabelAnnotation(
      overlay.proposedTargetSpeed,
      'ICT đề xuất',
      '#FFB86C',
      windowStartMs,
      windowEndMs,
      'start'
    );
  }

  overlay.productNotes?.forEach((note, i) => {
    const x1 = new Date(note.segmentStart).getTime();
    const x2 = new Date(note.segmentEnd).getTime();
    if (!Number.isFinite(x1) || !Number.isFinite(x2) || x2 <= x1) return;
    const color = productNoteBandColor(i);
    annotations[`product-${i}`] = {
      type: 'box',
      xMin: x1,
      xMax: x2,
      yMin,
      yMax,
      backgroundColor: `${color}12`,
      borderColor: `${color}40`,
      borderWidth: 1,
      drawTime: 'beforeDatasetsDraw',
    };
  });

  return annotations;
}

export function hasSpeedLabChartOverlay(overlay: SpeedLabChartOverlay | null | undefined): boolean {
  if (!overlay) return false;
  if (overlay.referenceLines?.vKtcn != null || overlay.referenceLines?.vDesign != null) return true;
  if (overlay.proposedTargetSpeed != null && overlay.proposedTargetSpeed > 0) return true;
  return (overlay.productNotes?.length ?? 0) > 0;
}

/** Extend Y max so overlay lines stay visible without changing bucket data. */
export function yMaxForSpeedReferenceLines(
  dataPeak: number,
  refs: SpeedReferenceLines | null | undefined,
  isDrawing: boolean,
  proposedTargetSpeed?: number | null
): number | undefined {
  const cap = isDrawing ? 50 : 2000;
  const refPeak = Math.max(
    dataPeak,
    refs?.vKtcn ?? 0,
    refs?.vDesign ?? 0,
    proposedTargetSpeed ?? 0
  );
  if (refPeak <= 0) return undefined;
  return Math.min(cap, Math.max(refPeak * 1.08, 1));
}
