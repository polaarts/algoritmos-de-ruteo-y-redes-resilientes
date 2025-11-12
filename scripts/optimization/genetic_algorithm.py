#!/usr/bin/env python3
"""
Algoritmo Genético para ruteo resiliente usando DEAP
Minimiza: distancia + riesgo
Cromosoma: secuencia de nodos desde origen a destino
"""

import sys
import json
import random
import psycopg2
from datetime import datetime
from deap import base, creator, tools, algorithms

DB_CONFIG = {
    'host': 'localhost',
    'port': '5432',
    'database': 'postgres',
    'user': 'postgres',
    'password': 'postgres'
}

class NetworkGraph:
    """Grafo de la red para búsqueda de rutas"""
    
    def __init__(self, edges):
        self.edges_by_id = {e[0]: e for e in edges}
        self.adjacency = {}  # {node: [(target_node, edge_id, distance, probability)]}
        
        for edge_id, source, target, distance, probability in edges:
            if source not in self.adjacency:
                self.adjacency[source] = []
            self.adjacency[source].append((target, edge_id, distance, probability))
    
    def get_neighbors(self, node):
        """Retorna vecinos de un nodo"""
        return self.adjacency.get(node, [])
    
    def find_random_path(self, source, target, max_length=100):
        """Encuentra un camino aleatorio desde source a target"""
        path = [source]
        current = source
        visited = {source}
        
        for _ in range(max_length):
            if current == target:
                return path
            
            neighbors = [(n, eid, d, p) for n, eid, d, p in self.get_neighbors(current) if n not in visited]
            
            if not neighbors:
                # Deadlock, reintentar desde el inicio
                return None
            
            # Seleccionar siguiente nodo (preferir nodos más cercanos al target)
            next_node, edge_id, dist, prob = random.choice(neighbors)
            path.append(next_node)
            visited.add(next_node)
            current = next_node
        
        return None

def get_network_data(start_lat, start_lon, end_lat, end_lon, max_probability=0.7):
    """Obtiene datos de la red desde PostgreSQL"""
    conn = psycopg2.connect(**DB_CONFIG)
    cursor = conn.cursor()
    
    # Encontrar nodos más cercanos
    cursor.execute("""
        SELECT id FROM nodes
        ORDER BY ST_Distance(the_geom::geography, ST_MakePoint(%s, %s)::geography)
        LIMIT 1
    """, (start_lon, start_lat))
    source_node = cursor.fetchone()[0]
    
    cursor.execute("""
        SELECT id FROM nodes
        ORDER BY ST_Distance(the_geom::geography, ST_MakePoint(%s, %s)::geography)
        LIMIT 1
    """, (end_lon, end_lat))
    target_node = cursor.fetchone()[0]
    
    # Obtener edges con probabilidades
    cursor.execute("""
        SELECT 
            e.id,
            e.source,
            e.target,
            e.length,
            COALESCE(ecp.combined_probability, 0.0) as probability
        FROM edges e
        LEFT JOIN edge_combined_probabilities ecp ON e.id = ecp.edge_id
        WHERE e.source IS NOT NULL 
        AND e.target IS NOT NULL
        AND COALESCE(ecp.combined_probability, 0.0) <= %s
    """, (max_probability,))
    
    edges = cursor.fetchall()
    cursor.close()
    conn.close()
    
    return source_node, target_node, edges

def evaluate_path(individual, graph, source, target, risk_weight=1.0):
    """
    Evalúa la calidad de un camino (individuo)
    Retorna: (distancia_total + riesgo_total * risk_weight,)
    """
    
    if len(individual) < 2:
        return (float('inf'),)
    
    if individual[0] != source or individual[-1] != target:
        return (float('inf'),)
    
    total_distance = 0
    total_risk = 0
    
    for i in range(len(individual) - 1):
        current_node = individual[i]
        next_node = individual[i + 1]
        
        # Buscar edge que conecte current_node con next_node
        neighbors = graph.get_neighbors(current_node)
        edge_found = False
        
        for neighbor, edge_id, distance, probability in neighbors:
            if neighbor == next_node:
                total_distance += distance
                total_risk += probability
                edge_found = True
                break
        
        if not edge_found:
            # Camino inválido
            return (float('inf'),)
    
    # Fitness: minimizar distancia + riesgo ponderado
    fitness = total_distance + risk_weight * 10000 * total_risk
    return (fitness,)

