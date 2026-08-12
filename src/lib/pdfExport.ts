import html2canvas from "html2canvas";
import jsPDF from "jspdf";

export async function exportReportToPdf(
  element: HTMLElement,
  athleteName: string,
): Promise<void> {
  const canvas = await html2canvas(element, {
    backgroundColor: "#000000",
    scale: 2,
    useCORS: true,
    logging: false,
  });
  const imgData = canvas.toDataURL("image/png");
  const pdf = new jsPDF({
    orientation: "portrait",
    unit: "mm",
    format: "a4",
  });
  const pageWidth = pdf.internal.pageSize.getWidth();
  const pageHeight = pdf.internal.pageSize.getHeight();
  const imgWidth = pageWidth;
  const imgHeight = (canvas.height * imgWidth) / canvas.width;

  let position = 0;
  let heightLeft = imgHeight;

  pdf.addImage(imgData, "PNG", 0, position, imgWidth, imgHeight);
  heightLeft -= pageHeight;

  while (heightLeft > 0) {
    position = heightLeft - imgHeight;
    pdf.addPage();
    pdf.addImage(imgData, "PNG", 0, position, imgWidth, imgHeight);
    heightLeft -= pageHeight;
  }

  const safeName = athleteName.replace(/[^a-z0-9\u0600-\u06FF]+/gi, "_");
  pdf.save(`Wushu_Report_${safeName}_${Date.now()}.pdf`);
}
