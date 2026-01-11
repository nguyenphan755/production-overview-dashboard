// Export utilities for Analytics dashboard
import PptxGenJS from 'pptxgenjs';
import html2canvas from 'html2canvas';
import { saveAs } from 'file-saver';

export interface ExportOptions {
  timeRange: string;
  selectedArea: string;
  timestamp: string;
}

/**
 * Export Analytics dashboard to PowerPoint
 */
export async function exportToPowerPoint(
  containerElement: HTMLElement,
  options: ExportOptions,
  data: {
    oeeMetrics: any;
    ngMetrics: any;
    plannedVsActual: any;
    temperatureStability: any;
    areaPerformance: any[];
    downtimeData: any[];
    sixBigLosses: any[];
  }
) {
  try {
    const pptx = new PptxGenJS();
    
    // Set presentation properties
    pptx.author = 'CADIVI Production Dashboard';
    pptx.company = 'Tân Á Manufacturing';
    pptx.title = 'Production Analytics Report';
    pptx.subject = `Analytics Report - ${options.timeRange}`;
    
    // Slide 1: Title Slide
    const titleSlide = pptx.addSlide();
    titleSlide.background = { color: '0A1E3A' };
    titleSlide.addText('Production Analytics Report', {
      x: 0.5,
      y: 1.5,
      w: 9,
      h: 1,
      fontSize: 44,
      color: 'FFFFFF',
      bold: true,
      align: 'center',
    });
    titleSlide.addText(`Time Range: ${options.timeRange.charAt(0).toUpperCase() + options.timeRange.slice(1)}`, {
      x: 0.5,
      y: 2.8,
      w: 9,
      h: 0.5,
      fontSize: 24,
      color: '34E7F8',
      align: 'center',
    });
    titleSlide.addText(`Generated: ${new Date(options.timestamp).toLocaleString()}`, {
      x: 0.5,
      y: 3.5,
      w: 9,
      h: 0.5,
      fontSize: 18,
      color: 'FFFFFF',
      align: 'center',
    });
    
    // Slide 2: OEE Summary
    const oeeSlide = pptx.addSlide();
    oeeSlide.background = { color: '0A1E3A' };
    oeeSlide.addText('OEE Summary', {
      x: 0.5,
      y: 0.3,
      w: 9,
      h: 0.5,
      fontSize: 32,
      color: 'FFFFFF',
      bold: true,
    });
    
    // OEE Metrics Table
    const oeeData = [
      ['Metric', 'Value'],
      ['Overall OEE', `${data.oeeMetrics.oee.toFixed(1)}%`],
      ['Availability', `${data.oeeMetrics.availability.toFixed(1)}%`],
      ['Performance', `${data.oeeMetrics.performance.toFixed(1)}%`],
      ['Quality', `${data.oeeMetrics.quality.toFixed(1)}%`],
    ];
    
    oeeSlide.addTable(oeeData, {
      x: 1,
      y: 1.2,
      w: 8,
      h: 2.5,
      colW: [3, 2],
      fontSize: 18,
      color: 'FFFFFF',
      fill: { color: '1a4d6f' },
      border: { type: 'solid', color: '34E7F8', pt: 1 },
    });
    
    // Slide 3: NG Metrics
    const ngSlide = pptx.addSlide();
    ngSlide.background = { color: '0A1E3A' };
    ngSlide.addText('Quality Metrics (NG Analysis)', {
      x: 0.5,
      y: 0.3,
      w: 9,
      h: 0.5,
      fontSize: 32,
      color: 'FFFFFF',
      bold: true,
    });
    
    const ngData = [
      ['Metric', 'Value'],
      ['NG Length', `${data.ngMetrics.totalNG.toLocaleString()}m`],
      ['OK Length', `${data.ngMetrics.totalOK.toLocaleString()}m`],
      ['Total Output', `${data.ngMetrics.totalLength.toLocaleString()}m`],
      ['NG Rate', `${data.ngMetrics.ngRate.toFixed(2)}%`],
    ];
    
    ngSlide.addTable(ngData, {
      x: 1,
      y: 1.2,
      w: 8,
      h: 2.5,
      colW: [3, 2],
      fontSize: 18,
      color: 'FFFFFF',
      fill: { color: '1a4d6f' },
      border: { type: 'solid', color: 'FF4C4C', pt: 1 },
    });
    
    // Slide 4: Six Big Losses
    const lossesSlide = pptx.addSlide();
    lossesSlide.background = { color: '0A1E3A' };
    lossesSlide.addText('Six Big Losses Analysis', {
      x: 0.5,
      y: 0.3,
      w: 9,
      h: 0.5,
      fontSize: 32,
      color: 'FFFFFF',
      bold: true,
    });
    
    const lossesData = [
      ['Loss Category', 'OEE Loss (%)'],
      ...data.sixBigLosses.map(loss => [loss.category, `${loss.loss.toFixed(2)}%`]),
    ];
    
    lossesSlide.addTable(lossesData, {
      x: 0.5,
      y: 1.2,
      w: 9,
      h: 4,
      colW: [5, 2],
      fontSize: 16,
      color: 'FFFFFF',
      fill: { color: '1a4d6f' },
      border: { type: 'solid', color: 'FFB86C', pt: 1 },
    });
    
    // Slide 5: Area Performance
    const areaSlide = pptx.addSlide();
    areaSlide.background = { color: '0A1E3A' };
    areaSlide.addText('Performance by Production Area', {
      x: 0.5,
      y: 0.3,
      w: 9,
      h: 0.5,
      fontSize: 32,
      color: 'FFFFFF',
      bold: true,
    });
    
    const areaData = [
      ['Area', 'OEE', 'Availability', 'Performance', 'Quality'],
      ...data.areaPerformance.map(area => [
        area.area,
        `${area.oee.toFixed(1)}%`,
        `${area.availability.toFixed(1)}%`,
        `${area.performance.toFixed(1)}%`,
        `${area.quality.toFixed(1)}%`,
      ]),
    ];
    
    areaSlide.addTable(areaData, {
      x: 0.5,
      y: 1.2,
      w: 9,
      h: 4,
      colW: [2, 1.75, 1.75, 1.75, 1.75],
      fontSize: 14,
      color: 'FFFFFF',
      fill: { color: '1a4d6f' },
      border: { type: 'solid', color: '34E7F8', pt: 1 },
    });
    
    // Slide 6: Planned vs Actual
    const plannedSlide = pptx.addSlide();
    plannedSlide.background = { color: '0A1E3A' };
    plannedSlide.addText('Planned vs Actual Production', {
      x: 0.5,
      y: 0.3,
      w: 9,
      h: 0.5,
      fontSize: 32,
      color: 'FFFFFF',
      bold: true,
    });
    
    const plannedData = [
      ['Metric', 'Value'],
      ['Planned Length', `${data.plannedVsActual.planned.toLocaleString()}m`],
      ['Actual Length', `${data.plannedVsActual.actual.toLocaleString()}m`],
      ['Variance', `${data.plannedVsActual.variance.toFixed(2)}%`],
    ];
    
    plannedSlide.addTable(plannedData, {
      x: 1,
      y: 1.2,
      w: 8,
      h: 2,
      colW: [3, 2],
      fontSize: 18,
      color: 'FFFFFF',
      fill: { color: '1a4d6f' },
      border: { type: 'solid', color: 'FFB86C', pt: 1 },
    });
    
    // Export charts as images and add to slides
    const chartElements = containerElement.querySelectorAll('[data-chart-export]');
    const chartPromises: Promise<void>[] = [];
    
    for (let i = 0; i < chartElements.length; i++) {
      const chartElement = chartElements[i] as HTMLElement;
      const chartPromise = (async () => {
        try {
          const canvas = await html2canvas(chartElement, {
            backgroundColor: '#0A1E3A',
            scale: 2,
            logging: false,
          });
          
          const chartSlide = pptx.addSlide();
          chartSlide.background = { color: '0A1E3A' };
          
          const chartTitle = chartElement.getAttribute('data-chart-title') || `Chart ${i + 1}`;
          chartSlide.addText(chartTitle, {
            x: 0.5,
            y: 0.3,
            w: 9,
            h: 0.4,
            fontSize: 24,
            color: 'FFFFFF',
            bold: true,
          });
          
          const base64 = canvas.toDataURL('image/png');
          chartSlide.addImage({
            data: base64,
            x: 0.5,
            y: 0.8,
            w: 9,
            h: 5.5,
          });
        } catch (error) {
          console.error(`Error exporting chart ${i + 1}:`, error);
        }
      })();
      
      chartPromises.push(chartPromise);
    }
    
    // Wait for all charts to be exported
    await Promise.all(chartPromises);
    
    // Generate filename
    const filename = `Analytics_Report_${options.timeRange}_${new Date().toISOString().split('T')[0]}.pptx`;
    
    // Save the presentation
    await pptx.writeFile({ fileName: filename });
    
    return { success: true, filename };
  } catch (error) {
    console.error('Error exporting to PowerPoint:', error);
    throw error;
  }
}

