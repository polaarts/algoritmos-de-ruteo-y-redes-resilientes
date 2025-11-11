# 📐 Modelo Probabilístico de Fallas

## Descripción General

Este documento describe el modelo matemático utilizado para calcular las probabilidades de falla de enlaces y nodos en la red de fibra óptica, basándose en amenazas naturales cercanas.

---

## Fórmula General

La probabilidad de falla de un enlace se calcula como:

```
P_falla(edge) = P_base(amenaza, distancia) × F_infraestructura × F_distancia
```

Donde:
- **P_base**: Probabilidad base según tipo y severidad de amenaza
- **F_infraestructura**: Factor multiplicador por características del enlace
- **F_distancia**: Factor de atenuación por distancia

---

## Probabilidades Base por Tipo de Amenaza

### 1. Sismos (Earthquakes)

Basado en magnitud (M) y distancia (d en km):

```
P_earthquake(d, M) = {
    1.0,                    si d < 10 km  y M ≥ 7.0
    0.8 × (1 - d/50),      si d < 50 km  y M ≥ 7.0
    0.5 × (1 - d/100),     si d < 100 km y M ≥ 7.0
    0.3 × (1 - d/200),     si d < 200 km y M ≥ 7.0
    
    0.7 × (1 - d/50),      si d < 50 km  y 6.0 ≤ M < 7.0
    0.4 × (1 - d/100),     si d < 100 km y 6.0 ≤ M < 7.0
    
    0.4 × (1 - d/50),      si d < 50 km  y 5.0 ≤ M < 6.0
    0.2 × (1 - d/100),     si d < 100 km y 5.0 ≤ M < 6.0
    
    0.2 × (1 - d/50),      si d < 50 km  y 4.0 ≤ M < 5.0
    
    0.0,                    en otro caso
}
```

**Justificación:**
- Sismos M≥7: Daño catastrófico en radio de 10km, severo hasta 50km
- Sismos M6-7: Daño considerable hasta 50km
- Atenuación lineal con la distancia

### 2. Incendios Forestales (Fire Zones)

Basado en nivel de riesgo y si el enlace está dentro/cerca de la zona:

```
P_fire(d, risk_level) = {
    0.90,                   si d = 0 (dentro) y risk = 'extreme'
    0.70,                   si d = 0 y risk = 'high'
    0.40,                   si d = 0 y risk = 'medium'
    0.10,                   si d = 0 y risk = 'low'
    
    0.7 × (1 - d/10),      si 0 < d < 10 km de zona 'extreme'
    0.5 × (1 - d/5),       si 0 < d < 5 km  de zona 'high'
    
    0.0,                    en otro caso
}
```

**Justificación:**
- Incendios afectan principalmente infraestructura dentro de la zona
- Zonas "extreme" tienen alta probabilidad de propagación (radio 10km)
- Zonas "high" con propagación menor (radio 5km)

### 3. Eventos Climáticos (Weather Events)

Basado en severidad del evento y si está dentro del área afectada:

```
P_weather(d, severity) = {
    0.80,                   si d = 0 (dentro) y severity = 'extreme'
    0.60,                   si d = 0 y severity = 'high'
    0.30,                   si d = 0 y severity = 'medium'
    0.10,                   si d = 0 y severity = 'low'
    
    0.6 × (1 - d/20),      si 0 < d < 20 km de evento 'extreme'
    0.4 × (1 - d/15),      si 0 < d < 15 km de evento 'high'
    0.2 × (1 - d/10),      si 0 < d < 10 km de evento 'medium'
    
    0.0,                    en otro caso
}
```

**Justificación:**
- Tormentas, inundaciones, nevadas afectan áreas delimitadas
- Eventos extremos pueden tener efectos hasta 20km (inundaciones, vientos)

---

## Factores Modificadores de Infraestructura

### F_infraestructura

Se calculan factores multiplicativos basados en características del enlace:

```
F_infraestructura = F_estructura × F_recubrimiento × F_superficie
```

#### Factor por Estructura (F_estructura):
- **Puente** (`bridge=true`): 1.5× (más vulnerable a sismos)
- **Túnel** (`tunnel=true`): 1.3× (vulnerable a derrumbes)
- **Normal**: 1.0×

#### Factor por Recubrimiento (F_recubrimiento):
- **Reforzado**: 0.7× (mejor protección)
- **Básico**: 1.2× (protección estándar)
- **Expuesto**: 1.5× (alta vulnerabilidad)
- **No especificado**: 1.0×

#### Factor por Superficie (F_superficie):
- **Pavimentada** (`paved`): 0.9× (mejor estabilidad)
- **Sin pavimentar** (`unpaved`): 1.3× (más vulnerable)
- **Grava** (`gravel`): 1.2×
- **Otra**: 1.0×

**Ejemplo:**
Un enlace que es puente + recubrimiento básico + pavimentado:
```
F_infra = 1.5 × 1.2 × 0.9 = 1.62
```

---

## Probabilidad Combinada (Múltiples Amenazas)

Cuando un enlace está expuesto a múltiples amenazas, usamos el **teorema de probabilidades independientes**:

```
P_total = 1 - ∏(1 - P_i)
      = 1 - (1 - P₁) × (1 - P₂) × ... × (1 - Pₙ)
```

Donde P_i es la probabilidad de falla por la amenaza i.

**Ejemplo:**
- Amenaza 1 (sismo): P₁ = 0.20
- Amenaza 2 (incendio): P₂ = 0.15
- Amenaza 3 (clima): P₃ = 0.10

```
P_total = 1 - (1 - 0.20) × (1 - 0.15) × (1 - 0.10)
        = 1 - (0.80 × 0.85 × 0.90)
        = 1 - 0.612
        = 0.388 (38.8%)
```

