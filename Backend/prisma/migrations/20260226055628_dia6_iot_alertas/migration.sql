-- CreateTable
CREATE TABLE "nodos_iot" (
    "id" TEXT NOT NULL,
    "nodoId" TEXT NOT NULL,
    "tipo" TEXT NOT NULL,
    "ubicacion" TEXT,
    "bateria" DOUBLE PRECISION NOT NULL DEFAULT 100,
    "ultimaLectura" TIMESTAMP(3),
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "uppId" TEXT,

    CONSTRAINT "nodos_iot_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "alertas_iot" (
    "id" TEXT NOT NULL,
    "tipo" TEXT NOT NULL,
    "mensaje" TEXT NOT NULL,
    "severidad" TEXT NOT NULL DEFAULT 'MEDIA',
    "leida" BOOLEAN NOT NULL DEFAULT false,
    "animalId" TEXT,
    "nodoId" TEXT,
    "datos" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "alertas_iot_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "nodos_iot_nodoId_key" ON "nodos_iot"("nodoId");
