import { useEffect, useState } from 'react';
import { GeoJSON, Marker, Popup, useMap } from 'react-leaflet';
import L from 'leaflet';
import { infrastructureAPI, metadataAPI } from '../services/api';

function InfrastructureLayer({ showEdges = true, showNodes = false, showDatacenters = true }) {
  const map = useMap();
  const [edges, setEdges] = useState(null);
  const [nodes, setNodes] = useState(null);
  const [datacenters, setDatacenters] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // Load edges
  useEffect(() => {
    if (!showEdges) {
      setEdges(null);
      return;
    }

    const loadEdges = async () => {
      setLoading(true);
      setError(null);
      try {
        const response = await infrastructureAPI.getEdges({
          limit: 1000, // Limit for performance
        });
        console.log('Edges loaded:', response.data);
        setEdges(response.data);
      } catch (err) {
        console.error('Error loading edges:', err);
        setError('Failed to load edges');
      } finally {
        setLoading(false);
      }
    };

    loadEdges();
  }, [showEdges, map]);

  // Load nodes
  useEffect(() => {
    if (!showNodes) {
      setNodes(null);
      return;
    }

    const loadNodes = async () => {
      try {
        const response = await infrastructureAPI.getNodes({ limit: 500 });
        console.log('Nodes loaded:', response.data);
        setNodes(response.data);
      } catch (err) {
        console.error('Error loading nodes:', err);
      }
    };

    loadNodes();
  }, [showNodes]);

  // Load datacenters
  useEffect(() => {
    if (!showDatacenters) {
      setDatacenters(null);
      return;
    }

    const loadDatacenters = async () => {
      try {
        const response = await metadataAPI.getDatacenters({ limit: 100 });
        console.log('Datacenters loaded:', response.data);
        setDatacenters(response.data);
      } catch (err) {
        console.error('Error loading datacenters:', err);
      }
    };

    loadDatacenters();
  }, [showDatacenters]);

  // Style for edges
  const edgeStyle = (feature) => {
    const highway = feature.properties.highway;
    const region = feature.properties.region;
    let color = '#0066cc'; // Azul por defecto
    let weight = 2;

    // Color por tipo de vía
    if (highway === 'motorway' || highway === 'trunk') {
      color = '#e74c3c'; // Rojo para autopistas
      weight = 4;
    } else if (highway === 'primary') {
      color = '#e67e22'; // Naranja para primarias
      weight = 3;
    } else if (highway === 'secondary') {
      color = '#f39c12'; // Amarillo para secundarias
      weight = 2.5;
    } else {
      // Color por región si no hay tipo de vía
      if (region && region.includes('METROPOLITANA')) {
        color = '#3498db'; // Azul claro
      } else if (region && region.includes('VALPARAÍSO')) {
        color = '#9b59b6'; // Púrpura
      } else if (region && region.includes('BIOBÍO')) {
        color = '#1abc9c'; // Verde agua
      }
    }

    return {
      color,
      weight,
      opacity: 0.7,
      dashArray: highway ? null : '5, 5', // Línea punteada si no hay tipo de vía
    };
  };

  // Popup content for edges
  const onEachEdge = (feature, layer) => {
    const props = feature.properties;
    const popupContent = `
      <div style="max-width: 250px;">
        <h3 style="margin: 0 0 10px 0; color: #2c3e50;">Enlace de Fibra Óptica</h3>
        <p style="margin: 5px 0;"><strong>ID:</strong> ${props.id}</p>
        <p style="margin: 5px 0;"><strong>Tipo de vía:</strong> ${props.highway || 'N/A'}</p>
        <p style="margin: 5px 0;"><strong>Nombre:</strong> ${props.name || 'Sin nombre'}</p>
        <p style="margin: 5px 0;"><strong>Longitud:</strong> ${(props.length / 1000).toFixed(2)} km</p>
        <p style="margin: 5px 0;"><strong>Región:</strong> ${props.region || 'N/A'}</p>
        ${props.recubrimiento_estim ? `<p style="margin: 5px 0;"><strong>Recubrimiento:</strong> ${props.recubrimiento_estim}</p>` : ''}
        ${props.surface ? `<p style="margin: 5px 0;"><strong>Superficie:</strong> ${props.surface}</p>` : ''}
        ${props.cost ? `<p style="margin: 5px 0;"><strong>Costo:</strong> ${props.cost.toFixed(2)}m</p>` : ''}
      </div>
    `;
    layer.bindPopup(popupContent);
  };

  // Custom icons
  const datacenterIcon = new L.Icon({
    iconUrl: 'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIyNCIgaGVpZ2h0PSIyNCIgdmlld0JveD0iMCAwIDI0IDI0IiBmaWxsPSIjMDA3YmZmIj48cGF0aCBkPSJNNCAxOGgydjJINHYtMnptMC00aDJ2Mkg0di0yem0wLTRoMnYySDR2LTJ6bTAtNGgydjJINFY2em0xNiAxMmgydi0yYTIgMiAwIDAgMC0yLTJINlYybDE0IDE0djJ6bS02IDBIOHYtMmg2djJ6bTAgNEg4di0yaDZ2MnptNi00aC0ydjJoMnYtMnoiLz48L3N2Zz4=',
    iconSize: [32, 32],
    iconAnchor: [16, 32],
    popupAnchor: [0, -32],
  });

  // Icon for intersection nodes
  const nodeIcon = new L.Icon({
    iconUrl: 'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIxNiIgaGVpZ2h0PSIxNiIgdmlld0JveD0iMCAwIDE2IDE2Ij48Y2lyY2xlIGN4PSI4IiBjeT0iOCIgcj0iNiIgZmlsbD0iI2ZmZiIgc3Ryb2tlPSIjMzMzIiBzdHJva2Utd2lkdGg9IjIiLz48Y2lyY2xlIGN4PSI4IiBjeT0iOCIgcj0iMyIgZmlsbD0iIzMzOGFmZiIvPjwvc3ZnPg==',
    iconSize: [16, 16],
    iconAnchor: [8, 8],
    popupAnchor: [0, -8],
  });

  // Get icon based on node type
  const getNodeIcon = (nodeType) => {
    if (nodeType === 'datacenter') {
      return datacenterIcon;
    }
    return nodeIcon;
  };

  return (
    <>
      {loading && <div className="loading-indicator">Cargando infraestructura...</div>}
      {error && <div className="error-indicator">{error}</div>}

      {/* Render edges */}
      {edges && edges.features && edges.features.length > 0 && (
        <GeoJSON
          key={`edges-${edges.features.length}`}
          data={edges}
          style={edgeStyle}
          onEachFeature={onEachEdge}
          coordsToLatLng={(coords) => {
            // GeoJSON usa [longitud, latitud], Leaflet usa [latitud, longitud]
            return [coords[1], coords[0]];
          }}
        />
      )}

      {/* Render nodes */}
      {nodes && nodes.features && nodes.features.map((feature, idx) => {
        // Las coordenadas en GeoJSON son [longitud, latitud]
        // Pero Leaflet espera [latitud, longitud]
        const coords = feature.geometry.coordinates;
        const position = [coords[1], coords[0]]; // Invertir para Leaflet
        
        return (
          <Marker
            key={`node-${feature.properties.id || idx}`}
            position={position}
            icon={getNodeIcon(feature.properties.node_type)}
          >
            <Popup>
              <div style="max-width: 250px;">
                <h3 style="margin: 0 0 10px 0; color: #2c3e50;">Nodo de Red</h3>
                <p style="margin: 5px 0;"><strong>ID:</strong> {feature.properties.id}</p>
                <p style="margin: 5px 0;"><strong>Tipo:</strong> {feature.properties.node_type}</p>
                <p style="margin: 5px 0;"><strong>Región:</strong> {feature.properties.region || 'N/A'}</p>
                <p style="margin: 5px 0;"><strong>Ciudad:</strong> {feature.properties.city || 'N/A'}</p>
                {feature.properties.elevation && (
                  <p style="margin: 5px 0;"><strong>Elevación:</strong> {feature.properties.elevation}m</p>
                )}
              </div>
            </Popup>
          </Marker>
        );
      })}

      {/* Render datacenters */}
      {datacenters && datacenters.features && datacenters.features.map((feature, idx) => {
        const coords = feature.geometry.coordinates;
        return (
          <Marker
            key={`dc-${idx}`}
            position={[coords[1], coords[0]]}
            icon={datacenterIcon}
          >
            <Popup>
              <div>
                <h3>Datacenter</h3>
                <p><strong>Nombre:</strong> {feature.properties.name}</p>
                <p><strong>Compañía:</strong> {feature.properties.company_name || 'N/A'}</p>
                <p><strong>Ciudad:</strong> {feature.properties.city}</p>
                <p><strong>Región:</strong> {feature.properties.state}</p>
                {feature.properties.tier_level && (
                  <p><strong>Tier Level:</strong> {feature.properties.tier_level}</p>
                )}
                {feature.properties.capacity_mw && (
                  <p><strong>Capacidad:</strong> {feature.properties.capacity_mw} MW</p>
                )}
              </div>
            </Popup>
          </Marker>
        );
      })}
    </>
  );
}

export default InfrastructureLayer;
