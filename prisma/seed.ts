import { PrismaClient, Rol, Sexo, TipoEvento } from '@prisma/client';
import bcrypt from 'bcrypt';

const prisma = new PrismaClient();

const MUNICIPIOS_PILOTO = [
  'Canatlán', 'Durango', 'Guadalupe Victoria', 'Nombre de Dios',
  'Poanas', 'Pueblo Nuevo', 'Rodeo', 'San Juan del Río',
  'Santa Clara', 'Santiago Papasquiaro', 'Vicente Guerrero',
  'Nuevo Ideal', 'Gómez Palacio',
];

const RAZAS = [
  'Hereford', 'Angus', 'Charolais', 'Simmental', 'Brahman',
  'Beefmaster', 'Brangus', 'Criollo', 'Holstein', 'Suizo',
];

const COLORES = [
  'Negro', 'Rojo', 'Blanco', 'Pinto', 'Bayo', 'Colorado',
  'Hosco', 'Gris', 'Amarillo', 'Manchado',
];

async function main() {
  console.log('🌱 Iniciando seed de SIGGAN...\n');

  // ===== USUARIOS =====
  const passwordHash = await bcrypt.hash('siggan2026', 10);

  const admin = await prisma.usuario.create({
    data: {
      email: 'admin@siggan.mx',
      password: passwordHash,
      nombre: 'Administrador',
      apellidos: 'SIGGAN',
      rol: Rol.ADMIN,
      telefono: '618-100-0001',
    },
  });

  const mvz = await prisma.usuario.create({
    data: {
      email: 'mvz@siggan.mx',
      password: passwordHash,
      nombre: 'Dr. Roberto',
      apellidos: 'Hernández García',
      rol: Rol.MVZ,
      telefono: '618-200-0001',
    },
  });

  const productor1 = await prisma.usuario.create({
    data: {
      email: 'productor@siggan.mx',
      password: passwordHash,
      nombre: 'Juan',
      apellidos: 'Martínez López',
      rol: Rol.PRODUCTOR,
      telefono: '618-300-0001',
    },
  });

  console.log('✅ Usuarios creados (password: siggan2026)');

  // ===== PROPIETARIOS =====
  const propietarios = await Promise.all([
    prisma.propietario.create({
      data: {
        nombre: 'Juan',
        apellidos: 'Martínez López',
        curp: 'MALJ800515HDGRPN01',
        rfc: 'MALJ800515ABC',
        telefono: '618-300-0001',
        direccion: 'Rancho El Refugio, Km 15 Carr. Durango-Mazatlán',
        municipio: 'Durango',
        usuarioId: productor1.id,
      },
    }),
    prisma.propietario.create({
      data: {
        nombre: 'María Elena',
        apellidos: 'García Soto',
        curp: 'GASM750823HDGRSN02',
        telefono: '618-300-0002',
        direccion: 'Rancho La Esperanza, Canatlán',
        municipio: 'Canatlán',
      },
    }),
    prisma.propietario.create({
      data: {
        nombre: 'Pedro',
        apellidos: 'Rodríguez Chávez',
        curp: 'ROCP900112HDGDHR03',
        telefono: '618-300-0003',
        direccion: 'Rancho San Pedro, Nombre de Dios',
        municipio: 'Nombre de Dios',
      },
    }),
    prisma.propietario.create({
      data: {
        nombre: 'Asociación Ganadera Local',
        apellidos: 'de Santiago Papasquiaro',
        rfc: 'AGL950601ABC',
        telefono: '674-862-0001',
        direccion: 'Av. Hidalgo 120, Centro',
        municipio: 'Santiago Papasquiaro',
      },
    }),
  ]);

  console.log(`✅ ${propietarios.length} propietarios creados`);

  // ===== UPPs =====
  const upps = await Promise.all([
    prisma.uPP.create({
      data: {
        claveUPP: 'DGO10001234',
        nombre: 'Rancho El Refugio',
        direccion: 'Km 15 Carr. Durango-Mazatlán',
        municipio: 'Durango',
        latitud: 23.9842,
        longitud: -104.6721,
        tipoExplotacion: 'Doble propósito',
        estatusSanitario: 'LIBRE',
        superficieHa: 250,
        capacidadAnimales: 200,
        propietarioId: propietarios[0].id,
      },
    }),
    prisma.uPP.create({
      data: {
        claveUPP: 'DGO10005678',
        nombre: 'Rancho La Esperanza',
        direccion: 'Carr. Canatlán-Topia Km 8',
        municipio: 'Canatlán',
        latitud: 24.5198,
        longitud: -104.7830,
        tipoExplotacion: 'Cría',
        estatusSanitario: 'LIBRE',
        superficieHa: 500,
        capacidadAnimales: 350,
        propietarioId: propietarios[1].id,
      },
    }),
    prisma.uPP.create({
      data: {
        claveUPP: 'DGO10009012',
        nombre: 'Rancho San Pedro',
        direccion: 'Camino vecinal a La Sierrita',
        municipio: 'Nombre de Dios',
        latitud: 23.8451,
        longitud: -104.2410,
        tipoExplotacion: 'Engorda',
        estatusSanitario: 'EN_PROCESO',
        superficieHa: 180,
        capacidadAnimales: 150,
        propietarioId: propietarios[2].id,
      },
    }),
    prisma.uPP.create({
      data: {
        claveUPP: 'DGO10003456',
        nombre: 'Centro de Acopio Santiago',
        direccion: 'Km 3 Carr. a Tepehuanes',
        municipio: 'Santiago Papasquiaro',
        latitud: 24.9698,
        longitud: -105.4178,
        tipoExplotacion: 'Engorda',
        estatusSanitario: 'LIBRE',
        superficieHa: 120,
        capacidadAnimales: 100,
        propietarioId: propietarios[3].id,
      },
    }),
  ]);

  console.log(`✅ ${upps.length} UPPs creadas`);

  // ===== ANIMALES =====
  const animalesData: any[] = [];

  // Generar 30 animales distribuidos en las UPPs
  for (let i = 0; i < 30; i++) {
    const uppIndex = i % upps.length;
    const propIndex = uppIndex; // Mismo propietario que la UPP
    const sexo = i % 3 === 0 ? Sexo.MACHO : Sexo.HEMBRA;
    const raza = RAZAS[i % RAZAS.length];
    const color = COLORES[i % COLORES.length];

    // Fecha de nacimiento entre 1 y 5 años atrás
    const yearsAgo = 1 + Math.floor(Math.random() * 4);
    const monthOffset = Math.floor(Math.random() * 12);
    const fechaNac = new Date();
    fechaNac.setFullYear(fechaNac.getFullYear() - yearsAgo);
    fechaNac.setMonth(monthOffset);

    animalesData.push({
      areteNacional: `MX10${String(45000 + i).padStart(7, '0')}`,
      rfidTag: `RFID-DGO-${String(1000 + i).padStart(6, '0')}`,
      nombre: sexo === Sexo.HEMBRA
        ? ['Luna', 'Estrella', 'Paloma', 'Canela', 'Mariposa', 'Perla', 'Mora', 'Dulce', 'Reina', 'Blanca'][i % 10]
        : ['Toro Negro', 'El Patrón', 'Centenario', 'Chapo', 'Rayo', 'Bravo', 'Lucero', 'Capitán', 'Rey', 'Diamante'][i % 10],
      raza,
      sexo,
      fechaNacimiento: fechaNac,
      color,
      peso: sexo === Sexo.MACHO ? 450 + Math.random() * 200 : 350 + Math.random() * 150,
      proposito: ['Cría', 'Engorda', 'Leche', 'Exportación'][i % 4],
      estatusSanitario: i === 25 ? 'REACTOR' : i === 28 ? 'EN_PRUEBA' : 'SANO',
      propietarioId: propietarios[propIndex].id,
      uppId: upps[uppIndex].id,
    });
  }

  const animales = [];
  for (const data of animalesData) {
    const animal = await prisma.animal.create({ data });
    animales.push(animal);

    // Crear historial de arete inicial
    await prisma.historialArete.create({
      data: {
        animalId: animal.id,
        tipoArete: 'NACIONAL',
        numeroArete: animal.areteNacional,
        accion: 'ASIGNADO',
        motivo: 'Registro SINIIGA',
      },
    });
  }

  console.log(`✅ ${animales.length} animales creados con historial de aretes`);

  // ===== EVENTOS SANITARIOS =====
  let eventCount = 0;
  for (const animal of animales) {
    // Vacunación de brucela (todas las hembras)
    if (animalesData[animales.indexOf(animal)].sexo === Sexo.HEMBRA) {
      await prisma.eventoSanitario.create({
        data: {
          animalId: animal.id,
          tipo: TipoEvento.VACUNACION,
          descripcion: 'Vacunación contra Brucela (cepa RB51)',
          fecha: new Date(2025, 5, 15),
          resultado: 'APLICADA',
          mvzResponsable: 'Dr. Roberto Hernández García',
          cedulaMvz: 'MVZ-DGO-2845',
          lote: 'LOTE-BR-2025-0147',
        },
      });
      eventCount++;
    }

    // Prueba TB a los primeros 20
    if (animales.indexOf(animal) < 20) {
      await prisma.eventoSanitario.create({
        data: {
          animalId: animal.id,
          tipo: TipoEvento.PRUEBA_TB,
          descripcion: 'Prueba de tuberculina (PPD bovino)',
          fecha: new Date(2025, 8, 10),
          resultado: animal.estatusSanitario === 'REACTOR' ? 'POSITIVO' : 'NEGATIVO',
          mvzResponsable: 'Dr. Roberto Hernández García',
          cedulaMvz: 'MVZ-DGO-2845',
          lote: 'LOTE-PPD-2025-0892',
          observaciones: animal.estatusSanitario === 'REACTOR'
            ? 'Animal reactor. Se notifica a SENASICA para seguimiento.'
            : 'Sin reacción a las 72 horas.',
        },
      });
      eventCount++;
    }

    // Pesaje
    await prisma.eventoSanitario.create({
      data: {
        animalId: animal.id,
        tipo: TipoEvento.PESAJE,
        descripcion: `Pesaje en báscula: ${animalesData[animales.indexOf(animal)].peso?.toFixed(1)} kg`,
        fecha: new Date(2025, 10, 1),
        resultado: `${animalesData[animales.indexOf(animal)].peso?.toFixed(1)} kg`,
      },
    });
    eventCount++;
  }

  console.log(`✅ ${eventCount} eventos sanitarios creados`);

  // ===== LECTURAS IoT (simuladas) =====
  let iotCount = 0;
  for (let i = 0; i < 10; i++) {
    const animal = animales[i];
    const upp = upps[i % upps.length];

    // 5 lecturas por animal en las últimas 24 horas
    for (let j = 0; j < 5; j++) {
      const hoursAgo = j * 4;
      const timestamp = new Date();
      timestamp.setHours(timestamp.getHours() - hoursAgo);

      await prisma.lecturaIoT.create({
        data: {
          animalId: animal.id,
          nodoId: `DGO-${String(i + 1).padStart(3, '0')}`,
          latitud: (upp.latitud || 24.0) + (Math.random() - 0.5) * 0.01,
          longitud: (upp.longitud || -104.6) + (Math.random() - 0.5) * 0.01,
          temperatura: 38.0 + (Math.random() - 0.5) * 2,
          rssi: -60 - Math.floor(Math.random() * 40),
          bateria: 60 + Math.random() * 40,
          timestamp,
        },
      });
      iotCount++;
    }
  }

  console.log(`✅ ${iotCount} lecturas IoT simuladas`);

  // ===== OFERTAS MARKETPLACE =====
  await prisma.ofertaMarketplace.create({
    data: {
      animalId: animales[5].id,
      vendedorId: propietarios[1].id,
      precioSolicitado: 28000,
      descripcion: 'Vaca Charolais de 3 años, excelente para cría. Libre de TB/BR.',
      motivoVenta: 'Reducción de hato',
    },
  });

  await prisma.ofertaMarketplace.create({
    data: {
      animalId: animales[12].id,
      vendedorId: propietarios[0].id,
      precioSolicitado: 35000,
      precioOfertado: 32000,
      estatus: 'CON_OFERTA',
      compradorId: propietarios[2].id,
      descripcion: 'Toro Angus registrado, ideal para mejoramiento genético.',
      motivoVenta: 'Venta de sementales',
    },
  });

  console.log('✅ 2 ofertas de marketplace creadas');

  console.log('\n🎉 Seed completado exitosamente!');
  console.log('\n📋 Credenciales de prueba:');
  console.log('   Admin:     admin@siggan.mx / siggan2026');
  console.log('   MVZ:       mvz@siggan.mx / siggan2026');
  console.log('   Productor: productor@siggan.mx / siggan2026');
}

main()
  .catch((e) => {
    console.error('❌ Error en seed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
