const axios = require('axios');

const API_KEY = "API_KEY"; // obtener en openweathermap.org
const lat = -36.82;
const lon = -73.05; // Ejemplo: Concepción, Biobío

const url = "https://api.openweathermap.org/data/2.5/weather";

async function obtenerClima() {
    try {
        const response = await axios.get(url, {
            params: {
                lat: lat,
                lon: lon,
                appid: API_KEY,
                units: "metric"
            }
        });
        
        console.log("Condiciones actuales:", response.data);
        console.log("Precipitaciones (si existen):", response.data.rain || "No hay datos de lluvia");
        
        return response.data;
    } catch (error) {
        console.error("Error al obtener datos del clima:", error.message);
        return null;
    }
}

// Exportar la función para uso en otros módulos
module.exports = { obtenerClima };

// Si se ejecuta directamente
if (require.main === module) {
    obtenerClima();
}
