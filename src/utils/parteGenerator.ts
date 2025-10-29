import jsPDF from 'jspdf';
import { Document, Packer, Paragraph, TextRun, ImageRun, AlignmentType } from 'docx';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';

interface ParteData {
  operario: string;
  obra: string;
  fecha: Date;
  horas: number;
  tipoTrabajo: 'Albañilería' | 'Clima' | 'Contraincendios' | 'Electricidad' | 'Fontanería' | 'Mantenimiento' | 'Ventilación';
  numeroOrden: string;
  trabajoRealizado: string;
  vehiculo: string;
  materialEmpleado?: string;
  notas?: string;
  firma: string;
  logoUrl?: string;
  baseFilename: string;
}

interface GenerationResult {
  success: boolean;
  pdfBlob?: Blob;
  docxBlob?: Blob;
  error?: string;
}

export async function generateParteDocuments(data: ParteData): Promise<GenerationResult> {
  try {
    // Generar ambos documentos en paralelo
    const [pdfBlob, docxBlob] = await Promise.all([
      generatePartePDF(data),
      generateParteDocx(data)
    ]);

    return {
      success: true,
      pdfBlob,
      docxBlob
    };
  } catch (error) {
    console.error('Error generando documentos:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Error desconocido'
    };
  }
}

async function generatePartePDF(data: ParteData): Promise<Blob> {
  const pdf = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4'
  });

  let yPosition = 20;

  // Logo (si existe)
  if (data.logoUrl) {
    try {
      pdf.addImage(data.logoUrl, 'PNG', 15, yPosition, 40, 20);
      yPosition += 25;
    } catch (error) {
      console.warn('Error añadiendo logo al PDF:', error);
    }
  }

  // Título
  pdf.setFontSize(18);
  pdf.setFont('helvetica', 'bold');
  pdf.text('Parte de Trabajo', 105, yPosition, { align: 'center' });
  yPosition += 15;

  // Datos del parte
  pdf.setFontSize(11);
  pdf.setFont('helvetica', 'normal');

  const addField = (label: string, value: string) => {
    pdf.setFont('helvetica', 'bold');
    pdf.text(label, 20, yPosition);
    pdf.setFont('helvetica', 'normal');
    pdf.text(value, 70, yPosition);
    yPosition += 8;
  };

  addField('Operario:', data.operario);
  addField('Obra:', data.obra);
  addField('Fecha:', format(data.fecha, 'PPP', { locale: es }));
  addField('Horas:', data.horas.toString());
  addField('Tipo de trabajo:', data.tipoTrabajo);
  addField('Nº de orden:', data.numeroOrden);
  addField('Vehículo:', data.vehiculo);

  yPosition += 5;

  // Trabajo realizado
  pdf.setFont('helvetica', 'bold');
  pdf.text('Trabajo realizado:', 20, yPosition);
  yPosition += 6;
  pdf.setFont('helvetica', 'normal');
  const trabajoLines = pdf.splitTextToSize(data.trabajoRealizado, 170);
  pdf.text(trabajoLines, 20, yPosition);
  yPosition += trabajoLines.length * 5 + 5;

  // Material empleado (si existe)
  if (data.materialEmpleado && data.materialEmpleado.trim()) {
    pdf.setFont('helvetica', 'bold');
    pdf.text('Material empleado:', 20, yPosition);
    yPosition += 6;
    pdf.setFont('helvetica', 'normal');
    const materialLines = pdf.splitTextToSize(data.materialEmpleado, 170);
    pdf.text(materialLines, 20, yPosition);
    yPosition += materialLines.length * 5 + 5;
  }

  // Notas (si existen)
  if (data.notas && data.notas.trim()) {
    pdf.setFont('helvetica', 'bold');
    pdf.text('Notas adicionales:', 20, yPosition);
    yPosition += 6;
    pdf.setFont('helvetica', 'normal');
    const notasLines = pdf.splitTextToSize(data.notas, 170);
    pdf.text(notasLines, 20, yPosition);
    yPosition += notasLines.length * 5 + 10;
  }

  // Firma
  yPosition += 10;
  pdf.setFont('helvetica', 'bold');
  pdf.text('Firma:', 20, yPosition);
  yPosition += 5;

  try {
    pdf.addImage(data.firma, 'PNG', 20, yPosition, 60, 30);
  } catch (error) {
    console.warn('Error añadiendo firma al PDF:', error);
  }

  return pdf.output('blob');
}

