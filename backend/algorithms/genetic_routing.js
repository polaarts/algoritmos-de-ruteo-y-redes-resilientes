/**
 * Algoritmo Genético para Optimización de Rutas en Redes de Fibra Óptica
 * 
 * Implementa un algoritmo genético que evoluciona poblaciones de rutas
 * para encontrar caminos óptimos considerando:
 * - Distancia total
 * - Probabilidades de falla de nodos y enlaces
 * - Restricciones del usuario
 * 
 * Fitness = α * distancia + β * riesgo_total + γ * penalizaciones
 */

const pool = require('../config/database');

class GeneticRoutingAlgorithm {
  constructor(config = {}) {
    // Parámetros del algoritmo genético
    this.populationSize = config.populationSize || 50;
    this.generations = config.generations || 100;
    this.mutationRate = config.mutationRate || 0.15;
    this.crossoverRate = config.crossoverRate || 0.7;
    this.elitismRate = config.elitismRate || 0.1;
    
    // Pesos para la función de fitness
    this.weightDistance = config.weightDistance || 0.4;
    this.weightRisk = config.weightRisk || 0.4;
    this.weightHops = config.weightHops || 0.2;
    
    // Datos de la red
    this.nodes = [];
    this.edges = [];
    this.nodeProbabilities = new Map();
    this.edgeProbabilities = new Map();
    this.adjacencyList = new Map();
  }

  /**
   * Inicializa el algoritmo cargando datos de la red
   */
  async initialize() {
    const client = await pool.connect();
    
    try {
      // Cargar nodos
      const nodesResult = await client.query(`
        SELECT id, osm_id, ST_X(geom::geometry) as lon, ST_Y(geom::geometry) as lat
        FROM fiber_nodes
      `);
      this.nodes = nodesResult.rows;
      
      // Cargar probabilidades de nodos
      const nodeProbsResult = await client.query(`
        SELECT node_id, total_failure_probability
        FROM node_probabilities
      `);
      nodeProbsResult.rows.forEach(row => {
        this.nodeProbabilities.set(row.node_id, parseFloat(row.total_failure_probability));
      });
      
      // Cargar enlaces
      const edgesResult = await client.query(`
        SELECT id, source, target, length, cost
        FROM fiber_links
      `);
      this.edges = edgesResult.rows;
      
      // Cargar probabilidades de enlaces
      const edgeProbsResult = await client.query(`
        SELECT edge_id, total_failure_probability
        FROM edge_probabilities
      `);
      edgeProbsResult.rows.forEach(row => {
        this.edgeProbabilities.set(row.edge_id, parseFloat(row.total_failure_probability));
      });
      
      // Construir lista de adyacencia
      this.buildAdjacencyList();
      
      console.log(`Red cargada: ${this.nodes.length} nodos, ${this.edges.length} enlaces`);
      
    } finally {
      client.release();
    }
  }

  /**
   * Construye la lista de adyacencia para búsqueda de vecinos
   */
  buildAdjacencyList() {
    this.adjacencyList.clear();
    
    this.edges.forEach(edge => {
      if (!this.adjacencyList.has(edge.source)) {
        this.adjacencyList.set(edge.source, []);
      }
      this.adjacencyList.get(edge.source).push({
        target: edge.target,
        edgeId: edge.id,
        length: edge.length,
        cost: edge.cost
      });
    });
  }

