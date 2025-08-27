import { MongoClient } from 'mongodb'

// Configuración de la base de datos
const config = {
  uri: process.env.MONGODB_URI || "mongodb://localhost:27017",
  dbName: process.env.DB_NAME || "webScraping",
  options: {
    serverSelectionTimeoutMS: 5000,
    socketTimeoutMS: 45000,
  }
}

// Cliente MongoDB
let client = null
let db = null

// Conexión a la base de datos
export const connectDB = async () => {
  try {
    if (!client) {
      client = new MongoClient(config.uri, config.options)
      await client.connect()
      db = client.db(config.dbName)
      console.log(`✅ Conectado a MongoDB: ${config.dbName}`)
    }
    return db
  } catch (error) {
    console.error('❌ Error conectando a MongoDB:', error)
    throw error
  }
}

// Cerrar conexión
export const closeDB = async () => {
  try {
    if (client) {
      await client.close()
      client = null
      db = null
      console.log('🔌 Conexión a MongoDB cerrada')
    }
  } catch (error) {
    console.error('❌ Error cerrando conexión MongoDB:', error)
  }
}

// Obtener la instancia de la base de datos
export const getDB = () => {
  if (!db) {
    throw new Error('Base de datos no conectada. Llama a connectDB() primero.')
  }
  return db
}

// Obtener una colección específica
export const getCollection = (collectionName) => {
  const database = getDB()
  return database.collection(collectionName)
}

// Modelos/Esquemas para las colecciones
export const Collections = {
  ANTECEDENTES_PENALES: 'antecedentesPenales',
  DATOS_IESS: 'datosIESS',
  CITACIONES_ANT: 'citacionesANT',
  CITACIONES_JUDICIALES: 'citacionesJudiciales',
  CONSEJO_JUDICATURA: 'consejoJudicatura',
  DATOS_SRI: 'datosSRI',
  IMPEDIMENTOS_CARGOS_PUBLICOS: 'impedimentosCargosPublicos',
  PENSION_ALIMENTICIA: 'pensionAlimenticia',
  PROCESOS_JUDICIALES: 'procesosJudiciales',
  SENESCYT: 'senescyt',
  SRI_DEUDAS: 'sri-deudas',
  SUPERCIAS_EMPRESAS: 'supercias-empresas',
  INTERPOL: 'interpol',
  ERROR_LOGS: 'errorLogs'

}

