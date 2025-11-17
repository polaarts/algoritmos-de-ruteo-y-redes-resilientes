import { useState } from 'react';
import Map from './components/Map';
import InfrastructureLayer from './components/InfrastructureLayer';
import ThreatsLayer from './components/ThreatsLayer';
import RouteCalculator from './components/RouteCalculator';
import RouteComparison from './components/RouteComparison';
import SimulationControlsV2 from './components/SimulationControlsV2';
import SimulationLayer from './components/SimulationLayer';
import RealisticFiberLinks from './components/RealisticFiberLinks';
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
    showSimulationFailures: true, // Mostrar fallas en el mapa
    showFailuresOnly: false, // Mostrar solo elementos que fallaron
    showRealisticRoutes: false, // Rutas realistas con Leaflet Routing Machine
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

  const handleSimulationChange = (simData) => {
    console.log('Simulation data updated:', simData);
    setSimulationData(simData);
    
    // Auto-activar visualización de fallas cuando hay simulación
    if (simData) {
      setLayers(prev => ({
        ...prev,
        showSimulationFailures: true
      }));
    }
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
                  <h3>Simulación</h3>
                  <label>
                    <input
                      type="checkbox"
                      checked={layers.showSimulation}
                      onChange={() => toggleLayer('showSimulation')}
                    />
                    Panel de Simulación
                  </label>
                  {simulationData && (
                    <>
                      <label>
                        <input
                          type="checkbox"
                          checked={layers.showSimulationFailures}
                          onChange={() => toggleLayer('showSimulationFailures')}
                        />
                        Mostrar Fallas en Mapa
                      </label>
                      <label style={{ paddingLeft: '20px' }}>
                        <input
                          type="checkbox"
                          checked={layers.showFailuresOnly}
                          onChange={() => toggleLayer('showFailuresOnly')}
                        />
                        Solo Elementos Fallidos
                      </label>
                    </>
                  )}
                </div>

              </section>

              {/* Legend */}
              <section className="legend">
                <h2>Leyenda</h2>
                
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

                {simulationData && (
                  <>
                    <h3 style={{ fontSize: '14px', marginTop: '15px', marginBottom: '5px', color: '#555' }}>
                      Simulación de Fallas
                    </h3>
                    <div className="legend-item">
                      <span className="legend-color" style={{ backgroundColor: '#8b0000' }}></span>
                      <span>Falla por sismo</span>
                    </div>
                    <div className="legend-item">
                      <span className="legend-color" style={{ backgroundColor: '#ff4500' }}></span>
                      <span>Falla por incendio</span>
                    </div>
                    <div className="legend-item">
                      <span className="legend-color" style={{ backgroundColor: '#1e90ff' }}></span>
                      <span>Falla por inundación</span>
                    </div>
                    <div className="legend-item">
                      <span className="legend-color" style={{ backgroundColor: '#4682b4' }}></span>
                      <span>Falla por clima</span>
                    </div>
                  </>
                )}
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
            
            {/* Rutas realistas entre datacenters del Biobío */}
            {layers.showRealisticRoutes && (
              <RealisticFiberLinks 
                enabled={layers.showRealisticRoutes}
                region="Región del Biobío"
              />
            )}
            
            <ThreatsLayer
              showEarthquakes={layers.showEarthquakes}
              showFireZones={layers.showFireZones}
              showWeatherEvents={layers.showWeatherEvents}
            />
            
            {/* Simulación de fallas */}
            {layers.showSimulationFailures && simulationData && (
              <SimulationLayer
                simulationData={simulationData}
                showFailuresOnly={layers.showFailuresOnly}
              />
            )}
            
            {routeMode === 'simple' ? (
              <RouteCalculator
                showRoute={layers.showRoute}
                onRouteCalculated={handleRouteCalculated}
              />
            ) : (
              <RouteComparison show={layers.showRoute} />
            )}
          </Map>

          {/* Panel de control de simulación */}
          {layers.showSimulation && (
            <SimulationControlsV2 onSimulationChange={handleSimulationChange} />
          )}
        </main>
      </div>
    </div>
  );
}

export default App;
