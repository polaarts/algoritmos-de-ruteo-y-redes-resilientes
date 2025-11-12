const fs = require('fs').promises;
const { obtenerUsoSuelo } = require('./ground_type');
const { obtenerViasOSM } = require('./infraestructure_support');
const { obtenerViasConRecubrimiento } = require('./recubrimiento_estimado');

async function main() {
    console.log("🚀 Iniciando integración de datos de infraestructura...");

    // Coordenadas del bounding box - área muy pequeña del centro de Concepción
    // Para evitar timeouts, usar un área de ~0.02° (~2km x 2km)
    const latMin = -36.83, lonMin = -73.06;
    const latMax = -36.81, lonMax = -73.04;

    console.log(`Área de consulta: (${latMin},${lonMin}) a (${latMax},${lonMax})`);
    console.log(`Tamaño aproximado: ~2km x ~2km (centro de Concepción)`);

    try {
        // Ejecutar los scripts e integrar los resultados
        console.log("\n▶ Paso 1/3: Obteniendo datos de uso de suelo...");
        const datosSuelo = await obtenerUsoSuelo(latMin, lonMin, latMax, lonMax);
        if (!datosSuelo) {
            console.warn("⚠️  No se pudieron obtener datos de uso de suelo");
        }
        
        console.log("\n▶ Paso 2/3: Obteniendo datos de vías...");
        const datosVias = await obtenerViasOSM(latMin, lonMin, latMax, lonMax);
        if (!datosVias) {
            console.warn("⚠️  No se pudieron obtener datos de vías");
        }
        
        console.log("\n▶ Paso 3/3: Procesando recubrimiento estimado...");
        let datosRecubrimiento = null;
        
        // Procesar recubrimiento basado en las vías obtenidas
        if (datosVias && datosVias.elements) {
            const { estimarRecubrimiento } = require('./recubrimiento_estimado');
            
            const viasConRecubrimiento = datosVias.elements
                .filter(e => e.type === 'way' && e.tags && e.tags.highway)
                .map(way => ({
                    id: way.id,
                    type: way.type,
                    tags: way.tags,
                    recubrimiento_estim: estimarRecubrimiento(way.tags.highway, way.tags.surface),
                    center: way.center
                }));
            
            datosRecubrimiento = {
                type: "FeatureCollection",
                features: viasConRecubrimiento.map(via => ({
                    type: "Feature",
                    id: via.id,
                    properties: {
                        ...via.tags,
                        recubrimiento_estim: via.recubrimiento_estim
                    },
                    geometry: via.center ? {
                        type: "Point",
                        coordinates: [via.center.lon, via.center.lat]
                    } : null
                }))
            };
            
            console.log(`✓ Procesadas ${viasConRecubrimiento.length} vías con recubrimiento estimado`);
        }

        // Estructura consolidada
        const metadataFinal = {
            fuente: "Integración automática de APIs y OSM",
            fecha_generacion: new Date().toISOString(),
            bounding_box: {
                lat_min: latMin,
                lon_min: lonMin,
                lat_max: latMax,
                lon_max: lonMax
            },
            resumen: {
                n_areas_suelo: datosSuelo ? (datosSuelo.elements || []).length : 0,
                n_vias: datosVias ? (datosVias.elements || []).length : 0,
                n_vias_recubrimiento: datosRecubrimiento ? (datosRecubrimiento.features || []).length : 0,
            },
            uso_suelo: datosSuelo,
            infraestructura: datosVias,
            recubrimiento_estimado: datosRecubrimiento
        };

        // Guardar todo en un solo archivo JSON
        const salida = "metadata_infraestructura_final.json";
        await fs.writeFile(
            salida,
            JSON.stringify(metadataFinal, null, 4),
            'utf-8'
        );

        console.log(`\n✅ Archivo final generado: ${salida}`);
        console.log("📊 Contiene todos los datos de suelo, vías y recubrimiento estimado.");
        console.log("\nResumen:");
        console.log(`  - Áreas de suelo: ${metadataFinal.resumen.n_areas_suelo}`);
        console.log(`  - Vías: ${metadataFinal.resumen.n_vias}`);
        console.log(`  - Vías con recubrimiento: ${metadataFinal.resumen.n_vias_recubrimiento}`);
        
    } catch (error) {
        console.error("❌ Error durante la integración:", error.message);
        throw error;
    }
}

// Ejecutar si se llama directamente
if (require.main === module) {
    main().catch(console.error);
}

module.exports = { main };
