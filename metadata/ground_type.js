const axios = require('axios');

async function obtenerUsoSuelo(latMin, lonMin, latMax, lonMax) {
    /**
     * Consulta OpenStreetMap vía Overpass API para obtener áreas con 'landuse'
     * dentro del bounding box dado.
     * Retorna un objeto JSON con los elementos.
     */
    const overpassUrl = "https://overpass-api.de/api/interpreter";
    
    // Query muy simple: solo tags de landuse, sin geometría
    const query = `
    [out:json][timeout:180][bbox:${latMin},${lonMin},${latMax},${lonMax}];
    way["landuse"];
    out tags;
    `;

    try {
        console.log("Consultando Overpass API para uso de suelo...");
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

        if (response.status !== 200) {
            console.error("Error en la consulta:", response.status);
            return null;
        }

        console.log("✓ Datos de uso de suelo obtenidos exitosamente");
        return response.data;
    } catch (error) {
        if (error.code === 'ECONNABORTED' || error.response?.status === 504) {
            console.error("Timeout: El área es demasiado grande. Intenta con un bounding box más pequeño.");
        } else {
            console.error("Error al obtener uso de suelo:", error.message);
        }
        return null;
    }
}

async function main() {
    // Área muy pequeña del centro de Concepción (~2km x 2km)
    const latMin = -36.83, lonMin = -73.06;
    const latMax = -36.81, lonMax = -73.04;
    
    console.log(`Consultando uso de suelo en el área: (${latMin},${lonMin}) a (${latMax},${lonMax})`);
    
    const usoSuelo = await obtenerUsoSuelo(latMin, lonMin, latMax, lonMax);
    
    if (usoSuelo) {
        const elementos = usoSuelo.elements || [];
        console.log("Número de áreas encontradas:", elementos.length);
        
        // Mostrar algunos ejemplos
        elementos.slice(0, 5).forEach(e => {
            console.log("ID:", e.id, "Tags:", e.tags);
        });
    }
}

// Exportar la función
module.exports = { obtenerUsoSuelo };

// Si se ejecuta directamente
if (require.main === module) {
    main().catch(console.error);
}
