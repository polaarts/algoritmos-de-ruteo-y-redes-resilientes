#!/usr/bin/env python3
"""
Script super rápido: Usa SQL puro para calcular todo de una vez
"""

import psycopg2

DB_CONFIG = {
    'host': 'localhost',
    'port': '5432',
    'database': 'postgres',
    'user': 'postgres',
    'password': 'postgres'
}

def main():
    print("="*60)
    print("  CÁLCULO MASIVO DE PROBABILIDADES")
    print("="*60)
    
    conn = psycopg2.connect(**DB_CONFIG)
    print("✅ Conectado\n")
    
    cursor = conn.cursor()
    
    # Contar infraestructura
    cursor.execute("SELECT COUNT(*) FROM edges")
    total_edges = cursor.fetchone()[0]
    print(f"📊 Total de enlaces: {total_edges:,}")
    
    print("\n🔧 Calculando probabilidades (procesamiento masivo SQL)...\n")
    
    # Calcular todo en una sola query SQL usando la función
    # Procesar en bloques de 100 para ver progreso
    block_size = 100
    total_processed = 0
    
    try:
        while total_processed < total_edges:
            cursor.execute(f"""
                SELECT calculate_edge_probabilities(id, 200)
                FROM edges
                WHERE id > {total_processed}
                ORDER BY id
                LIMIT {block_size}
            """)
            
            results = cursor.fetchall()
            conn.commit()
            
            if not results:
                break
                
            total_processed += len(results)
            print(f"  ✓ Procesados {total_processed:,} / {total_edges:,} enlaces ({total_processed*100//total_edges}%)")
            
        print("\n✅ Cálculo completado!")
        
        # Estadísticas
        cursor.execute("""
            SELECT 
                COUNT(DISTINCT edge_id) as enlaces_con_prob,
                COUNT(*) as total_amenazas,
                ROUND(AVG(adjusted_probability)::numeric, 4) as prob_promedio,
                ROUND(MAX(adjusted_probability)::numeric, 4) as prob_maxima
            FROM edge_failure_probabilities
        """)
        
        row = cursor.fetchone()
        if row:
            print(f"\n📊 Resultados:")
            print(f"   - Enlaces analizados: {row[0]:,}")
            print(f"   - Amenazas detectadas: {row[1]:,}")
            print(f"   - Probabilidad promedio: {row[2]}")
            print(f"   - Probabilidad máxima: {row[3]}")
        
        # Probabilidades combinadas
        cursor.execute("""
            SELECT 
                COUNT(*) as total,
                ROUND(AVG(combined_probability)::numeric, 4) as promedio,
                ROUND(MAX(combined_probability)::numeric, 4) as maximo,
                COUNT(CASE WHEN combined_probability > 0.5 THEN 1 END) as alto_riesgo
            FROM edge_combined_probabilities
        """)
        
        row = cursor.fetchone()
        if row and row[0] > 0:
            print(f"\n📊 Probabilidades combinadas:")
            print(f"   - Enlaces con probabilidad: {row[0]:,}")
            print(f"   - Promedio: {row[1]}")
            print(f"   - Máximo: {row[2]}")
            print(f"   - Alto riesgo (>50%): {row[3]:,}")
            
    except Exception as e:
        print(f"\n❌ Error: {e}")
        conn.rollback()
    finally:
        cursor.close()
        conn.close()
        print("\n" + "="*60)

if __name__ == '__main__':
    main()
