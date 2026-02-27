import { Router, Response } from 'express';
import prisma from '../config/database';
import { authMiddleware, AuthRequest } from '../middleware/auth';

const router = Router();
router.use(authMiddleware);

async function getMiPropietarioId(userId: string): Promise<string | null> {
  const prop = await prisma.propietario.findFirst({ where: { usuarioId: userId }, select: { id: true } });
  return prop?.id || null;
}

function generarFolio(tipo: string): string {
  const prefijos: Record<string, string> = { GUIA_REEMO:'GR', CERTIFICADO_ZOOSANITARIO:'CZ', SOLICITUD_TB_BR:'TB' };
  const num = Math.floor(Math.random() * 9000000) + 1000000;
  return `${prefijos[tipo] || 'FO'}-DGO-${new Date().getFullYear()}-${num}`;
}
function formatFecha(iso: string): string {
  return new Date(iso).toLocaleDateString('es-MX', { day:'2-digit', month:'long', year:'numeric' });
}

// GET /api/formularios
router.get('/', async (req: AuthRequest, res: Response) => {
  try {
    const { tipo, estatus } = req.query;
    const where: any = {};
    if (tipo) where.tipo = tipo;
    if (estatus) where.estatus = estatus;
    if (req.userRol === 'PRODUCTOR') where.usuarioId = req.userId;
    const formularios = await prisma.formulario.findMany({
      where, orderBy: { createdAt: 'desc' },
      include: { usuario: { select: { nombre: true, apellidos: true, rol: true } } },
    });
    res.json(formularios);
  } catch (error) { console.error(error); res.status(500).json({ error: 'Error' }); }
});

// GET /api/formularios/all-upps - TODAS las UPPs (para guías)
router.get('/all-upps', async (req: AuthRequest, res: Response) => {
  try {
    const upps = await prisma.uPP.findMany({
      where: { activa: true },
      include: { propietario: { select: { id: true, nombre: true, apellidos: true } } },
      orderBy: { nombre: 'asc' },
    });
    res.json(upps);
  } catch (error) { console.error(error); res.status(500).json({ error: 'Error' }); }
});

// GET /api/formularios/:id
router.get('/:id', async (req: AuthRequest, res: Response) => {
  try {
    const form = await prisma.formulario.findUnique({
      where: { id: req.params.id },
      include: { usuario: { select: { nombre: true, apellidos: true } } },
    });
    if (!form) { res.status(404).json({ error: 'No encontrado' }); return; }
    res.json(form);
  } catch (error) { console.error(error); res.status(500).json({ error: 'Error' }); }
});

// POST /api/formularios/guia-reemo
router.post('/guia-reemo', async (req: AuthRequest, res: Response) => {
  try {
    const { uppOrigenId, uppDestinoId, animalIds, motivoMovimiento, transportista, placas, vigenciaDias } = req.body;
    if (!animalIds?.length) { res.status(400).json({ error: 'Selecciona al menos un animal' }); return; }
    if (!uppOrigenId) { res.status(400).json({ error: 'Selecciona UPP de origen' }); return; }

    const miId = await getMiPropietarioId(req.userId!);
    const [animales, origen, destino] = await Promise.all([
      prisma.animal.findMany({ where: { id: { in: animalIds } }, include: { propietario: true, upp: true } }),
      prisma.uPP.findUnique({ where: { id: uppOrigenId }, include: { propietario: true } }),
      uppDestinoId ? prisma.uPP.findUnique({ where: { id: uppDestinoId }, include: { propietario: true } }) : null,
    ]);

    const propOrigen = origen?.propietario;
    const propDestino = destino?.propietario;

    const folio = generarFolio('GUIA_REEMO');
    const formulario = await prisma.formulario.create({
      data: {
        tipo: 'GUIA_REEMO', folio, usuarioId: req.userId!, estatus: 'BORRADOR',
        datos: {
          tipo: 'GUIA_REEMO', folio,
          propietarioOrigen: propOrigen ? `${propOrigen.nombre} ${propOrigen.apellidos}` : '',
          curpOrigen: propOrigen?.curp, telefonoOrigen: propOrigen?.telefono,
          uppOrigen: origen?.nombre, claveUppOrigen: origen?.claveUPP, municipioOrigen: origen?.municipio,
          propietarioDestino: propDestino ? `${propDestino.nombre} ${propDestino.apellidos}` : 'N/A',
          uppDestino: destino?.nombre || 'N/A', claveUppDestino: destino?.claveUPP || '', municipioDestino: destino?.municipio || '',
          animales: animales.map(a => ({ arete: a.areteNacional, raza: a.raza, sexo: a.sexo, color: a.color, peso: a.peso, estatusSanitario: a.estatusSanitario })),
          totalAnimales: animales.length,
          motivoMovimiento: motivoMovimiento || 'Movilización',
          transportista: transportista || '', placas: placas || '',
          fechaEmision: new Date().toISOString(),
          vigenciaHasta: new Date(Date.now() + (vigenciaDias || 5) * 86400000).toISOString(),
          estatusSanitarioOrigen: origen?.estatusSanitario,
          requiereAprobacionDestino: destino && propDestino && miId !== propDestino.id,
        },
      },
    });
    res.status(201).json(formulario);
  } catch (error) { console.error(error); res.status(500).json({ error: 'Error al crear guía' }); }
});

