-- CreateEnum
CREATE TYPE "Rol" AS ENUM ('ADMIN', 'PRODUCTOR', 'MVZ', 'AUTORIDAD', 'OPERADOR');

-- CreateEnum
CREATE TYPE "Sexo" AS ENUM ('MACHO', 'HEMBRA');

-- CreateEnum
CREATE TYPE "TipoEvento" AS ENUM ('VACUNACION', 'PRUEBA_TB', 'PRUEBA_BR', 'DESPARASITACION', 'TRATAMIENTO', 'PESAJE', 'INSPECCION', 'OTRO');

-- CreateEnum
CREATE TYPE "TipoFormulario" AS ENUM ('SOLICITUD_TB_BR', 'PROGRAMACION_CAMPO', 'SOLICITUD_ARETES_EXPORTACION', 'GUIA_REEMO', 'CERTIFICADO_ZOOSANITARIO');

-- CreateEnum
CREATE TYPE "EstatusOferta" AS ENUM ('PUBLICADO', 'CON_OFERTA', 'ACEPTADA', 'EN_VERIFICACION', 'TRANSFERIDA', 'RECHAZADA', 'CANCELADA');

-- CreateTable
CREATE TABLE "usuarios" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "password" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "apellidos" TEXT NOT NULL,
    "rol" "Rol" NOT NULL DEFAULT 'PRODUCTOR',
    "telefono" TEXT,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "usuarios_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "propietarios" (
    "id" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "apellidos" TEXT NOT NULL,
    "curp" TEXT,
    "rfc" TEXT,
    "telefono" TEXT,
    "direccion" TEXT,
    "municipio" TEXT NOT NULL,
    "estado" TEXT NOT NULL DEFAULT 'Durango',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "usuarioId" TEXT,

    CONSTRAINT "propietarios_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "upps" (
    "id" TEXT NOT NULL,
    "claveUPP" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "direccion" TEXT,
    "municipio" TEXT NOT NULL,
    "estado" TEXT NOT NULL DEFAULT 'Durango',
    "latitud" DOUBLE PRECISION,
    "longitud" DOUBLE PRECISION,
    "tipoExplotacion" TEXT,
    "estatusSanitario" TEXT NOT NULL DEFAULT 'EN_PROCESO',
    "superficieHa" DOUBLE PRECISION,
    "capacidadAnimales" INTEGER,
    "activa" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "propietarioId" TEXT NOT NULL,

    CONSTRAINT "upps_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "animales" (
    "id" TEXT NOT NULL,
    "areteNacional" TEXT NOT NULL,
    "areteExportacion" TEXT,
    "rfidTag" TEXT,
    "nombre" TEXT,
    "raza" TEXT NOT NULL,
    "sexo" "Sexo" NOT NULL,
    "fechaNacimiento" TIMESTAMP(3) NOT NULL,
    "color" TEXT,
    "peso" DOUBLE PRECISION,
    "estatusSanitario" TEXT NOT NULL DEFAULT 'SANO',
    "proposito" TEXT,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "irisHash" TEXT,
    "blockchainTokenId" TEXT,
    "blockchainTxHash" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "propietarioId" TEXT NOT NULL,
    "uppId" TEXT NOT NULL,
    "madreId" TEXT,

    CONSTRAINT "animales_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "eventos_sanitarios" (
    "id" TEXT NOT NULL,
    "tipo" "TipoEvento" NOT NULL,
    "descripcion" TEXT,
    "fecha" TIMESTAMP(3) NOT NULL,
    "resultado" TEXT,
    "mvzResponsable" TEXT,
    "cedulaMvz" TEXT,
    "observaciones" TEXT,
    "lote" TEXT,
    "proximaFecha" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "animalId" TEXT NOT NULL,

    CONSTRAINT "eventos_sanitarios_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "historial_aretes" (
    "id" TEXT NOT NULL,
    "tipoArete" TEXT NOT NULL,
    "numeroArete" TEXT NOT NULL,
    "accion" TEXT NOT NULL,
    "motivo" TEXT,
    "fecha" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "animalId" TEXT NOT NULL,

    CONSTRAINT "historial_aretes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "formularios" (
    "id" TEXT NOT NULL,
    "tipo" "TipoFormulario" NOT NULL,
    "folio" TEXT NOT NULL,
    "datos" JSONB NOT NULL,
    "estatus" TEXT NOT NULL DEFAULT 'BORRADOR',
    "pdfUrl" TEXT,
    "qrCode" TEXT,
    "hashBlockchain" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "usuarioId" TEXT NOT NULL,

    CONSTRAINT "formularios_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "lecturas_iot" (
    "id" TEXT NOT NULL,
    "nodoId" TEXT NOT NULL,
    "latitud" DOUBLE PRECISION NOT NULL,
    "longitud" DOUBLE PRECISION NOT NULL,
    "temperatura" DOUBLE PRECISION,
    "rssi" INTEGER,
    "bateria" DOUBLE PRECISION,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "animalId" TEXT NOT NULL,

    CONSTRAINT "lecturas_iot_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ofertas_marketplace" (
    "id" TEXT NOT NULL,
    "precioSolicitado" DOUBLE PRECISION NOT NULL,
    "precioOfertado" DOUBLE PRECISION,
    "estatus" "EstatusOferta" NOT NULL DEFAULT 'PUBLICADO',
    "descripcion" TEXT,
    "motivoVenta" TEXT,
    "fechaPublicacion" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "fechaCierre" TIMESTAMP(3),
    "animalId" TEXT NOT NULL,
    "vendedorId" TEXT NOT NULL,
    "compradorId" TEXT,

    CONSTRAINT "ofertas_marketplace_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "usuarios_email_key" ON "usuarios"("email");

-- CreateIndex
CREATE UNIQUE INDEX "propietarios_curp_key" ON "propietarios"("curp");

-- CreateIndex
CREATE UNIQUE INDEX "upps_claveUPP_key" ON "upps"("claveUPP");

-- CreateIndex
CREATE UNIQUE INDEX "animales_areteNacional_key" ON "animales"("areteNacional");

-- CreateIndex
CREATE UNIQUE INDEX "animales_areteExportacion_key" ON "animales"("areteExportacion");

-- CreateIndex
CREATE UNIQUE INDEX "animales_rfidTag_key" ON "animales"("rfidTag");

-- CreateIndex
CREATE UNIQUE INDEX "formularios_folio_key" ON "formularios"("folio");

-- AddForeignKey
ALTER TABLE "propietarios" ADD CONSTRAINT "propietarios_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "usuarios"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "upps" ADD CONSTRAINT "upps_propietarioId_fkey" FOREIGN KEY ("propietarioId") REFERENCES "propietarios"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "animales" ADD CONSTRAINT "animales_propietarioId_fkey" FOREIGN KEY ("propietarioId") REFERENCES "propietarios"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "animales" ADD CONSTRAINT "animales_uppId_fkey" FOREIGN KEY ("uppId") REFERENCES "upps"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "animales" ADD CONSTRAINT "animales_madreId_fkey" FOREIGN KEY ("madreId") REFERENCES "animales"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "eventos_sanitarios" ADD CONSTRAINT "eventos_sanitarios_animalId_fkey" FOREIGN KEY ("animalId") REFERENCES "animales"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "historial_aretes" ADD CONSTRAINT "historial_aretes_animalId_fkey" FOREIGN KEY ("animalId") REFERENCES "animales"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "formularios" ADD CONSTRAINT "formularios_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "usuarios"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lecturas_iot" ADD CONSTRAINT "lecturas_iot_animalId_fkey" FOREIGN KEY ("animalId") REFERENCES "animales"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ofertas_marketplace" ADD CONSTRAINT "ofertas_marketplace_animalId_fkey" FOREIGN KEY ("animalId") REFERENCES "animales"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ofertas_marketplace" ADD CONSTRAINT "ofertas_marketplace_vendedorId_fkey" FOREIGN KEY ("vendedorId") REFERENCES "propietarios"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ofertas_marketplace" ADD CONSTRAINT "ofertas_marketplace_compradorId_fkey" FOREIGN KEY ("compradorId") REFERENCES "propietarios"("id") ON DELETE SET NULL ON UPDATE CASCADE;