// Funciones auxiliares para operaciones comunes
export const DatabaseOperations = {
  
  // Buscar un documento por cédula
  async findByCedula(collectionName, cedula) {
    const collection = getCollection(collectionName)
    return await collection.findOne({ cedula })
  },

  // Buscar un documento por RUC
  async findByRuc(collectionName, ruc) {
    const collection = getCollection(collectionName)
    return await collection.findOne({ ruc })
  },

  // Insertar un nuevo documento
  async insertOne(collectionName, document) {
    const collection = getCollection(collectionName)
    const documentWithTimestamp = {
      ...document,
      fechaCreacion: new Date(),
      fechaActualizacion: new Date()
    }
    return await collection.insertOne(documentWithTimestamp)
  },

  // Actualizar un documento existente
  async updateOne(collectionName, filter, update) {
    const collection = getCollection(collectionName)
    const updateWithTimestamp = {
      ...update,
      $set: {
        ...update.$set,
        fechaActualizacion: new Date()
      }
    }
    return await collection.updateOne(filter, updateWithTimestamp)
  },

  // Buscar o crear un documento (upsert)
  async upsert(collectionName, filter, document) {
    const collection = getCollection(collectionName)
    const documentWithTimestamp = {
      ...document,
      fechaActualizacion: new Date()
    }
    
    return await collection.updateOne(
      filter,
      { 
        $set: documentWithTimestamp,
        $setOnInsert: { fechaCreacion: new Date() }
      },
      { upsert: true }
    )
  },

  // Agregar elementos a un array sin duplicados
  async addToArrayNoDuplicates(collectionName, filter, arrayField, newItems, uniqueFields = []) {
    const collection = getCollection(collectionName)
    
    // Si no hay campos únicos especificados, agregar directamente
    if (uniqueFields.length === 0) {
      return await collection.updateOne(
        filter,
        { 
          $push: { [arrayField]: { $each: newItems } },
          $set: { fechaActualizacion: new Date() }
        }
      )
    }

    // Verificar duplicados basados en campos únicos
    const existingDoc = await collection.findOne(filter)
    if (!existingDoc || !existingDoc[arrayField]) {
      return await collection.updateOne(
        filter,
        { 
          $set: { 
            [arrayField]: newItems,
            fechaActualizacion: new Date()
          }
        },
        { upsert: true }
      )
    }

    const existingItems = existingDoc[arrayField] || []
    const itemsToAdd = newItems.filter(newItem => 
      !existingItems.some(existingItem => 
        uniqueFields.every(field => 
          existingItem[field] === newItem[field]
        )
      )
    )

    if (itemsToAdd.length > 0) {
      return await collection.updateOne(
        filter,
        { 
          $push: { [arrayField]: { $each: itemsToAdd } },
          $set: { fechaActualizacion: new Date() }
        }
      )
    }

    return { matchedCount: 1, modifiedCount: 0 } // No se agregó nada nuevo
  },

  // Obtener estadísticas de una colección
  async getStats(collectionName) {
    const collection = getCollection(collectionName)
    const stats = await collection.stats()
    const count = await collection.countDocuments()
    
    return {
      collectionName,
      documentCount: count,
      storageSize: stats.storageSize,
      avgObjSize: stats.avgObjSize,
      indexCount: stats.nindexes
    }
  },

  // Crear índices para optimizar consultas
  async createIndexes() {
    try {
      // Verificar si tenemos permisos para crear índices
      const testCollection = getCollection('test_auth')
      
      try {
        await testCollection.createIndex({ test: 1 })
        await testCollection.drop() // Limpiar la colección de prueba
      } catch (authError) {
        if (authError.code === 13 || authError.codeName === 'Unauthorized') { // Unauthorized
          console.log('⚠️  Saltando creación de índices - MongoDB en modo sin autenticación')
          console.log('✅ La aplicación funcionará correctamente sin índices')
          console.log('💡 Los índices mejoran el rendimiento pero no son obligatorios')
          return
        }
        throw authError
      }

      // Índices para consultas por cédula
      const cedulaCollections = [
        Collections.ANTECEDENTES_PENALES,
        Collections.DATOS_IESS,
        Collections.CITACIONES_ANT,
        Collections.CITACIONES_JUDICIALES,
        Collections.PENSION_ALIMENTICIA,
        Collections.PROCESOS_JUDICIALES,
        Collections.SENESCYT
      ]

      for (const collectionName of cedulaCollections) {
        const collection = getCollection(collectionName)
        await collection.createIndex({ cedula: 1 }, { unique: true })
        await collection.createIndex({ fechaActualizacion: -1 })
      }

      // Índice para RUC en datos SRI
      const sriCollection = getCollection(Collections.DATOS_SRI)
      await sriCollection.createIndex({ ruc: 1 }, { unique: true })
      await sriCollection.createIndex({ fechaActualizacion: -1 })

      // Índice para impedimentos (no requiere cédula)
      const impedimentosCollection = getCollection(Collections.IMPEDIMENTOS_CARGOS_PUBLICOS)
      await impedimentosCollection.createIndex({ tipo: 1 }, { unique: true })

      // Índices para logs de errores
      const errorLogsCollection = getCollection(Collections.ERROR_LOGS)
      await errorLogsCollection.createIndex({ cedula: 1 })
      await errorLogsCollection.createIndex({ servicio: 1 })
      await errorLogsCollection.createIndex({ tipoError: 1 })
      await errorLogsCollection.createIndex({ fechaError: -1 })
      await errorLogsCollection.createIndex({ timestamp: -1 })
      await impedimentosCollection.createIndex({ fechaActualizacion: -1 })

      // Índice para consejo de judicatura
      const consejoCollection = getCollection(Collections.CONSEJO_JUDICATURA)
      await consejoCollection.createIndex({ tipo: 1 })
      await consejoCollection.createIndex({ fechaActualizacion: -1 })

      // Índices para Interpol
      const interpolCollection = getCollection(Collections.INTERPOL)
      // Primero eliminar documentos con clave null o vacía
      await interpolCollection.deleteMany({ 
        $or: [
          { clave: null }, 
          { clave: "" }, 
          { clave: { $exists: false } }
        ] 
      })
      
      // Crear índices sin unique constraint problemático
      await interpolCollection.createIndex({ clave: 1 }, { 
        unique: true,
        partialFilterExpression: { 
          clave: { $exists: true, $type: "string" } 
        }
      })
      await interpolCollection.createIndex({ fechaConsulta: -1 })
      await interpolCollection.createIndex({ homonimo: 1 })
      await interpolCollection.createIndex({ cantidadResultados: 1 })
      
      console.log('✅ Índices de base de datos creados exitosamente')
    } catch (error) {
      if (error.code === 13 || error.codeName === 'Unauthorized') { // Unauthorized
        console.log('⚠️  MongoDB en modo sin autenticación - funcionando sin índices')
        console.log('✅ La aplicación está lista para usar')
      } else {
        console.error('❌ Error creando índices:', error.message)
        console.log('⚠️  Continuando sin índices - la aplicación funcionará más lentamente')
      }
    }
  },

  // Limpiar datos antiguos (opcional)
  async cleanOldData(collectionName, daysOld = 30) {
    const collection = getCollection(collectionName)
    const cutoffDate = new Date()
    cutoffDate.setDate(cutoffDate.getDate() - daysOld)

    const result = await collection.deleteMany({
      fechaActualizacion: { $lt: cutoffDate }
    })

    console.log(`🧹 Eliminados ${result.deletedCount} documentos antiguos de ${collectionName}`)
    return result
  }
}

