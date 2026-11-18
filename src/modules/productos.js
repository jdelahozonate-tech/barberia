// Gestión profesional de productos, proveedores, compras e inventario.
export function crearModuloProductos(deps) {
 const { $, dlg, sb, S, esc, dinero, traducir, toast } = deps;
 const rol=()=>['ADMINISTRADOR','SUPERVISOR'].includes(S.perfil.rol);
 const nid=()=>S.perfil.negocio_id;
 const metodos=['EFECTIVO','TRANSFERENCIA','TARJETA','NEQUI','DAVIPLATA'];
 let vista='productos',productos=[],proveedores=[],stock=[];
 const fecha=x=>x?new Date(x).toLocaleDateString('es-CO',{year:'numeric',month:'short',day:'numeric'}):'—';
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
 const tabs=()=>'<div class="acts"><button class="btn '+(vista==='productos'?'':'sec')+'" data-tab="productos">Productos</button><button class="btn '+(vista==='compras'?'':'sec')+'" data-tab="compras">Compras</button><button class="btn '+(vista==='proveedores'?'':'sec')+'" data-tab="proveedores">Proveedores</button><button class="btn '+(vista==='movimientos'?'':'sec')+'" data-tab="movimientos">Movimientos</button></div>';
 async function productosVista(){
  if(!await cargarBase())return;
  const total=productos.length,agotados=productos.filter(p=>p.control_stock!==false&&existencia(p.id)<=0).length,bajos=productos.filter(p=>p.control_stock!==false&&existencia(p.id)>0&&existencia(p.id)<=minimo(p)).length;
  const valor=productos.reduce((a,p)=>a+existencia(p.id)*Number(p.costo_unitario||0),0);
  $('#main').innerHTML='<div class="head"><h2>Productos e inventario</h2><button class="btn" id="np">Nuevo producto</button></div>'+tabs()+
   '<div class="kp"><div><small>Productos activos</small><strong>'+productos.filter(p=>p.estado==='ACTIVO').length+'</strong></div><div><small>Stock bajo</small><strong>'+bajos+'</strong></div><div><small>Agotados</small><strong>'+agotados+'</strong></div><div><small>Valor estimado</small><strong>'+dinero(valor)+'</strong></div></div>'+
   '<div class="acts"><button class="btn" id="nc">Registrar compra</button><button class="btn sec" id="nprov">Nuevo proveedor</button></div>'+
   '<input id="buscarp" type="search" placeholder="Buscar producto por nombre o categoría" aria-label="Buscar producto"><label class="chk"><input type="checkbox" id="inactivos"> Mostrar inactivos</label><div id="listap"></div>';
  $('#np').onclick=()=>productoForm();$('#nc').onclick=()=>compraForm();$('#nprov').onclick=()=>proveedorForm();
  document.querySelectorAll('[data-tab]').forEach(b=>b.onclick=()=>{vista=b.dataset.tab;render()});
  const pintar=()=>{const q=$('#buscarp').value.trim().toLocaleLowerCase(),inac=$('#inactivos').checked;
   const lista=productos.filter(p=>(inac||p.estado==='ACTIVO')&&(p.nombre+' '+(p.categoria||'')).toLocaleLowerCase().includes(q));
   $('#listap').innerHTML=lista.length?lista.map(p=>'<button class="row" data-prod="'+p.id+'"><span><strong>'+esc(p.nombre)+'</strong><br><small>'+esc(p.categoria||'Sin categoría')+' · '+dinero(p.precio_venta)+' · '+(p.control_stock===false?'Sin control de stock':'Stock: '+existencia(p.id)+' / mínimo '+minimo(p))+'</small></span><span class="chip '+(p.estado==='ACTIVO'?(p.control_stock!==false&&existencia(p.id)<=minimo(p)?'ojo':'bien'):'')+'">'+(p.estado==='ACTIVO'?(p.control_stock!==false&&existencia(p.id)<=minimo(p)?'Reponer':'Activo'):'Inactivo')+'</span></button>').join(''):'<p class="empty">No hay productos para mostrar.</p>';
   document.querySelectorAll('[data-prod]').forEach(b=>b.onclick=()=>productoForm(productos.find(p=>p.id===b.dataset.prod)));
  };
  $('#buscarp').oninput=pintar;$('#inactivos').onchange=pintar;pintar();
 }
 async function productoForm(p){
  dlg.innerHTML='<form id="pf"><h2>'+(p?'Editar':'Nuevo')+' producto</h2><label>Nombre</label><input name="nombre" required maxlength="120" value="'+esc(p?.nombre||'')+'"><label>Categoría</label><input name="categoria" maxlength="80" value="'+esc(p?.categoria||'')+'"><label>Descripción</label><textarea name="descripcion" rows="2">'+esc(p?.descripcion||'')+'</textarea><label>Costo de referencia</label><input name="costo_unitario" type="number" min="0" step="0.01" required value="'+Number(p?.costo_unitario||0)+'"><label>Precio de venta</label><input name="precio_venta" type="number" min="0" step="0.01" required value="'+Number(p?.precio_venta||0)+'"><label>Stock mínimo</label><input name="stock_minimo" type="number" min="0" step="0.01" value="'+Number(p?.stock_minimo||0)+'"><label class="chk"><input name="control_stock" type="checkbox" '+(p?.control_stock===false?'':'checked')+'> Controlar existencias</label><div class="acts"><button type="button" class="btn sec" id="cx">Cancelar</button><button class="btn">Guardar producto</button></div>'+(p?'<button type="button" class="btn sec block" id="estado">'+(p.estado==='ACTIVO'?'Desactivar':'Reactivar')+'</button>':'')+'</form>';
  dlg.showModal();$('#cx').onclick=()=>dlg.close();let busy=false;
  $('#pf').onsubmit=async e=>{e.preventDefault();if(busy)return;const f=Object.fromEntries(new FormData(e.target));const costo=Number(f.costo_unitario),precio=Number(f.precio_venta),min=Number(f.stock_minimo||0);
   if(!Number.isFinite(costo)||costo<0||!Number.isFinite(precio)||precio<0||!Number.isFinite(min)||min<0)return toast('Verifica los costos, precios y stock mínimo.',true);
   const data={nombre:f.nombre.trim(),categoria:f.categoria.trim()||null,descripcion:f.descripcion.trim()||null,costo_unitario:costo,precio_venta:precio,stock_minimo:min,control_stock:!!f.control_stock};
   busy=true;const b=e.target.querySelector('button[type="submit"],button:not([type])');if(b)b.disabled=true;
   const q=p?sb.from('productos').update(data).eq('id',p.id).eq('negocio_id',nid()):sb.from('productos').insert({...data,negocio_id:nid(),estado:'ACTIVO'});
   const{error:e1}=await q;if(e1){busy=false;if(b)b.disabled=false;return error(e1)}dlg.close();toast('Producto guardado');productosVista();
  };
  if(p)$('#estado').onclick=async()=>{const b=$('#estado');if(b.disabled)return;b.disabled=true;const{error:e1}=await sb.from('productos').update({estado:p.estado==='ACTIVO'?'INACTIVO':'ACTIVO'}).eq('id',p.id).eq('negocio_id',nid());if(e1){b.disabled=false;return error(e1)}dlg.close();productosVista()};
 }
 async function proveedorForm(p){
  dlg.innerHTML='<form id="vf"><h2>'+(p?'Editar':'Nuevo')+' proveedor</h2><label>Nombre o razón social</label><input name="nombre" required maxlength="140" value="'+esc(p?.nombre||'')+'"><label>NIT / documento</label><input name="documento" value="'+esc(p?.documento||'')+'"><label>Contacto</label><input name="contacto" value="'+esc(p?.contacto||'')+'"><label>Teléfono</label><input name="telefono" type="tel" value="'+esc(p?.telefono||'')+'"><label>Correo</label><input name="correo" type="email" value="'+esc(p?.correo||'')+'"><label>Dirección</label><input name="direccion" value="'+esc(p?.direccion||'')+'"><label>Observaciones</label><textarea name="observaciones" rows="2">'+esc(p?.observaciones||'')+'</textarea><div class="acts"><button type="button" class="btn sec" id="cx">Cancelar</button><button class="btn">Guardar proveedor</button></div>'+(p?'<button type="button" class="btn sec block" id="estado">'+(p.estado==='ACTIVO'?'Desactivar':'Reactivar')+'</button>':'')+'</form>';
  dlg.showModal();$('#cx').onclick=()=>dlg.close();let busy=false;
  $('#vf').onsubmit=async e=>{e.preventDefault();if(busy)return;const f=Object.fromEntries(new FormData(e.target));const data={nombre:f.nombre.trim(),documento:f.documento.trim()||null,contacto:f.contacto.trim()||null,telefono:f.telefono.trim()||null,correo:f.correo.trim()||null,direccion:f.direccion.trim()||null,observaciones:f.observaciones.trim()||null};
   busy=true;const b=e.target.querySelector('button[type="submit"],button:not([type])');if(b)b.disabled=true;
   const q=p?sb.from('proveedores_inventario').update(data).eq('id',p.id).eq('negocio_id',nid()):sb.from('proveedores_inventario').insert({...data,negocio_id:nid(),estado:'ACTIVO'});
   const{error:e1}=await q;if(e1){busy=false;if(b)b.disabled=false;return error(e1)}dlg.close();toast('Proveedor guardado');render();
  };
  if(p)$('#estado').onclick=async()=>{const b=$('#estado');b.disabled=true;const{error:e1}=await sb.from('proveedores_inventario').update({estado:p.estado==='ACTIVO'?'INACTIVO':'ACTIVO'}).eq('id',p.id).eq('negocio_id',nid());if(e1){b.disabled=false;return error(e1)}dlg.close();render()};
 }
 async function compraForm(){
  if(!await cargarBase())return;
  const ps=productos.filter(p=>p.estado==='ACTIVO');
  const vs=proveedores.filter(p=>p.estado==='ACTIVO');
  if(!ps.length)return toast('Primero registra un producto activo.',true);
  if(!vs.length)return toast('Primero registra un proveedor activo.',true);
  const option=ps.map(p=>'<option value="'+p.id+'" data-cost="'+Number(p.costo_unitario||0)+'">'+esc(p.nombre)+'</option>').join('');
  const line=()=>'<div class="ln cl"><select aria-label="Producto">'+option+'</select><input type="number" min="0.01" step="0.01" value="1" aria-label="Cantidad"><input type="number" min="0" step="0.01" value="'+Number(ps[0].costo_unitario||0)+'" aria-label="Costo unitario"><button type="button" class="btn sec rm">×</button></div>';
  dlg.innerHTML='<form id="cf"><h2>Registrar compra</h2><label>Proveedor</label><select name="proveedor_id" required>'+vs.map(v=>'<option value="'+v.id+'">'+esc(v.nombre)+'</option>').join('')+'</select><label>Fecha de compra</label><input name="fecha_compra" type="date" required value="'+new Date().toISOString().slice(0,10)+'"><label>Productos comprados</label><div id="clines">'+line()+'</div><button type="button" class="link" id="addline">Agregar producto</button><p class="tot" id="ctotal">Total: $0</p><label>Valor pagado ahora</label><input name="valor_pagado" type="number" min="0" step="0.01" value="0" required><label>Método de pago</label><select name="metodo_pago">'+metodos.map(m=>'<option>'+m+'</option>').join('')+'</select><label>Referencia de pago</label><input name="referencia" maxlength="120"><label>Observaciones</label><textarea name="observaciones" rows="2"></textarea><div class="acts"><button type="button" class="btn sec" id="cx">Cancelar</button><button class="btn">Guardar compra e ingresar stock</button></div></form>';
  dlg.showModal();$('#cx').onclick=()=>dlg.close();
  const calc=()=>[...document.querySelectorAll('#clines .cl')].reduce((a,l)=>a+Number(l.querySelectorAll('input')[0].value)*Number(l.querySelectorAll('input')[1].value),0);
  $('#clines').onchange=e=>{if(e.target.tagName==='SELECT'){const p=ps.find(x=>x.id===e.target.value);e.target.closest('.cl').querySelectorAll('input')[1].value=Number(p?.costo_unitario||0)}ref()};
  $('#clines').oninput=ref;function ref(){$('#ctotal').textContent='Total: '+dinero(calc())}
  $('#clines').onclick=e=>{if(e.target.classList.contains('rm')){e.target.closest('.cl').remove();ref()}};
  $('#addline').onclick=()=>{$('#clines').insertAdjacentHTML('beforeend',line());ref()};ref();
  let busy=false;
  $('#cf').onsubmit=async e=>{e.preventDefault();if(busy)return;const f=Object.fromEntries(new FormData(e.target));const detalles=[...document.querySelectorAll('#clines .cl')].map(l=>({producto_id:l.querySelector('select').value,cantidad:Number(l.querySelectorAll('input')[0].value),costo_unitario:Number(l.querySelectorAll('input')[1].value)}));
   const total=calc(),pagado=Number(f.valor_pagado);
   if(!detalles.length||detalles.some(x=>!x.producto_id||!Number.isFinite(x.cantidad)||x.cantidad<=0||!Number.isFinite(x.costo_unitario)||x.costo_unitario<0)||!Number.isFinite(total)||!Number.isFinite(pagado)||pagado<0||pagado>total)return toast('Revisa productos, cantidades, costos y pago. El abono no puede superar el total.',true);
   const{data:caja,error:errorCaja}=await sb.from('cajas').select('id').eq('negocio_id',nid()).eq('estado_caja','ABIERTA').maybeSingle();if(errorCaja)return error(errorCaja);
   busy=true;const b=e.target.querySelector('button[type="submit"],button:not([type])');if(b)b.disabled=true;
   const{data,error:e1}=await sb.rpc('registrar_compra_inventario',{p_proveedor_id:f.proveedor_id,p_fecha_compra:f.fecha_compra,p_detalles:detalles,p_valor_pagado:pagado,p_metodo_pago:f.metodo_pago,p_referencia:f.referencia||null,p_observaciones:f.observaciones||null,p_caja_id:caja?.id||null});
   if(e1){busy=false;if(b)b.disabled=false;return error(e1)}dlg.close();toast('Compra registrada e inventario actualizado');render();
  };
 }
 async function comprasVista(){
  const{data,error:e1}=await sb.from('compras_inventario').select('*,proveedores_inventario(nombre)').eq('negocio_id',nid()).order('fecha_compra',{ascending:false}).limit(100);
  if(e1)return error(e1);
  $('#main').innerHTML='<div class="head"><h2>Compras a proveedores</h2><button class="btn" id="nc">Registrar compra</button></div>'+tabs()+
   (data.length?data.map(c=>'<button class="row" data-compra="'+c.id+'"><span><strong>'+esc(c.proveedores_inventario?.nombre||'Proveedor')+'</strong><br><small>'+fecha(c.fecha_compra)+' · '+dinero(c.total_compra)+' · Pagado '+dinero(c.total_pagado)+' · Saldo '+dinero(c.saldo_pendiente)+'</small></span><span class="chip '+(c.estado_compra==='PAGADA'?'bien':c.estado_compra==='ANULADA'?'mal':'ojo')+'">'+esc(c.estado_compra)+'</span></button>').join(''):'<p class="empty">Aún no hay compras registradas.</p>');
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
  $('#pc').onsubmit=async e=>{e.preventDefault();if(busy)return;const f=Object.fromEntries(new FormData(e.target)),v=Number(f.valor);if(!Number.isFinite(v)||v<=0||v>Number(c.saldo_pendiente))return toast('El abono debe ser mayor que cero y no superar el saldo.',true);const{data:caja,error:errorCaja}=await sb.from('cajas').select('id').eq('negocio_id',nid()).eq('estado_caja','ABIERTA').maybeSingle();if(errorCaja)return error(errorCaja);busy=true;const b=e.target.querySelector('button[type="submit"],button:not([type])');if(b)b.disabled=true;const{error:e1}=await sb.rpc('registrar_pago_compra_inventario',{p_compra_id:c.id,p_valor_pago:v,p_metodo_pago:f.metodo,p_referencia:f.referencia||null,p_observaciones:f.observaciones||null,p_caja_id:caja?.id||null});if(e1){busy=false;if(b)b.disabled=false;return error(e1)}dlg.close();toast('Abono registrado');render()};
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
 async function render(){if(!rol())return toast('No tienes permisos para gestionar productos e inventario.',true);if(vista==='productos')return productosVista();if(vista==='compras')return comprasVista();if(vista==='proveedores')return proveedoresVista();return movimientosVista()}
 return { productos:()=>{vista='productos';return render()} };
}
