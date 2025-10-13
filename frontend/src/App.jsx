import { useState } from 'react';
import Map from './components/Map';
import InfrastructureLayer from './components/InfrastructureLayer';
import ThreatsLayer from './components/ThreatsLayer';
import RouteCalculator from './components/RouteCalculator';
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
  });
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [routeInfo, setRouteInfo] = useState(null);

  const toggleLayer = (layerName) => {
    setLayers((prev) => ({
      ...prev,
      [layerName]: !prev[layerName],
    }));
  };

  const handleRouteCalculated = (routeData) => {
    setRouteInfo(routeData.route_info);
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
          <button
            className="sidebar-toggle"
            onClick={() => setSidebarOpen(!sidebarOpen)}
            aria-label="Toggle sidebar"
          >
            {sidebarOpen ? '◀' : '▶'}
          </button>

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
                </div>
              </section>

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
                <div className="legend-item">
                  <span className="legend-color" style={{ backgroundColor: '#3388ff' }}></span>
                  <span>Enlaces de fibra</span>
                </div>
                <div className="legend-item">
                  <span className="legend-color" style={{ backgroundColor: '#007bff' }}></span>
                  <span>Datacenters</span>
                </div>
                <div className="legend-item">
                  <span className="legend-color" style={{ backgroundColor: '#ff0000' }}></span>
                  <span>Sismos (magnitud alta)</span>
                </div>
                <div className="legend-item">
                  <span className="legend-color" style={{ backgroundColor: '#ffcc00' }}></span>
                  <span>Sismos (magnitud baja)</span>
                </div>
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
                <p>
                  <strong>Fase 2:</strong> Visualización y ruteo básico con
                  pgr_dijkstra (sin considerar amenazas - peor caso).
                </p>
                <p>
                  <small>
                    Proyecto: Resiliencia de Redes de Fibra Óptica<br />
                    Autores: Samuel & Agustín
                  </small>
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
            <RouteCalculator
              showRoute={layers.showRoute}
              onRouteCalculated={handleRouteCalculated}
            />
          </Map>
        </main>
      </div>
    </div>
  );
}

export default App;
