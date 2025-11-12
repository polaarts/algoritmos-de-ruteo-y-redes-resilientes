const { query } = require('./config/database');

async function testNodes() {
  try {
    // Temuco: approximately -38.7359, -72.5904
    // Concepción: approximately -36.8201, -73.0444
    
    console.log('\n🔍 Searching for nodes near Temuco (-38.7359, -72.5904)');
    const temucoNodes = await query(`
      SELECT 
        id, name, city, latitude, longitude,
        ST_Distance(
          geometry::geography,
          ST_SetSRID(ST_MakePoint($1, $2), 4326)::geography
        ) / 1000 as distance_km
      FROM fiber_nodes
      ORDER BY geometry <-> ST_SetSRID(ST_MakePoint($1, $2), 4326)
      LIMIT 5
    `, [-72.5904, -38.7359]);
    
    console.log('Nearest nodes to Temuco:');
    temucoNodes.rows.forEach(n => {
      console.log(`  - Node ${n.id}: ${n.name || n.city} at (${n.latitude}, ${n.longitude}) - ${Math.round(n.distance_km)}km away`);
    });
    
    console.log('\n🔍 Searching for nodes near Concepción (-36.8201, -73.0444)');
    const concepcionNodes = await query(`
      SELECT 
        id, name, city, latitude, longitude,
        ST_Distance(
          geometry::geography,
          ST_SetSRID(ST_MakePoint($1, $2), 4326)::geography
        ) / 1000 as distance_km
      FROM fiber_nodes
      ORDER BY geometry <-> ST_SetSRID(ST_MakePoint($1, $2), 4326)
      LIMIT 5
    `, [-73.0444, -36.8201]);
    
    console.log('Nearest nodes to Concepción:');
    concepcionNodes.rows.forEach(n => {
      console.log(`  - Node ${n.id}: ${n.name || n.city} at (${n.latitude}, ${n.longitude}) - ${Math.round(n.distance_km)}km away`);
    });
    
    // Now try to find a route
    if (temucoNodes.rows.length > 0 && concepcionNodes.rows.length > 0) {
      const startNode = concepcionNodes.rows[0].id;
      const endNode = temucoNodes.rows[0].id;
      
      console.log(`\n🛣️  Testing route from node ${startNode} (near Concepción) to node ${endNode} (near Temuco)`);
      
      const route = await query(`
        SELECT COUNT(*) as segments
        FROM pgr_dijkstra(
          'SELECT id, source, target, cost, reverse_cost FROM fiber_links WHERE cost > 0',
          $1::bigint,
          $2::bigint,
          false
        )
      `, [startNode, endNode]);
      
      console.log(`Route has ${route.rows[0].segments} segments`);
      
      if (route.rows[0].segments > 1) {
        console.log('✅ Route exists!');
      } else {
        console.log('❌ No route found');
      }
    }
    
    process.exit(0);
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

testNodes();