def mutate_path(individual, graph, source, target):
    """Mutación: reemplaza un segmento del camino"""
    if len(individual) < 3:
        return individual,
    
    # Seleccionar dos puntos aleatorios
    idx1 = random.randint(1, len(individual) - 2)
    idx2 = random.randint(idx1 + 1, len(individual) - 1)
    
    # Intentar encontrar camino alternativo entre idx1 e idx2
    start_segment = individual[idx1]
    end_segment = individual[idx2]
    
    # Búsqueda simple de camino alternativo (BFS limitado)
    new_segment = graph.find_random_path(start_segment, end_segment, max_length=10)
    
    if new_segment and len(new_segment) > 1:
        # Reemplazar segmento
        individual[idx1:idx2+1] = new_segment
    
    return individual,

def crossover_paths(ind1, ind2):
    """Cruzamiento: intercambia segmentos de dos caminos"""
    if len(ind1) < 2 or len(ind2) < 2:
        return ind1, ind2
    
    # Encontrar nodos comunes
    common_nodes = set(ind1) & set(ind2)
    
    if len(common_nodes) >= 2:
        common_list = list(common_nodes)
        node1 = random.choice(common_list)
        node2 = random.choice(common_list)
        
        idx1_a = ind1.index(node1)
        idx1_b = ind1.index(node2) if node2 in ind1 else len(ind1)
        idx2_a = ind2.index(node1)
        idx2_b = ind2.index(node2) if node2 in ind2 else len(ind2)
        
        # Intercambiar segmentos
        new_ind1 = ind1[:idx1_a] + ind2[idx2_a:idx2_b] + ind1[idx1_b:]
        new_ind2 = ind2[:idx2_a] + ind1[idx1_a:idx1_b] + ind2[idx2_b:]
        
        return new_ind1, new_ind2
    
    return ind1, ind2

