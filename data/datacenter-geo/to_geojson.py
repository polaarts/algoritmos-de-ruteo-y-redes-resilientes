import json
import re
import sys
from typing import List, Dict, Any

def parse_txt_to_geojson(input_file: str, output_file: str) -> None:
    """
    Convierte un archivo TXT con datos de centros de datos a formato GeoJSON válido.
    
    Args:
        input_file (str): Ruta del archivo TXT de entrada
        output_file (str): Ruta del archivo GeoJSON de salida
    """
    
    try:
        # Leer el contenido del archivo
        with open(input_file, 'r', encoding='utf-8') as file:
            content = file.read()
        
        print(f"📄 Contenido del archivo leído ({len(content)} caracteres)")
        
        # Preparar la estructura base del GeoJSON
        geojson_data = {
            "type": "FeatureCollection",
            "features": []
        }
        
        # Intentar diferentes estrategias para parsear el contenido
        features = extract_features_from_content(content)
        
        for i, feature in enumerate(features):
            print(f"🔍 Procesando feature {i+1}...")
            validated_feature = validate_and_fix_feature(feature)
            
            if validated_feature:
                geojson_data["features"].append(validated_feature)
                print(f"✅ Feature {i+1} procesado correctamente")
            else:
                print(f"❌ Feature {i+1} no pudo ser procesado")
        
        # Guardar el GeoJSON resultante preservando todos los decimales
        with open(output_file, 'w', encoding='utf-8') as file:
            json.dump(geojson_data, file, ensure_ascii=False, indent=2, separators=(',', ': '))
        
        print(f"\n✅ Conversión exitosa!")
        print(f"📊 Features procesados: {len(geojson_data['features'])}")
        print(f"📁 Archivo GeoJSON guardado en: {output_file}")
        
    except FileNotFoundError:
        print(f"❌ Error: No se pudo encontrar el archivo {input_file}")
    except Exception as e:
        print(f"❌ Error inesperado: {e}")

def extract_features_from_content(content: str) -> List[Dict[str, Any]]:
    """
    Extrae features del contenido usando múltiples estrategias.
    
    Args:
        content (str): Contenido del archivo
        
    Returns:
        List[Dict]: Lista de features extraídos
    """
    features = []
    
    # Estrategia 1: Intentar parsear como JSON completo
    try:
        if content.strip().startswith('{') or content.strip().startswith('['):
            parsed_data = json.loads(content)
            if isinstance(parsed_data, dict) and 'features' in parsed_data:
                return parsed_data['features']
            elif isinstance(parsed_data, list):
                return parsed_data
            elif isinstance(parsed_data, dict) and parsed_data.get('type') == 'Feature':
                return [parsed_data]
    except json.JSONDecodeError:
        print("⚠️  No se pudo parsear como JSON completo, intentando otras estrategias...")
    
    # Estrategia 2: Buscar objetos JSON individuales línea por línea
    lines = content.split('\n')
    current_feature = ""
    brace_count = 0
    
    for line in lines:
        line = line.strip()
        if not line:
            continue
            
        current_feature += line + "\n"
        
        # Contar llaves para determinar cuándo termina un objeto JSON
        brace_count += line.count('{') - line.count('}')
        
        # Si las llaves están balanceadas, intentar parsear
        if brace_count == 0 and current_feature.strip():
            try:
                feature_dict = json.loads(current_feature.strip())
                features.append(feature_dict)
                current_feature = ""
            except json.JSONDecodeError:
                # Si falla, intentar reparar
                repaired = repair_json_string(current_feature.strip())
                if repaired:
                    features.append(repaired)
                current_feature = ""
    
    # Estrategia 3: Usar regex para encontrar patrones de features
    if not features:
        feature_pattern = r'\{[^{}]*"type"\s*:\s*"Feature"[^{}]*(?:\{[^{}]*\}[^{}]*)*\}'
        matches = re.findall(feature_pattern, content, re.DOTALL)
        
        for match in matches:
            try:
                feature_dict = json.loads(match)
                features.append(feature_dict)
            except json.JSONDecodeError:
                repaired = repair_json_string(match)
                if repaired:
                    features.append(repaired)
    
    # Estrategia 4: Extraer datos usando regex si todo lo demás falla
    if not features:
        print("🔧 Intentando extraer datos usando patrones regex...")
        regex_features = extract_with_regex(content)
        features.extend(regex_features)
    
    return features

