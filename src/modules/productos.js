// Gestión profesional del inventario patrimonial, comercial y operativo.
export function crearModuloProductos(deps) {
 const { $, dlg, sb, S, esc, dinero, traducir, toast } = deps;
 const rol=()=>['ADMINISTRADOR','SUPERVISOR'].includes(S.perfil.rol);
 const nid=()=>S.perfil.negocio_id;
  let vista='productos',productos=[],stock=[],presentaciones=[];
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
   sb.from('presentaciones_producto').select('*').eq('negocio_id',nid()).order('unidades')
  ]);
  const fallo=rs.find(x=>x.error);if(fallo){error(fallo.error);return false}
  productos=rs[0].data||[];stock=rs[1].data||[];presentaciones=rs[2].data||[];return true;
 };
 const existencia=id=>Number(stock.find(x=>x.producto_id===id)?.existencias||0);
 const minimo=p=>Number(p.stock_minimo??stock.find(x=>x.producto_id===p.id)?.stock_minimo??0);
 const objetivo=p=>Number(p.stock_objetivo||0);
 const tabs=()=>'<div class="product-tabs"><button class="btn '+(vista==='productos'?'':'sec')+'" data-tab="productos">Inventario</button><button class="btn '+(vista==='movimientos'?'':'sec')+'" data-tab="movimientos">Movimientos</button></div>';
 async function productosVista(){
  if(!await cargarBase())return;
  const activos=productos.filter(p=>p.estado==='ACTIVO'),agotados=productos.filter(p=>p.control_stock!==false&&existencia(p.id)<=0).length,bajos=productos.filter(p=>p.control_stock!==false&&existencia(p.id)>0&&existencia(p.id)<=minimo(p)).length;
  const valorExistencias=productos.filter(p=>p.tipo_inventario!=='EQUIPO').reduce((a,p)=>a+existencia(p.id)*Number(p.costo_unitario||0),0),valorEquipos=productos.filter(p=>p.tipo_inventario==='EQUIPO').reduce((a,p)=>a+Number(p.valor_actual||p.costo_unitario||0)*existencia(p.id),0),valor=valorExistencias+valorEquipos,ventas=productos.filter(p=>p.vendible!==false&&p.tipo_inventario!=='EQUIPO'),insumos=productos.filter(p=>p.tipo_inventario==='INSUMO'),equipos=productos.filter(p=>p.tipo_inventario==='EQUIPO');
  $('#main').innerHTML='<section class="inventory-shell"><header class="inventory-header"><div><span class="inventory-eyebrow">GESTIÓN Y CONTROL DEL NEGOCIO</span><h2>Inventario</h2><p>Controla lo que tienes, lo que se acaba y cuánto vale tu inventario.</p></div><button class="btn inventory-primary" id="np"><span>＋</span> Nuevo producto</button></header>'+tabs()+
   '<section class="inventory-overview"><article class="inventory-total"><div><span class="inventory-eyebrow">VALOR TOTAL INVENTARIADO</span><strong>'+dinero(valor)+'</strong><small>Estimación del valor de tus existencias y equipos</small></div><span class="inventory-total-icon">▦</span></article><div class="inventory-stats"><article><span class="inventory-stat-icon blue">▣</span><div><small>Artículos activos</small><strong>'+activos.length+'</strong></div></article><article><span class="inventory-stat-icon green">↗</span><div><small>Para la venta</small><strong>'+ventas.length+'</strong></div></article><article><span class="inventory-stat-icon violet">▤</span><div><small>Insumos</small><strong>'+insumos.length+'</strong></div></article><article><span class="inventory-stat-icon amber">⚒</span><div><small>Equipos</small><strong>'+equipos.length+'</strong></div></article><article><span class="inventory-stat-icon red">!</span><div><small>Por reponer</small><strong>'+bajos+'</strong></div></article></div><div class="inventory-value-split"><span>Productos e insumos <strong>'+dinero(valorExistencias)+'</strong></span><span>Equipos y herramientas <strong>'+dinero(valorEquipos)+'</strong></span></div></section>'+
   '<section class="inventory-quick-actions"><div><strong>Acciones de inventario</strong><small>Cuando compras mercancía, la registras aquí.</small></div><div><button class="btn" id="nc">＋ Entrada de mercancía</button><button class="btn sec" id="na">Ajustar o regalar</button></div></section>'+
   '<section class="inventory-list-panel"><div class="inventory-list-heading"><div><h3>Artículos registrados</h3><p>Consulta existencias, costos y rentabilidad de cada artículo.</p></div></div><div class="inventory-tools"><label class="inventory-search"><span>⌕</span><input id="buscarp" type="search" placeholder="Buscar por nombre o categoría" aria-label="Buscar artículo"></label><label class="inventory-filter"><span>Tipo de artículo</span><select id="tipoFiltro" aria-label="Filtrar tipo"><option value="TODOS">Todos los tipos</option><option value="PRODUCTO_VENTA">Productos para la venta</option><option value="INSUMO">Materiales e insumos</option><option value="EQUIPO">Equipos y herramientas</option></select></label><label class="chk inventory-inactive"><input type="checkbox" id="inactivos"> Mostrar inactivos</label></div><div id="listap"></div></section></section>';
  $('#np').onclick=()=>productoForm();$('#nc').onclick=()=>entradaForm();$('#na').onclick=()=>ajusteForm();
  document.querySelectorAll('[data-tab]').forEach(b=>b.onclick=()=>{vista=b.dataset.tab;render()});
  const pintar=()=>{const q=$('#buscarp').value.trim().toLocaleLowerCase(),inac=$('#inactivos').checked;
   const tipo=$('#tipoFiltro').value,lista=productos.filter(p=>(inac||p.estado==='ACTIVO')&&(tipo==='TODOS'||(p.tipo_inventario||'PRODUCTO_VENTA')===tipo)&&(p.nombre+' '+(p.categoria||'')+' '+tipoNombre(p.tipo_inventario)).toLocaleLowerCase().includes(q));
   $('#listap').innerHTML=lista.length?`<div class="product-grid">${lista.map(p=>`<button class="product-card" data-prod="${p.id}"><div class="product-card-image">${p.imagen_url?`<img loading="lazy" src="${esc(p.imagen_url)}" alt="${esc(p.nombre)}">`:'<span>Sin fotografía</span>'}</div><div class="product-card-body"><span class="product-category">${esc(tipoNombre(p.tipo_inventario))} · ${esc(p.categoria||'Sin categoría')}</span><strong>${esc(p.nombre)}</strong><span class="product-price">${p.vendible===false?'No vendible':dinero(p.precio_venta)}</span><small>Disponible: ${existencia(p.id)} ${esc(p.unidad_medida||'unidades')} · Costo unitario: ${dinero(p.costo_unitario)}</small><small>${p.vendible===false?'Uso interno':'Utilidad/unidad: '+dinero(utilidad(p))+' · Margen: '+margen(p).toFixed(1)+'%'}</small><span class="chip ${p.estado==='ACTIVO'?(p.control_stock!==false&&existencia(p.id)<=minimo(p)?'ojo':'bien'):''}">${p.estado==='ACTIVO'?(p.control_stock!==false&&existencia(p.id)<=minimo(p)?'Reponer':'Activo'):'Inactivo'}</span></div></button>`).join('')}</div>`:'<div class="services-empty"><span>▦</span><strong>Tu inventario está listo para comenzar</strong><p>Registra productos para vender, materiales de trabajo o equipos. La fotografía es opcional y podrás organizar todo por categorías.</p><button class="btn" type="button" id="empty-new-item">Registrar primer producto</button></div>';
   document.querySelectorAll('[data-prod]').forEach(b=>b.onclick=()=>productoForm(productos.find(p=>p.id===b.dataset.prod)));const emptyNew=$('#empty-new-item');if(emptyNew)emptyNew.onclick=()=>productoForm();
  };
  $('#buscarp').oninput=pintar;$('#tipoFiltro').onchange=pintar;$('#inactivos').onchange=pintar;pintar();
 }
 async function productoForm(p){
  const usoDe=x=>!x?'VENTA':x.tipo_inventario==='EQUIPO'?'EQUIPO':x.tipo_inventario==='INSUMO'?'INSUMO':(x.vendible===false&&x.regalable)?'REGALO':'VENTA';
  const uso0=usoDe(p),nuevo=!p;
  dlg.innerHTML='<form id="pf" class="inventory-form"><h2>'+(p?'Editar producto':'Nuevo producto')+'</h2>'+
   '<label>Nombre</label><input name="nombre" required maxlength="120" placeholder="Ej. Agua 600 ml" value="'+esc(p?.nombre||'')+'">'+
   '<label>¿Qué es?</label><select name="uso"><option value="VENTA">Lo vendo a los clientes</option><option value="REGALO">Lo regalo a los clientes</option><option value="INSUMO">Lo uso en el trabajo (insumo)</option><option value="EQUIPO">Herramienta o equipo</option></select>'+
   '<section id="bloque-costo"><label id="lbl-modo">¿Cómo lo compras?</label><select name="modo"><option value="UNIDAD">Por unidad</option><option value="PACA">Por paca o caja</option></select>'+
   '<div id="modo-unidad"><label id="lbl-costo">¿Cuánto te cuesta cada una? ($)</label><input name="costo_unitario" type="number" min="0" step="0.01" inputmode="decimal" required value="'+Number(p?.costo_unitario||0)+'"></div>'+
   '<div id="modo-paca" hidden><label>¿Cuánto pagas por la paca o caja? ($)</label><input name="costo_paca" type="number" min="0" step="0.01" inputmode="decimal" placeholder="Ej. 14000"><label>¿Cuántas unidades trae?</label><input name="pres_unidades" type="number" min="1" step="1" inputmode="numeric" placeholder="Ej. 20"><p id="calc-paca" class="tot" aria-live="polite"></p></div></section>'+
   '<section id="bloque-precio"><label>¿A cuánto lo vendes? ($)</label><input name="precio_venta" type="number" min="0" step="0.01" inputmode="decimal" value="'+Number(p?.precio_venta||0)+'"><div id="precio-sugerido" aria-live="polite"></div><div class="inventory-profit-preview" id="profit-preview" aria-live="polite"></div></section>'+
   (nuevo?'<label id="lbl-stock">¿Cuántas unidades tienes hoy?</label><input name="stock_inicial" type="number" min="0" step="1" inputmode="numeric" value="0"><small class="mute">Si aún no tienes, déjalo en 0 y luego usa «Entrada de mercancía».</small>':'')+
   '<section id="bloque-minimo"><label>Avísame cuando queden… <span class="mute">(unidades)</span></label><input name="stock_minimo" type="number" min="0" step="1" inputmode="numeric" value="'+Number(p?.stock_minimo||0)+'"></section>'+
   '<details class="mas-opciones" style="margin:12px 0"><summary>Más opciones</summary><label>Categoría</label><input name="categoria" maxlength="80" value="'+esc(p?.categoria||'')+'"><label>Descripción</label><textarea name="descripcion" rows="2">'+esc(p?.descripcion||'')+'</textarea><label>Fotografía <span class="mute">(opcional)</span></label><div class="product-photo-preview">'+(p?.imagen_url?'<img src="'+esc(p.imagen_url)+'" alt="Foto actual de '+esc(p.nombre)+'">':'<span>Sin fotografía</span>')+'</div><input name="imagen" type="file" accept="image/jpeg,image/png,image/webp"><small class="mute">JPG, PNG o WEBP · máximo 5 MB.</small><label>Unidad de control</label><input name="unidad_medida" maxlength="30" value="'+esc(p?.unidad_medida||'unidad')+'" placeholder="unidad, botella, caja..."><label>Stock ideal <span class="mute">(cuánto quieres tener)</span></label><input name="stock_objetivo" type="number" min="0" step="1" value="'+Math.max(Number(p?.stock_objetivo||0),Number(p?.stock_minimo||0))+'"><label class="chk"><input name="control_stock" type="checkbox" '+(p?.control_stock===false?'':'checked')+'> Llevar control de existencias</label></details>'+
   '<div class="acts"><button type="button" class="btn sec" id="cx">Cancelar</button><button class="btn">Guardar</button></div>'+(p?'<button type="button" class="btn sec block" id="estado">'+(p.estado==='ACTIVO'?'Desactivar':'Reactivar')+'</button>':'')+'</form>';
  dlg.showModal();$('#cx').onclick=()=>dlg.close();let busy=false;
  const q=n=>$('#pf [name="'+n+'"]'),usoI=q('uso'),modoI=q('modo'),costoI=q('costo_unitario'),precioI=q('precio_venta'),cpI=q('costo_paca'),upI=q('pres_unidades'),archivo=q('imagen');
  usoI.value=uso0;
  const pintarRent=()=>{const c=Number(costoI.value)||0,v=Number(precioI.value)||0,u=v-c,m=v>0?u/v*100:0;$('#profit-preview').innerHTML=v>0?'<div>Ganas <b>'+dinero(u)+'</b> por cada una vendida · Margen <b>'+m.toFixed(1)+'%</b></div>'+(u<0?'<small class="mute">⚠ Estás vendiendo por debajo de lo que te cuesta.</small>':''):''};
  const sugerir=()=>{const c=Number(costoI.value)||0;$('#precio-sugerido').innerHTML=c>0?'<small class="mute">Toca un precio sugerido (según lo que quieras ganar):</small><div>'+[30,40,50].map(m=>{const pr=Math.ceil(Math.round(c/(1-m/100)*100)/100/50-1e-9)*50;return '<button type="button" class="btn sec" data-pr="'+pr+'" style="margin:4px 6px 0 0">Ganar '+m+'% → '+dinero(pr)+'</button>'}).join('')+'</div>':''};
  const desdePaca=()=>{if(modoI.value!=='PACA')return;const cp=Number(cpI.value),u=Number(upI.value),ok=cp>0&&u>0;if(ok){costoI.value=Math.round(cp/u*100)/100;$('#calc-paca').textContent='Cada unidad te cuesta '+dinero(cp/u)}else{$('#calc-paca').textContent=''}sugerir();pintarRent()};
  const sincronizar=()=>{const uso=usoI.value,venta=uso==='VENTA',equipo=uso==='EQUIPO',paca=modoI.value==='PACA'&&!equipo;
   $('#bloque-precio').hidden=!venta;$('#bloque-minimo').hidden=equipo;$('#modo-paca').hidden=!paca;$('#modo-unidad').hidden=paca;$('#lbl-modo').hidden=equipo;modoI.hidden=equipo;
   $('#lbl-costo').textContent=equipo?'¿Cuánto costó? ($)':'¿Cuánto te cuesta cada una? ($)';costoI.required=!paca;
   const ls=$('#lbl-stock');if(ls)ls.textContent=equipo?'¿Cuántos tienes?':'¿Cuántas unidades tienes hoy?';
   if(paca)desdePaca();else{sugerir();pintarRent()}};
  usoI.onchange=sincronizar;modoI.onchange=sincronizar;cpI.oninput=desdePaca;upI.oninput=desdePaca;costoI.oninput=()=>{sugerir();pintarRent()};precioI.oninput=pintarRent;
  $('#precio-sugerido').onclick=e=>{const b=e.target.closest('[data-pr]');if(!b)return;precioI.value=b.dataset.pr;pintarRent()};
  sincronizar();
  archivo.onchange=()=>{const f=archivo.files?.[0];if(!f)return;if(!['image/jpeg','image/png','image/webp'].includes(f.type)||f.size>5242880){archivo.value='';return toast('La imagen debe ser JPG, PNG o WEBP y pesar máximo 5 MB.',true)}const url=URL.createObjectURL(f);$('.product-photo-preview').innerHTML='<img src="'+url+'" alt="Vista previa del producto">'};
  $('#pf').onsubmit=async e=>{e.preventDefault();if(busy)return;const f=Object.fromEntries(new FormData(e.target)),uso=f.uso||'VENTA',equipo=uso==='EQUIPO',pacaOk=f.modo==='PACA'&&!equipo,presU=Number(f.pres_unidades),presC=Number(f.costo_paca);
   if(pacaOk&&!(presC>0&&presU>0))return toast('Escribe cuánto pagas por la paca y cuántas unidades trae.',true);
   const costo=pacaOk?Math.round(presC/presU*100)/100:Number(f.costo_unitario),precio=Number(f.precio_venta||0),min=equipo?0:Number(f.stock_minimo||0),stockIni=nuevo?Number(f.stock_inicial||0):0,imagen=f.imagen,controla=!!f.control_stock;let ideal=Number(f.stock_objetivo||0);
   if(!Number.isFinite(costo)||costo<0||!Number.isFinite(precio)||precio<0||!Number.isFinite(min)||min<0||!Number.isFinite(ideal)||!Number.isFinite(stockIni)||stockIni<0)return toast('Revisa los valores: no pueden ser negativos.',true);
   if(uso==='VENTA'&&precio<=0)return toast('Escribe el precio al que lo vendes.',true);
   if(ideal<min)ideal=min;
   if(imagen?.size&&(!['image/jpeg','image/png','image/webp'].includes(imagen.type)||imagen.size>5242880))return toast('La imagen debe ser JPG, PNG o WEBP y pesar máximo 5 MB.',true);
   const tipo=uso==='EQUIPO'?'EQUIPO':uso==='INSUMO'?'INSUMO':'PRODUCTO_VENTA',vendible=uso==='VENTA';
   const data={nombre:f.nombre.trim(),categoria:(f.categoria||'').trim()||null,descripcion:(f.descripcion||'').trim()||null,tipo_inventario:tipo,unidad_medida:(f.unidad_medida||'').trim()||'unidad',vendible,valor_actual:equipo?costo:0,costo_unitario:costo,regalable:uso==='REGALO',precio_venta:vendible?precio:0,stock_minimo:min,stock_objetivo:ideal,control_stock:controla};
   busy=true;const b=e.target.querySelector('button[type="submit"],button:not([type])');if(b)b.disabled=true;
   const libre=()=>{busy=false;if(b)b.disabled=false};
   let productoId=p?.id;
   if(p){const{error:e1}=await sb.from('productos').update(data).eq('id',p.id).eq('negocio_id',nid());if(e1){libre();return error(e1)}}
   else{const{data:creado,error:e1}=await sb.from('productos').insert({...data,negocio_id:nid(),estado:'ACTIVO'}).select('id').single();if(e1){libre();return error(e1)}productoId=creado.id}
   if(pacaOk){const{error:ep}=await sb.from('presentaciones_producto').upsert({negocio_id:nid(),producto_id:productoId,nombre:'Paca x'+presU,unidades:presU,ultimo_costo:presC},{onConflict:'producto_id,nombre'});if(ep)toast('Producto guardado, pero no se pudo recordar la paca: '+ep.message,true)}
   if(nuevo&&stockIni>0&&controla){const{error:ei}=await sb.rpc('registrar_entrada_inventario',{p_items:[{producto_id:productoId,cantidad:stockIni,costo_unitario:costo}],p_nota:'Existencias iniciales'});if(ei)toast('Producto guardado, pero no se pudieron cargar las existencias: '+traducir(ei.message)+' Usa «Entrada de mercancía».',true)}
   if(imagen?.size){
    const ext=imagen.type==='image/png'?'png':imagen.type==='image/webp'?'webp':'jpg',ruta=nid()+'/'+productoId+'/'+crypto.randomUUID()+'.'+ext;
    const up=await sb.storage.from('productos').upload(ruta,imagen,{contentType:imagen.type,upsert:true});
    if(up.error){libre();return toast('Producto guardado, pero no se pudo subir la fotografía: '+up.error.message,true)}
    const{data:publica}=sb.storage.from('productos').getPublicUrl(ruta);
    const{error:e1}=await sb.from('productos').update({imagen_url:publica.publicUrl}).eq('id',productoId).eq('negocio_id',nid());
    if(e1){libre();return error(e1)}
   }
   dlg.close();toast('Producto guardado');productosVista();
  };
  if(p)$('#estado').onclick=async()=>{const b=$('#estado');if(b.disabled)return;b.disabled=true;const{error:e1}=await sb.from('productos').update({estado:p.estado==='ACTIVO'?'INACTIVO':'ACTIVO'}).eq('id',p.id).eq('negocio_id',nid());if(e1){b.disabled=false;return error(e1)}dlg.close();productosVista()};
 }
 async function entradaForm(){
  if(!await cargarBase())return;
  const ps=productos.filter(p=>p.estado==='ACTIVO'&&p.control_stock!==false);
  if(!ps.length)return toast('Primero registra un producto para poder darle entrada.',true);
  const option=ps.map(p=>'<option value="'+p.id+'">'+esc(p.nombre)+' · hay '+existencia(p.id)+'</option>').join('');
  const presOpts=pid=>'<option value="unidad">Por unidad</option>'+presentaciones.filter(x=>x.producto_id===pid).map(x=>'<option value="'+x.id+'">'+esc(x.nombre)+' ('+Number(x.unidades)+' und)</option>').join('')+'<option value="otra">Otra paca o caja…</option>';
  const line=()=>'<div class="inventory-purchase-line cl"><label>Producto<select class="pr-prod" aria-label="Producto">'+option+'</select></label><label>¿Cómo llegó?<select class="pr-pres" aria-label="Presentación">'+presOpts(ps[0].id)+'</select></label><label class="pr-otra" style="display:none">¿Cuántas unidades trae?<input class="pr-unid" type="number" min="1" step="1" value="1" aria-label="Unidades que trae"></label><label>¿Cuántas llegaron?<input class="pr-cant" type="number" min="0.001" step="0.001" value="1" aria-label="Cantidad"></label><label>Costo de cada una ($)<input class="pr-costo" type="number" min="0" step="0.01" value="0" aria-label="Costo"></label><button type="button" class="btn sec rm" aria-label="Quitar línea">×</button><small class="package-calc" style="grid-column:1/-1"></small></div>';
  dlg.innerHTML='<form id="cf"><h2>Entrada de mercancía</h2><p class="mute">Registra lo que compraste. El inventario sube y el costo se actualiza solo.</p><div id="clines">'+line()+'</div><button type="button" class="link" id="addline">＋ Agregar otro producto</button><p class="tot" id="ctotal"></p><label>Nota <span class="mute">(opcional)</span></label><input name="nota" maxlength="120" placeholder="Ej. Compra del sábado"><div class="acts"><button type="button" class="btn sec" id="cx">Cancelar</button><button class="btn">Guardar entrada</button></div></form>';
  dlg.showModal();$('#cx').onclick=()=>dlg.close();
  const filas=()=>[...document.querySelectorAll('#clines .cl')];
  const detalleLinea=l=>{const p=ps.find(x=>x.id===l.querySelector('.pr-prod').value),v=l.querySelector('.pr-pres').value,pr=presentaciones.find(x=>x.id===v),otra=v==='otra',unidades=otra?Number(l.querySelector('.pr-unid').value):pr?Number(pr.unidades):1,paquetes=Number(l.querySelector('.pr-cant').value),costoPaquete=Number(l.querySelector('.pr-costo').value);return{producto_id:p?.id,cantidad:paquetes*unidades,costo_unitario:unidades>0?costoPaquete/unidades:0,total:paquetes*costoPaquete,unidades,costoPaquete,p,pr,otra}};
  const aplicarPres=(l,reiniciar)=>{const p=ps.find(x=>x.id===l.querySelector('.pr-prod').value),v=l.querySelector('.pr-pres').value,otra=v==='otra',unidad=v==='unidad';l.querySelectorAll('.pr-otra').forEach(x=>x.style.display=otra?'':'none');const lc=l.querySelector('.pr-costo').parentNode.firstChild;lc.textContent=unidad?'Costo de cada una ($)':'Costo de cada paca o caja ($)';if(!reiniciar||otra)return;const pr=presentaciones.find(x=>x.id===v),base=Number(p?.costo_unitario||0);l.querySelector('.pr-costo').value=pr?(pr.ultimo_costo!=null?Number(pr.ultimo_costo):Math.round(base*Number(pr.unidades)*100)/100):base};
  function ref(){let total=0;filas().forEach(l=>{const d=detalleLinea(l);total+=Number.isFinite(d.total)?d.total:0;l.querySelector('.package-calc').textContent='Entran '+(Number.isFinite(d.cantidad)?d.cantidad:0)+' '+(d.p?.unidad_medida||'unidades')+' · Cada una te cuesta '+dinero(Number.isFinite(d.costo_unitario)?d.costo_unitario:0)+' · Total '+dinero(Number.isFinite(d.total)?d.total:0)+(d.p&&Number(d.p.precio_venta)>0&&d.costo_unitario>=Number(d.p.precio_venta)?' ⚠ Cuesta igual o más que el precio de venta ('+dinero(d.p.precio_venta)+')':'')});$('#ctotal').textContent='Total de la compra: '+dinero(total)}
  $('#clines').onchange=e=>{const l=e.target.closest('.cl');if(!l)return;if(e.target.classList.contains('pr-prod')){l.querySelector('.pr-pres').innerHTML=presOpts(e.target.value);aplicarPres(l,true)}else if(e.target.classList.contains('pr-pres'))aplicarPres(l,true);ref()};
  $('#clines').oninput=ref;
  $('#clines').onclick=e=>{if(e.target.classList.contains('rm')&&filas().length>1){e.target.closest('.cl').remove();ref()}};
  $('#addline').onclick=()=>{$('#clines').insertAdjacentHTML('beforeend',line());aplicarPres(filas().slice(-1)[0],true);ref()};filas().forEach(l=>aplicarPres(l,true));ref();
  let busy=false;
  $('#cf').onsubmit=async e=>{e.preventDefault();if(busy)return;const f=Object.fromEntries(new FormData(e.target)),ls=filas().map(detalleLinea);
   if(!ls.length||ls.some(d=>!d.producto_id||!Number.isFinite(d.cantidad)||d.cantidad<=0||!Number.isFinite(d.costo_unitario)||d.costo_unitario<0||(d.otra&&!(d.unidades>0))))return toast('Revisa cantidades y costos.',true);
   busy=true;const b=e.target.querySelector('button[type="submit"],button:not([type])');if(b)b.disabled=true;
   const items=ls.map(d=>({producto_id:d.producto_id,cantidad:d.cantidad,costo_unitario:d.costo_unitario})),nota=(f.nota||'').trim()||null;
   const{error:e1}=await sb.rpc('registrar_entrada_inventario',{p_items:items,p_nota:nota});
   if(e1){busy=false;if(b)b.disabled=false;return error(e1)}
   for(const d of ls){try{if(d.otra)await sb.from('presentaciones_producto').upsert({negocio_id:nid(),producto_id:d.producto_id,nombre:'Paca x'+d.unidades,unidades:d.unidades,ultimo_costo:Math.round(d.costoPaquete*100)/100},{onConflict:'producto_id,nombre'});else if(d.pr)await sb.from('presentaciones_producto').update({ultimo_costo:Math.round(d.costoPaquete*100)/100}).eq('id',d.pr.id).eq('negocio_id',nid())}catch{}}
   dlg.close();toast('Entrada registrada: el inventario ya está actualizado');vista='productos';render();
  };
 }
 async function ajusteForm(){
  if(!await cargarBase())return;
  const lista=productos.filter(p=>p.estado==='ACTIVO'&&p.control_stock!==false);
  if(!lista.length)return toast('No hay productos activos con control de inventario.',true);
  dlg.innerHTML='<form id="af"><h2>Ajuste de inventario</h2><p class="mute">Úsalo para corregir el conteo, anotar mermas o registrar un regalo. Si regalas un producto a un cliente, elige «Obsequio»: resta el stock y su costo se descuenta de la utilidad.</p><label>Producto</label><select name="producto_id">'+lista.map(p=>'<option value="'+p.id+'">'+esc(p.nombre)+' · Stock '+existencia(p.id)+'</option>').join('')+'</select><label>Tipo de ajuste</label><select name="tipo"><option value="ENTRADA">Entrada / sobrante</option><option value="SALIDA">Salida / faltante o merma</option><option value="OBSEQUIO">Obsequio a cliente (cortesía)</option></select><label>Cantidad</label><input name="cantidad" type="number" min="0.001" step="0.001" required><label>Motivo del ajuste</label><textarea name="motivo" minlength="3" maxlength="250" required placeholder="Ej. Conteo físico, producto dañado, vencimiento"></textarea><div class="acts"><button type="button" class="btn sec" id="cx">Cancelar</button><button class="btn">Registrar ajuste</button></div></form>';
  dlg.showModal();$('#cx').onclick=()=>dlg.close();let busy=false;
  $('#af').onsubmit=async e=>{e.preventDefault();if(busy)return;const f=Object.fromEntries(new FormData(e.target)),n=Number(f.cantidad);if(!Number.isFinite(n)||n<=0||f.motivo.trim().length<3)return toast('Indica una cantidad y un motivo válido.',true);busy=true;const b=e.target.querySelector('button[type="submit"],button:not([type])');if(b)b.disabled=true;const{error:e1}=f.tipo==='OBSEQUIO'?await sb.rpc('registrar_obsequio',{p_producto_id:f.producto_id,p_cantidad:n,p_motivo:f.motivo.trim()}):await sb.rpc('ajustar_inventario_producto',{p_producto_id:f.producto_id,p_tipo:f.tipo,p_cantidad:n,p_motivo:f.motivo.trim()});if(e1){busy=false;if(b)b.disabled=false;return error(e1)}dlg.close();toast('Ajuste de inventario registrado');vista='productos';render()};
 }
 async function movimientosVista(){
  const{data,error:e1}=await sb.from('movimientos_inventario').select('id,fecha_hora,tipo_movimiento,cantidad,costo_unitario,motivo,productos(nombre)').eq('negocio_id',nid()).order('fecha_hora',{ascending:false}).limit(150);
  if(e1)return error(e1);
  $('#main').innerHTML='<div class="head"><h2>Movimientos de inventario</h2></div>'+tabs()+
   (data.length?data.map(m=>'<div class="row"><span><strong>'+esc(m.productos?.nombre||'Producto')+' · '+esc(m.tipo_movimiento)+'</strong><br><small>'+fecha(m.fecha_hora)+' · '+esc(m.motivo||'Sin motivo')+'</small></span><strong>'+((m.tipo_movimiento==='SALIDA'?'-':'+')+m.cantidad)+'</strong></div>').join(''):'<p class="empty">Aún no hay movimientos.</p>');
  document.querySelectorAll('[data-tab]').forEach(b=>b.onclick=()=>{vista=b.dataset.tab;render()});
 }
 async function render(){if(!rol())return toast('No tienes permisos para gestionar productos e inventario.',true);if(vista==='movimientos')return movimientosVista();return productosVista()}
 return { productos:()=>{vista='productos';return render()} };
}
