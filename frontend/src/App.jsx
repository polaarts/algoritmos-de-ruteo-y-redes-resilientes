import { useState } from 'react';
import Map from './components/Map';
import InfrastructureLayer from './components/InfrastructureLayer';
import ThreatsLayer from './components/ThreatsLayer';
import RouteCalculator from './components/RouteCalculator';
import RouteComparison from './components/RouteComparison';
import SimulationControlsV2 from './components/SimulationControlsV2';
import RealisticFiberLinks from './components/RealisticFiberLinks';
import RegionalFiberLayer from './components/RegionalFiberLayer';
import './styles/App.css';

function App() {
  const [mapInstance, setMapInstance] = useState(null);
  const [layers, setLayers] = useState({
    showNodes: false,
    showDatacenters: true,
    showEarthquakes: true,
    showFireZones: false,
    showWeatherEvents: false,
    showRoute: true,
    showSimulation: true, // Panel de Monte Carlo visible por defecto
    showRealisticRoutes: false, // Rutas realistas con Leaflet Routing Machine
    showRegionalFiber: false, // Enlaces de fibra óptica regional
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
                      checked={layers.showRegionalFiber}
                      onChange={() => toggleLayer('showRegionalFiber')}
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
            {/* Enlaces de fibra regionales desde GeoJSON */}
            <RegionalFiberLayer visible={layers.showRegionalFiber} />
            
            <InfrastructureLayer
              showEdges={false}
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
