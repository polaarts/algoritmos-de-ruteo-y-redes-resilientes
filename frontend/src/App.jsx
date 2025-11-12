import { useState } from 'react';
import Map from './components/Map';
import InfrastructureLayer from './components/InfrastructureLayer';
import ThreatsLayer from './components/ThreatsLayer';
import RouteCalculator from './components/RouteCalculator';
import RouteComparison from './components/RouteComparison';
import SimulationControlsV2 from './components/SimulationControlsV2';
import './styles/App.css';

function App() {
  const [mapInstance, setMapInstance] = useState(null);
  const [layers, setLayers] = useState({
    showEdges: false,
    showNodes: false,
    showDatacenters: true,
    showEarthquakes: true,
    showFireZones: false,
    showWeatherEvents: false,
    showRoute: true,
    showSimulation: true, // Panel de Monte Carlo visible por defecto
  });
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [routeInfo, setRouteInfo] = useState(null);
  const [routeMode, setRouteMode] = useState('comparison'); // 'simple' or 'comparison'
  const [simulationData, setSimulationData] = useState(null);

  const toggleLayer = (layerName) => {
    setLayers((prev) => ({
      ...prev,
      [layerName]: !prev[layerName],
    }));
  };

  const handleRouteCalculated = (routeData) => {
    setRouteInfo(routeData.route_info);
  };

  const handleSimulationComplete = (simData) => {
    setSimulationData(simData);
  };

  return (
    <div className="app">
      {/* Header */}
      <header className="app-header">
        <h1>Red de Fibra Óptica - Resiliencia en Chile</h1>
        <p>Análisis de infraestructura y amenazas naturales</p>
      </header>

      {/* Main content */}
      <div className="app-content">
        {/* Sidebar */}
        <aside className={`sidebar ${sidebarOpen ? 'open' : 'closed'}`}>

          {sidebarOpen && (
            <div className="sidebar-content">
              <section className="layer-controls">
                <h2>Capas de Visualización</h2>

                <div className="control-group">
                  <h3>Infraestructura</h3>
                  <label>
                    <input
                      type="checkbox"
                      checked={layers.showEdges}
                      onChange={() => toggleLayer('showEdges')}
                    />
                    Enlaces de Fibra
                  </label>
                  <label>
                    <input
                      type="checkbox"
                      checked={layers.showNodes}
                      onChange={() => toggleLayer('showNodes')}
                    />
                    Nodos
                  </label>
                  <label>
                    <input
                      type="checkbox"
                      checked={layers.showDatacenters}
                      onChange={() => toggleLayer('showDatacenters')}
                    />
                    Datacenters
                  </label>
                </div>

                <div className="control-group">
                  <h3>Amenazas</h3>
                  <label>
                    <input
                      type="checkbox"
                      checked={layers.showEarthquakes}
                      onChange={() => toggleLayer('showEarthquakes')}
                    />
                    Sismos
                  </label>
                  <label>
                    <input
                      type="checkbox"
                      checked={layers.showFireZones}
                      onChange={() => toggleLayer('showFireZones')}
                    />
                    Zonas de Incendio
                  </label>
                  <label>
                    <input
                      type="checkbox"
                      checked={layers.showWeatherEvents}
                      onChange={() => toggleLayer('showWeatherEvents')}
                    />
                    Eventos Climáticos
                  </label>
                </div>

                <div className="control-group">
                  <h3>Ruteo</h3>
                  <label>
                    <input
                      type="checkbox"
                      checked={layers.showRoute}
                      onChange={() => toggleLayer('showRoute')}
                    />
                    Mostrar Ruta
                  </label>
                  <div className="route-mode-selector">
                    <label className="radio-label">
                      <input
                        type="radio"
                        name="routeMode"
                        value="simple"
                        checked={routeMode === 'simple'}
                        onChange={() => setRouteMode('simple')}
                      />
                      Modo Simple
                    </label>
                    <label className="radio-label">
                      <input
                        type="radio"
                        name="routeMode"
                        value="comparison"
                        checked={routeMode === 'comparison'}
                        onChange={() => setRouteMode('comparison')}
                      />
                      Comparación 4 Algoritmos
                    </label>
                  </div>
                </div>

                <div className="control-group">
                  <h3>Simulación</h3>
                  <label>
                    <input
                      type="checkbox"
                      checked={layers.showSimulation}
                      onChange={() => toggleLayer('showSimulation')}
                    />
                    Mostrar Simulación Monte Carlo
                  </label>
                </div>
              </section>

              {/* Simulation Monte Carlo */}
              {layers.showSimulation && (
                <section className="simulation-section">
                  <SimulationControlsV2
                    onSimulationComplete={handleSimulationComplete}
                  />
                </section>
              )}

              {/* Route info */}
              {routeInfo && (
                <section className="route-info">
                  <h2>Información de Ruta</h2>
                  <div className="info-item">
                    <span className="label">Algoritmo:</span>
                    <span className="value">{routeInfo.algorithm}</span>
                  </div>
                  <div className="info-item">
                    <span className="label">Distancia:</span>
                    <span className="value">{routeInfo.total_cost_km} km</span>
                  </div>
                  <div className="info-item">
                    <span className="label">Enlaces:</span>
                    <span className="value">{routeInfo.total_edges}</span>
                  </div>
                  <div className="info-item">
                    <span className="label">Considera amenazas:</span>
                    <span className="value">
                      {routeInfo.considers_threats ? 'Sí' : 'No'}
                    </span>
                  </div>
                  {routeInfo.route_name && (
                    <div className="info-item">
                      <span className="label">Ruta:</span>
                      <span className="value">{routeInfo.route_name}</span>
                    </div>
                  )}
                </section>
              )}

              {/* Legend */}
              <section className="legend">
                <h2>Leyenda</h2>
                
                <h3 style={{ fontSize: '14px', marginTop: '10px', marginBottom: '5px', color: '#555' }}>
                  Nivel de Riesgo de Enlaces
                </h3>
                <div className="legend-item">
                  <span className="legend-color" style={{ backgroundColor: '#27ae60' }}></span>
                  <span>Riesgo Bajo (&lt;20%)</span>
                </div>
                <div className="legend-item">
                  <span className="legend-color" style={{ backgroundColor: '#f39c12' }}></span>
                  <span>Riesgo Medio (20-50%)</span>
                </div>
                <div className="legend-item">
                  <span className="legend-color" style={{ backgroundColor: '#e67e22' }}></span>
                  <span>Riesgo Alto (50-80%)</span>
                </div>
                <div className="legend-item">
                  <span className="legend-color" style={{ backgroundColor: '#e74c3c' }}></span>
                  <span>Riesgo Crítico (&gt;80%)</span>
                </div>
                <div className="legend-item">
                  <span className="legend-color" style={{ backgroundColor: '#95a5a6' }}></span>
                  <span>Sin datos de riesgo</span>
                </div>
                
                <h3 style={{ fontSize: '14px', marginTop: '15px', marginBottom: '5px', color: '#555' }}>
                  Infraestructura
                </h3>
                <div className="legend-item">
                  <span className="legend-color" style={{ backgroundColor: '#007bff' }}></span>
                  <span>Datacenters</span>
                </div>
                
                <h3 style={{ fontSize: '14px', marginTop: '15px', marginBottom: '5px', color: '#555' }}>
                  Amenazas
                </h3>
                <div className="legend-item">
                  <span className="legend-color" style={{ backgroundColor: '#ff0000' }}></span>
                  <span>Sismos (magnitud alta)</span>
                </div>
                <div className="legend-item">
                  <span className="legend-color" style={{ backgroundColor: '#ffcc00' }}></span>
                  <span>Sismos (magnitud baja)</span>
                </div>
                
                <h3 style={{ fontSize: '14px', marginTop: '15px', marginBottom: '5px', color: '#555' }}>
                  Rutas
                </h3>
                <div className="legend-item">
                  <span className="legend-color" style={{ backgroundColor: '#00ff00' }}></span>
                  <span>Ruta calculada</span>
                </div>
              </section>

              {/* Info */}
              <section className="info">
                <h2>Información</h2>
                <p>
                  Esta aplicación visualiza la red de fibra óptica de Chile y
                  analiza su resiliencia frente a amenazas naturales.
                </p>
              </section>
            </div>
          )}
        </aside>

        {/* Map */}
        <main className="map-container">
          <Map onMapReady={setMapInstance}>
            <InfrastructureLayer
              showEdges={layers.showEdges}
              showNodes={layers.showNodes}
              showDatacenters={layers.showDatacenters}
            />
            <ThreatsLayer
              showEarthquakes={layers.showEarthquakes}
              showFireZones={layers.showFireZones}
              showWeatherEvents={layers.showWeatherEvents}
            />
            {routeMode === 'simple' ? (
              <RouteCalculator
                showRoute={layers.showRoute}
                onRouteCalculated={handleRouteCalculated}
              />
            ) : (
              <RouteComparison show={layers.showRoute} />
            )}
          </Map>
        </main>
      </div>
    </div>
  );
}

export default App;
