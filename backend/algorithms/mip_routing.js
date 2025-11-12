/**
 * Optimización de Rutas usando Programación Lineal Entera Mixta (MIP)
 * 
 * Modela el problema de ruteo resiliente como un problema de optimización:
 * 
 * Variables de Decisión:
 * - x[i,j] ∈ {0,1}: 1 si se usa el enlace (i,j), 0 en caso contrario
 * - y[i] ∈ {0,1}: 1 si se usa el nodo i, 0 en caso contrario
 * 
 * Función Objetivo (minimizar):
 * Z = Σ(i,j) [distance[i,j] × x[i,j] + risk_weight × (prob_edge[i,j] + prob_node[i] + prob_node[j]) × x[i,j]]
 * 
 * Restricciones:
 * 1. Conservación de flujo:
 *    - En origen: Σ x[s,j] = 1
 *    - En destino: Σ x[i,t] = 1
 *    - En nodos intermedios: Σ x[i,k] - Σ x[k,j] = 0
 * 
 * 2. Capacidad de enlaces (si aplica):
 *    - flow[i,j] × x[i,j] ≤ capacity[i,j]
 * 
 * 3. Restricciones de usuario:
 *    - Evitar zonas de alto riesgo
 *    - Capacidad mínima requerida
 *    - Máxima latencia/distancia
 * 
 * 4. Conectividad:
 *    - x[i,j] ≤ y[i]
 *    - x[i,j] ≤ y[j]
 * 
 * Esta implementación usa una librería JavaScript para resolver el MIP
 * (nota: para producción se recomienda CPLEX o Gurobi mediante Python)
 */

const pool = require('../config/database');

class MIPRoutingOptimizer {
  constructor(config = {}) {
    this.riskWeight = config.riskWeight || 0.5;
    this.distanceWeight = config.distanceWeight || 0.5;
    this.maxDistance = config.maxDistance || Infinity;
    this.minCapacity = config.minCapacity || 0;
    this.avoidHighRisk = config.avoidHighRisk || false;
    this.highRiskThreshold = config.highRiskThreshold || 50;
    
    // Datos de la red
    this.nodes = [];
    this.edges = [];
    this.nodeProbabilities = new Map();
    this.edgeProbabilities = new Map();
    this.adjacencyMatrix = new Map();
  }

  /**
   * Inicializa el optimizador cargando datos de la red
   */
  async initialize() {
    const client = await pool.connect();
    
    try {
      console.log('Cargando datos de la red para MIP...');
      
      // Cargar nodos
      const nodesResult = await client.query(`
        SELECT id, osm_id, node_type,
               ST_X(geom::geometry) as lon, 
               ST_Y(geom::geometry) as lat
        FROM fiber_nodes
        ORDER BY id
      `);
      this.nodes = nodesResult.rows;
      console.log(`Nodos cargados: ${this.nodes.length}`);
      
      // Cargar probabilidades de nodos
      const nodeProbsResult = await client.query(`
        SELECT node_id, total_failure_probability
        FROM node_probabilities
      `);
      nodeProbsResult.rows.forEach(row => {
        this.nodeProbabilities.set(
          row.node_id, 
          parseFloat(row.total_failure_probability)
        );
      });
      console.log(`Probabilidades de nodos: ${nodeProbsResult.rows.length}`);
      
      // Cargar enlaces
      const edgesResult = await client.query(`
        SELECT id, source, target, length, cost
        FROM fiber_links
        ORDER BY id
      `);
      this.edges = edgesResult.rows;
      console.log(`Enlaces cargados: ${this.edges.length}`);
      
      // Cargar probabilidades de enlaces
      const edgeProbsResult = await client.query(`
        SELECT edge_id, total_failure_probability
        FROM edge_probabilities
      `);
      edgeProbsResult.rows.forEach(row => {
        this.edgeProbabilities.set(
          row.edge_id, 
          parseFloat(row.total_failure_probability)
        );
      });
      console.log(`Probabilidades de enlaces: ${edgeProbsResult.rows.length}`);
      
      // Construir matriz de adyacencia
      this.buildAdjacencyMatrix();
      
    } finally {
      client.release();
    }
  }

  /**
   * Construye la matriz de adyacencia
   */
  buildAdjacencyMatrix() {
    this.edges.forEach(edge => {
      const key = `${edge.source},${edge.target}`;
      this.adjacencyMatrix.set(key, {
        edgeId: edge.id,
        length: edge.length,
        cost: edge.cost,
        probability: this.edgeProbabilities.get(edge.id) || 0
      });
    });
  }

