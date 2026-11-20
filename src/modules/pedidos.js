// Módulo de pedidos de compra realizados por la barbería a sus proveedores.
export function crearModuloPedidos(deps) {
 const { $, dlg, sb, S, esc, dinero, toast } = deps;
 const METODOS=['EFECTIVO','TRANSFERENCIA','TARJETA','NEQUI','DAVIPLATA'];
 const admin=()=>['ADMINISTRADOR','SUPERVISOR'].includes(S.perfil.rol);
 const nid=()=>S.perfil.negocio_id;
 const zona=()=>S.negocio?.zona_horaria||'America/Bogota';
 const hoy=()=>{
  const p=Object.fromEntries(new Intl.DateTimeFormat('en-US',{timeZone:zona(),year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(new Date()).map(x=>[x.type,x.value]));
  return p.year+'-'+p.month+'-'+p.day;
 };
 const fecha=x=>x?new Date(String(x).slice(0,10)+'T12:00:00').toLocaleDateString('es-CO',{day:'numeric',month:'short',year:'numeric'}):'—';
 const estadoTexto=e=>({BORRADOR:'Borrador',ENVIADO:'Enviado al proveedor',RECIBIDO:'Recibido',CANCELADO:'Cancelado'}[e]||e);
 let pedidos=[],productos=[],proveedores=[];
 async function cargar(){
  const [rp,rr,rv]=await Promise.all([
   sb.from('pedidos_proveedores').select('*,proveedores_inventario(nombre,telefono),detalle_pedidos_proveedores(id,producto_id,nombre_producto,cantidad,costo_estimado,cantidad_recibida,costo_unitario_real)').eq('negocio_id',nid()).order('creado_en',{ascending:false}).limit(500),
   sb.from('productos').select('id,nombre,costo_unitario,unidad_medida,estado,tipo_inventario').eq('negocio_id',nid()).eq('estado','ACTIVO').order('nombre'),
   sb.from('proveedores_inventario').select('id,nombre,telefono,estado').eq('negocio_id',nid()).eq('estado','ACTIVO').order('nombre')
  ]);
  const error=[rp,rr,rv].find(x=>x.error);if(error){toast(error.error.message,true);return false}
  pedidos=rp.data||[];productos=rr.data||[];proveedores=rv.data||[];return true;
 }
 const total=p=>(p.detalle_pedidos_proveedores||[]).reduce((s,d)=>s+Number(d.cantidad||0)*Number(d.costo_estimado||0),0);
 async function pedidosVista(){
  if(!admin()){$('#main').innerHTML='<section class="supplier-orders-shell"><div class="supplier-orders-empty"><strong>Acceso restringido</strong><p>La gestión de pedidos a proveedores está disponible para administración y supervisión.</p></div></section>';return}
  $('#main').innerHTML='<section class="supplier-orders-shell"><div class="supplier-orders-loading">Cargando pedidos a proveedores…</div></section>';
  if(!await cargar())return;
  const borradores=pedidos.filter(p=>p.estado==='BORRADOR').length,enviados=pedidos.filter(p=>p.estado==='ENVIADO').length,recibidos=pedidos.filter(p=>p.estado==='RECIBIDO').length;
  const estimado=pedidos.filter(p=>!['RECIBIDO','CANCELADO'].includes(p.estado)).reduce((s,p)=>s+total(p),0);
  $('#main').innerHTML='<section class="supplier-orders-shell">'+
   '<header class="supplier-orders-header"><div><span class="supplier-orders-eyebrow">ABASTECIMIENTO DEL NEGOCIO</span><h2>Pedidos a proveedores</h2><p>Organiza las solicitudes de compra, comparte órdenes y registra la recepción en inventario.</p></div><button class="btn" id="supplier-new">＋ Crear pedido</button></header>'+
   '<section class="supplier-orders-kpis"><article><small>Pedidos registrados</small><strong>'+pedidos.length+'</strong><span>Historial del negocio</span></article><article><small>Por enviar</small><strong>'+borradores+'</strong><span>Borradores</span></article><article><small>Enviados</small><strong>'+enviados+'</strong><span>Pendientes de entrega</span></article><article class="supplier-orders-kpi-primary"><small>Valor estimado pendiente</small><strong>'+dinero(estimado)+'</strong><span>Sin incluir pedidos recibidos o cancelados</span></article></section>'+
   '<section class="supplier-orders-panel"><div class="supplier-orders-panel-head"><div><h3>Seguimiento de pedidos</h3><p>Consulta el proveedor, los productos, las cantidades y el estado de cada orden.</p></div><span>'+recibidos+' recibidos</span></div>'+
   '<div class="supplier-orders-filters"><input id="supplier-search" type="search" placeholder="Buscar proveedor, producto o número de pedido"><select id="supplier-status"><option value="TODOS">Todos los estados</option><option value="BORRADOR">Borradores</option><option value="ENVIADO">Enviados</option><option value="RECIBIDO">Recibidos</option><option value="CANCELADO">Cancelados</option></select><input id="supplier-date" type="date" aria-label="Filtrar por fecha"></div>'+
   '<div id="supplier-list"></div></section></section>';
  $('#supplier-new').onclick=()=>crearPedido();
  const pintar=()=>{
   const q=$('#supplier-search').value.trim().toLocaleLowerCase(),st=$('#supplier-status').value,day=$('#supplier-date').value;
   const lista=pedidos.filter(p=>(st==='TODOS'||p.estado===st)&&(!day||p.fecha_pedido===day)&&((p.proveedores_inventario?.nombre||'')+' '+(p.detalle_pedidos_proveedores||[]).map(d=>d.nombre_producto).join(' ')+' '+p.id).toLocaleLowerCase().includes(q));
   $('#supplier-list').innerHTML=lista.length?'<div class="supplier-orders-list">'+lista.map(p=>{
    const items=p.detalle_pedidos_proveedores||[],monto=total(p);
    return '<article class="supplier-order-card"><div class="supplier-order-top"><div><span class="supplier-orders-eyebrow">PEDIDO '+String(p.id).slice(0,8).toUpperCase()+'</span><h3>'+esc(p.proveedores_inventario?.nombre||'Proveedor')+'</h3><small>'+fecha(p.fecha_pedido)+' · '+items.length+' producto(s)</small></div><span class="supplier-order-status '+String(p.estado).toLowerCase()+'">'+estadoTexto(p.estado)+'</span></div><div class="supplier-order-preview">'+items.slice(0,3).map(d=>'<span>'+esc(d.nombre_producto)+' <b>× '+Number(d.cantidad)+'</b></span>').join('')+(items.length>3?'<small>+'+(items.length-3)+' productos más</small>':'')+'</div><div class="supplier-order-bottom"><div><small>Valor estimado</small><strong>'+dinero(monto)+'</strong></div><button class="btn sec" type="button" data-open="'+p.id+'">Ver pedido</button></div></article>';
   }).join('')+'</div>':'<div class="supplier-orders-empty"><strong>No hay pedidos para mostrar</strong><p>Prueba otro filtro o crea un pedido para comenzar a organizar las compras a tus proveedores.</p><button type="button" class="btn" id="supplier-empty-new">Crear pedido</button></div>';
   document.querySelectorAll('[data-open]').forEach(b=>b.onclick=()=>verPedido(pedidos.find(p=>p.id===b.dataset.open)));
   const empty=$('#supplier-empty-new');if(empty)empty.onclick=()=>crearPedido();
  };
  $('#supplier-search').oninput=pintar;$('#supplier-status').onchange=pintar;$('#supplier-date').onchange=pintar;pintar();
 }
 function crearPedido(){
  if(!proveedores.length)return toast('Primero registra un proveedor activo en Inventario.',true);
  if(!productos.length)return toast('Primero registra artículos activos en Inventario.',true);
  const options=productos.map(p=>'<option value="'+p.id+'" data-costo="'+Number(p.costo_unitario||0)+'">'+esc(p.nombre)+' · '+esc(p.unidad_medida||'unidad')+'</option>').join('');
  const linea=()=>'<div class="supplier-order-line"><label>Artículo<select class="sp-product">'+options+'</select></label><label>Cantidad<input class="sp-qty" type="number" min="0.001" step="0.001" value="1" required></label><label>Costo unitario estimado<input class="sp-cost" type="number" min="0" step="0.01" value="'+Number(productos[0].costo_unitario||0)+'" required></label><button type="button" class="btn sec sp-remove" aria-label="Quitar producto">×</button><small class="sp-line-total"></small></div>';
  dlg.innerHTML='<form id="supplier-form" class="supplier-order-form"><header><span class="supplier-orders-eyebrow">NUEVA SOLICITUD DE COMPRA</span><h2>Crear pedido a proveedor</h2><p>Este pedido no modifica existencias. El inventario se actualiza cuando registres la recepción.</p></header><label>Proveedor<select id="sp-provider" required>'+proveedores.map(p=>'<option value="'+p.id+'">'+esc(p.nombre)+'</option>').join('')+'</select></label><label>Fecha del pedido<input id="sp-date" type="date" value="'+hoy()+'" max="'+hoy()+'" required></label><label>Productos solicitados</label><div id="sp-lines">'+linea()+'</div><button type="button" class="link" id="sp-add">＋ Agregar producto</button><div class="supplier-order-total"><span>Total estimado</span><strong id="sp-total">'+dinero(0)+'</strong></div><label>Observaciones para el proveedor<textarea id="sp-notes" rows="3" maxlength="1000" placeholder="Marcas, presentación, condiciones o fecha esperada de entrega"></textarea></label><div class="acts"><button type="button" class="btn sec" id="sp-cancel">Cancelar</button><button class="btn" id="sp-save">Guardar borrador</button></div></form>';
  dlg.showModal();$('#sp-cancel').onclick=()=>dlg.close();
  const rows=()=>[...document.querySelectorAll('.supplier-order-line')];
  const calc=()=>{let t=0;rows().forEach(r=>{const q=Number(r.querySelector('.sp-qty').value)||0,c=Number(r.querySelector('.sp-cost').value)||0,line=q*c;t+=line;r.querySelector('.sp-line-total').textContent='Subtotal estimado: '+dinero(line)});$('#sp-total').textContent=dinero(t);return t};
  $('#sp-lines').onchange=e=>{if(e.target.classList.contains('sp-product')){const p=productos.find(x=>x.id===e.target.value);e.target.closest('.supplier-order-line').querySelector('.sp-cost').value=Number(p?.costo_unitario||0)}calc()};
  $('#sp-lines').oninput=calc;
  $('#sp-lines').onclick=e=>{if(e.target.classList.contains('sp-remove')){if(rows().length===1)return toast('El pedido debe tener al menos un producto.',true);e.target.closest('.supplier-order-line').remove();calc()}};
  $('#sp-add').onclick=()=>{$('#sp-lines').insertAdjacentHTML('beforeend',line());calc()};calc();
  $('#supplier-form').onsubmit=async e=>{
   e.preventDefault();const b=$('#sp-save');if(b.disabled)return;
   const detalles=rows().map(r=>({producto_id:r.querySelector('.sp-product').value,cantidad:Number(r.querySelector('.sp-qty').value),costo_estimado:Number(r.querySelector('.sp-cost').value),producto:productos.find(p=>p.id===r.querySelector('.sp-product').value)}));
   if(detalles.some(x=>!x.producto_id||!Number.isFinite(x.cantidad)||x.cantidad<=0||!Number.isFinite(x.costo_estimado)||x.costo_estimado<0))return toast('Revisa los productos, cantidades y costos estimados.',true);
   const ids=new Set(detalles.map(x=>x.producto_id));if(ids.size!==detalles.length)return toast('No repitas el mismo producto. Ajusta su cantidad en una sola línea.',true);
   b.disabled=true;
   const{data:head,error:e1}=await sb.from('pedidos_proveedores').insert({negocio_id:nid(),proveedor_id:$('#sp-provider').value,fecha_pedido:$('#sp-date').value,estado:'BORRADOR',observaciones:$('#sp-notes').value.trim()||null,creado_por:S.perfil.id}).select('id').single();
   if(e1){b.disabled=false;return toast(e1.message,true)}
   const{error:e2}=await sb.from('detalle_pedidos_proveedores').insert(detalles.map(d=>({negocio_id:nid(),pedido_id:head.id,producto_id:d.producto_id,nombre_producto:d.producto.nombre,cantidad:d.cantidad,costo_estimado:d.costo_estimado})));
   if(e2){await sb.from('pedidos_proveedores').delete().eq('id',head.id).eq('negocio_id',nid());b.disabled=false;return toast('No se guardaron los productos del pedido: '+e2.message,true)}
   dlg.close();toast('Pedido guardado como borrador.');pedidosVista();
  };
 }
 async function verPedido(p){
  const items=p.detalle_pedidos_proveedores||[],monto=total(p);
  dlg.innerHTML='<div class="supplier-order-detail"><header><span class="supplier-orders-eyebrow">PEDIDO '+String(p.id).slice(0,8).toUpperCase()+'</span><h2>'+esc(p.proveedores_inventario?.nombre||'Proveedor')+'</h2><p>'+fecha(p.fecha_pedido)+' · '+estadoTexto(p.estado)+'</p></header><div class="supplier-order-meta"><span><small>Contacto</small><strong>'+esc(p.proveedores_inventario?.telefono||'No registrado')+'</strong></span><span><small>Valor estimado</small><strong>'+dinero(monto)+'</strong></span></div><div class="supplier-order-items">'+items.map(d=>'<div><span><strong>'+esc(d.nombre_producto)+'</strong><small>'+Number(d.cantidad)+' unidad(es) · '+dinero(d.costo_estimado)+' c/u</small></span><strong>'+dinero(Number(d.cantidad)*Number(d.costo_estimado))+'</strong></div>').join('')+'</div>'+(p.observaciones?'<p class="supplier-order-notes">'+esc(p.observaciones)+'</p>':'')+(p.compra_id?'<div class="supplier-order-received">Recepción registrada · Compra '+String(p.compra_id).slice(0,8).toUpperCase()+'</div>':'')+'<div class="supplier-order-detail-actions"><button type="button" class="btn sec" id="sp-pdf">Generar PDF</button>'+(p.estado==='BORRADOR'?'<button type="button" class="btn" id="sp-send">Marcar como enviado</button>':'')+(p.estado==='ENVIADO'||p.estado==='BORRADOR'?'<button type="button" class="btn" id="sp-receive">Registrar recepción</button><button type="button" class="btn sec" id="sp-cancel-order">Cancelar pedido</button>':'')+'<button type="button" class="btn sec" id="sp-close">Cerrar</button></div></div>';
  dlg.showModal();$('#sp-close').onclick=()=>dlg.close();
  $('#sp-pdf').onclick=()=>compartirPedido(p);
  const send=$('#sp-send');if(send)send.onclick=()=>actualizarEstado(p,'ENVIADO');
  const receive=$('#sp-receive');if(receive)receive.onclick=()=>recepcion(p);
  const cancel=$('#sp-cancel-order');if(cancel)cancel.onclick=async()=>{if(!confirm('¿Cancelar este pedido? No se modificarán las existencias.'))return;const{error}=await sb.from('pedidos_proveedores').update({estado:'CANCELADO',actualizado_en:new Date().toISOString()}).eq('id',p.id).eq('negocio_id',nid());if(error)return toast(error.message,true);dlg.close();toast('Pedido cancelado');pedidosVista()};
 }
 async function actualizarEstado(p,estado){
  const{error}=await sb.from('pedidos_proveedores').update({estado,actualizado_en:new Date().toISOString()}).eq('id',p.id).eq('negocio_id',nid());
  if(error)return toast(error.message,true);dlg.close();toast('Pedido marcado como '+estadoTexto(estado).toLowerCase());pedidosVista();
 }
 async function recepcion(p){
  const{data:caja,error}=await sb.from('cajas').select('id').eq('negocio_id',nid()).eq('estado_caja','ABIERTA').maybeSingle();
  if(error)return toast(error.message,true);if(!caja?.id)return toast('Abre la caja del turno actual para registrar la recepción.',true);
  const items=p.detalle_pedidos_proveedores||[];
  dlg.innerHTML='<form id="supplier-receive-form" class="supplier-order-form"><header><span class="supplier-orders-eyebrow">ENTRADA A INVENTARIO</span><h2>Recibir pedido</h2><p>Confirma cantidades y costos reales. Al guardar se creará una compra y se actualizarán las existencias.</p></header><div class="supplier-receive-lines">'+items.map(d=>'<div class="supplier-receive-line" data-detail="'+d.id+'" data-product="'+d.producto_id+'"><strong>'+esc(d.nombre_producto)+'</strong><label>Cantidad recibida<input class="sr-qty" type="number" min="0.001" step="0.001" value="'+Number(d.cantidad)+'" required></label><label>Costo unitario real<input class="sr-cost" type="number" min="0" step="0.01" value="'+Number(d.costo_estimado)+'" required></label></div>').join('')+'</div><label>Fecha de compra / recepción<input id="sr-date" type="date" value="'+hoy()+'" max="'+hoy()+'" required></label><label>Número de factura del proveedor<input id="sr-invoice" maxlength="100"></label><label>Fecha de vencimiento (si queda saldo)<input id="sr-due" type="date"></label><div class="supplier-order-total"><span>Total real de recepción</span><strong id="sr-total">'+dinero(0)+'</strong></div><label>Valor pagado ahora<input id="sr-paid" type="number" min="0" step="0.01" value="0" required></label><label>Método de pago<select id="sr-method">'+METODOS.map(m=>'<option>'+m+'</option>').join('')+'</select></label><label>Referencia de pago<input id="sr-ref" value="Pedido '+String(p.id).slice(0,8)+'"></label><label>Observaciones<textarea id="sr-notes" rows="2">'+esc(p.observaciones||'')+'</textarea></label><div class="acts"><button type="button" class="btn sec" id="sr-close">Cancelar</button><button class="btn" id="sr-save">Confirmar recepción e ingresar inventario</button></div></form>';
  $('#sr-close').onclick=()=>verPedido(p);
  const rows=()=>[...document.querySelectorAll('.supplier-receive-line')];
  const calc=()=>{let t=0;rows().forEach(r=>t+=(Number(r.querySelector('.sr-qty').value)||0)*(Number(r.querySelector('.sr-cost').value)||0));$('#sr-total').textContent=dinero(t);$('#sr-paid').max=t;return t};
  $('.supplier-receive-lines').oninput=calc;calc();
  $('#supplier-receive-form').onsubmit=async e=>{
   e.preventDefault();const b=$('#sr-save');if(b.disabled)return;
   const detalles=rows().map(r=>({detalle_id:r.dataset.detail,producto_id:r.dataset.product,cantidad:Number(r.querySelector('.sr-qty').value),costo_unitario:Number(r.querySelector('.sr-cost').value)}));
   const totalReal=calc(),pagado=Number($('#sr-paid').value);
   if(detalles.some(x=>!Number.isFinite(x.cantidad)||x.cantidad<=0||!Number.isFinite(x.costo_unitario)||x.costo_unitario<0)||!Number.isFinite(pagado)||pagado<0||pagado>totalReal)return toast('Revisa cantidades, costos y el valor pagado. El abono no puede superar el total.',true);
   if($('#sr-due').value&&$('#sr-due').value<$('#sr-date').value)return toast('El vencimiento no puede ser anterior a la fecha de compra.',true);
   b.disabled=true;
   const{data,error}=await sb.rpc('recibir_pedido_proveedor',{p_pedido_id:p.id,p_detalles:detalles,p_fecha_compra:$('#sr-date').value,p_valor_pagado:pagado,p_metodo_pago:$('#sr-method').value,p_caja_id:caja.id,p_numero_factura:$('#sr-invoice').value.trim()||null,p_fecha_vencimiento:$('#sr-due').value||null,p_referencia:$('#sr-ref').value.trim()||null,p_observaciones:$('#sr-notes').value.trim()||null});
   if(error){b.disabled=false;return toast(error.message,true)}
   dlg.close();toast('Recepción registrada. Se creó la compra y se actualizaron las existencias.');pedidosVista();
  };
 }
 function pdfTexto(texto){
  const limpiar=x=>String(x??'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^\x20-\x7E]/g,' ');
  const lineas=texto.split('\n').flatMap(x=>{const t=limpiar(x),out=[];for(let i=0;i<t.length;i+=88)out.push(t.slice(i,i+88));return out.length?out:['']}).slice(0,55);
  const escPdf=x=>x.replace(/\\/g,'\\\\').replace(/\(/g,'\\(').replace(/\)/g,'\\)');
  const stream='BT /F1 10 Tf 48 790 Td '+lineas.map((x,i)=>(i?'0 -14 Td ':'')+'('+escPdf(x)+') Tj').join(' ')+' ET';
  const objs=['<< /Type /Catalog /Pages 2 0 R >>','<< /Type /Pages /Kids [3 0 R] /Count 1 >>','<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>','<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>','<< /Length '+stream.length+' >>\nstream\n'+stream+'\nendstream'];
  let pdf='%PDF-1.4\n',offsets=[0];objs.forEach((o,i)=>{offsets.push(pdf.length);pdf+=(i+1)+' 0 obj\n'+o+'\nendobj\n'});const xref=pdf.length;pdf+='xref\n0 '+(objs.length+1)+'\n0000000000 65535 f \n';for(let i=1;i<offsets.length;i++)pdf+=String(offsets[i]).padStart(10,'0')+' 00000 n \n';pdf+='trailer\n<< /Size '+(objs.length+1)+' /Root 1 0 R >>\nstartxref\n'+xref+'\n%%EOF';return new Blob([pdf],{type:'application/pdf'});
 }
 async function compartirPedido(p){
  const proveedor=p.proveedores_inventario||{},items=p.detalle_pedidos_proveedores||[];
  const lines=[S.negocio?.nombre||'Barbería','PEDIDO A PROVEEDOR','Número: '+String(p.id).slice(0,8).toUpperCase(),'Fecha: '+fecha(p.fecha_pedido),'Proveedor: '+(proveedor.nombre||'Proveedor'),'Teléfono: '+(proveedor.telefono||'No registrado'),'','PRODUCTO | CANTIDAD | COSTO UNITARIO | SUBTOTAL'];
  items.forEach(d=>lines.push(d.nombre_producto+' | '+d.cantidad+' | '+dinero(d.costo_estimado)+' | '+dinero(Number(d.cantidad)*Number(d.costo_estimado))));
  lines.push('','TOTAL ESTIMADO: '+dinero(total(p)),'Estado: '+estadoTexto(p.estado));if(p.observaciones)lines.push('Observaciones: '+p.observaciones);lines.push('','Solicitud de compra. Las existencias se actualizan al registrar la recepción.');
  const blob=pdfTexto(lines.join('\n')),name='Pedido-proveedor-'+String(p.id).slice(0,8)+'.pdf',file=new File([blob],name,{type:'application/pdf'});
  const msg='Hola '+(proveedor.nombre||'')+', te enviamos el pedido de productos de '+(S.negocio?.nombre||'la barbería')+'. Gracias.';
  if(navigator.share&&navigator.canShare?.({files:[file]})){try{await navigator.share({files:[file],title:'Pedido a proveedor',text:msg});return}catch(e){if(e?.name==='AbortError')return}}
  const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(a.href),1500);
  const tel=String(proveedor.telefono||'').replace(/\D/g,'');if(tel.length>=7)window.open('https://wa.me/'+(tel.length===10?'57'+tel:tel)+'?text='+encodeURIComponent(msg),'_blank','noopener');
  toast('PDF descargado. Adjunta el archivo en WhatsApp para enviarlo al proveedor.');
 }
 return {pedidos:pedidosVista};
}
