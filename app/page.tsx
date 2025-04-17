"use client"

import { useState, useEffect } from "react"
import { z } from "zod"
import { ArrowRight, ChevronRight, Mail, Zap, Sparkles, Atom, AlertCircle, History } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { motion, AnimatePresence } from "framer-motion"
import { saveQuizResponse, hasEmailResponded } from "@/lib/quiz-service"
import { supabase, executeRawQuery } from "@/lib/supabase"

const emailSchema = z.string().email()

export default function PersonalityQuiz() {
  const [email, setEmail] = useState("")
  const [isEmailValid, setIsEmailValid] = useState(false)
  const [emailError, setEmailError] = useState("")
  const [currentStep, setCurrentStep] = useState(0) // 0: email, 1: quiz, 2: results
  const [currentQuestion, setCurrentQuestion] = useState(0)
  const [answers, setAnswers] = useState<number[]>([])
  const [score, setScore] = useState(0)
  const [gifLoaded, setGifLoaded] = useState(false)
  const [isCheckingEmail, setIsCheckingEmail] = useState(false)
  const [hasAlreadyResponded, setHasAlreadyResponded] = useState(false)
  const [showRespondedMessage, setShowRespondedMessage] = useState(false)
  const [previousResult, setPreviousResult] = useState<string | null>(null)
  const [previousScore, setPreviousScore] = useState<number | null>(null)
  const [isSaving, setIsSaving] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)

  const questions = [
    "Prefiero tomar decisiones rápidamente, sin mucha consulta.",
    "Disfruto asumir el control en situaciones desafiantes.",
    "No me molesta confrontar a otros si es necesario.",
    "Me siento cómodo liderando bajo presión.",
    "Busco constantemente mejorar y competir conmigo mismo.",
  ]

  // Función segura para cambiar el paso actual
  const safeSetCurrentStep = (step: number) => {
    // Versión simplificada que solo verifica que el paso sea válido
    if (step >= 0 && step <= 3) {
      console.log(`[NAVEGACIÓN] Cambiando al paso: ${step}`);
      setCurrentStep(step);
    } else {
      console.log(`[NAVEGACIÓN] Paso no válido: ${step}`);
    }
  };

  const handleStartQuiz = async () => {
    // Hacemos una verificación en la base de datos para mostrar el mensaje
    setIsCheckingEmail(true);
    setEmailError("");
    console.log(`[INICIO] Proceso iniciado para email: ${email}`);
    
    try {
      // Validar formato primero
      try {
        emailSchema.parse(email);
      } catch (error) {
        console.error(`[INICIO] Error de formato de email:`, error);
        setIsEmailValid(false);
        setEmailError("Ingresa un correo electrónico válido");
        setIsCheckingEmail(false);
        return;
      }
      
      const normalizedEmail = email.toLowerCase().trim();
      
      // Verificar si es un correo válido de arkusnexus.com
      if (!normalizedEmail.endsWith('@arkusnexus.com')) {
        console.log(`[INICIO] Email rechazado - no es de dominio @arkusnexus.com: ${normalizedEmail}`);
        setIsEmailValid(false);
        setEmailError("Por favor, utiliza un correo con dominio @arkusnexus.com");
        setIsCheckingEmail(false);
        return;
      }
      
      // Verificar SIEMPRE si ya respondió usando la función del servicio
      console.log(`[INICIO] Verificando mediante servicio si el email ya existe: ${normalizedEmail}`);
      
      const emailExists = await hasEmailResponded(normalizedEmail);
      
      if (emailExists) {
        console.log(`[INICIO] BLOQUEANDO - Email ya ha respondido anteriormente: ${normalizedEmail}`);
        
        setHasAlreadyResponded(true);
        setShowRespondedMessage(true);
        setEmailError("Un email similar ya ha respondido el quiz anteriormente.");
        setIsCheckingEmail(false);
        return;
      } else {
        // El email no ha respondido, puede continuar
        console.log(`[INICIO] Verificación OK - Email no encontrado en BD: ${normalizedEmail}`);
        setHasAlreadyResponded(false);
        setShowRespondedMessage(false);
        setIsCheckingEmail(false);
        safeSetCurrentStep(1);
      }
    } catch (error) {
      console.error("[INICIO] Error general:", error);
      setEmailError("Error al verificar el email. Por favor, intenta nuevamente.");
      setIsCheckingEmail(false);
    }
  };

  const handleAnswer = async (value: number) => {
    console.log(`[RESPUESTA] Iniciando proceso de respuesta para la pregunta ${currentQuestion + 1}, valor: ${value}`);
    
    try {
      const normalizedEmail = email.toLowerCase().trim();
      
      // Verificar que el correo sea de arkusnexus.com
      if (!normalizedEmail.endsWith('@arkusnexus.com')) {
        console.log(`[RESPUESTA] Email no válido (no es @arkusnexus.com): ${normalizedEmail}`);
        setEmailError("Por favor, utiliza un correo con dominio @arkusnexus.com");
        safeSetCurrentStep(0);
        return;
      }
      
      // Verificar que el correo no haya respondido antes usando la función de servicio
      console.log(`[RESPUESTA] Verificando mediante servicio si el email ya existe: ${normalizedEmail}`);
      
      const emailExists = await hasEmailResponded(normalizedEmail);
      
      if (emailExists) {
        console.log(`[RESPUESTA] BLOQUEANDO - Email ya ha respondido anteriormente: ${normalizedEmail}`);
        
        setHasAlreadyResponded(true);
        setShowRespondedMessage(true);
        setEmailError("Un email similar ya ha respondido el quiz anteriormente.");
        safeSetCurrentStep(0);
        return;
      } else {
        console.log(`[RESPUESTA] Verificación OK - Email no encontrado en BD: ${normalizedEmail}`);
      }
      
      // Si llegamos aquí, el correo no existe en la base de datos, puede continuar
      console.log(`[RESPUESTA] Registrando respuesta: valor=${value} para pregunta=${currentQuestion + 1}`);
      
      const newAnswers = [...answers, value];
      setAnswers(newAnswers);

      if (currentQuestion < questions.length - 1) {
        console.log(`[RESPUESTA] Avanzando a pregunta ${currentQuestion + 2}`);
        setCurrentQuestion(currentQuestion + 1);
      } else {
        // Calculate final score
        const totalScore = newAnswers.reduce((sum, current) => sum + current, 0);
        console.log(`[RESPUESTA] Quiz completado. Puntuación final: ${totalScore}`);
        setScore(totalScore);
        safeSetCurrentStep(2);
        
        // Guardar respuestas en Supabase
        console.log(`[RESPUESTA] Iniciando proceso de guardado de resultados`);
        saveResponseToSupabase();
      }
    } catch (error) {
      console.error("[RESPUESTA] Error general:", error);
      setEmailError("Error al procesar la respuesta. Por favor, intenta nuevamente.");
      safeSetCurrentStep(0);
    }
  };

  // Función para calcular el puntaje final basado en las respuestas
  const calculateScore = (responses: number[]): number => {
    return responses.reduce((total, value) => total + value, 0);
  };

  // Función para determinar el tipo de personalidad basado en el puntaje
  const determinePersonalityType = (score: number): string => {
    if (score >= 17) return "Red Ale Intensa";
    else if (score >= 13) return "IPA Amarga";
    else if (score >= 9) return "Cerveza artesanal suave";
    else return "Cerveza dorada ligera";
  };

  const saveResponseToSupabase = async () => {
    console.log('[GUARDAR] Iniciando proceso de guardado de quiz completo');
    setIsSaving(true);
    setSaveError(null);
    
    try {
      const normalizedEmail = email.toLowerCase().trim();
      
      // Verificar que el correo sea de arkusnexus.com
      if (!normalizedEmail.endsWith('@arkusnexus.com')) {
        console.log(`[GUARDAR] Email no válido (no es @arkusnexus.com): ${normalizedEmail}`);
        setEmailError("Por favor, utiliza un correo con dominio @arkusnexus.com");
        setIsSaving(false);
        safeSetCurrentStep(0);
        return;
      }
      
      // Calculación final del score
      const finalScore = calculateScore(answers);
      const finalResult = determinePersonalityType(finalScore);
      
      console.log(`[GUARDAR] Datos a guardar: email=${normalizedEmail}, score=${finalScore}, result=${finalResult}`);
      console.log(`[GUARDAR] Respuestas: ${JSON.stringify(answers)}`);
      
      // Verificar una última vez mediante el servicio antes de guardar
      console.log(`[GUARDAR] Verificación final antes de guardar...`);
      
      const emailExists = await hasEmailResponded(normalizedEmail);
      
      if (emailExists) {
        console.log(`[GUARDAR] BLOQUEANDO - Email ya ha respondido anteriormente: ${normalizedEmail}`);
        
        setHasAlreadyResponded(true);
        setShowRespondedMessage(true);
        setEmailError("Un email similar ya ha respondido el quiz anteriormente.");
        setIsSaving(false);
        safeSetCurrentStep(0);
        return;
      }

      console.log(`[GUARDAR] Verificación OK - Enviando datos a servicio...`);
      
      // Establecer primero el score y resultado para que estén disponibles en la pantalla final
      setScore(finalScore);
      
      // Guardar usando la función del servicio
      const success = await saveQuizResponse({
        email: normalizedEmail,
        answers: answers,
        score: finalScore,
        result: finalResult
      });

      if (!success) {
        console.error('[GUARDAR] Error al guardar la respuesta a través del servicio');
        setSaveError("Error al guardar las respuestas. Por favor, intenta nuevamente.");
        setIsSaving(false);
        return;
      }

      console.log('[GUARDAR] ¡Respuesta guardada exitosamente!');
      
      // Actualizar estados
      setHasAlreadyResponded(true);
      setIsSaving(false);
      setCurrentStep(2); // Paso de resultados
    } catch (error) {
      console.error('[GUARDAR] Error imprevisto:', error);
      setSaveError("Error inesperado al guardar. Por favor, intenta nuevamente.");
      setIsSaving(false);
    }
  };

  const getBeer = () => {
    if (score >= 17) return "Red Ale Intensa"
    if (score >= 13) return "IPA Amarga"
    if (score >= 9) return "Cerveza artesanal suave"
    return "Cerveza dorada ligera"
  }

  const getDescription = () => {
    if (score >= 17) return "Directo, decidido, nada te detiene."
    if (score >= 13) return "Valiente, resolutiva, independiente."
    if (score >= 9) return "Actúas cuando se necesita, con mesura."
    return "Prefieres evitar conflictos, avanzas a tu ritmo."
  }

  const getBeerEmoji = () => {
    if (score >= 17) return "🍺"
    if (score >= 13) return "🍻"
    if (score >= 9) return "🥂"
    return "🍹"
  }

  const getGradient = () => {
    if (score >= 17) return "from-fuchsia-600 via-purple-600 to-indigo-600"
    if (score >= 13) return "from-orange-500 via-amber-500 to-yellow-500"
    if (score >= 9) return "from-emerald-500 via-teal-500 to-cyan-500"
    return "from-rose-500 via-pink-500 to-fuchsia-500"
  }

  const getBeerGif = () => {
    if (score >= 17)
      return "https://media.giphy.com/media/v1.Y2lkPTc5MGI3NjExcWJtZnRtZXRxZnRqcnRxZnRqcnRxZnRqcnRxZnRqcnRxZnRqcnRxZnRqcnRxZnRqcnRxZnRqcnRxZnRqcnRxZnRqcnRxZnRqcg/3o7btZDbB1xfuYKQne/giphy.gif" // Imperial Stout
    if (score >= 13)
      return "https://media.giphy.com/media/v1.Y2lkPTc5MGI3NjExcWJtZnRtZXRxZnRqcnRxZnRqcnRxZnRqcnRxZnRqcnRxZnRqcnRxZnRqcg/YrMrSUfeh5do2FISt8/giphy.gif" // Red Ale
    if (score >= 9)
      return "https://media.giphy.com/media/v1.Y2lkPTc5MGI3NjExcWJtZnRtZXRxZnRqcnRxZnRqcnRxZnRqcnRxZnRqcnRxZnRqcnRxZnRqcg/3o7btQsLqXMJAPu6Na/giphy.gif" // IPA
    return "https://media.giphy.com/media/v1.Y2lkPTc5MGI3NjExcWJtZnRtZXRxZnRqcnRxZnRqcnRxZnRqcnRxZnRqcnRxZnRqcnRxZnRqcg/l2JJyLbhqCF4va86c/giphy.gif" // Lager
  }

  // Partículas flotantes para el fondo
  const particles = Array.from({ length: 30 }).map((_, i) => (
    <motion.div
      key={i}
      className="absolute rounded-full"
      initial={{
        x: Math.random() * 100 - 50 + "%",
        y: Math.random() * 100 - 50 + "%",
        scale: Math.random() * 0.5 + 0.5,
        opacity: Math.random() * 0.5 + 0.25,
        backgroundColor: [
          "#FF00FF", // Magenta
          "#00FFFF", // Cyan
          "#FF00AA", // Pink
          "#00FF00", // Lime
          "#FF3300", // Orange
          "#9900FF", // Purple
          "#00CCFF", // Sky Blue
        ][Math.floor(Math.random() * 7)],
      }}
      animate={{
        x: [Math.random() * 100 - 50 + "%", Math.random() * 100 - 50 + "%", Math.random() * 100 - 50 + "%"],
        y: [Math.random() * 100 - 50 + "%", Math.random() * 100 - 50 + "%", Math.random() * 100 - 50 + "%"],
        opacity: [Math.random() * 0.5 + 0.25, Math.random() * 0.5 + 0.5, Math.random() * 0.5 + 0.25],
      }}
      transition={{
        duration: Math.random() * 20 + 20,
        repeat: Number.POSITIVE_INFINITY,
        ease: "linear",
      }}
      style={{
        width: Math.random() * 40 + 10 + "px",
        height: Math.random() * 40 + 10 + "px",
        filter: "blur(8px)",
      }}
    />
  ))

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-900 via-violet-900 to-slate-900 p-4 overflow-hidden relative">
      {/* Partículas de fondo */}
      {particles}

      {/* Efectos de resplandor */}
      <div className="absolute top-1/4 -left-1/4 w-1/2 h-1/2 bg-fuchsia-500 rounded-full filter blur-[150px] opacity-20 animate-pulse"></div>
      <div
        className="absolute bottom-1/4 -right-1/4 w-1/2 h-1/2 bg-cyan-500 rounded-full filter blur-[150px] opacity-20 animate-pulse"
        style={{ animationDelay: "1s" }}
      ></div>
      <div
        className="absolute top-3/4 left-1/4 w-1/3 h-1/3 bg-lime-500 rounded-full filter blur-[150px] opacity-10 animate-pulse"
        style={{ animationDelay: "2s" }}
      ></div>

      <AnimatePresence mode="wait">
        {currentStep === 0 && (
          <motion.div
            key="email-step" 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            transition={{ duration: 0.3 }}
            className="w-full max-w-md relative z-10"
          >
            <Card className="border-0 shadow-2xl rounded-3xl overflow-hidden bg-black/30 backdrop-blur-xl border border-white/10">
              <div className="absolute inset-0 bg-gradient-to-r from-fuchsia-500/10 to-cyan-500/10 pointer-events-none"></div>
              <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-fuchsia-500 via-violet-500 to-cyan-600"></div>

              <CardHeader className="bg-gradient-to-r from-fuchsia-600 via-violet-600 to-cyan-600 p-6 relative overflow-hidden">
                <div className="absolute inset-0 opacity-20 bg-[radial-gradient(circle_at_center,_rgba(255,255,255,0.2)_0%,_transparent_50%)]"></div>
                <motion.div
                  className="absolute -right-4 -top-4 w-24 h-24 bg-white/20 rounded-full blur-xl"
                  animate={{ scale: [1, 1.2, 1], opacity: [0.2, 0.3, 0.2] }}
                  transition={{ duration: 4, repeat: Number.POSITIVE_INFINITY }}
                ></motion.div>

                <CardTitle className="text-2xl font-bold text-white relative flex items-center gap-2">
                  <Zap className="w-6 h-6 text-yellow-300" />
                  Descubre Que Tipo de Cheve Eres
                </CardTitle>
                <CardDescription className="text-white/90 text-lg relative">
                  Responde unas preguntas rápidas para descubrir que cheve coincide con tu estilo de
                  liderazgo.
                </CardDescription>
              </CardHeader>

              <CardContent className="p-6 pt-8 relative">
                <div className="space-y-4">
                  {showRespondedMessage && (
                    <motion.div
                      initial={{ opacity: 0, y: -10 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="mb-6 p-5 rounded-lg bg-amber-500/30 border border-amber-400/40 text-white shadow-lg"
                    >
                      <div className="flex items-start gap-3">
                        <AlertCircle className="w-6 h-6 text-amber-400 flex-shrink-0 mt-0.5" />
                        <div>
                          <h3 className="text-xl font-semibold text-amber-300 mb-2">Ya has completado este quiz</h3>
                          <p className="text-sm text-white/90">
                            Este correo electrónico ya ha sido registrado en nuestra base de datos. 
                            No es posible realizar el quiz más de una vez con el mismo correo.
                          </p>
                        </div>
                      </div>
                    </motion.div>
                  )}
                  <div className="space-y-2">
                    <Label htmlFor="email" className="text-lg font-medium text-white flex items-center gap-2">
                      <Mail className="w-5 h-5 text-fuchsia-400" />
                      {showRespondedMessage ? "Tu email registrado" : "Ingresa tu email para comenzar"}
                    </Label>
                    <div className="relative">
                      <Input
                        id="email"
                        type="email"
                        placeholder="tu.email@arkusnexus.com"
                        className={`pl-4 py-6 text-lg rounded-xl bg-white/10 border-white/20 text-white backdrop-blur-sm transition-all ${
                          showRespondedMessage
                            ? "opacity-70 border-amber-500/50" 
                            : "focus:border-fuchsia-400 focus:ring-fuchsia-400/50"
                        }`}
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        disabled={showRespondedMessage}
                      />
                      {isCheckingEmail && (
                        <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-1">
                          <span className="text-xs text-cyan-400">Verificando</span>
                          <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-cyan-400 border-t-transparent"></span>
                        </div>
                      )}
                      {!isCheckingEmail && showRespondedMessage && (
                        <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-1">
                          <span className="text-xs text-amber-400 font-medium">Verificado</span>
                          <span className="w-4 h-4 bg-amber-400 rounded-full flex items-center justify-center">
                            <span className="text-black text-[10px]">✓</span>
                          </span>
                        </div>
                      )}
                      {!isCheckingEmail && !showRespondedMessage && (
                      <motion.div
                        className="absolute right-3 top-1/2 -translate-y-1/2 w-2 h-2 rounded-full"
                        animate={{
                          backgroundColor: isEmailValid
                            ? ["#10b981", "#34d399", "#10b981"]
                            : ["#ef4444", "#f87171", "#ef4444"],
                          boxShadow: isEmailValid
                            ? [
                                "0 0 0 rgba(16, 185, 129, 0.4)",
                                "0 0 20px rgba(16, 185, 129, 0.6)",
                                "0 0 0 rgba(16, 185, 129, 0.4)",
                              ]
                            : [
                                "0 0 0 rgba(239, 68, 68, 0.4)",
                                "0 0 20px rgba(239, 68, 68, 0.6)",
                                "0 0 0 rgba(239, 68, 68, 0.4)",
                              ],
                        }}
                        transition={{ duration: 2, repeat: Number.POSITIVE_INFINITY }}
                      />
                      )}
                    </div>
                    {emailError && (
                      <motion.p 
                        className={`text-sm mt-2 ${showRespondedMessage ? "text-amber-400 font-medium" : "text-red-400"}`}
                        initial={{ opacity: 0, y: -5 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.2 }}
                      >
                        {emailError}
                      </motion.p>
                    )}
                  </div>
                </div>
              </CardContent>

              <CardFooter className="p-6 pt-0">
                {!(showRespondedMessage) && (
                <Button
                  onClick={handleStartQuiz}
                    // disabled={!isEmailValid || isCheckingEmail}
                    className="w-full py-6 text-lg font-bold rounded-xl transition-all duration-300 shadow-lg relative overflow-hidden group bg-gradient-to-r from-fuchsia-600 via-violet-600 to-cyan-600 hover:from-fuchsia-700 hover:via-violet-700 hover:to-cyan-700 shadow-fuchsia-500/20 hover:shadow-fuchsia-500/40 text-white disabled:opacity-50"
                >
                  <span className="relative z-10 flex items-center justify-center gap-2">
                      {isCheckingEmail ? (
                        <>
                          Verificando correo... 
                          <span className="inline-block h-5 w-5 animate-spin rounded-full border-2 border-white border-t-transparent"></span>
                        </>
                      ) : (
                        <>
                    Comenzar <ArrowRight className="ml-2 group-hover:translate-x-1 transition-transform" size={20} />
                        </>
                      )}
                  </span>
                  <span className="absolute inset-0 bg-gradient-to-r from-fuchsia-400 via-violet-400 to-cyan-400 opacity-0 group-hover:opacity-100 transition-opacity duration-300 blur-xl"></span>
                </Button>
                )}
              </CardFooter>
            </Card>
          </motion.div>
        )}

        {currentStep === 1 && (
          <motion.div
            key="quiz-step"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            transition={{ duration: 0.3 }}
            className="w-full max-w-md relative z-10"
          >
            {/* Verificación adicional para impedir acceso a las preguntas */}
            {hasAlreadyResponded && showRespondedMessage ? (
              <Card className="border-0 shadow-2xl rounded-3xl overflow-hidden bg-black/30 backdrop-blur-xl border border-white/10">
                <CardHeader className="bg-gradient-to-r from-red-600 to-orange-600 p-6 relative overflow-hidden">
                  <div className="absolute inset-0 opacity-20 bg-[radial-gradient(circle_at_center,_rgba(255,255,255,0.2)_0%,_transparent_50%)]"></div>
                  <CardTitle className="text-2xl font-bold text-white relative flex items-center gap-2">
                    <AlertCircle className="w-6 h-6 text-white" />
                    Acceso Bloqueado
                  </CardTitle>
                  <CardDescription className="text-white/90 relative">
                    Este correo ya ha completado el quiz anteriormente
                  </CardDescription>
                </CardHeader>
                <CardContent className="p-6">
                  <p className="text-white/80">
                    No se permite completar el quiz más de una vez con el mismo correo. 
                    Por favor, regresa a la página de inicio para ver tu resultado anterior.
                  </p>
                </CardContent>
                <CardFooter className="p-6 pt-0">
                  <Button
                    onClick={() => safeSetCurrentStep(0)}
                    className="w-full py-4 bg-white/10 hover:bg-white/20 text-white"
                  >
                    Volver al inicio
                  </Button>
                </CardFooter>
              </Card>
            ) : (
            <Card className="border-0 shadow-2xl rounded-3xl overflow-hidden bg-black/30 backdrop-blur-xl border border-white/10">
              <div className="absolute inset-0 bg-gradient-to-r from-cyan-500/10 to-lime-500/10 pointer-events-none"></div>
              <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-cyan-500 via-teal-500 to-lime-500"></div>

              <CardHeader className="bg-gradient-to-r from-cyan-600 via-teal-600 to-lime-600 p-6 relative overflow-hidden">
                <div className="absolute inset-0 opacity-20 bg-[radial-gradient(circle_at_center,_rgba(255,255,255,0.2)_0%,_transparent_50%)]"></div>
                <motion.div
                  className="absolute -right-4 -top-4 w-24 h-24 bg-white/20 rounded-full blur-xl"
                  animate={{ scale: [1, 1.2, 1], opacity: [0.2, 0.3, 0.2] }}
                  transition={{ duration: 4, repeat: Number.POSITIVE_INFINITY }}
                ></motion.div>

                <CardTitle className="text-2xl font-bold text-white relative flex items-center gap-2">
                  <Atom className="w-6 h-6 text-lime-300 animate-spin" style={{ animationDuration: "8s" }} />
                  Bloque 1: Dominancia
                </CardTitle>
                <CardDescription className="text-white/90 relative">
                  Evalúa tu capacidad de decisión y estilo de liderazgo
                </CardDescription>
                <div className="flex items-center justify-between mt-4 relative">
                  <span className="text-sm font-medium text-white/80">
                    Pregunta {currentQuestion + 1} de {questions.length}
                  </span>
                  <div className="flex space-x-1">
                    {questions.map((_, index) => (
                      <motion.div
                        key={index}
                        className={`h-1.5 rounded-full ${index <= currentQuestion ? "bg-lime-400" : "bg-white/30"}`}
                        initial={{ width: index <= currentQuestion ? 0 : 24 }}
                        animate={{ width: 24 }}
                        transition={{ duration: 0.5, delay: index * 0.1 }}
                      />
                    ))}
                  </div>
                </div>
              </CardHeader>

              <CardContent className="p-6 pt-8">
                <AnimatePresence mode="wait">
                  <motion.div
                    key={currentQuestion}
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -20 }}
                    transition={{ duration: 0.2 }}
                  >
                    <h3 className="text-xl font-medium mb-6 text-center text-white">{questions[currentQuestion]}</h3>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      {[1, 2, 3, 4].map((value) => {
                        // Definir colores vibrantes para cada botón
                        const gradients = [
                          "from-pink-500 to-rose-500",
                          "from-orange-500 to-amber-500",
                          "from-cyan-500 to-teal-500",
                          "from-fuchsia-500 to-purple-500",
                        ]

                        return (
                          <Button
                            key={value}
                            onClick={() => handleAnswer(value)}
                            className={`py-6 text-base font-medium rounded-xl transition-all duration-200 hover:scale-105 flex flex-col items-center justify-center h-auto min-h-[80px] relative overflow-hidden group border border-white/10 backdrop-blur-sm bg-gradient-to-r ${gradients[value - 1]} bg-opacity-80 hover:bg-opacity-100`}
                          >
                            <span className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent opacity-0 group-hover:opacity-100 group-hover:animate-shimmer"></span>
                              <span className="text-center text-white font-medium">
                              {value === 1
                                  ? "Definitivamente no!"
                                : value === 2
                                    ? "Quizás un poco"
                                  : value === 3
                                      ? "Sí, me representa"
                                      : "Totalmente yo!"}
                            </span>
                          </Button>
                        )
                      })}
                    </div>
                  </motion.div>
                </AnimatePresence>
              </CardContent>
            </Card>
            )}
          </motion.div>
        )}

        {currentStep === 2 && (
          <motion.div
            key="result-step"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            transition={{ duration: 0.3 }}
            className="w-full max-w-md relative z-10"
          >
            {/* Verificación adicional para impedir acceso a los resultados */}
            {hasAlreadyResponded && showRespondedMessage ? (
              <Card className="border-0 shadow-2xl rounded-3xl overflow-hidden bg-black/30 backdrop-blur-xl border border-white/10">
                <CardHeader className="bg-gradient-to-r from-red-600 to-orange-600 p-6 relative overflow-hidden">
                  <div className="absolute inset-0 opacity-20 bg-[radial-gradient(circle_at_center,_rgba(255,255,255,0.2)_0%,_transparent_50%)]"></div>
                  <CardTitle className="text-2xl font-bold text-white relative flex items-center gap-2">
                    <AlertCircle className="w-6 h-6 text-white" />
                    Acceso Bloqueado
                  </CardTitle>
                  <CardDescription className="text-white/90 relative">
                    Este correo ya ha completado el quiz anteriormente
                  </CardDescription>
                </CardHeader>
                <CardContent className="p-6">
                  <p className="text-white/80">
                    No se permite completar el quiz más de una vez con el mismo correo. 
                    Por favor, regresa a la página de inicio para ver tu resultado anterior.
                  </p>
                </CardContent>
                <CardFooter className="p-6 pt-0">
                  <Button
                    onClick={() => safeSetCurrentStep(0)}
                    className="w-full py-4 bg-white/10 hover:bg-white/20 text-white"
                  >
                    Volver al inicio
                  </Button>
                </CardFooter>
              </Card>
            ) : (
            <Card className="border-0 shadow-2xl rounded-3xl overflow-hidden bg-black/30 backdrop-blur-xl border border-white/10">
              <div className="absolute inset-0 bg-gradient-to-r from-purple-500/10 to-pink-500/10 pointer-events-none"></div>
              <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-purple-500 via-pink-500 to-rose-500"></div>

              <CardHeader className={`bg-gradient-to-r ${getGradient()} p-6 text-center relative overflow-hidden`}>
                <div className="absolute inset-0 opacity-20 bg-[radial-gradient(circle_at_center,_rgba(255,255,255,0.2)_0%,_transparent_50%)]"></div>
                <motion.div
                  className="absolute -right-4 -top-4 w-24 h-24 bg-white/20 rounded-full blur-xl"
                  animate={{ scale: [1, 1.2, 1], opacity: [0.2, 0.3, 0.2] }}
                  transition={{ duration: 4, repeat: Number.POSITIVE_INFINITY }}
                ></motion.div>

                <CardTitle className="text-2xl font-bold text-white relative flex items-center justify-center gap-2">
                  <Sparkles className="w-6 h-6 text-yellow-300" />
                    Tu Estilo Cervecero
                  <Sparkles className="w-6 h-6 text-yellow-300" />
                </CardTitle>
                <CardDescription className="text-white/90 text-lg relative">
                    ¡Basado en tus respuestas, hemos encontrado tu cerveza ideal!
                </CardDescription>
              </CardHeader>

              <CardContent className="p-6 pt-8 text-center">
                <div className="space-y-6">
                  <div className="space-y-2">
                    <motion.div
                      className="text-6xl mb-2"
                      initial={{ scale: 0.5, opacity: 0 }}
                      animate={{ scale: 1, opacity: 1 }}
                      transition={{ duration: 0.5 }}
                    >
                      {getBeerEmoji()}
                    </motion.div>
                    <h3 className="text-2xl font-bold text-white">Cerveza</h3>
                    <motion.p
                      className="text-xl text-cyan-400 font-semibold"
                      initial={{ y: 10, opacity: 0 }}
                      animate={{ y: 0, opacity: 1 }}
                        transition={{ duration: 0.5, delay: 0.2 }}
                    >
                      {getBeer()}
                    </motion.p>

                    <motion.div
                      initial={{ opacity: 0, scale: 0.8 }}
                      animate={{ opacity: 1, scale: 1 }}
                        transition={{ duration: 0.5, delay: 0.3 }}
                      className="mt-4 rounded-xl overflow-hidden shadow-lg border border-white/20 relative group"
                    >
                      <div className="absolute inset-0 bg-gradient-to-r from-cyan-500/20 to-fuchsia-500/20 opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none"></div>
                      <div className="relative w-full h-48 bg-gray-900 rounded-xl overflow-hidden">
                        <img
                          src={getBeerGif() || "/placeholder.svg"}
                          alt={`GIF de ${getBeer()}`}
                          className="w-full h-full object-cover"
                        />
                      </div>
                    </motion.div>
                  </div>

                  <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.5, delay: 0.4 }}
                    className="mt-6 p-4 bg-white/5 backdrop-blur-sm rounded-xl border border-white/10"
                  >
                    <p className="text-lg italic text-white/90">"{getDescription()}"</p>
                  </motion.div>
                </div>
              </CardContent>

              <CardFooter className="p-6 pt-0">
                  <div className={`w-full py-6 text-lg font-bold rounded-xl bg-gradient-to-r ${getGradient()} text-white relative overflow-hidden flex items-center justify-center`}>
                  <span className="relative z-10 flex items-center justify-center gap-2">
                      Espera el siguiente bloque{" "}
                      <ChevronRight className="ml-2" size={20} />
                  </span>
                    <span className="absolute inset-0 bg-black/20"></span>
                  </div>
              </CardFooter>
            </Card>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
