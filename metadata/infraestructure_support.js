const axios = require('axios');

async function obtenerViasOSM(latMin, lonMin, latMax, lonMax) {
    /**
     * Consulta OpenStreetMap vía Overpass API para obtener vías en el bounding box con tags.
     * Retorna un objeto GeoJSON-like con las vías y sus propiedades.
     */
    const overpassUrl = "https://overpass-api.de/api/interpreter";
    
    // Query optimizada: solo vías principales, con centro para geolocalización
    const query = `
    [out:json][timeout:180][bbox:${latMin},${lonMin},${latMax},${lonMax}];
    way["highway"~"motorway|trunk|primary|secondary|tertiary"];
    out tags center;
    `;

    try {
        console.log("Consultando Overpass API para vías...");
        const response = await axios.post(
            overpassUrl,
            `data=${encodeURIComponent(query)}`,
            {
                headers: {
                    'Content-Type': 'application/x-www-form-urlencoded'
                },
                timeout: 200000 // 200 segundos
            }
        );

        console.log("✓ Datos de vías obtenidos exitosamente");
        return response.data;
    } catch (error) {
        if (error.code === 'ECONNABORTED' || error.response?.status === 504) {
            console.error("Timeout: El área es demasiado grande. Intenta con un bounding box más pequeño.");
        } else {
            console.error("Error al obtener vías OSM:", error.message);
        }
        return null;
    }
}

async function main() {
    // Área muy pequeña del centro de Concepción (~2km x 2km)
    const latMin = -36.83, lonMin = -73.06;
    const latMax = -36.81, lonMax = -73.04;
    
    console.log(`Consultando vías en el área: (${latMin},${lonMin}) a (${latMax},${lonMax})`);
    
    const vias = await obtenerViasOSM(latMin, lonMin, latMax, lonMax);
    
    if (vias) {
        const elementos = vias.elements || [];
        console.log("Número de vías encontradas:", elementos.length);
        
        // Mostrar algunas vías con tags
        elementos.slice(0, 5).forEach(e => {
            console.log(e.id, e.tags);
        });
    }
}

// Exportar la función
module.exports = { obtenerViasOSM };

// Si se ejecuta directamente
if (require.main === module) {
    main().catch(console.error);
}
