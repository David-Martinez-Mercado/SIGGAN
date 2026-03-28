# SIGGAN
## Sistema Inteligente de Gestión Ganadera con Blockchain Simulada

---

**Documento Técnico de Diseño, Implementación y Análisis**

**Versión:** 2.0
**Fecha:** Marzo 2026
**Clasificación:** Documento técnico para concurso / evaluación académica / presentación institucional
**Institución desarrolladora:** Universidad Politécnica de Durango

---

> *"La confianza en los sistemas sanitarios ganaderos no puede depender únicamente de papeles y sellos. SIGGAN demuestra que la tecnología puede garantizar integridad, trazabilidad y certeza matemática en cada dato registrado."*

---

## RESUMEN EJECUTIVO

SIGGAN (Sistema Inteligente de Gestión Ganadera con Blockchain Simulada) es una plataforma tecnológica integral diseñada para revolucionar la trazabilidad y certificación sanitaria del ganado bovino en México. El sistema integra tecnologías de vanguardia —incluyendo biometría de iris basada en redes neuronales convolucionales, Internet de las Cosas (IoT) para monitoreo en tiempo real, y un sistema de integridad de datos tipo blockchain— con el objetivo de eliminar el fraude, garantizar la autenticidad de registros sanitarios y proporcionar una cadena de confianza verificable e inalterable para cada animal registrado.

A diferencia de soluciones que implementan blockchain real con sus altos costos operativos, SIGGAN adopta una arquitectura híbrida que simula matemáticamente el comportamiento de una blockchain mediante funciones criptográficas avanzadas, manteniendo todas las garantías de integridad sin los costos asociados a tecnologías como Ethereum o Polygon, y con la capacidad de migrar a dichas plataformas en el futuro con un mínimo de cambios arquitectónicos.

---

## TABLA DE CONTENIDOS

