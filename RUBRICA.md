# T3 Grupal - Rúbrica de Evaluación

## Criterios de Evaluación

1.- Cargue el sitio web desde consola, el cual permita generar rutas realistas, es decir, no debe generar líneas rectas entre dos puntos que no posea caminos entre ellos.

2.- La interfaz web deberá poder recibir los parámetros de consulta del usuario (junto a las restricciones del usuario) y detectar su geolocalización de forma automática (de forma alternativa, el usuario en caso de no dar permisos para compartir la geolocalización, podrá indicar la dirección a utilizar como inicio).

3.- La interfaz deberá ser capaz de cargar todos los metadatos y amenazas detectados (utilizar popups o algún otro mecanismo para desplegar la información que no se pueda visualizar como un polígono). Para habilitar o deshabilitar la información cargada, debe utilizar un panel de control que posea checkboxes.

4.- A partir de los datos obtenidos como amenaza, cada uno debe ser modelado como una probabilidad de falla en su sistema. Para esto, deberá crear un archivo que genere la probabilidad de fallo de cada enlace y nodo a partir de cada amenaza considerada en su trabajo.

5.- Deberá mostrar como solución la mejor ruta que satisfaga su problemática, utilizando y detallando el funcionamiento de las siguientes técnicas:

Pgr_dijkstra usando como peso solo la distancia en metros.
Utilizando CPLEX/GUROBI, a partir del modelamiento formal de su problema de optimización, considere las variables de los metadatos y amenazas, y las condiciones del usuario como restricciones.
Pgr_dijkstra utilizando los parámetros y condiciones propuestas en el punto anterior.
Una metaheurística u otro algoritmo que considere viable para solucionar su problemática.
Las 4 rutas generadas deben ser posibles de habilitar o deshabilitar desde su página web, con el fin de poder compararlas.

Deberá indicar el tiempo de cómputo en calcular cada ruta.

6.- A partir de las probabilidades asignadas, deberá habilitar una opción que permita, a partir de números aleatorios entre 0 y 100, determinar si ocurrirá o no la falla (a partir de si supera o no el umbral de falla).

7.- Deberá habilitar un checkbox que permita mostrar solo las amenazas que podrían ocurrir, en base al punto 6.

8.- Realizar un ejemplo de caso en donde se pueda evidenciar que su solución provee una ruta alternativa frente a una amenaza (mitigando lo más posible las amenazas), y que evidencie que se logra cumplir sus objetivos iniciales.

### 1. Infraestructura para Generación de Rutas Realistas
**Descripción:** Las rutas generadas son realistas, utilizando caminos existentes y evitando líneas rectas entre puntos.

**Calificaciones:**
- **6 para >0.0 pts - logra el 100%**: 6 pts
- **0 pts - no lo logra**: 0 pts

**Puntos totales:** 6 pts

---

### 2. Ingreso de restricciones
**Descripción:** Ingresa restricciones por plataforma

**Calificaciones:**
- **6 para >0.0 pts - logra el 100%**: 6 pts
- **0 pts - no lo logra**: 0 pts

**Puntos totales:** 6 pts

---

### 3. GPS
**Descripción:** Permite detectar automáticamente o manual

**Calificaciones:**
- **6 para >0.0 pts - logra el 100%**: 6 pts
- **0 pts - no lo logra**: 0 pts

**Puntos totales:** 6 pts

---

### 4. Muestra metadata
**Descripción:** popups o algo para identificar metadata

**Calificaciones:**
- **4 para >0.0 pts - logra el 100%**: 4 pts
- **0 pts - no lo logra**: 0 pts

**Puntos totales:** 4 pts

---

### 5. Muestra amenazas
**Descripción:** popups o algo para identificar amenazas

**Calificaciones:**
- **4 para >0.0 pts - logra el 100%**: 4 pts
- **0 pts - no lo logra**: 0 pts

**Puntos totales:** 4 pts

---

### 6. Checkboxes para habilitar
**Descripción:** checkboxes para habilitar

