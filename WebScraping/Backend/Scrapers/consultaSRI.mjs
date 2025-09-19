import { DatabaseOperations, Collections, ErrorLogsModel } from '../Models/database.js'

export const obtenerDatosRuc = async (ruc) => {
  console.log(`🔍 Iniciando consulta SRI para RUC: ${ruc}`)
  
  try {
    console.log(`🌐 Consultando APIs del SRI...`)
    
    // Configurar headers comunes para las APIs
    const headers = {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
      'Accept': 'application/json, text/plain, */*',
      'Accept-Language': 'es-ES,es;q=0.9,en;q=0.8',
      'Referer': 'https://srienlinea.sri.gob.ec/'
    }

    // API 1: Datos del contribuyente
    const contribuyenteUrl = `https://srienlinea.sri.gob.ec/sri-catastro-sujeto-servicio-internet/rest/ConsolidadoContribuyente/obtenerPorNumerosRuc?&ruc=${ruc}`
    
    // API 2: Establecimientos
    const establecimientosUrl = `https://srienlinea.sri.gob.ec/sri-catastro-sujeto-servicio-internet/rest/Establecimiento/consultarPorNumeroRuc?numeroRuc=${ruc}`

    console.log(`📊 Consultando datos del contribuyente...`)
    const contribuyenteResponse = await fetch(contribuyenteUrl, {
      method: 'GET',
      headers
    })

    if (!contribuyenteResponse.ok) {
      throw new Error(`Error HTTP en API contribuyente: ${contribuyenteResponse.status} - ${contribuyenteResponse.statusText}`)
    }

    const contribuyenteApiData = await contribuyenteResponse.json()
    console.log(`✅ Datos del contribuyente obtenidos`)

    console.log(`🏢 Consultando establecimientos...`)
    const establecimientosResponse = await fetch(establecimientosUrl, {
      method: 'GET',
      headers
    })

    let establecimientosApiData = []
    if (establecimientosResponse.ok) {
      establecimientosApiData = await establecimientosResponse.json()
      console.log(`✅ Datos de establecimientos obtenidos: ${establecimientosApiData.length} establecimientos`)
    } else {
      console.log(`⚠️ No se pudieron obtener datos de establecimientos (${establecimientosResponse.status})`)
    }

    // Verificar si se encontraron datos del contribuyente
    if (!contribuyenteApiData || contribuyenteApiData.length === 0) {
      console.log(`ℹ️ No se encontraron datos para el RUC ${ruc}.`)
      return {
        ruc,
        datosContribuyente: {},
        establecimientos: [],
        fechaConsulta: new Date(),
        estado: 'sin_datos'
      }
    }

    const contribuyenteData = contribuyenteApiData[0]
    
    // Mapear los datos de la API al formato esperado por el sistema
    const datosContribuyente = {
      estado: contribuyenteData.estadoContribuyenteRuc || "",
      tipoContribuyente: contribuyenteData.tipoContribuyente || "",
      regimen: contribuyenteData.regimen || "",
      razonSocial: contribuyenteData.razonSocial || "",
      actividadEconomicaPrincipal: contribuyenteData.actividadEconomicaPrincipal || "",
      categoria: contribuyenteData.categoria || "",
      obligadoLlevarContabilidad: contribuyenteData.obligadoLlevarContabilidad || "",
      agenteRetencion: contribuyenteData.agenteRetencion || "",
      contribuyenteEspecial: contribuyenteData.contribuyenteEspecial || "",
      contribuyenteFantasma: contribuyenteData.contribuyenteFantasma || "",
      transaccionesInexistente: contribuyenteData.transaccionesInexistente || "",
      fechaInicioActividades: contribuyenteData.informacionFechasContribuyente?.fechaInicioActividades || "",
      fechaCese: contribuyenteData.informacionFechasContribuyente?.fechaCese || "",
      fechaReinicioActividades: contribuyenteData.informacionFechasContribuyente?.fechaReinicioActividades || "",
      fechaActualizacion: contribuyenteData.informacionFechasContribuyente?.fechaActualizacion || "",
      representantesLegales: contribuyenteData.representantesLegales || null,
      motivoCancelacionSuspension: contribuyenteData.motivoCancelacionSuspension || null
    }

    // Mapear establecimientos desde la API específica
    let establecimientos = []
    
    if (establecimientosApiData && establecimientosApiData.length > 0) {
      establecimientos = establecimientosApiData.map(est => ({
        numEstablecimiento: est.numeroEstablecimiento || "",
        nombre: est.nombreFantasiaComercial || contribuyenteData.razonSocial || "",
        ubicacion: est.direccionCompleta || "",
        estado: est.estado || "",
        tipoEstablecimiento: est.tipoEstablecimiento || "",
        esMatriz: est.matriz === "SI"
      }))
    } else {
      // Fallback: crear establecimiento basado en datos del contribuyente
      establecimientos = [{
        numEstablecimiento: "001",
        nombre: contribuyenteData.razonSocial || "",
        ubicacion: "MATRIZ",
        estado: contribuyenteData.estadoContribuyenteRuc || "",
        tipoEstablecimiento: "MAT",
        esMatriz: true
      }]
    }

    console.log(`✅ Se encontraron datos del RUC ${ruc}`)
    console.log(`   - Datos del contribuyente: Encontrado`)
    console.log(`   - Razón Social: ${contribuyenteData.razonSocial}`)
    console.log(`   - Estado: ${contribuyenteData.estadoContribuyenteRuc}`)
    console.log(`   - Establecimientos: ${establecimientos.length} encontrados`)
    
    // Mostrar resumen de establecimientos
    establecimientos.forEach(est => {
      console.log(`     * Est. ${est.numEstablecimiento}: ${est.nombre} (${est.estado}) - ${est.esMatriz ? 'MATRIZ' : 'SUCURSAL'}`)
    })

    const resultado = {
      ruc,
      datosContribuyente,
      establecimientos,
      fechaConsulta: new Date(),
      estado: 'exitoso'
    }

    // Guardar en base de datos usando el modelo SRI personalizado
    const existingDoc = await DatabaseOperations.findByRuc(Collections.DATOS_SRI, ruc)

    if (!existingDoc) {
      await DatabaseOperations.insertOne(Collections.DATOS_SRI, resultado)
      console.log(`💾 Se guardaron los datos del RUC ${ruc} en la base de datos`)
    } else {
      // Verificar cambios en datos del contribuyente
      let updateOperations = {}
      if (JSON.stringify(existingDoc.datosContribuyente) !== JSON.stringify(resultado.datosContribuyente)) {
        updateOperations.datosContribuyente = resultado.datosContribuyente
      }

      // Agregar nuevos establecimientos
      await DatabaseOperations.addToArrayNoDuplicates(
        Collections.DATOS_SRI,
        { ruc },
        'establecimientos',
        establecimientos,
        ['numEstablecimiento', 'nombre', 'ubicacion']
      )

      // Actualizar datos del contribuyente si cambiaron
      if (Object.keys(updateOperations).length > 0) {
        await DatabaseOperations.updateOne(
          Collections.DATOS_SRI,
          { ruc },
          { $set: updateOperations }
        )
        console.log(`💾 Se actualizaron los datos del contribuyente para el RUC ${ruc}`)
      }
    }

    return resultado

  } catch (error) {
    console.error("\n❌ Error en obtenerDatosRuc:", error.message)
    
    // Guardar error en base de datos
    await ErrorLogsModel.saveError(
      'consulta-sri',
      ruc,  // Usamos RUC en lugar de cédula
      'error_general',
      { 
        mensaje: error.message || 'Error al consultar SRI',
        stack: error.stack,
        tipo: error.name || 'Error'
      }
    ).catch(err => console.warn('⚠️ Error guardando log:', err.message));
    
    throw new Error(`Error al consultar SRI: ${error.message}`)
  }
}