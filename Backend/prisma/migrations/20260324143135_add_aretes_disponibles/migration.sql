-- CreateTable
CREATE TABLE "aretes_disponibles" (
    "id" TEXT NOT NULL,
    "numero" TEXT NOT NULL,
    "tipo" TEXT NOT NULL,
    "asignado" BOOLEAN NOT NULL DEFAULT false,
    "animalId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "aretes_disponibles_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "aretes_disponibles_numero_key" ON "aretes_disponibles"("numero");
