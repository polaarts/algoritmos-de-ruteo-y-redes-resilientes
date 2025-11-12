// Script para cargar eventos climáticos a Supabase
const { Client } = require('pg');
const fs = require('fs');
const path = require('path');

// Configuración de la base de datos
const client = new Client({
  host: 'db.klqxckzqovjtazjifnlu.supabase.co',
  port: 5432,
  database: 'postgres',
  user: 'postgres',
  password: 'wSNlW4C1tVKCw7Ez'
});

async function loadWeatherEvents() {
  try {
    await client.connect();
    console.log('✅ Conectado a Supabase');

    // Leer archivo JSON
    const dataPath = path.join(__dirname, '../data/weather_events.json');
    const data = JSON.parse(fs.readFileSync(dataPath, 'utf8'));
    const events = data.weather_events;

    console.log(`📥 Cargando ${events.length} eventos climáticos...`);

    // Limpiar tabla (opcional)
    await client.query('DELETE FROM weather_events');
    console.log('🗑️  Tabla weather_events limpiada');

    // Insertar eventos
    let insertedCount = 0;
    for (const event of events) {
      try {
        // Crear polígono circular alrededor del punto
        // Radio aproximado de 50km
        const radiusKm = 50;
        const radiusDeg = radiusKm / 111.0; // Aproximado: 1 grado = 111 km

        const query = `
          INSERT INTO weather_events (
            event_type,
            severity,
            event_date,
            duration_hours,
            max_wind_speed,
            precipitation_mm,
            temperature_c,
            description,
            geometry
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8,
            ST_Buffer(
              ST_SetSRID(ST_MakePoint($9, $10), 4326)::geography,
              $11
            )::geometry
          )
        `;

        // Calcular temperatura promedio
        const avgTemperature = (event.min_temperature + event.max_temperature) / 2;

        await client.query(query, [
          event.event_type,
          event.severity,
          event.event_date,
          event.duration_hours,
          event.max_wind_speed,
          event.precipitation_mm,
          avgTemperature,
          event.description,
          event.longitude,
          event.latitude,
          radiusKm * 1000 // metros
        ]);

        insertedCount++;
        if (insertedCount % 20 === 0) {
          console.log(`   Cargados ${insertedCount}/${events.length}...`);
        }
      } catch (err) {
        console.error(`❌ Error insertando evento: ${err.message}`);
      }
    }

    console.log(`✅ ${insertedCount} eventos climáticos cargados exitosamente`);

    // Verificar
    const result = await client.query('SELECT COUNT(*), event_type, severity FROM weather_events GROUP BY event_type, severity ORDER BY event_type, severity');
    console.log('\n📊 Resumen de eventos cargados:');
    result.rows.forEach(row => {
      console.log(`   ${row.event_type.padEnd(10)} ${row.severity.padEnd(10)} : ${row.count} eventos`);
    });

  } catch (err) {
    console.error('❌ Error:', err.message);
  } finally {
    await client.end();
  }
}

loadWeatherEvents();