// Funciones específicas para cada tipo de datos
export const AntecedentesPenalesModel = {
  async save(cedula, datosAntecedentes) {
    return await DatabaseOperations.upsert(
      Collections.ANTECEDENTES_PENALES,
      { cedula },
      datosAntecedentes
    )
  },

  async findByCedula(cedula) {
    return await DatabaseOperations.findByCedula(Collections.ANTECEDENTES_PENALES, cedula)
  },

  async getAllConsultas() {
    const collection = getCollection(Collections.ANTECEDENTES_PENALES)
    return await collection.find({}).sort({ fechaConsulta: -1 }).toArray()
  },

  async getConsultasConAntecedentes() {
    const collection = getCollection(Collections.ANTECEDENTES_PENALES)
    return await collection.find({ tieneAntecedentes: true }).sort({ fechaConsulta: -1 }).toArray()
  }
}


export const DatosIESSModel = {
  async save(cedula, datosIESS) {
    return await DatabaseOperations.upsert(
      Collections.DATOS_IESS,
      { cedula },
      datosIESS
    )
  },

  async findByCedula(cedula) {
    return await DatabaseOperations.findByCedula(Collections.DATOS_IESS, cedula)
  },

  async getAllConsultas() {
    const collection = getCollection(Collections.DATOS_IESS)
    return await collection.find({}).sort({ fechaConsulta: -1 }).toArray()
  },

  async getConsultasExitosas() {
    const collection = getCollection(Collections.DATOS_IESS)
    return await collection.find({ estado: 'exitoso' }).sort({ fechaConsulta: -1 }).toArray()
  },

  async getConsultasConCobertura() {
    const collection = getCollection(Collections.DATOS_IESS)
    return await collection.find({ 
      estado: 'exitoso',
      cobertura: { $exists: true, $ne: null, $ne: '' }
    }).sort({ fechaConsulta: -1 }).toArray()
  },

  async getEstadisticas() {
    const collection = getCollection(Collections.DATOS_IESS)
    
    const totalConsultas = await collection.countDocuments()
    const consultasExitosas = await collection.countDocuments({ estado: 'exitoso' })
    const consultasConCobertura = await collection.countDocuments({ 
      estado: 'exitoso',
      cobertura: { $exists: true, $ne: null, $ne: '' }
    })
    const consultasConError = await collection.countDocuments({ error: { $exists: true } })
    
    return {
      totalConsultas,
      consultasExitosas,
      consultasConCobertura,
      consultasConError,
      tasaExito: totalConsultas > 0 ? (consultasExitosas / totalConsultas * 100).toFixed(2) : 0,
      porcentajeConCobertura: consultasExitosas > 0 ? (consultasConCobertura / consultasExitosas * 100).toFixed(2) : 0
    }
  }
}

