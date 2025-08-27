import { useState } from "react"
import { useForm } from "react-hook-form"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { SidebarTrigger } from "@/components/ui/sidebar"
import { ResultModal } from "@/components/result-modal"

type FormData = {
  cedula: string
}

interface DatosIESSData {
  cedula: string
  cobertura: string
  tipoAfiliacion: string
  detalle: string
  fechaConsulta: string
  estado: string
  error?: string
}

export function DatosIESSPage() {
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [result, setResult] = useState<string>("")
  const [isLoading, setIsLoading] = useState(false)
  const [datosIESS, setDatosIESS] = useState<DatosIESSData | null>(null)
  const [showCards, setShowCards] = useState(false)

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<FormData>()

  const onSubmit = async (data: FormData) => {
    setIsLoading(true)
    setShowCards(false)
    setDatosIESS(null)

    try {
      const apiBaseUrl = import.meta.env.VITE_API_BASE_URL
      const response = await fetch(`${apiBaseUrl}/api/datos-iess`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ 
          cedula: data.cedula
        }),
      })

      const resultado = await response.json()

      if (resultado.success) {
        const datos = resultado.data

        if (datos.error) {
          let mensajeError = ""
          switch (datos.error) {
            case 'cedula_invalida':
              mensajeError = `La cédula ${data.cedula} es inválida o no está registrada en el IESS.`
              break
            case 'cedula_no_registrada':
              mensajeError = `Cédula No se Encuentra Registrada en el IESS.`
              break
            case 'timeout':
              mensajeError = "La consulta tardó demasiado tiempo. Inténtelo nuevamente."
              break
            default:
              mensajeError = `Error: ${datos.error}`
          }
          setResult(mensajeError)
          setIsModalOpen(true)
        } else {
          setDatosIESS(datos)
          setShowCards(true)
        }
      } else {
        setResult(`Error: ${resultado.error || "Error desconocido"}`)
        setIsModalOpen(true)
      }
    } catch (error) {
      console.error("Error al consultar datos IESS:", error)
      setResult("Error de conexión. Verifique que el servidor backend esté funcionando.")
      setIsModalOpen(true)
    } finally {
      setIsLoading(false)
    }
  }

  const formatearFecha = (fecha: string): string => {
    try {
      return new Date(fecha).toLocaleDateString('es-EC', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      })
    } catch {
      return fecha
    }
  }

  const DatosIESSCard = ({ datos }: { datos: DatosIESSData }) => (
    <Card className="mt-6">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          🏥 Datos de Afiliación IESS
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-6">
          {/* Información personal */}
          <div className="bg-blue-50 p-4 rounded-lg">
            <h4 className="font-semibold text-sm text-blue-800 mb-3 flex items-center gap-2">
              👤 Información de Afiliado
            </h4>
            <div className="grid grid-cols-1 gap-4">
              <div>
                <span className="text-sm font-medium text-blue-600">Cédula:</span>
                <p className="text-sm font-mono text-blue-800">{datos.cedula}</p>
              </div>
            </div>
          </div>

          {/* Información de cobertura */}
          <div className="bg-green-50 p-4 rounded-lg border border-green-200">
            <h4 className="font-semibold text-sm text-green-800 mb-3 flex items-center gap-2">
              🛡️ Cobertura de Salud
            </h4>
            <div className="space-y-3">
              <div>
                <span className="text-sm font-medium text-green-600">Estado de Cobertura:</span>
                <p className="text-sm font-semibold text-green-800">{datos.cobertura}</p>
              </div>
              {datos.detalle && (
                <div>
                  <span className="text-sm font-medium text-green-600">Detalles:</span>
                  <p className="text-sm text-green-700">{datos.detalle}</p>
                </div>
              )}
            </div>
          </div>

          {/* Tipo de afiliación */}
          <div className="bg-purple-50 p-4 rounded-lg border border-purple-200">
            <h4 className="font-semibold text-sm text-purple-800 mb-3 flex items-center gap-2">
              📋 Tipo de Afiliación
            </h4>
            <div>
              <span className="text-sm font-medium text-purple-600">Tipo:</span>
              <p className="text-sm font-semibold text-purple-800">{datos.tipoAfiliacion}</p>
            </div>
          </div>

          {/* Información adicional */}
          <div className="bg-gray-50 p-4 rounded-lg">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <span className="text-sm font-medium text-gray-600">Fecha de Consulta:</span>
                <p className="text-sm font-semibold text-gray-800">
                  {formatearFecha(datos.fechaConsulta)}
                </p>
              </div>
              <div>
                <span className="text-sm font-medium text-gray-600">Estado de Consulta:</span>
                <p className="text-sm font-semibold text-gray-800 capitalize">
                  {datos.estado}
                </p>
              </div>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  )

  return (
    <div className="flex flex-col min-h-screen">
      <header className="border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="flex h-14 items-center px-4">
          <SidebarTrigger />
          <div className="ml-4">
            <h1 className="text-lg font-semibold">Datos IESS</h1>
          </div>
        </div>
      </header>

      <div className="flex-1 p-6">
        <div className="max-w-4xl mx-auto">
          <Card>
            <CardHeader>
              <CardTitle>Consulta de Datos de Afiliación IESS</CardTitle>
              <CardDescription>
                Consulta la información de cobertura de salud y tipo de afiliación en el Instituto Ecuatoriano de Seguridad Social.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="cedula">Número de Cédula</Label>
                  <Input
                    id="cedula"
                    placeholder="Ej: 1234567890"
                    {...register("cedula", {
                      required: "La cédula es requerida",
                      pattern: {
                        value: /^\d{10}$/,
                        message: "La cédula debe tener 10 dígitos",
                      },
                    })}
                  />
                  {errors.cedula && <p className="text-sm text-destructive">{errors.cedula.message}</p>}
                </div>

                <div className="p-4 bg-blue-50 rounded-lg border border-blue-200">
                  <div className="flex items-start gap-3">
                    <span className="text-blue-600 text-xl">ℹ️</span>
                    <div>
                      <h4 className="font-semibold text-blue-800 mb-1">Información sobre la Consulta</h4>
                      <p className="text-sm text-blue-700">
                        Esta consulta verifica la cobertura de salud y el tipo de afiliación de una persona en el IESS. 
                        La información incluye el estado de cobertura para contingencias de enfermedad.
                      </p>
                    </div>
                  </div>
                </div>

                <div className="p-4 bg-yellow-50 rounded-lg border border-yellow-200">
                  <div className="flex items-start gap-3">
                    <span className="text-yellow-600 text-xl">⏱️</span>
                    <div>
                      <h4 className="font-semibold text-yellow-800 mb-1">Tiempo de Procesamiento</h4>
                      <p className="text-sm text-yellow-700">
                        Esta consulta puede tomar algunos minutos ya que se conecta directamente 
                        al sistema oficial del IESS para obtener información actualizada.
                      </p>
                    </div>
                  </div>
                </div>

                <Button type="submit" className="w-full" disabled={isLoading}>
                  {isLoading ? "Consultando... (Esto puede tomar unos minutos)" : "Consultar Datos IESS"}
                </Button>
              </form>
            </CardContent>
          </Card>

          {showCards && datosIESS && (
            <div className="space-y-6">
              <DatosIESSCard datos={datosIESS} />

              {/* Información legal */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">📖 Información Legal</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3 text-sm text-gray-600">
                    <p>
                      <strong>IESS:</strong> Instituto Ecuatoriano de Seguridad Social, entidad encargada 
                      de la seguridad social en Ecuador.
                    </p>
                    <p>
                      <strong>Cobertura de Salud:</strong> Información sobre el estado de cobertura para 
                      contingencias de enfermedad del afiliado.
                    </p>
                    <p>
                      <strong>Tipo de Afiliación:</strong> Categoría bajo la cual la persona está afiliada 
                      al sistema de seguridad social (empleado, patrono, voluntario, etc.).
                    </p>
                    <p>
                      <strong>Contingencia:</strong> Se consulta específicamente la contingencia de "Enfermedad" 
                      que incluye atención médica general.
                    </p>
                    <p>
                      <strong>Fuente:</strong> Portal oficial del IESS - Información obtenida en tiempo real 
                      del sistema oficial de gestión y calificación de derecho.
                    </p>
                    <p>
                      <strong>Nota:</strong> Esta información tiene carácter oficial y se actualiza 
                      automáticamente según los registros del IESS.
                    </p>
                  </div>
                </CardContent>
              </Card>
            </div>
          )}
        </div>
      </div>

      <ResultModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title="Resultado de Consulta - Datos IESS"
        result={result}
      />
    </div>
  )
}
