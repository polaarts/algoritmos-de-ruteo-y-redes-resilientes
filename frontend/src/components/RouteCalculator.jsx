import { useState, useEffect } from 'react';
import { GeoJSON, Marker, Popup, useMap } from 'react-leaflet';
import L from 'leaflet';
import { routingAPI } from '../services/api';

function RouteCalculator({ showRoute = false, onRouteCalculated }) {
  const map = useMap();
  const [route, setRoute] = useState(null);
  const [routeInfo, setRouteInfo] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [startPoint, setStartPoint] = useState(null);
  const [endPoint, setEndPoint] = useState(null);
  const [isSelectingPoints, setIsSelectingPoints] = useState(false);
  const [restrictions, setRestrictions] = useState({
    maxDistance: null,
    maxFailureProb: 0.5,
    riskWeight: 2.0,
    avoidHighRisk: true,
  });
  const [showRestrictions, setShowRestrictions] = useState(false);

  // Load example route on mount
  useEffect(() => {
    if (showRoute && !route) {
      loadExampleRoute();
    }
  }, [showRoute]);

  const loadExampleRoute = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await routingAPI.getExampleRoute();
      setRoute(response.data);
      setRouteInfo(response.data.route_info);

      // Set start and end points from route info
      if (response.data.route_info) {
        setStartPoint(response.data.route_info.start);
        setEndPoint(response.data.route_info.end);
      }

      if (onRouteCalculated) {
        onRouteCalculated(response.data);
      }
    } catch (err) {
      console.error('Error loading example route:', err);
      setError('No se pudo cargar la ruta de ejemplo. Verifica que la base de datos tenga datos.');
    } finally {
      setLoading(false);
    }
  };

  const calculateRoute = async (startLat, startLon, endLat, endLon) => {
    console.log('🔵 [FRONTEND RouteCalculator] Calculating route:', { startLat, startLon, endLat, endLon });
    setLoading(true);
    setError(null);
    try {
      const response = await routingAPI.calculateRoute(startLat, startLon, endLat, endLon);
      console.log('✅ [FRONTEND RouteCalculator] Route received:', response.data);
      setRoute(response.data);
      setRouteInfo(response.data.route_info);

      // Update start and end points
      setStartPoint({ lat: startLat, lon: startLon });
      setEndPoint({ lat: endLat, lon: endLon });

      if (onRouteCalculated) {
        onRouteCalculated(response.data);
      }

      // Fit map to route bounds
      if (response.data.features && response.data.features.length > 0) {
        const bounds = L.geoJSON(response.data).getBounds();
        map.fitBounds(bounds, { padding: [50, 50] });
      }
    } catch (err) {
      console.error('❌ [FRONTEND RouteCalculator] Error calculating route:', err);
      setError('No se pudo calcular la ruta. Verifica que los puntos estén conectados.');
    } finally {
      setLoading(false);
    }
  };

  // Enable point selection on map click
  const enablePointSelection = () => {
    setIsSelectingPoints(true);
    setStartPoint(null);
    setEndPoint(null);
    setRoute(null);
    setRouteInfo(null);

    const onMapClick = (e) => {
      if (!startPoint) {
        setStartPoint({ lat: e.latlng.lat, lon: e.latlng.lng });
      } else if (!endPoint) {
        setEndPoint({ lat: e.latlng.lat, lon: e.latlng.lng });
        // Calculate route automatically when both points are selected
        calculateRoute(startPoint.lat, startPoint.lon, e.latlng.lat, e.latlng.lng);
        setIsSelectingPoints(false);
        map.off('click', onMapClick);
      }
    };

    map.on('click', onMapClick);
  };

  // Use current location from GPS
  const useCurrentLocation = () => {
    if (!navigator.geolocation) {
      alert('Tu navegador no soporta geolocalización. Por favor selecciona manualmente.');
      return;
    }

    setError(null);
    setLoading(true);

    navigator.geolocation.getCurrentPosition(
      (position) => {
        const { latitude, longitude } = position.coords;
        setStartPoint({ lat: latitude, lon: longitude, name: 'Mi Ubicación' });
        setLoading(false);

        // Center map on user location
        map.setView([latitude, longitude], 13);
      },
      (error) => {
        setLoading(false);
        let errorMessage = 'No se pudo obtener tu ubicación. ';

        switch (error.code) {
          case error.PERMISSION_DENIED:
            errorMessage += 'Debes permitir el acceso a tu ubicación.';
            break;
          case error.POSITION_UNAVAILABLE:
            errorMessage += 'La ubicación no está disponible.';
            break;
          case error.TIMEOUT:
            errorMessage += 'Tiempo de espera agotado.';
            break;
          default:
            errorMessage += 'Error desconocido.';
        }

        errorMessage += ' Por favor selecciona manualmente en el mapa.';
        setError(errorMessage);
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 0,
      }
    );
  };

  // Style for route
  const routeStyle = {
    color: '#00ff00',
    weight: 4,
    opacity: 0.8,
  };

  // Popup for route segments
  const onEachRouteFeature = (feature, layer) => {
    const props = feature.properties;
    const popupContent = `
      <div>
        <h3>Segmento de Ruta</h3>
        <p><strong>Secuencia:</strong> ${props.path_seq}</p>
        <p><strong>Costo segmento:</strong> ${(props.cost / 1000).toFixed(2)} km</p>
        <p><strong>Costo acumulado:</strong> ${(props.agg_cost / 1000).toFixed(2)} km</p>
      </div>
    `;
    layer.bindPopup(popupContent);
  };

  // Custom icons for start and end markers
  const startIcon = new L.Icon({
    iconUrl: 'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIyNCIgaGVpZ2h0PSIyNCIgdmlld0JveD0iMCAwIDI0IDI0IiBmaWxsPSIjMDBmZjAwIj48cGF0aCBkPSJNMTIgMkM4LjEzIDIgNSA1LjEzIDUgOWMwIDUuMjUgNyAxMyA3IDEzczctNy43NSA3LTEzYzAtMy44Ny0zLjEzLTctNy03em0wIDkuNWMtMS4zOCAwLTIuNS0xLjEyLTIuNS0yLjVzMS4xMi0yLjUgMi41LTIuNSAyLjUgMS4xMiAyLjUgMi41LTEuMTIgMi41LTIuNSAyLjV6Ii8+PC9zdmc+',
    iconSize: [32, 32],
    iconAnchor: [16, 32],
    popupAnchor: [0, -32],
  });

  const endIcon = new L.Icon({
    iconUrl: 'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIyNCIgaGVpZ2h0PSIyNCIgdmlld0JveD0iMCAwIDI0IDI0IiBmaWxsPSIjZmYwMDAwIj48cGF0aCBkPSJNMTIgMkM4LjEzIDIgNSA1LjEzIDUgOWMwIDUuMjUgNyAxMyA3IDEzczctNy43NSA3LTEzYzAtMy44Ny0zLjEzLTctNy03em0wIDkuNWMtMS4zOCAwLTIuNS0xLjEyLTIuNS0yLjVzMS4xMi0yLjUgMi41LTIuNSAyLjUgMS4xMiAyLjUgMi41LTEuMTIgMi41LTIuNSAyLjV6Ii8+PC9zdmc+',
    iconSize: [32, 32],
    iconAnchor: [16, 32],
    popupAnchor: [0, -32],
  });

  if (!showRoute) return null;

  return (
    <>
      {loading && (
        <div className="loading-overlay">
          <div className="loading-spinner">Calculando ruta...</div>
        </div>
      )}

      {error && (
        <div className="error-message">
          <strong>Error:</strong> {error}
        </div>
      )}

      {/* Route info panel */}
      {routeInfo && (
        <div className="route-info-panel">
          <h3>Información de Ruta</h3>
          <p><strong>Algoritmo:</strong> {routeInfo.algorithm}</p>
          <p><strong>Distancia total:</strong> {routeInfo.total_cost_km} km</p>
          <p><strong>Número de enlaces:</strong> {routeInfo.total_edges}</p>
          <p><strong>Tiempo de cómputo:</strong> {routeInfo.compute_time_ms ? `${routeInfo.compute_time_ms.toFixed(2)} ms` : 'N/A'}</p>
          <p><strong>Considera amenazas:</strong> {routeInfo.considers_threats ? 'Sí' : 'No (peor caso)'}</p>
          {routeInfo.route_name && <p><strong>Ruta:</strong> {routeInfo.route_name}</p>}
          {routeInfo.description && <p className="route-description">{routeInfo.description}</p>}
          <div className="route-actions">
            <button onClick={loadExampleRoute} className="btn-secondary">
              Cargar Ejemplo
            </button>
            <button onClick={useCurrentLocation} className="btn-gps" disabled={loading}>
              📍 Usar Mi Ubicación
            </button>
            <button onClick={enablePointSelection} className="btn-primary">
              {isSelectingPoints ? 'Seleccionando...' : 'Nueva Ruta'}
            </button>
            <button 
              onClick={() => setShowRestrictions(!showRestrictions)} 
              className="btn-secondary"
            >
              {showRestrictions ? '▼' : '▶'} Restricciones
            </button>
          </div>

          {/* Restrictions panel */}
          {showRestrictions && (
            <div className="restrictions-panel">
              <h4>Restricciones de Ruteo</h4>
              
              <div className="restriction-item">
                <label>
                  Distancia máxima (km):
                  <input
                    type="number"
                    min="0"
                    step="10"
                    value={restrictions.maxDistance || ''}
                    onChange={(e) => setRestrictions({
                      ...restrictions, 
                      maxDistance: e.target.value ? parseFloat(e.target.value) : null
                    })}
                    placeholder="Sin límite"
                  />
                </label>
                <small>Limita la longitud total de la ruta</small>
              </div>

              <div className="restriction-item">
                <label>
                  Probabilidad máxima de falla:
                  <span className="value-display">{restrictions.maxFailureProb.toFixed(2)}</span>
                </label>
                <input
                  type="range"
                  min="0"
                  max="1"
                  step="0.05"
                  value={restrictions.maxFailureProb}
                  onChange={(e) => setRestrictions({
                    ...restrictions,
                    maxFailureProb: parseFloat(e.target.value)
                  })}
                />
                <small>Enlaces con prob. mayor serán evitados (0 = muy seguro, 1 = permitir cualquiera)</small>
              </div>

              <div className="restriction-item">
                <label>
                  Peso de riesgo vs distancia:
                  <span className="value-display">{restrictions.riskWeight.toFixed(1)}</span>
                </label>
                <input
                  type="range"
                  min="0"
                  max="10"
                  step="0.5"
                  value={restrictions.riskWeight}
                  onChange={(e) => setRestrictions({
                    ...restrictions,
                    riskWeight: parseFloat(e.target.value)
                  })}
                />
                <small>Qué tanto priorizar seguridad sobre distancia (0 = solo distancia, 10 = máxima seguridad)</small>
              </div>

              <div className="restriction-item">
                <label>
                  <input
                    type="checkbox"
                    checked={restrictions.avoidHighRisk}
                    onChange={(e) => setRestrictions({
                      ...restrictions,
                      avoidHighRisk: e.target.checked
                    })}
                  />
                  Evitar enlaces de alto riesgo
                </label>
                <small>Excluye enlaces en zonas con alta probabilidad de falla</small>
              </div>

              <button 
                onClick={() => setRestrictions({
                  maxDistance: null,
                  maxFailureProb: 0.5,
                  riskWeight: 2.0,
                  avoidHighRisk: true,
                })}
                className="btn-secondary"
              >
                Restablecer
              </button>
            </div>
          )}
        </div>
      )}

      {/* Render route */}
      {route && route.features && (
        <GeoJSON
          data={route}
          style={routeStyle}
          onEachFeature={onEachRouteFeature}
        />
      )}

      {/* Render start marker */}
      {startPoint && (
        <Marker position={[startPoint.lat, startPoint.lon]} icon={startIcon}>
          <Popup>
            <div>
              <h3>Punto de Inicio</h3>
              {routeInfo && routeInfo.start && routeInfo.start.name && (
                <p><strong>{routeInfo.start.name}</strong></p>
              )}
              <p>Lat: {startPoint.lat.toFixed(4)}</p>
              <p>Lon: {startPoint.lon.toFixed(4)}</p>
            </div>
          </Popup>
        </Marker>
      )}

      {/* Render end marker */}
      {endPoint && (
        <Marker position={[endPoint.lat, endPoint.lon]} icon={endIcon}>
          <Popup>
            <div>
              <h3>Punto de Destino</h3>
              {routeInfo && routeInfo.end && routeInfo.end.name && (
                <p><strong>{routeInfo.end.name}</strong></p>
              )}
              <p>Lat: {endPoint.lat.toFixed(4)}</p>
              <p>Lon: {endPoint.lon.toFixed(4)}</p>
            </div>
          </Popup>
        </Marker>
      )}

      {isSelectingPoints && (
        <div className="selection-info">
          {!startPoint
            ? 'Haz clic en el mapa para seleccionar el punto de inicio'
            : 'Haz clic en el mapa para seleccionar el punto de destino'}
        </div>
      )}
    </>
  );
}

export default RouteCalculator;
