-- AlterTable
ALTER TABLE "animales" ADD COLUMN     "areteNacionalPadre" TEXT,
ADD COLUMN     "condicionCorporal" DOUBLE PRECISION,
ADD COLUMN     "esGemelar" BOOLEAN DEFAULT false,
ADD COLUMN     "horaNacimiento" TEXT,
ADD COLUMN     "numCriaCamada" INTEGER,
ADD COLUMN     "razaPadre" TEXT,
ADD COLUMN     "tipoParto" TEXT;

-- AlterTable
ALTER TABLE "eventos_sanitarios" ADD COLUMN     "rnmvz" TEXT,
ADD COLUMN     "vigenciaMvz" TEXT;

-- AlterTable
ALTER TABLE "upps" ADD COLUMN     "email" TEXT,
ADD COLUMN     "telefono" TEXT;
