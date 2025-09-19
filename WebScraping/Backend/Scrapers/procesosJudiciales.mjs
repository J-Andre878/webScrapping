import { DatabaseOperations, Collections, ErrorLogsModel } from '../Models/database.js'

// Función para consultar API directa
async function consultarProcesosAPI(cedula) {
  console.log(`🌐 Consultando API de procesos judiciales para cédula: ${cedula}`)
  
  const url = 'https://api.funcionjudicial.gob.ec/EXPEL-CONSULTA-CAUSAS-SERVICE/api/consulta-causas/informacion/buscarCausas?page=1&size=10'
  
  let resultadosActor = []
  let resultadosDemandado = []
  
  try {
    // Consultar como actor
    console.log(`🔍 Buscando como actor...`)
    const payloadActor = {
      numeroCausa: "",
      actor: {
        cedulaActor: cedula,
        nombreActor: ""
      },
      demandado: {
        cedulaDemandado: "",
        nombreDemandado: ""
      },
      first: 1,
      numeroFiscalia: "",
      pageSize: 10,
      provincia: "",
      recaptcha: "verdad"
    }
    
    const responseActor = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/vnd.api.v1+json',
        'Accept': 'application/vnd.api.v1+json',
        'User-Agent': 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Origin': 'https://procesosjudiciales.funcionjudicial.gob.ec',
        'Referer': 'https://procesosjudiciales.funcionjudicial.gob.ec/',
      },
      body: JSON.stringify(payloadActor)
    })
    
    if (responseActor.ok) {
      const dataActor = await responseActor.json()
      resultadosActor = dataActor.map(proceso => ({
        id: proceso.id || "",
        fecha: proceso.fechaIngreso ? new Date(proceso.fechaIngreso).toLocaleDateString('es-ES') : "",
        numeroProceso: proceso.idJuicio || "",
        accionInfraccion: proceso.nombreDelito || ""
      }))
      console.log(`✅ Encontrados ${resultadosActor.length} procesos como actor`)
    } else {
      console.log(`⚠️ Error consultando como actor: ${responseActor.status}`)
    }
    
    // Consultar como demandado
    console.log(`🔍 Buscando como demandado...`)
    const payloadDemandado = {
      numeroCausa: "",
      actor: {
        cedulaActor: "",
        nombreActor: ""
      },
      demandado: {
        cedulaDemandado: cedula,
        nombreDemandado: ""
      },
      first: 1,
      numeroFiscalia: "",
      pageSize: 10,
      provincia: "",
      recaptcha: "verdad"
    }
    
    const responseDemandado = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/vnd.api.v1+json',
        'Accept': 'application/vnd.api.v1+json',
        'User-Agent': 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Origin': 'https://procesosjudiciales.funcionjudicial.gob.ec',
        'Referer': 'https://procesosjudiciales.funcionjudicial.gob.ec/',
      },
      body: JSON.stringify(payloadDemandado)
    })
    
    if (responseDemandado.ok) {
      const dataDemandado = await responseDemandado.json()
      resultadosDemandado = dataDemandado.map(proceso => ({
        id: proceso.id || "",
        fecha: proceso.fechaIngreso ? new Date(proceso.fechaIngreso).toLocaleDateString('es-ES') : "",
        numeroProceso: proceso.idJuicio || "",
        accionInfraccion: proceso.nombreDelito || ""
      }))
      console.log(`✅ Encontrados ${resultadosDemandado.length} procesos como demandado`)
    } else {
      console.log(`⚠️ Error consultando como demandado: ${responseDemandado.status}`)
    }
    
    return { resultadosActor, resultadosDemandado, metodo: 'API' }
    
  } catch (error) {
    console.error(`❌ Error en API de procesos judiciales:`, error.message)
    throw error
  }
}

// Función fallback usando Playwright (método original)
async function consultarProcesosPlaywright(cedula) {
  console.log(`🎭 Usando Playwright como fallback...`)
  
  const { chromium } = await import("playwright")
  
  const browser = await chromium.launch({ 
    headless: false,
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--disable-gpu'
    ]
  })
  const page = await browser.newPage()

  try {
    console.log(`🌐 Navegando a página de procesos judiciales...`)
    await page.goto("https://procesosjudiciales.funcionjudicial.gob.ec/busqueda-filtros", {
      waitUntil: "domcontentloaded",
      timeout: 30000
    })
    
    console.log(`📄 Página cargada. Título: ${await page.title()}`)
    
    console.log(`📝 Ingresando cédula: ${cedula}`)
    
    let resultadosActor = []
    let resultadosDemandado = []

    console.log(`🔍 Buscando como actor...`)
    // Rellenamos el campo de cédula
    await page.type('input[formcontrolname="cedulaActor"]', cedula)    
    // Se le da click al botón de buscar
    await page.waitForSelector('.boton-buscar:not([disabled])', { timeout: 5000 })
    await page.click('.boton-buscar')
    
    // Espera hasta que aparezca la primera etiqueta que tiene la clase cuerpo o la que tiene la clase mat-mdc-simple-snack-bar
    const estadoActor = await Promise.race([
      page.waitForSelector('.mat-mdc-simple-snack-bar.ng-star-inserted', { timeout: 60000 }).then(() => 'no_resultados'),
      page.waitForSelector('.cuerpo', { timeout: 60000 }).then(() => 'ok'),
    ])

    //Si se encontró la etiqueta que tiene la clase mat-mdc-simple-snack-bar PRIMERO (No se encontraron resultados)
    if (estadoActor === 'no_resultados') {
      console.log(`ℹ️ No hay procesos judiciales registrados para la cédula ${cedula}`)
    } else {
      resultadosActor = await extraerDatos(page) //Función para extraer los datos de la página
      // Se le da click al boton de regresar para buscar por demandado
      await page.click('.botones.btn-regresar.mdc-button')
    }

    // Rellenamos el campo de cédula
    await page.fill('input[formcontrolname="cedulaDemandado"]', cedula)
    // Se le da click al botón de buscar
    await page.waitForSelector('.boton-buscar:not([disabled])', { timeout: 5000 })
    await page.click('.boton-buscar')
    
    // Espera hasta que aparezca la primera etiqueta que tiene la clase cuerpo o la que tiene la clase mat-mdc-simple-snack-bar
    const estadoDemandado = await Promise.race([
      page.waitForSelector('.mat-mdc-simple-snack-bar.ng-star-inserted', { timeout: 60000 }).then(() => 'no_resultados'),
      page.waitForSelector('.cuerpo', { timeout: 60000 }).then(() => 'ok'),
    ])

    //Si se encontró la etiqueta que tiene la clase mat-mdc-simple-snack-bar PRIMERO (No se encontraron resultados)
    if (estadoDemandado === 'no_resultados') {
      console.log(`ℹ️ No hay procesos judiciales registrados para la cédula ${cedula}`)
    } else {
      resultadosDemandado = await extraerDatos(page) //Función para extraer los datos de la página
    }

    return { resultadosActor, resultadosDemandado, metodo: 'Playwright' }

  } finally {
    await browser.close()
  }
}

