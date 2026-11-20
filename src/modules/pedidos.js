// Panel independiente para gestionar solicitudes de productos recibidas desde el catálogo público.
export function crearModuloPedidos(deps) {
 const { $, sb, S, esc, dinero, toast } = deps;
 const estados=['NUEVO','EN_PREPARACION','LISTO','ENTREGADO','CANCELADO'];
 const etiqueta=e=>({NUEVO:'Nuevo',EN_PREPARACION:'En preparación',LISTO:'Listo para entregar',ENTREGADO:'Entregado',CANCELADO:'Cancelado'}[e]||e);
 const fecha=x=>x?new Date(x).toLocaleString('es-CO',{dateStyle:'medium',timeStyle:'short'}):'—';
 let pedidos=[];
 async function cargar(){
  const todos=[];for(let desde=0;;desde+=500){
   const{data,error}=await sb.from('pedidos_productos').select('*,detalle_pedidos_productos(*)').eq('negocio_id',S.perfil.negocio_id).order('creado_en',{ascending:false}).range(desde,desde+499);
   if(error){toast(error.message,true);return null}
   todos.push(...(data||[]));if(!data||data.length<500)break;
  }return todos;
 }
 async function pedidosVista(){
  pedidos=await cargar();if(!pedidos)return;
  const pendientes=pedidos.filter(p=>!['ENTREGADO','CANCELADO'].includes(p.estado)).length;
  const nuevos=pedidos.filter(p=>p.estado==='NUEVO').length,listos=pedidos.filter(p=>p.estado==='LISTO').length,entregados=pedidos.filter(p=>p.estado==='ENTREGADO').length;
  $('#main').innerHTML='<div class="orders-workspace">'+
   '<section class="orders-intro"><div><small>GESTIÓN COMERCIAL · CATÁLOGO DE PRODUCTOS</small><h2>Pedidos de productos</h2><p>Centraliza las solicitudes que los clientes envían desde el catálogo público. Aquí solo se gestionan productos; las citas y ventas conservan sus propios módulos.</p></div><span class="orders-status NUEVO">'+pendientes+' pendientes</span></section>'+
   '<section class="orders-kpis"><article><small>Total de solicitudes</small><strong>'+pedidos.length+'</strong></article><article><small>Nuevos por revisar</small><strong>'+nuevos+'</strong></article><article><small>Listos para entregar</small><strong>'+listos+'</strong></article><article><small>Entregados</small><strong>'+entregados+'</strong></article></section>'+
   '<section class="orders-toolbar"><label>Buscar pedido<input id="order-search" data-order-search type="search" placeholder="Cliente, teléfono o producto"></label><label>Estado<select id="order-status" data-order-status><option value="TODOS">Todos los estados</option>'+estados.map(e=>'<option value="'+e+'">'+etiqueta(e)+'</option>').join('')+'</select></label><label>Desde<input id="order-from" type="date"></label><label>Hasta<input id="order-to" type="date"></label></section>'+
   '<div class="orders-actions"><span class="orders-count" id="orders-count"></span><button class="btn sec" id="orders-clear">Limpiar filtros</button></div><section class="orders-list" id="orders-list"></section></div>';
  const list=$('#orders-list'),search=$('#order-search'),status=$('#order-status'),from=$('#order-from'),to=$('#order-to'),count=$('#orders-count');
  const pintar=()=>{
   const q=search.value.trim().toLocaleLowerCase(),st=status.value,a=from.value,b=to.value;
   const visibles=pedidos.filter(p=>{
    const detalle=p.detalle_pedidos_productos||[],texto=[p.nombre_cliente,p.telefono_cliente,...detalle.map(d=>d.nombre_producto)].join(' ').toLocaleLowerCase(),dia=String(p.creado_en||'').slice(0,10);
    return (!q||texto.includes(q))&&(st==='TODOS'||p.estado===st)&&(!a||dia>=a)&&(!b||dia<=b);
   });
   count.textContent=visibles.length+' de '+pedidos.length+' pedidos';
   list.innerHTML=visibles.length?visibles.map(p=>{
    const items=p.detalle_pedidos_productos||[],tel=String(p.telefono_cliente||'').replace(/\D/g,''),wa=tel?'<a class="btn sec orders-contact" target="_blank" rel="noopener" href="https://wa.me/'+(tel.length===10?'57'+tel:tel)+'?text='+encodeURIComponent('Hola '+p.nombre_cliente+', te contactamos de la barbería por tu pedido de productos.')+'">Contactar por WhatsApp</a>':'';
    return '<article class="orders-item"><div class="orders-item-head"><div class="orders-client"><strong>'+esc(p.nombre_cliente)+'</strong><small>'+esc(p.telefono_cliente)+' · '+fecha(p.creado_en)+'</small><span class="orders-status '+esc(p.estado)+'">'+etiqueta(p.estado)+'</span></div><strong class="orders-total">'+dinero(p.total)+'</strong></div>'+
     '<div class="orders-products">'+(items.length?items.map(d=>'<div class="orders-product-line"><span>'+esc(d.nombre_producto)+' × '+Number(d.cantidad)+'</span><span>'+dinero(d.subtotal??Number(d.cantidad)*Number(d.precio_unitario))+'</span></div>').join(''):'<span class="orders-muted">Este pedido no tiene líneas de detalle.</span>')+'</div>'+
     (p.notas?'<div class="orders-note"><strong>Nota del cliente:</strong> '+esc(p.notas)+'</div>':'')+
     '<div class="orders-actions">'+wa+'<label class="orders-muted">Actualizar estado<select data-order="'+p.id+'" aria-label="Estado del pedido de '+esc(p.nombre_cliente)+'">'+estados.map(e=>'<option value="'+e+'" '+(p.estado===e?'selected':'')+'>'+etiqueta(e)+'</option>').join('')+'</select></label></div></article>';
   }).join(''):'<div class="orders-empty"><strong>No hay pedidos para mostrar</strong>Prueba cambiar los filtros o espera nuevas solicitudes desde el catálogo de productos.</div>';
   list.querySelectorAll('[data-order]').forEach(sel=>sel.onchange=async()=>{
    const anterior=pedidos.find(p=>p.id===sel.dataset.order)?.estado,nuevo=sel.value;
    if(!anterior||anterior===nuevo)return;
    sel.disabled=true;
    const{error}=await sb.from('pedidos_productos').update({estado:nuevo,actualizado_en:new Date().toISOString()}).eq('id',sel.dataset.order).eq('negocio_id',S.perfil.negocio_id);
    if(error){sel.disabled=false;sel.value=anterior;return toast(error.message,true)}
    const pedido=pedidos.find(p=>p.id===sel.dataset.order);if(pedido)pedido.estado=nuevo;
    toast('Estado del pedido actualizado');await pedidosVista();
   });
  };
  [search,status,from,to].forEach(el=>el.addEventListener(el===search?'input':'change',pintar));
  $('#orders-clear').onclick=()=>{search.value='';status.value='TODOS';from.value='';to.value='';pintar()};
  pintar();
 }
 return { pedidos: pedidosVista };
}
