import { chromium } from "playwright"
import { DatabaseOperations, Collections, ErrorLogsModel } from '../Models/database.js'

export const obtenerPensionAlimenticia = async (cedula) => {
  console.log(`🔍 Iniciando consulta de pensión alimenticia para cédula: ${cedula}`)
  
  const browser = await chromium.launch({ 
    headless: true,
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--disable-gpu'
    ]
  })
  const page = await browser.newPage()

  try {
    console.log(`🌐 Navegando a página de pensión alimenticia...`)
    await page.goto("https://supa.funcionjudicial.gob.ec/pensiones/publico/consulta.jsf", {
      waitUntil: "domcontentloaded",
      timeout: 30000
    })
    
    console.log(`📄 Página cargada. Título: ${await page.title()}`)
    
    console.log(`📝 Ingresando cédula: ${cedula}`)

    // Rellenamos el campo de cédula
    await page.type("#form\\:t_texto_cedula", cedula) 

    //Espera hasta que se le de click al botón de buscar (Cuando se le da click se cierra la ventana)
    await page.click("#form\\:b_buscar_cedula")

    //Espera 2 segundos para que se cargue la tabla de pensiones alimenticias
    await page.waitForTimeout(2000)

    //Recorro las filas de la tabla y obtengo los datos
    const resultados = await page.$$eval("#form\\:j_idt57_data > tr", (filas) => {
      return filas.map((fila) => {
        const todasColumnas = Array.from(fila.querySelectorAll("td"))
        
        // Verificar si es el mensaje de "No se encuentra resultados"
        if (todasColumnas[0]?.innerText.trim() === "No se encuentra resultados.") {
          return null
        }

        // Tabla anidada de intervinientes dentro de la columna 4
        const tablaAnidada = todasColumnas[4]?.querySelector("table");
        let intervinientes = {};

        if (tablaAnidada) {
          const filasAnidadas = tablaAnidada.querySelectorAll("tr");

          const fila0 = filasAnidadas[0]?.querySelectorAll("td") || [];
          const fila3 = filasAnidadas[3]?.querySelectorAll("td") || [];
          intervinientes = {
            representanteLegal: fila0[1]?.innerText.trim() || "",
            obligadoPrincipal: fila3[1]?.innerText.trim() || ""
          };
        }

        return {
          codigo: todasColumnas[0]?.innerText.trim() || "",
          numProcesoJudicial: todasColumnas[1]?.innerText.trim() || "",
          dependenciaJurisdiccional: todasColumnas[2]?.innerText.trim() || "",
          tipoPension: todasColumnas[3]?.innerText.trim() || "",
          intervinientes: intervinientes,
        }
      }).filter(item => item !== null) // Filtrar elementos null
    })

    console.log(`✅ Se encontraron ${resultados.length} pensiones alimenticias para la cédula ${cedula}`)

    if (resultados.length === 0) {
      console.log(`ℹ️ No se encontraron pensiones alimenticias para la cédula ${cedula}.`)
      return {
        cedula,
        pensiones: [],
        totalPensiones: 0,
        fechaConsulta: new Date(),
        estado: 'sin_datos'
      }
    }

    // Guardar en base de datos usando el modelo
    await DatabaseOperations.addToArrayNoDuplicates(
      Collections.PENSION_ALIMENTICIA,
      { cedula },
      'pensiones',
      resultados,
      ['codigo', 'numProcesoJudicial']
    )

    console.log(`💾 Datos guardados en base de datos para la cédula ${cedula}`)

    // Retornar datos para el controller
    return {
      cedula,
      pensiones: resultados,
      totalPensiones: resultados.length,
      fechaConsulta: new Date(),
      estado: 'exitoso'
    }

  } catch (error) {
    console.error("\n❌ Error en obtenerPensiones:", error.message)
    
    // Guardar error en base de datos
    await ErrorLogsModel.saveError(
      'pension-alimenticia',
      cedula,
      'error_general',
      { 
        mensaje: error.message || 'Error al consultar pensiones alimenticias',
        stack: error.stack,
        tipo: error.name || 'Error'
      }
    ).catch(err => console.warn('⚠️ Error guardando log:', err.message));
    
    throw new Error(`Error al consultar pensiones alimenticias: ${error.message}`)
  } finally {
    await browser.close()
  }
}