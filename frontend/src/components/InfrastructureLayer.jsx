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
        // Get current map bounds to only load visible edges
        const bounds = map.getBounds();
        const response = await infrastructureAPI.getEdges({
          limit: 500, // Limit for performance
        });
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
        const response = await infrastructureAPI.getNodes({ limit: 200 });
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
        const response = await metadataAPI.getDatacenters();
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
    let color = '#3388ff';
    let weight = 2;

    // Color by road type
    if (highway === 'motorway' || highway === 'trunk') {
      color = '#e74c3c';
      weight = 3;
    } else if (highway === 'primary') {
      color = '#e67e22';
      weight = 2.5;
    } else if (highway === 'secondary') {
      color = '#f39c12';
      weight = 2;
    }

    return {
      color,
      weight,
      opacity: 0.6,
    };
  };

  // Popup content for edges
  const onEachEdge = (feature, layer) => {
    const props = feature.properties;
    const popupContent = `
      <div>
        <h3>Enlace de Fibra Óptica</h3>
        <p><strong>ID:</strong> ${props.id}</p>
        <p><strong>Tipo de vía:</strong> ${props.highway || 'N/A'}</p>
        <p><strong>Nombre:</strong> ${props.name || 'Sin nombre'}</p>
        <p><strong>Longitud:</strong> ${(props.length / 1000).toFixed(2)} km</p>
        <p><strong>Región:</strong> ${props.region || 'N/A'}</p>
        ${props.recubrimiento_estim ? `<p><strong>Recubrimiento:</strong> ${props.recubrimiento_estim}</p>` : ''}
        ${props.surface ? `<p><strong>Superficie:</strong> ${props.surface}</p>` : ''}
      </div>
    `;
    layer.bindPopup(popupContent);
  };

  // Custom icon for datacenters
  const datacenterIcon = new L.Icon({
    iconUrl: 'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIyNCIgaGVpZ2h0PSIyNCIgdmlld0JveD0iMCAwIDI0IDI0IiBmaWxsPSIjMDA3YmZmIj48cGF0aCBkPSJNNCAxOGgydjJINHYtMnptMC00aDJ2Mkg0di0yem0wLTRoMnYySDR2LTJ6bTAtNGgydjJINFY2em0xNiAxMmgydi0yYTIgMiAwIDAgMC0yLTJINlYybDE0IDE0djJ6bS02IDBIOHYtMmg2djJ6bTAgNEg4di0yaDZ2MnptNi00aC0ydjJoMnYtMnoiLz48L3N2Zz4=',
    iconSize: [32, 32],
    iconAnchor: [16, 32],
    popupAnchor: [0, -32],
  });

  return (
    <>
      {loading && <div className="loading-indicator">Cargando infraestructura...</div>}
      {error && <div className="error-indicator">{error}</div>}

      {/* Render edges */}
      {edges && (
        <GeoJSON
          data={edges}
          style={edgeStyle}
          onEachFeature={onEachEdge}
        />
      )}

      {/* Render nodes */}
      {nodes && nodes.features && nodes.features.map((feature, idx) => (
        <Marker
          key={`node-${idx}`}
          position={[
            feature.properties.latitude,
            feature.properties.longitude,
          ]}
        >
          <Popup>
            <div>
              <h3>Nodo</h3>
              <p><strong>ID:</strong> {feature.properties.id}</p>
              <p><strong>Tipo:</strong> {feature.properties.node_type}</p>
              <p><strong>Región:</strong> {feature.properties.region || 'N/A'}</p>
              <p><strong>Ciudad:</strong> {feature.properties.city || 'N/A'}</p>
            </div>
          </Popup>
        </Marker>
      ))}

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
