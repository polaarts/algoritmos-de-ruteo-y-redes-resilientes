const axios = require('axios');
const fs = require('fs').promises;

function estimarRecubrimiento(highway, surface = null) {
    /**
     * Función heurística simple para asignar tipo de recubrimiento estimado
     * basado en la clase de vía (highway) y, opcionalmente, en superficie.
     */
    // si highway es una lista, tomar el primer elemento
    const hw = Array.isArray(highway) ? highway[0] : highway;

    // autopistas / rutas principales → necesidad más robusta
    if (["motorway", "trunk", "primary"].includes(hw)) {
        return "armored / PE exterior";
    }

    // vías secundarias / terciarias → recubrimiento robusto o reforzado
    if (["secondary", "tertiary"].includes(hw)) {
        return "outdoor robust (PE o con armadura parcial)";
    }

    // calles locales / vías urbanas
    if (["residential", "unclassified", "service"].includes(hw)) {
        // si la superficie es no pavimentada, usar recubrimiento más resistente
        if (["unpaved", "dirt", "gravel"].includes(surface)) {
            return "armored / robust";
        } else {
            return "LSZH / interior / estándar";
        }
    }

    // fallback si no coincide
    return "LSZH / estándar";
}

async function obtenerViasConRecubrimiento(place = "Santiago, Chile") {
    /**
     * Obtiene vías desde Overpass API y estima el recubrimiento.
     * Nota: Esta es una versión simplificada ya que osmnx es específico de Python.
     * Para una implementación completa necesitarías usar una API diferente o procesar
     * datos OSM de otra manera.
     */
    console.log(`Obteniendo vías para: ${place}`);
    console.log("Nota: Esta es una implementación simplificada sin osmnx");
    
    // Para una implementación real, necesitarías:
    // 1. Usar Overpass API o Nominatim para obtener el bounding box del lugar
    // 2. Consultar las vías dentro de ese bounding box
    // 3. Procesar los datos de vías y aplicar la estimación de recubrimiento
    
    // Ejemplo con bounding box fijo para Santiago
    const overpassUrl = "https://overpass-api.de/api/interpreter";
    const query = `
    [out:json][timeout:90];
    area["name"="Santiago"]["admin_level"="8"]->.a;
    (
      way["highway"](area.a);
    );
    out geom;
    `;

    try {
        const response = await axios.post(
            overpassUrl,
            `data=${encodeURIComponent(query)}`,
            {
                headers: {
                    'Content-Type': 'application/x-www-form-urlencoded'
                },
                timeout: 90000 // 90 segundos
            }
        );

        const data = response.data;
        const ways = data.elements.filter(e => e.type === 'way');
        
        // Procesar vías y agregar estimación de recubrimiento
        const viasConRecubrimiento = ways.map(way => {
            const highway = way.tags?.highway;
            const surface = way.tags?.surface;
            
            return {
                id: way.id,
                type: way.type,
                tags: way.tags,
                nodes: way.nodes,
                recubrimiento_estim: estimarRecubrimiento(highway, surface)
            };
        });

        // Crear GeoJSON simplificado
        const geojson = {
            type: "FeatureCollection",
            features: viasConRecubrimiento.map(via => ({
                type: "Feature",
                id: via.id,
                properties: {
                    ...via.tags,
                    recubrimiento_estim: via.recubrimiento_estim
                },
                geometry: {
                    type: "LineString",
                    coordinates: [] // Necesitarías resolver las coordenadas de los nodos
                }
            }))
        };

        // Guardar en archivo
        await fs.writeFile(
            "vias_con_recubrimiento_estim.geojson",
            JSON.stringify(geojson, null, 2),
            'utf-8'
        );

        console.log(`Exportado ${viasConRecubrimiento.length} vías con recubrimientos estimados.`);
        return geojson;
        
    } catch (error) {
        console.error("Error al obtener vías:", error.message);
        return null;
    }
}

// Exportar funciones
module.exports = { estimarRecubrimiento, obtenerViasConRecubrimiento };

// Si se ejecuta directamente
if (require.main === module) {
    obtenerViasConRecubrimiento().catch(console.error);
}