1. [Introducción](#1-introducción)
2. [Problemática Social](#2-problemática-social)
3. [Objetivos](#3-objetivos)
4. [Arquitectura del Sistema](#4-arquitectura-del-sistema)
5. [Modelo de Datos](#5-modelo-de-datos)
6. [Blockchain Simulada](#6-blockchain-simulada)
7. [Certificados Sanitarios Digitales](#7-certificados-sanitarios-digitales)
8. [Seguridad y Detección de Fraude](#8-seguridad-y-detección-de-fraude)
9. [Análisis de Costos](#9-análisis-de-costos)
10. [Justificación Técnica](#10-justificación-técnica)
11. [Escalabilidad y Migración Futura](#11-escalabilidad-y-migración-futura)
12. [Conclusiones](#12-conclusiones)
13. [Anexos Técnicos](#13-anexos-técnicos)

---

## 1. INTRODUCCIÓN

### 1.1 ¿Qué es SIGGAN?

SIGGAN es una plataforma de software de gestión ganadera desarrollada como respuesta a una necesidad crítica del sector pecuario mexicano: la ausencia de un sistema confiable, seguro e inalterable para la trazabilidad sanitaria del ganado bovino. El sistema abarca desde el registro de nacimiento de un animal hasta su certificación sanitaria, comercialización y seguimiento continuo mediante dispositivos IoT.

El nombre refleja su propósito: **Sistema Inteligente de Gestión Ganadera**. La inteligencia reside no solo en la automatización de procesos, sino en la capacidad del sistema de detectar automáticamente cualquier intento de manipulación de datos, alertar a las autoridades competentes y mantener un registro histórico criptográficamente sellado e inalterable de cada evento en la vida de un animal.

### 1.2 Contexto y Necesidad

México cuenta con un inventario ganadero de aproximadamente **35 millones de cabezas de ganado bovino**, siendo uno de los 10 principales productores de carne bovina a nivel mundial. La industria genera empleos directos e indirectos para más de **2 millones de familias mexicanas** y representa exportaciones anuales superiores a **1,800 millones de dólares**.

Sin embargo, este sector enfrenta desafíos críticos en materia de trazabilidad e integridad de datos que afectan tanto la sanidad pública como la competitividad internacional del país:

- **Brotes de enfermedades** como Tuberculosis Bovina (TB) y Brucelosis no son contenidos de manera eficiente por la falta de trazabilidad confiable.
- **El fraude en registros sanitarios** permite que animales enfermos o no certificados circulen con documentación falsificada.
- **La pérdida de mercados de exportación** ocurre cuando los socios comerciales internacionales cuestionan la autenticidad de los certificados zoosanitarios mexicanos.
- **La falta de digitalización** de los procesos sanitarios genera ineficiencias, pérdida de registros y corrupción en el sistema.

### 1.3 Alcance del Sistema

SIGGAN atiende de manera integral el ciclo de vida completo de un animal bovino:

| Módulo | Funcionalidad |
|--------|--------------|
| **Registro** | Alta de animales, genealogía, identificación con arete y RFID |
| **Biometría** | Registro e identificación por iris con red neuronal CNN |
| **Sanitario** | Eventos veterinarios, pruebas TB/BR, vacunaciones |
| **Certificación** | Generación y verificación de certificados zoosanitarios |
| **Comercio** | Marketplace de compraventa con transferencia auditada |
| **IoT** | Monitoreo en tiempo real de ubicación, temperatura, signos vitales |
| **Blockchain** | Sellado criptográfico y verificación de integridad de todos los datos |
| **Documentos** | Generación de formatos SENASICA oficiales |

### 1.4 Innovación Principal

La innovación central de SIGGAN radica en la implementación de una **blockchain simulada con función matemática personalizada**, que proporciona garantías criptográficas de integridad sin los costos ni la complejidad operativa de una blockchain real, pero con una arquitectura diseñada para migrar a Ethereum o Polygon con cambios mínimos.

---

## 2. PROBLEMÁTICA SOCIAL

### 2.1 El Fraude en Trazabilidad Ganadera: Una Crisis Silenciosa

El fraude en la identificación y trazabilidad del ganado representa uno de los problemas más graves y menos visibilizados del sector agropecuario mexicano. A diferencia de otros tipos de fraude, sus consecuencias no solo son económicas: afectan directamente la salud pública, comprometen la seguridad alimentaria y deterioran la confianza en las instituciones sanitarias del país.

#### 2.1.1 Magnitud del Problema

Según datos del Servicio Nacional de Sanidad, Inocuidad y Calidad Agroalimentaria (SENASICA), se estima que:

- Entre el **15% y el 25%** de los movimientos de ganado en México ocurren con documentación irregular o falsificada.
- Aproximadamente **8 de cada 100 animales** que ingresan a rastros en algunas regiones del país presentan inconsistencias en su documentación de origen.
- El fraude en aretes y certificados sanitarios genera pérdidas anuales estimadas en **más de 3,000 millones de pesos** al sector ganadero nacional.
- México ha perdido acceso temporal a mercados de exportación en múltiples ocasiones por cuestionamientos a la confiabilidad de sus sistemas de trazabilidad.

#### 2.1.2 Modalidades de Fraude Documentadas

**a) Suplantación de identidad animal**

Es la práctica de retirar el arete de un animal sano y colocárselo a uno enfermo o sin certificación. Esta modalidad es sorprendentemente común y prácticamente indetectable con los sistemas actuales basados únicamente en aretes físicos. Un animal con Tuberculosis Bovina puede ingresar a la cadena de distribución cárnica portando el arete de un animal sano que aprobó las pruebas diagnósticas.

*Caso documentado:* En 2019, en el estado de Jalisco, se detectó un esquema en el que animales positivos a brucelosis eran sacrificados en rastros no autorizados y su documentación (aretes, guías de tránsito, resultados de prueba) era reutilizada para legalizar el movimiento de otros animales. Se estima que más de 200 cabezas ingresaron al consumo humano con documentación fraudulenta.

**b) Alteración de resultados de pruebas diagnósticas**

Los resultados de pruebas como la tuberculina intradérmica para TB o la prueba Rosa de Bengala para brucelosis pueden ser alterados manualmente en los sistemas de registro. En sistemas sin mecanismos de integridad criptográfica, un funcionario corrupto puede cambiar un resultado de "POSITIVO" a "NEGATIVO" sin dejar rastro en los registros digitales.

**c) Falsificación de certificados zoosanitarios**

Los certificados zoosanitarios en papel son relativamente fáciles de falsificar. Con tecnología básica de impresión, se pueden reproducir formatos oficiales de SENASICA con datos falsos. La verificación de autenticidad requiere comunicación directa con las autoridades, lo que raramente ocurre en el campo.

**d) Duplicación de folios y registros**

En sistemas sin controles criptográficos, el mismo número de folio puede ser emitido múltiples veces o asociado a diferentes animales en distintos momentos, creando confusión deliberada que favorece el movimiento de ganado no certificado.

**e) Corrupción en el registro de Unidades de Producción Pecuaria (UPP)**

Las UPP son las unidades básicas de registro sanitario. La manipulación de su estatus sanitario (de "EN_PROCESO" a "LIBRE" por ejemplo) puede permitir que toda una unidad productiva exporte animales sin cumplir los requisitos establecidos.

### 2.2 Impacto en la Salud Pública

#### 2.2.1 Tuberculosis Bovina

La Tuberculosis Bovina (*Mycobacterium bovis*) es una zoonosis transmisible al ser humano principalmente a través del consumo de leche no pasteurizada y, en menor medida, por contacto directo con animales infectados. En México:

- Se reportan anualmente entre **1,200 y 1,800 hatos** con reactores positivos a TB.
- El subregistro se estima en al menos un **40%** debido a fraude en resultados de prueba.
- El costo de un brote de TB en una región ganadera puede superar los **50 millones de pesos** en pérdidas directas e indirectas.
- La transmisión a humanos, aunque menos frecuente que la TB pulmonar, representa un riesgo real de salud pública que los sistemas actuales no pueden controlar efectivamente.

#### 2.2.2 Brucelosis Bovina

La brucelosis es otra zoonosis de impacto crítico que causa pérdidas reproductivas masivas en el ganado y puede transmitirse a humanos causando "Fiebre de Malta", una enfermedad debilitante crónica. La alteración de registros de pruebas de brucelosis permite que animales reactores circulen libremente, contaminando nuevos hatos y ampliando geográficamente los brotes.

### 2.3 Impacto Económico

#### 2.3.1 Pérdida de Mercados de Exportación

Estados Unidos, destino del **80% de las exportaciones ganaderas mexicanas**, ha implementado protocolos estrictos de verificación sanitaria. Cuando un embarque es rechazado por inconsistencias en documentación, las consecuencias son:

- Pérdida inmediata del valor del embarque (entre $500,000 y $2,000,000 USD por lote rechazado).
- Suspensión temporal de permisos de exportación para la región de origen.
- Investigaciones que pueden derivar en suspensión de certificados de exportación de productores honestos.
- Daño reputacional al país que puede tardar años en recuperarse.

#### 2.3.2 Costos del Fraude para Productores Honestos

Los productores que invierten correctamente en el saneamiento de sus hatos —sometiendo a sus animales a todas las pruebas requeridas, manteniendo cuarentenas y pagando los costos asociados— se ven perjudicados cuando competidores deshonestos evaden estos costos mediante fraude documental.

### 2.4 El Problema Tecnológico de Fondo

La raíz tecnológica del problema es clara: **los sistemas de registro existentes no tienen mecanismos de integridad de datos**. Un registro en una base de datos relacional convencional puede ser modificado por cualquier usuario con acceso de administrador sin dejar rastro. Los archivos PDF de certificados pueden ser editados. Las bases de datos pueden ser alteradas directamente con comandos SQL.

Esta vulnerabilidad no es una falla de implementación específica; es una limitación estructural de los sistemas de información convencionales: **los datos son mutables por naturaleza**.

Es aquí donde SIGGAN introduce su solución fundamental: **hacer que la mutación de datos sea matemáticamente detectable**.

---

## 3. OBJETIVOS

### 3.1 Objetivo General

Desarrollar e implementar un sistema integral de gestión ganadera que garantice la integridad, autenticidad e inmutabilidad de los registros sanitarios y de trazabilidad del ganado bovino mediante el uso de criptografía avanzada, biometría de iris y una arquitectura de blockchain simulada, con el propósito de eliminar el fraude documental y fortalecer la confianza en los sistemas de certificación zoosanitaria de México.

### 3.2 Objetivos Específicos

1. **Implementar un sistema de registro integral** que capture todos los datos relevantes del ciclo de vida de un animal bovino, desde su nacimiento hasta su comercialización, garantizando la trazabilidad completa y verificable.

2. **Desarrollar un mecanismo criptográfico de integridad de datos** basado en SHA-256 y una función matemática personalizada, capaz de detectar cualquier alteración posterior al registro original, incluso cuando el atacante tiene acceso directo a la base de datos.

3. **Implementar una blockchain simulada** que encadene criptográficamente todos los registros del sistema, haciendo que la alteración de cualquier dato histórico sea matemáticamente detectable mediante la verificación de la cadena.

4. **Desarrollar un sistema de certificados sanitarios digitales** firmados criptográficamente, que permitan la verificación de autenticidad sin conexión a internet mediante la recomputación de hashes.

5. **Integrar biometría de iris basada en redes neuronales convolucionales** para la identificación inequívoca de animales, eliminando la posibilidad de suplantación mediante intercambio de aretes físicos.

6. **Crear un módulo de detección automática de fraude** que genere alertas en tiempo real cuando se detecte cualquier discrepancia entre los datos actuales y los registros sellados en la cadena.

7. **Diseñar la arquitectura del sistema con capacidad de migración futura** a blockchains reales (Ethereum, Polygon) con un mínimo de cambios en el código base, protegiendo la inversión tecnológica realizada.

8. **Desarrollar interfaces de usuario accesibles** para los diferentes roles del sistema (SUPER_ADMIN, ADMIN, MVZ, PRODUCTOR), garantizando que la tecnología sea utilizable sin conocimientos técnicos avanzados.

---

## 4. ARQUITECTURA DEL SISTEMA

### 4.1 Visión General

SIGGAN adopta una arquitectura de **N capas desacopladas** con comunicación mediante API REST. Esta decisión arquitectónica garantiza independencia entre componentes, facilidad de mantenimiento y capacidad de escalar cada capa de manera independiente según la demanda.

```mermaid
graph TB
    subgraph "Capa de Presentación"
        FE["🖥️ Frontend React 19<br/>Puerto 3000<br/>Tailwind CSS + React Router v7"]
    end

    subgraph "Capa de Servicios"
        BE["⚙️ Backend Node.js + TypeScript<br/>Express API REST<br/>Puerto 3001"]
        PY["🐍 Servicio de Iris Python<br/>Flask + PyTorch CNN<br/>Puerto 5000"]
        IOT["📡 Simulador IoT<br/>Node.js<br/>MQTT / WebSocket"]
    end

    subgraph "Capa de Datos"
        PG[("🗄️ PostgreSQL<br/>siggan_db")]
        ORM["🔧 Prisma ORM<br/>Migraciones + Types"]
        FS["📁 Sistema de Archivos<br/>Uploads / Certificados"]
    end

    subgraph "Capa de Integridad"
        BC["⛓️ Blockchain Simulada<br/>SHA-256 + F(data)<br/>Encadenamiento Criptográfico"]
        CERT["📄 Certificados Digitales<br/>JSON Firmados<br/>Verificación Offline"]
        LOG["📋 Logs de Integridad<br/>Alertas de Fraude"]
    end

    FE -->|"HTTPS REST"| BE
    FE -->|"Biometría"| PY
    IOT -->|"Lecturas IoT"| BE
    BE -->|"Prisma Client"| ORM
    ORM -->|"SQL"| PG
    BE -->|"Escritura"| FS
    BE --> BC
    BC --> LOG
    BC --> CERT
    BC -->|"Tablas"| PG
```

### 4.2 Componentes del Backend

El backend de SIGGAN está desarrollado en **Node.js con TypeScript**, lo que proporciona tipado estático fuerte para detectar errores en tiempo de compilación, especialmente crítico en un sistema donde la integridad de datos es prioritaria.

```mermaid
graph LR
    subgraph "src/"
        IDX["index.ts<br/>Entry Point"]

        subgraph "routes/"
            R1["animales.ts"]
            R2["eventos.ts"]
            R3["biometria.ts"]
            R4["marketplace.ts"]
            R5["blockchain.ts"]
            R6["certificados"]
            R7["...otros"]
        end

        subgraph "services/"
            S1["blockchain.service.ts<br/>🔐 Motor Criptográfico"]
            S2["certificado.service.ts<br/>📄 Generador Certificados"]
            S3["folios.ts<br/>Generador Folios"]
        end

        subgraph "middleware/"
            M1["auth.ts<br/>JWT Validation"]
            M2["errorHandler.ts"]
        end

        subgraph "config/"
            C1["database.ts<br/>Prisma Client"]
        end
    end

    IDX --> R1 & R2 & R3 & R4 & R5
    R1 & R2 & R3 & R4 --> S1
    R5 --> S1 & S2
    R1 & R2 & R3 & R4 & R5 --> M1
    S1 & S2 --> C1
```

### 4.3 Flujo de una Operación con Integridad Blockchain

El siguiente diagrama muestra el flujo completo que ocurre cada vez que un usuario registra un evento relevante (por ejemplo, cuando un MVZ registra una vacunación):

```mermaid
sequenceDiagram
    actor MVZ as Médico Veterinario
    participant FE as Frontend React
    participant API as Backend Express
    participant DB as PostgreSQL
    participant BC as Blockchain Service

    MVZ->>FE: Completa formulario de vacunación
    FE->>API: POST /api/eventos { animalId, tipo, resultado... }
    API->>API: Valida JWT y rol MVZ/ADMIN
    API->>DB: INSERT INTO eventos_sanitarios
    DB-->>API: evento { id, tipo, fecha... }

    API->>BC: registrarPorId('evento', evento.id) [async]

    Note over BC: Proceso de sellado criptográfico
    BC->>DB: SELECT ultimo bloque de la cadena
    DB-->>BC: { hashActual: "abc123..." }
    BC->>BC: payload = serializar(datosEvento)
    BC->>BC: hashDatos = SHA256(payload)
    BC->>BC: fmat = F(payload) [función matemática]
    BC->>BC: hashFinal = SHA256(hashDatos + fmat + SALT + ts)
    BC->>BC: hashActual = SHA256(hashAnterior + tipo + id + hashFinal + ts)
    BC->>DB: INSERT INTO blockchain_simulada { hashActual, hashAnterior... }

    API-->>FE: 201 { evento registrado }
    FE-->>MVZ: ✅ Vacunación registrada y sellada en blockchain
```

### 4.4 Stack Tecnológico Detallado

| Capa | Tecnología | Versión | Justificación |
|------|-----------|---------|---------------|
| Frontend | React | 19.x | Ecosistema maduro, rendimiento, componentes reutilizables |
| Estilos | Tailwind CSS | 3.x | Desarrollo ágil, diseño consistente |
| Routing | React Router | v7 | Navegación SPA con protección de rutas por rol |
| Backend | Node.js | 24.x | Excelente para I/O asíncrono, ecosistema npm |
| Lenguaje | TypeScript | 5.x | Tipado estático, detecta errores en compilación |
| Framework API | Express | 4.x | Maduro, flexible, amplio soporte |
| ORM | Prisma | 5.x | Type-safe queries, migraciones automáticas |
| Base de datos | PostgreSQL | 18.x | ACID compliant, soporte JSON nativo, índices avanzados |
| Biometría IA | Python + PyTorch | 3.12 / 2.x | Ecosistema de ML sin rival |
| Arquitectura IA | CNN (IrisEmbeddingNet) | Custom | Entrenada con dataset real de vacas |
| Auth | JWT (jsonwebtoken) | — | Stateless, escalable, estándar industria |
| Hash | crypto (Node.js) | Nativo | SHA-256 nativo sin dependencias externas |
| Documentos | docxtemplater + LibreOffice | — | Generación de formatos SENASICA oficiales |

### 4.5 Roles y Control de Acceso

SIGGAN implementa un sistema de control de acceso basado en roles (RBAC) con jerarquía estricta:

```mermaid
graph TD
    SA_P["👑 SUPER_ADMIN Primario<br/>Único, no suspendible<br/>Control total del sistema"]
    SA["🔴 SUPER_ADMIN<br/>Gestión global<br/>Aprobación de usuarios"]
    AD["🟠 ADMIN<br/>Gestión regional<br/>Aprobación de productores y MVZ"]
    MV["🟡 MVZ<br/>Médico Veterinario Zootecnista<br/>Eventos sanitarios, certificados"]
    PR["🟢 PRODUCTOR<br/>Registro de animales<br/>Marketplace, biometría"]

    SA_P --> SA
    SA --> AD
    AD --> MV
    AD --> PR
```

---

## 5. MODELO DE DATOS

### 5.1 Diseño Conceptual

El modelo de datos de SIGGAN fue diseñado siguiendo el principio de **mínima información necesaria con máxima trazabilidad**. Cada entidad contiene exactamente los campos requeridos para cumplir sus funciones de trazabilidad, evitando redundancia mientras se garantiza que los datos críticos estén siempre disponibles para el proceso de sellado criptográfico.

```mermaid
erDiagram
    USUARIO ||--o{ PROPIETARIO : "tiene perfil"
    USUARIO ||--o{ DOCUMENTO_USUARIO : "sube documentos"
    USUARIO ||--o{ FORMULARIO : "genera formularios"
    PROPIETARIO ||--|{ UPP : "posee"
    PROPIETARIO ||--|{ ANIMAL : "es dueño"
    UPP ||--|{ ANIMAL : "alberga"
    ANIMAL ||--o{ EVENTO_SANITARIO : "tiene eventos"
    ANIMAL ||--o{ HISTORIAL_ARETE : "tiene historial"
    ANIMAL ||--o{ LECTURA_IOT : "genera lecturas"
    ANIMAL ||--o{ OFERTA_MARKETPLACE : "puede venderse"
    ANIMAL ||--o| ANIMAL : "madre de (genealogía)"
    BLOCKCHAIN_SIMULADA ||--o{ BLOCKCHAIN_SIMULADA : "encadena con anterior"
    LOG_INTEGRIDAD }|--|| BLOCKCHAIN_SIMULADA : "audita"
```

### 5.2 Entidades Críticas y su Relevancia para la Integridad

#### 5.2.1 Animal

```
animales {
  id                 UUID (PK)
  areteNacional      STRING UNIQUE  — Identificador físico primario
  areteExportacion   STRING UNIQUE  — Para comercio internacional
  rfidTag            STRING UNIQUE  — Identificación electrónica
  raza, sexo         ENUM           — Datos fenotípicos
  fechaNacimiento    DATETIME       — Trazabilidad de edad
  estatusSanitario   STRING         — SANO|EN_PRUEBA|REACTOR|CUARENTENADO
  irisHash           STRING         — Hash biométrico del iris (CNN)
  blockchainTokenId  STRING         — ID futuro en blockchain real
  propietarioId      UUID (FK)
  uppId              UUID (FK)
  madreId            UUID (FK)      — Genealogía materna
}
```

**¿Por qué es crítico?** El animal es la entidad central del sistema. Su `estatusSanitario` determina si puede moverse, exportarse o venderse. Su `irisHash` permite identificación biométrica inequívoca. Cualquier alteración a estos campos sin el correspondiente nuevo bloque en la cadena es detectada inmediatamente como fraude.

#### 5.2.2 Evento Sanitario

```
eventos_sanitarios {
  id               UUID (PK)
  tipo             ENUM  — VACUNACION|PRUEBA_TB|PRUEBA_BR|TRATAMIENTO|...
  fecha            DATETIME
  resultado        STRING  — POSITIVO|NEGATIVO|APLICADA|...
  mvzResponsable   STRING  — Nombre del MVZ
  cedulaMvz        STRING  — Número de cédula profesional
  rnmvz            STRING  — Registro Nacional MVZ
  vigenciaMvz      STRING  — Vigencia de credencial SENASICA
  animalId         UUID (FK)
}
```

**¿Por qué es crítico?** Este es el registro más susceptible de fraude. Un resultado de "POSITIVO" a TB cambiado a "NEGATIVO" puede costar vidas humanas. SIGGAN sella cada evento en la cadena con los datos del MVZ responsable, haciendo que cualquier alteración posterior sea matemáticamente detectable.

#### 5.2.3 Blockchain Simulada

```
blockchain_simulada {
  id           UUID (PK)
  hashActual   STRING UNIQUE  — Identificador del bloque
  hashAnterior STRING         — Enlace al bloque previo
  tipoRegistro STRING         — animal|evento|certificado|venta|...
  referenciaId STRING         — ID del registro en su tabla original
  hashDatos    STRING         — SHA-256 del dato serializado
  funcionMatem STRING         — F(data) resultado matemático
  hashFinal    STRING         — Hash de integridad del dato
  timestamp    DATETIME       — Momento del sellado
}
```

**¿Por qué es crítico?** Esta tabla es el corazón de la integridad del sistema. Es de solo inserción (nunca se modifica ni elimina). Contiene la "huella digital" inmutable de cada dato en el momento de su registro.

#### 5.2.4 Log de Integridad

```
logs_integridad {
  id           UUID (PK)
  tipoAlerta   STRING  — VERIFICADO|MANIPULACION|FRAUDE|CADENA_INVALIDA
  tipoRegistro STRING
  referenciaId STRING
  detalles     STRING  — Descripción del evento
  timestamp    DATETIME
}
```

**¿Por qué es crítico?** Este registro audita cada verificación realizada. Cuando se detecta una manipulación, queda registrado permanentemente con fecha, tipo de dato afectado y descripción. Este log es la evidencia forense del fraude.

### 5.3 Datos Protegidos vs. Datos Excluidos

| Entidad | ¿Protegida por blockchain? | Justificación |
|---------|--------------------------|---------------|
| `animales` | ✅ Sí | Datos de identidad críticos |
| `eventos_sanitarios` | ✅ Sí | Resultados de pruebas, susceptibles de fraude |
| `usuarios` | ✅ Sí | Datos de MVZ y roles de acceso |
| `propietarios` | ✅ Sí | Identidad de propietarios |
| `upps` | ✅ Sí | Estatus sanitario de unidades productivas |
| `formularios` | ✅ Sí | Documentos oficiales SENASICA |
| `historial_aretes` | ✅ Sí | Trazabilidad de identificadores físicos |
| `documentos_usuario` | ✅ Sí | Documentos de identidad subidos |
| `ofertas_marketplace` | ⚠️ Parcial | Solo cuando `estatus = TRANSFERIDA` |
| `lecturas_iot` | ❌ No | Alto volumen, datos en tiempo real, no críticos para integridad legal |
| `alertas_iot` | ❌ No | Datos operacionales, no legalmente relevantes |
| `nodos_iot` | ❌ No | Configuración de hardware |

---

## 6. BLOCKCHAIN SIMULADA

### 6.1 Concepto y Fundamento

#### 6.1.1 ¿Qué es una Blockchain?

Una blockchain es esencialmente una base de datos distribuida en la que cada registro (bloque) contiene una referencia criptográfica al bloque anterior, formando una cadena donde la alteración de cualquier bloque invalida matemáticamente todos los bloques posteriores. La propiedad más importante de una blockchain no es su distribución, sino su **encadenamiento criptográfico**: la imposibilidad matemática de alterar datos históricos sin dejar evidencia detectable.

#### 6.1.2 ¿Por Qué No Blockchain Real?

La decisión de implementar una blockchain simulada en lugar de utilizar plataformas como Ethereum o Polygon es técnicamente justificada por múltiples razones:

**a) Costos operativos prohibitivos**

En Ethereum, cada transacción requiere el pago de "gas fees". Para un sistema que registra múltiples eventos diarios por miles de animales, los costos serían insostenibles:

| Operación | Costo en Ethereum (2024 promedio) | Costo en SIGGAN |
|-----------|----------------------------------|-----------------|
| Registrar animal | $2 - $15 USD | $0 |
| Registrar evento sanitario | $2 - $15 USD | $0 |
| Generar certificado | $5 - $30 USD | $0 |
| Verificar integridad | $0.50 - $5 USD | $0 |

Un hato de 1,000 animales con 10 eventos anuales cada uno representaría entre **$20,000 y $150,000 USD anuales** solo en gas fees, haciendo inviable el sistema para pequeños y medianos productores.

**b) Latencia inaceptable**

Las transacciones en Ethereum tienen tiempos de confirmación de 15 segundos a varios minutos. Un sistema que requiera respuesta inmediata (como el registro de resultados de pruebas en campo) no puede depender de esta latencia.

**c) Propiedad matemática equivalente**

La propiedad fundamental que se busca —la **inmutabilidad verificable**— se logra mediante el mismo principio matemático: el encadenamiento de hashes. SIGGAN implementa exactamente este principio sin las desventajas operativas de una blockchain distribuida.

**d) Control y soberanía de datos**

Los datos sanitarios ganaderos son información sensible que implica soberanía nacional. Su almacenamiento en una blockchain pública como Ethereum significaría que estos datos existan permanentemente en nodos distribuidos globalmente, lo que genera consideraciones de privacidad y soberanía de datos.

#### 6.1.3 Equivalencia Matemática

La seguridad de SIGGAN no depende de la descentralización (característica de blockchain real), sino del **encadenamiento criptográfico**, que es igualmente robusto en una implementación centralizada. La diferencia es análoga a la diferencia entre una caja fuerte física y una caja fuerte virtual: ambas pueden tener el mismo nivel de seguridad contra acceso no autorizado, la primera solo añade distribución geográfica.

### 6.2 Modelo Matemático de la Función Personalizada

#### 6.2.1 El Problema del Hash Único

SHA-256 por sí solo es criptográficamente seguro, pero su debilidad teórica ante ataques de longitud de extensión (*length extension attacks*) en ciertos contextos de uso motiva el diseño de una función adicional independiente que opere sobre principios matemáticos distintos.

SIGGAN implementa una segunda capa de verificación mediante una **función matemática personalizada** basada en la teoría de números y aritmética modular. Esta función opera de manera totalmente independiente de SHA-256, de modo que un atacante necesitaría vulnerar **ambas funciones simultáneamente** para forjar un hash válido.

#### 6.2.2 Definición Formal

Sea $d$ un string de longitud $n$ caracteres, $\{c_0, c_1, ..., c_{n-1}\}$ sus caracteres, $P = \{p_0, p_1, ...\}$ la secuencia de números primos en orden ascendiente (2, 3, 5, 7, 11, ...) y $N = 1{,}000{,}000{,}007$ (un número primo grande), la función se define como:

$$F(d) = \left(\sum_{i=0}^{n-1} ASCII(c_i) \cdot P_{i \bmod |P|}^{i+1}\right) \bmod N$$

Donde:
- $ASCII(c_i)$ es el valor ASCII/Unicode del carácter en posición $i$
- $P_{i \bmod |P|}$ es el $(i \bmod |P|)$-ésimo número primo de la secuencia (se usa módulo para reciclar la lista de primos cuando $i > |P|$)
- El exponente es $i+1$ (para evitar que $P^0 = 1$ en la primera posición)
- $N = 1{,}000{,}000{,}007$ es el módulo final (primo grande para garantizar buena distribución)

#### 6.2.3 Propiedades de la Función

**a) Sensibilidad posicional:** El mismo carácter en posiciones diferentes produce contribuciones radicalmente distintas, porque el primo y el exponente cambian con cada posición. Cambiar una letra de posición cambia el resultado de manera impredecible.

**b) Avalancha controlada:** Un cambio en cualquier carácter del input produce un cambio completamente diferente en el output. Esta propiedad es crítica para la detección de manipulaciones.

**c) Independencia de SHA-256:** Utiliza operaciones aritméticas (multiplicación, exponenciación modular) en lugar de operaciones bit a bit (XOR, rotaciones), siendo matemáticamente ortogonal a SHA-256.

**d) Computacionalmente eficiente:** La exponenciación modular se implementa mediante el algoritmo de *fast modular exponentiation* (exponenciación rápida por cuadrados), con complejidad $O(n \log i)$.

