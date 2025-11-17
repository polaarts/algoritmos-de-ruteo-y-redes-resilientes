/**
 * RegionalFiberLayer.jsx
 * Componente para visualizar enlaces de fibra óptica regionales en el mapa
 * Carga el GeoJSON directamente desde los assets
 */

import { useEffect, useState } from 'react';
import { GeoJSON, useMap } from 'react-leaflet';
import L from 'leaflet';

const RegionalFiberLayer = ({ visible = false }) => {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [stats, setStats] = useState(null);
  const map = useMap();

  // Cargar datos cuando se hace visible por primera vez
  useEffect(() => {
    if (visible && !data && !loading) {
      loadRegionalFiber();
    }
  }, [visible]);

  const loadRegionalFiber = async () => {
    setLoading(true);
    setError(null);

    try {
      // Cargar el GeoJSON desde los assets
      const response = await fetch('/rutas_filtradas_regiones.geojson');

      if (!response.ok) {
        throw new Error(`Error HTTP: ${response.status}`);
      }

      const geojson = await response.json();
      setData(geojson);

      console.log(`✅ Cargados ${geojson.features.length} enlaces de fibra regional`);

      // Calcular estadísticas del GeoJSON
      calculateStats(geojson);

    } catch (err) {
      console.error('Error cargando rutas regionales:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const calculateStats = (geojson) => {
    try {
      const features = geojson.features;
      const regions = [...new Set(features.map(f => f.properties.region))];
      const types = [...new Set(features.map(f => f.properties.type))];
      
      // Calcular longitud total aproximada
      let totalLength = 0;
      features.forEach(feature => {
        if (feature.geometry && feature.geometry.coordinates) {
          const coords = feature.geometry.coordinates;
          for (let i = 0; i < coords.length - 1; i++) {
            const [lon1, lat1] = coords[i];
            const [lon2, lat2] = coords[i + 1];
            const dist = Math.sqrt(Math.pow(lon2 - lon1, 2) + Math.pow(lat2 - lat1, 2)) * 111; // Aproximación en km
            totalLength += dist;
          }
        }
      });

      setStats({
        general: {
          total_routes: features.length,
          total_regions: regions.length,
          total_types: types.length,
          total_km: totalLength.toFixed(2)
        }
      });
      
      console.log('📊 Estadísticas calculadas:', { totalRoutes: features.length, totalKm: totalLength.toFixed(2) });
    } catch (err) {
      console.warn('No se pudieron calcular estadísticas:', err);
    }
  };

  // Recargar datos cuando se mueve el mapa (opcional, puede ser costoso)
  useEffect(() => {
    if (!visible || !data) return;

    const handleMoveEnd = () => {
      // Solo recargar si estamos muy alejados del área cargada
      // Esto es opcional, podrías comentarlo si prefieres cargar una sola vez
      // loadRegionalFiber();
    };

    map.on('moveend', handleMoveEnd);

    return () => {
      map.off('moveend', handleMoveEnd);
    };
  }, [map, visible, data]);

  // Estilo para las líneas de fibra
  const fiberStyle = (feature) => {
    const type = feature.properties.route_type;
    
    // Colores según tipo de ruta
    const colors = {
      local: '#3b82f6',      // Azul
      regional: '#10b981',   // Verde
      national: '#f59e0b'    // Naranja
    };

    return {
      color: colors[type] || '#3b82f6',
      weight: 2,
      opacity: 0.7,
      smoothFactor: 1
    };
  };

  // Interacción: popup al hacer clic
  const onEachFeature = (feature, layer) => {
    const props = feature.properties;
    
    // Crear popup con información
    const popupContent = `
      <div style="font-family: sans-serif; font-size: 12px;">
        <h4 style="margin: 0 0 8px 0; color: #1f2937;">Enlace de Fibra Regional</h4>
        <table style="width: 100%; border-collapse: collapse;">
          <tr>
            <td style="padding: 2px 8px 2px 0; color: #6b7280;"><strong>Región:</strong></td>
            <td style="padding: 2px 0;">${props.region || 'N/A'}</td>
          </tr>
          <tr>
            <td style="padding: 2px 8px 2px 0; color: #6b7280;"><strong>Tipo:</strong></td>
            <td style="padding: 2px 0;">${props.route_type || 'N/A'}</td>
          </tr>
          <tr>
            <td style="padding: 2px 8px 2px 0; color: #6b7280;"><strong>Longitud:</strong></td>
            <td style="padding: 2px 0;">${props.length_km} km</td>
          </tr>
          <tr>
            <td style="padding: 2px 8px 2px 0; color: #6b7280;"><strong>Origen:</strong></td>
            <td style="padding: 2px 0;">Nodo ${props.from_idx}</td>
          </tr>
          <tr>
            <td style="padding: 2px 8px 2px 0; color: #6b7280;"><strong>Destino:</strong></td>
            <td style="padding: 2px 0;">Nodo ${props.to_idx}</td>
          </tr>
          ${props.city ? `
            <tr>
              <td style="padding: 2px 8px 2px 0; color: #6b7280;"><strong>Ciudad:</strong></td>
              <td style="padding: 2px 0;">${props.city}</td>
            </tr>
          ` : ''}
          <tr>
            <td style="padding: 2px 8px 2px 0; color: #6b7280;"><strong>Fuente:</strong></td>
            <td style="padding: 2px 0;">${props.source || 'N/A'}</td>
          </tr>
        </table>
      </div>
    `;

    layer.bindPopup(popupContent, {
      maxWidth: 300
    });

    // Highlight al pasar el mouse
    layer.on({
      mouseover: (e) => {
        const layer = e.target;
        layer.setStyle({
          weight: 4,
          opacity: 1
        });
      },
      mouseout: (e) => {
        const layer = e.target;
        layer.setStyle(fiberStyle(feature));
      }
    });
  };

  // No renderizar nada si no es visible
  if (!visible) {
    return null;
  }

  // Mostrar estado de carga
  if (loading) {
    return (
      <div style={{
        position: 'absolute',
        top: '10px',
        right: '10px',
        zIndex: 1000,
        background: 'white',
        padding: '10px 15px',
        borderRadius: '8px',
        boxShadow: '0 2px 4px rgba(0,0,0,0.2)',
        fontSize: '14px'
      }}>
        🔄 Cargando enlaces de fibra...
      </div>
    );
  }

  // Mostrar error si hay
  if (error) {
    return (
      <div style={{
        position: 'absolute',
        top: '10px',
        right: '10px',
        zIndex: 1000,
        background: '#fee2e2',
        color: '#991b1b',
        padding: '10px 15px',
        borderRadius: '8px',
        boxShadow: '0 2px 4px rgba(0,0,0,0.2)',
        fontSize: '14px'
      }}>
        ❌ Error: {error}
      </div>
    );
  }

  // Renderizar la capa GeoJSON
  return (
    <>
      {data && (
        <GeoJSON
          data={data}
          style={fiberStyle}
          onEachFeature={onEachFeature}
        />
      )}

      {/* Mostrar estadísticas si están disponibles */}
      {stats && (
        <div style={{
          position: 'absolute',
          bottom: '30px',
          left: '10px',
          zIndex: 1000,
          background: 'white',
          padding: '12px 16px',
          borderRadius: '8px',
          boxShadow: '0 2px 4px rgba(0,0,0,0.2)',
          fontSize: '12px',
          minWidth: '200px'
        }}>
          <h4 style={{ margin: '0 0 8px 0', fontSize: '14px', color: '#1f2937' }}>
            📊 Enlaces Regionales
          </h4>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
            <div>
              <span style={{ color: '#6b7280' }}>Total:</span>{' '}
              <strong>{stats.general.total_routes}</strong> enlaces
            </div>
            <div>
              <span style={{ color: '#6b7280' }}>Longitud:</span>{' '}
              <strong>{stats.general.total_km}</strong> km
            </div>
            <div>
              <span style={{ color: '#6b7280' }}>Regiones:</span>{' '}
              <strong>{stats.general.total_regions}</strong>
            </div>
          </div>
          
          {/* Leyenda de colores */}
          <div style={{ marginTop: '12px', paddingTop: '12px', borderTop: '1px solid #e5e7eb' }}>
            <div style={{ fontSize: '11px', marginBottom: '6px', color: '#6b7280' }}>Leyenda:</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', fontSize: '11px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <div style={{ width: '16px', height: '3px', background: '#3b82f6' }}></div>
                <span>Local</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <div style={{ width: '16px', height: '3px', background: '#10b981' }}></div>
                <span>Regional</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <div style={{ width: '16px', height: '3px', background: '#f59e0b' }}></div>
                <span>Nacional</span>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default RegionalFiberLayer;