// POST /api/formularios/constancia-zoosanitaria
router.post('/constancia-zoosanitaria', async (req: AuthRequest, res: Response) => {
  try {
    if (req.userRol !== 'MVZ' && req.userRol !== 'ADMIN') {
      res.status(403).json({ error: 'Solo MVZ puede emitir constancias' }); return;
    }
    const { animalIds, uppId, mvzNombre, mvzCedula, dictamen, observaciones } = req.body;
    if (!animalIds?.length) { res.status(400).json({ error: 'Selecciona al menos un animal' }); return; }
    if (!uppId) { res.status(400).json({ error: 'Selecciona una UPP' }); return; }

    const upp = await prisma.uPP.findUnique({ where: { id: uppId }, include: { propietario: true } });
    const animales = await prisma.animal.findMany({
      where: { id: { in: animalIds } },
      select: { areteNacional: true, nombre: true, raza: true, sexo: true, estatusSanitario: true, peso: true },
    });

    const folio = generarFolio('CERTIFICADO_ZOOSANITARIO');
    const formulario = await prisma.formulario.create({
      data: {
        tipo: 'CERTIFICADO_ZOOSANITARIO', folio, usuarioId: req.userId!, estatus: 'BORRADOR',
        datos: {
          tipo: 'CERTIFICADO_ZOOSANITARIO', folio,
          propietario: upp?.propietario ? `${upp.propietario.nombre} ${upp.propietario.apellidos}` : '',
          curp: upp?.propietario?.curp,
          upp: upp?.nombre, claveUpp: upp?.claveUPP, municipio: upp?.municipio,
          animales: animales.map(a => ({ arete: a.areteNacional, nombre: a.nombre, raza: a.raza, sexo: a.sexo, estatus: a.estatusSanitario, peso: a.peso })),
          totalAnimales: animales.length,
          mvzNombre: mvzNombre || '', mvzCedula: mvzCedula || '',
          dictamen: dictamen || 'FAVORABLE', observaciones: observaciones || '',
          fechaEmision: new Date().toISOString(),
          vigenciaHasta: new Date(Date.now() + 30 * 86400000).toISOString(),
        },
      },
    });
    res.status(201).json(formulario);
  } catch (error) { console.error(error); res.status(500).json({ error: 'Error al crear constancia' }); }
});

// POST /api/formularios/solicitud-tb-br
router.post('/solicitud-tb-br', async (req: AuthRequest, res: Response) => {
  try {
    const { uppId, totalAnimalesPrueba, fechaSolicitada, observaciones } = req.body;
    if (!uppId) { res.status(400).json({ error: 'Selecciona una UPP' }); return; }

    const upp = await prisma.uPP.findUnique({ where: { id: uppId }, include: { propietario: true } });
    const prop = upp?.propietario;

    const folio = generarFolio('SOLICITUD_TB_BR');
    const formulario = await prisma.formulario.create({
      data: {
        tipo: 'SOLICITUD_TB_BR', folio, usuarioId: req.userId!, estatus: 'BORRADOR',
        datos: {
          tipo: 'SOLICITUD_TB_BR', folio,
          propietario: prop ? `${prop.nombre} ${prop.apellidos}` : '',
          curp: prop?.curp, telefono: prop?.telefono,
          upp: upp?.nombre, claveUpp: upp?.claveUPP, municipio: upp?.municipio,
          totalAnimalesPrueba: totalAnimalesPrueba || 0,
          fechaSolicitada: fechaSolicitada || '', observaciones: observaciones || '',
          fechaSolicitud: new Date().toISOString(),
        },
      },
    });
    res.status(201).json(formulario);
  } catch (error) { console.error(error); res.status(500).json({ error: 'Error al crear solicitud' }); }
});