export const PensionAlimenticiaModel = {
  async save(cedula, pensiones) {
    return await DatabaseOperations.addToArrayNoDuplicates(
      Collections.PENSION_ALIMENTICIA,
      { cedula },
      'pensiones',
      pensiones,
      ['codigo', 'numProcesoJudicial']
    )
  },

  async findByCedula(cedula) {
    return await DatabaseOperations.findByCedula(Collections.PENSION_ALIMENTICIA, cedula)
  }
}

export const SRIModel = {
  async save(ruc, datosContribuyente, establecimientos) {
    const collection = getCollection(Collections.DATOS_SRI)
    const existingDoc = await collection.findOne({ ruc })

    if (!existingDoc) {
      return await DatabaseOperations.insertOne(Collections.DATOS_SRI, {
        ruc,
        datosContribuyente,
        establecimientos
      })
    }

    // Actualizar datos del contribuyente si han cambiado
    let updateOperations = {}
    if (JSON.stringify(existingDoc.datosContribuyente) !== JSON.stringify(datosContribuyente)) {
      updateOperations.datosContribuyente = datosContribuyente
    }

    // Agregar nuevos establecimientos
    const result = await DatabaseOperations.addToArrayNoDuplicates(
      Collections.DATOS_SRI,
      { ruc },
      'establecimientos',
      establecimientos,
      ['numEstablecimiento', 'nombre', 'ubicacion']
    )

    // Actualizar datos del contribuyente si es necesario
    if (Object.keys(updateOperations).length > 0) {
      await DatabaseOperations.updateOne(
        Collections.DATOS_SRI,
        { ruc },
        { $set: updateOperations }
      )
    }

    return result
  },

  async findByRuc(ruc) {
    return await DatabaseOperations.findByRuc(Collections.DATOS_SRI, ruc)
  }
}

export const InterpolModel = {
  async save(clave, cantidadResultados, homonimo, avisos) {
    const datosConsulta = {
      clave: clave.trim(),
      cantidadResultados,
      homonimo,
      fechaConsulta: new Date(),
      avisos
    };

    return await DatabaseOperations.upsert(
      Collections.INTERPOL,
      { clave: clave.trim() },
      datosConsulta
    );
  },

  async findByClave(clave) {
    const collection = getCollection(Collections.INTERPOL);
    return await collection.findOne({ clave: clave.trim() });
  },

  async getAllConsultas() {
    const collection = getCollection(Collections.INTERPOL);
    return await collection.find({}).sort({ fechaConsulta: -1 }).toArray();
  },

  async getConsultasConHomonimos() {
    const collection = getCollection(Collections.INTERPOL);
    return await collection.find({ homonimo: true }).sort({ fechaConsulta: -1 }).toArray();
  }
};
export const SuperciasEmpresasModel = {
  async save(cedulaRuc, datosConsulta) {
    return await DatabaseOperations.upsert(
      Collections.SUPERCIAS_EMPRESAS,
      { cedulaRuc },
      datosConsulta
    )
  },

  async findByCedulaRuc(cedulaRuc) {
    const collection = getCollection(Collections.SUPERCIAS_EMPRESAS)
    return await collection.findOne({ cedulaRuc })
  },

  async getAllConsultas() {
    const collection = getCollection(Collections.SUPERCIAS_EMPRESAS)
    return await collection.find({}).sort({ fechaConsulta: -1 }).toArray()
  },

  async getConsultasExitosas() {
    const collection = getCollection(Collections.SUPERCIAS_EMPRESAS)
    return await collection.find({ estado: 'exitoso' }).sort({ fechaConsulta: -1 }).toArray()
  },

  async getConsultasConDatos() {
    const collection = getCollection(Collections.SUPERCIAS_EMPRESAS)
    return await collection.find({ 
      estado: 'exitoso',
      totalRegistros: { $gt: 0 }
    }).sort({ fechaConsulta: -1 }).toArray()
  },
  async getEstadisticas() {
    const collection = getCollection(Collections.SUPERCIAS_EMPRESAS)
    
    const totalConsultas = await collection.countDocuments()
    const consultasExitosas = await collection.countDocuments({ estado: 'exitoso' })
    const consultasConDatos = await collection.countDocuments({ 
      estado: 'exitoso',
      totalRegistros: { $gt: 0 }
    })
    
    const personasNaturales = await collection.countDocuments({ 
      tipoPersona: 'Persona Natural' 
    })
    const personasJuridicas = await collection.countDocuments({ 
      tipoPersona: 'Persona Jurídica' 
    })

    return {
      totalConsultas,
      consultasExitosas,
      consultasConDatos,
      personasNaturales,
      personasJuridicas,
      tasaExito: totalConsultas > 0 ? (consultasExitosas / totalConsultas * 100).toFixed(2) : 0
    }
  }
}

