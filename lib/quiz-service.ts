import { supabase } from './supabase'

export interface QuizResponse {
  email: string
  answers: number[]
  score: number
  result: string
}

/**
 * Verifica si un correo electrónico ya ha respondido el quiz
 */
export async function hasEmailResponded(email: string): Promise<boolean> {
  if (!email) {
    console.log('[VERIFICAR] Email vacío, retornando false');
    return false;
  }
  
  try {
    // Normalizar el email (minúsculas y sin espacios)
    const normalizedEmail = email.toLowerCase().trim();
    
    // Extraer la parte del usuario (antes del @)
    const atIndex = normalizedEmail.indexOf('@');
    if (atIndex === -1) {
      console.log('[VERIFICAR] Formato de email inválido: no contiene @');
      return false;
    }
    
    const userPart = normalizedEmail.substring(0, atIndex);
    console.log(`[VERIFICAR] Buscando similitud para usuario: ${userPart}`);
    
    // Buscar cualquier email donde la parte del usuario sea similar y termine con @arkusnexus.com
    const { data, error } = await supabase
      .from('quiz_responses')
      .select('id, email')
      .ilike('email', `${userPart}%@arkusnexus.com`);
    
    if (error) {
      console.error('[VERIFICAR] Error Supabase:', error.message);
      console.error('[VERIFICAR] Detalles completos:', error);
      // En caso de error, por seguridad asumimos que el correo ya existe
      return true;
    }
    
    const exists = data && data.length > 0;
    console.log(`[VERIFICAR] Resultados encontrados: ${data?.length || 0}`);
    
    if (exists && data) {
      console.log('[VERIFICAR] Emails similares encontrados:');
      data.forEach(item => console.log(`- ${item.email}`));
    } else {
      console.log('[VERIFICAR] No se encontraron emails similares');
    }
    
    console.log(`[VERIFICAR] ¿Existe en BD?: ${exists ? 'SÍ' : 'NO'}`);
    
    return exists;
  } catch (error) {
    console.error('[VERIFICAR] Error crítico:', error);
    // En caso de error, asumimos que ya existe para prevenir duplicados
    return true;
  }
}

/**
 * Guarda las respuestas del quiz en Supabase
 */
export async function saveQuizResponse(response: QuizResponse): Promise<boolean> {
  if (!response.email) {
    console.error('[GUARDAR] Error: El email no puede estar vacío');
    return false;
  }
  
  try {
    const normalizedEmail = response.email.toLowerCase().trim();
    console.log('[GUARDAR] Proceso de guardado iniciado para:', normalizedEmail);
    
    // Extraer la parte del usuario (antes del @)
    const atIndex = normalizedEmail.indexOf('@');
    if (atIndex === -1) {
      console.error('[GUARDAR] Formato de email inválido: no contiene @');
      return false;
    }
    
    const userPart = normalizedEmail.substring(0, atIndex);
    console.log(`[GUARDAR] Verificando similitud para usuario: ${userPart}`);
    
    // Verificar si existe un email similar
    const { data, error: checkError } = await supabase
      .from('quiz_responses')
      .select('id, email')
      .ilike('email', `${userPart}%@arkusnexus.com`);
    
    if (checkError) {
      console.error('[GUARDAR] Error al verificar duplicados:', checkError);
      console.error('[GUARDAR] Error completo:', JSON.stringify(checkError));
      return false;
    }
    
    // Verificar si hay emails similares
    if (data && data.length > 0) {
      console.error(`[GUARDAR] BLOQUEADO - Email similar ya existe: ${normalizedEmail}`);
      console.error('[GUARDAR] Emails similares encontrados:');
      data.forEach(item => console.error(`- ${item.email}`));
      return false;
    }
    
    // Si llegamos aquí, el email no existe, podemos guardar
    console.log(`[GUARDAR] Verificación OK - Guardando respuesta para: ${normalizedEmail}`);
    console.log('[GUARDAR] Datos a guardar:', {
      email: normalizedEmail,
      score: response.score,
      result: response.result,
      answers_count: response.answers.length
    });
    
    // Preparar los datos antes de insertar
    const dataToInsert = {
      email: normalizedEmail,
      answers: JSON.stringify(response.answers),
      score: response.score,
      result: response.result
    };
    
    // Insertar los datos
    const { error } = await supabase
      .from('quiz_responses')
      .insert([dataToInsert]);
    
    if (error) {
      // Si hay error de tipo unique_violation (código 23505), significa que el email ya existía
      if (error.code === '23505') {
        console.error('[GUARDAR] Error de duplicado detectado:', error);
        console.error('[GUARDAR] Detalles del error de duplicado:', error.details);
        return false;
      }
      
      console.error('[GUARDAR] Error al guardar las respuestas:', error);
      console.error('[GUARDAR] Detalles completos del error:', JSON.stringify(error));
      return false;
    }
    
    console.log('[GUARDAR] Respuesta guardada con éxito para:', normalizedEmail);
    return true;
  } catch (error) {
    const err = error as Error;
    console.error('[GUARDAR] Error inesperado:', err);
    console.error('[GUARDAR] Stack trace:', err.stack);
    return false;
  }
}

/**
 * Obtiene las respuestas del quiz de un usuario específico
 */
export async function getQuizResponsesByEmail(email: string) {
  try {
    const { data, error } = await supabase
      .from('quiz_responses')
      .select('*')
      .eq('email', email)
      .order('created_at', { ascending: false })
    
    if (error) {
      console.error('Error al obtener las respuestas:', error)
      return null
    }
    
    return data
  } catch (error) {
    console.error('Error al obtener las respuestas:', error)
    return null
  }
} 