**Calificaciones:**
- **4 para >0.0 pts - logra el 100%**: 4 pts
- **0 pts - no lo logra**: 0 pts

**Puntos totales:** 4 pts

---

### 7. Modelado de Probabilidades de Fallo
**Descripción:** Se implementa un archivo que genera probabilidades de fallo a partir de amenazas detectadas.

**Calificaciones:**
- **8 para >0.0 pts - logra el 100%**: 8 pts
- **0 pts - no lo logra**: 0 pts

**Puntos totales:** 8 pts

---

### 8. Rutas - Pgr_dijkstra con solo distancia
**Descripción:** Pgr_dijkstra con solo distancia

**Calificaciones:**
- **4 para >0.0 pts - logra el 100%**: 4 pts
- **0 pts - no lo logra**: 0 pts

**Puntos totales:** 4 pts

---

### 9. Rutas - Detalla el funcionamiento de CPLEX con metadatos, amenazas restricciones
**Descripción:** detalla el funcionamiento de CPLEX con metadatos, amenazas restricciones

**Calificaciones:**
- **12 para >0.0 pts - logra el 100%**: 12 pts
- **0 pts - no lo logra**: 0 pts

**Puntos totales:** 12 pts

---

### 10. Rutas - Pgr_dijkstra con variables
**Descripción:** Pgr_dijkstra con variables

**Calificaciones:**
- **4 para >0.0 pts - logra el 100%**: 4 pts
- **0 pts - no lo logra**: 0 pts

**Puntos totales:** 4 pts

---

### 11. Rutas - Metaheurística
**Descripción:** metaheurística

**Calificaciones:**
- **4 para >0.0 pts - logra el 100%**: 4 pts
- **0 pts - no lo logra**: 0 pts

**Puntos totales:** 4 pts

---

### 12. Rutas - Checkboxes para habilitar rutas
**Descripción:** checkboxes para habilitar rutas

**Calificaciones:**
- **2 para >0.0 pts - logra el 100%**: 2 pts
- **0 pts - no lo logra**: 0 pts

**Puntos totales:** 2 pts

---

### 13. Tiempo
**Descripción:** indica tiempo de cómputo por ruta

**Calificaciones:**
- **4 para >0.0 pts - logra el 100%**: 4 pts
- **0 pts - no lo logra**: 0 pts

**Puntos totales:** 4 pts

---

### 14. Simulación de Fallas
**Descripción:** simulación de fallas con checkbox

**Calificaciones:**
- **8 para >0.0 pts - logra el 100%**: 8 pts
- **0 pts - no lo logra**: 0 pts

**Puntos totales:** 8 pts

---

### 15. Caso Ejemplo
**Descripción:** Presentación de un caso que evidencia funcionalidad frente a amenazas con rutas alternativas.

**Calificaciones:**
- **8 para >0.0 pts - logra el 100%**: 8 pts
- **0 pts - no lo logra**: 0 pts

**Puntos totales:** 8 pts

---

## Resumen de Puntos

| Criterio | Puntos Máximos |
|----------|----------------|
| Infraestructura para Generación de Rutas Realistas | 6 pts |
| Ingreso de restricciones | 6 pts |
| GPS | 6 pts |
| Muestra metadata | 4 pts |
| Muestra amenazas | 4 pts |
| Checkboxes para habilitar | 4 pts |
| Modelado de Probabilidades de Fallo | 8 pts |
| Rutas - Pgr_dijkstra con solo distancia | 4 pts |
| Rutas - CPLEX con metadatos, amenazas restricciones | 12 pts |
| Rutas - Pgr_dijkstra con variables | 4 pts |
| Rutas - Metaheurística | 4 pts |
| Rutas - Checkboxes para habilitar rutas | 2 pts |
| Tiempo | 4 pts |
| Simulación de Fallas | 8 pts |
| Caso Ejemplo | 8 pts |
| **TOTAL** | **84 pts** |