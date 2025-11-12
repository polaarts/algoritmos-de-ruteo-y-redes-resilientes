const axios = require('axios');

const url = "https://earthquake.usgs.gov/fdsnws/event/1/query";

async function obtenerSismos(starttime = "2023-09-01", endtime = "2023-10-01") {
    const params = {
        format: "geojson",
        starttime: starttime,
        endtime: endtime,
        minlatitude: -56,
        maxlatitude: -17,
        minlongitude: -75,
        maxlongitude: -66
    };

    try {
        const response = await axios.get(url, { params });
        const data = response.data;
        
        console.log("Sismos encontrados:", data.features.length);
        
        if (data.features.length > 0) {
            console.log("Ejemplo:", data.features[0].properties);
        }
        
        return data;
    } catch (error) {
        console.error("Error al consultar sismos:", error.message);
        return null;
    }
}

// Exportar la función
module.exports = { obtenerSismos };

// Si se ejecuta directamente
if (require.main === module) {
    obtenerSismos();
}
