// Configuración de formularios y listados de catálogos.
// Las dependencias se reciben desde la pantalla para evitar estado global oculto.
export function crearConfigCatalogos(ADM, dinero) {
  return {
 clientes:{t:'Clientes',uno:'cliente',w:ADM,
  f:[['nombre','Nombre','text',1],['telefono','Teléfono','tel'],['telefono_alterno','Teléfono alterno','tel'],['fecha_nacimiento','Cumpleaños','date'],['barbero_preferido','Barbero preferido','ref:barberos'],['observaciones','Observaciones','area']],
  l:r=>[r.nombre,r.telefono||'Sin teléfono']},
 barberos:{t:'Barberos',uno:'barbero',w:ADM,
  f:[['nombre','Nombre','text',1],['telefono','Teléfono','tel'],['correo','Correo','email'],['fecha_ingreso','Fecha de ingreso','date'],['modelo_pago','Modelo de pago','sel:COMISION,ALQUILER,MIXTO'],['porcentaje_comision','Porcentaje de comisión (%)','number'],['valor_alquiler','Valor del alquiler','number'],['acepta_citas','Recibe citas por la reserva en línea','bool'],['observaciones','Observaciones','area']],
  l:r=>[r.nombre,r.modelo_pago==='ALQUILER'?'Alquiler '+dinero(r.valor_alquiler):'Comisión '+r.porcentaje_comision+'%']},
 servicios:{t:'Servicios',uno:'servicio',w:ADM,
  f:[['nombre','Nombre','text',1],['categoria','Categoría','text'],['descripcion','Descripción','area'],['precio','Precio','number',1],['duracion_minutos','Duración (minutos)','number',1]],
  l:r=>[r.nombre,dinero(r.precio)+', '+r.duracion_minutos+' min']},
 productos:{t:'Productos',uno:'producto',w:ADM,
  f:[['nombre','Nombre','text',1],['categoria','Categoría','text'],['descripcion','Descripción','area'],['costo_unitario','Costo de compra','number'],['precio_venta','Precio de venta','number',1],['stock_minimo','Stock mínimo','number']],
  l:r=>[r.nombre,dinero(r.precio_venta)+', en stock: '+(r.existencias??0)]},
 cuentas:{t:'Cuentas de recaudo',uno:'cuenta',w:ADM,
  f:[['nombre','Nombre (ej. Nequi Harold)','text',1],['detalle','Número o detalle','text']],
  l:r=>[r.nombre,r.detalle||'Sin detalle']}
};;
}
