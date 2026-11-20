// Gestión profesional del inventario patrimonial, comercial y operativo.
export function crearModuloProductos(deps) {
 const { $, dlg, sb, S, esc, dinero, traducir, toast } = deps;
 const rol=()=>['ADMINISTRADOR','SUPERVISOR'].includes(S.perfil.rol);
 const nid=()=>S.perfil.negocio_id;
 const metodos=['EFECTIVO','TRANSFERENCIA','TARJETA','NEQUI','DAVIPLATA'];
 let vista='productos',productos=[],proveedores=[],stock=[];
 const tipoNombre=t=>({PRODUCTO_VENTA:'Para la venta',INSUMO:'Materiales e insumos',EQUIPO:'Equipos y herramientas'}[t]||'Para la venta');
 const utilidad=p=>Number(p.precio_venta||0)-Number(p.costo_unitario||0);
 const margen=p=>Number(p.precio_venta)>0?utilidad(p)/Number(p.precio_venta)*100:0;
 const hoy=()=>{const d=new Date();return [d.getFullYear(),String(d.getMonth()+1).padStart(2,'0'),String(d.getDate()).padStart(2,'0')].join('-')};
 const fecha=x=>{if(!x)return '—';const d=typeof x==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(x)?new Date(x+'T12:00:00'):new Date(x);return d.toLocaleDateString('es-CO',{year:'numeric',month:'short',day:'numeric'})};
 const error=e=>toast(traducir(e?.message||String(e)),true);
 const cargarBase=async()=>{
  const rs=await Promise.all([
   sb.from('productos').select('*').eq('negocio_id',nid()).order('nombre'),
   sb.from('stock_actual').select('producto_id,existencias,stock_minimo').eq('negocio_id',nid()),
   sb.from('proveedores_inventario').select('*').eq('negocio_id',nid()).order('nombre')
  ]);
  const fallo=rs.find(x=>x.error);if(fallo){error(fallo.error);return false}
  productos=rs[0].data||[];stock=rs[1].data||[];proveedores=rs[2].data||[];return true;
 };
 const existencia=id=>Number(stock.find(x=>x.producto_id===id)?.existencias||0);
 const minimo=p=>Number(p.stock_minimo??stock.find(x=>x.producto_id===p.id)?.stock_minimo??0);
 const objetivo=p=>Number(p.stock_objetivo||0);
 const tabs=()=>'<div class="product-tabs"><button class="btn '+(vista==='productos'?'':'sec')+'" data-tab="productos">Inventario general</button><button class="btn '+(vista==='pedido_proveedor'?'':'sec')+'" data-tab="pedido_proveedor">Pedidos a proveedores</button><button class="btn '+(vista==='compras'?'':'sec')+'" data-tab="compras">Compras recibidas</button><button class="btn '+(vista==='proveedores'?'':'sec')+'" data-tab="proveedores">Proveedores</button><button class="btn '+(vista==='movimientos'?'':'sec')+'" data-tab="movimientos">Movimientos</button></div>';
 async function productosVista(){
  if(!await cargarBase())return;
  const activos=productos.filter(p=>p.estado==='ACTIVO'),agotados=productos.filter(p=>p.control_stock!==false&&existencia(p.id)<=0).length,bajos=productos.filter(p=>p.control_stock!==false&&existencia(p.id)>0&&existencia(p.id)<=minimo(p)).length;
  const valor=productos.reduce((a,p)=>a+existencia(p.id)*Number(p.costo_unitario||0),0),valorEquipos=productos.filter(p=>p.tipo_inventario==='EQUIPO').reduce((a,p)=>a+Number(p.valor_actual||p.costo_unitario||0)*Math.max(1,existencia(p.id)),0),ventas=productos.filter(p=>p.vendible!==false&&p.tipo_inventario!=='EQUIPO'),insumos=productos.filter(p=>p.tipo_inventario==='INSUMO'),equipos=productos.filter(p=>p.tipo_inventario==='EQUIPO');
  $('#main').innerHTML='<div class="head"><div><h2>Inventario</h2><small class="mute">Control de productos, insumos, equipos y patrimonio</small></div><button class="btn" id="np">+ Registrar artículo</button></div>'+tabs()+
   '<div class="kp"><div><small>Artículos activos</small><strong>'+activos.length+'</strong></div><div><small>Productos para vender</small><strong>'+ventas.length+'</strong></div><div><small>Materiales e insumos</small><strong>'+insumos.length+'</strong></div><div><small>Equipos y herramientas</small><strong>'+equipos.length+'</strong></div><div><small>Stock bajo</small><strong>'+bajos+'</strong></div><div><small>Valor de existencias</small><strong>'+dinero(valor)+'</strong></div><div><small>Valor estimado de equipos</small><strong>'+dinero(valorEquipos)+'</strong></div></div>'+
   '<div class="acts"><button class="btn" id="nc">Registrar compra</button><button class="btn sec" id="na">Ajustar inventario</button><button class="btn sec" id="nprov">Nuevo proveedor</button></div>'+
   '<div class="inventory-tools"><input id="buscarp" type="search" placeholder="Buscar artículo por nombre o categoría" aria-label="Buscar artículo"><select id="tipoFiltro" aria-label="Filtrar tipo"><option value="TODOS">Todos los tipos</option><option value="PRODUCTO_VENTA">Productos para la venta</option><option value="INSUMO">Materiales e insumos</option><option value="EQUIPO">Equipos y herramientas</option></select><label class="chk"><input type="checkbox" id="inactivos"> Mostrar inactivos</label></div><div id="listap"></div>';
  $('#np').onclick=()=>productoForm();$('#nc').onclick=()=>compraForm();$('#na').onclick=()=>ajusteForm();$('#nprov').onclick=()=>proveedorForm();
  document.querySelectorAll('[data-tab]').forEach(b=>b.onclick=()=>{vista=b.dataset.tab;render()});
  const pintar=()=>{const q=$('#buscarp').value.trim().toLocaleLowerCase(),inac=$('#inactivos').checked;
   const tipo=$('#tipoFiltro').value,lista=productos.filter(p=>(inac||p.estado==='ACTIVO')&&(tipo==='TODOS'||(p.tipo_inventario||'PRODUCTO_VENTA')===tipo)&&(p.nombre+' '+(p.categoria||'')+' '+tipoNombre(p.tipo_inventario)).toLocaleLowerCase().includes(q));
   $('#listap').innerHTML=lista.length?`<div class="product-grid">${lista.map(p=>`<button class="product-card" data-prod="${p.id}"><div class="product-card-image">${p.imagen_url?`<img loading="lazy" src="${esc(p.imagen_url)}" alt="${esc(p.nombre)}">`:'<span>Sin fotografía</span>'}</div><div class="product-card-body"><span class="product-category">${esc(tipoNombre(p.tipo_inventario))} · ${esc(p.categoria||'Sin categoría')}</span><strong>${esc(p.nombre)}</strong><span class="product-price">${p.vendible===false?'No vendible':dinero(p.precio_venta)}</span><small>Disponible: ${existencia(p.id)} ${esc(p.unidad_medida||'unidades')} · Costo unitario: ${dinero(p.costo_unitario)}</small><small>${p.vendible===false?'Uso interno':'Utilidad/unidad: '+dinero(utilidad(p))+' · Margen: '+margen(p).toFixed(1)+'%'}</small><span class="chip ${p.estado==='ACTIVO'?(p.control_stock!==false&&existencia(p.id)<=minimo(p)?'ojo':'bien'):''}">${p.estado==='ACTIVO'?(p.control_stock!==false&&existencia(p.id)<=minimo(p)?'Reponer':'Activo'):'Inactivo'}</span></div></button>`).join('')}</div>`:'<p class="empty">No hay productos para mostrar.</p>';
   document.querySelectorAll('[data-prod]').forEach(b=>b.onclick=()=>productoForm(productos.find(p=>p.id===b.dataset.prod)));
  };
  $('#buscarp').oninput=pintar;$('#tipoFiltro').onchange=pintar;$('#inactivos').onchange=pintar;pintar();
 }
 async function productoForm(p){
  dlg.innerHTML='<form id="pf"><h2>'+(p?'Editar artículo':'Nuevo artículo de inventario')+'</h2><label>Tipo de inventario</label><select name="tipo_inventario"><option value="PRODUCTO_VENTA" '+((p?.tipo_inventario||'PRODUCTO_VENTA')==='PRODUCTO_VENTA'?'selected':'')+'>Producto para la venta</option><option value="INSUMO" '+(p?.tipo_inventario==='INSUMO'?'selected':'')+'>Materiales e insumos</option><option value="EQUIPO" '+(p?.tipo_inventario==='EQUIPO'?'selected':'')+'>Equipos y herramientas</option></select><label>Nombre</label><input name="nombre" required maxlength="120" value="'+esc(p?.nombre||'')+'"><label>Categoría</label><input name="categoria" maxlength="80" value="'+esc(p?.categoria||'')+'"><label>Descripción</label><textarea name="descripcion" rows="2">'+esc(p?.descripcion||'')+'</textarea><label>Fotografía <span class="mute">(opcional)</span></label><div class="product-photo-preview">'+(p?.imagen_url?'<img src="'+esc(p.imagen_url)+'" alt="Foto actual de '+esc(p.nombre)+'">':'<span>Sin fotografía</span>')+'</div><input name="imagen" type="file" accept="image/jpeg,image/png,image/webp"><small class="mute">JPG, PNG o WEBP · máximo 5 MB.</small><label>Unidad de control</label><input name="unidad_medida" maxlength="30" value="'+esc(p?.unidad_medida||'unidad')+'" placeholder="unidad, botella, caja..."><label>Costo unitario de referencia</label><input name="costo_unitario" type="number" min="0" step="0.01" required value="'+Number(p?.costo_unitario||0)+'"><div class="inventory-profit-preview" id="profit-preview" aria-live="polite"></div><label>Precio de venta por unidad</label><input name="precio_venta" type="number" min="0" step="0.01" required value="'+Number(p?.precio_venta||0)+'"><label>Valor actual estimado (equipos)</label><input name="valor_actual" type="number" min="0" step="0.01" value="'+Number(p?.valor_actual||p?.costo_unitario||0)+'"><label class="chk"><input name="vendible" type="checkbox" '+(p?.vendible===false?'':'checked')+'> Se puede vender a clientes</label><small class="mute">Los equipos y materiales de uso interno deben quedar desmarcados.</small><label>Stock mínimo (alerta)</label><input name="stock_minimo" type="number" min="0" step="0.01" value="'+Number(p?.stock_minimo||0)+'"><label>Stock ideal (objetivo)</label><input name="stock_objetivo" type="number" min="0" step="0.01" value="'+Math.max(Number(p?.stock_objetivo||0),Number(p?.stock_minimo||0))+'"><label class="chk"><input name="control_stock" type="checkbox" '+(p?.control_stock===false?'':'checked')+'> Controlar existencias</label><div class="acts"><button type="button" class="btn sec" id="cx">Cancelar</button><button class="btn">Guardar producto</button></div>'+(p?'<button type="button" class="btn sec block" id="estado">'+(p.estado==='ACTIVO'?'Desactivar':'Reactivar')+'</button>':'')+'</form>';
  dlg.showModal();$('#cx').onclick=()=>dlg.close();let busy=false;
  const archivo=$('#pf [name="imagen"]'),precioInput=$('#pf [name="precio_venta"]'),costoInput=$('#pf [name="costo_unitario"]');
  const pintarRentabilidad=()=>{const c=Number(costoInput.value)||0,v=Number(precioInput.value)||0,u=v-c,m=v>0?u/v*100:0;$('#profit-preview').innerHTML='<strong>Rentabilidad estimada por unidad</strong><div>Utilidad: <b>'+dinero(u)+'</b></div><div>Margen: <b>'+m.toFixed(1)+'%</b></div><small>Calculada con el costo unitario promedio registrado.</small>'};
  costoInput.oninput=pintarRentabilidad;precioInput.oninput=pintarRentabilidad;pintarRentabilidad();
  archivo.onchange=()=>{const f=archivo.files?.[0];if(!f)return;if(!['image/jpeg','image/png','image/webp'].includes(f.type)||f.size>5242880){archivo.value='';return toast('La imagen debe ser JPG, PNG o WEBP y pesar máximo 5 MB.',true)}const url=URL.createObjectURL(f);$('.product-photo-preview').innerHTML='<img src="'+url+'" alt="Vista previa del producto">';};
  $('#pf').onsubmit=async e=>{e.preventDefault();if(busy)return;const f=Object.fromEntries(new FormData(e.target)),costo=Number(f.costo_unitario),precio=Number(f.precio_venta),valorActual=Number(f.valor_actual||0),min=Number(f.stock_minimo||0),ideal=Number(f.stock_objetivo||0),imagen=f.imagen;
   if(!Number.isFinite(costo)||costo<0||!Number.isFinite(precio)||precio<0||!Number.isFinite(valorActual)||valorActual<0||!Number.isFinite(min)||min<0||!Number.isFinite(ideal)||ideal<min)return toast('Verifica costos, precios y stock. El stock ideal debe ser igual o mayor al mínimo.',true);
   if(imagen?.size&&(!['image/jpeg','image/png','image/webp'].includes(imagen.type)||imagen.size>5242880))return toast('La imagen debe ser JPG, PNG o WEBP y pesar máximo 5 MB.',true);
   const tipo=f.tipo_inventario||'PRODUCTO_VENTA',vendible=tipo==='PRODUCTO_VENTA'&&!!f.vendible;const data={nombre:f.nombre.trim(),categoria:f.categoria.trim()||null,descripcion:f.descripcion.trim()||null,tipo_inventario:tipo,unidad_medida:f.unidad_medida.trim()||'unidad',vendible,valor_actual:tipo==='EQUIPO'?(valorActual||costo):0,costo_unitario:costo,precio_venta:vendible?precio:0,stock_minimo:min,stock_objetivo:ideal,control_stock:!!f.control_stock};
   busy=true;const b=e.target.querySelector('button[type="submit"],button:not([type])');if(b)b.disabled=true;
   let productoId=p?.id;
   if(p){const{error:e1}=await sb.from('productos').update(data).eq('id',p.id).eq('negocio_id',nid());if(e1){busy=false;if(b)b.disabled=false;return error(e1)}}
   else{const{data:creado,error:e1}=await sb.from('productos').insert({...data,negocio_id:nid(),estado:'ACTIVO'}).select('id').single();if(e1){busy=false;if(b)b.disabled=false;return error(e1)}productoId=creado.id}
   if(imagen?.size){
    const ext=imagen.type==='image/png'?'png':imagen.type==='image/webp'?'webp':'jpg',ruta=nid()+'/'+productoId+'/'+crypto.randomUUID()+'.'+ext;
    const{subError,...up}=await sb.storage.from('productos').upload(ruta,imagen,{contentType:imagen.type,upsert:true});
    if(up.error){busy=false;if(b)b.disabled=false;return toast('Producto guardado, pero no se pudo subir la fotografía: '+up.error.message,true)}
    const{data:publica}=sb.storage.from('productos').getPublicUrl(ruta);
    const{error:e1}=await sb.from('productos').update({imagen_url:publica.publicUrl}).eq('id',productoId).eq('negocio_id',nid());
    if(e1){busy=false;if(b)b.disabled=false;return error(e1)}
   }
   dlg.close();toast('Producto guardado');productosVista();
  };
  if(p)$('#estado').onclick=async()=>{const b=$('#estado');if(b.disabled)return;b.disabled=true;const{error:e1}=await sb.from('productos').update({estado:p.estado==='ACTIVO'?'INACTIVO':'ACTIVO'}).eq('id',p.id).eq('negocio_id',nid());if(e1){b.disabled=false;return error(e1)}dlg.close();productosVista()};
 }
 async function proveedorForm(p){
  dlg.innerHTML='<form id="vf"><h2>'+(p?'Editar':'Nuevo')+' proveedor</h2><label>Nombre del proveedor</label><input name="nombre" required maxlength="140" value="'+esc(p?.nombre||'')+'"><label>Teléfono</label><input name="telefono" type="tel" maxlength="30" value="'+esc(p?.telefono||'')+'" placeholder="Número de WhatsApp"><div class="acts"><button type="button" class="btn sec" id="cx">Cancelar</button><button class="btn">Guardar proveedor</button></div>'+(p?'<button type="button" class="btn sec block" id="estado">'+(p.estado==='ACTIVO'?'Desactivar':'Reactivar')+'</button>':'')+'</form>';
  dlg.showModal();$('#cx').onclick=()=>dlg.close();let busy=false;
  $('#vf').onsubmit=async e=>{e.preventDefault();if(busy)return;const f=Object.fromEntries(new FormData(e.target));const data={nombre:f.nombre.trim(),telefono:f.telefono.trim()||null};
   busy=true;const b=e.target.querySelector('button[type="submit"],button:not([type])');if(b)b.disabled=true;
   const q=p?sb.from('proveedores_inventario').update(data).eq('id',p.id).eq('negocio_id',nid()):sb.from('proveedores_inventario').insert({...data,negocio_id:nid(),estado:'ACTIVO'});
   const{error:e1}=await q;if(e1){busy=false;if(b)b.disabled=false;return error(e1)}dlg.close();toast('Proveedor guardado');render();
  };
  if(p)$('#estado').onclick=async()=>{const b=$('#estado');b.disabled=true;const{error:e1}=await sb.from('proveedores_inventario').update({estado:p.estado==='ACTIVO'?'INACTIVO':'ACTIVO'}).eq('id',p.id).eq('negocio_id',nid());if(e1){b.disabled=false;return error(e1)}dlg.close();render()};
 }
 async function compraForm(){
  const{data:cajaInicial,error:errorCajaInicial}=await sb.from('cajas').select('id').eq('negocio_id',nid()).eq('estado_caja','ABIERTA').maybeSingle();
  if(errorCajaInicial)return error(errorCajaInicial);
  if(!cajaInicial?.id)return toast('Para registrar una compra, primero abre la caja.',true);
  if(!await cargarBase())return;
  const ps=productos.filter(p=>p.estado==='ACTIVO');
  const vs=proveedores.filter(p=>p.estado==='ACTIVO');
  if(!ps.length)return toast('Primero registra un producto activo.',true);
  if(!vs.length)return toast('Primero registra un proveedor activo.',true);
  const option=ps.map(p=>'<option value="'+p.id+'" data-cost="'+Number(p.costo_unitario||0)+'" data-unit="'+esc(p.unidad_medida||'unidad')+'">'+esc(p.nombre)+' ('+esc(p.unidad_medida||'unidad')+')</option>').join('');
  const line=()=>'<div class="inventory-purchase-line cl"><label>Artículo<select aria-label="Artículo">'+option+'</select></label><label>Paquetes / presentaciones<input type="number" min="0.001" step="0.001" value="1" aria-label="Cantidad de paquetes"></label><label>Unidades por paquete<input type="number" min="0.001" step="0.001" value="1" aria-label="Unidades por paquete"></label><label>Costo por paquete ($)<input type="number" min="0" step="0.01" value="'+Number(ps[0].costo_unitario||0)+'" aria-label="Costo por paquete"></label><button type="button" class="btn sec rm" aria-label="Quitar línea">×</button><small class="package-calc" style="grid-column:1/-1"></small></div>';
  dlg.innerHTML='<form id="cf"><h2>Registrar compra</h2><label>Proveedor</label><select name="proveedor_id" required>'+vs.map(v=>'<option value="'+v.id+'">'+esc(v.nombre)+'</option>').join('')+'</select><label>Fecha de compra</label><input name="fecha_compra" type="date" required value="'+hoy()+'"><label>Número de factura o documento</label><input name="numero_factura" maxlength="100"><label>Fecha de vencimiento (si es a crédito)</label><input name="fecha_vencimiento" type="date"><label>Productos comprados</label><div id="clines">'+line()+'</div><button type="button" class="link" id="addline">Agregar producto</button><p class="tot" id="ctotal">Total: $0</p><label>Valor pagado ahora</label><input name="valor_pagado" type="number" min="0" step="0.01" value="0" required><label>Método de pago</label><select name="metodo_pago">'+metodos.map(m=>'<option>'+m+'</option>').join('')+'</select><label>Referencia de pago</label><input name="referencia" maxlength="120"><label>Observaciones</label><textarea name="observaciones" rows="2"></textarea><div class="acts"><button type="button" class="btn sec" id="cx">Cancelar</button><button class="btn">Guardar compra e ingresar stock</button></div></form>';
  dlg.showModal();$('#cx').onclick=()=>dlg.close();
  const filas=()=>[...document.querySelectorAll('#clines .cl')];
  const detalleLinea=l=>{const p=ps.find(x=>x.id===l.querySelector('select').value),i=l.querySelectorAll('input'),paquetes=Number(i[0].value),unidades=Number(i[1].value),costoPaquete=Number(i[2].value),cantidad=paquetes*unidades,costoUnitario=unidades>0?costoPaquete/unidades:0;return{producto_id:p?.id,cantidad,costo_unitario:costoUnitario,total:paquetes*costoPaquete,paquetes,unidades,costoPaquete,p}};
  const calc=()=>filas().reduce((a,l)=>a+detalleLinea(l).total,0);
  $('#clines').onchange=e=>{if(e.target.tagName==='SELECT'){const p=ps.find(x=>x.id===e.target.value),i=e.target.closest('.cl').querySelectorAll('input');i[2].value=Number(p?.costo_unitario||0);ref()}else ref()};
  $('#clines').oninput=ref;function ref(){let total=0;filas().forEach(l=>{const d=detalleLinea(l);total+=d.total;l.querySelector('.package-calc').textContent='Ingresarán '+d.cantidad+' '+(d.p?.unidad_medida||'unidades')+' · Costo unitario: '+dinero(d.costo_unitario)+' · Total línea: '+dinero(d.total)});$('#ctotal').textContent='Total de compra: '+dinero(total)}
  $('#clines').onclick=e=>{if(e.target.classList.contains('rm')){e.target.closest('.cl').remove();ref()}};
  $('#addline').onclick=()=>{$('#clines').insertAdjacentHTML('beforeend',line());ref()};ref();
  let busy=false;
  $('#cf').onsubmit=async e=>{e.preventDefault();if(busy)return;const f=Object.fromEntries(new FormData(e.target));const detalles=[...document.querySelectorAll('#clines .cl')].map(l=>({producto_id:l.querySelector('select').value,cantidad:Number(l.querySelectorAll('input')[0].value),costo_unitario:Number(l.querySelectorAll('input')[1].value)}));
   const total=calc(),pagado=Number(f.valor_pagado);
   if(!detalles.length||detalles.some(x=>!x.producto_id||!Number.isFinite(x.cantidad)||x.cantidad<=0||!Number.isFinite(x.costo_unitario)||x.costo_unitario<0)||!Number.isFinite(total)||!Number.isFinite(pagado)||pagado<0||pagado>total)return toast('Revisa productos, cantidades, costos y pago. El abono no puede superar el total.',true);
   const detalles=filas().map(l=>{const d=detalleLinea(l);return{producto_id:d.producto_id,cantidad:d.cantidad,costo_unitario:d.costo_unitario}});if(detalles.some(d=>!Number.isFinite(d.cantidad)||d.cantidad<=0||!Number.isFinite(d.costo_unitario)||d.costo_unitario<0))return toast('Revisa paquetes, unidades y costos por presentación.',true);
   const{data:caja,error:errorCaja}=await sb.from('cajas').select('id').eq('negocio_id',nid()).eq('estado_caja','ABIERTA').maybeSingle();if(errorCaja)return error(errorCaja);if(!caja?.id)return toast('La caja se cerró. Abre una caja para registrar la compra.',true);
   busy=true;const b=e.target.querySelector('button[type="submit"],button:not([type])');if(b)b.disabled=true;
   const{data,error:e1}=await sb.rpc('registrar_compra_inventario',{p_proveedor_id:f.proveedor_id,p_fecha_compra:f.fecha_compra,p_detalles:detalles,p_valor_pagado:pagado,p_metodo_pago:f.metodo_pago,p_referencia:f.referencia||null,p_observaciones:f.observaciones||null,p_caja_id:caja?.id||null,p_numero_factura:f.numero_factura||null,p_fecha_vencimiento:f.fecha_vencimiento||null});
   if(e1){busy=false;if(b)b.disabled=false;return error(e1)}dlg.close();toast('Compra registrada e inventario actualizado');render();
  };
 }
 async function ajusteForm(){
  if(!await cargarBase())return;
  const lista=productos.filter(p=>p.estado==='ACTIVO'&&p.control_stock!==false);
  if(!lista.length)return toast('No hay productos activos con control de inventario.',true);
  dlg.innerHTML='<form id="af"><h2>Ajuste de inventario</h2><p class="mute">Usa este movimiento para corregir diferencias de conteo, mermas o entradas no asociadas a una compra.</p><label>Producto</label><select name="producto_id">'+lista.map(p=>'<option value="'+p.id+'">'+esc(p.nombre)+' · Stock '+existencia(p.id)+'</option>').join('')+'</select><label>Tipo de ajuste</label><select name="tipo"><option value="ENTRADA">Entrada / sobrante</option><option value="SALIDA">Salida / faltante o merma</option></select><label>Cantidad</label><input name="cantidad" type="number" min="0.001" step="0.001" required><label>Motivo del ajuste</label><textarea name="motivo" minlength="3" maxlength="250" required placeholder="Ej. Conteo físico, producto dañado, vencimiento"></textarea><div class="acts"><button type="button" class="btn sec" id="cx">Cancelar</button><button class="btn">Registrar ajuste</button></div></form>';
  dlg.showModal();$('#cx').onclick=()=>dlg.close();let busy=false;
  $('#af').onsubmit=async e=>{e.preventDefault();if(busy)return;const f=Object.fromEntries(new FormData(e.target)),n=Number(f.cantidad);if(!Number.isFinite(n)||n<=0||f.motivo.trim().length<3)return toast('Indica una cantidad y un motivo válido.',true);busy=true;const b=e.target.querySelector('button[type="submit"],button:not([type])');if(b)b.disabled=true;const{error:e1}=await sb.rpc('ajustar_inventario_producto',{p_producto_id:f.producto_id,p_tipo:f.tipo,p_cantidad:n,p_motivo:f.motivo.trim()});if(e1){busy=false;if(b)b.disabled=false;return error(e1)}dlg.close();toast('Ajuste de inventario registrado');vista='productos';render()};
 }
 async function listarCompras(){
  const todas=[];for(let desde=0;;desde+=1000){
   const{data,error:e1}=await sb.from('compras_inventario').select('*,proveedores_inventario(nombre)').eq('negocio_id',nid()).order('fecha_compra',{ascending:false}).range(desde,desde+999);
   if(e1)return{data:null,error:e1};todas.push(...(data||[]));if(!data||data.length<1000)break;
  }return{data:todas,error:null};
 }
 async function comprasVista(){
  const{data,error:e1}=await listarCompras();
  if(e1)return error(e1);
  const compras=data||[],saldo=compras.filter(c=>c.estado_compra!=='ANULADA').reduce((a,c)=>a+Number(c.saldo_pendiente||0),0),vencidas=compras.filter(c=>c.estado_compra==='PENDIENTE'&&c.fecha_vencimiento&&c.fecha_vencimiento<hoy()).length;
  $('#main').innerHTML='<div class="head"><h2>Compras a proveedores</h2><button class="btn" id="nc">Registrar compra</button></div>'+tabs()+'<div class="kp"><div><small>Compras registradas</small><strong>'+compras.length+'</strong></div><div><small>Cuentas por pagar</small><strong>'+dinero(saldo)+'</strong></div><div><small>Vencidas</small><strong>'+vencidas+'</strong></div></div>'+
   (compras.length?compras.map(c=>'<button class="row" data-compra="'+c.id+'"><span><strong>'+esc(c.proveedores_inventario?.nombre||'Proveedor')+'</strong><br><small>'+fecha(c.fecha_compra)+' · '+esc(c.numero_factura||'Sin factura')+' · '+dinero(c.total_compra)+' · Pagado '+dinero(c.total_pagado)+' · Saldo '+dinero(c.saldo_pendiente)+(c.fecha_vencimiento?' · Vence '+fecha(c.fecha_vencimiento):'')+'</small></span><span class="chip '+(c.estado_compra==='PAGADA'?'bien':c.estado_compra==='ANULADA'?'mal':c.fecha_vencimiento&&c.fecha_vencimiento<hoy()?'mal':'ojo')+'">'+(c.estado_compra==='PENDIENTE'&&c.fecha_vencimiento&&c.fecha_vencimiento<hoy()?'VENCIDA':esc(c.estado_compra))+'</span></button>').join(''):'<p class="empty">Aún no hay compras registradas.</p>');
  $('#nc').onclick=compraForm;document.querySelectorAll('[data-tab]').forEach(b=>b.onclick=()=>{vista=b.dataset.tab;render()});
  document.querySelectorAll('[data-compra]').forEach(b=>b.onclick=()=>detalleCompra(data.find(x=>x.id===b.dataset.compra)));
 }
 async function detalleCompra(c){
  const [d,p]=await Promise.all([
   sb.from('detalle_compras_inventario').select('*,productos(nombre)').eq('negocio_id',nid()).eq('compra_id',c.id),
   sb.from('pagos_compras_inventario').select('*').eq('negocio_id',nid()).eq('compra_id',c.id).order('fecha_pago')
  ]);
  if(d.error)return error(d.error);if(p.error)return error(p.error);
  dlg.innerHTML='<div><h2>Compra · '+esc(c.proveedores_inventario?.nombre||'Proveedor')+'</h2><p class="mute">'+fecha(c.fecha_compra)+' · '+esc(c.estado_compra)+'</p>'+d.data.map(x=>'<div class="ln2"><span>'+esc(x.productos?.nombre||'Producto')+' × '+x.cantidad+'</span><strong>'+dinero(x.subtotal)+'</strong></div>').join('')+'<hr><div class="ln2"><span>Total</span><strong>'+dinero(c.total_compra)+'</strong></div><div class="ln2"><span>Pagado</span><strong>'+dinero(c.total_pagado)+'</strong></div><div class="ln2"><span>Saldo</span><strong>'+dinero(c.saldo_pendiente)+'</strong></div>'+
   (p.data||[]).map(x=>'<div class="ln2"><span>'+fecha(x.fecha_pago)+' · '+esc(x.metodo_pago)+'</span><strong>'+dinero(x.valor_pago)+'</strong></div>').join('')+
   (c.estado_compra!=='ANULADA'&&Number(c.saldo_pendiente)>0?'<button type="button" class="btn block" id="pago">Registrar abono</button>':'')+
   (c.estado_compra!=='ANULADA'&&Number(c.total_pagado)===0?'<button type="button" class="btn sec block" id="anular">Anular compra</button>':'')+
   '<div class="acts"><button type="button" class="btn sec" id="cx">Cerrar</button></div></div>';
  dlg.showModal();$('#cx').onclick=()=>dlg.close();
  if($('#pago'))$('#pago').onclick=()=>pagoCompra(c);
  if($('#anular'))$('#anular').onclick=async()=>{if(!confirm('¿Anular esta compra? Se generará un movimiento inverso. Solo es posible si las existencias siguen disponibles y no hay pagos registrados.'))return;const b=$('#anular');b.disabled=true;const{error:e1}=await sb.rpc('anular_compra_inventario',{p_compra_id:c.id});if(e1){b.disabled=false;return error(e1)}dlg.close();toast('Compra anulada');render()};
 }
 async function pagoCompra(c){
  dlg.innerHTML='<form id="pc"><h2>Abonar a proveedor</h2><p>Saldo pendiente: <strong>'+dinero(c.saldo_pendiente)+'</strong></p><label>Valor del abono</label><input name="valor" type="number" min="0.01" max="'+Number(c.saldo_pendiente)+'" step="0.01" required><label>Método</label><select name="metodo">'+metodos.map(m=>'<option>'+m+'</option>').join('')+'</select><label>Referencia</label><input name="referencia"><label>Observaciones</label><textarea name="observaciones"></textarea><div class="acts"><button type="button" class="btn sec" id="cx">Cancelar</button><button class="btn">Registrar abono</button></div></form>';
  $('#cx').onclick=()=>dlg.close();let busy=false;
  $('#pc').onsubmit=async e=>{e.preventDefault();if(busy)return;const f=Object.fromEntries(new FormData(e.target)),v=Number(f.valor);if(!Number.isFinite(v)||v<=0||v>Number(c.saldo_pendiente))return toast('El abono debe ser mayor que cero y no superar el saldo.',true);const{data:caja,error:errorCaja}=await sb.from('cajas').select('id').eq('negocio_id',nid()).eq('estado_caja','ABIERTA').maybeSingle();if(errorCaja)return error(errorCaja);if(!caja?.id)return toast('Para registrar un abono al proveedor, primero abre la caja.',true);busy=true;const b=e.target.querySelector('button[type="submit"],button:not([type])');if(b)b.disabled=true;const{error:e1}=await sb.rpc('registrar_pago_compra_inventario',{p_compra_id:c.id,p_valor_pago:v,p_metodo_pago:f.metodo,p_referencia:f.referencia||null,p_observaciones:f.observaciones||null,p_caja_id:caja?.id||null});if(e1){busy=false;if(b)b.disabled=false;return error(e1)}dlg.close();toast('Abono registrado');render()};
 }
 async function proveedoresVista(){
  if(!await cargarBase())return;
  $('#main').innerHTML='<div class="head"><h2>Proveedores</h2><button class="btn" id="np">Nuevo proveedor</button></div>'+tabs()+
   (proveedores.length?proveedores.map(p=>'<button class="row" data-prov="'+p.id+'"><span><strong>'+esc(p.nombre)+'</strong><br><small>'+esc(p.contacto||'Sin contacto')+' · '+esc(p.telefono||p.correo||'Sin datos')+'</small></span><span class="chip '+(p.estado==='ACTIVO'?'bien':'')+'">'+esc(p.estado)+'</span></button>').join(''):'<p class="empty">Aún no hay proveedores.</p>');
  $('#np').onclick=()=>proveedorForm();document.querySelectorAll('[data-tab]').forEach(b=>b.onclick=()=>{vista=b.dataset.tab;render()});
  document.querySelectorAll('[data-prov]').forEach(b=>b.onclick=()=>proveedorForm(proveedores.find(x=>x.id===b.dataset.prov)));
 }
 async function movimientosVista(){
  const{data,error:e1}=await sb.from('movimientos_inventario').select('id,fecha_hora,tipo_movimiento,cantidad,costo_unitario,motivo,productos(nombre)').eq('negocio_id',nid()).order('fecha_hora',{ascending:false}).limit(150);
  if(e1)return error(e1);
  $('#main').innerHTML='<div class="head"><h2>Movimientos de inventario</h2></div>'+tabs()+
   (data.length?data.map(m=>'<div class="row"><span><strong>'+esc(m.productos?.nombre||'Producto')+' · '+esc(m.tipo_movimiento)+'</strong><br><small>'+fecha(m.fecha_hora)+' · '+esc(m.motivo||'Sin motivo')+'</small></span><strong>'+((m.tipo_movimiento==='SALIDA'?'-':'+')+m.cantidad)+'</strong></div>').join(''):'<p class="empty">Aún no hay movimientos.</p>');
  document.querySelectorAll('[data-tab]').forEach(b=>b.onclick=()=>{vista=b.dataset.tab;render()});
 }
 async function pedidoProveedorForm(){
  if(!await cargarBase())return;
  const ps=productos.filter(p=>p.estado==='ACTIVO'),vs=proveedores.filter(p=>p.estado==='ACTIVO');
  if(!ps.length)return toast('Primero registra productos activos.',true);
  if(!vs.length)return toast('Primero registra un proveedor activo.',true);
  const linea=()=>'<div class="ln pp-line" style="grid-template-columns:minmax(0,1fr) 82px 100px 34px"><select aria-label="Producto">'+ps.map(p=>'<option value="'+p.id+'">'+esc(p.nombre)+'</option>').join('')+'</select><input type="number" min="0.001" step="0.001" value="1" aria-label="Cantidad a pedir"><input type="number" min="0" step="0.01" value="'+Number(ps[0].costo_unitario||0)+'" aria-label="Costo estimado"><button type="button" class="btn sec rm" aria-label="Quitar">×</button><small class="pp-stock" style="grid-column:1/-1"></small></div>';
  dlg.innerHTML='<form id="ppf"><h2>Preparar pedido al proveedor</h2><p class="info">Este pedido no registra una compra ni modifica las existencias. El inventario solo aumenta al registrar la mercancía recibida.</p><label>Proveedor</label><select name="proveedor_id" required>'+vs.map(v=>'<option value="'+v.id+'">'+esc(v.nombre)+'</option>').join('')+'</select><label>Productos y cantidades</label><div id="pplines">'+linea()+'</div><button type="button" class="link" id="ppadd">Agregar producto</button><p class="tot" id="pptotal">Total estimado: '+dinero(0)+'</p><label>Observaciones para el proveedor</label><textarea name="observaciones" rows="2" maxlength="500"></textarea><div class="acts"><button type="button" class="btn sec" id="cx">Cancelar</button><button class="btn">Guardar y generar PDF</button></div></form>';
  dlg.showModal();$('#cx').onclick=()=>dlg.close();
  const filas=()=>[...document.querySelectorAll('#pplines .pp-line')];
  const pintar=()=>{let total=0;filas().forEach(l=>{const p=ps.find(x=>x.id===l.querySelector('select').value),q=Number(l.querySelectorAll('input')[0].value),c=Number(l.querySelectorAll('input')[1].value),st=existencia(p.id),min=minimo(p),obj=objetivo(p),faltan=Math.max(0,obj-st);total+=q*c;l.querySelector('.pp-stock').textContent=p.control_stock===false?'Sin control de existencias':st<=0?'🔴 Agotado · Stock ideal: '+obj+' · Sugerencia: '+faltan+' unidades':st<=min?'🟡 Stock bajo · Hay '+st+' · Sugerencia: '+faltan+' unidades':'🟢 Stock favorable · Hay '+st+' unidades';if(!l.querySelectorAll('input')[0].dataset.manual&&faltan>0)l.querySelectorAll('input')[0].value=faltan});$('#pptotal').textContent='Total estimado: '+dinero(filas().reduce((a,l)=>a+Number(l.querySelectorAll('input')[0].value)*Number(l.querySelectorAll('input')[1].value),0))};
  $('#pplines').oninput=e=>{if(e.target.matches('input'))e.target.dataset.manual='1';pintar()};
  $('#pplines').onchange=e=>{if(e.target.tagName==='SELECT'){const p=ps.find(x=>x.id===e.target.value);e.target.querySelectorAll;const l=e.target.closest('.pp-line');l.querySelectorAll('input')[1].value=Number(p?.costo_unitario||0);l.querySelectorAll('input')[0].dataset.manual='';pintar()}};
  $('#pplines').onclick=e=>{if(e.target.classList.contains('rm')){e.target.closest('.pp-line').remove();pintar()}};
  $('#ppadd').onclick=()=>{$('#pplines').insertAdjacentHTML('beforeend',linea());pintar()};pintar();
  let busy=false;
  $('#ppf').onsubmit=async e=>{e.preventDefault();if(busy)return;const f=Object.fromEntries(new FormData(e.target)),items=filas().map(l=>({producto:ps.find(p=>p.id===l.querySelector('select').value),cantidad:Number(l.querySelectorAll('input')[0].value),costo:Number(l.querySelectorAll('input')[1].value)}));
   if(!items.length||items.some(x=>!x.producto||!Number.isFinite(x.cantidad)||x.cantidad<=0||!Number.isFinite(x.costo)||x.costo<0))return toast('Revisa los productos, cantidades y costos.',true);
   busy=true;const b=e.target.querySelector('button[type="submit"],button:not([type])');if(b)b.disabled=true;
   const{data:pedido,error:e1}=await sb.from('pedidos_proveedores').insert({negocio_id:nid(),proveedor_id:f.proveedor_id,observaciones:f.observaciones.trim()||null,creado_por:S.perfil.id}).select('id,creado_en').single();
   if(e1){busy=false;if(b)b.disabled=false;return error(e1)}
   const detalle=items.map(x=>({pedido_id:pedido.id,negocio_id:nid(),producto_id:x.producto.id,nombre_producto:x.producto.nombre,cantidad:x.cantidad,costo_estimado:x.costo}));
   const{error:e2}=await sb.from('detalle_pedidos_proveedores').insert(detalle);
   if(e2){await sb.from('pedidos_proveedores').delete().eq('id',pedido.id).eq('negocio_id',nid());busy=false;if(b)b.disabled=false;return error(e2)}
   toast('Pedido guardado. Preparando documento PDF.');const pdf=await generarPdfPedido(pedido,vs.find(v=>v.id===f.proveedor_id),items,f.observaciones);if(pdf)mostrarAccionesPdf(pdf,vs.find(v=>v.id===f.proveedor_id));else dlg.close();vista='pedido_proveedor';render();
  };
 }
 async function generarPdfPedido(pedido,proveedor,items,observaciones){
  try{
   if(!proveedor)throw new Error('No se encontró la información del proveedor.');
   // PDF nativo: no depende de bibliotecas CDN ni de conexión a servidores externos.
   const limpiar=v=>String(v??'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^\x20-\x7E]/g,'');
   const envolver=(valor,max=76)=>{
    const palabras=limpiar(valor).split(/\s+/);const salida=[];let linea='';
    for(const palabra of palabras){
     if(!palabra)continue;
     if((linea+' '+palabra).trim().length>max&&linea){salida.push(linea);linea=palabra}
     else linea=(linea+' '+palabra).trim();
    }
    if(linea)salida.push(linea);return salida.length?salida:[''];
   };
   const lineas=[{t:'PEDIDO A PROVEEDOR',b:true,size:18},{t:''},
    {t:'Proveedor: '+(proveedor.nombre||'')},{t:'Telefono: '+(proveedor.telefono||'No registrado')},
    {t:'Fecha: '+new Date(pedido.creado_en||Date.now()).toLocaleDateString('es-CO')},{t:''},
    {t:'PRODUCTO                         CANT.       COSTO       SUBTOTAL',b:true},
    {t:'----------------------------------------------------------------------------'}];
   let total=0;
   for(const x of items){
    const cantidad=Number(x.cantidad)||0,costo=Number(x.costo)||0,subtotal=cantidad*costo;total+=subtotal;
    const nombre=limpiar(x.producto?.nombre||'Producto');
    const nombreLineas=envolver(nombre,32);
    lineas.push({t:nombreLineas[0].padEnd(34).slice(0,34)+String(cantidad).padStart(8)+'  '+limpiar(dinero(costo)).padStart(11)+'  '+limpiar(dinero(subtotal)).padStart(12)});
    for(const extra of nombreLineas.slice(1))lineas.push({t:'  '+extra});
   }
   lineas.push({t:'----------------------------------------------------------------------------'});
   lineas.push({t:'TOTAL ESTIMADO: '+limpiar(dinero(total)),b:true,size:12});
   if(observaciones){lineas.push({t:''},{t:'OBSERVACIONES',b:true});for(const l of envolver(observaciones,76))lineas.push({t:l})}
   const porPagina=48,paginas=[];
   for(let i=0;i<lineas.length;i+=porPagina)paginas.push(lineas.slice(i,i+porPagina));
   const escapar=v=>limpiar(v).replace(/\\/g,'\\\\').replace(/\(/g,'\\(').replace(/\)/g,'\\)');
   const objetos=[];
   objetos[1]='<< /Type /Catalog /Pages 2 0 R >>';
   objetos[2]='';objetos[3]='<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>';
   objetos[4]='<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >>';
   const kids=[];
   paginas.forEach((pagina,i)=>{
    const pageId=5+i*2,streamId=pageId+1;kids.push(pageId+' 0 R');
    let y=800,contenido='';
    for(const l of pagina){
     if(!l.t){y-=9;continue}
     const fuente=l.b?'/F2':'/F1',tam=l.size||9;
     contenido+='BT '+fuente+' '+tam+' Tf 42 '+y+' Td ('+escapar(l.t)+') Tj ET\n';
     y-=l.size?25:14;
    }
    const largo=new TextEncoder().encode(contenido).length;
    objetos[pageId]='<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 3 0 R /F2 4 0 R >> >> /Contents '+streamId+' 0 R >>';
    objetos[streamId]='<< /Length '+largo+' >>\nstream\n'+contenido+'endstream';
   });
   objetos[2]='<< /Type /Pages /Kids ['+kids.join(' ')+'] /Count '+paginas.length+' >>';
   let pdf='%PDF-1.4\n%PDFBARBERIA\n',offsets=[0];
   for(let i=1;i<objetos.length;i++){offsets[i]=new TextEncoder().encode(pdf).length;pdf+=i+' 0 obj\n'+objetos[i]+'\nendobj\n'}
   const xref=new TextEncoder().encode(pdf).length;
   pdf+='xref\n0 '+objetos.length+'\n0000000000 65535 f \n';
   for(let i=1;i<objetos.length;i++)pdf+=String(offsets[i]).padStart(10,'0')+' 00000 n \n';
   pdf+='trailer\n<< /Size '+objetos.length+' /Root 1 0 R >>\nstartxref\n'+xref+'\n%%EOF';
   return {blob:new Blob([pdf],{type:'application/pdf'}),nombre:'pedido-proveedor-'+String(pedido.id||'pedido').slice(0,8)+'.pdf'};
  }catch(e){
   console.error('Error generando PDF de pedido:',e);
   toast('No se pudo generar el PDF: '+(e?.message||'Error desconocido')+'.',true);
   return null;
  }
 }

 function mostrarAccionesPdf(pdf,proveedor){
  dlg.innerHTML='<div class="form"><h2>Pedido listo</h2><p class="info">El PDF ya está generado. Elige cómo quieres compartirlo o guardarlo.</p><div class="acts" style="flex-direction:column;align-items:stretch"><button type="button" class="btn" id="pp-enviar-wa">Enviar por WhatsApp</button><button type="button" class="btn sec" id="pp-guardar-pdf">Guardar PDF en el dispositivo</button><button type="button" class="link" id="pp-cerrar-pdf">Cerrar</button></div><small>En móviles compatibles se abrirá el menú para elegir WhatsApp. Si el navegador no permite compartir archivos, se descargará el PDF y se abrirá WhatsApp para adjuntarlo manualmente.</small></div>';
  if(!dlg.open)dlg.showModal();
  const guardar=()=>{const url=URL.createObjectURL(pdf.blob),a=document.createElement('a');a.href=url;a.download=pdf.nombre;a.style.display='none';document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),60000);toast('PDF guardado en las descargas del dispositivo.')};
  $('#pp-guardar-pdf').onclick=guardar;
  $('#pp-enviar-wa').onclick=async()=>{
   const archivo=new File([pdf.blob],pdf.nombre,{type:'application/pdf'});
   try{
    if(navigator.share&&navigator.canShare&&navigator.canShare({files:[archivo]})){
     await navigator.share({files:[archivo],title:'Pedido a proveedor',text:'Pedido para '+String(proveedor?.nombre||'proveedor')});
     toast('Selecciona WhatsApp en el menú para completar el envío.');
    }else{
     guardar();
     const tel=String(proveedor?.telefono||'').replace(/\D/g,'');
     const texto=encodeURIComponent('Hola, te comparto el pedido. Adjunto el archivo PDF: '+pdf.nombre);
     window.open('https://wa.me/'+tel+'?text='+texto,'_blank','noopener');
     toast('Adjunta en WhatsApp el PDF que se acaba de descargar.');
    }
   }catch(e){if(e?.name==='AbortError')return;console.error('No se pudo compartir el PDF:',e);toast('No se pudo abrir el menú para compartir. Usa Guardar PDF y adjúntalo en WhatsApp.',true)}
  };
  $('#pp-cerrar-pdf').onclick=()=>dlg.close();
 }

 async function pedidosProveedorVista(){
  const{data,error:e1}=await sb.from('pedidos_proveedores').select('*,proveedores_inventario(nombre,telefono),detalle_pedidos_proveedores(*)').eq('negocio_id',nid()).order('creado_en',{ascending:false}).limit(100);
  if(e1)return error(e1);
  const pedidos=data||[];
  $('#main').innerHTML='<div class="head"><h2>Pedidos a proveedores</h2><button class="btn" id="nuevo-pp">Preparar pedido</button></div>'+tabs()+(pedidos.length?pedidos.map(p=>'<article class="order-card"><div class="order-head"><div><strong>'+esc(p.proveedores_inventario?.nombre||'Proveedor')+'</strong><small>'+fecha(p.creado_en)+' · '+esc(p.proveedores_inventario?.telefono||'Sin teléfono')+'</small></div><span class="chip">'+esc(p.estado)+'</span></div><div class="order-items">'+(p.detalle_pedidos_proveedores||[]).map(d=>'<span>'+esc(d.nombre_producto)+' × '+d.cantidad+'</span>').join('')+'</div><div class="acts"><select data-ppestado="'+p.id+'">'+['BORRADOR','ENVIADO','RECIBIDO','CANCELADO'].map(e=>'<option value="'+e+'" '+(p.estado===e?'selected':'')+'>'+e+'</option>').join('')+'</select><button class="btn sec" data-pppdf="'+p.id+'">Generar PDF</button></div></article>').join(''):'<p class="empty">Todavía no has preparado pedidos a proveedores.</p>');
  $('#nuevo-pp').onclick=pedidoProveedorForm;document.querySelectorAll('[data-tab]').forEach(b=>b.onclick=()=>{vista=b.dataset.tab;render()});
  document.querySelectorAll('[data-ppestado]').forEach(sel=>sel.onchange=async()=>{sel.disabled=true;const{error:e1}=await sb.from('pedidos_proveedores').update({estado:sel.value,actualizado_en:new Date().toISOString()}).eq('id',sel.dataset.ppestado).eq('negocio_id',nid());if(e1){sel.disabled=false;return error(e1)}sel.disabled=false;toast('Estado actualizado')});
  document.querySelectorAll('[data-pppdf]').forEach(b=>b.onclick=async()=>{const p=pedidos.find(x=>x.id===b.dataset.pppdf),items=(p.detalle_pedidos_proveedores||[]).map(d=>({producto:{nombre:d.nombre_producto},cantidad:Number(d.cantidad),costo:Number(d.costo_estimado)}));const pdf=await generarPdfPedido(p,p.proveedores_inventario,items,p.observaciones);if(pdf)mostrarAccionesPdf(pdf,p.proveedores_inventario)});
 }
 async function render(){if(!rol())return toast('No tienes permisos para gestionar productos e inventario.',true);if(vista==='productos')return productosVista();if(vista==='pedido_proveedor')return pedidosProveedorVista();if(vista==='compras')return comprasVista();if(vista==='proveedores')return proveedoresVista();return movimientosVista()}
 return { productos:()=>{vista='productos';return render()} };
}
