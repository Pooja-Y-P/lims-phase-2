import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

interface jsPDFCustom extends jsPDF {
  lastAutoTable?: {
    finalY: number;
  };
}

export const generateStandardInwardPDF = (formData: any, equipmentList: any[]) => {
  // 1. Initialize A4 LANDSCAPE (Required for 17 separate columns)
  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' }) as jsPDFCustom;
  
  const pageWidth = doc.internal.pageSize.width;  // 297mm
  const pageHeight = doc.internal.pageSize.height; // 210mm
  const margin = 10;
  
  // Professional Corporate Color Palette
  const THEME = {
    primary: [41, 128, 185],    // Professional Blue
    headerBg: [241, 245, 249],  // Light Grey-Blue Background
    textDark: [30, 41, 59],     // Dark Slate
    textLight: [100, 116, 139], // Light Slate
    border: [203, 213, 225],    // Subtle Border
    white: [255, 255, 255]
  };

  let cursorY = 0;

  // ==========================================
  // 1. HEADER STRIP
  // ==========================================
  doc.setFillColor(THEME.primary[0], THEME.primary[1], THEME.primary[2]);
  doc.rect(0, 0, pageWidth, 5, 'F');
  
  cursorY = 15;

  // ==========================================
  // 2. COMPANY & DOCUMENT INFO
  // ==========================================
  
  // Company Name
  doc.setFont("helvetica", "bold");
  doc.setFontSize(20);
  doc.setTextColor(THEME.textDark[0], THEME.textDark[1], THEME.textDark[2]);
  doc.text("Nextage Engineering Pvt. Ltd.", margin, cursorY);

  // Document Title (Right Aligned)
  doc.setFontSize(14);
  doc.setTextColor(THEME.primary[0], THEME.primary[1], THEME.primary[2]);
  doc.text("MATERIAL INWARD RECEIPT", pageWidth - margin, cursorY, { align: 'right' });

  // Address
  cursorY += 6;
  doc.setFontSize(8);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(THEME.textLight[0], THEME.textLight[1], THEME.textLight[2]);
  const address = "GF-01, Emerald Icon, Outer Ring Road, 104, 5BC III Block, HRBR Layout, Kalyan Nagar, Bangalore – 560043";
  doc.text(address, margin, cursorY);

  // Divider Line
  cursorY += 5;
  doc.setDrawColor(THEME.border[0], THEME.border[1], THEME.border[2]);
  doc.setLineWidth(0.5);
  doc.line(margin, cursorY, pageWidth - margin, cursorY);

  // ==========================================
  // 3. DETAILS CARDS (SEPARATE SECTIONS)
  // ==========================================
  cursorY += 8;
  
  const gap = 8;
  const boxWidth = (pageWidth - (margin * 2) - gap) / 2;
  const boxHeight = 42;

  // Helper function to draw professional rounded cards
  const drawSectionCard = (x: number, title: string, contentCallback: () => void) => {
    // Card Border
    doc.setDrawColor(THEME.border[0], THEME.border[1], THEME.border[2]);
    doc.setLineWidth(0.2);
    doc.roundedRect(x, cursorY, boxWidth, boxHeight, 3, 3, 'S');

    // Header Strip inside Card
    doc.setFillColor(THEME.headerBg[0], THEME.headerBg[1], THEME.headerBg[2]);
    doc.roundedRect(x, cursorY, boxWidth, 8, 3, 3, 'F');
    doc.rect(x, cursorY + 5, boxWidth, 3, 'F'); // Square off bottom corners of header

    // Section Title
    doc.setFont("helvetica", "bold");
    doc.setFontSize(9);
    doc.setTextColor(THEME.textDark[0], THEME.textDark[1], THEME.textDark[2]);
    doc.text(title.toUpperCase(), x + 5, cursorY + 5.5);

    // Execute Content
    contentCallback();
  };

  // --- LEFT CARD: Job Details ---
  drawSectionCard(margin, "Job Information", () => {
    let y = cursorY + 14;
    const labelX = margin + 5;
    const valueX = margin + 45;

    const printRow = (label: string, value: string) => {
      doc.setFont("helvetica", "bold");
      doc.setFontSize(8);
      doc.setTextColor(THEME.textLight[0], THEME.textLight[1], THEME.textLight[2]);
      doc.text(label, labelX, y);

      doc.setFont("helvetica", "bold");
      doc.setTextColor(0, 0, 0); // Black for values
      doc.text(value || '-', valueX, y);
      y += 6;
    };

    printRow("SRF Number:", formData.srf_no);
    printRow("Inward Date:", formData.material_inward_date);
    printRow("DC Number:", formData.customer_dc_no);
    printRow("DC Date:", formData.customer_dc_date);
  });

  // --- RIGHT CARD: Customer Details ---
  const rightX = margin + boxWidth + gap;
  drawSectionCard(rightX, "Customer Information", () => {
    let y = cursorY + 14;
    const padding = 5;
    const textX = rightX + padding;
    const maxTextWidth = boxWidth - (padding * 2);

    // Customer Name
    doc.setFont("helvetica", "bold");
    doc.setFontSize(10);
    doc.setTextColor(0, 0, 0);
    const name = doc.splitTextToSize(formData.customer_details || 'Unknown Customer', maxTextWidth);
    doc.text(name, textX, y);
    y += (name.length * 4) + 3;

    // Contact
    if (formData.contact_person || formData.phone) {
        doc.setFontSize(8);
        doc.setFont("helvetica", "normal");
        doc.setTextColor(THEME.textLight[0], THEME.textLight[1], THEME.textLight[2]);
        const contact = `Contact: ${formData.contact_person || ''} ${formData.phone ? `(${formData.phone})` : ''}`;
        doc.text(contact, textX, y);
        y += 5;
    }

    // Address
    const addr = formData.ship_to_address || formData.bill_to_address || formData.address;
    if (addr) {
        doc.setFont("helvetica", "normal");
        doc.setFontSize(8);
        doc.setTextColor(THEME.textDark[0], THEME.textDark[1], THEME.textDark[2]);
        const addrLines = doc.splitTextToSize(addr, maxTextWidth);
        // Limit to 3 lines to fit nicely
        doc.text(addrLines.slice(0, 3), textX, y);
    }
  });

  cursorY += boxHeight + 10;

  // ==========================================
  // 4. THE TABLE (17 SEPARATE COLUMNS)
  // ==========================================
  
  const tableHeaders = [
    "S.No", 
    "ID", 
    "Description", 
    "Make", 
    "Model", 
    "Range", 
    "Serial", 
    "Qty", 
    "Supplier", 
    "In DC", 
    "Out DC", 
    "Calib By", 
    "Ref", 
    "Acc.", 
    "Visual", 
    "Eng Rem", 
    "Cust Rem"
  ];

  const tableData = equipmentList.map((eq, index) => [
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
  ]);

  autoTable(doc, {
    startY: cursorY,
    head: [tableHeaders],
    body: tableData,
    theme: 'grid',
    styles: { 
      fontSize: 6.5,  // Small font required for 17 columns
      cellPadding: 1.5,
      overflow: 'linebreak', 
      valign: 'middle',
      font: "helvetica",
      lineWidth: 0.1,
      lineColor: THEME.border as [number, number, number]
    },
    headStyles: { 
      fillColor: THEME.primary as [number, number, number], 
      textColor: 255, 
      fontStyle: 'bold',
      halign: 'center',
      valign: 'middle',
      fontSize: 6.5
    },
    alternateRowStyles: {
      fillColor: [248, 250, 252] // Very light stripe
    },
    // Precise Column Widths to sum up to ~277mm
    columnStyles: {
      0: { cellWidth: 8, halign: 'center' },   // S.No
      1: { cellWidth: 14, fontStyle: 'bold' }, // ID
      2: { cellWidth: 26 },                    // Description (Needs most space)
      3: { cellWidth: 14 },                    // Make
      4: { cellWidth: 14 },                    // Model
      5: { cellWidth: 14 },                    // Range
      6: { cellWidth: 14 },                    // Serial
      7: { cellWidth: 8, halign: 'center' },   // Qty
      8: { cellWidth: 12 },                    // Supplier
      9: { cellWidth: 11 },                    // In DC
      10: { cellWidth: 11 },                   // Out DC
      11: { cellWidth: 12 },                   // Calib By
      12: { cellWidth: 14 },                   // Ref
      13: { cellWidth: 16 },                   // Acc
      14: { cellWidth: 16 },                   // Visual
      15: { cellWidth: 20 },                   // Eng Rem
      16: { cellWidth: 'auto' }                // Cust Rem (Takes remaining space)
    },
    margin: { left: margin, right: margin },
    didDrawPage: (data) => {
        // Footer: Page Number
        const h = doc.internal.pageSize.height;
        doc.setFontSize(8);
        doc.setTextColor(THEME.textLight[0], THEME.textLight[1], THEME.textLight[2]);
        doc.text(`Page ${data.pageNumber} | Generated on ${new Date().toLocaleDateString()}`, pageWidth - margin, h - 10, { align: 'right' });
    }
  });

  // ==========================================
  // 5. FOOTER & SIGNATURES
  // ==========================================
  
  let finalY = doc.lastAutoTable?.finalY || cursorY;

  // Ensure footer fits
  if (finalY > pageHeight - 35) {
    doc.addPage();
    finalY = 20;
  } else {
    finalY += 10;
  }

  // Footer Container
  doc.setDrawColor(THEME.border[0], THEME.border[1], THEME.border[2]);
  doc.setFillColor(252, 252, 252);
  doc.roundedRect(margin, finalY, pageWidth - (margin * 2), 25, 2, 2, 'FD');

  // Disclaimer
  doc.setFontSize(7);
  doc.setTextColor(THEME.textLight[0], THEME.textLight[1], THEME.textLight[2]);
  doc.text("Disclaimer: All items received subject to detailed verification. Discrepancies must be reported within 24 hours.", margin + 5, finalY + 6);

  // Signatures
  const sigY = finalY + 18;
  
  // Left Signature
  doc.setFontSize(9);
  doc.setTextColor(0);
  doc.text("Received By:", margin + 5, finalY + 14);
  doc.setFont("helvetica", "bold");
  doc.text(formData.receiver || 'Staff', margin + 28, finalY + 14);

  // Right Signature
  doc.setFont("helvetica", "normal");
  doc.text("For Nextage Engineering Pvt. Ltd.", pageWidth - margin - 5, finalY + 14, { align: 'right' });
  doc.setFont("helvetica", "bold");
  doc.text("Authorized Signatory", pageWidth - margin - 5, sigY, { align: 'right' });

  // Save File
  doc.save(`Inward_Receipt_${formData.srf_no}.pdf`);
};