  /**
   * Encuentra la mejor ruta usando algoritmo genético
   */
  async findRoute(sourceId, targetId, options = {}) {
    const startTime = Date.now();
    
    // Validar que existan source y target
    if (!this.adjacencyList.has(sourceId)) {
      throw new Error(`Nodo origen ${sourceId} no existe en la red`);
    }
    
    // Generar población inicial
    let population = this.generateInitialPopulation(sourceId, targetId);
    
    if (population.length === 0) {
      throw new Error('No se pudo generar población inicial - sin rutas válidas');
    }
    
    console.log(`Población inicial: ${population.length} individuos`);
    
    let bestIndividual = null;
    let bestFitness = Infinity;
    let generationsWithoutImprovement = 0;
    const maxStagnation = 20;
    
    // Evolución
    for (let gen = 0; gen < this.generations; gen++) {
      // Calcular fitness
      population.forEach(individual => {
        individual.fitness = this.calculateFitness(individual);
      });
      
      // Ordenar por fitness (menor es mejor)
      population.sort((a, b) => a.fitness - b.fitness);
      
      // Actualizar mejor individuo
      if (population[0].fitness < bestFitness) {
        bestFitness = population[0].fitness;
        bestIndividual = JSON.parse(JSON.stringify(population[0]));
        generationsWithoutImprovement = 0;
      } else {
        generationsWithoutImprovement++;
      }
      
      // Criterio de parada por estancamiento
      if (generationsWithoutImprovement >= maxStagnation) {
        console.log(`Convergencia alcanzada en generación ${gen}`);
        break;
      }
      
      // Log cada 10 generaciones
      if (gen % 10 === 0) {
        console.log(`Gen ${gen}: Best fitness = ${bestFitness.toFixed(2)}`);
      }
      
      // Elitismo: mantener los mejores
      const eliteSize = Math.floor(this.populationSize * this.elitismRate);
      const newPopulation = population.slice(0, eliteSize);
      
      // Generar nueva población
      while (newPopulation.length < this.populationSize) {
        // Selección por torneo
        const parent1 = this.tournamentSelection(population);
        const parent2 = this.tournamentSelection(population);
        
        // Crossover
        let offspring;
        if (Math.random() < this.crossoverRate) {
          offspring = this.crossover(parent1, parent2, targetId);
        } else {
          offspring = Math.random() < 0.5 ? 
            JSON.parse(JSON.stringify(parent1)) : 
            JSON.parse(JSON.stringify(parent2));
        }
        
        // Mutación
        if (Math.random() < this.mutationRate) {
          offspring = this.mutate(offspring, sourceId, targetId);
        }
        
        // Validar y agregar
        if (this.isValidRoute(offspring, sourceId, targetId)) {
          newPopulation.push(offspring);
        }
      }
      
      population = newPopulation;
    }
    
    const executionTime = Date.now() - startTime;
    
    // Construir resultado
    const route = this.buildRouteResult(bestIndividual, sourceId, targetId);
    route.computation_time_ms = executionTime;
    route.algorithm = 'genetic';
    route.generations = this.generations;
    route.final_fitness = bestFitness;
    
    return route;
  }

  /**
   * Genera población inicial usando búsquedas aleatorias
   */
  generateInitialPopulation(sourceId, targetId) {
    const population = [];
    const maxAttempts = this.populationSize * 5;
    let attempts = 0;
    
    while (population.length < this.populationSize && attempts < maxAttempts) {
      attempts++;
      
      // Generar ruta aleatoria
      const route = this.generateRandomRoute(sourceId, targetId);
      
      if (route && route.path.length > 0) {
        population.push({
          path: route.path,
          edges: route.edges,
          fitness: 0
        });
      }
    }
    
    return population;
  }

  /**
   * Genera una ruta aleatoria usando búsqueda en profundidad modificada
   */
  generateRandomRoute(sourceId, targetId, maxDepth = 20) {
    const visited = new Set();
    const path = [sourceId];
    const edges = [];
    let currentNode = sourceId;
    
    for (let i = 0; i < maxDepth; i++) {
      visited.add(currentNode);
      
      if (currentNode === targetId) {
        return { path, edges };
      }
      
      const neighbors = this.adjacencyList.get(currentNode) || [];
      const unvisitedNeighbors = neighbors.filter(n => !visited.has(n.target));
      
      if (unvisitedNeighbors.length === 0) {
        return null; // Sin salida
      }
      
      // Selección aleatoria ponderada por distancia
      const nextEdge = this.selectRandomNeighbor(unvisitedNeighbors, targetId);
      
      edges.push(nextEdge.edgeId);
      path.push(nextEdge.target);
      currentNode = nextEdge.target;
    }
    
    return null; // No alcanzó el destino
  }

