#!/usr/bin/env python3
"""
Optimizador MIP (Mixed Integer Programming) para ruteo resiliente
Minimiza: distancia + penalización por riesgo
Restricciones: conectividad, flujo de red
"""

import sys
import json
from mip import Model, xsum, minimize, BINARY, OptimizationStatus
import psycopg2
from datetime import datetime

DB_CONFIG = {
    'host': 'localhost',
    'port': '5432',
    'database': 'postgres',
    'user': 'postgres',
    'password': 'postgres'
}

def get_network_data(start_lat, start_lon, end_lat, end_lon, max_probability=0.7):
    """Obtiene datos de la red desde PostgreSQL"""
    conn = psycopg2.connect(**DB_CONFIG)
    cursor = conn.cursor()
    
    # Encontrar nodos más cercanos a origen y destino
    cursor.execute("""
        SELECT id, ST_Y(the_geom) as lat, ST_X(the_geom) as lon
        FROM nodes
        ORDER BY ST_Distance(
            the_geom::geography,
            ST_MakePoint(%s, %s)::geography
        )
        LIMIT 1
    """, (start_lon, start_lat))
    
    source_node = cursor.fetchone()
    if not source_node:
        raise Exception("No se encontró nodo origen")
    
    cursor.execute("""
        SELECT id, ST_Y(the_geom) as lat, ST_X(the_geom) as lon
        FROM nodes
        ORDER BY ST_Distance(
            the_geom::geography,
            ST_MakePoint(%s, %s)::geography
        )
        LIMIT 1
    """, (end_lon, end_lat))
    
    target_node = cursor.fetchone()
    if not target_node:
        raise Exception("No se encontró nodo destino")
    
    source_id = source_node[0]
    target_id = target_node[0]
    
    # Obtener edges con sus probabilidades
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
    
    return source_id, target_id, edges

def solve_mip(source_id, target_id, edges, risk_weight=1.0, time_limit=60):
    """
    Resuelve el problema de ruteo usando MIP
    
    Variables:
        x[i] = 1 si el edge i se usa en la ruta, 0 en caso contrario
        
    Objetivo:
        Minimizar suma(distancia[i] * x[i]) + risk_weight * suma(probabilidad[i] * x[i])
        
    Restricciones:
        - Conservación de flujo en cada nodo
        - Exactamente 1 unidad de flujo sale del origen
        - Exactamente 1 unidad de flujo entra al destino
    """
    
    print(f"🔧 Creando modelo MIP con {len(edges)} enlaces...")
    
    # Crear modelo
    model = Model(sense=minimize, solver_name='CBC')
    
    # Variables de decisión: x[edge_id] = 1 si se usa el edge
    x = {}
    for edge in edges:
        edge_id = edge[0]
        x[edge_id] = model.add_var(var_type=BINARY, name=f'x_{edge_id}')
    
    # Construir grafo (nodos y sus conexiones)
    nodes = set()
    outgoing = {}  # {node: [(edge_id, target_node)]}
    incoming = {}  # {node: [(edge_id, source_node)]}
    
    for edge in edges:
        edge_id, source, target, length, prob = edge
        nodes.add(source)
        nodes.add(target)
        
        if source not in outgoing:
            outgoing[source] = []
        outgoing[source].append((edge_id, target))
        
        if target not in incoming:
            incoming[target] = []
        incoming[target].append((edge_id, source))
    
    print(f"📊 Nodos: {len(nodes)}, Origen: {source_id}, Destino: {target_id}")
    
    # Función objetivo: minimizar distancia + riesgo
    obj_distance = xsum(edge[3] * x[edge[0]] for edge in edges)  # distancia
    obj_risk = xsum(edge[4] * x[edge[0]] for edge in edges)  # probabilidad
    
    model.objective = obj_distance + risk_weight * 10000 * obj_risk
    
    # Restricciones de flujo
    print("🔧 Agregando restricciones de flujo...")
    
    for node in nodes:
        out_edges = outgoing.get(node, [])
        in_edges = incoming.get(node, [])
        
        flow_out = xsum(x[edge_id] for edge_id, _ in out_edges)
        flow_in = xsum(x[edge_id] for edge_id, _ in in_edges)
        
        if node == source_id:
            # Origen: flujo saliente - flujo entrante = 1
            model += flow_out - flow_in == 1
        elif node == target_id:
            # Destino: flujo entrante - flujo saliente = 1
            model += flow_in - flow_out == 1
        else:
            # Nodos intermedios: flujo entrante = flujo saliente
            model += flow_in == flow_out
    
    # Resolver
    print(f"🚀 Optimizando (límite: {time_limit}s)...")
    model.max_seconds = time_limit
    model.verbose = 0
    
    start_time = datetime.now()
    status = model.optimize()
    end_time = datetime.now()
    
    computation_time = (end_time - start_time).total_seconds()
    
    # Procesar resultados
    if status == OptimizationStatus.OPTIMAL or status == OptimizationStatus.FEASIBLE:
        selected_edges = [edge for edge in edges if x[edge[0]].x >= 0.99]
        
        total_distance = sum(edge[3] for edge in selected_edges)
        total_risk = sum(edge[4] for edge in selected_edges)
        avg_risk = total_risk / len(selected_edges) if selected_edges else 0
        max_risk = max((edge[4] for edge in selected_edges), default=0)
        
        return {
            'status': 'optimal' if status == OptimizationStatus.OPTIMAL else 'feasible',
            'edges': [edge[0] for edge in selected_edges],
            'total_distance': total_distance,
            'total_edges': len(selected_edges),
            'avg_probability': avg_risk,
            'max_probability': max_risk,
            'computation_time': computation_time,
            'objective_value': model.objective_value
        }
    else:
        return {
            'status': 'infeasible',
            'error': 'No se encontró solución factible',
            'computation_time': computation_time
        }

def main():
    if len(sys.argv) < 5:
        print("Uso: python mip_optimizer.py <start_lat> <start_lon> <end_lat> <end_lon> [max_prob] [risk_weight]")
        sys.exit(1)
    
    start_lat = float(sys.argv[1])
    start_lon = float(sys.argv[2])
    end_lat = float(sys.argv[3])
    end_lon = float(sys.argv[4])
    max_prob = float(sys.argv[5]) if len(sys.argv) > 5 else 0.7
    risk_weight = float(sys.argv[6]) if len(sys.argv) > 6 else 1.0
    
    print("="*60)
    print("  OPTIMIZADOR MIP - Ruteo Resiliente")
    print("="*60)
    print(f"Origen: ({start_lat}, {start_lon})")
    print(f"Destino: ({end_lat}, {end_lon})")
    print(f"Probabilidad máxima: {max_prob}")
    print(f"Peso de riesgo: {risk_weight}")
    print()
    
    try:
        # Obtener datos de red
        source_id, target_id, edges = get_network_data(
            start_lat, start_lon, end_lat, end_lon, max_prob
        )
        
        # Resolver
        result = solve_mip(source_id, target_id, edges, risk_weight)
        
        # Imprimir resultados
        print("\n" + "="*60)
        print("  RESULTADOS")
        print("="*60)
        print(json.dumps(result, indent=2))
        
        return 0 if result['status'] in ['optimal', 'feasible'] else 1
        
    except Exception as e:
        print(f"\n❌ Error: {e}")
        import traceback
        traceback.print_exc()
        return 1

if __name__ == '__main__':
    sys.exit(main())
