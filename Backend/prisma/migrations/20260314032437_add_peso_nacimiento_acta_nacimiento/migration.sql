-- AlterEnum
ALTER TYPE "TipoFormulario" ADD VALUE 'ACTA_NACIMIENTO';

-- AlterTable
ALTER TABLE "animales" ADD COLUMN     "pesoNacimiento" DOUBLE PRECISION;