def repair_json_string(json_str: str) -> Dict[str, Any]:
    """
    Intenta reparar un string JSON mal formateado.
    
    Args:
        json_str (str): String JSON a reparar
        
    Returns:
        Dict: Objeto JSON reparado o None
    """
    try:
        # Limpiar caracteres problemáticos
        cleaned = json_str.strip()
        
        # Arreglar comas faltantes
        cleaned = re.sub(r'"\s*\n\s*"', '",\n"', cleaned)
        
        # Arreglar comillas faltantes en valores
        cleaned = re.sub(r':\s*([^",\[\{\s][^",\[\}]*[^",\[\}\s])\s*[,\}]', r': "\1"', cleaned)
        
        # Arreglar comillas en claves
        cleaned = re.sub(r'([a-zA-Z_][a-zA-Z0-9_]*)\s*:', r'"\1":', cleaned)
        
        # Intentar parsear el JSON reparado
        return json.loads(cleaned)
        
    except json.JSONDecodeError:
        return None
    except Exception:
        return None

def extract_with_regex(content: str) -> List[Dict[str, Any]]:
    """
    Extrae datos usando patrones regex cuando el JSON está muy mal formateado.
    
    Args:
        content (str): Contenido a procesar
        
    Returns:
        List[Dict]: Lista de features extraídos
    """
    features = []
    
    # Patrones para extraer datos comunes
    patterns = {
        'name': r'"name"\s*:\s*"([^"]*)"',
        'company_name': r'"company_name"\s*:\s*"([^"]*)"',
        'address': r'"address"\s*:\s*"([^"]*)"',
        'city': r'"city"\s*:\s*"([^"]*)"',
        'state': r'"state"\s*:\s*"([^"]*)"',
        'country': r'"country"\s*:\s*"([^"]*)"',
        'latitude': r'"latitude"\s*:\s*([0-9.-]+)',
        'longitude': r'"longitude"\s*:\s*([0-9.-]+)',
        'coordinates': r'"coordinates"\s*:\s*\[([^\]]+)\]'
    }
    
    # Dividir el contenido en secciones que podrían ser features
    sections = re.split(r'\n\s*\n', content)
    
    for section in sections:
        if 'name' in section or 'coordinates' in section:
            extracted_data = {}
            
            for key, pattern in patterns.items():
                match = re.search(pattern, section, re.IGNORECASE)
                if match:
                    if key in ['latitude', 'longitude']:
                        extracted_data[key] = float(match.group(1))
                    elif key == 'coordinates':
                        coords_str = match.group(1)
                        try:
                            coords = [float(x.strip()) for x in coords_str.split(',')]
                            if len(coords) == 2:
                                extracted_data[key] = coords
                        except ValueError:
                            continue
                    else:
                        extracted_data[key] = match.group(1)
            
            # Crear feature si tenemos datos suficientes
            if 'name' in extracted_data:
                feature = create_feature_from_data(extracted_data)
                if feature:
                    features.append(feature)
    
    return features

