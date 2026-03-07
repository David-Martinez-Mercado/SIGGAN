/*
  Warnings:

  - The values [AUTORIDAD,OPERADOR] on the enum `Rol` will be removed. If these variants are still used in the database, this will fail.
  - You are about to drop the column `createdAt` on the `alertas_iot` table. All the data in the column will be lost.
  - You are about to drop the column `datos` on the `alertas_iot` table. All the data in the column will be lost.
  - You are about to drop the column `nodoId` on the `nodos_iot` table. All the data in the column will be lost.
  - You are about to drop the column `ultimaLectura` on the `nodos_iot` table. All the data in the column will be lost.
  - You are about to drop the column `uppId` on the `nodos_iot` table. All the data in the column will be lost.
  - Added the required column `nombre` to the `nodos_iot` table without a default value. This is not possible if the table is not empty.

*/
-- CreateEnum
CREATE TYPE "EstatusUsuario" AS ENUM ('PENDIENTE', 'ACTIVO', 'SUSPENDIDO_TEMPORAL', 'SUSPENDIDO_DEFINITIVO');

-- CreateEnum
CREATE TYPE "TipoSuspension" AS ENUM ('TEMPORAL', 'DEFINITIVO');

-- CreateEnum
CREATE TYPE "TipoDocumento" AS ENUM ('INE', 'EFIRMA_CER', 'EFIRMA_KEY', 'REGISTRO_SAT', 'DOCUMENTO_PROPIEDAD', 'RECIBO_COMPROBANTE', 'CREDENCIAL_SENASICA', 'CEDULA_PROFESIONAL');

-- AlterEnum
BEGIN;
CREATE TYPE "Rol_new" AS ENUM ('SUPER_ADMIN', 'ADMIN', 'PRODUCTOR', 'MVZ');
ALTER TABLE "public"."usuarios" ALTER COLUMN "rol" DROP DEFAULT;
ALTER TABLE "usuarios" ALTER COLUMN "rol" TYPE "Rol_new" USING ("rol"::text::"Rol_new");
ALTER TYPE "Rol" RENAME TO "Rol_old";
ALTER TYPE "Rol_new" RENAME TO "Rol";
DROP TYPE "public"."Rol_old";
ALTER TABLE "usuarios" ALTER COLUMN "rol" SET DEFAULT 'PRODUCTOR';
COMMIT;

-- DropIndex
DROP INDEX "nodos_iot_nodoId_key";

-- AlterTable
ALTER TABLE "alertas_iot" DROP COLUMN "createdAt",
DROP COLUMN "datos",
ADD COLUMN     "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "umbral" DOUBLE PRECISION,
ADD COLUMN     "valor" DOUBLE PRECISION;

-- AlterTable
ALTER TABLE "nodos_iot" DROP COLUMN "nodoId",
DROP COLUMN "ultimaLectura",
DROP COLUMN "uppId",
ADD COLUMN     "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "latitud" DOUBLE PRECISION,
ADD COLUMN     "longitud" DOUBLE PRECISION,
ADD COLUMN     "nombre" TEXT NOT NULL,
ADD COLUMN     "ultimaConexion" TIMESTAMP(3),
ALTER COLUMN "tipo" SET DEFAULT 'ESP32_LORA',
ALTER COLUMN "bateria" DROP NOT NULL;

-- AlterTable
ALTER TABLE "usuarios" ADD COLUMN     "cedulaProfesional" TEXT,
ADD COLUMN     "creadoPorId" TEXT,
ADD COLUMN     "credencialSenasica" TEXT,
ADD COLUMN     "curp" TEXT,
ADD COLUMN     "ddr" TEXT,
ADD COLUMN     "direccion" TEXT,
ADD COLUMN     "esPrimario" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "esSuperAdmin" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "estado" TEXT DEFAULT 'Durango',
ADD COLUMN     "estatus" "EstatusUsuario" NOT NULL DEFAULT 'PENDIENTE',
ADD COLUMN     "motivoSuspension" TEXT,
ADD COLUMN     "municipio" TEXT,
ADD COLUMN     "rfc" TEXT,
ADD COLUMN     "suspendidoAt" TIMESTAMP(3),
ADD COLUMN     "suspendidoPorId" TEXT,
ADD COLUMN     "tipoSuspension" "TipoSuspension",
ADD COLUMN     "vigenciaCredencial" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "documentos_usuario" (
    "id" TEXT NOT NULL,
    "tipo" "TipoDocumento" NOT NULL,
    "nombreArchivo" TEXT NOT NULL,
    "rutaArchivo" TEXT NOT NULL,
    "mimeType" TEXT,
    "size" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "usuarioId" TEXT NOT NULL,

    CONSTRAINT "documentos_usuario_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "usuarios" ADD CONSTRAINT "usuarios_creadoPorId_fkey" FOREIGN KEY ("creadoPorId") REFERENCES "usuarios"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "documentos_usuario" ADD CONSTRAINT "documentos_usuario_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "usuarios"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
