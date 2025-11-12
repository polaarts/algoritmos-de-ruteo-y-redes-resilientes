import { useState, useEffect } from 'react';
import { GeoJSON, Marker, Popup, useMap } from 'react-leaflet';
import L from 'leaflet';
import { routingAPI, optimizationAPI } from '../services/api';
import '../styles/RouteComparison.css';

/**
 * RouteComparison Component
 * Calculates and displays 4 different routing algorithms:
 * 1. Dijkstra (distance only) - Worst case
 * 2. Dijkstra (resilient) - With risk weights
 * 3. MIP Optimization - With metadata and threats
 * 4. Genetic Algorithm - Metaheuristic
 */
function RouteComparison({ show = false }) {
  const map = useMap();

  // Route data
  const [routes, setRoutes] = useState({
    dijkstra: null,
    dijkstraResilient: null,
    mip: null,
    genetic: null,
  });

  // Visibility toggles
  const [visibleRoutes, setVisibleRoutes] = useState({
    dijkstra: true,
    dijkstraResilient: true,
    mip: true,
    genetic: true,
  });

  // UI state
  const [loading, setLoading] = useState({
    dijkstra: false,
    dijkstraResilient: false,
    mip: false,
    genetic: false,
  });
  const [errors, setErrors] = useState({});
  const [startPoint, setStartPoint] = useState(null);
  const [endPoint, setEndPoint] = useState(null);
  const [isSelectingPoints, setIsSelectingPoints] = useState(false);
  const [selectingFor, setSelectingFor] = useState(null); // 'start' or 'end'
  const [showTable, setShowTable] = useState(true);

  // Options for route calculation
  const [options, setOptions] = useState({
    maxFailureProb: 0.3,
    riskWeight: 2.0,
    maxProbability: 0.7,
    timeLimit: 60,
    populationSize: 100,
    generations: 50,
  });

  // Show/hide options panel
  const [showOptions, setShowOptions] = useState(false);

  // Route colors
  const routeColors = {
    dijkstra: '#00ff00',        // Green - Basic
    dijkstraResilient: '#ffaa00', // Orange - Resilient
    mip: '#0088ff',              // Blue - Optimized
    genetic: '#ff00ff',          // Magenta - Metaheuristic
  };

  // Route names
  const routeNames = {
    dijkstra: 'Dijkstra (Distancia)',
    dijkstraResilient: 'Dijkstra (Resiliente)',
    mip: 'MIP Optimizado',
    genetic: 'Algoritmo Genético',
  };

  // Toggle route visibility
  const toggleRoute = (routeType) => {
    setVisibleRoutes((prev) => ({
      ...prev,
      [routeType]: !prev[routeType],
    }));
  };

  // Enable point selection
  const enablePointSelection = (pointType) => {
    setIsSelectingPoints(true);
    setSelectingFor(pointType);

    const onMapClick = (e) => {
      const point = { lat: e.latlng.lat, lon: e.latlng.lng };

      if (pointType === 'start') {
        setStartPoint(point);
      } else {
        setEndPoint(point);
      }

      setIsSelectingPoints(false);
      setSelectingFor(null);
      map.off('click', onMapClick);
    };

    map.on('click', onMapClick);
  };

  // Calculate all routes
  const calculateAllRoutes = async () => {
    if (!startPoint || !endPoint) {
      alert('Por favor selecciona puntos de inicio y destino');
      return;
    }

    const { lat: startLat, lon: startLon } = startPoint;
    const { lat: endLat, lon: endLon } = endPoint;

    // Reset errors
    setErrors({});

    // Calculate all routes in parallel
    const promises = [
      calculateDijkstraRoute(startLat, startLon, endLat, endLon),
      calculateDijkstraResilientRoute(startLat, startLon, endLat, endLon),
      calculateMIPRoute(startLat, startLon, endLat, endLon),
      calculateGeneticRoute(startLat, startLon, endLat, endLon),
    ];

    await Promise.allSettled(promises);

    // Fit map to show all routes
    fitMapToRoutes();
  };

  // Calculate Dijkstra (distance only)
  const calculateDijkstraRoute = async (startLat, startLon, endLat, endLon) => {
    console.log('🔵 [FRONTEND] Calculating Dijkstra route:', { startLat, startLon, endLat, endLon });
    setLoading((prev) => ({ ...prev, dijkstra: true }));
    try {
      const response = await routingAPI.calculateRoute(startLat, startLon, endLat, endLon);
      console.log('✅ [FRONTEND] Dijkstra route received:', response.data);
      setRoutes((prev) => ({ ...prev, dijkstra: response.data }));
    } catch (error) {
      console.error('❌ [FRONTEND] Error calculating Dijkstra route:', error);
      setErrors((prev) => ({ ...prev, dijkstra: error.message }));
    } finally {
      setLoading((prev) => ({ ...prev, dijkstra: false }));
    }
  };

  // Calculate Dijkstra Resilient (with risk weights)
  const calculateDijkstraResilientRoute = async (startLat, startLon, endLat, endLon) => {
    console.log('🟢 [FRONTEND] Calculating Resilient route:', { startLat, startLon, endLat, endLon, options });
    setLoading((prev) => ({ ...prev, dijkstraResilient: true }));
    try {
      const response = await routingAPI.calculateResilientRoute(
        startLat, startLon, endLat, endLon,
        {
          maxFailureProb: options.maxFailureProb,
          riskWeight: options.riskWeight,
        }
      );
      console.log('✅ [FRONTEND] Resilient route received:', response.data);
      setRoutes((prev) => ({ ...prev, dijkstraResilient: response.data }));
    } catch (error) {
      console.error('❌ [FRONTEND] Error calculating Resilient route:', error);
      setErrors((prev) => ({ ...prev, dijkstraResilient: error.message }));
    } finally {
      setLoading((prev) => ({ ...prev, dijkstraResilient: false }));
    }
  };

  // Calculate MIP route
  const calculateMIPRoute = async (startLat, startLon, endLat, endLon) => {
    console.log('🔷 [FRONTEND] Calculating MIP route:', { startLat, startLon, endLat, endLon, options });
    setLoading((prev) => ({ ...prev, mip: true }));
    try {
      const response = await optimizationAPI.calculateMIPRoute(
        startLat, startLon, endLat, endLon,
        {
          maxProbability: options.maxProbability,
          riskWeight: options.riskWeight,
          timeLimit: options.timeLimit,
        }
      );
      console.log('✅ [FRONTEND] MIP route received:', response.data);
      setRoutes((prev) => ({ ...prev, mip: response.data }));
    } catch (error) {
      console.error('❌ [FRONTEND] Error calculating MIP route:', error);
      setErrors((prev) => ({ ...prev, mip: error.message }));
    } finally {
      setLoading((prev) => ({ ...prev, mip: false }));
    }
  };

  // Calculate Genetic Algorithm route
  const calculateGeneticRoute = async (startLat, startLon, endLat, endLon) => {
    console.log('🟣 [FRONTEND] Calculating Genetic route:', { startLat, startLon, endLat, endLon, options });
    setLoading((prev) => ({ ...prev, genetic: true }));
    try {
      const response = await optimizationAPI.calculateGeneticRoute(
        startLat, startLon, endLat, endLon,
        {
          maxProbability: options.maxProbability,
          populationSize: options.populationSize,
          generations: options.generations,
        }
      );
      console.log('✅ [FRONTEND] Genetic route received:', response.data);
      setRoutes((prev) => ({ ...prev, genetic: response.data }));
    } catch (error) {
      console.error('❌ [FRONTEND] Error calculating Genetic route:', error);
      setErrors((prev) => ({ ...prev, genetic: error.message }));
    } finally {
      setLoading((prev) => ({ ...prev, genetic: false }));
    }
  };

  // Fit map to show all visible routes
  const fitMapToRoutes = () => {
    const bounds = L.latLngBounds([]);
    let hasRoutes = false;

    Object.entries(routes).forEach(([key, route]) => {
      if (route && route.features && visibleRoutes[key]) {
        const routeBounds = L.geoJSON(route).getBounds();
        bounds.extend(routeBounds);
        hasRoutes = true;
      }
    });

    if (hasRoutes) {
      map.fitBounds(bounds, { padding: [50, 50] });
    }
  };

  // Load example (Santiago - Valparaíso) - Ruta más corta y probable conexión
  const loadExample = () => {
    setStartPoint({ lat: -33.4489, lon: -70.6693, name: 'Santiago' });
    setEndPoint({ lat: -33.0472, lon: -71.6127, name: 'Valparaíso' });
  };

  // Use current location from GPS
  const useCurrentLocation = () => {
    if (!navigator.geolocation) {
      alert('Tu navegador no soporta geolocalización. Por favor selecciona manualmente.');
      return;
    }

    setErrors({});

    navigator.geolocation.getCurrentPosition(
      (position) => {
        const { latitude, longitude } = position.coords;
        setStartPoint({ lat: latitude, lon: longitude, name: 'Mi Ubicación' });

        // Center map on user location
        map.setView([latitude, longitude], 13);
      },
      (error) => {
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
        alert(errorMessage);
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 0,
      }
    );
  };

  // Auto-calculate when both points are set
  useEffect(() => {
    if (startPoint && endPoint && show) {
      calculateAllRoutes();
    }
  }, [startPoint, endPoint, show]);

  // Style function for each route
  const getRouteStyle = (routeType) => ({
    color: routeColors[routeType],
    weight: 4,
    opacity: 0.7,
  });

  // Popup for route segments
  const onEachRouteFeature = (routeType) => (feature, layer) => {
    const props = feature.properties;
    const popupContent = `
      <div class="route-popup">
        <h3>${routeNames[routeType]}</h3>
        <p><strong>Secuencia:</strong> ${props.path_seq || props.seq || 'N/A'}</p>
        <p><strong>Costo segmento:</strong> ${((props.cost || 0) / 1000).toFixed(2)} km</p>
        <p><strong>Costo acumulado:</strong> ${((props.agg_cost || 0) / 1000).toFixed(2)} km</p>
        ${props.failure_prob ? `<p><strong>Prob. falla:</strong> ${(props.failure_prob * 100).toFixed(2)}%</p>` : ''}
      </div>
    `;
    layer.bindPopup(popupContent);
  };

  // Custom icons
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

  if (!show) return null;

  const anyLoading = Object.values(loading).some((l) => l);

  return (
    <>
      {/* Loading overlay */}
      {anyLoading && (
        <div className="loading-overlay">
          <div className="loading-spinner">
            <div className="spinner"></div>
            <p>Calculando rutas...</p>
            <div className="loading-details">
              {loading.dijkstra && <p>⏳ Dijkstra (distancia)</p>}
              {loading.dijkstraResilient && <p>⏳ Dijkstra (resiliente)</p>}
              {loading.mip && <p>⏳ MIP Optimización</p>}
              {loading.genetic && <p>⏳ Algoritmo Genético</p>}
            </div>
          </div>
        </div>
      )}

      {/* Control panel */}
      <div className="route-comparison-panel">
        <h3>Comparación de Algoritmos de Ruteo</h3>

        {/* Point selection */}
        <div className="point-selection">
          <div className="point-group">
            <label>Punto de Inicio:</label>
            <div className="point-controls">
              {startPoint ? (
                <span className="point-display">
                  {startPoint.name || `${startPoint.lat.toFixed(4)}, ${startPoint.lon.toFixed(4)}`}
                </span>
              ) : (
                <span className="point-empty">No seleccionado</span>
              )}
              <button
                onClick={() => enablePointSelection('start')}
                className={isSelectingPoints && selectingFor === 'start' ? 'active' : ''}
              >
                {isSelectingPoints && selectingFor === 'start' ? 'Seleccionando...' : 'Seleccionar'}
              </button>
            </div>
          </div>

          <div className="point-group">
            <label>Punto de Destino:</label>
            <div className="point-controls">
              {endPoint ? (
                <span className="point-display">
                  {endPoint.name || `${endPoint.lat.toFixed(4)}, ${endPoint.lon.toFixed(4)}`}
                </span>
              ) : (
                <span className="point-empty">No seleccionado</span>
              )}
              <button
                onClick={() => enablePointSelection('end')}
                className={isSelectingPoints && selectingFor === 'end' ? 'active' : ''}
              >
                {isSelectingPoints && selectingFor === 'end' ? 'Seleccionando...' : 'Seleccionar'}
              </button>
            </div>
          </div>
        </div>

        {/* Action buttons */}
        <div className="action-buttons">
          <button onClick={loadExample} className="btn-secondary">
            Cargar Ejemplo
          </button>
          <button onClick={useCurrentLocation} className="btn-gps">
            📍 Mi Ubicación
          </button>
          <button
            onClick={calculateAllRoutes}
            disabled={!startPoint || !endPoint || anyLoading}
            className="btn-primary"
          >
            Calcular Rutas
          </button>
        </div>

        {/* Options toggle */}
        <div className="options-toggle">
          <button onClick={() => setShowOptions(!showOptions)} className="btn-secondary">
            {showOptions ? '▼' : '▶'} Opciones Avanzadas
          </button>
        </div>

        {/* Advanced options panel */}
        {showOptions && (
          <div className="options-panel">
            <h4>Parámetros de Ruteo</h4>

            {/* Dijkstra Resilient options */}
            <div className="option-section">
              <h5>Dijkstra Resiliente</h5>
              <div className="option-item">
                <label>
                  Probabilidad máxima de falla:
                  <span className="option-value">{options.maxFailureProb.toFixed(2)}</span>
                </label>
                <input
                  type="range"
                  min="0"
                  max="1"
                  step="0.05"
                  value={options.maxFailureProb}
                  onChange={(e) =>
                    setOptions({ ...options, maxFailureProb: parseFloat(e.target.value) })
                  }
                />
                <small>Umbral máximo de riesgo aceptable (0 = muy seguro, 1 = cualquier riesgo)</small>
              </div>

              <div className="option-item">
                <label>
                  Peso de riesgo vs distancia:
                  <span className="option-value">{options.riskWeight.toFixed(1)}</span>
                </label>
                <input
                  type="range"
                  min="0"
                  max="10"
                  step="0.5"
                  value={options.riskWeight}
                  onChange={(e) =>
                    setOptions({ ...options, riskWeight: parseFloat(e.target.value) })
                  }
                />
                <small>
                  Cuánto más importa evitar riesgo vs minimizar distancia (0 = solo distancia, 10 = priorizar seguridad)
                </small>
              </div>
            </div>

            {/* MIP options */}
            <div className="option-section">
              <h5>MIP Optimización</h5>
              <div className="option-item">
                <label>
                  Probabilidad máxima permitida:
                  <span className="option-value">{options.maxProbability.toFixed(2)}</span>
                </label>
                <input
                  type="range"
                  min="0"
                  max="1"
                  step="0.05"
                  value={options.maxProbability}
                  onChange={(e) =>
                    setOptions({ ...options, maxProbability: parseFloat(e.target.value) })
                  }
                />
                <small>Restricción: no usar enlaces con prob. falla mayor a este valor</small>
              </div>

              <div className="option-item">
                <label>
                  Tiempo límite (segundos):
                  <span className="option-value">{options.timeLimit}</span>
                </label>
                <input
                  type="range"
                  min="10"
                  max="300"
                  step="10"
                  value={options.timeLimit}
                  onChange={(e) =>
                    setOptions({ ...options, timeLimit: parseInt(e.target.value) })
                  }
                />
                <small>Máximo tiempo de ejecución para el solver MIP</small>
              </div>
            </div>

            {/* Genetic Algorithm options */}
            <div className="option-section">
              <h5>Algoritmo Genético</h5>
              <div className="option-item">
                <label>
                  Tamaño de población:
                  <span className="option-value">{options.populationSize}</span>
                </label>
                <input
                  type="range"
                  min="20"
                  max="200"
                  step="10"
                  value={options.populationSize}
                  onChange={(e) =>
                    setOptions({ ...options, populationSize: parseInt(e.target.value) })
                  }
                />
                <small>Número de individuos por generación (más = mejor calidad, más lento)</small>
              </div>

              <div className="option-item">
                <label>
                  Número de generaciones:
                  <span className="option-value">{options.generations}</span>
                </label>
                <input
                  type="range"
                  min="10"
                  max="100"
                  step="5"
                  value={options.generations}
                  onChange={(e) =>
                    setOptions({ ...options, generations: parseInt(e.target.value) })
                  }
                />
                <small>Iteraciones de evolución (más = mejor convergencia, más lento)</small>
              </div>
            </div>

            {/* Reset button */}
            <div className="options-actions">
              <button
                onClick={() =>
                  setOptions({
                    maxFailureProb: 0.3,
                    riskWeight: 2.0,
                    maxProbability: 0.7,
                    timeLimit: 60,
                    populationSize: 100,
                    generations: 50,
                  })
                }
                className="btn-secondary"
              >
                Restablecer Valores por Defecto
              </button>
            </div>
          </div>
        )}

        {/* Route toggles */}
        <div className="route-toggles">
          <h4>Mostrar/Ocultar Rutas:</h4>
          {Object.keys(routes).map((routeType) => (
            <label key={routeType} className="route-toggle">
              <input
                type="checkbox"
                checked={visibleRoutes[routeType]}
                onChange={() => toggleRoute(routeType)}
                disabled={!routes[routeType]}
              />
              <span
                className="route-color-indicator"
                style={{ backgroundColor: routeColors[routeType] }}
              ></span>
              {routeNames[routeType]}
              {loading[routeType] && <span className="loading-indicator">⏳</span>}
            </label>
          ))}
        </div>

        {/* Toggle comparison table */}
        <div className="table-toggle">
          <button onClick={() => setShowTable(!showTable)} className="btn-secondary">
            {showTable ? 'Ocultar' : 'Mostrar'} Tabla Comparativa
          </button>
        </div>

        {/* Comparison table */}
        {showTable && (
          <div className="comparison-table">
            <h4>Comparación de Resultados</h4>
            <table>
              <thead>
                <tr>
                  <th>Algoritmo</th>
                  <th>Distancia (km)</th>
                  <th>Tiempo (ms)</th>
                  <th>Riesgo Prom.</th>
                  <th>Estado</th>
                </tr>
              </thead>
              <tbody>
                {Object.entries(routes).map(([routeType, route]) => {
                  const info = route?.route_info || {};
                  return (
                    <tr key={routeType} className={visibleRoutes[routeType] ? 'visible' : ''}>
                      <td>
                        <span
                          className="route-color-dot"
                          style={{ backgroundColor: routeColors[routeType] }}
                        ></span>
                        {routeNames[routeType]}
                      </td>
                      <td>{info.total_cost_km || '-'}</td>
                      <td>{info.compute_time_ms?.toFixed(2) || '-'}</td>
                      <td>
                        {info.avg_failure_prob
                          ? `${(info.avg_failure_prob * 100).toFixed(2)}%`
                          : info.considers_threats === false
                          ? 'N/A'
                          : '-'}
                      </td>
                      <td>
                        {loading[routeType] ? (
                          <span className="status-loading">Calculando...</span>
                        ) : errors[routeType] ? (
                          <span className="status-error">Error</span>
                        ) : route ? (
                          <span className="status-success">OK</span>
                        ) : (
                          <span className="status-pending">Pendiente</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* Errors display */}
        {Object.keys(errors).length > 0 && (
          <div className="errors-display">
            {Object.entries(errors).map(([routeType, error]) => (
              <div key={routeType} className="error-item">
                No se encontró ruta entre estos dos puntos para {routeNames[routeType]}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Render routes on map */}
      {Object.entries(routes).map(([routeType, route]) => {
        if (!route || !route.features || !visibleRoutes[routeType]) return null;

        return (
          <GeoJSON
            key={routeType}
            data={route}
            style={getRouteStyle(routeType)}
            onEachFeature={onEachRouteFeature(routeType)}
          />
        );
      })}

      {/* Render markers */}
      {startPoint && (
        <Marker position={[startPoint.lat, startPoint.lon]} icon={startIcon}>
          <Popup>
            <div>
              <h3>Punto de Inicio</h3>
              {startPoint.name && <p><strong>{startPoint.name}</strong></p>}
              <p>Lat: {startPoint.lat.toFixed(4)}</p>
              <p>Lon: {startPoint.lon.toFixed(4)}</p>
            </div>
          </Popup>
        </Marker>
      )}

      {endPoint && (
        <Marker position={[endPoint.lat, endPoint.lon]} icon={endIcon}>
          <Popup>
            <div>
              <h3>Punto de Destino</h3>
              {endPoint.name && <p><strong>{endPoint.name}</strong></p>}
              <p>Lat: {endPoint.lat.toFixed(4)}</p>
              <p>Lon: {endPoint.lon.toFixed(4)}</p>
            </div>
          </Popup>
        </Marker>
      )}

      {/* Selection hint */}
      {isSelectingPoints && (
        <div className="selection-hint">
          {selectingFor === 'start'
            ? '📍 Haz clic en el mapa para seleccionar el punto de INICIO'
            : '📍 Haz clic en el mapa para seleccionar el punto de DESTINO'}
        </div>
      )}
    </>
  );
}

export default RouteComparison;