// PUT /api/formularios/:id - Editar borrador
router.put('/:id', async (req: AuthRequest, res: Response) => {
  try {
    const form = await prisma.formulario.findUnique({ where: { id: req.params.id } });
    if (!form) { res.status(404).json({ error: 'No encontrado' }); return; }
    if (form.estatus !== 'BORRADOR') { res.status(400).json({ error: 'Solo se pueden editar formularios en borrador' }); return; }
    if (form.usuarioId !== req.userId && req.userRol !== 'ADMIN') {
      res.status(403).json({ error: 'Solo el creador puede editar' }); return;
    }
    const { datos } = req.body;
    const updated = await prisma.formulario.update({ where: { id: req.params.id }, data: { datos } });
    res.json({ message: 'Formulario actualizado', formulario: updated });
  } catch (error) { console.error(error); res.status(500).json({ error: 'Error al editar' }); }
});

// PUT /api/formularios/:id/estatus
router.put('/:id/estatus', async (req: AuthRequest, res: Response) => {
  try {
    const { estatus } = req.body;
    const form = await prisma.formulario.findUnique({ where: { id: req.params.id } });
    if (!form) { res.status(404).json({ error: 'No encontrado' }); return; }

    if (estatus === 'ENVIADO' && form.estatus !== 'BORRADOR') { res.status(400).json({ error: 'Solo borradores se pueden enviar' }); return; }
    if ((estatus === 'APROBADO' || estatus === 'RECHAZADO')) {
      if (req.userRol !== 'ADMIN') { res.status(403).json({ error: 'Solo el administrador puede aprobar o rechazar' }); return; }
      if (form.estatus !== 'ENVIADO') { res.status(400).json({ error: 'Solo formularios enviados se pueden aprobar/rechazar' }); return; }
    }

    const updated = await prisma.formulario.update({ where: { id: req.params.id }, data: { estatus } });
    res.json({ message: `Formulario ${estatus.toLowerCase()}`, formulario: updated });
  } catch (error) { console.error(error); res.status(500).json({ error: 'Error' }); }
});