def solve_genetic(source, target, edges, population_size=50, generations=100, risk_weight=1.0):
    """Resuelve el problema usando Algoritmo Genético"""
    
    print(f"🧬 Inicializando Algoritmo Genético...")
    print(f"   Población: {population_size}, Generaciones: {generations}")
    
    graph = NetworkGraph(edges)
    
    # Configurar DEAP
    creator.create("FitnessMin", base.Fitness, weights=(-1.0,))
    creator.create("Individual", list, fitness=creator.FitnessMin)
    
    toolbox = base.Toolbox()
    
    # Operador de creación de individuos
    def create_individual():
        path = graph.find_random_path(source, target, max_length=50)
        if path:
            return creator.Individual(path)
        else:
            return creator.Individual([source, target])
    
    toolbox.register("individual", create_individual)
    toolbox.register("population", tools.initRepeat, list, toolbox.individual)
    
    # Operadores genéticos
    toolbox.register("evaluate", evaluate_path, graph=graph, source=source, target=target, risk_weight=risk_weight)
    toolbox.register("mate", crossover_paths)
    toolbox.register("mutate", mutate_path, graph=graph, source=source, target=target)
    toolbox.register("select", tools.selTournament, tournsize=3)
    
    # Crear población inicial
    print("🔧 Creando población inicial...")
    population = toolbox.population(n=population_size)
    
    # Evaluar población inicial
    fitnesses = list(map(toolbox.evaluate, population))
    for ind, fit in zip(population, fitnesses):
        ind.fitness.values = fit
    
    print("🚀 Evolucionando...")
    start_time = datetime.now()
    
    # Evolución
    for gen in range(generations):
        # Selección
        offspring = toolbox.select(population, len(population))
        offspring = list(map(toolbox.clone, offspring))
        
        # Cruzamiento
        for child1, child2 in zip(offspring[::2], offspring[1::2]):
            if random.random() < 0.7:  # Probabilidad de cruzamiento
                toolbox.mate(child1, child2)
                del child1.fitness.values
                del child2.fitness.values
        
        # Mutación
        for mutant in offspring:
            if random.random() < 0.2:  # Probabilidad de mutación
                toolbox.mutate(mutant)
                del mutant.fitness.values
        
        # Evaluar nuevos individuos
        invalid_ind = [ind for ind in offspring if not ind.fitness.valid]
        fitnesses = map(toolbox.evaluate, invalid_ind)
        for ind, fit in zip(invalid_ind, fitnesses):
            ind.fitness.values = fit
        
        population[:] = offspring
        
        # Estadísticas
        fits = [ind.fitness.values[0] for ind in population if ind.fitness.values[0] != float('inf')]
        if fits and (gen % 20 == 0 or gen == generations - 1):
            best_fit = min(fits)
            avg_fit = sum(fits) / len(fits)
            print(f"  Gen {gen:3d}: Best={best_fit:.2f}, Avg={avg_fit:.2f}")
    
    end_time = datetime.now()
    computation_time = (end_time - start_time).total_seconds()
    
    # Mejor solución
    best_individual = tools.selBest(population, 1)[0]
    
    if best_individual.fitness.values[0] == float('inf'):
        return {
            'status': 'infeasible',
            'error': 'No se encontró solución válida',
            'computation_time': computation_time
        }
    
    # Convertir nodos a edges
    edge_ids = []
    total_distance = 0
    total_risk = 0
    
    for i in range(len(best_individual) - 1):
        current = best_individual[i]
        next_node = best_individual[i + 1]
        
        for neighbor, eid, dist, prob in graph.get_neighbors(current):
            if neighbor == next_node:
                edge_ids.append(eid)
                total_distance += dist
                total_risk += prob
                break
    
    return {
        'status': 'optimal',
        'edges': edge_ids,
        'total_distance': total_distance,
        'total_edges': len(edge_ids),
        'avg_probability': total_risk / len(edge_ids) if edge_ids else 0,
        'max_probability': max((graph.edges_by_id[eid][4] for eid in edge_ids), default=0),
        'computation_time': computation_time,
        'fitness_value': best_individual.fitness.values[0]
    }

def main():
    if len(sys.argv) < 5:
        print("Uso: python genetic_algorithm.py <start_lat> <start_lon> <end_lat> <end_lon> [max_prob] [risk_weight] [population] [generations]")
        sys.exit(1)
    
    start_lat = float(sys.argv[1])
    start_lon = float(sys.argv[2])
    end_lat = float(sys.argv[3])
    end_lon = float(sys.argv[4])
    max_prob = float(sys.argv[5]) if len(sys.argv) > 5 else 0.7
    risk_weight = float(sys.argv[6]) if len(sys.argv) > 6 else 1.0
    population_size = int(sys.argv[7]) if len(sys.argv) > 7 else 50
    generations = int(sys.argv[8]) if len(sys.argv) > 8 else 100
    
    print("="*60)
    print("  ALGORITMO GENÉTICO - Ruteo Resiliente")
    print("="*60)
    print(f"Origen: ({start_lat}, {start_lon})")
    print(f"Destino: ({end_lat}, {end_lon})")
    print(f"Probabilidad máxima: {max_prob}")
    print(f"Peso de riesgo: {risk_weight}")
    print()
    
    try:
        source, target, edges = get_network_data(start_lat, start_lon, end_lat, end_lon, max_prob)
        result = solve_genetic(source, target, edges, population_size, generations, risk_weight)
        
        print("\n" + "="*60)
        print("  RESULTADOS")
        print("="*60)
        print(json.dumps(result, indent=2))
        
        return 0 if result['status'] == 'optimal' else 1
        
    except Exception as e:
        print(f"\n❌ Error: {e}")
        import traceback
        traceback.print_exc()
        return 1

if __name__ == '__main__':
    sys.exit(main())