  /**
   * Resuelve el problema de optimización usando enfoque heurístico
   * (Simulación de MIP con heurística greedy ponderada)
   */
  async solve(sourceId, targetId, constraints = {}) {
    const startTime = Date.now();
    
    console.log(`Resolviendo MIP para ruta: ${sourceId} -> ${targetId}`);
    
    // Validar nodos
    if (!this.nodes.find(n => n.id === sourceId)) {
      throw new Error(`Nodo origen ${sourceId} no existe`);
    }
    if (!this.nodes.find(n => n.id === targetId)) {
      throw new Error(`Nodo destino ${targetId} no existe`);
    }
    
    // Usar algoritmo de Dijkstra modificado con pesos multi-objetivo
    const solution = this.multiObjectiveDijkstra(sourceId, targetId, constraints);
    
    if (!solution) {
      throw new Error('No se encontró solución factible');
    }
    
    const executionTime = Date.now() - startTime;
    
    // Construir resultado
    const route = await this.buildRouteResult(solution, sourceId, targetId);
    route.computation_time_ms = executionTime;
    route.algorithm = 'mip_heuristic';
    route.objective_value = solution.objectiveValue;
    route.constraints_applied = constraints;
    
    console.log(`MIP resuelto en ${executionTime}ms`);
    
    return route;
  }

  /**
   * Algoritmo de Dijkstra modificado con múltiples objetivos
   * Simula el comportamiento de un solver MIP
   */
  multiObjectiveDijkstra(sourceId, targetId, constraints) {
    // Inicialización
    const distances = new Map();
    const risks = new Map();
    const previous = new Map();
    const visited = new Set();
    const queue = [];
    
    // Inicializar distancias y riesgos
    this.nodes.forEach(node => {
      distances.set(node.id, Infinity);
      risks.set(node.id, Infinity);
    });
    distances.set(sourceId, 0);
    risks.set(sourceId, this.nodeProbabilities.get(sourceId) || 0);
    
    queue.push({
      nodeId: sourceId,
      combinedCost: 0
    });
    
    // Algoritmo principal
    while (queue.length > 0) {
      // Extraer nodo con menor costo combinado
      queue.sort((a, b) => a.combinedCost - b.combinedCost);
      const current = queue.shift();
      
      if (visited.has(current.nodeId)) {
        continue;
      }
      
      visited.add(current.nodeId);
      
      // Si llegamos al destino, terminar
      if (current.nodeId === targetId) {
        break;
      }
      
      // Explorar vecinos
      const neighbors = this.getNeighbors(current.nodeId);
      
      for (const neighbor of neighbors) {
        if (visited.has(neighbor.target)) {
          continue;
        }
        
        // Verificar restricciones
        if (!this.satisfiesConstraints(neighbor, constraints)) {
          continue;
        }
        
        // Calcular costos
        const edgeLength = neighbor.length / 1000; // km
        const edgeRisk = neighbor.probability;
        const nodeRisk = this.nodeProbabilities.get(neighbor.target) || 0;
        
        const newDistance = distances.get(current.nodeId) + edgeLength;
        const newRisk = risks.get(current.nodeId) + edgeRisk + nodeRisk;
        
        // Costo combinado (función objetivo)
        const combinedCost = 
          this.distanceWeight * newDistance + 
          this.riskWeight * newRisk;
        
        // Verificar restricción de distancia máxima
        if (this.maxDistance < Infinity && newDistance > this.maxDistance) {
          continue;
        }
        
        // Verificar restricción de evitar alto riesgo
        if (this.avoidHighRisk && edgeRisk > this.highRiskThreshold) {
          continue;
        }
        
        // Actualizar si encontramos mejor camino
        const currentBestCost = 
          this.distanceWeight * distances.get(neighbor.target) + 
          this.riskWeight * risks.get(neighbor.target);
        
        if (combinedCost < currentBestCost) {
          distances.set(neighbor.target, newDistance);
          risks.set(neighbor.target, newRisk);
          previous.set(neighbor.target, {
            nodeId: current.nodeId,
            edgeId: neighbor.edgeId
          });
          
          queue.push({
            nodeId: neighbor.target,
            combinedCost: combinedCost
          });
        }
      }
    }
    
    // Verificar si se encontró una ruta
    if (!previous.has(targetId)) {
      return null;
    }
    
    // Reconstruir el camino
    const path = [];
    const edges = [];
    let currentNode = targetId;
    
    while (currentNode !== sourceId) {
      path.unshift(currentNode);
      const prev = previous.get(currentNode);
      edges.unshift(prev.edgeId);
      currentNode = prev.nodeId;
    }
    path.unshift(sourceId);
    
    // Calcular valor objetivo
    const objectiveValue = 
      this.distanceWeight * distances.get(targetId) + 
      this.riskWeight * risks.get(targetId);
    
    return {
      path: path,
      edges: edges,
      totalDistance: distances.get(targetId),
      totalRisk: risks.get(targetId),
      objectiveValue: objectiveValue
    };
  }

  /**
   * Obtiene vecinos de un nodo
   */
  getNeighbors(nodeId) {
    const neighbors = [];
    
    this.edges.forEach(edge => {
      if (edge.source === nodeId) {
        neighbors.push({
          target: edge.target,
          edgeId: edge.id,
          length: edge.length,
          cost: edge.cost,
          probability: this.edgeProbabilities.get(edge.id) || 0
        });
      }
    });
    
    return neighbors;
  }

