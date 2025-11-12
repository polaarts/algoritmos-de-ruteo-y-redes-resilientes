/**
 * Script para verificar los datos cargados en Supabase
 */

const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../backend/.env') });
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY
);

async function verificarDatos() {
    console.log('🔍 VERIFICANDO DATOS EN SUPABASE\n');
    console.log('='.repeat(60));
    
    // Contar registros en cada tabla
    const { count: countSismos } = await supabase
        .from('earthquakes')
        .select('*', { count: 'exact', head: true });
    
    const { count: countZonas } = await supabase
        .from('fire_risk_zones')
        .select('*', { count: 'exact', head: true });
    
    const { count: countWeather } = await supabase
        .from('weather_events')
        .select('*', { count: 'exact', head: true });
    
    const { count: countGround } = await supabase
        .from('ground_type')
        .select('*', { count: 'exact', head: true });
    
    console.log('\n📊 CONTEO DE REGISTROS:');
    console.log(`  ├─ Sismos (earthquakes): ${countSismos}`);
    console.log(`  ├─ Zonas de riesgo (fire_risk_zones): ${countZonas}`);
    console.log(`  ├─ Eventos climáticos (weather_events): ${countWeather}`);
    console.log(`  └─ Tipos de suelo (ground_type): ${countGround}`);
    
    // Ejemplos de datos
    console.log('\n' + '='.repeat(60));
    console.log('📋 EJEMPLOS DE DATOS:\n');
    
    const { data: sismos, error: errorSismos } = await supabase
        .from('earthquakes')
        .select('magnitude, place, threat_level')
        .order('magnitude', { ascending: false })
        .limit(3);
    
    if (sismos && sismos.length > 0) {
        console.log('🌍 Top 3 Sismos por Magnitud:');
        sismos.forEach((s, i) => {
            console.log(`  ${i + 1}. Magnitud ${s.magnitude} - ${s.place} (${s.threat_level})`);
        });
    } else {
        console.log('🌍 No hay datos de sismos' + (errorSismos ? ': ' + errorSismos.message : ''));
    }
    
    const { data: zonas, error: errorZonas } = await supabase
        .from('fire_risk_zones')
        .select('zone_name, risk_level, fire_frequency')
        .order('fire_frequency', { ascending: false })
        .limit(3);
    
    if (zonas && zonas.length > 0) {
        console.log('\n🔥 Top 3 Zonas con Mayor Frecuencia de Incendios:');
        zonas.forEach((z, i) => {
            console.log(`  ${i + 1}. ${z.zone_name} - ${z.fire_frequency} incendios (${z.risk_level})`);
        });
    } else {
        console.log('\n🔥 No hay datos de zonas de riesgo' + (errorZonas ? ': ' + errorZonas.message : ''));
    }
    
    console.log('\n' + '='.repeat(60));
    console.log('✅ Verificación completada\n');
}

verificarDatos().catch(console.error);