export const obtenerProcesosJudiciales = async (cedula) => {
  console.log(`🔍 Iniciando consulta de procesos judiciales para cédula: ${cedula}`)
  
  try {
    // Intentar primero con API
    console.log(`🌐 Intentando método API directo...`)
    const resultadoAPI = await consultarProcesosAPI(cedula)
    
    let { resultadosActor, resultadosDemandado } = resultadoAPI
    let metodoUsado = 'API'

    // Si API no funciona o no encuentra datos, usar Playwright como fallback
    if (resultadosActor.length === 0 && resultadosDemandado.length === 0) {
      console.log(`🔄 API no retornó datos, intentando con Playwright...`)
      const resultadoPlaywright = await consultarProcesosPlaywright(cedula)
      resultadosActor = resultadoPlaywright.resultadosActor
      resultadosDemandado = resultadoPlaywright.resultadosDemandado
      metodoUsado = 'Playwright'
    }

    const resultados = [...resultadosActor, ...resultadosDemandado]

    console.log(`✅ Se encontraron ${resultadosActor.length} procesos como actor y ${resultadosDemandado.length} como demandado (${metodoUsado})`)

    // Guardar en base de datos usando el modelo
    if (resultadosActor.length > 0 || resultadosDemandado.length > 0) {
      const datosParaGuardar = {
        cedula,
        procesos: {
          resultadosActor: resultadosActor,
          resultadosDemandado: resultadosDemandado
        },
        totalProcesosActor: resultadosActor.length,
        totalProcesosDemandado: resultadosDemandado.length,
        fechaConsulta: new Date(),
        estado: (resultadosActor.length > 0 || resultadosDemandado.length > 0) ? 'con_procesos' : 'sin_procesos'
      }

      try {
        await DatabaseOperations.upsert(
          Collections.PROCESOS_JUDICIALES,
          { cedula },
          datosParaGuardar
        )
        console.log(`💾 Datos guardados en base de datos`)
      } catch (dbError) {
        console.warn(`⚠️ Error guardando en BD: ${dbError.message}`)
      }
    }

    // Retornar datos para el controller
    return {
      cedula,
      procesos: {
        resultadosActor: resultadosActor,
        resultadosDemandado: resultadosDemandado
      },
      totalProcesosActor: resultadosActor.length,
      totalProcesosDemandado: resultadosDemandado.length,
      fechaConsulta: new Date(),
      estado: (resultadosActor.length > 0 || resultadosDemandado.length > 0) ? 'exitoso' : 'sin_datos'
    }

  } catch (error) {
    console.error("\n❌ Error en obtenerProcesos:", error.message)
    
    // Guardar error en base de datos
    try {
      await ErrorLogsModel.saveError(
        'procesos-judiciales',
        cedula,
        'error_general',
        { 
          mensaje: error.message || 'Error al consultar procesos judiciales',
          stack: error.stack,
          tipo: error.name || 'Error'
        }
      )
    } catch (logError) {
      console.warn('⚠️ Error guardando log:', logError.message)
    }
    
    throw new Error(`Error al consultar procesos judiciales: ${error.message}`)
  }
}

async function extraerDatos(page) {
  try {
    //Recorro los elementos que tiene la clase causa-individual y obtengo los datos
    const resultados = await page.$$eval(".causa-individual", (elementos) => {
      return elementos.map((el) => {
        return {
          id: el.querySelector(".id")?.innerText.trim() || "",
          fecha: el.querySelector(".fecha")?.innerText.trim() || "",
          numeroProceso: el.querySelector(".numero-proceso")?.innerText.trim() || "",
          accionInfraccion: el.querySelector(".accion-infraccion")?.innerText.trim() || ""
        }
      })
    })

    console.log(`✅ Se encontraron ${resultados.length} procesos judiciales`)
    return resultados

  } catch (error) {
    console.error("\n❌ Error al extraer datos:", error.message)
    return []
  }
}