async function generateParteDocx(data: ParteData): Promise<Blob> {
  const children: Paragraph[] = [];

  // Logo (si existe)
  if (data.logoUrl) {
    try {
      const logoResponse = await fetch(data.logoUrl);
      const logoBuffer = await logoResponse.arrayBuffer();
      
      children.push(
        new Paragraph({
          children: [
            new ImageRun({
              data: logoBuffer,
              transformation: { width: 100, height: 50 },
              type: 'png'
            })
          ],
          spacing: { after: 300 }
        })
      );
    } catch (error) {
      console.warn('Error cargando logo para DOCX:', error);
    }
  }

  // Título
  children.push(
    new Paragraph({
      children: [
        new TextRun({
          text: 'Parte de Trabajo',
          bold: true,
          size: 32
        })
      ],
      alignment: AlignmentType.CENTER,
      spacing: { after: 400 }
    })
  );

  // Datos del parte
  const addField = (label: string, value: string) => {
    children.push(
      new Paragraph({
        children: [
          new TextRun({ text: label, bold: true, size: 22 }),
          new TextRun({ text: ' ' + value, size: 22 })
        ],
        spacing: { after: 150 }
      })
    );
  };

  addField('Operario:', data.operario);
  addField('Obra:', data.obra);
  addField('Fecha:', format(data.fecha, 'PPP', { locale: es }));
  addField('Horas:', data.horas.toString());
  addField('Tipo de trabajo:', data.tipoTrabajo);
  addField('Nº de orden:', data.numeroOrden);
  addField('Vehículo:', data.vehiculo);

  // Trabajo realizado
  children.push(
    new Paragraph({
      children: [
        new TextRun({ text: 'Trabajo realizado:', bold: true, size: 22 })
      ],
      spacing: { before: 300, after: 150 }
    }),
    new Paragraph({
      children: [
        new TextRun({ text: data.trabajoRealizado, size: 22 })
      ],
      spacing: { after: 300 }
    })
  );

  // Material empleado (si existe)
  if (data.materialEmpleado && data.materialEmpleado.trim()) {
    children.push(
      new Paragraph({
        children: [
          new TextRun({ text: 'Material empleado:', bold: true, size: 22 })
        ],
        spacing: { after: 150 }
      }),
      new Paragraph({
        children: [
          new TextRun({ text: data.materialEmpleado, size: 22 })
        ],
        spacing: { after: 300 }
      })
    );
  }

  // Notas (si existen)
  if (data.notas && data.notas.trim()) {
    children.push(
      new Paragraph({
        children: [
          new TextRun({ text: 'Notas adicionales:', bold: true, size: 22 })
        ],
        spacing: { after: 150 }
      }),
      new Paragraph({
        children: [
          new TextRun({ text: data.notas, size: 22 })
        ],
        spacing: { after: 300 }
      })
    );
  }

  // Firma
  children.push(
    new Paragraph({
      children: [
        new TextRun({ text: 'Firma:', bold: true, size: 22 })
      ],
      spacing: { before: 400, after: 200 }
    })
  );

  try {
    const firmaResponse = await fetch(data.firma);
    const firmaBuffer = await firmaResponse.arrayBuffer();
    
    children.push(
      new Paragraph({
        children: [
          new ImageRun({
            data: firmaBuffer,
            transformation: { width: 200, height: 100 },
            type: 'png'
          })
        ],
        spacing: { after: 200 }
      })
    );
  } catch (error) {
    console.warn('Error cargando firma para DOCX:', error);
  }

  const doc = new Document({
    sections: [{
      properties: {},
      children
    }]
  });

  return await Packer.toBlob(doc);
}