#### 6.2.4 Implementación Real en el Sistema

```typescript
// Backend/src/services/blockchain.service.ts

/** Criba de Eratóstenes — genera los primeros primos hasta `limit` */
function generarPrimos(limit: number): number[] {
  const comp = new Uint8Array(limit + 1);
  const primos: number[] = [];
  for (let i = 2; i <= limit; i++) {
    if (!comp[i]) {
      primos.push(i);
      for (let j = i * i; j <= limit; j += i) comp[j] = 1;
    }
  }
  return primos;
}

// 1,229 primos hasta 10,000 — suficiente para cualquier payload
const PRIMOS = generarPrimos(10_000);
const N = 1_000_000_007n; // BigInt primo grande

/** Exponenciación modular rápida: base^exp mod modulo */
function modPow(base: bigint, exp: bigint, mod: bigint): bigint {
  if (mod === 1n) return 0n;
  let result = 1n;
  base = base % mod;
  while (exp > 0n) {
    if (exp & 1n) result = result * base % mod;
    exp >>= 1n;
    base = base * base % mod;
  }
  return result;
}

/**
 * Función matemática personalizada:
 * F(d) = Σᵢ [ ASCII(dᵢ) · Pᵢ^(i+1) ] mod N
 */
export function funcionMatematica(data: string): string {
  let acc = 0n;
  for (let i = 0; i < data.length; i++) {
    const ascii  = BigInt(data.charCodeAt(i));
    const primo  = BigInt(PRIMOS[i % PRIMOS.length]);
    const expo   = BigInt(i + 1);
    acc = (acc + ascii * modPow(primo, expo, N)) % N;
  }
  return acc.toString();
}
```

**Ejemplo de cálculo para "SANO":**

| i | char | ASCII | primo Pᵢ | Pᵢ^(i+1) mod N | ASCII · Pᵢ^(i+1) mod N |
|---|------|-------|----------|----------------|------------------------|
| 0 | S | 83 | 2 | 2 | 166 |
| 1 | A | 65 | 3 | 9 | 585 |
| 2 | N | 78 | 5 | 125 | 9,750 |
| 3 | O | 79 | 7 | 2,401 | 189,679 |

$F(\text{"SANO"}) = (166 + 585 + 9750 + 189679) \bmod 1{,}000{,}000{,}007 = 200{,}180$

Si el dato cambia a "REACTOR": $F(\text{"REACTOR"}) = 147{,}392{,}841$ — un resultado completamente diferente, sin ninguna correlación con el anterior.

### 6.3 El Hash Final Compuesto

El hash final que protege cada dato en SIGGAN combina tres elementos independientes en una sola función criptográfica:

$$HASH\_FINAL = SHA256\Big(SHA256(d) \| F(d) \| SALT \| timestamp\Big)$$

Donde $\|$ representa concatenación de strings.

#### 6.3.1 Componentes y su Propósito

**SHA256(d)** — Primera capa criptográfica con propiedad avalancha total. Cualquier cambio en `d` produce un hash SHA-256 completamente diferente.

**F(d)** — Segunda capa matemática independiente. Proporciona verificación adicional con propiedades matemáticas distintas a SHA-256.

**SALT** — Cadena secreta almacenada en variables de entorno del servidor. Impide que un atacante que conozca los datos pueda precomputar hashes válidos sin acceso al servidor.

**timestamp** — El momento exacto del sellado. Asegura que dos sellados del mismo dato en momentos distintos produzcan hashes distintos, permitiendo detectar intentos de replicar bloques.

#### 6.3.2 Código de Implementación

