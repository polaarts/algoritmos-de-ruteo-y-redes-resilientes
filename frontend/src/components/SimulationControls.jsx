import { useState } from 'react';
import { GeoJSON, useMap } from 'react-leaflet';
import { simulationAPI } from '../services/api';
import '../styles/SimulationControls.css';

/**
 * SimulationControls Component
 * Allows users to run Monte Carlo simulations to determine which threats/failures occur
 * Based on random number generation vs failure probability threshold
 */
function SimulationControls({ show = false, onSimulationComplete }) {
  const map = useMap();

  // Simulation state
  const [simulation, setSimulation] = useState(null);
  const [failures, setFailures] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // Configuration
  const [config, setConfig] = useState({
    name: '',
    probabilityThreshold: 0.3,
  });

  // Visualization options
  const [showFailuresOnly, setShowFailuresOnly] = useState(false);
  const [showFailedEdges, setShowFailedEdges] = useState(true);

  // Run simulation
  const runSimulation = async () => {
    setLoading(true);
    setError(null);

    try {
      const simulationName = config.name || `Simulación ${new Date().toLocaleString('es-CL')}`;

      console.log('Running simulation with config:', {
        name: simulationName,
        probabilityThreshold: config.probabilityThreshold,
      });

      // Call simulation API
      const response = await simulationAPI.runSimulation({
        name: simulationName,
        probabilityThreshold: config.probabilityThreshold,
      });

      console.log('Simulation response:', response.data);

      setSimulation(response.data.simulation);

      // Fetch failures
      if (response.data.simulationId) {
        await fetchFailures(response.data.simulationId);
      }

      if (onSimulationComplete) {
        onSimulationComplete(response.data);
      }
    } catch (err) {
      console.error('Error running simulation:', err);
      setError(err.response?.data?.error || err.message || 'Error al ejecutar simulación');
    } finally {
      setLoading(false);
    }
  };

  // Fetch failures from simulation
  const fetchFailures = async (simulationId) => {
    try {
      const response = await simulationAPI.getSimulationFailures(simulationId, 'edge');
      console.log('Failures response:', response.data);
      setFailures(response.data);
    } catch (err) {
      console.error('Error fetching failures:', err);
    }
  };

  // Clear simulation
  const clearSimulation = () => {
    setSimulation(null);
    setFailures(null);
    setError(null);
  };

  // Delete simulation
  const deleteSimulation = async () => {
    if (!simulation?.id) return;

    try {
      await simulationAPI.deleteSimulation(simulation.id);
      clearSimulation();
    } catch (err) {
      console.error('Error deleting simulation:', err);
      setError('Error al eliminar simulación');
    }
  };

  // Style for failed edges
  const failedEdgeStyle = {
    color: '#ff0000',
    weight: 5,
    opacity: 0.8,
    dashArray: '5, 5',
  };

  // Popup for failed edge
  const onEachFailedEdge = (feature, layer) => {
    const props = feature.properties;
    const popupContent = `
      <div class="failed-edge-popup">
        <h3>⚠️ Enlace Fallido</h3>
        <p><strong>ID:</strong> ${props.element_id}</p>
        <p><strong>Probabilidad de falla:</strong> ${(props.failure_probability * 100).toFixed(2)}%</p>
        <p><strong>Estado:</strong> <span style="color: red; font-weight: bold;">FALLIDO</span></p>
        <p class="warning">Este enlace falló en la simulación Monte Carlo</p>
      </div>
    `;
    layer.bindPopup(popupContent);
  };

  if (!show) return null;

  return (
    <>
      {/* Simulation control panel */}
      <div className="simulation-controls-panel">
        <h3>Simulación Monte Carlo</h3>
        <p className="description">
          Simula fallas en la red basándose en probabilidades de fallo calculadas
        </p>

        {!simulation ? (
          <>
            {/* Configuration form */}
            <div className="simulation-form">
              <div className="form-group">
                <label>Nombre de simulación (opcional):</label>
                <input
                  type="text"
                  value={config.name}
                  onChange={(e) => setConfig({ ...config, name: e.target.value })}
                  placeholder="Ej: Simulación Zona Sísmica"
                  disabled={loading}
                />
              </div>

              <div className="form-group">
                <label>
                  Umbral de probabilidad:
                  <span className="threshold-value">{(config.probabilityThreshold * 100).toFixed(0)}%</span>
                </label>
                <input
                  type="range"
                  min="0"
                  max="1"
                  step="0.05"
                  value={config.probabilityThreshold}
                  onChange={(e) =>
                    setConfig({ ...config, probabilityThreshold: parseFloat(e.target.value) })
                  }
                  disabled={loading}
                />
                <small>
                  Si un número aleatorio (0-100) es menor que la probabilidad de falla × 100, el enlace falla.
                  <br />
                  Umbral más alto = más fallas simuladas
                </small>
              </div>

              <button onClick={runSimulation} disabled={loading} className="btn-primary">
                {loading ? 'Ejecutando...' : '🎲 Ejecutar Simulación'}
              </button>
            </div>
          </>
        ) : (
          <>
            {/* Simulation results */}
            <div className="simulation-results">
              <h4>Resultados de Simulación</h4>
              <div className="result-item">
                <span className="label">Nombre:</span>
                <span className="value">{simulation.name}</span>
              </div>
              <div className="result-item">
                <span className="label">Fecha:</span>
                <span className="value">
                  {new Date(simulation.created_at).toLocaleString('es-CL')}
                </span>
              </div>
              <div className="result-item">
                <span className="label">Enlaces analizados:</span>
                <span className="value">{simulation.total_edges_analyzed || 'N/A'}</span>
              </div>
              <div className="result-item">
                <span className="label">Fallas detectadas:</span>
                <span className="value failure-count">
                  {simulation.total_failures || failures?.count || 0}
                </span>
              </div>
              <div className="result-item">
                <span className="label">Umbral usado:</span>
                <span className="value">
                  {(simulation.probability_threshold * 100).toFixed(0)}%
                </span>
              </div>

              {/* Visualization options */}
              <div className="visualization-options">
                <h5>Opciones de Visualización:</h5>
                <label className="checkbox-label">
                  <input
                    type="checkbox"
                    checked={showFailedEdges}
                    onChange={() => setShowFailedEdges(!showFailedEdges)}
                  />
                  Mostrar enlaces fallidos
                </label>
                <label className="checkbox-label">
                  <input
                    type="checkbox"
                    checked={showFailuresOnly}
                    onChange={() => setShowFailuresOnly(!showFailuresOnly)}
                  />
                  Mostrar solo amenazas activas en esta simulación
                </label>
                <small className="note">
                  ℹ️ Las amenazas activas son aquellas que causaron las fallas en los enlaces
                </small>
              </div>

              {/* Actions */}
              <div className="simulation-actions">
                <button onClick={clearSimulation} className="btn-secondary">
                  Nueva Simulación
                </button>
                <button onClick={deleteSimulation} className="btn-danger">
                  Eliminar
                </button>
              </div>
            </div>
          </>
        )}

        {/* Error display */}
        {error && (
          <div className="error-message">
            <strong>Error:</strong> {error}
          </div>
        )}

        {/* Info */}
        <div className="simulation-info">
          <h5>¿Cómo funciona?</h5>
          <ol>
            <li>Se calcula la probabilidad de falla de cada enlace basándose en amenazas cercanas</li>
            <li>Para cada enlace, se genera un número aleatorio entre 0 y 100</li>
            <li>
              Si el número es menor que (probabilidad × 100), el enlace <strong>FALLA</strong>
            </li>
            <li>Los enlaces fallidos se marcan en rojo en el mapa</li>
          </ol>
          <p className="tip">
            <strong>Tip:</strong> Usa un umbral más alto (50-80%) para simular escenarios de crisis.
            Usa un umbral bajo (10-30%) para escenarios normales.
          </p>
        </div>
      </div>

      {/* Render failed edges on map */}
      {showFailedEdges && failures && failures.features && failures.features.length > 0 && (
        <GeoJSON
          key={`simulation-${simulation?.id}-failures`}
          data={failures}
          style={failedEdgeStyle}
          onEachFeature={onEachFailedEdge}
        />
      )}

      {/* Loading overlay */}
      {loading && (
        <div className="loading-overlay-simulation">
          <div className="loading-spinner">
            <div className="spinner"></div>
            <p>Ejecutando simulación Monte Carlo...</p>
            <small>Esto puede tomar unos segundos</small>
          </div>
        </div>
      )}
    </>
  );
}

export default SimulationControls;
