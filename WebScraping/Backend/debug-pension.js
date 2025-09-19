async function test() {
  const response1 = await fetch('https://supa.funcionjudicial.gob.ec/pensiones/publico/consulta.jsf');
  const html = await response1.text();
  
  const viewStateMatch = html.match(/name="javax\.faces\.ViewState".*?value="([^"]+)"/s);
  const viewState = viewStateMatch[1];
  const cookies = response1.headers.get('set-cookie') || '';
  
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
  
  const responseText = await response2.text();
  
  // Buscar específicamente el update de pResultado
  const pResultadoRegex = /<update id="form:pResultado"><!\[CDATA\[(.*?)\]\]><\/update>/s;
  const pResultadoMatch = responseText.match(pResultadoRegex);
  
  if (pResultadoMatch) {
    console.log('=== CONTENIDO TABLA RESULTADOS ===');
    const tableContent = pResultadoMatch[1];
    console.log(tableContent);
    
    // Verificar si hay mensaje de no resultados
    if (tableContent.includes('No se encuentra resultados.') || 
        tableContent.includes('ui-datatable-empty-message')) {
      console.log('❌ Contiene mensaje de no resultados');
    } else {
      console.log('✅ No contiene mensaje de no resultados');
    }
    
    // Buscar filas de datos
    const rowPattern = /<tr[^>]*data-ri="\d+"[^>]*>/g;
    const rowMatches = tableContent.match(rowPattern);
    console.log('Filas con data-ri encontradas:', rowMatches ? rowMatches.length : 0);
    
    // Buscar todas las filas
    const allRowPattern = /<tr[^>]*>/g;
    const allRowMatches = tableContent.match(allRowPattern);
    console.log('Total filas encontradas:', allRowMatches ? allRowMatches.length : 0);
    
    if (allRowMatches) {
      console.log('=== PRIMERA FILA ===');
      const firstRowFullMatch = tableContent.match(/<tr[^>]*>(.*?)<\/tr>/s);
      if (firstRowFullMatch) {
        console.log(firstRowFullMatch[0]);
      }
    }
    
  } else {
    console.log('❌ No se encontró el update de pResultado');
    console.log('Contenido completo:', responseText.substring(0, 2000));
  }
}

test().catch(console.error);