  /**
   * Selecciona vecino aleatorio con sesgo hacia el objetivo
   */
  selectRandomNeighbor(neighbors, targetId) {
    // 70% probabilidad: elegir el más cercano al target
    // 30% probabilidad: elegir aleatorio
    if (Math.random() < 0.7) {
      // Heurística: preferir nodos que acerquen al objetivo
      const targetNode = this.nodes.find(n => n.id === targetId);
      if (targetNode) {
        return neighbors.reduce((best, neighbor) => {
          const neighborNode = this.nodes.find(n => n.id === neighbor.target);
          if (!neighborNode) return best;
          
          const distToTarget = this.euclideanDistance(
            neighborNode.lon, neighborNode.lat,
            targetNode.lon, targetNode.lat
          );
          
          const bestNode = this.nodes.find(n => n.id === best.target);
          const bestDist = bestNode ? this.euclideanDistance(
            bestNode.lon, bestNode.lat,
            targetNode.lon, targetNode.lat
          ) : Infinity;
          
          return distToTarget < bestDist ? neighbor : best;
        }, neighbors[0]);
      }
    }
    
    return neighbors[Math.floor(Math.random() * neighbors.length)];
  }

  /**
   * Calcula distancia euclidiana
   */
  euclideanDistance(lon1, lat1, lon2, lat2) {
    return Math.sqrt(Math.pow(lon2 - lon1, 2) + Math.pow(lat2 - lat1, 2));
  }

  /**
   * Calcula el fitness de un individuo
   */
  calculateFitness(individual) {
    let totalDistance = 0;
    let totalRisk = 0;
    const numHops = individual.path.length - 1;
    
    // Sumar distancias y riesgos
    individual.edges.forEach(edgeId => {
      const edge = this.edges.find(e => e.id === edgeId);
      if (edge) {
        totalDistance += edge.length;
      }
      
      const edgeProb = this.edgeProbabilities.get(edgeId) || 0;
      totalRisk += edgeProb;
    });
    
    // Agregar riesgo de nodos
    individual.path.forEach(nodeId => {
      const nodeProb = this.nodeProbabilities.get(nodeId) || 0;
      totalRisk += nodeProb;
    });
    
    // Normalizar
    const normalizedDistance = totalDistance / 1000; // km
    const normalizedRisk = totalRisk;
    const normalizedHops = numHops;
    
    // Fitness = combinación ponderada
    const fitness = 
      this.weightDistance * normalizedDistance +
      this.weightRisk * normalizedRisk +
      this.weightHops * normalizedHops;
    
    return fitness;
  }

  /**
   * Selección por torneo
   */
  tournamentSelection(population, tournamentSize = 3) {
    const tournament = [];
    
    for (let i = 0; i < tournamentSize; i++) {
      const randomIndex = Math.floor(Math.random() * population.length);
      tournament.push(population[randomIndex]);
    }
    
    tournament.sort((a, b) => a.fitness - b.fitness);
    return tournament[0];
  }

