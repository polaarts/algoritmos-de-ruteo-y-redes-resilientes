const axios = require('axios');

// Endpoint del servicio MapServer que contiene incendios forestales
const url = "https://esri.ciren.cl/server/rest/services/IDEMINAGRI/INCENDIOS/MapServer/5/query";

async function obtenerIncendios() {
    const params = {
        where: "1=1",           // todas las incidencias
        outFields: "*",         // todos los atributos
        geometryType: "esriGeometryEnvelope", 
        outSR: "4326",          // sistema de referencia lat/lon
        f: "geojson"            // formato de salida
    };

    try {
        const response = await axios.get(url, { params });
        
        if (response.status === 200) {
            const data = response.data;
            const features = data.features || [];
            console.log(`Número de incendios forestales retornados: ${features.length}`);
            
            if (features.length > 0) {
                console.log("Ejemplo de incendio:", features[0]);
            }
            
            return data;
        }
    } catch (error) {
        console.error("Error al consultar incendios:", error.response?.status, error.message);
        return null;
    }
}

// Exportar la función
module.exports = { obtenerIncendios };

// Si se ejecuta directamente
if (require.main === module) {
    obtenerIncendios();
}
