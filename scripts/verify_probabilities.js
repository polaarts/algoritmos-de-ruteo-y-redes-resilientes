const { Pool } = require('pg');
require('dotenv').config({ path: require('path').join(__dirname, '..', 'backend', '.env') });

const pool = new Pool({
    host: process.env.DB_HOST || 'localhost',
    port: process.env.DB_PORT || 5432,
    database: process.env.DB_NAME || 'postgres',
    user: process.env.DB_USER || 'postgres',
    password: process.env.DB_PASSWORD || 'postgres',
    ssl: { rejectUnauthorized: false }
});

/**
 * Verifica las probabilidades cargadas en Supabase
 */
async function verifyProbabilities() {
    console.log('='.repeat(60));
    console.log('  VERIFICACIÓN DE PROBABILIDADES EN SUPABASE');
    console.log('='.repeat(60));

    const client = await pool.connect();

    try {
        // 1. Verificar nodos con probabilidades
        console.log('\n📍 PROBABILIDADES DE NODOS\n');
        
        const nodeStats = await client.query(`
            SELECT 
                COUNT(*) as total,
                AVG(total_failure_probability) as avg_prob,
                MIN(total_failure_probability) as min_prob,
                MAX(total_failure_probability) as max_prob
            FROM node_probabilities
        `);

        const ns = nodeStats.rows[0];
        console.log(`Total de nodos con probabilidades: ${ns.total}`);
        console.log(`Probabilidad promedio: ${parseFloat(ns.avg_prob).toFixed(2)}%`);
        console.log(`Rango: ${parseFloat(ns.min_prob).toFixed(2)}% - ${parseFloat(ns.max_prob).toFixed(2)}%`);

        // Top 5 nodos con mayor riesgo
        console.log('\n🔴 Top 5 nodos con mayor riesgo:');
        const topNodes = await client.query(`
            SELECT 
                np.node_id,
                fn.city,
                fn.region,
                np.total_failure_probability,
                np.earthquake_probability,
                np.fire_probability
            FROM node_probabilities np
            JOIN fiber_nodes fn ON np.node_id = fn.id
            ORDER BY np.total_failure_probability DESC
            LIMIT 5
        `);

        topNodes.rows.forEach((node, i) => {
            console.log(`${i + 1}. Nodo ${node.node_id} (${node.city}, ${node.region})`);
            console.log(`   Total: ${parseFloat(node.total_failure_probability).toFixed(2)}%`);
            console.log(`   Terremoto: ${parseFloat(node.earthquake_probability).toFixed(2)}%, Incendio: ${parseFloat(node.fire_probability).toFixed(2)}%`);
        });

        // 2. Verificar enlaces con probabilidades
        console.log('\n\n🔗 PROBABILIDADES DE ENLACES\n');
        
        const edgeStats = await client.query(`
            SELECT 
                COUNT(*) as total,
                AVG(total_failure_probability) as avg_prob,
                MIN(total_failure_probability) as min_prob,
                MAX(total_failure_probability) as max_prob
            FROM edge_probabilities
        `);

        const es = edgeStats.rows[0];
        console.log(`Total de enlaces con probabilidades: ${es.total}`);
        console.log(`Probabilidad promedio: ${parseFloat(es.avg_prob).toFixed(2)}%`);
        console.log(`Rango: ${parseFloat(es.min_prob).toFixed(2)}% - ${parseFloat(es.max_prob).toFixed(2)}%`);

        // Top 5 enlaces con mayor riesgo
        console.log('\n🔴 Top 5 enlaces con mayor riesgo:');
        const topEdges = await client.query(`
            SELECT 
                ep.edge_id,
                fl.source,
                fl.target,
                fl.length / 1000.0 as length_km,
                ep.total_failure_probability,
                ep.earthquake_probability,
                ep.landslide_probability
            FROM edge_probabilities ep
            JOIN fiber_links fl ON ep.edge_id = fl.id
            ORDER BY ep.total_failure_probability DESC
            LIMIT 5
        `);

        topEdges.rows.forEach((edge, i) => {
            console.log(`${i + 1}. Enlace ${edge.edge_id} (${edge.source} → ${edge.target})`);
            console.log(`   Longitud: ${parseFloat(edge.length_km).toFixed(2)} km`);
            console.log(`   Total: ${parseFloat(edge.total_failure_probability).toFixed(2)}%`);
            console.log(`   Terremoto: ${parseFloat(edge.earthquake_probability).toFixed(2)}%, Deslizamiento: ${parseFloat(edge.landslide_probability).toFixed(2)}%`);
        });

        // 3. Distribución de riesgos
        console.log('\n\n📊 DISTRIBUCIÓN DE RIESGOS\n');
        
        // Distribución de nodos
        const nodeDistribution = await client.query(`
            SELECT 
                CASE 
                    WHEN total_failure_probability < 20 THEN 'Bajo (<20%)'
                    WHEN total_failure_probability < 30 THEN 'Medio (20-30%)'
                    WHEN total_failure_probability < 40 THEN 'Alto (30-40%)'
                    ELSE 'Muy Alto (>40%)'
                END as risk_category,
                COUNT(*) as count
            FROM node_probabilities
            GROUP BY 
                CASE 
                    WHEN total_failure_probability < 20 THEN 'Bajo (<20%)'
                    WHEN total_failure_probability < 30 THEN 'Medio (20-30%)'
                    WHEN total_failure_probability < 40 THEN 'Alto (30-40%)'
                    ELSE 'Muy Alto (>40%)'
                END
            ORDER BY 
                MIN(CASE 
                    WHEN total_failure_probability < 20 THEN 1
                    WHEN total_failure_probability < 30 THEN 2
                    WHEN total_failure_probability < 40 THEN 3
                    ELSE 4
                END)
        `);

        console.log('Nodos por categoría de riesgo:');
        nodeDistribution.rows.forEach(row => {
            const percentage = (row.count / parseInt(ns.total) * 100).toFixed(1);
            console.log(`  ${row.risk_category}: ${row.count} nodos (${percentage}%)`);
        });
        
        // Distribución de enlaces
        const edgeDistribution = await client.query(`
            SELECT 
                CASE 
                    WHEN total_failure_probability < 20 THEN 'Bajo (<20%)'
                    WHEN total_failure_probability < 35 THEN 'Medio (20-35%)'
                    WHEN total_failure_probability < 50 THEN 'Alto (35-50%)'
                    ELSE 'Muy Alto (>50%)'
                END as risk_category,
                COUNT(*) as count
            FROM edge_probabilities
            GROUP BY 
                CASE 
                    WHEN total_failure_probability < 20 THEN 'Bajo (<20%)'
                    WHEN total_failure_probability < 35 THEN 'Medio (20-35%)'
                    WHEN total_failure_probability < 50 THEN 'Alto (35-50%)'
                    ELSE 'Muy Alto (>50%)'
                END
            ORDER BY 
                MIN(CASE 
                    WHEN total_failure_probability < 20 THEN 1
                    WHEN total_failure_probability < 35 THEN 2
                    WHEN total_failure_probability < 50 THEN 3
                    ELSE 4
                END)
        `);

        console.log('\nEnlaces por categoría de riesgo:');
        edgeDistribution.rows.forEach(row => {
            const percentage = (row.count / parseInt(es.total) * 100).toFixed(1);
            console.log(`  ${row.risk_category}: ${row.count} enlaces (${percentage}%)`);
        });

        // 4. Ejemplo de consulta útil
        console.log('\n\n💡 EJEMPLO DE CONSULTA\n');
        console.log('Consulta SQL para obtener rutas con bajo riesgo:');
        console.log('```sql');
        console.log(`SELECT 
    fl.id,
    fl.source,
    fl.target,
    fl.length / 1000.0 as length_km,
    ep.total_failure_probability,
    fl.cost * (1 + ep.total_failure_probability / 100) as adjusted_cost
FROM fiber_links fl
JOIN edge_probabilities ep ON ep.edge_id = fl.id
WHERE ep.total_failure_probability < 25
ORDER BY adjusted_cost
LIMIT 10;`);
        console.log('```');

    } catch (error) {
        console.error('❌ Error:', error.message);
        throw error;
    } finally {
        client.release();
        await pool.end();
    }

    console.log('\n' + '='.repeat(60));
    console.log('  ✅ VERIFICACIÓN COMPLETADA');
    console.log('='.repeat(60));
}

if (require.main === module) {
    verifyProbabilities().catch(console.error);
}

module.exports = { verifyProbabilities };
