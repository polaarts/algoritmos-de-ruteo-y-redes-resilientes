const fs = require('fs').promises;
const { obtenerClima } = require('./clima_extremo');
const { obtenerIncendios } = require('./incendios_forestales');
const { obtenerSismos } = require('./seismicidad');

async function obtenerDatosClima() {
    try {
        const clima = await obtenerClima();
        if (!clima) return {};
        
        return {
            temperatura: clima.main?.temp,
            humedad: clima.main?.humidity,
            presion: clima.main?.pressure,
            viento: clima.wind?.speed,
            precipitacion_mm: clima.rain?.["1h"] || 0,
            descripcion: clima.weather?.[0]?.description,
            ubicacion: clima.name,
            timestamp: new Date().toISOString()
        };
    } catch (error) {
        console.error("Error al obtener datos de clima:", error.message);
        return {};
    }
}

async function obtenerDatosIncendios() {
    try {
        const response = await obtenerIncendios();
        if (!response) return [];
        
        const features = response.features || [];
        
        return features.map(f => ({
            region: f.properties.region,
            comuna: f.properties.comuna,
            nombre: f.properties.nom_incen,
            superficie_ha: f.properties.superficie,
            causa: f.properties.causa_gene,
            temporada: f.properties.temporada,
            lat: f.geometry.coordinates[1],
            lon: f.geometry.coordinates[0]
        }));
    } catch (error) {
        console.error("Error al obtener incendios:", error.message);
        return [];
    }
}

async function obtenerDatosSismos() {
    try {
        const response = await obtenerSismos();
        if (!response) return [];
        
        return response.features.map(f => ({
            magnitud: f.properties.mag,
            ubicacion: f.properties.place,
            fecha: new Date(f.properties.time).toISOString(),
            url: f.properties.url,
            lat: f.geometry.coordinates[1],
            lon: f.geometry.coordinates[0]
        }));
    } catch (error) {
        console.error("Error al obtener datos de sismos:", error.message);
        return [];
    }
}

async function main() {
    console.log("Extrayendo datos de clima, incendios y sismos...");

    const clima = await obtenerDatosClima();
    const incendios = await obtenerDatosIncendios();
    const sismos = await obtenerDatosSismos();

    const resultado = {
        clima_extremo: clima,
        incendios_forestales: incendios,
        sismicidad: sismos,
        ultima_actualizacion: new Date().toISOString()
    };

    // Guardar todo en JSON
    await fs.writeFile(
        "datos_integrados.json",
        JSON.stringify(resultado, null, 4),
        'utf-8'
    );

    console.log("Datos integrados correctamente en 'datos_integrados.json'");
    console.log(`\nResumen:`);
    console.log(`- Clima: ${Object.keys(clima).length > 0 ? 'Datos obtenidos' : 'Sin datos'}`);
    console.log(`- Incendios: ${incendios.length} registros`);
    console.log(`- Sismos: ${sismos.length} eventos`);
}

// Ejecutar si se llama directamente
if (require.main === module) {
    main().catch(console.error);
}

module.exports = { main, obtenerDatosClima, obtenerDatosIncendios, obtenerDatosSismos };