// GET /api/formularios/:id/pdf - Generar documento HTML (imprimible como PDF)
router.get('/:id/pdf', async (req: AuthRequest, res: Response) => {
  try {
    const form = await prisma.formulario.findUnique({ where: { id: req.params.id } });
    if (!form) { res.status(404).json({ error: 'No encontrado' }); return; }
    const d = form.datos as any;
    const eb = form.estatus === 'APROBADO' ? 'badge-green' : form.estatus === 'ENVIADO' ? 'badge-blue' : form.estatus === 'RECHAZADO' ? 'badge-red' : 'badge-yellow';

    const css = `<style>
      *{margin:0;padding:0;box-sizing:border-box;font-family:'Helvetica','Arial',sans-serif}
      @media print{body{padding:20px}@page{margin:15mm}}
      body{padding:40px;color:#1a1a1a;max-width:800px;margin:0 auto}
      .header{text-align:center;border-bottom:3px solid #006847;padding-bottom:15px;margin-bottom:20px}
      .header h1{font-size:13px;color:#006847;letter-spacing:1.5px}
      .header h2{font-size:18px;margin-top:8px}
      .header .folio{font-size:12px;color:#666;margin-top:5px;font-family:monospace}
      .badge{display:inline-block;padding:3px 12px;border-radius:4px;font-size:11px;font-weight:bold}
      .badge-green{background:#d1fae5;color:#065f46}.badge-blue{background:#dbeafe;color:#1e40af}
      .badge-red{background:#fee2e2;color:#991b1b}.badge-yellow{background:#fef3c7;color:#92400e}
      .section{margin:15px 0}
      .section h3{font-size:12px;color:#006847;border-bottom:1px solid #e5e7eb;padding-bottom:4px;margin-bottom:8px;text-transform:uppercase;letter-spacing:1px}
      .grid{display:grid;grid-template-columns:1fr 1fr;gap:8px}
      .field{font-size:12px}.field .label{color:#6b7280;font-size:10px;text-transform:uppercase}.field .value{font-weight:600;margin-top:1px}
      table{width:100%;border-collapse:collapse;font-size:11px;margin-top:8px}
      th{background:#f3f4f6;padding:6px 8px;text-align:left;font-size:10px;text-transform:uppercase;color:#6b7280;border:1px solid #e5e7eb}
      td{padding:5px 8px;border:1px solid #e5e7eb}
      .sigs{display:grid;grid-template-columns:1fr 1fr;gap:40px;margin-top:60px}
      .sig{border-top:1px solid #333;padding-top:5px;text-align:center;font-size:11px}
      .footer{margin-top:30px;border-top:2px solid #006847;padding-top:10px;text-align:center;font-size:10px;color:#9ca3af}
      .no-print{margin-bottom:15px}@media print{.no-print{display:none}}
    </style>`;

    let body = '';
    if (form.tipo === 'GUIA_REEMO') {
      body = `<div class="header"><h1>SECRETARÍA DE AGRICULTURA Y DESARROLLO RURAL</h1><h1>SENASICA</h1><h2>GUÍA DE TRÁNSITO — REEMO</h2><div class="folio">${d.folio} &nbsp;<span class="badge ${eb}">${form.estatus}</span></div></div>
      <div class="section"><h3>Origen</h3><div class="grid"><div class="field"><div class="label">Propietario</div><div class="value">${d.propietarioOrigen}</div></div><div class="field"><div class="label">CURP</div><div class="value">${d.curpOrigen||'—'}</div></div><div class="field"><div class="label">UPP</div><div class="value">${d.uppOrigen} (${d.claveUppOrigen})</div></div><div class="field"><div class="label">Municipio</div><div class="value">${d.municipioOrigen}</div></div></div></div>
      <div class="section"><h3>Destino</h3><div class="grid"><div class="field"><div class="label">Propietario</div><div class="value">${d.propietarioDestino}</div></div><div class="field"><div class="label">UPP</div><div class="value">${d.uppDestino} ${d.claveUppDestino?'('+d.claveUppDestino+')':''}</div></div><div class="field"><div class="label">Municipio</div><div class="value">${d.municipioDestino||'—'}</div></div><div class="field"><div class="label">Motivo</div><div class="value">${d.motivoMovimiento}</div></div></div></div>
      <div class="section"><h3>Transporte</h3><div class="grid"><div class="field"><div class="label">Transportista</div><div class="value">${d.transportista||'—'}</div></div><div class="field"><div class="label">Placas</div><div class="value">${d.placas||'—'}</div></div></div></div>
      <div class="section"><h3>Animales (${d.totalAnimales})</h3><table><tr><th>Arete</th><th>Raza</th><th>Sexo</th><th>Color</th><th>Peso</th><th>Estatus</th></tr>${(d.animales||[]).map((a:any)=>`<tr><td>${a.arete}</td><td>${a.raza}</td><td>${a.sexo}</td><td>${a.color||'—'}</td><td>${a.peso?a.peso+' kg':'—'}</td><td>${a.estatusSanitario||'—'}</td></tr>`).join('')}</table></div>
      <div class="section"><h3>Vigencia</h3><div class="grid"><div class="field"><div class="label">Emisión</div><div class="value">${formatFecha(d.fechaEmision)}</div></div><div class="field"><div class="label">Vigente hasta</div><div class="value">${formatFecha(d.vigenciaHasta)}</div></div></div></div>`;
    } else if (form.tipo === 'CERTIFICADO_ZOOSANITARIO') {
      body = `<div class="header"><h1>SECRETARÍA DE AGRICULTURA Y DESARROLLO RURAL</h1><h1>SENASICA — DIRECCIÓN GENERAL DE SALUD ANIMAL</h1><h2>CONSTANCIA ZOOSANITARIA</h2><div class="folio">${d.folio} &nbsp;<span class="badge ${eb}">${form.estatus}</span></div></div>
      <div class="section"><h3>Propietario</h3><div class="grid"><div class="field"><div class="label">Nombre</div><div class="value">${d.propietario}</div></div><div class="field"><div class="label">CURP</div><div class="value">${d.curp||'—'}</div></div><div class="field"><div class="label">UPP</div><div class="value">${d.upp} (${d.claveUpp})</div></div><div class="field"><div class="label">Municipio</div><div class="value">${d.municipio}, Durango</div></div></div></div>
      <div class="section"><h3>Dictamen</h3><div class="grid"><div class="field"><div class="label">Resultado</div><div class="value"><span class="badge ${d.dictamen==='FAVORABLE'?'badge-green':'badge-red'}">${d.dictamen}</span></div></div><div class="field"><div class="label">MVZ</div><div class="value">${d.mvzNombre||'—'} ${d.mvzCedula?'('+d.mvzCedula+')':''}</div></div></div>${d.observaciones?`<div class="field" style="margin-top:8px"><div class="label">Observaciones</div><div class="value">${d.observaciones}</div></div>`:''}</div>
      <div class="section"><h3>Animales (${d.totalAnimales})</h3><table><tr><th>Arete</th><th>Raza</th><th>Sexo</th><th>Estatus</th><th>Peso</th></tr>${(d.animales||[]).map((a:any)=>`<tr><td>${a.arete}</td><td>${a.raza}</td><td>${a.sexo}</td><td>${a.estatus}</td><td>${a.peso?a.peso+' kg':'—'}</td></tr>`).join('')}</table></div>
      <div class="section"><h3>Vigencia</h3><div class="grid"><div class="field"><div class="label">Emisión</div><div class="value">${formatFecha(d.fechaEmision)}</div></div><div class="field"><div class="label">Vigente hasta</div><div class="value">${formatFecha(d.vigenciaHasta)}</div></div></div></div>`;
    } else {
      body = `<div class="header"><h1>SECRETARÍA DE AGRICULTURA Y DESARROLLO RURAL</h1><h1>SENASICA — CAMPAÑA CONTRA TUBERCULOSIS Y BRUCELOSIS</h1><h2>SOLICITUD DE PRUEBAS TB / BR</h2><div class="folio">${d.folio} &nbsp;<span class="badge ${eb}">${form.estatus}</span></div></div>
      <div class="section"><h3>Solicitante</h3><div class="grid"><div class="field"><div class="label">Propietario</div><div class="value">${d.propietario}</div></div><div class="field"><div class="label">CURP</div><div class="value">${d.curp||'—'}</div></div><div class="field"><div class="label">Teléfono</div><div class="value">${d.telefono||'—'}</div></div></div></div>
      <div class="section"><h3>Unidad de Producción</h3><div class="grid"><div class="field"><div class="label">UPP</div><div class="value">${d.upp} (${d.claveUpp})</div></div><div class="field"><div class="label">Municipio</div><div class="value">${d.municipio}, Durango</div></div></div></div>
      <div class="section"><h3>Detalles</h3><div class="grid"><div class="field"><div class="label">Animales a muestrear</div><div class="value">${d.totalAnimalesPrueba}</div></div><div class="field"><div class="label">Fecha solicitada</div><div class="value">${d.fechaSolicitada?formatFecha(d.fechaSolicitada):'Por definir'}</div></div></div>${d.observaciones?`<div class="field" style="margin-top:8px"><div class="label">Observaciones</div><div class="value">${d.observaciones}</div></div>`:''}</div>`;
    }

    const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>${d.folio}</title>${css}</head><body>
      <div class="no-print"><button onclick="window.print()" style="padding:8px 20px;background:#006847;color:white;border:none;border-radius:6px;cursor:pointer;font-size:14px">🖨️ Imprimir / Guardar PDF</button></div>
      ${body}
      <div class="sigs"><div class="sig">Firma del Solicitante</div><div class="sig">Sello / Firma de Autoridad</div></div>
      <div class="footer"><p>SIGGAN — Sistema Integral de Gestión Ganadera • Durango ${new Date().getFullYear()}</p></div>
    </body></html>`;

    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.send(html);
  } catch (error) { console.error(error); res.status(500).json({ error: 'Error al generar PDF' }); }
});

export default router;