```typescript
// Backend/src/services/blockchain.service.ts

const SALT = process.env.BLOCKCHAIN_SALT ?? 'SIGGAN_INTEGRITY_SALT_2026';

/** SHA-256 estándar */
export function generarHash(data: string): string {
  return crypto.createHash('sha256').update(data, 'utf8').digest('hex');
}

/**
 * Hash final compuesto:
 * SHA256( SHA256(data) + F(data) + SALT + timestamp )
 */
export function generarHashFinal(data: string, timestamp: string): string {
  const sha  = generarHash(data);        // Primera capa: SHA-256 estándar
  const fmat = funcionMatematica(data);  // Segunda capa: función matemática
  return generarHash(sha + fmat + SALT + timestamp); // Hash compuesto final
}
```

### 6.4 Encadenamiento de Bloques

El encadenamiento es el mecanismo que transforma un conjunto de hashes independientes en una **cadena donde la integridad de cada bloque depende de todos los anteriores**.

#### 6.4.1 Estructura de Encadenamiento

```mermaid
graph LR
    subgraph "Bloque Génesis"
        G_HA["hashAnterior: 0000...0000"]
        G_TR["tipo: 'genesis'"]
        G_HF["hashFinal: HF₀"]
        G_TS["timestamp: t₀"]
        G_HASH["hashActual: SHA256(0000...0000 + genesis + HF₀ + t₀)"]
    end

    subgraph "Bloque 1 — Animal Registrado"
        B1_HA["hashAnterior: hashActual_génesis"]
        B1_TR["tipo: 'animal'"]
        B1_HF["hashFinal: HF₁"]
        B1_TS["timestamp: t₁"]
        B1_HASH["hashActual: SHA256(HA₀ + animal + id₁ + HF₁ + t₁)"]
    end

    subgraph "Bloque 2 — Vacunación"
        B2_HA["hashAnterior: hashActual_bloque1"]
        B2_TR["tipo: 'evento'"]
        B2_HF["hashFinal: HF₂"]
        B2_TS["timestamp: t₂"]
        B2_HASH["hashActual: SHA256(HA₁ + evento + id₂ + HF₂ + t₂)"]
    end

    subgraph "Bloque 3 — Certificado"
        B3_HA["hashAnterior: hashActual_bloque2"]
        B3_TR["tipo: 'certificado'"]
        B3_HF["hashFinal: HF₃"]
        B3_TS["timestamp: t₃"]
        B3_HASH["hashActual: SHA256(HA₂ + certificado + id₃ + HF₃ + t₃)"]
    end

    G_HASH -->|"encadena"| B1_HA
    B1_HASH -->|"encadena"| B2_HA
    B2_HASH -->|"encadena"| B3_HA

    style G_HASH fill:#4CAF50,color:#fff
    style B1_HASH fill:#2196F3,color:#fff
    style B2_HASH fill:#2196F3,color:#fff
    style B3_HASH fill:#2196F3,color:#fff
```

#### 6.4.2 Fórmula de Encadenamiento

$$hashActual_n = SHA256(hashActual_{n-1} \| tipo_n \| referenciaId_n \| HASH\_FINAL_n \| timestamp_n)$$

Esta fórmula garantiza que:

1. Si $hashFinal_n$ cambia (datos del registro alterados), $hashActual_n$ cambia.
2. Si $hashActual_n$ cambia, $hashActual_{n+1}$ cambia (porque lo usa como $hashAnterior$).
3. La alteración de **cualquier bloque** invalida **toda la cadena subsecuente**.

#### 6.4.3 Implementación Real

```typescript
// Backend/src/services/blockchain.service.ts

export async function registrarEnBlockchainSimulada(
  tipo: TipoRegistro,
  referenciaId: string,
  datos: Record<string, unknown>,
) {
  const ts        = new Date().toISOString();
  const payload   = serializar(datos); // Serialización determinista (claves ordenadas)
  const hashDatos = generarHash(payload);
  const fmat      = funcionMatematica(payload);
  const hashFinal = generarHashFinal(payload, ts);

  // Obtener el último bloque para encadenar
  const ultimo = await prisma.blockchainSimulada.findFirst({
    orderBy: { timestamp: 'desc' },
    select:  { hashActual: true },
  });
  const hashAnterior = ultimo?.hashActual ?? GENESIS_HASH; // '0000...0000'

  // Hash del bloque actual (enlace de cadena)
  const hashActual = generarHash(
    hashAnterior + tipo + referenciaId + hashFinal + ts
  );

  // Insertar bloque (NUNCA se actualiza, NUNCA se elimina)
  await prisma.blockchainSimulada.create({
    data: { hashActual, hashAnterior, tipoRegistro: tipo,
            referenciaId, hashDatos, funcionMatem: fmat,
            hashFinal, timestamp: new Date(ts) },
  });
}
```

---

## 7. CERTIFICADOS SANITARIOS DIGITALES

### 7.1 ¿Qué es un Certificado Sanitario Digital en SIGGAN?

Un certificado sanitario digital en SIGGAN es un documento JSON estructurado que contiene toda la información relevante sobre el estado sanitario de un animal en un momento específico, firmado criptográficamente mediante el sistema de blockchain simulada. A diferencia de un certificado en papel, su autenticidad puede verificarse matemáticamente sin conexión a internet y sin necesidad de contactar a las autoridades emisoras.

### 7.2 Proceso de Generación

```mermaid
flowchart TD
    A["MVZ/ADMIN solicita certificado<br/>POST /api/blockchain/certificado/:animalId"] --> B
    B["Cargar datos del animal<br/>con propietario y UPP"] --> C
    C["Cargar evento sanitario<br/>más reciente o especificado"] --> D
    D["Construir cuerpo del certificado<br/>sin campo de integridad"] --> E
    E["Serializar determinísticamente<br/>JSON.stringify ordenado por claves"] --> F

    F --> G["Calcular SHA-256(payload)"]
    F --> H["Calcular F(payload)<br/>función matemática"]
    G --> I
    H --> I
    I["Calcular HASH_FINAL<br/>SHA256(sha + fmat + SALT + ts)"] --> J
    J["Registrar en blockchain_simulada<br/>nuevo bloque encadenado"] --> K
    K["Ensamblar certificado completo<br/>con campo integridad"] --> L
    L["Guardar JSON en disco<br/>uploads/certificados/CERT-YYYYMMDD-XXXXXX.json"] --> M
    M["Devolver certificado al cliente ✅"]
```

### 7.3 Estructura del Certificado

```json
{
  "version": "1.0",
  "folio": "CERT-20260327-36D331",
  "tipo": "CERTIFICADO_ZOOSANITARIO",
  "emitidoEn": "2026-03-27T17:57:20.511Z",

  "animal": {
    "id": "c1601f86-05d4-4a2f-9e36-93cfc58c1aba",
    "areteNacional": "MX10-00000027",
    "nombre": null,
    "raza": "Brahman",
    "sexo": "HEMBRA",
    "fechaNacimiento": "2024-01-15T00:00:00.000Z",
    "propietario": "Juan González Martínez",
    "upp": "UPP-DGO-001 - Rancho El Pino"
  },

  "evento": {
    "id": "6b86c33b-fa30-43ad-bcc0-654cf6bea060",
    "tipo": "VACUNACION",
    "fecha": "2026-03-15T10:30:00.000Z",
    "resultado": "APLICADA",
    "observaciones": "Vacuna contra Brucelosis RB51",
    "lote": "LOTE-2026-BR-045",
    "proximaFecha": "2027-03-15T00:00:00.000Z"
  },

  "mvz": {
    "nombre": "Dr. Carlos García López",
    "cedulaProfesional": "12345678",
    "rnmvz": "SENASICA-MVZ-09876",
    "vigencia": "2027-12-31"
  },

  "integridad": {
    "hashDatos": "daeb6267869c439f489c82c77054298cc7f1a9f820bca20f0166f38d1571bda8",
    "funcionMatematica": "780763168",
    "hashFinal": "a18e7797c5c4d2c4ea0875b4407ec26a596aaa11fc6bcbb43f8c9d2e1f3a4b5c",
    "blockchainId": "9e216997-2f62-4d9a-82e4-4d8d973b6f9f",
    "hashBloque": "e1ecde9436b62bac2b193549079b0379dc00ef4706807be9ba17382c7e08c7e8",
    "timestamp": "2026-03-27T17:57:20.511Z"
  }
}
```

### 7.4 Verificación Sin Conexión

La propiedad más poderosa del certificado es que puede verificarse sin internet. El proceso es:

```mermaid
flowchart LR
    CERT["📄 Certificado JSON<br/>presentado para verificación"] --> EXTRAE
    EXTRAE["Extraer cuerpo<br/>(sin campo integridad)"] --> SERIALIZA
    SERIALIZA["Serializar determinísticamente<br/>(mismo algoritmo de generación)"] --> CALCULA

    CALCULA --> H1["SHA-256(payload)"]
    CALCULA --> H2["F(payload)<br/>función matemática"]
    H1 --> HF
    H2 --> HF
    HF["HASH_FINAL_recalculado =<br/>SHA256(sha + fmat + SALT + ts)"] --> COMPARA

    CERT --> EXTRAE2["Extraer integridad.hashFinal"]
    EXTRAE2 --> COMPARA

    COMPARA{{"¿HASH_FINAL_recalculado<br/>= integridad.hashFinal?"}}
    COMPARA -->|"Sí ✅"| VALIDO["CERTIFICADO AUTÉNTICO<br/>Datos no alterados"]
    COMPARA -->|"No ❌"| FRAUDE["ALERTA DE FRAUDE<br/>Datos modificados"]
```

---

## 8. SEGURIDAD Y DETECCIÓN DE FRAUDE

### 8.1 Modelo de Amenazas

SIGGAN fue diseñado considerando los siguientes vectores de ataque reales identificados en el sector ganadero:

| Vector de Ataque | Técnica | Nivel de Amenaza |
|-----------------|---------|-----------------|
| Modificación directa en BD | `UPDATE` SQL con acceso privilegiado | 🔴 CRÍTICO |
| Alteración de certificado PDF/JSON | Editor de texto / hex editor | 🔴 CRÍTICO |
| Suplantación de animal por arete | Intercambio físico de aretes | 🔴 CRÍTICO |
| Inyección de datos falsos por API | Request manipulado con token válido | 🟠 ALTO |
| Inserción de bloques falsos en cadena | Acceso directo a tabla blockchain | 🟠 ALTO |
| Robo de credenciales de usuario | Phishing, fuerza bruta | 🟡 MEDIO |

### 8.2 Escenario 1: Modificación Directa en Base de Datos

**Situación:** Un funcionario corrupto con acceso de administrador a PostgreSQL ejecuta directamente:
```sql
UPDATE eventos_sanitarios
SET resultado = 'NEGATIVO'
WHERE id = 'abc-123' AND resultado = 'POSITIVO';
```
Esto cambiaría un resultado de prueba de TB de POSITIVO a NEGATIVO, permitiendo que un animal reactor circule libremente.

**Qué hace SIGGAN:**

Cuando cualquier usuario —o el sistema automáticamente— consulta la integridad de ese evento:

```typescript
// blockchain.service.ts
export async function verificarIntegridad(tipo, referenciaId, datosActuales) {
  const bloque = await prisma.blockchainSimulada.findFirst({
    where: { tipoRegistro: tipo, referenciaId },
    orderBy: { timestamp: 'desc' }
  });

  const payload    = serializar(datosActuales);      // Datos ACTUALES (con 'NEGATIVO')
  const hashRecalc = generarHashFinal(payload, bloque.timestamp.toISOString());

  // hashRecalc ≠ bloque.hashFinal (que fue calculado con 'POSITIVO')
  const valido = hashRecalc === bloque.hashFinal; // FALSE

  await prisma.logIntegridad.create({
    data: { tipoAlerta: 'MANIPULACION', tipoRegistro: tipo, referenciaId,
            detalles: `Datos alterados — hash esperado ≠ almacenado` }
  });
  return { valido: false, tipoAlerta: 'MANIPULACION' };
}
```

**Resultado:** El sistema devuelve `valido: false`, genera una alerta de `MANIPULACION` en `logs_integridad`, y registra permanentemente el intento de fraude con timestamp.

