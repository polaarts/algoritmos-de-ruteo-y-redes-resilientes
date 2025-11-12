const fs = require('fs').promises;
const path = require('path');

/**
 * Adapta los datos de metadata al formato de la base de datos
 */

async function adaptarDatosMetadata() {
    console.log('📊 Adaptando datos de metadata para Supabase...\n');

    // Leer el archivo de metadata integrada
    const metadataPath = path.join(__dirname, 'metadata_infraestructura_final.json');
    let metadata;
    
    try {
        const contenido = await fs.readFile(metadataPath, 'utf-8');
        metadata = JSON.parse(contenido);
    } catch (error) {
        console.error('❌ Error al leer metadata_infraestructura_final.json:', error.message);
        return null;
    }

    const resultado = {
        ground_type: [],
        fiber_links: [],
        infrastructure_metadata: []
    };

    // ============================================================================
    // ADAPTAR USO DE SUELO → ground_type
    // ============================================================================
    if (metadata.uso_suelo && metadata.uso_suelo.elements) {
        console.log(`▶ Procesando ${metadata.uso_suelo.elements.length} áreas de uso de suelo...`);
        
        const landuseTags = metadata.uso_suelo.elements.filter(e => e.tags && e.tags.landuse);
        
        resultado.ground_type = landuseTags.map(area => {
            const landuse = area.tags.landuse;
            
            // Mapear landuse a soil_type y stability
            let soilType = 'mixed';
            let stability = 'moderate';
            let installationDifficulty = 'moderate';
            let permeability = 'medium';
            
            // Clasificación según tipo de uso de suelo
            switch (landuse) {
                case 'residential':
                case 'commercial':
                case 'retail':
                    soilType = 'urban_developed';
                    stability = 'stable';
                    installationDifficulty = 'moderate';
                    permeability = 'low';
                    break;
                case 'industrial':
                    soilType = 'compacted';
                    stability = 'stable';
                    installationDifficulty = 'difficult';
                    permeability = 'low';
                    break;
                case 'forest':
                case 'wood':
                    soilType = 'organic';
                    stability = 'moderate';
                    installationDifficulty = 'moderate';
                    permeability = 'high';
                    break;
                case 'farmland':
                case 'meadow':
                case 'grass':
                    soilType = 'agricultural';
                    stability = 'moderate';
                    installationDifficulty = 'easy';
                    permeability = 'medium';
                    break;
                case 'quarry':
                case 'construction':
                    soilType = 'rock';
                    stability = 'stable';
                    installationDifficulty = 'very_difficult';
                    permeability = 'low';
                    break;
                case 'wetland':
                case 'basin':
                    soilType = 'saturated';
                    stability = 'unstable';
                    installationDifficulty = 'very_difficult';
                    permeability = 'high';
                    break;
                default:
                    soilType = 'mixed';
                    stability = 'moderate';
                    installationDifficulty = 'moderate';
                    permeability = 'medium';
            }
            
            return {
                osm_id: area.id,
                soil_type: soilType,
                stability: stability,
                installation_difficulty: installationDifficulty,
                permeability: permeability,
                bearing_capacity: stability === 'stable' ? 2.5 : 
                                  stability === 'unstable' ? 0.8 : 1.5,
                metadata: {
                    landuse_original: landuse,
                    name: area.tags.name || null,
                    other_tags: area.tags
                },
                // Usar centro si existe, sino null (se puede calcular después)
                geometry: area.center ? {
                    type: 'Point',
                    coordinates: [area.center.lon, area.center.lat]
                } : null
            };
        });
        
        console.log(`✓ ${resultado.ground_type.length} áreas de tipo de suelo adaptadas`);
    }

    // ============================================================================
    // ADAPTAR VÍAS → fiber_links (metadata)
    // ============================================================================
    if (metadata.infraestructura && metadata.infraestructura.elements) {
        console.log(`\n▶ Procesando ${metadata.infraestructura.elements.length} vías...`);
        
        const ways = metadata.infraestructura.elements.filter(e => 
            e.type === 'way' && e.tags && e.tags.highway
        );
        
        resultado.fiber_links = ways.map(via => {
            const tags = via.tags;
            
            // Calcular longitud aproximada (si no existe)
            // En producción, calcularías esto desde la geometría real
            const estimatedLength = 100; // metros por defecto
            
            return {
                osm_id: via.id.toString(),
                highway: tags.highway,
                name: tags.name || null,
                surface: tags.surface || 'unknown',
                lanes: tags.lanes ? parseInt(tags.lanes) : null,
                maxspeed: tags.maxspeed || null,
                oneway: tags.oneway === 'yes' || tags.oneway === 'true',
                bridge: tags.bridge === 'yes',
                tunnel: tags.tunnel === 'yes',
                length: estimatedLength,
                source_type: 'osm',
                link_type: tags.highway.includes('motorway') || tags.highway.includes('trunk') ? 
                           'national' : 
                           tags.highway.includes('primary') || tags.highway.includes('secondary') ? 
                           'regional' : 'local',
                metadata: {
                    ref: tags.ref || null,
                    official_name: tags.official_name || null,
                    lit: tags.lit || null,
                    all_tags: tags
                },
                // Geometría se puede obtener de center o calcular después
                geometry: via.center ? {
                    type: 'Point',
                    coordinates: [via.center.lon, via.center.lat]
                } : null
            };
        });
        
        console.log(`✓ ${resultado.fiber_links.length} vías adaptadas`);
    }

    // ============================================================================
    // ADAPTAR RECUBRIMIENTO
    // ============================================================================
    if (metadata.recubrimiento_estimado && metadata.recubrimiento_estimado.features) {
        console.log(`\n▶ Procesando ${metadata.recubrimiento_estimado.features.length} vías con recubrimiento...`);
        
        resultado.infrastructure_metadata = metadata.recubrimiento_estimado.features.map(feature => ({
            osm_id: feature.id,
            highway: feature.properties.highway,
            name: feature.properties.name || null,
            recubrimiento_estim: feature.properties.recubrimiento_estim,
            surface: feature.properties.surface || null,
            properties: feature.properties,
            geometry: feature.geometry
        }));
        
        console.log(`✓ ${resultado.infrastructure_metadata.length} vías con recubrimiento procesadas`);
    }

    // Guardar datos adaptados
    const salidaPath = path.join(__dirname, 'metadata_para_supabase.json');
    await fs.writeFile(
        salidaPath,
        JSON.stringify(resultado, null, 2),
        'utf-8'
    );

    console.log(`\n✅ Datos adaptados guardados en: metadata_para_supabase.json`);
    console.log(`\nResumen:`);
    console.log(`  - Tipos de suelo (ground_type): ${resultado.ground_type.length}`);
    console.log(`  - Vías para enlaces (fiber_links): ${resultado.fiber_links.length}`);
    console.log(`  - Metadata de infraestructura: ${resultado.infrastructure_metadata.length}`);

    return resultado;
}

// Ejecutar si se llama directamente
if (require.main === module) {
    adaptarDatosMetadata().catch(console.error);
}

module.exports = { adaptarDatosMetadata };
