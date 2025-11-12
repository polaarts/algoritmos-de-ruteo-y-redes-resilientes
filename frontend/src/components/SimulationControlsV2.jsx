import React, { useState } from 'react';
import { GeoJSON } from 'react-leaflet';
import '../styles/SimulationControls.css';

/**
 * SimulationControlsV2 Component
 * Permite ejecutar simulaciones Monte Carlo para determinar fallas en la red
 * basadas en números aleatorios vs probabilidades calculadas
 */
function SimulationControlsV2({ onSimulationChange }) {
  const [simulationActive, setSimulationActive] = useState(false);
  const [simulationData, setSimulationData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [showFailedOnly, setShowFailedOnly] = useState(false);

  // Ejecutar simulación de fallas
  const triggerSimulation = async () => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch('http://localhost:5001/api/simulation/trigger-failures', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          simulationName: `Simulación ${new Date().toLocaleString('es-CL')}`,
          seed: Math.random()
        })
      });

      if (!response.ok) {
        throw new Error('Error al ejecutar simulación');
      }

      const data = await response.json();
      console.log('Simulación ejecutada:', data);

      setSimulationData(data);
      setSimulationActive(true);

      // Notificar al componente padre
      if (onSimulationChange) {
        onSimulationChange(data);
      }

    } catch (err) {
      console.error('Error en simulación:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  // Limpiar simulación
  const clearSimulation = async () => {
    try {
      await fetch('http://localhost:5001/api/simulation/clear-failures', {
        method: 'POST'
      });

      setSimulationActive(false);
      setSimulationData(null);
      setError(null);

      // Notificar al componente padre
      if (onSimulationChange) {
        onSimulationChange(null);
      }

    } catch (err) {
      console.error('Error limpiando simulación:', err);
    }
  };

  // Obtener estado de la red
  const checkNetworkStatus = async () => {
    try {
      const response = await fetch('http://localhost:5001/api/simulation/network-status');
      const data = await response.json();
      console.log('Estado de la red:', data);
    } catch (err) {
      console.error('Error obteniendo estado:', err);
    }
  };

  return (
    <div className="simulation-controls">
      <div className="simulation-header">
        <h3>🎲 Simulación de Fallas</h3>
        <span className={`status-badge ${simulationActive ? 'active' : 'inactive'}`}>
          {simulationActive ? 'Activa' : 'Inactiva'}
        </span>
      </div>

      <div className="simulation-description">
        <p>
          Simula fallas en la red usando números aleatorios (0-100) comparados
          con las probabilidades calculadas de cada nodo y enlace.
        </p>
      </div>

      {/* Controles */}
      <div className="simulation-actions">
        <button
          className="btn-primary"
          onClick={triggerSimulation}
          disabled={loading || simulationActive}
        >
          {loading ? 'Ejecutando...' : '▶️ Ejecutar Simulación'}
        </button>

        {simulationActive && (
          <>
            <button
              className="btn-secondary"
              onClick={clearSimulation}
            >
              🗑️ Limpiar Simulación
            </button>
            
            <button
              className="btn-info"
              onClick={checkNetworkStatus}
            >
              📊 Ver Estado de Red
            </button>
          </>
        )}
      </div>

      {/* Checkbox para mostrar solo fallas */}
      {simulationActive && (
        <div className="simulation-options">
          <label className="checkbox-label">
            <input
              type="checkbox"
              checked={showFailedOnly}
              onChange={(e) => setShowFailedOnly(e.target.checked)}
            />
            <span>Mostrar solo elementos fallidos</span>
          </label>
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="simulation-error">
          <strong>❌ Error:</strong> {error}
        </div>
      )}

      {/* Estadísticas */}
      {simulationData && (
        <div className="simulation-stats">
          <h4>📈 Estadísticas de Simulación</h4>
          
          <div className="stat-card">
            <div className="stat-header">Resumen General</div>
            <div className="stat-row">
              <span>Tiempo de ejecución:</span>
              <strong>{simulationData.simulation.execution_time_ms}ms</strong>
            </div>
            <div className="stat-row">
              <span>Elementos totales:</span>
              <strong>{simulationData.statistics.total_elements}</strong>
            </div>
            <div className="stat-row">
              <span>Fallas totales:</span>
              <strong className="text-danger">
                {simulationData.statistics.total_failures}
              </strong>
            </div>
            <div className="stat-row">
              <span>Tasa de falla:</span>
              <strong>{simulationData.statistics.failure_rate}</strong>
            </div>
          </div>

          <div className="stat-card">
            <div className="stat-header">📍 Nodos</div>
            <div className="stat-row">
              <span>Total:</span>
              <strong>{simulationData.statistics.nodes.total}</strong>
            </div>
            <div className="stat-row">
              <span>Fallidos:</span>
              <strong className="text-danger">
                {simulationData.statistics.nodes.failed}
              </strong>
            </div>
            <div className="stat-subheader">Por amenaza:</div>
            {Object.entries(simulationData.statistics.nodes.byThreat).map(([threat, count]) => (
              count > 0 && (
                <div key={threat} className="stat-row stat-threat">
                  <span>{threat}:</span>
                  <strong>{count}</strong>
                </div>
              )
            ))}
          </div>

          <div className="stat-card">
            <div className="stat-header">🔗 Enlaces</div>
            <div className="stat-row">
              <span>Total:</span>
              <strong>{simulationData.statistics.edges.total}</strong>
            </div>
            <div className="stat-row">
              <span>Fallidos:</span>
              <strong className="text-danger">
                {simulationData.statistics.edges.failed}
              </strong>
            </div>
            <div className="stat-subheader">Por amenaza:</div>
            {Object.entries(simulationData.statistics.edges.byThreat).map(([threat, count]) => (
              count > 0 && (
                <div key={threat} className="stat-row stat-threat">
                  <span>{threat}:</span>
                  <strong>{count}</strong>
                </div>
              )
            ))}
          </div>
        </div>
      )}

      {/* Renderizar fallas en el mapa */}
      {simulationActive && simulationData?.failures && (
        <GeoJSON
          key={`failures-${Date.now()}`}
          data={simulationData.failures}
          style={(feature) => {
            const isNode = feature.properties.element_type === 'node';
            return {
              color: '#d32f2f',
              fillColor: '#f44336',
              fillOpacity: 0.6,
              weight: isNode ? 3 : 4,
              dashArray: '5, 5'
            };
          }}
          pointToLayer={(feature, latlng) => {
            return L.circleMarker(latlng, {
              radius: 10,
              color: '#d32f2f',
              fillColor: '#f44336',
              fillOpacity: 0.7,
              weight: 3
            });
          }}
          onEachFeature={(feature, layer) => {
            const props = feature.properties;
            layer.bindPopup(`
              <div style="min-width: 200px;">
                <h3 style="margin: 0 0 10px 0; color: #c62828;">
                  ❌ ${props.element_type === 'node' ? 'Nodo' : 'Enlace'} Fallido
                </h3>
                <div style="fontSize: 14px;">
                  <strong>ID:</strong> ${props.element_id}<br/>
                  <strong>Probabilidad:</strong> ${props.probability.toFixed(2)}%<br/>
                  <strong>Valor Aleatorio:</strong> ${props.random_value.toFixed(2)}<br/>
                  <strong>Amenaza Dominante:</strong> ${props.dominant_threat}<br/>
                  <div style="
                    margin-top: 8px; 
                    padding: 6px; 
                    background-color: #ffcdd2; 
                    border-radius: 4px;
                    font-weight: bold;
                  ">
                    ⚠️ FUERA DE SERVICIO
                  </div>
                </div>
              </div>
            `);
          }}
        />
      )}
    </div>
  );
}

export default SimulationControlsV2;
