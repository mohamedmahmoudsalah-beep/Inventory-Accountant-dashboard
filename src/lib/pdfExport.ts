import html2canvas from "html2canvas";
import jsPDF from "jspdf";
import { showToast, dismissToast } from "./toast";

/** Renders the given DOM element to a PDF and triggers a download. Splits
 *  tall content across multiple A4 pages automatically (a dashboard page
 *  with several widgets stacked is usually taller than one page). */
export async function exportElementToPdf(element: HTMLElement, filename: string): Promise<void> {
  const dismiss = showToast("Preparing PDF…", { type: "info", durationMs: 60000 });
  try {
    const canvas = await html2canvas(element, {
      backgroundColor: getComputedStyle(document.body).getPropertyValue("--bg") || "#ffffff",
      scale: 2,
      useCORS: true,
    });

    const pdf = new jsPDF({ orientation: "portrait", unit: "pt", format: "a4" });
    const pageWidth = pdf.internal.pageSize.getWidth();
    const pageHeight = pdf.internal.pageSize.getHeight();

    const imgWidth = pageWidth;
    const imgHeight = (canvas.height * imgWidth) / canvas.width;

    const imgData = canvas.toDataURL("image/png");

    if (imgHeight <= pageHeight) {
      pdf.addImage(imgData, "PNG", 0, 0, imgWidth, imgHeight);
    } else {
      // Slice the tall canvas into page-height chunks and add each as its own page.
      let renderedHeight = 0;
      const pageCanvas = document.createElement("canvas");
      const pageCtx = pageCanvas.getContext("2d")!;
      const sliceHeightPx = (pageHeight * canvas.width) / imgWidth;
      pageCanvas.width = canvas.width;

      while (renderedHeight < canvas.height) {
        const thisSliceHeight = Math.min(sliceHeightPx, canvas.height - renderedHeight);
        pageCanvas.height = thisSliceHeight;
        pageCtx.clearRect(0, 0, pageCanvas.width, pageCanvas.height);
        pageCtx.drawImage(canvas, 0, -renderedHeight);
        const sliceData = pageCanvas.toDataURL("image/png");
        const sliceImgHeight = (thisSliceHeight * imgWidth) / canvas.width;
        if (renderedHeight > 0) pdf.addPage();
        pdf.addImage(sliceData, "PNG", 0, 0, imgWidth, sliceImgHeight);
        renderedHeight += thisSliceHeight;
      }
    }

    pdf.save(filename);
  } catch (e) {
    console.error("PDF export failed:", e);
    showToast("Couldn't export to PDF — check the console (F12) for details.", { type: "error" });
  } finally {
    // The "preparing" toast should disappear as soon as we're done, success or not.
    dismissToast(dismiss);
  }
}
