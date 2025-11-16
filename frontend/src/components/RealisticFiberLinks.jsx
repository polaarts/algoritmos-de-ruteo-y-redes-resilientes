import { useEffect, useState } from 'react';
import { useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet-routing-machine';
import 'leaflet-routing-machine/dist/leaflet-routing-machine.css';

/**
 * Componente que genera rutas realistas de fibra óptica entre datacenters
 * usando Leaflet Routing Machine (que usa el servicio OSRM público)
 */
const RealisticFiberLinks = ({ enabled = true, region = 'Región del Biobío' }) => {
  const map = useMap();
  const [datacenters, setDatacenters] = useState([]);
  const [routingControls, setRoutingControls] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // Obtener datacenters de la región
  useEffect(() => {
    if (!enabled) return;

    const fetchDatacenters = async () => {
      setLoading(true);
      setError(null);
      
      try {
        const response = await fetch(`http://localhost:5000/api/infrastructure/datacenters?region=${encodeURIComponent(region)}`);
        
        if (!response.ok) {
          throw new Error(`Error ${response.status}: ${response.statusText}`);
        }
        
        const data = await response.json();
        setDatacenters(data);
        console.log(`✅ Cargados ${data.length} datacenters de ${region}`);
      } catch (err) {
        console.error('Error cargando datacenters:', err);
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    fetchDatacenters();
  }, [enabled, region]);

  // Generar rutas realistas entre datacenters
  useEffect(() => {
    if (!enabled || !map || datacenters.length < 2) return;

    // Limpiar rutas anteriores
    routingControls.forEach(control => {
      try {
        map.removeControl(control);
      } catch (e) {
        // Control ya removido
      }
    });

    const newControls = [];
    let routesCreated = 0;
    const totalPairs = (datacenters.length * (datacenters.length - 1)) / 2;

    console.log(`🌐 Generando ${totalPairs} rutas realistas entre datacenters...`);

    // Generar rutas entre todos los pares de datacenters
    for (let i = 0; i < datacenters.length; i++) {
      for (let j = i + 1; j < datacenters.length; j++) {
        const dc1 = datacenters[i];
        const dc2 = datacenters[j];

        // Extraer coordenadas (pueden venir en diferentes formatos)
        const coords1 = getCoordinates(dc1);
        const coords2 = getCoordinates(dc2);

        if (!coords1 || !coords2) {
          console.warn(`⚠️ Coordenadas inválidas para ${dc1.city} o ${dc2.city}`);
          continue;
        }

        // Crear control de routing
        const routingControl = L.Routing.control({
          waypoints: [
            L.latLng(coords1[1], coords1[0]), // lat, lon
            L.latLng(coords2[1], coords2[0])
          ],
          router: L.Routing.osrmv1({
            serviceUrl: 'https://router.project-osrm.org/route/v1',
            profile: 'driving'
          }),
          lineOptions: {
            styles: [
              { 
                color: '#2563eb', // Azul para fibra óptica
                opacity: 0.6,
                weight: 3
              }
            ],
            extendToWaypoints: true,
            missingRouteTolerance: 0
          },
          show: false, // No mostrar panel de instrucciones
          addWaypoints: false, // No permitir agregar waypoints
          routeWhileDragging: false,
          draggableWaypoints: false,
          fitSelectedRoutes: false,
          showAlternatives: false,
          createMarker: () => null // No crear marcadores
        });

        routingControl.on('routesfound', (e) => {
          const route = e.routes[0];
          const distanceKm = (route.summary.totalDistance / 1000).toFixed(2);
          console.log(`  ✅ Ruta ${dc1.city} ↔ ${dc2.city}: ${distanceKm} km`);
          routesCreated++;
          
          if (routesCreated === totalPairs) {
            console.log(`🎉 ${routesCreated} rutas realistas generadas exitosamente`);
          }
        });

        routingControl.on('routingerror', (e) => {
          console.error(`  ❌ Error en ruta ${dc1.city} ↔ ${dc2.city}:`, e.error);
        });

        routingControl.addTo(map);
        newControls.push(routingControl);
      }
    }

    setRoutingControls(newControls);

    // Cleanup al desmontar
    return () => {
      newControls.forEach(control => {
        try {
          map.removeControl(control);
        } catch (e) {
          // Control ya removido
        }
      });
    };
  }, [enabled, map, datacenters]);

  // Helper para extraer coordenadas del datacenter
  function getCoordinates(datacenter) {
    // Intentar diferentes formatos
    if (datacenter.lon !== undefined && datacenter.lat !== undefined) {
      return [datacenter.lon, datacenter.lat];
    }
    
    if (datacenter.location) {
      // Si es un objeto PostGIS parseado
      if (datacenter.location.x !== undefined && datacenter.location.y !== undefined) {
        return [datacenter.location.x, datacenter.location.y];
      }
      
      // Si es una string WKT: "POINT(lon lat)"
      if (typeof datacenter.location === 'string') {
        const match = datacenter.location.match(/POINT\(([^ ]+) ([^ ]+)\)/);
        if (match) {
          return [parseFloat(match[1]), parseFloat(match[2])];
        }
      }
    }
    
    return null;
  }

  // Renderizar estado de carga/error
  if (loading) {
    return (
      <div style={{
        position: 'absolute',
        top: '10px',
        right: '10px',
        background: 'rgba(255, 255, 255, 0.9)',
        padding: '10px 15px',
        borderRadius: '4px',
        boxShadow: '0 2px 4px rgba(0,0,0,0.2)',
        zIndex: 1000
      }}>
        🔄 Cargando datacenters...
      </div>
    );
  }

  if (error) {
    return (
      <div style={{
        position: 'absolute',
        top: '10px',
        right: '10px',
        background: 'rgba(255, 59, 48, 0.9)',
        color: 'white',
        padding: '10px 15px',
        borderRadius: '4px',
        boxShadow: '0 2px 4px rgba(0,0,0,0.2)',
        zIndex: 1000
      }}>
        ❌ Error: {error}
      </div>
    );
  }

  if (enabled && datacenters.length > 0) {
    return (
      <div style={{
        position: 'absolute',
        top: '10px',
        right: '10px',
        background: 'rgba(37, 99, 235, 0.9)',
        color: 'white',
        padding: '8px 12px',
        borderRadius: '4px',
        boxShadow: '0 2px 4px rgba(0,0,0,0.2)',
        zIndex: 1000,
        fontSize: '12px'
      }}>
        🗺️ {datacenters.length} DCs - {(datacenters.length * (datacenters.length - 1)) / 2} rutas
      </div>
    );
  }

  return null;
};

export default RealisticFiberLinks;
