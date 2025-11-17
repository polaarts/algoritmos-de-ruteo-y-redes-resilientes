import { useEffect } from 'react';
import { GeoJSON } from 'react-leaflet';

/**
 * SimulationLayer Component
 * Visualiza las fallas simuladas en el mapa
 */
function SimulationLayer({ simulationData, showFailuresOnly = false }) {
  useEffect(() => {
    if (simulationData) {
      console.log('SimulationLayer - Rendering failures:', simulationData);
    }
  }, [simulationData]);

  if (!simulationData || !simulationData.failures) {
    return null;
  }

  // Filtrar solo fallas si showFailuresOnly está activado
  const failuresToShow = showFailuresOnly 
    ? {
        ...simulationData.failures,
        features: simulationData.failures.features.filter(f => f.properties.failed)
      }
    : simulationData.failures;

  // Estilo para elementos fallidos
  const getFailureStyle = (feature) => {
    const elementType = feature.properties.element_type;
    const dominantThreat = feature.properties.dominant_threat;
    
    // Color según la amenaza dominante
    const threatColors = {
      earthquake: '#8b0000',  // Rojo oscuro
      fire: '#ff4500',        // Naranja rojizo
      flood: '#1e90ff',       // Azul
      weather: '#4682b4',     // Azul acero
      landslide: '#8b4513'    // Marrón
    };

    const color = threatColors[dominantThreat] || '#ff0000';

    if (elementType === 'edge') {
      return {
        color: color,
        weight: 6,
        opacity: 0.9,
        dashArray: '10, 5',
      };
    } else {
      // Para nodos (se mostrarán como puntos)
      return {
        color: color,
        fillColor: color,
        fillOpacity: 0.8,
        radius: 8,
        weight: 2,
      };
    }
  };

  // Popup para elementos fallidos
  const onEachFailure = (feature, layer) => {
    const props = feature.properties;
    
    const threatIcons = {
      earthquake: '🌍',
      fire: '🔥',
      flood: '🌊',
      weather: '⛈️',
      landslide: '⛰️'
    };

    const threatNames = {
      earthquake: 'Terremoto',
      fire: 'Incendio',
      flood: 'Inundación',
      weather: 'Clima Extremo',
      landslide: 'Deslizamiento'
    };

    const icon = threatIcons[props.dominant_threat] || '⚠️';
    const threatName = threatNames[props.dominant_threat] || 'Desconocida';

    const popupContent = `
      <div style="max-width: 300px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;">
        <h3 style="margin: 0 0 10px 0; color: #c0392b; border-bottom: 2px solid #e74c3c; padding-bottom: 5px;">
          ${icon} Elemento Fallido
        </h3>
        
        <div style="background: #ffe6e6; padding: 8px; border-radius: 4px; margin-bottom: 8px;">
          <p style="margin: 3px 0; font-size: 13px;">
            <strong>Tipo:</strong> ${props.element_type === 'edge' ? 'Enlace' : 'Nodo'}
          </p>
          <p style="margin: 3px 0; font-size: 13px;">
            <strong>ID:</strong> ${props.element_id}
          </p>
        </div>

        <div style="background: #fff3cd; padding: 8px; border-radius: 4px; margin-bottom: 8px;">
          <p style="margin: 3px 0; font-size: 13px;">
            <strong>Amenaza Dominante:</strong> ${icon} ${threatName}
          </p>
          <p style="margin: 3px 0; font-size: 13px;">
            <strong>Probabilidad de falla:</strong> 
            <span style="color: #d9534f; font-weight: bold;">
              ${(props.probability).toFixed(2)}%
            </span>
          </p>
        </div>

        <div style="background: #f8f9fa; padding: 8px; border-radius: 4px;">
          <p style="margin: 3px 0; font-size: 12px;">
            <strong>Valor aleatorio generado:</strong> ${props.random_value.toFixed(2)}
          </p>
          <p style="margin: 3px 0; font-size: 11px; color: #666;">
            ${props.random_value < props.probability 
              ? '✗ Random < Probabilidad → FALLA' 
              : '✓ Random >= Probabilidad → OK'}
          </p>
        </div>

        ${props.element_type === 'edge' ? `
          <div style="margin-top: 8px; font-size: 11px; color: #666;">
            <p style="margin: 3px 0;">Origen: ${props.source}</p>
            <p style="margin: 3px 0;">Destino: ${props.target}</p>
            <p style="margin: 3px 0;">Longitud: ${(props.length / 1000).toFixed(2)} km</p>
          </div>
        ` : props.region ? `
          <div style="margin-top: 8px; font-size: 11px; color: #666;">
            ${props.region ? `<p style="margin: 3px 0;">Región: ${props.region}</p>` : ''}
            ${props.city ? `<p style="margin: 3px 0;">Ciudad: ${props.city}</p>` : ''}
          </div>
        ` : ''}
      </div>
    `;

    layer.bindPopup(popupContent);
  };

  // Separar nodos y enlaces para renderizado diferente
  const edgeFailures = {
    type: 'FeatureCollection',
    features: failuresToShow.features.filter(f => f.properties.element_type === 'edge')
  };

  const nodeFailures = {
    type: 'FeatureCollection',
    features: failuresToShow.features.filter(f => f.properties.element_type === 'node')
  };

  return (
    <>
      {/* Render edge failures */}
      {edgeFailures.features.length > 0 && (
        <GeoJSON
          key={`edge-failures-${simulationData.simulation.timestamp}`}
          data={edgeFailures}
          style={getFailureStyle}
          onEachFeature={onEachFailure}
        />
      )}

      {/* Render node failures */}
      {nodeFailures.features.length > 0 && (
        <GeoJSON
          key={`node-failures-${simulationData.simulation.timestamp}`}
          data={nodeFailures}
          pointToLayer={(feature, latlng) => {
            const L = window.L;
            return L.circleMarker(latlng, getFailureStyle(feature));
          }}
          onEachFeature={onEachFailure}
        />
      )}
    </>
  );
}

export default SimulationLayer;