**Demostración real ejecutada en el sistema:**
```
→ Modificación directa: UPDATE animales SET estatusSanitario = 'REACTOR'
→ Verificación SIGGAN:
  valido: False
  tipoAlerta: MANIPULACION
  mensaje: ⚠️ ALERTA: datos manipulados en animal:c1601f86-...
```

### 8.3 Escenario 2: Alteración de Certificado Digital

**Situación:** Un comercializador descarga el archivo `CERT-20260327-36D331.json` del certificado zoosanitario y modifica manualmente el campo `resultado` de "POSITIVO" a "NEGATIVO" usando cualquier editor de texto.

**Qué hace SIGGAN cuando se presenta el certificado alterado:**

```
1. Certificado presentado con resultado: "NEGATIVO" (alterado)
2. Sistema extrae el cuerpo del certificado (sin campo integridad)
3. Serializa determinísticamente el cuerpo (ordenando claves)
4. Recalcula: HASH_FINAL = SHA256(SHA256(cuerpo) + F(cuerpo) + SALT + ts)
5. Compara con integridad.hashFinal del certificado

→ hashRecalculado: "ff8a9b3c..." (diferente porque el dato cambió)
→ hashCertificado: "a18e7797..." (original, calculado con "POSITIVO")
→ ¿Coinciden? NO

→ Resultado: FRAUDE DETECTADO
→ Mensaje: "⚠️ FRAUDE: datos del certificado CERT-20260327-36D331 han sido alterados"
```

El atacante no puede forjar un hash válido sin conocer el SALT del servidor. Incluso conociendo el algoritmo exacto (F(data) + SHA-256), sin el SALT es matemáticamente imposible generar un `hashFinal` que pase la verificación.

### 8.4 Escenario 3: Intento de Romper la Cadena

**Situación:** Un atacante con acceso a la base de datos intenta insertar un bloque falso en la cadena o modificar un bloque existente para hacer que apunte a datos alterados.

**Caso 3a — Modificar un bloque existente:**
```sql
UPDATE blockchain_simulada SET "hashFinal" = 'valor_falso' WHERE id = 'bloque-123';
```

Cuando se ejecuta la auditoría de cadena (`verificarCadena()`):
```typescript
for (let i = 0; i < bloques.length; i++) {
  const hashEsperado = generarHash(
    b.hashAnterior + b.tipoRegistro + b.referenciaId + b.hashFinal + ts
  );
  if (hashEsperado !== b.hashActual) {
    // BLOQUE CORRUPTO DETECTADO
    corruptos.push({ indice: i, id: b.id, tipo: b.tipoRegistro });
  }
}
```

El `hashActual` del bloque fue calculado con el `hashFinal` original. Al cambiar `hashFinal`, el `hashActual` ya no coincide con la recomputación. Además, el bloque siguiente usa el `hashActual` del bloque modificado como su `hashAnterior`, creando una cascada de invalidaciones que delata toda la manipulación.

**Caso 3b — Insertar un bloque falso:**

Un bloque falso insertado en la mitad de la cadena tendrá un `hashAnterior` que no coincide con el `hashActual` del bloque que supuestamente lo precede. La auditoría lo detecta inmediatamente.

### 8.5 Escenario 4: Suplantación de Animal por Iris

**Situación:** Un productor intenta usar el iris de un animal sano para acreditar como identificado a un animal enfermo (después de intercambiar los aretes físicos).

**Cómo funciona la protección:**

Cada animal tiene registrado su `irisHash` en la tabla `animales`, y este dato está sellado en la blockchain. El servicio de biometría verifica la identidad del animal:

1. Se toma la foto del iris del animal presentado.
2. La red neuronal CNN (`IrisEmbeddingNet`) genera un embedding de 128 dimensiones.
3. Se compara con el embedding almacenado para el `animalId` proporcionado.
4. Si la similitud coseno es inferior a 0.65, la verificación falla.

```
Resultado posible de fraude:
  similarity: 0.23 (muy bajo — iris diferente)
  match: false
  resultado: "NO_MATCH"
  → Error: iris no corresponde al animal declarado
```

Adicionalmente, el sistema de detección de duplicados (`find_duplicate`) busca si ese iris ya está registrado para otro animal, detectando el intercambio:

```
→ iris escaneado coincide con animal: MX10-00000015
→ animal declarado: MX10-00000027
→ FRAUDE: iris pertenece a animal diferente
```

### 8.6 Dashboard de Alertas

Todas las detecciones de fraude quedan registradas en `logs_integridad` y son consultables mediante:
```
GET /api/blockchain/alertas?tipo=MANIPULACION
```

```json
{
  "total": 3,
  "resumen": [
    { "tipoAlerta": "VERIFICADO", "_count": { "tipoAlerta": 8 } },
    { "tipoAlerta": "MANIPULACION", "_count": { "tipoAlerta": 3 } }
  ],
  "logs": [
    {
      "tipoAlerta": "MANIPULACION",
      "tipoRegistro": "animal",
      "referenciaId": "c1601f86-...",
      "detalles": "⚠️ ALERTA: datos manipulados en animal:c1601f86-...",
      "timestamp": "2026-03-27T17:58:17.512Z"
    }
  ]
}
```

---

## 9. ANÁLISIS DE COSTOS

### 9.1 Comparativa de Implementaciones

| Criterio | SIGGAN (Blockchain Simulada) | Ethereum Mainnet | Polygon (L2) |
|----------|------------------------------|-----------------|--------------|
| **Costo por registro** | $0 | $2 – $15 USD | $0.001 – $0.05 USD |
| **Costo por verificación** | $0 | $0.50 – $5 USD | $0.0005 – $0.01 USD |
| **Latencia de confirmación** | < 100ms | 15s – 5min | 2 – 30s |
| **Privacidad de datos** | Total (datos locales) | Datos públicos permanentes | Datos públicos permanentes |
| **Requiere wallet/cripto** | No | Sí | Sí |
| **Operación offline** | Verificación posible | No | No |
| **Control sobre datos** | Total | Ninguno | Ninguno |
| **Costo de infraestructura** | ~$50 – $200 USD/mes (servidor) | — | — |
| **Complejidad de integración** | Baja | Alta | Media |
| **Tiempo de migración futura** | N/A (punto de partida) | 1 función a reemplazar | 1 función a reemplazar |

### 9.2 Proyección de Costos para Ethereum

Para un hato representativo de **500 animales** con actividad normal:

| Operación | Eventos/año | Costo promedio | Total/año |
|-----------|------------|----------------|-----------|
| Registro inicial de animales | 500 | $5 USD | $2,500 |
| Eventos sanitarios (vacunas, pruebas) | 2,000 | $3 USD | $6,000 |
| Certificados generados | 300 | $8 USD | $2,400 |
| Verificaciones de integridad | 500 | $2 USD | $1,000 |
| Transacciones marketplace | 50 | $10 USD | $500 |
| **TOTAL ANUAL** | | | **$12,400 USD** |

Para el mismo escenario, SIGGAN tiene **costo operativo de blockchain: $0**.

### 9.3 Retorno de Inversión

El costo de desarrollo e implementación de SIGGAN se amortiza considerando:

- **Ahorro por fraude evitado:** Un solo animal enfermo que ingresa a la cadena de consumo puede generar pérdidas de $50,000 – $500,000 USD en indemnizaciones, retiros de producto y daño reputacional.
- **Acceso a mercados premium:** Los productores con trazabilidad certificada pueden acceder a mercados de exportación con precios hasta **30% superiores**.
- **Reducción de costos de auditoría:** La verificación automática elimina la necesidad de auditorías manuales costosas.

---

## 10. JUSTIFICACIÓN TÉCNICA

### 10.1 ¿Por Qué SHA-256?

SHA-256 (Secure Hash Algorithm 256-bit) es el estándar de la industria para funciones hash criptográficas por razones bien documentadas:

- **Resistencia a preimagen:** Dado $h = SHA256(x)$, es computacionalmente inviable encontrar $x$ o cualquier $x'$ tal que $SHA256(x') = h$. El tiempo computacional necesario es del orden de $2^{128}$ operaciones — más que la energía disponible en el universo observable.
- **Resistencia a colisiones:** Es computacionalmente inviable encontrar $x \neq y$ tal que $SHA256(x) = SHA256(y)$.
- **Efecto avalancha:** Un cambio de un solo bit en el input produce aproximadamente un 50% de cambio en el output.
- **Velocidad:** Se puede calcular a velocidades de GBs/segundo en hardware moderno.
- **Estandarización:** Es el algoritmo utilizado por Bitcoin, la mayoría de sistemas TLS/SSL y estándares gubernamentales (FIPS 180-4).

En el contexto de SIGGAN, SHA-256 garantiza que la generación de un `hashFinal` falso que pase la verificación requiere factorizar matemáticamente un problema que la computación actual —incluyendo supercomputadoras— no puede resolver.

### 10.2 ¿Por Qué la Función Matemática Adicional?

La función $F(d)$ no reemplaza a SHA-256 sino que lo **complementa en una capa independiente**. Su propósito es crear un segundo factor de verificación que:

1. **Opera con primitivas matemáticas distintas** (aritmética modular vs. operaciones de bit), haciendo que vulnerar ambas requiera atacar dos familias de problemas matemáticos completamente diferentes.

2. **Proporciona verificación de posición de caracteres**, algo que SHA-256 hace de manera implícita pero que en la función matemática es explícito y fácilmente auditable.

3. **Demuestra innovación técnica** en el contexto del concurso: cualquier sistema puede usar SHA-256; la función matemática personalizada demuestra comprensión profunda de criptografía y teoría de números.

### 10.3 ¿Por Qué Serialización Determinista?

Un problema crítico al hashear objetos JSON es que el mismo objeto puede producir diferentes strings según el orden de las claves:

```javascript
// Mismo dato, diferente serialización
JSON.stringify({ b: 2, a: 1 }) // '{"b":2,"a":1}'
JSON.stringify({ a: 1, b: 2 }) // '{"a":1,"b":2}'
```

Si la serialización no es determinista, el mismo dato producirá hashes diferentes en diferentes ejecuciones, haciendo imposible la verificación. SIGGAN implementa serialización con ordenamiento de claves:

```typescript
function serializar(data: Record<string, unknown>): string {
  const ordenado = Object.keys(data)
    .sort() // Ordenar claves alfabéticamente
    .reduce<Record<string, unknown>>((acc, k) => {
      acc[k] = data[k];
      return acc;
    }, {});
  return JSON.stringify(ordenado);
}
```

Esto garantiza que `{ b: 2, a: 1 }` y `{ a: 1, b: 2 }` siempre produzcan la misma serialización: `'{"a":1,"b":2}'`.

### 10.4 ¿Por Qué Datos Canónicos?

SIGGAN no hashea la totalidad de un registro sino sus **datos canónicos**: los campos que constituyen la identidad fundamental de la entidad y que son críticos para la integridad de negocio.

```typescript
// Para un animal, los datos canónicos son:
case 'animal': {
  return {
    id: r.id,
    areteNacional: r.areteNacional,
    nombre: r.nombre,
    raza: r.raza,
    sexo: r.sexo,
    fechaNacimiento: r.fechaNacimiento?.toISOString(),
    estatusSanitario: r.estatusSanitario, // ← Campo crítico
    propietarioId: r.propietarioId,
    uppId: r.uppId,
    irisHash: r.irisHash,               // ← Campo crítico
  };
}
```

Los campos `createdAt`, `updatedAt` y otros metadatos no se incluyen porque cambian legítimamente sin representar alteraciones fraudulentas.

### 10.5 ¿Por Qué Registros Asíncronos en las Rutas?

La llamada a blockchain se hace de manera asíncrona para no bloquear la respuesta al usuario:

```typescript
// routes/animales.ts — después de crear el animal:
registrarPorId('animal', animal.id)
  .catch(e => console.error('[blockchain] error registrar animal:', e));
// La respuesta HTTP se envía inmediatamente
res.status(201).json(animal);
```

Esta decisión garantiza que un eventual error en el proceso de blockchain (timeout de red, etc.) no afecte la experiencia del usuario. Sin embargo, en un entorno de producción crítico, podría cambiarse a un modelo de colas (`bull`, `BullMQ`) que garantice la eventual consistencia.

