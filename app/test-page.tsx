"use client"

import { Button } from "@/components/ui/button"
import { useRouter } from "next/navigation"

export default function TestPage() {
  const router = useRouter()
  
  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-purple-900 to-indigo-900">
      <div className="bg-white/10 backdrop-blur-lg p-8 rounded-xl text-white text-center">
        <h1 className="text-3xl font-bold mb-4">Página de Prueba</h1>
        <p className="mb-6">Esta página fue creada para probar que los cambios se están aplicando correctamente.</p>
        <Button 
          onClick={() => router.push("/")}
          className="bg-purple-600 hover:bg-purple-700"
        >
          Volver al Quiz
        </Button>
      </div>
    </div>
  )
} 