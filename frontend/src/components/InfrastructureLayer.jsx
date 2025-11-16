import { useEffect, useState } from 'react';
import { GeoJSON, Marker, Popup, useMap } from 'react-leaflet';
import L from 'leaflet';
import { infrastructureAPI, metadataAPI, probabilitiesAPI } from '../services/api';

function InfrastructureLayer({ showEdges = true, showNodes = false, showDatacenters = true }) {
  const map = useMap();
  const [edges, setEdges] = useState(null);
  const [nodes, setNodes] = useState(null);
  const [datacenters, setDatacenters] = useState(null);
  const [probabilities, setProbabilities] = useState({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  console.log("prob", {probabilities})

  // Load edge probabilities
  useEffect(() => {
    const loadProbabilities = async () => {
      try {
        const response = await probabilitiesAPI.getEdgeProbabilities();
        console.log('Probabilities loaded:', response.data);
        
        // Crear un mapa de edge_id -> probabilidad
        const probMap = {};
        if (response.data && Array.isArray(response.data)) {
          response.data.forEach(item => {
            probMap[item.edge_id] = item;
          });
        }
        setProbabilities(probMap);
      } catch (err) {
        console.error('Error loading probabilities:', err);
        // No es crítico, continuar sin probabilidades
      }
    };

    loadProbabilities();
  }, []);

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
        const response = await infrastructureAPI.getEdges();
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
    const props = feature.properties;
    const highway = props.highway;
    
    let color = '#3388ff'; // Azul por defecto
    let weight = 2;
    let opacity = 0.7;

    // Si tenemos probabilidades en props, colorear según el riesgo
    if (props.total_failure_probability !== null && props.total_failure_probability !== undefined) {
      // Normalizar a escala 0-1 si viene en porcentaje (>= 1)
      const failProb = props.total_failure_probability >= 1 
        ? props.total_failure_probability / 100 
        : props.total_failure_probability;
      
      if (failProb < 0.2) {
        color = '#27ae60'; // Verde - Bajo riesgo
        weight = 2;
      } else if (failProb < 0.5) {
        color = '#f39c12'; // Naranja - Medio riesgo
        weight = 2.5;
      } else if (failProb < 0.8) {
        color = '#e67e22'; // Naranja oscuro - Alto riesgo
        weight = 3;
      } else {
        color = '#e74c3c'; // Rojo - Crítico
        weight = 3.5;
      }
      opacity = 0.8;
    } else {
      // Sin probabilidades, usar color por tipo de vía (estilo anterior)
      if (highway === 'motorway' || highway === 'trunk') {
        color = '#0066cc'; // Azul oscuro
        weight = 3;
      } else if (highway === 'primary') {
        color = '#3388ff'; // Azul
        weight = 2.5;
      } else {
        color = '#95a5a6'; // Gris para desconocido
        weight = 2;
      }
      opacity = 0.6;
    }

    return {
      color,
      weight,
      opacity,
      dashArray: highway ? null : '5, 5', // Línea punteada si no hay tipo de vía
    };
  };

  // Popup content for edges with dynamic loading
  const onEachEdge = (feature, layer) => {
    const props = feature.properties;
    const edgeId = props.id;
    
    // Las probabilidades vienen directamente en props
    // Verificar si tiene al menos una probabilidad definida
    const hasProbability = (
      props.total_failure_probability !== null && props.total_failure_probability !== undefined
    ) || (
      props.earthquake_probability !== null && props.earthquake_probability !== undefined
    ) || (
      props.fire_probability !== null && props.fire_probability !== undefined
    );
    
    console.log(`Edge ${edgeId} - Properties:`, {
      id: props.id,
      hasProbability,
      total_failure_probability: props.total_failure_probability,
      earthquake_probability: props.earthquake_probability,
      fire_probability: props.fire_probability,
      flood_probability: props.flood_probability,
      weather_probability: props.weather_probability,
      landslide_probability: props.landslide_probability,
      allProps: props
    });
    
    // Determinar nivel de riesgo
    let riskLevel = 'Desconocido';
    let riskColor = '#95a5a6'; // Gris por defecto
    
    if (hasProbability && props.total_failure_probability !== null && props.total_failure_probability !== undefined) {
      // Normalizar a escala 0-1 si viene en porcentaje (>= 1)
      const failProb = props.total_failure_probability >= 1 
        ? props.total_failure_probability / 100 
        : props.total_failure_probability;
      
      if (failProb < 0.2) {
        riskLevel = 'Bajo';
        riskColor = '#27ae60'; // Verde
      } else if (failProb < 0.5) {
        riskLevel = 'Medio';
        riskColor = '#f39c12'; // Naranja
      } else if (failProb < 0.8) {
        riskLevel = 'Alto';
        riskColor = '#e67e22'; // Naranja oscuro
      } else {
        riskLevel = 'Crítico';
        riskColor = '#e74c3c'; // Rojo
      }
    }

    // Crear popup con contenido inicial
    const popup = L.popup({ maxWidth: 450, minWidth: 350 });
    
    const renderPopupContent = (detailedData = null) => {
      console.log(`Rendering popup for edge ${edgeId}:`, {
        hasProbability,
        total_failure_probability: props.total_failure_probability,
        detailedData
      });
      
      // Usar datos de props como base
      const breakdown = {
        earthquake: props.earthquake_probability,
        fire: props.fire_probability,
        flood: props.flood_probability,
        weather: props.weather_probability,
        landslide: props.landslide_probability
      };
      
      const adjustments = {
        bridge: props.bridge_factor,
        tunnel: props.tunnel_factor,
        surface_quality: props.surface_quality_factor
      };
      
      // Si hay datos detallados de la API por ID, extraer amenazas cercanas
      const threats = detailedData?.nearby_threats;
      
      return `
        <div style="max-width: 400px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; font-size: 13px;">
          <h3 style="margin: 0 0 12px 0; color: #2c3e50; border-bottom: 2px solid ${riskColor}; padding-bottom: 5px; font-size: 16px;">
            🔗 Enlace de Fibra Óptica #${props.id}
          </h3>
          
          <!-- Información Básica -->
          <div style="margin-bottom: 10px; background: #f8f9fa; padding: 10px; border-radius: 4px; border-left: 3px solid #3498db;">
            <h4 style="margin: 0 0 6px 0; color: #2c3e50; font-size: 13px;">📍 Información Básica</h4>
            ${props.name ? `<p style="margin: 3px 0; font-size: 12px;"><strong>Nombre:</strong> ${props.name}</p>` : ''}
            <p style="margin: 3px 0; font-size: 12px;"><strong>Región:</strong> ${props.region || 'N/A'}</p>
            <p style="margin: 3px 0; font-size: 12px;"><strong>Longitud:</strong> ${(props.length / 1000).toFixed(2)} km</p>
            <p style="margin: 3px 0; font-size: 12px;"><strong>Tipo de vía:</strong> ${props.highway || 'N/A'}</p>
          </div>
          
          <!-- Características de Infraestructura -->
          <div style="margin-bottom: 10px; background: #e8f4f8; padding: 10px; border-radius: 4px; border-left: 3px solid #3498db;">
            <h4 style="margin: 0 0 6px 0; color: #2c3e50; font-size: 13px;">🏗️ Características</h4>
            <p style="margin: 3px 0; font-size: 12px;">
              ${props.bridge ? '🌉 <strong>Contiene puente</strong>' : '✓ Sin puente'}
              ${props.bridge && props.tunnel ? ' | ' : ''}
              ${props.tunnel ? '🚇 <strong>Contiene túnel</strong>' : props.bridge ? '' : ' | ✓ Sin túnel'}
            </p>
            ${props.surface ? `<p style="margin: 3px 0; font-size: 12px;"><strong>Superficie:</strong> ${props.surface}</p>` : ''}
            ${props.recubrimiento_estim ? `<p style="margin: 3px 0; font-size: 12px;"><strong>Recubrimiento:</strong> ${props.recubrimiento_estim}</p>` : ''}
          </div>
          
          ${hasProbability ? `
            <div style="background: #ecf0f1; padding: 10px; border-radius: 5px; margin-bottom: 10px;">
              <h4 style="margin: 0 0 8px 0; color: #34495e; font-size: 14px;">📊 Análisis de Riesgo</h4>
              <p style="margin: 5px 0;">
                <strong>Probabilidad Total de Falla:</strong> 
                <span style="color: ${riskColor}; font-weight: bold; font-size: 14px;">
                  ${props.total_failure_probability >= 1 ? props.total_failure_probability.toFixed(2) : (props.total_failure_probability * 100).toFixed(2)}%
                </span>
              </p>
              <p style="margin: 5px 0;">
                <strong>Nivel de Riesgo:</strong> 
                <span style="background: ${riskColor}; color: white; padding: 2px 8px; border-radius: 3px; font-size: 11px;">
                  ${riskLevel}
                </span>
              </p>
            </div>
            
            <div style="background: #fff3cd; padding: 10px; border-radius: 5px; margin-bottom: 10px; border-left: 3px solid #ffc107;">
              <h4 style="margin: 0 0 8px 0; color: #856404; font-size: 13px;">⚠️ Desglose de Probabilidades</h4>
              <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 5px; font-size: 12px;">
                ${breakdown.earthquake !== null && breakdown.earthquake !== undefined ? `
                  <div style="background: white; padding: 5px; border-radius: 3px;">
                    <strong>🌍 Sismos:</strong><br/>
                    <span style="color: #d9534f;">${breakdown.earthquake >= 1 ? breakdown.earthquake.toFixed(1) : (breakdown.earthquake * 100).toFixed(1)}%</span>
                  </div>
                ` : ''}
                ${breakdown.fire !== null && breakdown.fire !== undefined ? `
                  <div style="background: white; padding: 5px; border-radius: 3px;">
                    <strong>🔥 Incendios:</strong><br/>
                    <span style="color: #f0ad4e;">${breakdown.fire >= 1 ? breakdown.fire.toFixed(1) : (breakdown.fire * 100).toFixed(1)}%</span>
                  </div>
                ` : ''}
                ${breakdown.flood !== null && breakdown.flood !== undefined ? `
                  <div style="background: white; padding: 5px; border-radius: 3px;">
                    <strong>🌊 Inundaciones:</strong><br/>
                    <span style="color: #5bc0de;">${breakdown.flood >= 1 ? breakdown.flood.toFixed(1) : (breakdown.flood * 100).toFixed(1)}%</span>
                  </div>
                ` : ''}
                ${breakdown.weather !== null && breakdown.weather !== undefined ? `
                  <div style="background: white; padding: 5px; border-radius: 3px;">
                    <strong>⛈️ Clima:</strong><br/>
                    <span style="color: #777;">${breakdown.weather >= 1 ? breakdown.weather.toFixed(1) : (breakdown.weather * 100).toFixed(1)}%</span>
                  </div>
                ` : ''}
                ${breakdown.landslide !== null && breakdown.landslide !== undefined ? `
                  <div style="background: white; padding: 5px; border-radius: 3px;">
                    <strong>⛰️ Deslizamientos:</strong><br/>
                    <span style="color: #8b4513;">${breakdown.landslide >= 1 ? breakdown.landslide.toFixed(1) : (breakdown.landslide * 100).toFixed(1)}%</span>
                  </div>
                ` : ''}
              </div>
            </div>
            
            ${adjustments && (adjustments.bridge || adjustments.tunnel || adjustments.surface_quality) ? `
              <div style="background: #d1ecf1; padding: 10px; border-radius: 5px; margin-bottom: 10px; border-left: 3px solid #17a2b8;">
                <h4 style="margin: 0 0 6px 0; color: #0c5460; font-size: 13px;">⚙️ Factores de Ajuste</h4>
                <div style="font-size: 12px; display: grid; grid-template-columns: 1fr 1fr; gap: 5px;">
                  ${adjustments.bridge && adjustments.bridge !== 1 ? `
                    <div style="background: white; padding: 5px; border-radius: 3px;">
                      <strong>🌉 Puente:</strong><br/>
                      <span style="color: ${adjustments.bridge > 1 ? '#d9534f' : '#5cb85c'};">${adjustments.bridge.toFixed(2)}x</span>
                    </div>
                  ` : ''}
                  ${adjustments.tunnel && adjustments.tunnel !== 1 ? `
                    <div style="background: white; padding: 5px; border-radius: 3px;">
                      <strong>🚇 Túnel:</strong><br/>
                      <span style="color: ${adjustments.tunnel > 1 ? '#d9534f' : '#5cb85c'};">${adjustments.tunnel.toFixed(2)}x</span>
                    </div>
                  ` : ''}
                  ${adjustments.surface_quality && adjustments.surface_quality !== 1 ? `
                    <div style="background: white; padding: 5px; border-radius: 3px;">
                      <strong>🛣️ Calidad:</strong><br/>
                      <span style="color: ${adjustments.surface_quality > 1 ? '#d9534f' : '#5cb85c'};">${adjustments.surface_quality.toFixed(2)}x</span>
                    </div>
                  ` : ''}
                </div>
                ${adjustments.bridge === 1 && adjustments.tunnel === 1 && adjustments.surface_quality === 1 ? `
                  <p style="margin: 5px 0 0 0; font-size: 11px; color: #5cb85c; text-align: center;">✓ Sin factores de ajuste aplicados</p>
                ` : ''}
              </div>
            ` : ''}
            
            ${detailedData?.error ? `
              <div style="background: #fff3cd; padding: 8px; border-radius: 5px; margin-bottom: 10px; border-left: 3px solid #ffc107;">
                <p style="margin: 0; color: #856404; font-size: 12px;">⚠️ No se pudo cargar información de amenazas</p>
                ${detailedData.errorMessage ? `<p style="margin: 3px 0 0 0; font-size: 11px; color: #856404;">${detailedData.errorMessage}</p>` : ''}
              </div>
            ` : threats !== undefined ? (threats && threats.length > 0 ? `
              <div style="background: #f8d7da; padding: 10px; border-radius: 5px; margin-bottom: 10px; border-left: 3px solid #dc3545;">
                <h4 style="margin: 0 0 8px 0; color: #721c24; font-size: 13px;">🚨 Amenazas Cercanas (${threats.length})</h4>
                <div style="max-height: 150px; overflow-y: auto; font-size: 11px;">
                  ${threats.slice(0, 10).map(threat => `
                    <div style="background: white; padding: 6px; margin-bottom: 5px; border-radius: 3px;">
                      <strong>${threat.threat_type === 'earthquake' ? '🌍 Sismo' : 
                               threat.threat_type === 'fire' ? '🔥 Incendio' : 
                               threat.threat_type === 'flood' ? '🌊 Inundación' : 
                               threat.threat_type === 'weather' ? '⛈️ Clima' : '⚠️ Amenaza'}</strong>
                      ${threat.magnitude ? ` - Mag: <strong>${threat.magnitude}</strong>` : ''}
                      ${threat.intensity ? ` - Int: ${threat.intensity}` : ''}
                      <br/>
                      📏 Distancia: <strong>${(threat.distance / 1000).toFixed(1)} km</strong>
                      ${threat.recorded_at ? `<br/>📅 ${new Date(threat.recorded_at).toLocaleDateString('es-CL')}` : ''}
                    </div>
                  `).join('')}
                  ${threats.length > 10 ? `<p style="margin: 5px 0; color: #721c24; text-align: center;">... y ${threats.length - 10} más</p>` : ''}
                </div>
              </div>
            ` : `
              <div style="background: #d4edda; padding: 8px; border-radius: 5px; margin-bottom: 10px; border-left: 3px solid #28a745;">
                <p style="margin: 0; color: #155724; font-size: 12px;">✅ Sin amenazas cercanas detectadas</p>
              </div>
            `) : `
              <div style="background: #e7f3ff; padding: 8px; border-radius: 5px; margin-bottom: 10px; border-left: 3px solid #0066cc;">
                <p style="margin: 0; color: #004085; font-size: 12px;">⏳ Cargando información de amenazas...</p>
              </div>
            `}
          ` : `
            <div style="background: #fff3cd; padding: 10px; border-radius: 5px; margin-bottom: 10px; border-left: 3px solid #ffc107;">
              <h4 style="margin: 0 0 5px 0; color: #856404; font-size: 13px;">⚠️ Sin Análisis de Riesgo</h4>
              <p style="margin: 0; color: #856404; font-size: 12px;">
                No hay datos de probabilidad calculados para este enlace.
              </p>
            </div>
          `}
        </div>
      `;
    };

    // Set initial content with data from props
    popup.setContent(renderPopupContent());
    layer.bindPopup(popup);

    // Load detailed data (nearby threats) when popup opens
    layer.on('popupopen', async () => {
      try {
        console.log(`Loading nearby threats for edge ID: ${edgeId}`);
        const response = await probabilitiesAPI.getEdgeProbabilityById(edgeId);
        console.log(`Detailed data for edge ${edgeId}:`, response.data);
        
        // Actualizar el contenido con las amenazas cercanas
        if (response.data) {
          popup.setContent(renderPopupContent(response.data));
        } else {
          console.warn(`No detailed data returned for edge ${edgeId}`);
          // Mostrar sin amenazas si no hay respuesta
          popup.setContent(renderPopupContent({ nearby_threats: [] }));
        }
      } catch (err) {
        console.error(`Error loading detailed data for edge ${edgeId}:`, err);
        // Mostrar error en lugar del mensaje de carga
        const errorData = { 
          nearby_threats: null,
          error: true,
          errorMessage: err.message || 'Error al cargar amenazas'
        };
        popup.setContent(renderPopupContent(errorData));
      }
    });
  };

  // Custom icons
  const datacenterIcon = new L.Icon({
    iconUrl: 'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSI0MCIgaGVpZ2h0PSI0MCIgdmlld0JveD0iMCAwIDQwIDQwIj48ZGVmcz48bGluZWFyR3JhZGllbnQgaWQ9ImRjR3JhZCIgeDE9IjAlIiB5MT0iMCUiIHgyPSIwJSIgeTI9IjEwMCUiPjxzdG9wIG9mZnNldD0iMCUiIHN0eWxlPSJzdG9wLWNvbG9yOiMwMDg4ZmY7c3RvcC1vcGFjaXR5OjEiIC8+PHN0b3Agb2Zmc2V0PSIxMDAlIiBzdHlsZT0ic3RvcC1jb2xvcjojMDA1NWFhO3N0b3Atb3BhY2l0eToxIiAvPjwvbGluZWFyR3JhZGllbnQ+PC9kZWZzPjwhLS0gQnVpbGRpbmcgLS0+PHJlY3QgeD0iOCIgeT0iNiIgd2lkdGg9IjI0IiBoZWlnaHQ9IjMwIiBmaWxsPSJ1cmwoI2RjR3JhZCkiIHN0cm9rZT0iIzAwMzM2NiIgc3Ryb2tlLXdpZHRoPSIyIiByeD0iMiIvPjwhLS0gU2VydmVyIHJhY2tzIC0tPjxyZWN0IHg9IjExIiB5PSI5IiB3aWR0aD0iMTgiIGhlaWdodD0iNCIgZmlsbD0iIzMzY2NmZiIgc3Ryb2tlPSIjMDA1NWFhIiBzdHJva2Utd2lkdGg9IjEiIHJ4PSIxIi8+PHJlY3QgeD0iMTEiIHk9IjE0IiB3aWR0aD0iMTgiIGhlaWdodD0iNCIgZmlsbD0iIzMzY2NmZiIgc3Ryb2tlPSIjMDA1NWFhIiBzdHJva2Utd2lkdGg9IjEiIHJ4PSIxIi8+PHJlY3QgeD0iMTEiIHk9IjE5IiB3aWR0aD0iMTgiIGhlaWdodD0iNCIgZmlsbD0iIzMzY2NmZiIgc3Ryb2tlPSIjMDA1NWFhIiBzdHJva2Utd2lkdGg9IjEiIHJ4PSIxIi8+PHJlY3QgeD0iMTEiIHk9IjI0IiB3aWR0aD0iMTgiIGhlaWdodD0iNCIgZmlsbD0iIzMzY2NmZiIgc3Ryb2tlPSIjMDA1NWFhIiBzdHJva2Utd2lkdGg9IjEiIHJ4PSIxIi8+PHJlY3QgeD0iMTEiIHk9IjI5IiB3aWR0aD0iMTgiIGhlaWdodD0iNCIgZmlsbD0iIzMzY2NmZiIgc3Ryb2tlPSIjMDA1NWFhIiBzdHJva2Utd2lkdGg9IjEiIHJ4PSIxIi8+PCEtLSBMRUQgaW5kaWNhdG9ycyAtLT48Y2lyY2xlIGN4PSIxMyIgY3k9IjExIiByPSIxIiBmaWxsPSIjMDBmZjAwIi8+PGNpcmNsZSBjeD0iMTMiIGN5PSIxNiIgcj0iMSIgZmlsbD0iIzAwZmYwMCIvPjxjaXJjbGUgY3g9IjEzIiBjeT0iMjEiIHI9IjEiIGZpbGw9IiMwMGZmMDAiLz48Y2lyY2xlIGN4PSIxMyIgY3k9IjI2IiByPSIxIiBmaWxsPSIjMDBmZjAwIi8+PGNpcmNsZSBjeD0iMTMiIGN5PSIzMSIgcj0iMSIgZmlsbD0iIzAwZmYwMCIvPjwhLS0gRG9vcnMgLS0+PHJlY3QgeD0iMTciIHk9IjMyIiB3aWR0aD0iNiIgaGVpZ2h0PSI0IiBmaWxsPSIjNjY5OWNjIiBzdHJva2U9IiMwMDMzNjYiIHN0cm9rZS13aWR0aD0iMSIvPjwvc3ZnPg==',
    iconSize: [40, 40],
    iconAnchor: [20, 40],
    popupAnchor: [0, -40],
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