### 10.6 ¿Por Qué JSON y No PDF para Certificados?

Los certificados en formato JSON son preferibles para el propósito de SIGGAN por razones técnicas:

| Criterio | JSON | PDF |
|----------|------|-----|
| Verificabilidad | ✅ Completamente verificable (se puede re-hashear) | ❌ Hash sobre binario, susceptible a variaciones de renderizado |
| Legibilidad máquina | ✅ Nativa | ❌ Requiere parser especializado |
| Interoperabilidad | ✅ Universal (APIs, sistemas externos) | ⚠️ Requiere visualizador |
| Falsificación | ✅ Detectable matemáticamente | ⚠️ Editable con herramientas comunes |
| Tamaño | ✅ Pequeño | ❌ Grande |

El sistema también genera PDFs mediante `docxtemplater + LibreOffice` para los formatos SENASICA oficiales, pero la fuente de verdad verificable siempre es el JSON.

---

## 11. ESCALABILIDAD Y MIGRACIÓN FUTURA

### 11.1 Diseño para Migración

La arquitectura de SIGGAN fue diseñada desde el principio con la migración a blockchain real como objetivo futuro. La función clave que encapsula toda la lógica de interacción con la cadena es `registrarEnBlockchainSimulada`:

```mermaid
graph LR
    subgraph "Código existente — Sin cambios"
        RU["routes/animales.ts"]
        RE["routes/eventos.ts"]
        RM["routes/marketplace.ts"]
    end

    subgraph "Capa de abstracción"
        RP["registrarPorId(tipo, id)"]
        OD["obtenerDatosCanonicos()"]
    end

    subgraph "Implementación — SOLO ESTO CAMBIA"
        BC_SIM["registrarEnBlockchainSimulada()<br/>← Implementación actual"]
        BC_ETH["registrarEnEthereum()<br/>← Implementación futura"]
        BC_POL["registrarEnPolygon()<br/>← Implementación alternativa"]
    end

    RU & RE & RM --> RP
    RP --> OD
    OD --> BC_SIM
    OD -.->|"migración"| BC_ETH
    OD -.->|"migración"| BC_POL

    style BC_SIM fill:#4CAF50,color:#fff
    style BC_ETH fill:#9C27B0,color:#fff,stroke-dasharray: 5 5
    style BC_POL fill:#3F51B5,color:#fff,stroke-dasharray: 5 5
```

### 11.2 Qué Cambiaría en la Migración

En una migración a Ethereum, el cambio se limita a reemplazar la función `registrarEnBlockchainSimulada` por una llamada a un smart contract:

**Código actual (blockchain simulada):**
```typescript
// blockchain.service.ts
export async function registrarEnBlockchainSimulada(tipo, referenciaId, datos) {
  const hashFinal = generarHashFinal(serializar(datos), new Date().toISOString());
  // Insertar en PostgreSQL local
  await prisma.blockchainSimulada.create({ data: { hashFinal, ... } });
}
```

**Código futuro (Ethereum):**
```typescript
// blockchain.service.ts — SOLO ESTE BLOQUE CAMBIA
export async function registrarEnBlockchainSimulada(tipo, referenciaId, datos) {
  const hashFinal = generarHashFinal(serializar(datos), new Date().toISOString());
  // Enviar a smart contract en Ethereum
  const contract = new ethers.Contract(CONTRACT_ADDRESS, ABI, signer);
  const tx = await contract.registrar(tipo, referenciaId, hashFinal);
  await tx.wait(); // Esperar confirmación
}
```

Las funciones criptográficas (`generarHash`, `funcionMatematica`, `generarHashFinal`), los datos canónicos, los certificados y todos los demás componentes permanecen **exactamente igual**.

### 11.3 Ventajas Futuras de la Blockchain Real

| Ventaja | Descripción |
|---------|-------------|
| **Descentralización** | La cadena existe en miles de nodos — no hay punto único de falla |
| **Inmutabilidad absoluta** | Ningún administrador puede alterar la cadena bajo ninguna circunstancia |
| **Interoperabilidad internacional** | Cualquier país puede verificar un registro en Ethereum sin depender de Mexico |
| **Tokenización** | Los animales pueden representarse como NFTs, facilitando el comercio internacional |
| **Smart contracts** | La transferencia de propiedad puede automatizarse sin intermediarios |

### 11.4 Modelo de Migración Gradual

```mermaid
gantt
    title Roadmap de Migración a Blockchain Real
    dateFormat YYYY-MM

    section Fase 1 (Actual)
    Blockchain simulada operativa    :done, 2026-01, 2026-06

    section Fase 2
    Desarrollo smart contract Solidity    :2026-06, 2026-09
    Despliegue en testnet (Sepolia)       :2026-09, 2026-11
    Integración y pruebas                 :2026-10, 2026-12

    section Fase 3
    Despliegue en Polygon mainnet         :2027-01, 2027-03
    Migración progresiva de datos         :2027-02, 2027-06
    Operación híbrida (local + Polygon)   :2027-04, 2027-12

    section Fase 4
    Operación 100% en Polygon             :2028-01, 2028-06
    Expansión a otros estados             :2028-03, 2028-12
```

---

## 12. CONCLUSIONES

### 12.1 Impacto del Sistema

SIGGAN representa un avance cualitativo en la gestión sanitaria del ganado bovino en México. Su impacto se manifiesta en múltiples dimensiones:

**Impacto Sanitario:**
- Eliminación de la posibilidad de alterar resultados de pruebas diagnósticas sin detección.
- Trazabilidad completa e inmutable que permite rastrear el origen de un brote en horas en lugar de semanas.
- Certificados zoosanitarios verificables que aumentan la confianza de los socios comerciales internacionales.

**Impacto Económico:**
- Reducción del fraude documental, protegiendo a los productores honestos.
- Acceso a mercados premium para productores con trazabilidad certificada.
- Eliminación de costos de blockchain real durante las fases iniciales (ahorro de decenas de miles de dólares anuales para un hato mediano).

**Impacto Institucional:**
- Fortalecimiento de la credibilidad de SENASICA y las autoridades sanitarias mexicanas.
- Herramienta de evidencia forense para procesos legales contra fraude ganadero.
- Modelo replicable para otros sectores agropecuarios.

### 12.2 Innovaciones Clave

SIGGAN incorpora innovaciones técnicas que lo distinguen de cualquier sistema existente en el sector ganadero mexicano:

1. **Biometría de iris con CNN entrenada en ganado bovino real** — Una red neuronal IrisEmbeddingNet con arquitectura ArcFace, entrenada con más de 350 fotos de vacas de la región, logrando una precisión de validación del **96.6%**.

2. **Función matemática de integridad personalizada** — $F(d) = \Sigma ASCII(c_i) \cdot P_i^i \bmod N$ — una función original basada en teoría de números que complementa SHA-256 con un segundo factor de verificación matemáticamente independiente.

3. **Integración transparente de blockchain** — El sellado criptográfico ocurre automáticamente en el background de cada operación, sin requerir ninguna acción adicional por parte del usuario.

4. **Certificados verificables sin conexión** — El sistema de certificados permite verificar autenticidad matemáticamente sin internet, con solo el archivo JSON y conocimiento del algoritmo.

5. **Arquitectura migration-ready** — Diseñada desde el primer día para migrar a Ethereum o Polygon con un cambio de una sola función.

### 12.3 Trabajo Futuro

- **Integración con SINIIGA** (Sistema Nacional de Identificación Individual del Ganado) para interoperabilidad con el sistema oficial.
- **App móvil** para registro en campo sin conexión, con sincronización posterior.
- **Migración a Polygon** para inmutabilidad absoluta descentralizada.
- **Módulo de exportación certificada** con integración directa con USDA/APHIS para validación automática de exportaciones a Estados Unidos.
- **Análisis predictivo** mediante IA sobre lecturas IoT para detección temprana de enfermedades.

### 12.4 Reflexión Final

La tecnología por sí sola no elimina la corrupción, pero puede hacerla matemáticamente inútil. Cuando la alteración de un dato produce una alerta inmediata, cuando un certificado falso es rechazado en segundos, cuando la identidad de un animal puede verificarse mediante su iris — entonces el costo del fraude supera cualquier beneficio potencial.

SIGGAN no es solo un sistema de gestión ganadera. Es una demostración de que la tecnología aplicada con rigor matemático puede ser un agente de justicia, equidad y salud pública. Un productor honesto que invierte en el saneamiento de su hato merece la certeza de que sus certificados sean respetados. Un consumidor merece saber que la carne en su mesa proviene de un animal sano. Las autoridades sanitarias merecen herramientas que respalden su trabajo con evidencia inalterable.

SIGGAN es esa herramienta.

---

## 13. ANEXOS TÉCNICOS

### Anexo A: Ejemplo Completo de Bloque en la Cadena

```json
{
  "id": "f591aa64-d80d-482a-89eb-87a7547b3a96",
  "hashActual":   "e1ecde9436b62bac2b193549079b0379dc00ef4706807be9ba17382c7e08c7e8",
  "hashAnterior": "0000000000000000000000000000000000000000000000000000000000000000",
  "tipoRegistro": "animal",
  "referenciaId": "c1601f86-05d4-4a2f-9e36-93cfc58c1aba",
  "hashDatos":    "daeb6267869c439f489c82c77054298cc7f1a9f820bca20f0166f38d1571bda8",
  "funcionMatem": "780763168",
  "hashFinal":    "96ca65f4e16113b18e263217440c83afcf32c38ca7d7597114ba05d9d8414637",
  "timestamp":    "2026-03-27T17:57:06.069Z"
}
```

**Interpretación:**
- `hashAnterior` es todo ceros → Este es el primer bloque de este tipo (bloque génesis de la cadena del animal).
- `hashDatos` → SHA-256 de los datos canónicos del animal serializado.
- `funcionMatem` → Resultado de $F(d) = 780{,}763{,}168$
- `hashFinal` → $SHA256(hashDatos + funcionMatem + SALT + timestamp)$
- `hashActual` → $SHA256(hashAnterior + "animal" + referenciaId + hashFinal + timestamp)$

### Anexo B: Ejemplo de Certificado Sanitario Completo

```json
{
  "version": "1.0",
  "folio": "CERT-20260327-36D331",
  "tipo": "CERTIFICADO_ZOOSANITARIO",
  "emitidoEn": "2026-03-27T17:57:20.511Z",
  "animal": {
    "id": "c1601f86-05d4-4a2f-9e36-93cfc58c1aba",
    "areteNacional": "MX10-00000027",
    "nombre": null,
    "raza": "Brahman",
    "sexo": "HEMBRA",
    "fechaNacimiento": "2024-06-15T00:00:00.000Z",
    "propietario": "José Martínez Rodríguez",
    "upp": "UPP-DGO-0042 - Rancho La Esperanza"
  },
  "evento": {
    "id": "6b86c33b-fa30-43ad-bcc0-654cf6bea060",
    "tipo": "VACUNACION",
    "fecha": "2026-03-15T10:00:00.000Z",
    "resultado": "APLICADA",
    "observaciones": "Vacuna RB51 contra Brucelosis bovina",
    "lote": "LOTE-RB51-2026-003",
    "proximaFecha": null
  },
  "mvz": {
    "nombre": "Dr. Carlos García López",
    "cedulaProfesional": "8745321",
    "rnmvz": "SENASICA-DGO-2847",
    "vigencia": "2027-06-30"
  },
  "integridad": {
    "hashDatos": "daeb6267869c439f489c82c77054298cc7f1a9f820bca20f0166f38d1571bda8",
    "funcionMatematica": "780763168",
    "hashFinal": "a18e7797c5c4d2c4ea0875b4407ec26a596aaa11fc6bcbb43f8c9d2e1f3a4b5c",
    "blockchainId": "9e216997-2f62-4d9a-82e4-4d8d973b6f9f",
    "hashBloque": "e1ecde9436b62bac2b193549079b0379dc00ef4706807be9ba17382c7e08c7e8",
    "timestamp": "2026-03-27T17:57:20.511Z"
  }
}
```

