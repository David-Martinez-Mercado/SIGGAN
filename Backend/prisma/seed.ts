import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Ejecutando seed...');

  // ==================== SUPER ADMIN PRIMARIO ====================
  const superAdminPassword = await bcrypt.hash('super123', 10);
  const superAdmin = await prisma.usuario.upsert({
    where: { email: 'superadmin@siggan.mx' },
    update: {},
    create: {
      email: 'superadmin@siggan.mx',
      password: superAdminPassword,
      nombre: 'Super',
      apellidos: 'Admin',
      rol: 'SUPER_ADMIN',
      estatus: 'ACTIVO',
      activo: true,
      esSuperAdmin: true,
      esPrimario: true,  // El único primario
      municipio: 'Durango',
    },
  });
  console.log(`✅ Super Admin Primario: superadmin@siggan.mx / super123`);

  // ==================== ADMIN ====================
  const adminPassword = await bcrypt.hash('admin123', 10);
  const admin = await prisma.usuario.upsert({
    where: { email: 'admin@siggan.mx' },
    update: {},
    create: {
      email: 'admin@siggan.mx',
      password: adminPassword,
      nombre: 'Carlos',
      apellidos: 'Administrador',
      rol: 'ADMIN',
      estatus: 'ACTIVO',
      activo: true,
      creadoPorId: superAdmin.id,
      municipio: 'Durango',
    },
  });
  console.log(`✅ Admin: admin@siggan.mx / admin123`);

  // ==================== MVZ ====================
  const mvzPassword = await bcrypt.hash('mvz123', 10);
  const mvz = await prisma.usuario.upsert({
    where: { email: 'mvz@siggan.mx' },
    update: {},
    create: {
      email: 'mvz@siggan.mx',
      password: mvzPassword,
      nombre: 'Dr. Roberto',
      apellidos: 'Méndez García',
      rol: 'MVZ',
      estatus: 'ACTIVO',
      activo: true,
      telefono: '6181234567',
      rfc: 'MEGR800115ABC',
      cedulaProfesional: '12345678',
      credencialSenasica: 'SEN-DGO-2024-001',
      vigenciaCredencial: new Date('2027-12-31'),
      ddr: 'DDR 01 Durango',
    },
  });
  console.log(`✅ MVZ: mvz@siggan.mx / mvz123`);

  // ==================== PRODUCTORES ====================
  const prodPassword = await bcrypt.hash('prod123', 10);

  const juan = await prisma.usuario.upsert({
    where: { email: 'juan@email.com' },
    update: {},
    create: {
      email: 'juan@email.com',
      password: prodPassword,
      nombre: 'Juan',
      apellidos: 'Pérez López',
      rol: 'PRODUCTOR',
      estatus: 'ACTIVO',
      activo: true,
      telefono: '6189876543',
      rfc: 'PELJ850720ABC',
      curp: 'PELJ850720HDGRPN01',
      direccion: 'Calle Ganaderos #123',
      municipio: 'Durango',
    },
  });

  const maria = await prisma.usuario.upsert({
    where: { email: 'maria@email.com' },
    update: {},
    create: {
      email: 'maria@email.com',
      password: prodPassword,
      nombre: 'María',
      apellidos: 'García Soto',
      rol: 'PRODUCTOR',
      estatus: 'ACTIVO',
      activo: true,
      telefono: '6187654321',
      rfc: 'GASM900305XYZ',
      curp: 'GASM900305MDGRRT09',
      direccion: 'Rancho Las Flores',
      municipio: 'Canatlán',
    },
  });
  console.log(`✅ Productores: juan@email.com y maria@email.com / prod123`);

  // ==================== PROPIETARIOS ====================
  const propJuan = await prisma.propietario.upsert({
    where: { curp: 'PELJ850720HDGRPN01' },
    update: {},
    create: {
      nombre: 'Juan', apellidos: 'Pérez López',
      curp: 'PELJ850720HDGRPN01', rfc: 'PELJ850720ABC',
      telefono: '6189876543', direccion: 'Calle Ganaderos #123',
      municipio: 'Durango', usuarioId: juan.id,
    },
  });

  const propMaria = await prisma.propietario.upsert({
    where: { curp: 'GASM900305MDGRRT09' },
    update: {},
    create: {
      nombre: 'María', apellidos: 'García Soto',
      curp: 'GASM900305MDGRRT09', rfc: 'GASM900305XYZ',
      telefono: '6187654321', direccion: 'Rancho Las Flores',
      municipio: 'Canatlán', usuarioId: maria.id,
    },
  });

  // ==================== UPPs ====================
  const upp1 = await prisma.uPP.create({
    data: { claveUPP: '100100000001', nombre: 'Rancho El Mezquite', municipio: 'Durango', latitud: 24.02, longitud: -104.67, tipoExplotacion: 'Cría', superficieHa: 150, capacidadAnimales: 200, propietarioId: propJuan.id },
  });
  const upp2 = await prisma.uPP.create({
    data: { claveUPP: '100500000002', nombre: 'Rancho Las Flores', municipio: 'Canatlán', latitud: 24.52, longitud: -104.78, tipoExplotacion: 'Doble propósito', superficieHa: 300, capacidadAnimales: 400, propietarioId: propMaria.id },
  });
  console.log(`✅ UPPs creadas`);

  // ==================== ANIMALES (30) ====================
  const razas = ['Hereford', 'Angus', 'Charolais', 'Simmental', 'Brahman', 'Beefmaster'];
  const colores = ['Rojo', 'Negro', 'Blanco', 'Pinto', 'Bayo', 'Colorado'];
  const propositos = ['CRIA', 'ENGORDA', 'LECHE', 'EXPORTACION'];
  const nombres = ['Luna', 'Estrella', 'Tormenta', 'Relámpago', 'Princesa', 'Toro Negro', 'Blanca Nieves', 'Canela', 'Paloma', 'Bravo'];

  for (let i = 1; i <= 30; i++) {
    const esDeJuan = i <= 15;
    const arete = `MX10-${String(i).padStart(8, '0')}`;
    const sexo = i % 3 === 0 ? 'MACHO' : 'HEMBRA';
    const animal = await prisma.animal.create({
      data: {
        areteNacional: arete,
        rfidTag: `RFID-${String(i).padStart(10, '0')}`,
        nombre: i <= 10 ? nombres[i - 1] : null,
        raza: razas[i % razas.length],
        sexo: sexo as any,
        fechaNacimiento: new Date(2020 + (i % 4), i % 12, (i % 28) + 1),
        color: colores[i % colores.length],
        peso: 300 + Math.floor(Math.random() * 400),
        proposito: propositos[i % propositos.length],
        propietarioId: esDeJuan ? propJuan.id : propMaria.id,
        uppId: esDeJuan ? upp1.id : upp2.id,
      },
    });

    // Historial de arete
    await prisma.historialArete.create({
      data: { tipoArete: 'NACIONAL', numeroArete: arete, accion: 'ASIGNADO', motivo: 'Registro inicial', animalId: animal.id },
    });
  }
  console.log(`✅ 30 animales creados con aretes`);

  // ==================== USUARIO PENDIENTE (para pruebas) ====================
  const pendientePassword = await bcrypt.hash('pend123', 10);
  await prisma.usuario.upsert({
    where: { email: 'pendiente@email.com' },
    update: {},
    create: {
      email: 'pendiente@email.com',
      password: pendientePassword,
      nombre: 'Pedro',
      apellidos: 'Rodríguez (Pendiente)',
      rol: 'PRODUCTOR',
      estatus: 'PENDIENTE',
      activo: false,
      curp: 'RODP950415HDGRDR08',
      municipio: 'Nombre de Dios',
    },
  });
  console.log(`✅ Usuario pendiente: pendiente@email.com / pend123 (para probar aprobación)`);

  console.log('\n🎉 Seed completado!');
  console.log('📋 Usuarios de prueba:');
  console.log('   superadmin@siggan.mx / super123  (SUPER_ADMIN Primario)');
  console.log('   admin@siggan.mx / admin123        (ADMIN)');
  console.log('   mvz@siggan.mx / mvz123            (MVZ)');
  console.log('   juan@email.com / prod123           (PRODUCTOR)');
  console.log('   maria@email.com / prod123          (PRODUCTOR)');
  console.log('   pendiente@email.com / pend123      (PENDIENTE)');
}

main()
  .catch(e => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