  /**
   * Operador de crossover
   */
  crossover(parent1, parent2, targetId) {
    // Encontrar nodos en común (excepto source y target)
    const commonNodes = parent1.path.filter((node, idx) => 
      idx > 0 && 
      idx < parent1.path.length - 1 && 
      parent2.path.includes(node)
    );
    
    if (commonNodes.length === 0) {
      // Sin nodos en común, retornar uno de los padres
      return JSON.parse(JSON.stringify(parent1));
    }
    
    // Elegir punto de cruce aleatorio
    const crossoverNode = commonNodes[Math.floor(Math.random() * commonNodes.length)];
    
    // Construir hijo: parent1 hasta crossoverNode, luego parent2
    const idx1 = parent1.path.indexOf(crossoverNode);
    const idx2 = parent2.path.indexOf(crossoverNode);
    
    const childPath = [
      ...parent1.path.slice(0, idx1 + 1),
      ...parent2.path.slice(idx2 + 1)
    ];
    
    // Reconstruir lista de enlaces
    const childEdges = this.pathToEdges(childPath);
    
    return {
      path: childPath,
      edges: childEdges,
      fitness: 0
    };
  }

  /**
   * Convierte path de nodos a lista de edge IDs
   */
  pathToEdges(path) {
    const edges = [];
    
    for (let i = 0; i < path.length - 1; i++) {
      const source = path[i];
      const target = path[i + 1];
      
      const neighbors = this.adjacencyList.get(source) || [];
      const edge = neighbors.find(n => n.target === target);
      
      if (edge) {
        edges.push(edge.edgeId);
      }
    }
    
    return edges;
  }

  /**
   * Operador de mutación
   */
  mutate(individual, sourceId, targetId) {
    if (individual.path.length <= 2) {
      return individual; // No se puede mutar (solo source y target)
    }
    
    // Elegir punto de mutación aleatorio (no en extremos)
    const mutationPoint = 1 + Math.floor(Math.random() * (individual.path.length - 2));
    
    // Generar sub-ruta alternativa
    const fromNode = individual.path[mutationPoint - 1];
    const toNode = individual.path[mutationPoint + 1];
    
    const alternativePath = this.generateRandomRoute(fromNode, toNode, 5);
    
    if (alternativePath && alternativePath.path.length > 0) {
      // Reemplazar segmento
      const newPath = [
        ...individual.path.slice(0, mutationPoint),
        ...alternativePath.path.slice(1, -1),
        ...individual.path.slice(mutationPoint + 1)
      ];
      
      const newEdges = this.pathToEdges(newPath);
      
      return {
        path: newPath,
        edges: newEdges,
        fitness: 0
      };
    }
    
    return individual;
  }

  /**
   * Valida que una ruta sea válida
   */
  isValidRoute(individual, sourceId, targetId) {
    if (!individual.path || individual.path.length < 2) {
      return false;
    }
    
    if (individual.path[0] !== sourceId) {
      return false;
    }
    
    if (individual.path[individual.path.length - 1] !== targetId) {
      return false;
    }
    
    // Verificar que no haya ciclos
    const uniqueNodes = new Set(individual.path);
    if (uniqueNodes.size !== individual.path.length) {
      return false;
    }
    
    return true;
  }

  /**
   * Construye el resultado final de la ruta
   */
  async buildRouteResult(individual, sourceId, targetId) {
    const client = await pool.connect();
    
    try {
      // Obtener geometrías de los enlaces
      const edgeIds = individual.edges.join(',');
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
      
      // Calcular métricas
      const totalDistance = individual.edges.reduce((sum, edgeId) => {
        const edge = this.edges.find(e => e.id === edgeId);
        return sum + (edge ? edge.length : 0);
      }, 0);
      
      const totalRisk = individual.edges.reduce((sum, edgeId) => {
        return sum + (this.edgeProbabilities.get(edgeId) || 0);
      }, 0) + individual.path.reduce((sum, nodeId) => {
        return sum + (this.nodeProbabilities.get(nodeId) || 0);
      }, 0);
      
      return {
        type: 'FeatureCollection',
        features: features,
        properties: {
          source_id: sourceId,
          target_id: targetId,
          total_distance: totalDistance,
          total_risk: totalRisk,
          num_hops: individual.path.length - 1,
          path: individual.path,
          edges: individual.edges
        }
      };
      
    } finally {
      client.release();
    }
  }
}

module.exports = GeneticRoutingAlgorithm;