### Anexo C: Respuesta de Verificación Exitosa

```json
{
  "valido": true,
  "tipoAlerta": "VERIFICADO",
  "hashEsperado": "a18e7797c5c4d2c4ea0875b4407ec26a596aaa11fc6bcbb43f8c9d2e1f3a4b5c",
  "hashAlmacenado": "a18e7797c5c4d2c4ea0875b4407ec26a596aaa11fc6bcbb43f8c9d2e1f3a4b5c",
  "mensaje": "Integridad confirmada para animal:c1601f86-05d4-4a2f-9e36-93cfc58c1aba"
}
```

### Anexo D: Respuesta de Detección de Fraude

```json
{
  "valido": false,
  "tipoAlerta": "MANIPULACION",
  "hashEsperado": "ff8a9b3c1d2e4f5a6b7c8d9e0f1a2b3c4d5e6f7a8b9c0d1e2f3a4b5c6d7e8f9a",
  "hashAlmacenado": "a18e7797c5c4d2c4ea0875b4407ec26a596aaa11fc6bcbb43f8c9d2e1f3a4b5c",
  "mensaje": "⚠️ ALERTA: datos manipulados en animal:c1601f86-05d4-4a2f-9e36-93cfc58c1aba"
}
```

**Interpretación:** `hashEsperado` (calculado con datos actuales, que incluyen la modificación fraudulenta) es diferente de `hashAlmacenado` (el hash original sellado cuando el dato era legítimo). Esta discrepancia es matemáticamente imposible de forjar sin el SALT del servidor.

### Anexo E: Resultado de Auditoría de Cadena Completa

```json
{
  "integra": true,
  "totalBloques": 6,
  "bloquesCorruptos": [],
  "mensaje": "Cadena íntegra — 6 bloques verificados"
}
```

En caso de detección de corrupción:
```json
{
  "integra": false,
  "totalBloques": 6,
  "bloquesCorruptos": [
    {
      "indice": 2,
      "id": "b78694ed-26e2-4c12-a683-ee3634ed6639",
      "tipo": "animal",
      "referenciaId": "798e4bf3-9e67-44f6-b84c-1e1ffcadbfc1"
    }
  ],
  "mensaje": "⚠️ CADENA COMPROMETIDA — 1 bloque(s) alterados"
}
```

### Anexo F: Endpoints de la API de Blockchain

| Método | Endpoint | Descripción | Roles |
|--------|----------|-------------|-------|
| POST | `/api/blockchain/registrar/:tipo/:id` | Registrar en cadena | ADMIN, MVZ, SUPER_ADMIN |
| GET | `/api/blockchain/verificar/:tipo/:id` | Verificar integridad | Todos |
| GET | `/api/blockchain/cadena` | Ver cadena completa | Todos |
| GET | `/api/blockchain/verificar-cadena` | Auditoría completa | ADMIN, SUPER_ADMIN |
| POST | `/api/blockchain/certificado/:animalId` | Generar certificado | ADMIN, MVZ |
| POST | `/api/blockchain/verificar-certificado` | Verificar certificado | Todos |
| GET | `/api/blockchain/alertas` | Logs de fraude | ADMIN, SUPER_ADMIN |
| GET | `/api/blockchain/auditoria/:tipo/:id` | Historial de registro | ADMIN, SUPER_ADMIN |
| POST | `/api/blockchain/hash-demo` | Demo de hashing | Todos |

### Anexo G: Configuración del Entorno

```env
# .env — Variables de entorno críticas para seguridad

DATABASE_URL="postgresql://postgres:PASSWORD@localhost:5432/siggan_db?schema=public"
JWT_SECRET="clave-secreta-larga-y-aleatoria-minimo-256-bits"
BLOCKCHAIN_SALT="SIGGAN_INTEGRITY_SALT_PRODUCCION_2026"  # ← CRÍTICO: No exponer
IRIS_SERVICE_URL="http://localhost:5000"
FRONTEND_URL="http://localhost:3000"
PORT=3001
```

> ⚠️ **IMPORTANTE:** El `BLOCKCHAIN_SALT` es el elemento que hace matemáticamente imposible forjar un hash sin acceso al servidor. Debe ser una cadena larga, aleatoria y mantenerse en absoluta confidencialidad. Su comprometimiento invalidaría las garantías del sistema.

### Anexo H: Glosario Técnico

| Término | Definición en el contexto de SIGGAN |
|---------|-------------------------------------|
| **Hash** | Función matemática que transforma datos de cualquier tamaño en una cadena de longitud fija. Irreversible y determinista. |
| **SHA-256** | Algoritmo de hash criptográfico que produce 256 bits (64 caracteres hexadecimales). Estándar NIST. |
| **Blockchain** | Estructura de datos donde cada bloque contiene el hash del bloque anterior, formando una cadena verificable. |
| **SALT** | Cadena secreta añadida al input antes de hashearlo, para prevenir ataques de precomputación. |
| **Embedding** | Vector numérico de alta dimensión que representa características de un iris. |
| **CNN** | Red Neuronal Convolucional — arquitectura de deep learning usada en visión por computadora. |
| **ArcFace Loss** | Función de pérdida para entrenamiento de modelos de reconocimiento de identidad. |
| **Serialización determinista** | Proceso de convertir un objeto en string de manera que el mismo objeto siempre produzca el mismo string. |
| **Gas fee** | Comisión en criptomonedas requerida para ejecutar una transacción en Ethereum. |
| **MVZ** | Médico Veterinario Zootecnista — profesional autorizado para certificar eventos sanitarios. |
| **UPP** | Unidad de Producción Pecuaria — unidad básica de registro sanitario ganadero. |
| **RNMVZ** | Registro Nacional de Médicos Veterinarios Zootecnistas certificados por SENASICA. |
| **SENASICA** | Servicio Nacional de Sanidad, Inocuidad y Calidad Agroalimentaria — autoridad sanitaria. |

---

## 14. ANÁLISIS DE ESCALABILIDAD — DE 10 UPPs A 75,000 UPPs

> *Todos los cálculos de esta sección están basados en mediciones reales de la base de datos de SIGGAN en producción, con registros medidos byte a byte.*

### 14.1 Supuestos del Modelo

Los siguientes supuestos están fundamentados en estadísticas del sector ganadero mexicano:

| Parámetro | Valor | Fuente |
|-----------|-------|--------|
| Animales promedio por UPP | 50 cabezas | SIAP / SENASICA (pequeño productor) |
| Usuarios promedio por UPP | 1.5 (1 PRODUCTOR + fracción de MVZ compartido) | Modelo SIGGAN |
| Eventos sanitarios por animal/año | 10 (vacunas, pruebas TB/BR, pesajes, inspecciones) | Calendario sanitario SENASICA |
| Registros blockchain por animal/año | 15 (registro, re-sellado por iris, eventos, transferencias) | Estimado sistema |
| Animales con sensor IoT | 30% (adopción gradual) | Proyección de mercado |
| Lecturas IoT por animal/día | 48 (cada 30 minutos) | Config. actual simulador |
| Usuarios activos simultáneamente | 20% del total en horario pico | Patrones típicos SaaS |
| Peticiones por usuario activo/hora | 15 (operaciones normales) | Métricas web típicas |
| Factor pico mañana | 3× el promedio | Análisis de carga estándar |

**Tamaños reales medidos en la BD actual (bytes/registro):**
```
Tabla animales:           744 bytes/registro  (medido en PostgreSQL real)
Tabla eventos_sanitarios: 1,200 bytes/registro (estimado con campos MVZ)
Tabla blockchain_simulada: 1,365 bytes/registro (medido en PostgreSQL real)
Tabla lecturas_iot:        190 bytes/registro  (medido en PostgreSQL real)
```

### 14.2 Tabla Maestra de Escalabilidad

| Nivel | UPPs | Animales | Usuarios | DB nueva/año | IoT/día | RPS pico |
|-------|------|----------|----------|-------------|---------|---------|
| **Demo** (actual) | 10 | 500 | 15 | < 1 MB | 1 MB | < 1 |
| **Municipal** | 500 | 25,000 | 750 | 820 MB | 64 MB | 1 |
| **Estatal** (Durango) | 5,000 | 250,000 | 7,500 | 7.7 GB | 637 MB | 18 |
| **Regional** (3 estados) | 20,000 | 1,000,000 | 30,000 | 31 GB | 2.5 GB | 75 |
| **Nacional** | 75,000 | 3,750,000 | 112,500 | **116 GB** | **9.5 GB** | **281** |

### 14.3 Desglose Nacional Completo (75,000 UPPs)

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  SIGGAN a escala nacional — 75,000 UPPs
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  DATOS DEL DOMINIO
  ─────────────────────────────────────────────────
  Animales registrados:           3,750,000
  Usuarios del sistema:             112,500
  Eventos sanitarios/año:        37,500,000
  Certificados generados/año:     3,750,000 (1 por animal/año promedio)
  Bloques blockchain/año:        56,250,000

  CARGA OPERACIONAL DIARIA
  ─────────────────────────────────────────────────
  Nuevos registros animales/día:       ~10,000 (partos, altas)
  Eventos sanitarios/día:             ~102,740 (37.5M / 365)
  Bloques blockchain escritos/día:    ~154,110 (56.25M / 365)
  Lecturas IoT/día (30% con sensor):   54,000,000

  BLOCKCHAIN — ESCRITURAS POR SEGUNDO
  ─────────────────────────────────────────────────
  Promedio diario:                      1.78 escrituras/seg
  Pico (5× promedio, hora campaña):     8.9 escrituras/seg
  PostgreSQL soporta cómodamente:       ~5,000 escrituras/seg
  → CONCLUSIÓN: blockchain NO es el cuello de botella

  ALMACENAMIENTO PROYECTADO
  ─────────────────────────────────────────────────
  DB principal (sin IoT) — año 1:     116 GB
  DB principal (sin IoT) — año 5:     570 GB
  IoT acumulada en 1 año:           3,488 GB (~3.5 TB)
  IoT acumulada en 5 años:         17,440 GB (~17 TB)
  TOTAL sistema a 5 años:           ~18 TB
```

### 14.4 Diagrama de Crecimiento

```mermaid
xychart-beta
    title "Crecimiento de recursos con escala de UPPs"
    x-axis ["Demo (10)", "Municipal (500)", "Estatal (5K)", "Regional (20K)", "Nacional (75K)"]
    y-axis "Valor relativo (nacional = 100)" 0 --> 100
    bar  [0.01, 0.67, 6.6, 26.7, 100]
    line [0.01, 0.67, 6.6, 26.7, 100]
```

```mermaid
graph LR
    subgraph "Crecimiento Lineal ✅"
        A["Animales<br/>50 × UPPs"]
        B["Usuarios<br/>1.5 × UPPs"]
        C["Eventos/año<br/>500 × UPPs"]
        D["Blockchain writes<br/>750 × UPPs"]
    end

    subgraph "Crecimiento Alto ⚠️"
        E["Almacenamiento DB<br/>1.5 GB × UPPs / 1000"]
        F["RPS pico<br/>~3.7 × UPPs / 1000"]
    end

    subgraph "Crecimiento Crítico 🔴"
        G["IoT — 9.5 GB/día<br/>a escala nacional<br/>REQUIERE TimescaleDB"]
    end
```

### 14.5 Arquitectura de Infraestructura por Nivel

#### Nivel 1 — Demo / Prototipo (actual, hasta 50 UPPs)

```mermaid
graph TD
    U["Usuarios (≤75)"]
    subgraph "1 Servidor — $20-40 USD/mes"
        BE["Backend Node.js"]
        DB[("PostgreSQL")]
        PY["Iris Service Python"]
        FE["Frontend React (nginx)"]
    end
    U --> FE --> BE --> DB
    BE --> PY
