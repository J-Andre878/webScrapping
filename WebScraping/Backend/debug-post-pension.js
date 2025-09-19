// Debug específico para el POST de pensión alimenticia
async function debugPost() {
  console.log('=== DEBUGGING POST PENSION ALIMENTICIA ===');
  
  // Paso 1: Obtener ViewState
  console.log('1. Obteniendo ViewState...');
  const response1 = await fetch('https://supa.funcionjudicial.gob.ec/pensiones/publico/consulta.jsf');
  const html = await response1.text();
  
  const viewStateMatch = html.match(/name="javax\.faces\.ViewState".*?value="([^"]+)"/s);
  const viewState = viewStateMatch ? viewStateMatch[1] : null;
  const cookies = response1.headers.get('set-cookie') || '';
  
  console.log('ViewState obtenido:', viewState ? 'OK' : 'ERROR');
  console.log('Cookies obtenidas:', cookies ? 'OK' : 'ERROR');
  
  if (!viewState) {
    console.log('❌ No se pudo obtener ViewState');
    return;
  }
  
  // Paso 2: Hacer POST request
  console.log('2. Enviando POST request...');
  const formData = new URLSearchParams();
  formData.append('javax.faces.partial.ajax', 'true');
  formData.append('javax.faces.source', 'form:b_buscar_cedula');
  formData.append('javax.faces.partial.execute', '@all');
  formData.append('javax.faces.partial.render', 'form:pResultado panelMensajes form:pFiltro');
  formData.append('form:b_buscar_cedula', 'form:b_buscar_cedula');
  formData.append('form', 'form');
  formData.append('form:t_texto_cedula', '0706151594');
  formData.append('form:s_criterio_busqueda', 'Seleccione...');
  formData.append('form:t_texto', '');
  formData.append('javax.faces.ViewState', viewState);
  
  const response2 = await fetch('https://supa.funcionjudicial.gob.ec/pensiones/publico/consulta.jsf', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      'Accept': 'application/xml, text/xml, */*; q=0.01',
      'X-Requested-With': 'XMLHttpRequest',
      'Faces-Request': 'partial/ajax',
      'Origin': 'https://supa.funcionjudicial.gob.ec',
      'Referer': 'https://supa.funcionjudicial.gob.ec/pensiones/publico/consulta.jsf',
      'Cookie': cookies
    },
    body: formData.toString()
  });
  
  console.log('Response status:', response2.status);
  const responseText = await response2.text();
  console.log('Response length:', responseText.length);
  
  // Paso 3: Extraer CDATA
  console.log('3. Analizando respuesta...');
  const cdataRegex = /<update id="form:pResultado"><!\[CDATA\[(.*?)\]\]><\/update>/s;
  const cdataMatch = responseText.match(cdataRegex);
  
  if (!cdataMatch) {
    console.log('❌ No se encontró CDATA pResultado');
    console.log('Respuesta completa:', responseText.substring(0, 2000));
    return;
  }
  
  const tableContent = cdataMatch[1];
  console.log('✅ CDATA extraído, longitud:', tableContent.length);
  
  // Paso 4: Verificar contenido
  console.log('4. Analizando contenido de tabla...');
  
  if (tableContent.includes('No se encuentra resultados.')) {
    console.log('❌ Contiene mensaje "No se encuentra resultados."');
  } else {
    console.log('✅ NO contiene mensaje de no resultados');
  }
  
  // Paso 5: Buscar tabla específica
  console.log('5. Buscando tabla con datos...');
  
  // Buscar tbody con datos
  const tbodyPattern = /<tbody[^>]*id="[^"]*_data"[^>]*>(.*?)<\/tbody>/s;
  const tbodyMatch = tableContent.match(tbodyPattern);
  
  if (!tbodyMatch) {
    console.log('❌ No se encontró tbody con id *_data');
    // Buscar cualquier tbody
    const anyTbodyPattern = /<tbody[^>]*>(.*?)<\/tbody>/s;
    const anyTbodyMatch = tableContent.match(anyTbodyPattern);
    if (anyTbodyMatch) {
      console.log('Contenido del primer tbody encontrado:');
      console.log(anyTbodyMatch[1].substring(0, 1000));
    }
  } else {
    console.log('✅ Tbody con datos encontrado');
    const tbody = tbodyMatch[1];
    
    // Buscar filas con data-ri
    const dataRiPattern = /<tr[^>]*data-ri="/g;
    const dataRiMatches = tbody.match(dataRiPattern);
    console.log('Filas con data-ri:', dataRiMatches ? dataRiMatches.length : 0);
    
    // Buscar todas las filas
    const allTrPattern = /<tr[^>]*>/g;
    const allTrMatches = tbody.match(allTrPattern);
    console.log('Total filas tr:', allTrMatches ? allTrMatches.length : 0);
    
    if (allTrMatches && allTrMatches.length > 0) {
      console.log('=== CONTENIDO TBODY COMPLETO ===');
      console.log(tbody);
    }
  }
}

debugPost().catch(console.error);