def create_feature_from_data(data: Dict[str, Any]) -> Dict[str, Any]:
    """
    Crea un feature GeoJSON a partir de datos extraídos.
    
    Args:
        data (Dict): Datos extraídos
        
    Returns:
        Dict: Feature GeoJSON
    """
    # Determinar coordenadas con prioridades claras
    coordinates = None
    
    # Prioridad 1: latitude/longitude explícitos
    if 'latitude' in data and 'longitude' in data:
        try:
            # Preservar valores originales sin redondear
            lat_original = data['latitude']
            lon_original = data['longitude']
            
            # Convertir para validación pero mantener originales
            lat = float(lat_original) if not isinstance(lat_original, (int, float)) else lat_original
            lon = float(lon_original) if not isinstance(lon_original, (int, float)) else lon_original
            
            if is_valid_coordinate(lat, lon):
                coordinates = [lon_original, lat_original]  # GeoJSON format: [longitude, latitude]
                print(f"📍 Coordenadas desde lat/lon: Lat={lat_original}, Lon={lon_original}")
        except (ValueError, TypeError):
            pass
    
    # Prioridad 2: array de coordinates (verificando orden)
    if not coordinates and 'coordinates' in data:
        coords = data['coordinates']
        if isinstance(coords, list) and len(coords) == 2:
            try:
                # Preservar valores originales
                coord1_original = coords[0]
                coord2_original = coords[1]
                
                # Convertir para validación pero mantener originales
                coord1 = float(coord1_original) if not isinstance(coord1_original, (int, float)) else coord1_original
                coord2 = float(coord2_original) if not isinstance(coord2_original, (int, float)) else coord2_original
                
                # En Chile, las longitudes son negativas (oeste) y las latitudes negativas (sur)
                # Longitud de Chile: aproximadamente -109° a -66°
                # Latitud de Chile: aproximadamente -56° a -17°
                
                if is_chile_coordinate(coord2, coord1):  # coord1=lon, coord2=lat
                    coordinates = [coord1_original, coord2_original]
                    print(f"📍 Coordenadas desde array [lon,lat]: Lat={coord2_original}, Lon={coord1_original}")
                elif is_chile_coordinate(coord1, coord2):  # coord1=lat, coord2=lon  
                    coordinates = [coord2_original, coord1_original]
                    print(f"📍 Coordenadas desde array [lat,lon] (intercambiadas): Lat={coord1_original}, Lon={coord2_original}")
                else:
                    print(f"⚠️ Coordenadas fuera del rango de Chile: {coord1_original}, {coord2_original}")
                    
            except (ValueError, TypeError):
                pass
    
    if not coordinates:
        print("❌ No se pudieron determinar coordenadas válidas")
        return None
    
    # Crear properties excluyendo coordenadas
    properties = {}
    for key, value in data.items():
        if key not in ['coordinates', 'latitude', 'longitude']:
            properties[key] = value
    
    return {
        "type": "Feature",
        "geometry": {
            "type": "Point",
            "coordinates": coordinates
        },
        "properties": properties
    }

def is_chile_coordinate(lat: float, lon: float) -> bool:
    """
    Valida si las coordenadas están dentro del territorio de Chile.
    
    Args:
        lat (float): Latitud
        lon (float): Longitud
        
    Returns:
        bool: True si las coordenadas están en Chile
    """
    # Rangos aproximados de Chile (incluyendo territorio antártico e islas)
    # Latitud: desde -56° (Cabo de Hornos) hasta -17° (frontera con Perú)
    # Longitud: desde -109° (Isla de Pascua) hasta -66° (frontera con Argentina/Bolivia)
    
    lat_valid = -56 <= lat <= -17
    lon_valid = -109 <= lon <= -66
    
    if lat_valid and lon_valid:
        return True
    
    # También aceptar coordenadas válidas generales si no están en Chile
    # (podría ser un error en los datos o centros fuera de Chile)
    return is_valid_coordinate(lat, lon)

def validate_and_fix_feature(feature: Dict[str, Any]) -> Dict[str, Any]:
    """
    Valida y corrige la estructura de un feature GeoJSON.
    
    Args:
        feature (Dict): Feature a validar
        
    Returns:
        Dict: Feature corregido o None si no se puede reparar
    """
    
    # Estructura básica requerida
    if not isinstance(feature, dict) or feature.get("type") != "Feature":
        return None
    
    # Validar geometría
    geometry = feature.get("geometry", {})
    properties = feature.get("properties", {})
    
    # Intentar obtener coordenadas de diferentes fuentes
    coordinates = extract_coordinates(geometry, properties)
    
    if not coordinates:
        print("❌ No se pudieron extraer coordenadas válidas")
        return None
    
    lon, lat = coordinates
    print(f"📍 Coordenadas encontradas: Lat={lat}, Lon={lon}")
    
    # Validar propiedades
    if not isinstance(properties, dict):
        properties = {}
    
    # Limpiar campos vacíos en properties
    cleaned_properties = {}
    for key, value in properties.items():
        if value != "" and value is not None and key not in ['latitude', 'longitude']:
            # Limpiar strings
            if isinstance(value, str):
                value = value.strip()
                if value:
                    cleaned_properties[key] = value
            else:
                cleaned_properties[key] = value
    
    return {
        "type": "Feature",
        "geometry": {
            "type": "Point",
            "coordinates": [lon, lat]  # GeoJSON usa [longitude, latitude]
        },
        "properties": cleaned_properties
    }

