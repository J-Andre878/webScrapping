// Replicar la solicitud exacta de Playwright
async function replicarSolicitudPlaywright() {
  console.log('=== REPLICANDO SOLICITUD EXACTA DE PLAYWRIGHT ===');
  
  // Paso 1: Obtener la página inicial para obtener cookies y ViewState
  console.log('1. Obteniendo página inicial...');
  const response1 = await fetch('https://supa.funcionjudicial.gob.ec/pensiones/publico/consulta.jsf', {
    headers: {
      'User-Agent': 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/139.0.0.0 Safari/537.36',
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7'
    }
  });
  
  const html = await response1.text();
  const viewStateMatch = html.match(/name="javax\.faces\.ViewState".*?value="([^"]+)"/s);
  const viewState = viewStateMatch ? viewStateMatch[1] : null;
  
  // Extraer cookies incluyendo JSESSIONID
  const setCookieHeader = response1.headers.get('set-cookie') || '';
  console.log('Set-Cookie header:', setCookieHeader);
  
  // Extraer JSESSIONID si está en las cookies
  const jsessionidMatch = setCookieHeader.match(/JSESSIONID=([^;]+)/);
  const jsessionid = jsessionidMatch ? jsessionidMatch[1] : null;
  
  console.log('ViewState obtenido:', viewState ? 'OK' : 'ERROR');
  console.log('JSESSIONID obtenido:', jsessionid ? jsessionid : 'NO');
  
  if (!viewState) {
    console.log('❌ No se pudo obtener ViewState');
    return;
  }
  
  // Paso 2: Construir la URL con jsessionid si está disponible
  let postUrl = 'https://supa.funcionjudicial.gob.ec/pensiones/publico/consulta.jsf';
  if (jsessionid) {
    postUrl += `;jsessionid=${jsessionid}`;
  }
  
  console.log('2. URL para POST:', postUrl);
  
  // Paso 3: Preparar datos exactos como Playwright
  const postData = new URLSearchParams();
  postData.append('javax.faces.partial.ajax', 'true');
  postData.append('javax.faces.source', 'form:b_buscar_cedula');
  postData.append('javax.faces.partial.execute', '@all');
  postData.append('javax.faces.partial.render', 'form:pResultado panelMensajes form:pFiltro');
  postData.append('form:b_buscar_cedula', 'form:b_buscar_cedula');
  postData.append('form', 'form');
  postData.append('form:t_texto_cedula', '0706151594');
  postData.append('form:s_criterio_busqueda', 'Seleccione...');
  postData.append('form:t_texto', '');
  postData.append('javax.faces.ViewState', viewState);
  
  // Paso 4: Hacer la solicitud con headers exactos
  console.log('3. Enviando POST...');
  const response2 = await fetch(postUrl, {
    method: 'POST',
    headers: {
      'referer': 'https://supa.funcionjudicial.gob.ec/pensiones/publico/consulta.jsf',
      'faces-request': 'partial/ajax',
      'x-requested-with': 'XMLHttpRequest',
      'user-agent': 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/139.0.0.0 Safari/537.36',
      'accept': 'application/xml, text/xml, */*; q=0.01',
      'content-type': 'application/x-www-form-urlencoded; charset=UTF-8',
      'cookie': setCookieHeader.split(',').map(c => c.split(';')[0]).join('; ')
    },
    body: postData.toString()
  });
  
  console.log('Response status:', response2.status);
  const responseText = await response2.text();
  console.log('Response length:', responseText.length);
  
  // Paso 5: Analizar respuesta
  const cdataMatch = responseText.match(/<update id="form:pResultado"><!\[CDATA\[(.*?)\]\]><\/update>/s);
  
  if (cdataMatch) {
    const tableContent = cdataMatch[1];
    console.log('CDATA extraído, longitud:', tableContent.length);
    
    if (tableContent.includes('No se encuentra resultados.')) {
      console.log('❌ Aún dice "No se encuentra resultados."');
    } else {
      console.log('✅ ¡Ya no dice "No se encuentra resultados."!');
      
      // Buscar filas con data-ri
      const dataRiPattern = /<tr[^>]*data-ri="/g;
      const dataRiMatches = tableContent.match(dataRiPattern);
      console.log('Filas con data-ri encontradas:', dataRiMatches ? dataRiMatches.length : 0);
      
      if (dataRiMatches && dataRiMatches.length > 0) {
        console.log('🎉 ¡FUNCIONA! POST está retornando datos');
        console.log('Contenido de tabla (primeros 500 chars):');
        console.log(tableContent.substring(0, 500));
      }
    }
  } else {
    console.log('❌ No se encontró CDATA');
  }
}

replicarSolicitudPlaywright().catch(console.error);
