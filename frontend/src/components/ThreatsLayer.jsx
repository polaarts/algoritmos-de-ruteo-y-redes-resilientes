import { useEffect, useState } from 'react';
import { CircleMarker, GeoJSON, Popup } from 'react-leaflet';
import { threatsAPI } from '../services/api';

function ThreatsLayer({
  showEarthquakes = true,
  showFireZones = false,
  showWeatherEvents = false,
}) {
  const [earthquakes, setEarthquakes] = useState(null);
  const [fireZones, setFireZones] = useState(null);
  const [weatherEvents, setWeatherEvents] = useState(null);
  const [loading, setLoading] = useState(false);

  // Load earthquakes
  useEffect(() => {
    if (!showEarthquakes) {
      setEarthquakes(null);
      return;
    }

    const loadEarthquakes = async () => {
      setLoading(true);
      try {
        const response = await threatsAPI.getEarthquakes({
          min_magnitude: 4.0,
          limit: 500,
        });
        console.log('Earthquakes loaded:', response.data);
        setEarthquakes(response.data);
      } catch (err) {
        console.error('Error loading earthquakes:', err);
      } finally {
        setLoading(false);
      }
    };

    loadEarthquakes();
  }, [showEarthquakes]);

  // Load fire zones
  useEffect(() => {
    if (!showFireZones) {
      setFireZones(null);
      return;
    }

    const loadFireZones = async () => {
      try {
        const response = await threatsAPI.getFireZones({ limit: 100 });
        console.log('Fire zones loaded:', response.data);
        setFireZones(response.data);
      } catch (err) {
        console.error('Error loading fire zones:', err);
      }
    };

    loadFireZones();
  }, [showFireZones]);

  // Load weather events
  useEffect(() => {
    if (!showWeatherEvents) {
      setWeatherEvents(null);
      return;
    }

    const loadWeatherEvents = async () => {
      try {
        const response = await threatsAPI.getWeatherEvents({ limit: 100 });
        console.log('Weather events loaded:', response.data);
        setWeatherEvents(response.data);
      } catch (err) {
        console.error('Error loading weather events:', err);
      }
    };

    loadWeatherEvents();
  }, [showWeatherEvents]);

  // Get color based on earthquake magnitude
  const getEarthquakeColor = (magnitude) => {
    if (magnitude >= 7.0) return '#8b0000'; // critical - dark red
    if (magnitude >= 6.0) return '#ff0000'; // high - red
    if (magnitude >= 5.0) return '#ff6600'; // medium - orange
    return '#ffcc00'; // low - yellow
  };

  // Get radius based on magnitude
  const getEarthquakeRadius = (magnitude) => {
    return magnitude * 2;
  };

  // Style for fire zones
  const fireZoneStyle = (feature) => {
    const riskLevel = feature.properties.risk_level;
    let color = '#ffcc00';

    if (riskLevel === 'extreme') color = '#8b0000';
    else if (riskLevel === 'high') color = '#ff0000';
    else if (riskLevel === 'medium') color = '#ff6600';

    return {
      color,
      fillColor: color,
      weight: 2,
      fillOpacity: 0.3,
    };
  };

  // Popup for fire zones
  const onEachFireZone = (feature, layer) => {
    const props = feature.properties;

    const getRiskColor = (level) => {
      if (level === 'extreme') return '#8b0000';
      if (level === 'high') return '#ff0000';
      if (level === 'medium') return '#ff6600';
      return '#ffcc00';
    };

    const getRiskIcon = (level) => {
      if (level === 'extreme') return '🔥🔥🔥';
      if (level === 'high') return '🔥🔥';
      if (level === 'medium') return '🔥';
      return '⚠️';
    };

    const popupContent = `
      <div style="max-width: 280px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;">
        <h3 style="margin: 0 0 12px 0; color: #c0392b; border-bottom: 2px solid #ffcccc; padding-bottom: 8px;">
          ${getRiskIcon(props.risk_level)} Zona de Riesgo de Incendio
        </h3>
        <p style="margin: 6px 0; font-size: 13px;">
          <strong style="color: #333;">Nombre:</strong> ${props.zone_name || 'Sin nombre'}
        </p>
        <p style="margin: 6px 0; font-size: 13px;">
          <strong style="color: #333;">Nivel de riesgo:</strong>
          <span style="text-transform: uppercase; color: ${getRiskColor(props.risk_level)}; font-weight: bold; background: rgba(255,0,0,0.1); padding: 2px 8px; border-radius: 3px;">
            ${props.risk_level}
          </span>
        </p>
        <p style="margin: 6px 0; font-size: 13px;">
          <strong style="color: #333;">Área:</strong> ${props.area_km2?.toFixed(2) || 'N/A'} km²
        </p>
        ${props.vegetation_type ? `
          <p style="margin: 6px 0; font-size: 13px;">
            <strong style="color: #333;">Vegetación:</strong> ${props.vegetation_type}
          </p>
        ` : ''}
        ${props.last_fire_date ? `
          <p style="margin: 6px 0; font-size: 13px;">
            <strong style="color: #333;">Último incendio:</strong>
            ${new Date(props.last_fire_date).toLocaleDateString('es-CL')}
          </p>
        ` : ''}
        ${props.fire_frequency ? `
          <p style="margin: 6px 0; font-size: 13px;">
            <strong style="color: #333;">Frecuencia de incendios:</strong> ${props.fire_frequency}/año
          </p>
        ` : ''}
        <p style="margin: 12px 0 0 0; padding: 8px; background: #fff9e6; border-left: 3px solid #ffcc00; font-size: 12px; color: #666;">
          <strong>⚠️ Atención:</strong> Esta zona presenta alto riesgo de incendios forestales que pueden afectar la infraestructura de fibra óptica.
        </p>
      </div>
    `;
    layer.bindPopup(popupContent);
  };

  // Style for weather events
  const weatherEventStyle = (feature) => {
    const severity = feature.properties.severity;
    let color = '#00bfff';

    if (severity === 'extreme') color = '#8b0000';
    else if (severity === 'high') color = '#ff0000';
    else if (severity === 'medium') color = '#ff6600';

    return {
      color,
      fillColor: color,
      weight: 2,
      fillOpacity: 0.3,
    };
  };

  // Popup for weather events
  const onEachWeatherEvent = (feature, layer) => {
    const props = feature.properties;

    const getSeverityColor = (severity) => {
      if (severity === 'extreme') return '#8b0000';
      if (severity === 'high') return '#ff0000';
      if (severity === 'medium') return '#ff6600';
      return '#00bfff';
    };

    const getEventIcon = (eventType) => {
      const type = (eventType || '').toLowerCase();
      if (type.includes('storm') || type.includes('tormenta')) return '⛈️';
      if (type.includes('flood') || type.includes('inundación')) return '🌊';
      if (type.includes('snow') || type.includes('nieve')) return '❄️';
      if (type.includes('wind') || type.includes('viento')) return '💨';
      if (type.includes('rain') || type.includes('lluvia')) return '🌧️';
      return '🌪️';
    };

    const popupContent = `
      <div style="max-width: 280px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;">
        <h3 style="margin: 0 0 12px 0; color: #2c3e50; border-bottom: 2px solid #b3d9ff; padding-bottom: 8px;">
          ${getEventIcon(props.event_type)} Evento Climático Extremo
        </h3>
        <p style="margin: 6px 0; font-size: 13px;">
          <strong style="color: #333;">Tipo:</strong> ${props.event_type}
        </p>
        <p style="margin: 6px 0; font-size: 13px;">
          <strong style="color: #333;">Severidad:</strong>
          <span style="text-transform: uppercase; color: ${getSeverityColor(props.severity)}; font-weight: bold; background: rgba(0,0,255,0.1); padding: 2px 8px; border-radius: 3px;">
            ${props.severity}
          </span>
        </p>
        <p style="margin: 6px 0; font-size: 13px;">
          <strong style="color: #333;">Fecha:</strong> ${new Date(props.event_date).toLocaleDateString('es-CL')}
        </p>
        ${props.duration_hours ? `
          <p style="margin: 6px 0; font-size: 13px;">
            <strong style="color: #333;">Duración:</strong> ${props.duration_hours} horas
          </p>
        ` : ''}
        ${props.max_wind_speed ? `
          <p style="margin: 6px 0; font-size: 13px;">
            <strong style="color: #333;">Viento máximo:</strong> ${props.max_wind_speed} km/h
          </p>
        ` : ''}
        ${props.precipitation_mm ? `
          <p style="margin: 6px 0; font-size: 13px;">
            <strong style="color: #333;">Precipitación:</strong> ${props.precipitation_mm} mm
          </p>
        ` : ''}
        ${props.temperature_min || props.temperature_max ? `
          <p style="margin: 6px 0; font-size: 13px;">
            <strong style="color: #333;">Temperatura:</strong>
            ${props.temperature_min ? `${props.temperature_min}°C` : ''} ${props.temperature_min && props.temperature_max ? 'a' : ''} ${props.temperature_max ? `${props.temperature_max}°C` : ''}
          </p>
        ` : ''}
        ${props.description ? `
          <p style="margin: 10px 0 0 0; font-size: 12px; color: #555; font-style: italic;">
            ${props.description}
          </p>
        ` : ''}
        <p style="margin: 12px 0 0 0; padding: 8px; background: #e6f7ff; border-left: 3px solid #00bfff; font-size: 12px; color: #666;">
          <strong>💡 Impacto:</strong> Los eventos climáticos extremos pueden dañar cables aéreos y causar interrupciones en el servicio.
        </p>
      </div>
    `;
    layer.bindPopup(popupContent);
  };

  return (
    <>
      {loading && <div className="loading-indicator">Cargando amenazas...</div>}

      {/* Render earthquakes as circle markers */}
      {earthquakes && earthquakes.features && earthquakes.features.map((feature, idx) => {
        const coords = feature.geometry.coordinates;
        const props = feature.properties;
        // GeoJSON: [longitud, latitud], Leaflet: [latitud, longitud]
        const position = [coords[1], coords[0]];

        return (
          <CircleMarker
            key={`eq-${props.usgs_id || idx}`}
            center={position}
            radius={getEarthquakeRadius(props.magnitude)}
            pathOptions={{
              color: getEarthquakeColor(props.magnitude),
              fillColor: getEarthquakeColor(props.magnitude),
              fillOpacity: 0.5,
              weight: 2,
            }}
          >
            <Popup>
              <div style="max-width: 250px;">
                <h3 style="margin: 0 0 10px 0; color: #c0392b;">🔴 Sismo</h3>
                <p style="margin: 5px 0;"><strong>Magnitud:</strong> {props.magnitude}</p>
                <p style="margin: 5px 0;"><strong>Profundidad:</strong> {props.depth} km</p>
                <p style="margin: 5px 0;"><strong>Fecha:</strong> {new Date(props.time).toLocaleString()}</p>
                <p style="margin: 5px 0;"><strong>Lugar:</strong> {props.place}</p>
                <p style="margin: 5px 0;"><strong>Nivel de amenaza:</strong> <span style="text-transform: uppercase; color: {getEarthquakeColor(props.magnitude)}; font-weight: bold;">{props.threat_level}</span></p>
                {props.usgs_id && (
                  <p style="margin: 10px 0 0 0;">
                    <a
                      href={`https://earthquake.usgs.gov/earthquakes/eventpage/${props.usgs_id}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      style="color: #3498db;"
                    >
                      Ver en USGS →
                    </a>
                  </p>
                )}
              </div>
            </Popup>
          </CircleMarker>
        );
      })}

      {/* Render fire zones as polygons */}
      {fireZones && fireZones.features && fireZones.features.length > 0 && (
        <GeoJSON
          key={`fire-${fireZones.features.length}`}
          data={fireZones}
          style={fireZoneStyle}
          onEachFeature={onEachFireZone}
          coordsToLatLng={(coords) => {
            // GeoJSON: [longitud, latitud], Leaflet: [latitud, longitud]
            return [coords[1], coords[0]];
          }}
        />
      )}

      {/* Render weather events as polygons */}
      {weatherEvents && weatherEvents.features && weatherEvents.features.length > 0 && (
        <GeoJSON
          key={`weather-${weatherEvents.features.length}`}
          data={weatherEvents}
          style={weatherEventStyle}
          onEachFeature={onEachWeatherEvent}
          coordsToLatLng={(coords) => {
            // GeoJSON: [longitud, latitud], Leaflet: [latitud, longitud]
            return [coords[1], coords[0]];
          }}
        />
      )}
    </>
  );
}

export default ThreatsLayer;
