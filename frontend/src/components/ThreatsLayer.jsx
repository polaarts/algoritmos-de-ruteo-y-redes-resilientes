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
    const popupContent = `
      <div>
        <h3>Zona de Riesgo de Incendio</h3>
        <p><strong>Nombre:</strong> ${props.zone_name || 'N/A'}</p>
        <p><strong>Nivel de riesgo:</strong> ${props.risk_level}</p>
        <p><strong>Área:</strong> ${props.area_km2} km²</p>
        <p><strong>Tipo de vegetación:</strong> ${props.vegetation_type || 'N/A'}</p>
        ${props.last_fire_date ? `<p><strong>Último incendio:</strong> ${new Date(props.last_fire_date).toLocaleDateString()}</p>` : ''}
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
    const popupContent = `
      <div>
        <h3>Evento Climático</h3>
        <p><strong>Tipo:</strong> ${props.event_type}</p>
        <p><strong>Severidad:</strong> ${props.severity}</p>
        <p><strong>Fecha:</strong> ${new Date(props.event_date).toLocaleDateString()}</p>
        ${props.duration_hours ? `<p><strong>Duración:</strong> ${props.duration_hours} horas</p>` : ''}
        ${props.max_wind_speed ? `<p><strong>Viento máximo:</strong> ${props.max_wind_speed} km/h</p>` : ''}
        ${props.precipitation_mm ? `<p><strong>Precipitación:</strong> ${props.precipitation_mm} mm</p>` : ''}
        ${props.description ? `<p>${props.description}</p>` : ''}
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