def extract_coordinates(geometry: Dict[str, Any], properties: Dict[str, Any]) -> tuple:
    """
    Extrae coordenadas de geometría o propiedades, manejando diferentes formatos.
    
    Args:
        geometry (Dict): Objeto geometry del feature
        properties (Dict): Objeto properties del feature
        
    Returns:
        tuple: (longitude, latitude) o None si no se pueden extraer
    """
    
    # Prioridad 1: Coordenadas explícitas en properties
    if 'latitude' in properties and 'longitude' in properties:
        try:
            # Preservar precisión decimal original
            lat_str = str(properties['latitude'])
            lon_str = str(properties['longitude'])
            
            lat = float(lat_str)
            lon = float(lon_str)
            
            if is_valid_coordinate(lat, lon):
                print(f"🎯 Usando coordenadas de properties: Lat={lat_str}, Lon={lon_str}")
                return (lon, lat)
        except (ValueError, TypeError):
            pass
    
    # Prioridad 2: Coordenadas en geometry
    if isinstance(geometry, dict) and 'coordinates' in geometry:
        coords = geometry['coordinates']
        if isinstance(coords, list) and len(coords) == 2:
            try:
                # Preservar los valores originales sin redondear
                coord1_original = coords[0]
                coord2_original = coords[1]
                
                # Convertir para validación pero mantener originales
                coord1, coord2 = float(coord1_original), float(coord2_original)
                
                # Determinar cuál es lat y cuál es lon basado en los rangos típicos
                if is_valid_coordinate(coord2, coord1):  # coord1=lon, coord2=lat
                    print(f"🎯 Usando coordenadas de geometry [lon,lat]: Lat={coord2_original}, Lon={coord1_original}")
                    return (coord1_original, coord2_original)
                elif is_valid_coordinate(coord1, coord2):  # coord1=lat, coord2=lon
                    print(f"🎯 Usando coordenadas de geometry [lat,lon] (intercambiadas): Lat={coord1_original}, Lon={coord2_original}")
                    return (coord2_original, coord1_original)
                    
            except (ValueError, TypeError):
                pass
    
    # Prioridad 3: Buscar en otros campos de properties
    lat_fields = ['lat', 'latitude', 'y', 'LAT', 'LATITUDE']
    lon_fields = ['lon', 'lng', 'longitude', 'x', 'LON', 'LONGITUDE', 'LNG']
    
    lat_val = None
    lon_val = None
    
    for field in lat_fields:
        if field in properties:
            try:
                # Mantener el valor original sin redondear
                lat_val = properties[field] if isinstance(properties[field], (int, float)) else float(properties[field])
                break
            except (ValueError, TypeError):
                continue
    
    for field in lon_fields:
        if field in properties:
            try:
                # Mantener el valor original sin redondear
                lon_val = properties[field] if isinstance(properties[field], (int, float)) else float(properties[field])
                break
            except (ValueError, TypeError):
                continue
    
    if lat_val is not None and lon_val is not None:
        if is_valid_coordinate(lat_val, lon_val):
            print(f"🎯 Usando coordenadas de campos alternativos: Lat={lat_val}, Lon={lon_val}")
            return (lon_val, lat_val)
    
    return None

def is_valid_coordinate(lat: float, lon: float) -> bool:
    """
    Valida si las coordenadas están en rangos válidos.
    
    Args:
        lat (float): Latitud
        lon (float): Longitud
        
    Returns:
        bool: True si las coordenadas son válidas
    """
    return -90 <= lat <= 90 and -180 <= lon <= 180

def main():
    """Función principal del script."""
    
    # Configuración por defecto
    input_file = "data.txt"
    output_file = "datacenters_chile.geojson"
    
    # Permitir argumentos de línea de comandos
    if len(sys.argv) >= 2:
        input_file = sys.argv[1]
    if len(sys.argv) >= 3:
        output_file = sys.argv[2]
    
    print("📄 Iniciando conversión de TXT a GeoJSON...")
    print(f"📂 Archivo de entrada: {input_file}")
    print(f"💾 Archivo de salida: {output_file}")
    print("-" * 50)
    
    # Ejecutar conversión
    parse_txt_to_geojson(input_file, output_file)

if __name__ == "__main__":
    main()