// Modelo para logs de errores
export const ErrorLogsModel = {
  async saveError(servicio, cedula, error, detalles = {}) {
    const errorLog = {
      servicio,          // Ej: 'datos-iess', 'antecedentes-penales', etc.
      cedula,            // Cédula que se estaba consultando
      tipoError: error,  // Tipo de error: 'cedula_no_registrada', 'timeout', etc.
      detalles,          // Información adicional del error
      fechaError: new Date(),
      timestamp: Date.now()
    }
    
    return await DatabaseOperations.insertOne(Collections.ERROR_LOGS, errorLog)
  },

  async getErrorsByCedula(cedula) {
    const collection = getCollection(Collections.ERROR_LOGS)
    return await collection.find({ cedula }).sort({ fechaError: -1 }).toArray()
  },

  async getErrorsByServicio(servicio) {
    const collection = getCollection(Collections.ERROR_LOGS)
    return await collection.find({ servicio }).sort({ fechaError: -1 }).toArray()
  },

  async getErrorsByTipo(tipoError) {
    const collection = getCollection(Collections.ERROR_LOGS)
    return await collection.find({ tipoError }).sort({ fechaError: -1 }).toArray()
  },

  async getAllErrors(limit = 100) {
    const collection = getCollection(Collections.ERROR_LOGS)
    return await collection.find({}).sort({ fechaError: -1 }).limit(limit).toArray()
  },

  async getErrorStats() {
    const collection = getCollection(Collections.ERROR_LOGS)
    
    const totalErrors = await collection.countDocuments()
    const erroresPorServicio = await collection.aggregate([
      { $group: { _id: "$servicio", count: { $sum: 1 } } },
      { $sort: { count: -1 } }
    ]).toArray()
    
    const erroresPorTipo = await collection.aggregate([
      { $group: { _id: "$tipoError", count: { $sum: 1 } } },
      { $sort: { count: -1 } }
    ]).toArray()
    
    const erroresUltimos7Dias = await collection.countDocuments({
      fechaError: { $gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) }
    })
    
    return {
      totalErrors,
      erroresPorServicio,
      erroresPorTipo,
      erroresUltimos7Dias
    }
  },

  // Limpiar errores antiguos (más de X días)
  async cleanOldErrors(daysOld = 90) {
    const collection = getCollection(Collections.ERROR_LOGS)
    const cutoffDate = new Date()
    cutoffDate.setDate(cutoffDate.getDate() - daysOld)

    const result = await collection.deleteMany({
      fechaError: { $lt: cutoffDate }
    })

    console.log(`🧹 Eliminados ${result.deletedCount} logs de errores antiguos`)
    return result
  }
}

// Inicialización automática de la base de datos
export const initializeDatabase = async () => {
  try {
    await connectDB()
    await DatabaseOperations.createIndexes()
    console.log('🚀 Base de datos inicializada correctamente')
  } catch (error) {
    console.error('❌ Error inicializando base de datos:', error)
    throw error
  }
}

// Manejo de cierre graceful
process.on('SIGINT', async () => {
  console.log('\n🛑 Cerrando aplicación...')
  await closeDB()
  process.exit(0)
})

process.on('SIGTERM', async () => {
  console.log('\n🛑 Cerrando aplicación...')
  await closeDB()
  process.exit(0)
})