import { createClient } from '@supabase/supabase-js'

// Estas variables deberían estar en un archivo .env.local
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || ''
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''

// Para depuración
console.log('Supabase URL configurada:', supabaseUrl ? 'Sí' : 'No')
console.log('Supabase Key configurada:', supabaseKey ? 'Sí' : 'No')

export const supabase = createClient(supabaseUrl, supabaseKey)

// Función para ejecutar consultas SQL directas
export async function executeRawQuery(query: string, params: any[] = []) {
  console.log(`[RAW SQL] Ejecutando: ${query}`);
  console.log(`[RAW SQL] Parámetros: ${JSON.stringify(params)}`);
  
  try {
    // Utilizamos la API de Postgres para ejecutar consultas SQL directas
    const { data, error } = await supabase
      .rpc('ejecutar_sql', { 
        consulta: query, 
        parametros: params 
      });
    
    if (error) {
      console.error('[RAW SQL] Error al ejecutar consulta:', error);
      // Si falla por la función RPC, retornamos información para depuración
      return { 
        error: error,
        note: 'La función RPC "ejecutar_sql" debe estar definida en Supabase' 
      };
    }
    
    console.log(`[RAW SQL] Resultado exitoso: ${JSON.stringify(data)}`);
    return { data };
  } catch (error) {
    console.error('[RAW SQL] Error crítico:', error);
    return { error };
  }
}

// Estructura de la tabla en Supabase:
// Table: quiz_responses
// Columns:
//   id: uuid (default: gen_random_uuid())
//   email: text
//   answers: jsonb
//   score: integer
//   result: text
//   created_at: timestamp with time zone (default: now()) 