/**
 * Export Analytics dashboard as image
 */
export async function exportAsImage(
  containerElement: HTMLElement,
  format: 'png' | 'jpeg' | 'svg',
  options: ExportOptions
): Promise<void> {
  try {
    let canvas: HTMLCanvasElement;
    let blob: Blob;
    
    if (format === 'svg') {
      // For SVG, we'll use html2canvas and convert
      canvas = await html2canvas(containerElement, {
        backgroundColor: '#0A1E3A',
        scale: 2,
        logging: false,
      });
      blob = await new Promise<Blob>((resolve) => {
        canvas.toBlob((b) => resolve(b!), 'image/png');
      });
    } else {
      canvas = await html2canvas(containerElement, {
        backgroundColor: '#0A1E3A',
        scale: 2,
        logging: false,
      });
      
      const mimeType = format === 'png' ? 'image/png' : 'image/jpeg';
      blob = await new Promise<Blob>((resolve) => {
        canvas.toBlob((b) => resolve(b!), mimeType, 0.95);
      });
    }
    
    // Generate filename with timestamp and filters
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').split('T')[0];
    const filters = `_${options.timeRange}${options.selectedArea !== 'all' ? `_${options.selectedArea}` : ''}`;
    const filename = `Analytics_Dashboard${filters}_${timestamp}.${format}`;
    
    // Save the file
    saveAs(blob, filename);
  } catch (error) {
    console.error('Error exporting as image:', error);
    throw error;
  }
}

/**
 * Export individual chart as image
 */
export async function exportChartAsImage(
  chartElement: HTMLElement,
  format: 'png' | 'jpeg' | 'svg',
  chartName: string,
  options: ExportOptions
): Promise<void> {
  try {
    let canvas: HTMLCanvasElement;
    let blob: Blob;
    
    canvas = await html2canvas(chartElement, {
      backgroundColor: '#0A1E3A',
      scale: 2,
      logging: false,
    });
    
    const mimeType = format === 'png' ? 'image/png' : format === 'jpeg' ? 'image/jpeg' : 'image/png';
    blob = await new Promise<Blob>((resolve) => {
      canvas.toBlob((b) => resolve(b!), mimeType, 0.95);
    });
    
    // Generate filename
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').split('T')[0];
    const filters = `_${options.timeRange}${options.selectedArea !== 'all' ? `_${options.selectedArea}` : ''}`;
    const safeChartName = chartName.replace(/[^a-zA-Z0-9]/g, '_');
    const filename = `Chart_${safeChartName}${filters}_${timestamp}.${format}`;
    
    // Save the file
    saveAs(blob, filename);
  } catch (error) {
    console.error('Error exporting chart as image:', error);
    throw error;
  }
}
