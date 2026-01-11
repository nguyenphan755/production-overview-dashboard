// Export utilities for Analytics dashboard
import PptxGenJS from 'pptxgenjs';
import html2canvas from 'html2canvas-pro';
import { saveAs } from 'file-saver';
import { jsPDF } from 'jspdf';

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
 * Export Analytics dashboard as PDF
 */
export async function exportAsPDF(
  containerElement: HTMLElement,
  options: ExportOptions
): Promise<void> {
  try {
    if (!containerElement) {
      throw new Error('Container element not found');
    }

    // Scroll to top to ensure we capture everything
    containerElement.scrollIntoView({ behavior: 'auto', block: 'start' });
    window.scrollTo(0, 0);
    
    // Wait for content to be fully rendered
    await new Promise(resolve => setTimeout(resolve, 1000));

    // Capture the dashboard as canvas
    // html2canvas-pro supports modern CSS color functions (oklch/oklab)
    let canvas: HTMLCanvasElement;
    try {
      canvas = await html2canvas(containerElement, {
        backgroundColor: '#0A1E3A',
        scale: 1.5,
        logging: false,
        useCORS: true,
        allowTaint: true,
        ignoreElements: (element) => {
          // Ignore export buttons
          const button = element as HTMLElement;
          return button.tagName === 'BUTTON' && 
                 (button.textContent?.includes('Export') || 
                  button.querySelector('[data-export-button]') !== null);
        },
      });
    } catch (html2canvasError) {
      console.error('html2canvas error:', html2canvasError);
      throw new Error(
        `Failed to capture dashboard: ${html2canvasError instanceof Error ? html2canvasError.message : 'Unknown error'}`
      );
    }

    if (!canvas || canvas.width === 0 || canvas.height === 0) {
      throw new Error('Failed to capture dashboard - canvas is empty');
    }

    // Calculate PDF dimensions
    const imgWidth = canvas.width;
    const imgHeight = canvas.height;
    
    // A4 dimensions in mm (landscape for better fit of dashboard)
    const pdfWidth = 297; // A4 landscape width in mm
    const pdfHeight = 210; // A4 landscape height in mm
    
    // Calculate scaling to fit A4 landscape
    const ratio = imgWidth / imgHeight;
    const pdfRatio = pdfWidth / pdfHeight;
    
    let finalWidth: number;
    let finalHeight: number;
    
    if (ratio > pdfRatio) {
      // Image is wider - fit to width
      finalWidth = pdfWidth;
      finalHeight = pdfWidth / ratio;
    } else {
      // Image is taller - fit to height
      finalHeight = pdfHeight;
      finalWidth = pdfHeight * ratio;
    }

    // Create PDF in landscape orientation for better dashboard fit
    let pdf: jsPDF;
    try {
      pdf = new jsPDF({
        orientation: 'landscape',
        unit: 'mm',
        format: 'a4',
      });
    } catch (pdfError) {
      console.error('jsPDF creation error:', pdfError);
      throw new Error(`Failed to create PDF: ${pdfError instanceof Error ? pdfError.message : 'Unknown error'}`);
    }

    // Convert canvas to image data
    let imgData: string;
    try {
      imgData = canvas.toDataURL('image/png', 1.0);
      if (!imgData || imgData.length === 0) {
        throw new Error('Failed to convert canvas to image data');
      }
    } catch (dataError) {
      console.error('Canvas to data URL error:', dataError);
      throw new Error(`Failed to convert canvas to image: ${dataError instanceof Error ? dataError.message : 'Unknown error'}`);
    }

    // Get page dimensions
    const pageHeight = pdf.internal.pageSize.getHeight();
    const pageWidth = pdf.internal.pageSize.getWidth();
    
    // Calculate how many pages we need
    const totalPages = Math.ceil(finalHeight / pageHeight);

    // Add image to first page
    try {
      pdf.addImage(imgData, 'PNG', 0, 0, finalWidth, finalHeight);
    } catch (addImageError) {
      console.error('Error adding image to PDF:', addImageError);
      throw new Error(`Failed to add image to PDF: ${addImageError instanceof Error ? addImageError.message : 'Unknown error'}`);
    }

    // If content is taller than one page, split into multiple pages
    if (totalPages > 1) {
      for (let i = 1; i < totalPages; i++) {
        try {
          pdf.addPage();
          // Calculate the y position to show the next portion of the image
          const yPosition = -(i * pageHeight);
          pdf.addImage(imgData, 'PNG', 0, yPosition, finalWidth, finalHeight);
        } catch (pageError) {
          console.error(`Error adding page ${i + 1}:`, pageError);
          // Continue with remaining pages even if one fails
        }
      }
    }

    // Add metadata
    const timestamp = new Date(options.timestamp);
    pdf.setProperties({
      title: 'Analytics Dashboard Report',
      subject: `Analytics Report - ${options.timeRange}`,
      author: 'CADIVI Production Dashboard',
      creator: 'Tân Á Manufacturing',
      keywords: `analytics, oee, production, ${options.timeRange}`,
    });

    // Add footer with timestamp and filters on each page
    const pageCount = pdf.getNumberOfPages();
    for (let i = 1; i <= pageCount; i++) {
      pdf.setPage(i);
      pdf.setFontSize(8);
      pdf.setTextColor(128, 128, 128);
      const footerText = `Generated: ${timestamp.toLocaleString()} | Time Range: ${options.timeRange}${options.selectedArea !== 'all' ? ` | Area: ${options.selectedArea}` : ''} | Page ${i} of ${pageCount}`;
      pdf.text(footerText, pageWidth / 2, pageHeight - 5, { align: 'center' });
    }

    // Generate filename
    const dateStr = timestamp.toISOString().replace(/[:.]/g, '-').split('T')[0];
    const filters = `_${options.timeRange}${options.selectedArea !== 'all' ? `_${options.selectedArea}` : ''}`;
    const filename = `Analytics_Dashboard${filters}_${dateStr}.pdf`;

    // Save the PDF
    try {
      pdf.save(filename);
    } catch (saveError) {
      console.error('Error saving PDF:', saveError);
      throw new Error(`Failed to save PDF: ${saveError instanceof Error ? saveError.message : 'Unknown error'}`);
    }
  } catch (error) {
    console.error('Error exporting as PDF:', error);
    console.error('Error details:', {
      message: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined,
      name: error instanceof Error ? error.name : typeof error,
    });
    throw error;
  }
}
