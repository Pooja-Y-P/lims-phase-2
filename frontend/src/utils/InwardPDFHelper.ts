// src/utils/InwardPDFHelper.ts
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

export const generateStandardInwardPDF = (formData: any, equipmentList: any[]) => {
  // Initialize PDF in Landscape A4 for better table visibility
  const doc = new jsPDF({ orientation: 'l', unit: 'mm', format: 'a4' });
  
  const pageWidth = doc.internal.pageSize.width;
  const pageHeight = doc.internal.pageSize.height;
  const leftMargin = 15;
  const rightMargin = pageWidth - 15;
  
  let cursorY = 20;

  // --- HEADER ---
  doc.setFont("helvetica", "bold");
  doc.setFontSize(16);
  doc.setTextColor(44, 62, 80); // Dark Blue/Grey
  doc.text("Nextage Engineering Private Limited\n", pageWidth / 2, cursorY, { align: 'center' });
  
  cursorY += 6;
  doc.setFontSize(9);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(80, 80, 80);
  
  // Address - Split into lines if too long, but centered
  const address = "GF-01, Emerald Icon, Outer Ring Road, 104, 5BC III Block, HRBR Layout, Kalyan Nagar, Bangalore – 560043";
  const splitAddress = doc.splitTextToSize(address, pageWidth - 40);
  doc.text(splitAddress, pageWidth / 2, cursorY, { align: 'center' });
  
  // Adjust cursor based on address height
  cursorY += (splitAddress.length * 4) + 6;
  
  // --- TITLE BOX ---
  doc.setDrawColor(0, 0, 0);
  doc.setLineWidth(0.5);
  doc.setFillColor(240, 240, 240); // Light Grey
  doc.rect(leftMargin, cursorY, pageWidth - 30, 10, 'FD');
  
  doc.setFontSize(12);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(0, 0, 0);
  doc.text("MATERIAL INWARD RECEIPT", pageWidth / 2, cursorY + 6.5, { align: 'center' });
  
  cursorY += 18;

  // --- INFO GRID (SRF, Dates, Customer) ---
  // We use two columns: Left for Internal details, Right for Customer details
  
  const col1X = leftMargin;
  const col2X = pageWidth / 2 + 5;
  
  doc.setFontSize(10);
  
  // -- Left Column (Internal Info) --
  doc.setFont("helvetica", "bold");
  doc.text("Internal Details:", col1X, cursorY);
  doc.setLineWidth(0.2);
  doc.line(col1X, cursorY + 1, col1X + 30, cursorY + 1); // Underline header
  
  const leftColStartY = cursorY;
  cursorY += 6;
  doc.setFont("helvetica", "normal");
  doc.text("SRF No:", col1X, cursorY);
  doc.setFont("helvetica", "bold");
  doc.text(formData.srf_no || '-', col1X + 35, cursorY);
  
  cursorY += 6;
  doc.setFont("helvetica", "normal");
  doc.text("Inward Date:", col1X, cursorY);
  doc.setFont("helvetica", "bold");
  doc.text(formData.material_inward_date || '-', col1X + 35, cursorY);

  cursorY += 6;
  doc.setFont("helvetica", "normal");
  doc.text("Received By:", col1X, cursorY);
  doc.text(formData.receiver || '-', col1X + 35, cursorY);
  
  cursorY += 6;
  doc.text("Customer DC No:", col1X, cursorY);
  doc.text(formData.customer_dc_no || '-', col1X + 35, cursorY);
  
  cursorY += 6;
  doc.text("Customer DC Date:", col1X, cursorY);
  doc.text(formData.customer_dc_date || '-', col1X + 35, cursorY);

  // Save the Y position after the left column
  const leftColumnBottomY = cursorY;

  // Reset Y for Right Column (start at same height as left column header)
  cursorY = leftColStartY;

  // -- Right Column (Customer Info) --
  doc.setFont("helvetica", "bold");
  doc.text("Customer Details:", col2X, cursorY);
  doc.line(col2X, cursorY + 1, col2X + 35, cursorY + 1); // Underline header

  cursorY += 6;
  doc.setFont("helvetica", "normal");
  
  // Handle multiline customer details/name
  const custDetails = doc.splitTextToSize(formData.customer_details || 'N/A', 80);
  doc.text(custDetails, col2X, cursorY);
  cursorY += custDetails.length * 4 + 2;
  
  // Contact Person
  if (formData.contact_person) {
    doc.text("Contact:", col2X, cursorY);
    doc.text(formData.contact_person, col2X + 20, cursorY);
    cursorY += 5;
  }
  
  // Phone
  if (formData.phone) {
    doc.text("Phone:", col2X, cursorY);
    doc.text(formData.phone, col2X + 20, cursorY);
    cursorY += 5;
  }
  
  // Email
  if (formData.email) {
    doc.text("Email:", col2X, cursorY);
    const emailText = doc.splitTextToSize(formData.email, 70);
    doc.text(emailText, col2X + 20, cursorY);
    cursorY += emailText.length * 4 + 1;
  }

  // Ship To Address (under customer details)
  if (formData.ship_to_address) {
    cursorY += 4;
    doc.setFont("helvetica", "bold");
    doc.setFontSize(8);
    doc.text("Ship To:", col2X, cursorY);
    doc.setFont("helvetica", "normal");
    const shipAddress = doc.splitTextToSize(formData.ship_to_address, 95);
    doc.text(shipAddress, col2X + 16, cursorY);
    cursorY += shipAddress.length * 3.5 + 1;
    doc.setFontSize(10);
  }

  // Bill To Address (under ship to)
  if (formData.bill_to_address) {
    cursorY += 3;
    doc.setFont("helvetica", "bold");
    doc.setFontSize(8);
    doc.text("Bill To:", col2X, cursorY);
    doc.setFont("helvetica", "normal");
    const billAddress = doc.splitTextToSize(formData.bill_to_address, 95);
    doc.text(billAddress, col2X + 16, cursorY);
    cursorY += billAddress.length * 3.5 + 1;
    doc.setFontSize(10);
  }

  // Set cursorY to the greater of the two columns + some padding
  cursorY = Math.max(leftColumnBottomY, cursorY) + 10;

  // --- EQUIPMENT TABLE ---
  const tableColumn = [
    "S.No", 
    "NEPL ID",
    "Description", 
    "Make", 
    "Model",
    "Range",
    "Serial No", 
    "Qty", 
    "Supplier",
    "In DC",
    "Out DC",
    "Calib. By",
    "NextAge Ref",
    "Acc.", 
    "Visual Notes", 
    "Engineer Remarks",
    "Customer Remarks"
  ];

  const tableRows: any[] = [];
  equipmentList.forEach((eq, index) => {
    const rowData = [
      index + 1,
      eq.nepl_id || '-',
      eq.material_desc || eq.material_description || '-',
      eq.make || '-',
      eq.model || '-',
      eq.range || '-',
      eq.serial_no || '-',
      eq.qty || eq.quantity || '1',
      eq.supplier || '-',
      eq.in_dc || '-',
      eq.out_dc || '-',
      eq.calibration_by || '-',
      eq.nextage_ref || eq.nextage_contract_reference || '-',
      eq.accessories_included || '-',
      eq.inspe_status || eq.visual_inspection_notes || '-',
      eq.engineer_remarks || '-',
      eq.customer_remarks || eq.remarks_and_decision || '-'
    ];
    tableRows.push(rowData);
  });

  autoTable(doc, {
    startY: cursorY,
    head: [tableColumn],
    body: tableRows,
    theme: 'grid',
    styles: { 
      fontSize: 6.5, 
      cellPadding: 1.5, 
      overflow: 'linebreak', 
      valign: 'middle',
      lineColor: [200, 200, 200], 
      lineWidth: 0.1 
    },
    headStyles: { 
      fillColor: [44, 62, 80], 
      textColor: 255, 
      fontStyle: 'bold',
      halign: 'center',
      valign: 'middle',
      fontSize: 6.5
    },
    columnStyles: {
      0: { cellWidth: 8, halign: 'center' },    // S.No
      1: { cellWidth: 15 },                      // NEPL ID
      2: { cellWidth: 22 },                      // Description
      3: { cellWidth: 15 },                      // Make
      4: { cellWidth: 15 },                      // Model
      5: { cellWidth: 14 },                      // Range
      6: { cellWidth: 15 },                      // Serial No
      7: { cellWidth: 8, halign: 'center' },    // Qty
      8: { cellWidth: 15 },                      // Supplier
      9: { cellWidth: 12 },                      // In DC
      10: { cellWidth: 12 },                     // Out DC
      11: { cellWidth: 15 },                     // Calib. By
      12: { cellWidth: 15 },                     // NextAge Ref
      13: { cellWidth: 16 },                     // Acc.
      14: { cellWidth: 16 },                     // Visual Notes
      15: { cellWidth: 16 },                     // Engineer Remarks
      16: { cellWidth: 18 }                      // Customer Remarks (Fixed width)
    },
    // Prevent page break inside a row if possible
    rowPageBreak: 'avoid' 
  });

  // --- FOOTER ---
  const finalY = (doc as any).lastAutoTable.finalY + 15;
  
  // Check for page break if footer doesn't fit
  if (finalY > pageHeight - 40) {
    doc.addPage();
    cursorY = 20;
  } else {
    cursorY = finalY;
  }

  doc.setFontSize(8);
  doc.setTextColor(100, 100, 100); // Grey text for disclaimer
  doc.text("Disclaimer: Items received are subject to detailed verification. Any discrepancies found must be reported within 24 hours.", leftMargin, cursorY);
  
  cursorY += 15;
  doc.setDrawColor(0, 0, 0);
  doc.setTextColor(0, 0, 0); // Black text
  doc.setFontSize(10);

  // Signatures
  doc.text("Received By:", leftMargin, cursorY);
  doc.setFont("helvetica", "bold");
  doc.text(formData.receiver || 'Staff', leftMargin, cursorY + 6);
  doc.setLineWidth(0.5);
  doc.line(leftMargin, cursorY + 8, leftMargin + 50, cursorY + 8); // Line for signature

  doc.setFont("helvetica", "normal");
  doc.text("For Nextage Engineering Private Limited", rightMargin, cursorY, { align: 'right' });
  doc.line(rightMargin - 50, cursorY + 8, rightMargin, cursorY + 8); // Line for signature
  doc.text("Authorized Signatory", rightMargin, cursorY + 14, { align: 'right' });

  // --- PAGE NUMBERS ---
  const pageCount = (doc as any).internal.getNumberOfPages();
  for(let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setFontSize(8);
    doc.setTextColor(150);
    doc.text(`Page ${i} of ${pageCount}`, pageWidth - 15, pageHeight - 10, { align: 'right' });
  }

  // Save file
  doc.save(`Inward_Receipt_${formData.srf_no}.pdf`);
};