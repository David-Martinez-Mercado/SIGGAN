import prisma from '../config/database';

// Genera aretes nacionales únicos: MX10-DGO-0000001
export async function generarAreteNacional(): Promise<string> {
  const ultimo = await prisma.animal.findFirst({
    orderBy: { areteNacional: 'desc' },
    select: { areteNacional: true },
  });

  let siguiente = 1;
  if (ultimo?.areteNacional) {
    const num = parseInt(ultimo.areteNacional.replace(/\D/g, ''));
    if (!isNaN(num)) siguiente = num + 1;
  }

  return `MX10${String(siguiente).padStart(7, '0')}`;
}

// Genera RFID tags únicos: RFID-DGO-000001
export async function generarRFIDTag(): Promise<string> {
  const ultimo = await prisma.animal.findFirst({
    where: { rfidTag: { not: null } },
    orderBy: { rfidTag: 'desc' },
    select: { rfidTag: true },
  });

  let siguiente = 1;
  if (ultimo?.rfidTag) {
    const num = parseInt(ultimo.rfidTag.replace(/\D/g, ''));
    if (!isNaN(num)) siguiente = num + 1;
  }

  return `RFID-DGO-${String(siguiente).padStart(6, '0')}`;
}

// Genera aretes de exportación únicos (azules): EXP-MX-0000001
export async function generarAreteExportacion(): Promise<string> {
  const ultimo = await prisma.animal.findFirst({
    where: { areteExportacion: { not: null } },
    orderBy: { areteExportacion: 'desc' },
    select: { areteExportacion: true },
  });

  let siguiente = 1;
  if (ultimo?.areteExportacion) {
    const num = parseInt(ultimo.areteExportacion.replace(/\D/g, ''));
    if (!isNaN(num)) siguiente = num + 1;
  }

  return `EXP-MX-${String(siguiente).padStart(7, '0')}`;
}
