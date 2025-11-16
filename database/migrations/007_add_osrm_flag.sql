-- Agregar columna para identificar enlaces creados con OSRM
ALTER TABLE fiber_links 
ADD COLUMN IF NOT EXISTS created_with_osrm BOOLEAN DEFAULT false;

-- Agregar índice para búsquedas rápidas
CREATE INDEX IF NOT EXISTS idx_fiber_links_osrm 
ON fiber_links(created_with_osrm);

-- Comentar la columna
COMMENT ON COLUMN fiber_links.created_with_osrm IS 
'Indica si el enlace fue generado usando OSRM (rutas realistas siguiendo carreteras)';
