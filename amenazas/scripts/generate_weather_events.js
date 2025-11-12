// Script para generar eventos climáticos históricos para Chile
const fs = require('fs');

// Regiones de Chile con coordenadas aproximadas
const regions = [
  { name: 'Región Metropolitana', lat: -33.4489, lon: -70.6693, risk: 'medium' },
  { name: 'Valparaíso', lat: -33.0472, lon: -71.6127, risk: 'high' },
  { name: 'Biobío', lat: -36.8201, lon: -73.0444, risk: 'high' },
  { name: 'Araucanía', lat: -38.7359, lon: -72.5904, risk: 'high' },
  { name: 'Los Lagos', lat: -41.4717, lon: -72.9362, risk: 'extreme' },
  { name: 'Aysén', lat: -45.5752, lon: -72.0662, risk: 'extreme' },
  { name: 'Magallanes', lat: -53.1638, lon: -70.9171, risk: 'extreme' },
  { name: 'Coquimbo', lat: -29.9533, lon: -71.3395, risk: 'low' },
  { name: 'Atacama', lat: -27.3668, lon: -70.3323, risk: 'low' }
];

// Tipos de eventos climáticos
const eventTypes = [
  { type: 'storm', severity: ['moderate', 'severe', 'extreme'], months: [5, 6, 7, 8] },
  { type: 'flood', severity: ['moderate', 'severe'], months: [6, 7, 8] },
  { type: 'snow', severity: ['moderate', 'severe', 'extreme'], months: [6, 7, 8] },
  { type: 'wind', severity: ['moderate', 'severe'], months: [3, 4, 5, 9, 10, 11] },
  { type: 'rain', severity: ['moderate', 'severe'], months: [5, 6, 7, 8] }
];

// Generar eventos históricos (últimos 3 años)
function generateWeatherEvents() {
  const events = [];
  const currentYear = 2025;

  for (let year = currentYear - 3; year <= currentYear; year++) {
    regions.forEach(region => {
      // Generar 2-5 eventos por región por año
      const numEvents = Math.floor(Math.random() * 4) + 2;

      for (let i = 0; i < numEvents; i++) {
        const eventType = eventTypes[Math.floor(Math.random() * eventTypes.length)];

        // Seleccionar mes apropiado para el tipo de evento
        const month = eventType.months[Math.floor(Math.random() * eventType.months.length)];
        const day = Math.floor(Math.random() * 28) + 1;

        // Severidad basada en el riesgo de la región
        let severityOptions = eventType.severity;
        if (region.risk === 'low') {
          severityOptions = ['moderate'];
        } else if (region.risk === 'medium') {
          severityOptions = ['moderate', 'severe'];
        }
        const severity = severityOptions[Math.floor(Math.random() * severityOptions.length)];

        // Generar coordenadas aleatorias cerca de la región
        const latOffset = (Math.random() - 0.5) * 1.0; // ±0.5 grados
        const lonOffset = (Math.random() - 0.5) * 1.0;

        const event = {
          event_type: eventType.type,
          severity: severity,
          event_date: `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}T${String(Math.floor(Math.random() * 24)).padStart(2, '0')}:00:00Z`,
          duration_hours: Math.floor(Math.random() * 48) + 2,
          max_wind_speed: eventType.type === 'wind' || eventType.type === 'storm' ? Math.floor(Math.random() * 60) + 40 : Math.floor(Math.random() * 30) + 10,
          precipitation_mm: ['rain', 'storm', 'flood'].includes(eventType.type) ? Math.floor(Math.random() * 150) + 50 : Math.floor(Math.random() * 30),
          min_temperature: eventType.type === 'snow' ? Math.floor(Math.random() * 5) - 5 : Math.floor(Math.random() * 10) + 5,
          max_temperature: eventType.type === 'snow' ? Math.floor(Math.random() * 5) + 2 : Math.floor(Math.random() * 15) + 15,
          description: generateDescription(eventType.type, severity, region.name),
          region: region.name,
          latitude: region.lat + latOffset,
          longitude: region.lon + lonOffset
        };

        events.push(event);
      }
    });
  }

  return events;
}

function generateDescription(type, severity, region) {
  const descriptions = {
    storm: {
      moderate: `Tormenta moderada en ${region} con vientos fuertes`,
      severe: `Tormenta severa en ${region} con fuertes precipitaciones`,
      extreme: `Tormenta extrema en ${region} con riesgo de daños significativos`
    },
    flood: {
      moderate: `Inundación moderada en ${region} por lluvias intensas`,
      severe: `Inundación severa en ${region} afectando infraestructura`
    },
    snow: {
      moderate: `Nevada moderada en ${region}`,
      severe: `Nevada severa en ${region} con acumulación significativa`,
      extreme: `Nevada extrema en ${region} con carreteras bloqueadas`
    },
    wind: {
      moderate: `Vientos fuertes en ${region}`,
      severe: `Vientos severos en ${region} con riesgo de daños`
    },
    rain: {
      moderate: `Lluvias intensas en ${region}`,
      severe: `Lluvias torrenciales en ${region}`
    }
  };

  return descriptions[type][severity] || `Evento climático en ${region}`;
}

// Generar eventos
console.log('Generando eventos climáticos históricos...');
const weatherEvents = generateWeatherEvents();

console.log(`✅ Generados ${weatherEvents.length} eventos climáticos`);
console.log(`   - Regiones: ${regions.length}`);
console.log(`   - Período: 2022-2025`);

// Guardar en archivo JSON
const path = require('path');
const outputFile = path.join(__dirname, '../data/weather_events.json');
fs.writeFileSync(outputFile, JSON.stringify({ weather_events: weatherEvents }, null, 2));
console.log(`✅ Datos guardados en: ${outputFile}`);

// Mostrar muestra
console.log('\nMuestra de eventos:');
weatherEvents.slice(0, 3).forEach(event => {
  console.log(`  - ${event.event_type} (${event.severity}) en ${event.region} - ${event.event_date.split('T')[0]}`);
});