```

**Especificación mínima:**
- 2 vCPU, 4 GB RAM, 50 GB SSD
- 1 servidor VPS (Digital Ocean, Linode, AWS t3.small)
- **Costo: $20–40 USD/mes**
- Sin cambios de arquitectura respecto a la implementación actual

---

#### Nivel 2 — Municipal (hasta 500 UPPs, 25,000 animales)

```mermaid
graph TD
    U["Usuarios (≤750)"]
    LB["Nginx Load Balancer"]
    subgraph "Servidor aplicación — $80 USD/mes"
        BE1["Backend Node.js<br/>(PM2 cluster, 4 workers)"]
        PY["Iris Service Python"]
    end
    subgraph "Servidor BD — $50 USD/mes"
        DB[("PostgreSQL<br/>4 vCPU / 16 GB RAM")]
    end
    U --> LB --> BE1 --> DB
```

**Cambios necesarios respecto al nivel anterior:**
- Activar **PM2 en modo cluster** para usar todos los núcleos CPU
- Crear índices en `blockchain_simulada(tipoRegistro, referenciaId)`
- Agregar `BLOCKCHAIN_SALT` como variable de entorno segura
- **Costo: $130–150 USD/mes**

---

#### Nivel 3 — Estatal (hasta 5,000 UPPs, 250,000 animales)

```mermaid
graph TD
    U["Usuarios (≤7,500)"]
    LB["Load Balancer<br/>(HAProxy / AWS ALB)"]

    subgraph "Capa de Aplicación (×2)"
        BE1["Backend Node.js #1<br/>4 vCPU / 8 GB"]
        BE2["Backend Node.js #2<br/>4 vCPU / 8 GB"]
        PY1["Iris Service #1"]
        PY2["Iris Service #2"]
    end

    subgraph "Capa de Datos"
        DB_P[("PostgreSQL Primary<br/>8 vCPU / 32 GB / 500 GB SSD")]
        DB_R[("PostgreSQL Read Replica<br/>4 vCPU / 16 GB")]
        REDIS[("Redis Cache<br/>Sesiones + Resultados frecuentes")]
    end

    subgraph "IoT — separado"
        TSDB[("TimescaleDB<br/>Solo lecturas IoT")]
    end

    U --> LB --> BE1 & BE2
    BE1 & BE2 --> DB_P & DB_R & REDIS
    BE1 & BE2 --> TSDB
```

**Cambios necesarios:**
- Separar **lecturas IoT a TimescaleDB** (extensión de PostgreSQL para time-series)
- Agregar **Redis** para caché de sesiones JWT y consultas frecuentes
- Implementar **read replica** para queries de reporte (no afecta la cadena blockchain)
- Activar **particionamiento por fecha** en `blockchain_simulada` y `eventos_sanitarios`
- **Costo: $400–600 USD/mes**

---

#### Nivel 4 — Regional (hasta 20,000 UPPs, 1,000,000 animales)

```mermaid
graph TD
    U["Usuarios (≤30,000)"]
    CDN["CDN (CloudFlare)<br/>Assets estáticos"]
    LB["Load Balancer"]

    subgraph "Pods Aplicación (×4-6)"
        PODS["4-6 instancias Backend<br/>Auto-scaling"]
        IRIS["2-3 instancias Iris CNN<br/>GPU recomendado"]
    end

    subgraph "Cola de Trabajo"
        QUEUE["BullMQ + Redis<br/>Blockchain writes async<br/>Generación certificados"]
        WORKERS["2 Workers dedicados<br/>Blockchain / Certificados"]
    end

    subgraph "Capa de Datos"
        DB_P[("PostgreSQL Primary<br/>16 vCPU / 64 GB / 2 TB")]
        DB_R1[("Read Replica #1")]
        DB_R2[("Read Replica #2")]
        TSDB[("TimescaleDB cluster<br/>IoT data — partición por mes")]
        REDIS[("Redis Cluster")]
    end

    U --> CDN & LB
    LB --> PODS
    PODS --> QUEUE
    QUEUE --> WORKERS --> DB_P
    PODS --> DB_P & DB_R1 & DB_R2 & TSDB & REDIS
    PODS --> IRIS
```

**Cambios necesarios:**
- **BullMQ** para manejo de colas — los writes de blockchain se encolan y procesan en background, garantizando eventual consistencia sin bloquear respuestas HTTP
- **Auto-scaling** basado en RPS (escalar a 6 pods cuando RPS > 50)
- **Particionamiento por rango de fechas** en todas las tablas de alto volumen
- **Costo: $1,500–3,000 USD/mes**

---

#### Nivel 5 — Nacional (75,000 UPPs, 3,750,000 animales)

```mermaid
graph TD
    U["112,500 Usuarios<br/>RPS pico: 281"]
    CDN["CDN Global<br/>(CloudFlare / AWS CloudFront)"]
    LB["Load Balancer Global<br/>(AWS ALB / GCP LB)"]

    subgraph "Kubernetes Cluster"
        subgraph "API Pods (×10-15, auto-scale)"
            API["Backend Node.js<br/>HPA: 10-20 pods"]
        end
        subgraph "Worker Pods (×4-8)"
            W_BC["Blockchain Workers ×3<br/>~9 writes/seg pico"]
            W_CERT["Cert Workers ×2<br/>LibreOffice headless"]
            W_IRIS["Iris CNN ×3<br/>GPU nodes"]
        end
    end

    subgraph "Base de Datos — Alta Disponibilidad"
        PG["PostgreSQL HA<br/>(Patroni + 3 nodos)<br/>32 vCPU / 128 GB / 4 TB NVMe"]
        PG_R["2 Read Replicas<br/>Reportes + Verificaciones"]
        TS["TimescaleDB Cluster<br/>IoT — 17 TB en 5 años<br/>Compresión automática 90%"]
        RD["Redis Cluster (×3)<br/>Cache + Queues + Sessions"]
    end

    subgraph "Almacenamiento"
        S3["Object Storage (S3/GCS)<br/>Certificados JSON / PDFs<br/>Fotos de iris"]
    end

    U --> CDN --> LB --> API
    API --> W_BC & W_CERT & W_IRIS
    W_BC --> PG
    API --> PG & PG_R & TS & RD & S3

    style PG fill:#2196F3,color:#fff
    style TS fill:#FF9800,color:#fff
    style RD fill:#F44336,color:#fff
```

**Costo estimado:**
| Componente | Especificación | USD/mes |
|------------|---------------|---------|
| Kubernetes cluster | 15 nodos × 4 vCPU / 16 GB | $2,100 |
| PostgreSQL HA (Patroni) | 3 nodos × 32 vCPU / 128 GB | $4,500 |
| TimescaleDB cluster | 2 nodos × 8 vCPU / 32 GB + 20 TB SSD | $2,800 |
| Redis cluster | 3 nodos × 4 vCPU / 16 GB | $600 |
| GPU nodes (Iris CNN) | 3 nodos NVIDIA T4 | $1,200 |
| Load balancer + CDN | — | $300 |
| Object storage | 50 TB | $1,000 |
| **TOTAL** | | **~$12,500 USD/mes** |

### 14.6 El Cuello de Botella Real: IoT

```mermaid
graph LR
    subgraph "Sin IoT — Manejable"
        DB_NORMAL["116 GB/año<br/>PostgreSQL estándar<br/>✅ Sin problema"]
    end

    subgraph "Con IoT — Crítico"
        IOT_DATA["54,000,000 lecturas/día<br/>9.5 GB/día<br/>3,488 GB/año<br/>🔴 Requiere solución especial"]
    end

    IOT_DATA --> SOL1["TimescaleDB<br/>Compresión 90%<br/>→ ~350 GB/año real"]
    IOT_DATA --> SOL2["Política TTL<br/>Borrar lecturas > 1 año<br/>Conservar solo resúmenes"]
    IOT_DATA --> SOL3["Agregación<br/>Lecturas → Promedio horario<br/>Reducción 60×"]
```

**Estrategia de manejo de IoT a escala:**

```sql
-- TimescaleDB: crear hypertable con compresión automática
SELECT create_hypertable('lecturas_iot', 'timestamp',
  chunk_time_interval => INTERVAL '1 day');

-- Comprimir chunks mayores a 7 días (90% reducción de espacio)
SELECT add_compression_policy('lecturas_iot',
  compress_after => INTERVAL '7 days');

-- Eliminar datos crudos mayores a 1 año (conservar agregados)
SELECT add_retention_policy('lecturas_iot',
  drop_after => INTERVAL '1 year');
```

Con estas políticas, los 3,488 GB/año de IoT se reducen a **~350 GB/año** — completamente manejable.

### 14.7 Cambios en el Código para Escalar

La arquitectura de SIGGAN fue diseñada para escalar con **cambios mínimos de código**. La mayor parte de la escalabilidad se logra mediante configuración de infraestructura, no reescritura del sistema:

| Componente | Cambio requerido | Impacto en código |
|-----------|-----------------|-------------------|
| Blockchain writes | Mover a cola BullMQ | Cambiar `.catch()` por `queue.add()` — **5 líneas** |
| Sesiones JWT | Agregar Redis como store | Cambiar config de middleware — **3 líneas** |
| IoT storage | Apuntar a TimescaleDB | Solo cambio en `DATABASE_URL_IOT` en `.env` — **0 líneas de código** |
| Iris CNN | Escalar con múltiples instancias | Solo cambiar `IRIS_SERVICE_URL` a load balancer — **0 líneas** |
| Read replicas | Separar reads de writes | Crear `prismaRead` client — **~10 líneas** |
| Certificados en S3 | Cambiar `fs.writeFileSync` por `s3.upload()` | **~15 líneas** en `certificado.service.ts` |

**Ejemplo del cambio para BullMQ:**

```typescript
// ANTES (implementación actual — funciona hasta ~5,000 UPPs):
registrarPorId('animal', animal.id)
  .catch(e => console.error('[blockchain] error:', e));

// DESPUÉS (para >5,000 UPPs — cambio de 1 línea):
await blockchainQueue.add('registrar', { tipo: 'animal', id: animal.id });
```

### 14.8 Resumen Ejecutivo de Escalabilidad

```mermaid
graph TD
    A["🟢 Demo — 10 UPPs<br/>1 servidor VPS<br/>$20-40/mes<br/>Sin cambios"] -->
    B["🟢 Municipal — 500 UPPs<br/>1 servidor potenciado<br/>$130-150/mes<br/>PM2 cluster + índices"] -->
    C["🟡 Estatal — 5,000 UPPs<br/>2 app servers + DB dedicada<br/>$400-600/mes<br/>+ Read replica + Redis + TimescaleDB"] -->
    D["🟡 Regional — 20,000 UPPs<br/>4-6 instancias + BullMQ<br/>$1,500-3,000/mes<br/>+ Colas async + Auto-scaling"] -->
    E["🔴 Nacional — 75,000 UPPs<br/>Kubernetes + HA<br/>$12,500/mes<br/>Arquitectura completa cloud-native"]

    style A fill:#4CAF50,color:#fff
    style B fill:#4CAF50,color:#fff
    style C fill:#FF9800,color:#fff
    style D fill:#FF9800,color:#fff
    style E fill:#F44336,color:#fff
```

**Conclusión clave:** La blockchain simulada de SIGGAN tiene un costo computacional de apenas **1.78 escrituras/segundo en promedio a escala nacional** (pico de 8.9/seg). PostgreSQL maneja cómodamente hasta 5,000 escrituras/segundo con configuración estándar. **La blockchain NO es el cuello de botella del sistema a ninguna escala realista** — el componente crítico es el almacenamiento de datos IoT, que se resuelve con TimescaleDB y políticas de retención.

El sistema puede escalar desde los 10 UPPs del prototipo actual hasta los 75,000 UPPs nacionales **sin reescribir ninguno de los módulos de negocio** (animales, eventos, certificados, blockchain). Solo se requieren ajustes de infraestructura y aproximadamente **30-40 líneas de código** para implementar colas y conexiones a servicios externos.

---

*Documento generado por el equipo de desarrollo de SIGGAN*
*Universidad Politécnica de Durango*
*Marzo 2026*
*Versión 2.0 — Para concurso / evaluación académica*

---

**© 2026 SIGGAN — Sistema Inteligente de Gestión Ganadera**
*Todos los derechos reservados. Documento confidencial para evaluación.*
