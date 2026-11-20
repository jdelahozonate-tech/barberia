// Centro de reportes gerenciales con exportación a PDF y Excel.
export function crearModuloReportes(deps){
 const{$,sb,S,esc,dinero,toast}=deps;
 const nid=()=>S.perfil.negocio_id;
 const zona=()=>S.negocio?.zona_horaria||'America/Bogota';
 const admin=()=>['ADMINISTRADOR','SUPERVISOR'].includes(S.perfil.rol);
 const REPORTES=[
  ['VENTAS','Ventas'],['PAGOS','Recaudos y medios de pago'],['CARTERA','Cartera de clientes'],['CAJA','Caja y cierres'],['BARBEROS','Servicios y comisiones'],['INVENTARIO','Inventario y valorización'],['COMPRAS','Compras a proveedores'],['GASTOS','Gastos'],['LIQUIDACIONES','Liquidaciones de barberos'],['PEDIDOS','Pedidos a proveedores'],['CLIENTES','Clientes y consumo']
 ];
 let actual=null,barberos=[];
 function fechaZona(d=new Date()){
  const p=Object.fromEntries(new Intl.DateTimeFormat('en-US',{timeZone:zona(),year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(d).map(x=>[x.type,x.value]));
  return p.year+'-'+p.month+'-'+p.day;
 }
 function primerDiaMes(){return fechaZona().slice(0,8)+'01'}
 function sumarDia(s){const d=new Date(s+'T12:00:00Z');d.setUTCDate(d.getUTCDate()+1);return d.toISOString().slice(0,10)}
 function utcLocal(s,hora){
  const objetivo=Date.parse(s+'T'+hora+'Z');let ms=objetivo;
  for(let i=0;i<3;i++){
   const partes=Object.fromEntries(new Intl.DateTimeFormat('en-CA',{timeZone:zona(),year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',second:'2-digit',hourCycle:'h23'}).formatToParts(new Date(ms)).map(x=>[x.type,x.value]));
   const local=partes.year+'-'+partes.month+'-'+partes.day+'T'+partes.hour+':'+partes.minute+':'+partes.second+'Z';
   ms+=objetivo-Date.parse(local);
  }
  return new Date(ms).toISOString();
 }
 const fechaHora=x=>x?new Date(x).toLocaleString('es-CO',{timeZone:zona(),day:'2-digit',month:'short',year:'numeric',hour:'2-digit',minute:'2-digit'}):'—';
 const fechaCorta=x=>x?new Date(String(x).slice(0,10)+'T12:00:00Z').toLocaleDateString('es-CO',{timeZone:zona(),day:'2-digit',month:'short',year:'numeric'}):'—';
 async function todos(factory){
  let out=[],desde=0;
  while(true){
   const{data,error}=await factory().range(desde,desde+999);
   if(error)throw error;
   const page=data||[];out=out.concat(page);if(page.length<1000)break;desde+=1000;
  }
  return out;
 }
 function resumen(label,valor){return{label,valor}}
 function sumar(rows,key){return rows.reduce((s,x)=>s+Number(x[key]||0),0)}
 async function cargarBarberos(){
  const{data,error}=await sb.from('barberos').select('id,nombre').eq('negocio_id',nid()).eq('estado','ACTIVO').order('nombre');
  if(error)throw error;barberos=data||[];
 }
 async function consultar(tipo,desde,hasta,barberoId){
  const inicio=utcLocal(desde,'00:00:00'),fin=utcLocal(sumarDia(hasta),'00:00:00');
  let rows=[],summary=[],titulo=REPORTES.find(x=>x[0]===tipo)?.[1]||'Reporte';
  if(tipo==='VENTAS'||tipo==='CARTERA'||tipo==='CLIENTES'){
   let q=()=>sb.from('ventas').select('id,fecha_hora,estado_venta,total_bruto,descuento,total_venta,total_pagado,saldo_pendiente,cliente_id,barbero_id,clientes(nombre,telefono),barberos(nombre)').eq('negocio_id',nid()).gte('fecha_hora',inicio).lt('fecha_hora',fin).order('fecha_hora',{ascending:false});
   if(tipo==='CARTERA')q=()=>sb.from('ventas').select('id,fecha_hora,estado_venta,total_bruto,descuento,total_venta,total_pagado,saldo_pendiente,cliente_id,barbero_id,clientes(nombre,telefono),barberos(nombre)').eq('negocio_id',nid()).eq('estado_venta','PENDIENTE').gt('saldo_pendiente',0).gte('fecha_hora',inicio).lt('fecha_hora',fin).order('fecha_hora',{ascending:false});
   let data=await todos(q);if(barberoId)data=data.filter(x=>x.barbero_id===barberoId);
   if(tipo==='CLIENTES'){
    const g={};data.filter(x=>x.estado_venta!=='ANULADA').forEach(x=>{const id=x.cliente_id||'SIN_CLIENTE';g[id]=g[id]||{cliente:x.clientes?.nombre||'Cliente de paso',telefono:x.clientes?.telefono||'',compras:0,total:0,pagado:0,saldo:0};g[id].compras++;g[id].total+=Number(x.total_venta||0);g[id].pagado+=Number(x.total_pagado||0);g[id].saldo+=Number(x.saldo_pendiente||0)});
    rows=Object.values(g).sort((a,b)=>b.total-a.total).map(x=>({'Cliente':x.cliente,'Teléfono':x.telefono,'Compras':x.compras,'Total comprado':x.total,'Pagado':x.pagado,'Saldo pendiente':x.saldo}));
    summary=[resumen('Clientes con compras',rows.length),resumen('Consumo total',sumar(rows,'Total comprado')),resumen('Saldo pendiente',sumar(rows,'Saldo pendiente'))];
   }else{
    rows=data.map(x=>({'Fecha':fechaHora(x.fecha_hora),'Comprobante':String(x.id).slice(0,8).toUpperCase(),'Cliente':x.clientes?.nombre||'Cliente de paso','Barbero':x.barberos?.nombre||'—','Estado':x.estado_venta,'Subtotal':Number(x.total_bruto||0),'Descuento':Number(x.descuento||0),'Total':Number(x.total_venta||0),'Pagado':Number(x.total_pagado||0),'Saldo':Number(x.saldo_pendiente||0)}));
    const activas=data.filter(x=>x.estado_venta!=='ANULADA');
    summary=[resumen('Ventas activas',activas.length),resumen('Total vendido',sumar(activas,'total_venta')),resumen('Recaudado',sumar(activas,'total_pagado')),resumen('Cartera',sumar(activas,'saldo_pendiente'))];
    if(tipo==='CARTERA'){titulo='Cartera de clientes';summary=[resumen('Clientes con saldo',new Set(data.map(x=>x.cliente_id).filter(Boolean)).size),resumen('Ventas pendientes',data.length),resumen('Saldo por cobrar',sumar(data,'saldo_pendiente'))]}
   }
  }else if(tipo==='PAGOS'){
   let data=await todos(()=>sb.from('pagos').select('id,fecha_hora,valor_pago,metodo_pago,estado_pago,venta_id,ventas(id,estado_venta,barbero_id,clientes(nombre),barberos(nombre))').eq('negocio_id',nid()).gte('fecha_hora',inicio).lt('fecha_hora',fin).order('fecha_hora',{ascending:false}));
   if(barberoId)data=data.filter(x=>x.ventas?.barbero_id===barberoId);
   rows=data.map(x=>({'Fecha':fechaHora(x.fecha_hora),'Venta':String(x.venta_id||'').slice(0,8).toUpperCase(),'Cliente':x.ventas?.clientes?.nombre||'Cliente de paso','Barbero':x.ventas?.barberos?.nombre||'—','Método':x.metodo_pago,'Estado venta':x.ventas?.estado_venta||'—','Valor recibido':Number(x.valor_pago||0)}));
   summary=[resumen('Movimientos de pago',rows.length),resumen('Total recaudado',sumar(rows,'Valor recibido'))];
  }else if(tipo==='CAJA'){
   const [a,c]=await Promise.all([
    todos(()=>sb.from('cajas').select('*').eq('negocio_id',nid()).gte('fecha_apertura',inicio).lt('fecha_apertura',fin).order('fecha_apertura',{ascending:false})),
    todos(()=>sb.from('cajas').select('*').eq('negocio_id',nid()).gte('fecha_cierre',inicio).lt('fecha_cierre',fin).order('fecha_cierre',{ascending:false}))
   ]);
   const map=new Map();[...a,...c].forEach(x=>map.set(x.id,x));const data=[...map.values()];
   rows=data.map(x=>({'Apertura':fechaHora(x.fecha_apertura),'Cierre':fechaHora(x.fecha_cierre),'Estado':x.estado_caja,'Saldo inicial':Number(x.saldo_inicial||0),'Efectivo esperado':Number(x.efectivo_esperado||0),'Efectivo contado':Number(x.efectivo_contado||0),'Diferencia':Number(x.diferencia||0),'Observaciones':x.observaciones||''}));
   summary=[resumen('Turnos consultados',rows.length),resumen('Efectivo esperado',sumar(rows,'Efectivo esperado')),resumen('Efectivo contado',sumar(rows,'Efectivo contado')),resumen('Diferencia acumulada',sumar(rows,'Diferencia'))];
  }else if(tipo==='BARBEROS'){
   let data=await todos(()=>sb.from('detalle_ventas').select('id,descripcion,cantidad,subtotal,comision_generada,tipo_item,ventas!inner(id,fecha_hora,barbero_id,estado_venta,barberos(nombre))').eq('negocio_id',nid()).eq('tipo_item','SERVICIO').eq('ventas.estado_venta','PAGADA').gte('ventas.fecha_hora',inicio).lt('ventas.fecha_hora',fin).order('id'));
   if(barberoId)data=data.filter(x=>x.ventas?.barbero_id===barberoId);
   rows=data.map(x=>({'Fecha de pago':fechaHora(x.ventas?.fecha_hora),'Barbero':x.ventas?.barberos?.nombre||'—','Servicio':x.descripcion||'Servicio','Cantidad':Number(x.cantidad||0),'Valor servicio':Number(x.subtotal||0),'Comisión generada':Number(x.comision_generada||0),'Venta':String(x.ventas?.id||'').slice(0,8).toUpperCase()}));
   summary=[resumen('Servicios pagados',rows.reduce((s,x)=>s+x.Cantidad,0)),resumen('Valor de servicios',sumar(rows,'Valor servicio')),resumen('Comisiones generadas',sumar(rows,'Comisión generada'))];
  }else if(tipo==='INVENTARIO'){
   const [ps,st]=await Promise.all([
    todos(()=>sb.from('productos').select('id,nombre,categoria,tipo_inventario,unidad_medida,costo_unitario,precio_venta,valor_actual,estado,control_stock').eq('negocio_id',nid()).order('nombre')),
    todos(()=>sb.from('stock_actual').select('producto_id,existencias,stock_minimo').eq('negocio_id',nid()))
   ]);
   const map=new Map(st.map(x=>[x.producto_id,x]));
   rows=ps.map(p=>{const s=map.get(p.id),qty=Number(s?.existencias||0),cost=Number(p.costo_unitario||0),unit=p.tipo_inventario==='EQUIPO'?Number(p.valor_actual||cost):cost;return{'Artículo':p.nombre,'Tipo':p.tipo_inventario,'Estado':p.estado,'Existencias':qty,'Unidad':p.unidad_medida||'unidad','Costo unitario':cost,'Valor inventario':qty*unit,'Precio venta':Number(p.precio_venta||0),'Utilidad por unidad':Number(p.precio_venta||0)-cost}});
   summary=[resumen('Artículos',rows.length),resumen('Valor inventariado',sumar(rows,'Valor inventario')),resumen('Unidades registradas',sumar(rows,'Existencias'))];
   titulo='Inventario y valorización (corte actual)';
  }else if(tipo==='COMPRAS'){
   const data=await todos(()=>sb.from('compras_inventario').select('id,fecha_compra,fecha_vencimiento,numero_factura,total_compra,total_pagado,saldo_pendiente,estado_compra,referencia,proveedores_inventario(nombre)').eq('negocio_id',nid()).gte('fecha_compra',desde).lte('fecha_compra',hasta).order('fecha_compra',{ascending:false}));
   rows=data.map(x=>({'Fecha':fechaCorta(x.fecha_compra),'Proveedor':x.proveedores_inventario?.nombre||'—','Factura':x.numero_factura||x.referencia||String(x.id).slice(0,8),'Estado':x.estado_compra,'Total compra':Number(x.total_compra||0),'Pagado':Number(x.total_pagado||0),'Saldo proveedor':Number(x.saldo_pendiente||0),'Vence':fechaCorta(x.fecha_vencimiento)}));
   summary=[resumen('Compras',rows.length),resumen('Total comprado',sumar(rows,'Total compra')),resumen('Pagado',sumar(rows,'Pagado')),resumen('Saldo proveedores',sumar(rows,'Saldo proveedor'))];
  }else if(tipo==='LIQUIDACIONES'){
   let data=await todos(()=>sb.from('liquidaciones_barbero').select('id,barbero_id,fecha_liquidacion,total_comisiones,total_descuentos,total_anticipos,total_neto,total_pagado,saldo_pendiente,estado_liquidacion,barberos(nombre)').eq('negocio_id',nid()).gte('fecha_liquidacion',desde).lte('fecha_liquidacion',hasta).order('fecha_liquidacion',{ascending:false}));
   if(barberoId)data=data.filter(x=>x.barbero_id===barberoId);
   rows=data.map(x=>({'Fecha':fechaCorta(x.fecha_liquidacion),'Barbero':x.barberos?.nombre||'—','Comisiones':Number(x.total_comisiones||0),'Descuentos':Number(x.total_descuentos||0),'Anticipos aplicados':Number(x.total_anticipos||0),'Neto':Number(x.total_neto||0),'Pagado':Number(x.total_pagado||0),'Saldo pendiente':Number(x.saldo_pendiente||0),'Estado':x.estado_liquidacion}));
   summary=[resumen('Liquidaciones',rows.length),resumen('Comisiones',sumar(rows,'Comisiones')),resumen('Total pagado',sumar(rows,'Pagado')),resumen('Saldo por pagar',sumar(rows,'Saldo pendiente'))];
  }else if(tipo==='PEDIDOS'){
   const data=await todos(()=>sb.from('pedidos_proveedores').select('id,fecha_pedido,estado,compra_id,proveedores_inventario(nombre),detalle_pedidos_proveedores(nombre_producto,cantidad,costo_estimado)').eq('negocio_id',nid()).gte('fecha_pedido',desde).lte('fecha_pedido',hasta).order('fecha_pedido',{ascending:false}));
   rows=data.map(x=>{const items=x.detalle_pedidos_proveedores||[];return{'Fecha':fechaCorta(x.fecha_pedido),'Pedido':String(x.id).slice(0,8).toUpperCase(),'Proveedor':x.proveedores_inventario?.nombre||'—','Productos':items.length,'Total estimado':items.reduce((n,d)=>n+Number(d.cantidad||0)*Number(d.costo_estimado||0),0),'Estado':x.estado,'Compra vinculada':x.compra_id?String(x.compra_id).slice(0,8).toUpperCase():'—'}});
   summary=[resumen('Pedidos',rows.length),resumen('Valor estimado',sumar(rows,'Total estimado')),resumen('Enviados',rows.filter(x=>x.Estado==='ENVIADO').length),resumen('Recibidos',rows.filter(x=>x.Estado==='RECIBIDO').length)];
  }else if(tipo==='GASTOS'){
   const data=await todos(()=>sb.from('gastos').select('fecha_hora,categoria_gasto,descripcion,valor,metodo_pago,proveedor,estado_gasto').eq('negocio_id',nid()).gte('fecha_hora',inicio).lt('fecha_hora',fin).order('fecha_hora',{ascending:false}));
   rows=data.map(x=>({'Fecha':fechaHora(x.fecha_hora),'Categoría':x.categoria_gasto,'Descripción':x.descripcion||'—','Proveedor':x.proveedor||'—','Método':x.metodo_pago,'Estado':x.estado_gasto,'Valor':Number(x.valor||0)}));
   summary=[resumen('Gastos registrados',rows.length),resumen('Total de gastos',sumar(data,'valor'))];
  }
  return{tipo,titulo,desde,hasta,rows,summary,barberoId};
 }
 function tabla(rows){
  if(!rows.length)return'<div class="reports-empty"><strong>Sin resultados</strong><p>No se encontraron registros para los filtros seleccionados.</p></div>';
  const keys=Object.keys(rows[0]);
  return'<div class="reports-table-wrap"><table class="reports-table"><thead><tr>'+keys.map(k=>'<th>'+esc(k)+'</th>').join('')+'</tr></thead><tbody>'+rows.slice(0,500).map(r=>'<tr>'+keys.map(k=>'<td>'+esc(typeof r[k]==='number'&&/Total|Pagado|Saldo|Valor|Comisión|Diferencia|Costo|Precio|Efectivo|Descuento|Subtotal|Inventario/i.test(k)?dinero(r[k]):String(r[k]??'—'))+'</td>').join('')+'</tr>').join('')+'</tbody></table></div>'+(rows.length>500?'<p class="reports-note">La vista muestra 500 filas. Las exportaciones incluyen todos los resultados.</p>':'');
 }
 async function reportesVista(){
  if(!admin()){$('#main').innerHTML='<section class="reports-shell"><div class="reports-empty"><strong>Acceso restringido</strong><p>Los reportes gerenciales están disponibles para administración y supervisión.</p></div></section>';return}
  try{await cargarBarberos()}catch(e){return toast(e.message,true)}
  const opciones=REPORTES.map(x=>'<option value="'+x[0]+'">'+x[1]+'</option>').join('');
  $('#main').innerHTML='<section class="reports-shell"><header class="reports-header"><div><span class="reports-eyebrow">ANÁLISIS Y CONTROL DEL NEGOCIO</span><h2>Centro de reportes</h2><p>Consulta resultados por período y exporta informes listos para compartir o archivar.</p></div><span class="reports-badge">PDF · Excel</span></header>'+
   '<section class="reports-filter-panel"><div class="reports-filter-grid"><label>Tipo de informe<select id="report-type">'+opciones+'</select></label><label>Desde<input id="report-from" type="date" value="'+primerDiaMes()+'"></label><label>Hasta<input id="report-to" type="date" value="'+fechaZona()+'"></label><label>Barbero<select id="report-barber"><option value="">Todos los barberos</option>'+barberos.map(b=>'<option value="'+b.id+'">'+esc(b.nombre)+'</option>').join('')+'</select></label><button class="btn" id="report-run">Generar informe</button></div></section>'+
   '<section id="report-result" class="reports-result"><div class="reports-empty"><strong>Prepara tu primer informe</strong><p>Selecciona el tipo de información y el período que deseas consultar.</p></div></section></section>';
  $('#report-run').onclick=generar;
  $('#report-type').onchange=()=>{actual=null;$('#report-result').innerHTML='<div class="reports-empty"><strong>Informe listo para consultar</strong><p>Presiona Generar informe para actualizar los resultados.</p></div>'};
 }
 async function generar(){
  const b=$('#report-run'),tipo=$('#report-type').value,desde=$('#report-from').value,hasta=$('#report-to').value,barberoId=$('#report-barber').value||null;
  if(!desde||!hasta||desde>hasta)return toast('Selecciona un rango de fechas válido.',true);
  b.disabled=true;b.textContent='Consultando…';
  try{
   actual=await consultar(tipo,desde,hasta,barberoId);
   const total=actual.rows.length,html='<div class="reports-result-head"><div><span class="reports-eyebrow">RESULTADO DEL PERÍODO</span><h3>'+esc(actual.titulo)+'</h3><p>'+fechaCorta(desde)+' al '+fechaCorta(hasta)+(barberoId?' · '+esc(barberos.find(x=>x.id===barberoId)?.nombre||'Barbero'):'')+'</p></div><div class="reports-export"><button type="button" class="btn sec" id="report-pdf" '+(total?'':'disabled')+'>Exportar PDF</button><button type="button" class="btn" id="report-xlsx" '+(total?'':'disabled')+'>Exportar Excel</button></div></div>'+
    '<div class="reports-summary">'+actual.summary.map(x=>'<article><small>'+esc(x.label)+'</small><strong>'+ (typeof x.valor==='number'&&/Total|Recaudado|Cartera|Saldo|Valor|Comisión|Efectivo|Diferencia|Consumo|Pagado|comprado|inventariado/i.test(x.label)?dinero(x.valor):esc(String(x.valor)))+'</strong></article>').join('')+'</div>'+
    '<div class="reports-table-head"><strong>Detalle del informe</strong><span>'+total+' registro(s)</span></div>'+tabla(actual.rows);
   $('#report-result').innerHTML=html;
   const pdf=$('#report-pdf'),xlsx=$('#report-xlsx');if(pdf)pdf.onclick=exportarPDF;if(xlsx)xlsx.onclick=exportarExcel;
  }catch(e){actual=null;$('#report-result').innerHTML='<div class="reports-empty"><strong>No se pudo generar el informe</strong><p>'+esc(e.message||'Error inesperado')+'</p></div>';toast('No fue posible consultar el informe: '+(e.message||''),true)}
  finally{b.disabled=false;b.textContent='Generar informe'}
 }
 function nombreArchivo(){return'Informe-'+(actual?.tipo||'Barberia')+'-'+actual?.desde+'-'+actual?.hasta}
 async function cargarScript(url,global){
  if(window[global])return window[global];
  await new Promise((resolve,reject)=>{
   const script=document.createElement('script');script.src=url;script.async=true;script.onload=resolve;script.onerror=()=>reject(new Error('No se pudo cargar el exportador. Verifica tu conexión.'));document.head.appendChild(script);
  });
  if(!window[global])throw new Error('La biblioteca de exportación no está disponible.');
  return window[global];
 }
 async function exportarExcel(){
  if(!actual?.rows?.length)return;
  try{
   const XLSX=await cargarScript('https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js','XLSX');
   const wb=XLSX.utils.book_new();
   const resumen=[['INFORME',actual.titulo],['NEGOCIO',S.negocio?.nombre||'Barbería'],['PERÍODO',actual.desde+' al '+actual.hasta],['GENERADO',new Date().toLocaleString('es-CO',{timeZone:zona()})],[],['INDICADOR','VALOR'],...actual.summary.map(x=>[x.label,x.valor])];
   XLSX.utils.book_append_sheet(wb,XLSX.utils.aoa_to_sheet(resumen),'Resumen');
   XLSX.utils.book_append_sheet(wb,XLSX.utils.json_to_sheet(actual.rows),'Detalle');
   XLSX.writeFile(wb,nombreArchivo()+'.xlsx',{bookType:'xlsx',compression:true});
  }catch(e){toast(e.message||'No se pudo exportar Excel.',true)}
 }
 async function exportarPDF(){
  if(!actual?.rows?.length)return;
  try{
   const jsPDF=await cargarScript('https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.2/jspdf.umd.min.js','jspdf');
   const PDF=jsPDF.jsPDF,doc=new PDF({orientation:'landscape',unit:'mm',format:'a4'});
   const W=doc.internal.pageSize.getWidth(),H=doc.internal.pageSize.getHeight(),m=12;
   doc.setFillColor(23,47,77);doc.rect(0,0,W,34,'F');
   doc.setTextColor(255,255,255);doc.setFont('helvetica','bold');doc.setFontSize(16);doc.text(String(S.negocio?.nombre||'Barbería'),m,13);
   doc.setFontSize(11);doc.text(actual.titulo,m,22);
   doc.setFont('helvetica','normal');doc.setFontSize(8);doc.text('Período: '+actual.desde+' al '+actual.hasta,W-m,22,{align:'right'});
   let y=44;doc.setTextColor(38,52,70);
   actual.summary.forEach((x,i)=>{const w=(W-m*2)/Math.min(actual.summary.length,4),col=i%4,row=Math.floor(i/4),xx=m+col*w,yy=y+row*15;doc.setFontSize(7);doc.setFont('helvetica','normal');doc.text(String(x.label),xx,yy);doc.setFontSize(10);doc.setFont('helvetica','bold');doc.text(String(x.valor),xx,yy+6)});
   y+=Math.ceil(actual.summary.length/4)*17+4;
   const keys=Object.keys(actual.rows[0]),cw=(W-m*2)/keys.length,headerH=8;
   const header=()=>{doc.setFillColor(232,238,246);doc.rect(m,y,W-m*2,headerH,'F');doc.setFont('helvetica','bold');doc.setFontSize(6.5);doc.setTextColor(40,58,78);keys.forEach((k,i)=>doc.text(doc.splitTextToSize(k,cw-2)[0]||'',m+i*cw+1,y+5));y+=headerH+2};
   header();doc.setFont('helvetica','normal');doc.setFontSize(6.2);doc.setTextColor(45,53,63);
   for(const row of actual.rows){
    const vals=keys.map(k=>{const v=row[k];return typeof v==='number'&&/Total|Pagado|Saldo|Valor|Comisión|Diferencia|Costo|Precio|Efectivo|Descuento|Subtotal|Inventario/i.test(k)?dinero(v):String(v??'—')});
    const wrap=vals.map((v,i)=>doc.splitTextToSize(v,cw-2).slice(0,3)),height=Math.max(5,...wrap.map(x=>x.length*3.2))+2;
    if(y+height>H-12){doc.addPage();y=14;header();doc.setFont('helvetica','normal');doc.setFontSize(6.2);doc.setTextColor(45,53,63)}
    wrap.forEach((lines,i)=>doc.text(lines,m+i*cw+1,y+3));
    y+=height;doc.setDrawColor(230,234,240);doc.line(m,y,W-m,y);
   }
   doc.save(nombreArchivo()+'.pdf');
  }catch(e){toast(e.message||'No se pudo exportar PDF.',true)}
 }
 return{reportes:reportesVista};
}
