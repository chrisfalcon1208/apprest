
// Estructura basada en MySQL "botanero_ventas"

export interface Usuario {
  id: string;
  nombre: string;
  rol: 'admin' | 'mesero' | 'cocina';
  email: string;
  password_hash?: string; // Para simular la seguridad
  token?: string; // Token de sesión segura
}

export interface Categoria {
  id: string;
  nombre: string; // Ej: Cervezas, Botanas
  tipo: 'PLATILLO' | 'BEBIDA'; // Clasificación general de la categoría
  descripcion?: string;
}

// Catálogo de Insumos (Respetando campos originales)
export interface Insumo {
  id: string;
  codigo: string;
  nombre: string;
  descripcion: string;
  precio: number;
  tipo: 'PLATILLO' | 'BEBIDA'; // Clasificación obligatoria
  categoria_id: string;
  imagen?: string;
}

// Tabla pedidos_temporales (Sustituye a los archivos CSV)
export interface PedidoTemporal {
  id: string;
  id_mesa: string;
  id_insumo: string;
  cantidad: number;
  id_usuario: string; // Mesero que agregó
  insumo_snapshot?: Insumo; // Para evitar joins complejos en el frontend mock
  notas?: string;
  fecha_hora: Date;
  // Estado del flujo de cocina: 
  // 'sin_enviar' (en carrito), 'pendiente' (enviado a KDS), 'preparando' (en fuego), 'listo' (para entregar), 'finalizado' (sacado del KDS)
  estado?: 'sin_enviar' | 'pendiente' | 'preparando' | 'listo' | 'finalizado';
  tipo_pedido?: 'LOCAL' | 'LLEVAR' | 'DOMICILIO'; // Nuevo campo
}

// Ventas (Histórico)
export interface Venta {
  id: string;
  consecutivo: number; // Número histórico de venta (ej. 1, 2, 3... independiente del día)
  id_mesa: string;
  cliente: string; // Opcional, por defecto "Público General"
  total: number;
  monto_recibido?: number; // Nuevo: Para reporte
  monto_cambio?: number; // Nuevo: Para reporte
  pagado: boolean;
  id_usuario: string; // Quien cerró la cuenta
  fecha: Date;
  tipo_pedido?: 'LOCAL' | 'LLEVAR' | 'DOMICILIO'; // Campo agregado para reporte
}

export interface DetalleVenta {
  id: string;
  id_venta: string;
  id_insumo: string;
  codigo_producto?: string; // Snapshot para reporte histórico
  nombre_producto?: string; // Snapshot para reporte histórico
  cantidad: number;
  precio_unitario: number; // Precio al momento de la venta
  subtotal: number;
  notas?: string; // Snapshot de notas
}

// Configuración del Local
export interface InformacionNegocio {
  nombre: string;
  telefono: string;
  logo: string;
  numeroMesas: number; // Fundamental para el mapa
}

// Tipos auxiliares para UI
export interface MesaEstado {
  id: string;
  numero: number;
  estado: 'libre' | 'ocupada' | 'sucia';
  total_actual: number;
  mesero_asignado?: string;
  hora_apertura?: string;
}

export interface ChatMessage {
    id: string;
    role: 'user' | 'model';
    text: string;
    timestamp: Date;
}
