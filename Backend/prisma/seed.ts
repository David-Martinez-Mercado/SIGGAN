import { PrismaClient, Rol, Sexo, TipoEvento } from '@prisma/client';
import bcrypt from 'bcrypt';

const prisma = new PrismaClient();

const RAZAS = ['Hereford','Angus','Charolais','Simmental','Brahman','Beefmaster','Brangus','Criollo','Holstein','Suizo'];
const COLORES = ['Negro','Rojo','Blanco','Pinto','Bayo','Colorado','Hosco','Gris','Amarillo','Manchado'];

async function main() {
  console.log('🌱 Iniciando seed de SIGGAN...\n');
  const passwordHash = await bcrypt.hash('siggan2026', 10);

  // ===== ADMIN y MVZ =====
  await prisma.usuario.create({ data: { email:'admin@siggan.mx', password:passwordHash, nombre:'Administrador', apellidos:'SIGGAN', rol:Rol.ADMIN, telefono:'618-100-0001' } });
  await prisma.usuario.create({ data: { email:'mvz@siggan.mx', password:passwordHash, nombre:'Dr. Roberto', apellidos:'Hernández García', rol:Rol.MVZ, telefono:'618-200-0001' } });
  console.log('✅ Admin y MVZ creados');

  // ===== PROPIETARIOS (cada uno con su cuenta) =====
  const prop1User = await prisma.usuario.create({ data: { email:'juan.martinez@siggan.mx', password:passwordHash, nombre:'Juan', apellidos:'Martínez López', rol:Rol.PRODUCTOR, telefono:'618-300-0001' } });
  const prop2User = await prisma.usuario.create({ data: { email:'maria.garcia@siggan.mx', password:passwordHash, nombre:'María Elena', apellidos:'García Soto', rol:Rol.PRODUCTOR, telefono:'618-300-0002' } });
  const prop3User = await prisma.usuario.create({ data: { email:'pedro.rodriguez@siggan.mx', password:passwordHash, nombre:'Pedro', apellidos:'Rodríguez Chávez', rol:Rol.PRODUCTOR, telefono:'618-300-0003' } });
  const prop4User = await prisma.usuario.create({ data: { email:'asociacion.santiago@siggan.mx', password:passwordHash, nombre:'Asociación Ganadera Local', apellidos:'de Santiago Papasquiaro', rol:Rol.PRODUCTOR, telefono:'674-862-0001' } });

  const propietarios = await Promise.all([
    prisma.propietario.create({ data: { nombre:'Juan', apellidos:'Martínez López', curp:'MALJ800515HDGRPN01', rfc:'MALJ800515ABC', telefono:'618-300-0001', direccion:'Rancho El Refugio, Km 15 Carr. Durango-Mazatlán', municipio:'Durango', usuarioId:prop1User.id } }),
    prisma.propietario.create({ data: { nombre:'María Elena', apellidos:'García Soto', curp:'GASM750823HDGRSN02', telefono:'618-300-0002', direccion:'Rancho La Esperanza, Canatlán', municipio:'Canatlán', usuarioId:prop2User.id } }),
    prisma.propietario.create({ data: { nombre:'Pedro', apellidos:'Rodríguez Chávez', curp:'ROCP900112HDGDHR03', telefono:'618-300-0003', direccion:'Rancho San Pedro, Nombre de Dios', municipio:'Nombre de Dios', usuarioId:prop3User.id } }),
    prisma.propietario.create({ data: { nombre:'Asociación Ganadera Local', apellidos:'de Santiago Papasquiaro', rfc:'AGL950601ABC', telefono:'674-862-0001', direccion:'Av. Hidalgo 120, Centro', municipio:'Santiago Papasquiaro', usuarioId:prop4User.id } }),
  ]);
  console.log('✅ 4 propietarios creados (cada uno con su cuenta)');

  // ===== UPPs (Juan tiene 2) =====
  const upps = await Promise.all([
    prisma.uPP.create({ data: { claveUPP:'DGO10001234', nombre:'Rancho El Refugio', direccion:'Km 15 Carr. Durango-Mazatlán', municipio:'Durango', latitud:23.9842, longitud:-104.6721, tipoExplotacion:'Doble propósito', estatusSanitario:'LIBRE', superficieHa:250, capacidadAnimales:200, propietarioId:propietarios[0].id } }),
    prisma.uPP.create({ data: { claveUPP:'DGO10001235', nombre:'Rancho El Porvenir', direccion:'Km 30 Carr. Durango-Parral', municipio:'Guadalupe Victoria', latitud:24.4512, longitud:-104.1198, tipoExplotacion:'Engorda', estatusSanitario:'LIBRE', superficieHa:180, capacidadAnimales:120, propietarioId:propietarios[0].id } }),
    prisma.uPP.create({ data: { claveUPP:'DGO10005678', nombre:'Rancho La Esperanza', direccion:'Carr. Canatlán-Topia Km 8', municipio:'Canatlán', latitud:24.5198, longitud:-104.7830, tipoExplotacion:'Cría', estatusSanitario:'LIBRE', superficieHa:500, capacidadAnimales:350, propietarioId:propietarios[1].id } }),
    prisma.uPP.create({ data: { claveUPP:'DGO10009012', nombre:'Rancho San Pedro', direccion:'Camino vecinal a La Sierrita', municipio:'Nombre de Dios', latitud:23.8451, longitud:-104.2410, tipoExplotacion:'Engorda', estatusSanitario:'EN_PROCESO', superficieHa:180, capacidadAnimales:150, propietarioId:propietarios[2].id } }),
    prisma.uPP.create({ data: { claveUPP:'DGO10003456', nombre:'Centro de Acopio Santiago', direccion:'Km 3 Carr. a Tepehuanes', municipio:'Santiago Papasquiaro', latitud:24.9698, longitud:-105.4178, tipoExplotacion:'Engorda', estatusSanitario:'LIBRE', superficieHa:120, capacidadAnimales:100, propietarioId:propietarios[3].id } }),
  ]);
  console.log(`✅ ${upps.length} UPPs creadas (Juan tiene 2, los demás 1)`);

  // ===== ANIMALES =====
  const distribucion = [
    { propIdx:0, uppIdx:0, cantidad:8 },
    { propIdx:0, uppIdx:1, cantidad:4 },
    { propIdx:1, uppIdx:2, cantidad:8 },
    { propIdx:2, uppIdx:3, cantidad:6 },
    { propIdx:3, uppIdx:4, cantidad:4 },
  ];

  const nombresH = ['Luna','Estrella','Paloma','Canela','Mariposa','Perla','Mora','Dulce','Reina','Blanca'];
  const nombresM = ['Toro Negro','El Patrón','Centenario','Chapo','Rayo','Bravo','Lucero','Capitán','Rey','Diamante'];

  const animales: any[] = [];
  let c = 0;

  for (const dist of distribucion) {
    for (let i = 0; i < dist.cantidad; i++) {
      const sexo = c % 3 === 0 ? Sexo.MACHO : Sexo.HEMBRA;
      const fechaNac = new Date(); fechaNac.setFullYear(fechaNac.getFullYear() - (1 + Math.floor(Math.random()*4))); fechaNac.setMonth(Math.floor(Math.random()*12));
      const peso = sexo === Sexo.MACHO ? 450+Math.random()*200 : 350+Math.random()*150;
      const estatus = c === 25 ? 'REACTOR' : c === 28 ? 'EN_PRUEBA' : 'SANO';

      const animal = await prisma.animal.create({ data: {
        areteNacional: `MX10${String(45000+c).padStart(7,'0')}`,
        rfidTag: `RFID-DGO-${String(1000+c).padStart(6,'0')}`,
        nombre: sexo === Sexo.HEMBRA ? nombresH[c%10] : nombresM[c%10],
        raza: RAZAS[c%RAZAS.length], sexo, fechaNacimiento: fechaNac,
        color: COLORES[c%COLORES.length], peso,
        proposito: ['Cría','Engorda','Leche','Exportación'][c%4],
        estatusSanitario: estatus,
        areteExportacion: c%4===3 ? `EXP-MX-${String(1000+c).padStart(7,'0')}` : undefined,
        propietarioId: propietarios[dist.propIdx].id,
        uppId: upps[dist.uppIdx].id,
      }});
      animales.push(animal);

      await prisma.historialArete.create({ data: { animalId:animal.id, tipoArete:'NACIONAL', numeroArete:animal.areteNacional, accion:'ASIGNADO', motivo:'Registro SINIIGA' } });
      await prisma.historialArete.create({ data: { animalId:animal.id, tipoArete:'RFID', numeroArete:animal.rfidTag!, accion:'ASIGNADO', motivo:'Asignación automática' } });
      if (animal.areteExportacion) {
        await prisma.historialArete.create({ data: { animalId:animal.id, tipoArete:'EXPORTACION', numeroArete:animal.areteExportacion, accion:'ASIGNADO', motivo:'Propósito de exportación' } });
      }
      c++;
    }
  }
  console.log(`✅ ${animales.length} animales creados`);

  // ===== EVENTOS =====
  let eventCount = 0;
  for (let i = 0; i < animales.length; i++) {
    const a = animales[i];
    if (i%3 !== 0) {
      await prisma.eventoSanitario.create({ data: { animalId:a.id, tipo:TipoEvento.VACUNACION, descripcion:'Vacunación contra Brucela (cepa RB51)', fecha:new Date(2025,5,15), resultado:'APLICADA', mvzResponsable:'Dr. Roberto Hernández García', cedulaMvz:'MVZ-DGO-2845', lote:'LOTE-BR-2025-0147' } });
      eventCount++;
    }
    if (i < 20) {
      await prisma.eventoSanitario.create({ data: { animalId:a.id, tipo:TipoEvento.PRUEBA_TB, descripcion:'Prueba de tuberculina (PPD bovino)', fecha:new Date(2025,8,10), resultado:a.estatusSanitario==='REACTOR'?'POSITIVO':'NEGATIVO', mvzResponsable:'Dr. Roberto Hernández García', cedulaMvz:'MVZ-DGO-2845', lote:'LOTE-PPD-2025-0892', observaciones:a.estatusSanitario==='REACTOR'?'Animal reactor. Se notifica a SENASICA.':'Sin reacción a las 72 horas.' } });
      eventCount++;
    }
    await prisma.eventoSanitario.create({ data: { animalId:a.id, tipo:TipoEvento.PESAJE, descripcion:'Pesaje en báscula', fecha:new Date(2025,10,1), resultado:`${(350+Math.random()*200).toFixed(1)} kg` } });
    eventCount++;
  }
  console.log(`✅ ${eventCount} eventos sanitarios`);

  // ===== IoT =====
  let iotCount = 0;
  for (let i = 0; i < 10; i++) {
    for (let j = 0; j < 5; j++) {
      const ts = new Date(); ts.setHours(ts.getHours()-j*4);
      await prisma.lecturaIoT.create({ data: { animalId:animales[i].id, nodoId:`DGO-${String(i+1).padStart(3,'0')}`, latitud:23.98+(Math.random()-0.5)*0.01, longitud:-104.67+(Math.random()-0.5)*0.01, temperatura:38+(Math.random()-0.5)*2, rssi:-60-Math.floor(Math.random()*40), bateria:60+Math.random()*40, timestamp:ts } });
      iotCount++;
    }
  }
  console.log(`✅ ${iotCount} lecturas IoT`);

  // ===== MARKETPLACE =====
  await prisma.ofertaMarketplace.create({ data: { animalId:animales[14].id, vendedorId:propietarios[1].id, precioSolicitado:28000, descripcion:'Vaca Charolais de 3 años, excelente para cría.', motivoVenta:'Reducción de hato' } });
  await prisma.ofertaMarketplace.create({ data: { animalId:animales[2].id, vendedorId:propietarios[0].id, precioSolicitado:35000, precioOfertado:32000, estatus:'CON_OFERTA', compradorId:propietarios[2].id, descripcion:'Toro Angus registrado, ideal para mejoramiento genético.', motivoVenta:'Venta de sementales' } });
  console.log('✅ 2 ofertas marketplace');

  console.log('\n🎉 Seed completado!\n');
  console.log('📋 Credenciales:');
  console.log('   Admin:              admin@siggan.mx / siggan2026');
  console.log('   MVZ:                mvz@siggan.mx / siggan2026');
  console.log('   Juan (12 animales): juan.martinez@siggan.mx / siggan2026');
  console.log('   María (8 animales): maria.garcia@siggan.mx / siggan2026');
  console.log('   Pedro (6 animales): pedro.rodriguez@siggan.mx / siggan2026');
  console.log('   Asociación (4):     asociacion.santiago@siggan.mx / siggan2026');
}

main()
  .catch(e => { console.error('❌ Error:', e); process.exit(1); })
  .finally(async () => { await prisma.$disconnect(); });
