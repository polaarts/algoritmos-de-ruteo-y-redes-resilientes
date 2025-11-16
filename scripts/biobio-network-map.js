/*
 * MAPA DE CONEXIONES - REGIÓN DEL BIOBÍO
 * 
 * Este archivo muestra las conexiones que se generarán entre los datacenters
 * de la Región del Biobío usando OSRM para rutas realistas.
 * 
 * Total: 9 Datacenters → 36 Enlaces Bidireccionales
 */

// =============================================================================
// DATACENTERS (9)
// =============================================================================

const datacenters = [
  {
    id: 3,
    ciudad: "Concepción",
    empresa: "Movistar",
    coordenadas: { lon: -73.0444, lat: -36.8201 },
    capacidad: "5.0 MW",
    tier: 3,
    poblacion: 223_000
  },
  {
    id: 11,
    ciudad: "Los Álamos",
    empresa: "Claro",
    coordenadas: { lon: -73.4118, lat: -37.6272 },
    capacidad: "1.5 MW",
    tier: 2,
    poblacion: 20_000
  },
  {
    id: 12,
    ciudad: "Chillán",
    empresa: "Entel",
    coordenadas: { lon: -72.1033, lat: -36.6067 },
    capacidad: "2.0 MW",
    tier: 2,
    poblacion: 184_000
  },
  {
    id: 13,
    ciudad: "Los Ángeles",
    empresa: "GTD",
    coordenadas: { lon: -72.3536, lat: -37.4695 },
    capacidad: "1.8 MW",
    tier: 2,
    poblacion: 166_000
  },
  {
    id: 14,
    ciudad: "Coronel",
    empresa: "Telefónica",
    coordenadas: { lon: -73.1605, lat: -37.0330 },
    capacidad: "1.5 MW",
    tier: 2,
    poblacion: 116_000
  },
  {
    id: 15,
    ciudad: "Talcahuano",
    empresa: "VTR",
    coordenadas: { lon: -73.1165, lat: -36.7249 },
    capacidad: "2.5 MW",
    tier: 3,
    poblacion: 263_000
  },
  {
    id: 16,
    ciudad: "Tomé",
    empresa: "WOM",
    coordenadas: { lon: -72.9570, lat: -36.6181 },
    capacidad: "1.2 MW",
    tier: 2,
    poblacion: 54_000
  },
  {
    id: 17,
    ciudad: "Lota",
    empresa: "Claro",
    coordenadas: { lon: -73.1584, lat: -37.0895 },
    capacidad: "1.0 MW",
    tier: 2,
    poblacion: 49_000
  },
  {
    id: 18,
    ciudad: "Mulchén",
    empresa: "Entel",
    coordenadas: { lon: -72.2396, lat: -37.7191 },
    capacidad: "1.0 MW",
    tier: 2,
    poblacion: 30_000
  }
];

// =============================================================================
// CONEXIONES QUE SE GENERARÁN (36 pares)
// =============================================================================

const conexiones = [
  // Desde Concepción (hub principal)
  ["Concepción", "Los Álamos"],
  ["Concepción", "Chillán"],
  ["Concepción", "Los Ángeles"],
  ["Concepción", "Coronel"],
  ["Concepción", "Talcahuano"],
  ["Concepción", "Tomé"],
  ["Concepción", "Lota"],
  ["Concepción", "Mulchén"],

  // Desde Los Álamos
  ["Los Álamos", "Chillán"],
  ["Los Álamos", "Los Ángeles"],
  ["Los Álamos", "Coronel"],
  ["Los Álamos", "Talcahuano"],
  ["Los Álamos", "Tomé"],
  ["Los Álamos", "Lota"],
  ["Los Álamos", "Mulchén"],

  // Desde Chillán
  ["Chillán", "Los Ángeles"],
  ["Chillán", "Coronel"],
  ["Chillán", "Talcahuano"],
  ["Chillán", "Tomé"],
  ["Chillán", "Lota"],
  ["Chillán", "Mulchén"],

  // Desde Los Ángeles
  ["Los Ángeles", "Coronel"],
  ["Los Ángeles", "Talcahuano"],
  ["Los Ángeles", "Tomé"],
  ["Los Ángeles", "Lota"],
  ["Los Ángeles", "Mulchén"],

  // Desde Coronel
  ["Coronel", "Talcahuano"],
  ["Coronel", "Tomé"],
  ["Coronel", "Lota"],
  ["Coronel", "Mulchén"],

  // Desde Talcahuano
  ["Talcahuano", "Tomé"],
  ["Talcahuano", "Lota"],
  ["Talcahuano", "Mulchén"],

  // Desde Tomé
  ["Tomé", "Lota"],
  ["Tomé", "Mulchén"],

  // Desde Lota
  ["Lota", "Mulchén"]
];