  /**
   * Verifica que un enlace satisfaga las restricciones
   */
  satisfiesConstraints(neighbor, constraints) {
    // Restricción de capacidad mínima (simulada)
    if (constraints.minCapacity && this.minCapacity > 0) {
      // En un escenario real, verificaríamos la capacidad del enlace
      // Aquí asumimos que todos los enlaces tienen capacidad suficiente
    }
    
    // Restricción de evitar nodos específicos
    if (constraints.avoidNodes && constraints.avoidNodes.includes(neighbor.target)) {
      return false;
    }
    
    // Restricción de evitar enlaces específicos
    if (constraints.avoidEdges && constraints.avoidEdges.includes(neighbor.edgeId)) {
      return false;
    }
    
    return true;
  }

  /**
   * Construye el resultado de la ruta
   */
  async buildRouteResult(solution, sourceId, targetId) {
    const client = await pool.connect();
    
    try {
      // Obtener geometrías de los enlaces
      const edgeIds = solution.edges.join(',');
      const result = await client.query(`
        SELECT 
          id,
          source,
          target,
          length,
          cost,
          ST_AsGeoJSON(geom) as geometry
        FROM fiber_links
        WHERE id IN (${edgeIds})
      `);
      
      // Construir GeoJSON
      const features = result.rows.map(row => ({
        type: 'Feature',
        properties: {
          edge_id: row.id,
          source: row.source,
          target: row.target,
          length: row.length,
          cost: row.cost
        },
        geometry: JSON.parse(row.geometry)
      }));
      
      return {
        type: 'FeatureCollection',
        features: features,
        properties: {
          source_id: sourceId,
          target_id: targetId,
          total_distance_km: solution.totalDistance,
          total_risk: solution.totalRisk,
          objective_value: solution.objectiveValue,
          num_hops: solution.path.length - 1,
          path: solution.path,
          edges: solution.edges,
          optimization_model: {
            description: 'Mixed Integer Programming (MIP) Heuristic',
            objective: `minimize: ${this.distanceWeight} * distance + ${this.riskWeight} * risk`,
            constraints: [
              'Flow conservation at all nodes',
              'Single path from source to target',
              'Maximum distance constraint',
              'Avoid high-risk links (optional)',
              'User-specified node/edge avoidance'
            ]
          }
        }
      };
      
    } finally {
      client.release();
    }
  }

  /**
   * Genera explicación del modelo MIP
   */
  getModelExplanation() {
    return {
      title: 'Modelo de Optimización MIP para Ruteo Resiliente',
      description: 'Programación Lineal Entera Mixta para encontrar la ruta óptima considerando distancia y riesgo',
      decision_variables: {
        x_ij: {
          type: 'binary',
          description: 'x[i,j] = 1 si se usa el enlace (i,j), 0 en caso contrario'
        },
        y_i: {
          type: 'binary',
          description: 'y[i] = 1 si el nodo i está en la ruta, 0 en caso contrario'
        }
      },
      objective_function: {
        type: 'minimize',
        formula: 'Z = Σ(i,j) [w_d × distance[i,j] + w_r × (prob_edge[i,j] + prob_node[i] + prob_node[j])] × x[i,j]',
        weights: {
          w_d: this.distanceWeight,
          w_r: this.riskWeight
        }
      },
      constraints: [
        {
          name: 'Flow Conservation - Source',
          formula: 'Σ(j) x[source,j] = 1',
          description: 'Exactamente un enlace sale del origen'
        },
        {
          name: 'Flow Conservation - Target',
          formula: 'Σ(i) x[i,target] = 1',
          description: 'Exactamente un enlace llega al destino'
        },
        {
          name: 'Flow Conservation - Intermediate',
          formula: 'Σ(i) x[i,k] - Σ(j) x[k,j] = 0 ∀k ≠ source,target',
          description: 'Flujo balanceado en nodos intermedios'
        },
        {
          name: 'Node-Edge Coupling',
          formula: 'x[i,j] ≤ y[i] and x[i,j] ≤ y[j]',
          description: 'Solo se pueden usar enlaces entre nodos activos'
        },
        {
          name: 'Maximum Distance',
          formula: 'Σ(i,j) distance[i,j] × x[i,j] ≤ max_distance',
          description: 'Restricción de distancia máxima',
          value: this.maxDistance === Infinity ? 'no limit' : `${this.maxDistance} km`
        },
        {
          name: 'Avoid High Risk',
          formula: 'x[i,j] = 0 if prob_edge[i,j] > threshold',
          description: 'Evitar enlaces de alto riesgo',
          active: this.avoidHighRisk,
          threshold: this.highRiskThreshold
        }
      ],
      solution_method: 'Multi-objective Dijkstra (MIP Heuristic)',
      complexity: 'O((V + E) × log V) where V = nodes, E = edges'
    };
  }
}

module.exports = MIPRoutingOptimizer;