---

## Cálculo en la Práctica

### Paso 1: Identificar Amenazas Cercanas

Para cada enlace, buscar amenazas en un radio (default: 200 km):

```sql
SELECT * FROM earthquakes e
WHERE ST_DWithin(
    edge.geometry::geography,
    e.geometry::geography,
    200000  -- 200 km en metros
)
```

### Paso 2: Calcular Probabilidades Individuales

Para cada amenaza encontrada:

```sql
P_ajustada = calculate_threat_base_probability(...) 
           × get_infrastructure_factor(edge_id)
```

### Paso 3: Combinar Probabilidades

```sql
P_total = calculate_combined_probability(
    ARRAY_AGG(P_ajustada)
)
```

### Paso 4: Almacenar Resultados

- **edge_failure_probabilities**: Una fila por cada par (enlace, amenaza)
- **edge_combined_probabilities**: Una fila por enlace con P_total

---

## Uso en Algoritmos de Ruteo

### Ruteo Resiliente (Dijkstra con Penalización)

Modificamos el costo de los enlaces:

```
cost_ajustado = distancia × (1 + peso_riesgo × P_falla)
```

Donde:
- **distancia**: Longitud del enlace en metros
- **peso_riesgo** (k): Factor de penalización (default: 2.0)
- **P_falla**: Probabilidad combinada de falla [0, 1]

**Ejemplo:**
- Enlace de 1000m con P_falla = 0.3 y k = 2.0
```
cost = 1000 × (1 + 2.0 × 0.3)
     = 1000 × 1.6
     = 1600
```

El algoritmo "ve" este enlace como si fuera 60% más largo, favoreciendo rutas alternativas más seguras.

### Exclusión de Enlaces Peligrosos

Podemos excluir completamente enlaces con probabilidad muy alta:

```sql
WHERE P_falla < umbral_máximo  -- ej: 0.3 (30%)
```

---

## Validación y Calibración

### Parámetros Ajustables

Los siguientes parámetros pueden ajustarse según datos históricos reales:

1. **Radio de búsqueda de amenazas** (200 km)
2. **Coeficientes de probabilidad base** (0.8, 0.5, 0.3, etc.)
3. **Factores de infraestructura** (1.5 para puentes, etc.)
4. **Peso de riesgo en ruteo** (k = 2.0)

### Métricas de Validación

Si tienes datos históricos de fallas:

1. **Precisión**: % de fallas predichas correctamente
2. **Recall**: % de fallas reales que se detectaron
3. **Calibración**: Comparar P_predicha vs frecuencia_real

### Ejemplo de Calibración

Si un grupo de enlaces con P=0.30 fallan realmente en 25% de los casos:
- Ajustar coeficientes para acercar predicción a realidad
- P_nueva = P_vieja × (0.25 / 0.30) = P_vieja × 0.83

---

## Limitaciones y Consideraciones

### Limitaciones del Modelo

1. **Asume independencia entre amenazas** (puede no ser cierto)
2. **Factores de infraestructura son estimaciones** (requieren validación)
3. **No considera:**
   - Mantenimiento/edad de infraestructura
   - Redundancia de rutas
   - Tiempo de ocurrencia (estacional)
   - Efectos en cascada

### Mejoras Futuras

1. **Probabilidades temporales**: Considerar época del año
2. **Correlación entre amenazas**: Sismos + tsunamis
3. **Modelo de degradación**: Probabilidad aumenta con tiempo sin mantenimiento
4. **Machine Learning**: Entrenar modelo con datos reales
5. **Simulación Monte Carlo**: Validar predicciones

---

## Referencias Técnicas

### Funciones SQL Principales

- `calculate_threat_base_probability()`: Calcula P_base
- `get_infrastructure_factor()`: Calcula F_infra
- `calculate_combined_probability()`: Combina múltiples amenazas
- `calculate_edge_probabilities()`: Proceso completo para un enlace
- `calculate_all_edge_probabilities()`: Batch para toda la red

### Scripts Python

- `scripts/calculate_failure_probabilities.py`: Ejecuta cálculos masivos

### Tablas de Base de Datos

- `edge_failure_probabilities`: Detalles por amenaza
- `edge_combined_probabilities`: Resultado final por enlace
- `node_failure_probabilities`: (futuro) Para nodos

---

## Ejemplo Completo

### Escenario: Enlace en Concepción

**Enlace ID 1234:**
- Ubicación: Concepción (-36.8, -73.0)
- Tipo: Puente
- Recubrimiento: Básico
- Superficie: Pavimentado

**Amenazas cercanas:**

1. **Sismo M7.2** a 15 km
   ```
   P_base = 0.8 × (1 - 15/50) = 0.8 × 0.7 = 0.56
   F_infra = 1.5 (puente) × 1.2 (básico) × 0.9 (paved) = 1.62
   P₁ = 0.56 × 1.62 = 0.907 → limitado a 1.0
   ```

2. **Zona incendio "high"** (dentro)
   ```
   P_base = 0.70
   F_infra = 1.62
   P₂ = 0.70 × 1.62 = 1.134 → limitado a 1.0
   ```

3. **Tormenta "medium"** (dentro)
   ```
   P_base = 0.30
   F_infra = 1.62
   P₃ = 0.30 × 1.62 = 0.486
   ```

**Probabilidad combinada:**
```
P_total = 1 - (1 - 1.0) × (1 - 1.0) × (1 - 0.486)
        = 1 - 0 × 0 × 0.514
        = 1.0 (100%)
```

**Conclusión**: Este enlace tiene probabilidad extremadamente alta de falla. El algoritmo de ruteo resiliente lo evitará completamente.

---