// =============================================================================
// DISTANCIAS ESTIMADAS (antes de OSRM)
// =============================================================================

const distanciasDirectas = {
  "Concepción - Chillán": "~105 km",
  "Concepción - Los Ángeles": "~115 km",
  "Concepción - Talcahuano": "~15 km",
  "Concepción - Los Álamos": "~120 km",
  "Chillán - Los Ángeles": "~80 km",
  "Los Ángeles - Mulchén": "~60 km"
};

// =============================================================================
// CAPACIDADES POR DISTANCIA (automáticas)
// =============================================================================

const capacidadPorDistancia = {
  "< 50 km": "400 Gbps",
  "50-100 km": "200 Gbps",
  "> 100 km": "100 Gbps"
};

// =============================================================================
// TIPOS DE ENLACE
// =============================================================================

const tiposEnlace = {
  trunk: "Troncal principal (entre hubs)",
  distribution: "Distribución regional",
  access: "Acceso local"
};

// =============================================================================
// MEJORAS CON OSRM
// =============================================================================

const mejorasOSRM = {
  antes: {
    geometria: "Línea recta (no realista)",
    distancia: "Distancia euclidiana (imprecisa)",
    visualizacion: "Línea directa en mapa"
  },
  despues: {
    geometria: "Sigue carreteras reales (realista)",
    distancia: "Distancia por carretera (precisa)",
    visualizacion: "Ruta realista en mapa"
  }
};

// =============================================================================
// EJEMPLO DE RUTA OSRM
// =============================================================================

const ejemploRutaOSRM = {
  origen: "Concepción",
  destino: "Los Álamos",
  request: "GET /api/osrm/route?start=-73.0444,-36.8201&end=-73.4118,-37.6272",
  response: {
    distance: 156234, // metros (156.2 km)
    duration: 7842,   // segundos (2.2 horas)
    geometry: {
      type: "LineString",
      coordinates: [
        [-73.0444, -36.8201], // Concepción
        [-73.0512, -36.8345], // Punto en ruta
        [-73.1234, -36.9876], // Punto en ruta
        // ... más puntos siguiendo la carretera ...
        [-73.4118, -37.6272]  // Los Álamos
      ]
    }
  }
};

// =============================================================================
// ESTADÍSTICAS ESPERADAS
// =============================================================================

const estadisticas = {
  totalDatacenters: 9,
  totalEnlaces: 36,
  capacidadTotal: "16.5 MW",
  longitudTotalEstimada: "~3,500 km",
  tiempoGeneracion: "1-2 minutos",
  ciudadesCubiertas: [
    "Concepción (hub principal)",
    "Talcahuano (hub secundario)",
    "Chillán",
    "Los Ángeles",
    "Los Álamos",
    "Coronel",
    "Tomé",
    "Lota",
    "Mulchén"
  ]
};

// =============================================================================
// VISUALIZACIÓN ASCII
// =============================================================================

console.log(`
╔════════════════════════════════════════════════════════════════════╗
║           REGIÓN DEL BIOBÍO - RED DE FIBRA ÓPTICA                 ║
╚════════════════════════════════════════════════════════════════════╝

         Chillán (Entel)
            ⭐ 2.0 MW
             │
             │
         Tomé (WOM)
         🏢 1.2 MW ─────── Talcahuano (VTR)
             │                 ⭐ 2.5 MW
             │                     │
             │                     │
        Concepción (Movistar) ─────┘
            ⭐⭐ 5.0 MW
             │
             │
         Coronel (Telefónica)
         🏢 1.5 MW
             │
             │
         Lota (Claro)
         🏢 1.0 MW
             │
             │
      Los Ángeles (GTD) ─── Mulchén (Entel)
         🏢 1.8 MW             🏢 1.0 MW
             │
             │
      Los Álamos (Claro)
         🏢 1.5 MW

Leyenda:
  ⭐⭐ = Hub Principal (Tier 3)
  ⭐   = Hub Secundario (Tier 3)
  🏢   = Datacenter Regional (Tier 2)
  │    = Enlace de fibra (ruta OSRM)

`);

// =============================================================================
// EXPORTAR PARA USO EN SCRIPTS
// =============================================================================

module.exports = {
  datacenters,
  conexiones,
  distanciasDirectas,
  capacidadPorDistancia,
  tiposEnlace,
  mejorasOSRM,
  ejemploRutaOSRM,
  estadisticas
};
