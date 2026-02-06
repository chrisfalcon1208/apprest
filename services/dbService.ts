import { Insumo, PedidoTemporal, Venta, DetalleVenta, InformacionNegocio, Usuario, Categoria } from '../types';

// URL API
const API_URL = "/apprest_api/index.php";

// --- STATE CACHE ---
let info_negocio: InformacionNegocio = { nombre: "Cargando...", telefono: "", logo: "", numeroMesas: 0 };
let categorias: Categoria[] = [];
let insumos: Insumo[] = [];
let ventas: Venta[] = [];
let detalles_venta: DetalleVenta[] = [];
let usuarios: Usuario[] = [];
let pedidos_temporales: PedidoTemporal[] = [];
let mesa_metadata: Record<string, { cliente: string; tipoPedido: 'LOCAL' | 'LLEVAR' | 'DOMICILIO' }> = {};
let usuarioActual: Usuario | null = null;

const safeDate = (dateStr: any) => {
    if (typeof dateStr === 'string' && dateStr.indexOf('T') === -1) {
        dateStr = dateStr.replace(' ', 'T');
    }
    const d = new Date(dateStr);
    return isNaN(d.getTime()) ? new Date() : d;
};

const formatMySQLDate = (date: Date) => {
    const pad = (n: number) => n.toString().padStart(2, '0');
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`;
};

// --- HELPER DE FETCH AUTORIZADO ---
const authorizedFetch = async (url: string, options: RequestInit = {}) => {
    const headers = { ...options.headers } as Record<string, string>;

    // Inyectar Token si existe
    if (usuarioActual?.token) {
        headers['Authorization'] = `Bearer ${usuarioActual.token}`;
    }

    // Asegurar Content-Type si enviamos JSON
    if (typeof options.body === 'string' && !headers['Content-Type']) {
        headers['Content-Type'] = 'application/json';
    }

    const config = {
        ...options,
        headers
    };

    const res = await fetch(url, config);

    // Si el token expiró o es inválido (401), cerrar sesión forzosamente
    if (res.status === 401) {
        console.warn("Sesión expirada o token inválido. Cerrando sesión...");
        dbService.logout();
        return null;
    }

    return res;
};

export const dbService = {
    verificarConexionBackend: async () => {
        try {
            const res = await fetch(`${API_URL}?action=check`);
            if (!res.ok) return 'error';
            const data = await res.json();
            return data.status;
        } catch { return 'error'; }
    },

    inicializarBaseDeDatos: async () => {
        try {
            const res = await fetch(`${API_URL}?action=init`);
            const data = await res.json();
            return data.status === 'success';
        } catch { return false; }
    },

    cargarDatosGenerales: async () => {
        try {
            const savedUser = localStorage.getItem('apprest_user_session');
            if (savedUser) {
                try {
                    usuarioActual = JSON.parse(savedUser);
                } catch (e) { console.error("Error leyendo sesión local"); }
            }

            // Usar authorizedFetch para que el backend valide el token
            const res = await authorizedFetch(`${API_URL}?action=get_all_data`);

            if (res && res.ok) {
                const text = await res.text();
                let data;
                try {
                    data = JSON.parse(text);
                } catch (err) {
                    console.error("ERROR CRÍTICO: El servidor no devolvió JSON válido.", err);
                    return;
                }

                if (data.config) info_negocio = { ...data.config, numeroMesas: parseInt(data.config.numeroMesas) };
                if (data.usuarios) usuarios = data.usuarios;
                if (data.categorias) categorias = data.categorias;
                if (data.insumos) insumos = data.insumos.map((i: any) => ({ ...i, precio: parseFloat(i.precio) }));

                if (data.ventas && Array.isArray(data.ventas)) {
                    ventas = data.ventas.map((v: any) => ({
                        ...v,
                        total: parseFloat(v.total || 0),
                        monto_recibido: parseFloat(v.monto_recibido || v.total || 0),
                        monto_cambio: parseFloat(v.monto_cambio || 0),
                        fecha: safeDate(v.fecha),
                        consecutivo: parseInt(v.consecutivo)
                    }));
                }

                if (data.detalles && Array.isArray(data.detalles)) {
                    detalles_venta = data.detalles.map((d: any) => ({
                        ...d,
                        cantidad: parseInt(d.cantidad),
                        precio_unitario: parseFloat(d.precio_unitario),
                        subtotal: parseFloat(d.subtotal)
                    }));
                }

                if (data.pedidos_temporales && Array.isArray(data.pedidos_temporales)) {
                    pedidos_temporales = data.pedidos_temporales.map((p: any) => {
                        const insumo = insumos.find(i => i.id === p.id_insumo);
                        if (p.id_mesa) {
                            mesa_metadata[p.id_mesa] = {
                                cliente: p.cliente || '',
                                tipoPedido: (p.tipo_pedido as any) || 'LOCAL'
                            };
                        }
                        return {
                            ...p,
                            cantidad: parseInt(p.cantidad),
                            fecha_hora: safeDate(p.fecha_hora),
                            insumo_snapshot: insumo
                        };
                    });
                } else {
                    pedidos_temporales = [];
                    mesa_metadata = {};
                }

                window.dispatchEvent(new Event('apprest-config-updated'));
            }
        } catch (e) {
            console.warn("Modo Offline o Error de Conexión.", e);
        }
    },

    uploadImage: async (file: File): Promise<string> => {
        const formData = new FormData();
        formData.append('image', file);

        try {
            const res = await authorizedFetch(`${API_URL}?action=upload`, { method: 'POST', body: formData });
            if (!res) throw new Error("Error de autorización");
            const data = await res.json();
            if (data.status === 'success') return data.url;
            else throw new Error(data.message);
        } catch (e) {
            console.error(e);
            throw new Error("Error subiendo imagen");
        }
    },

    login: async (email: string, password_hash: string): Promise<boolean> => {
        try {
            const res = await fetch(`${API_URL}?action=login`, {
                method: 'POST',
                // IMPORTANTE: Header necesario para que PHP decodifique json://input
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ email, password: password_hash })
            });
            const data = await res.json();
            if (data.status === 'success') {
                usuarioActual = data.user;
                localStorage.setItem('apprest_user_session', JSON.stringify(usuarioActual));
                return true;
            }
            return false;
        } catch { return false; }
    },

    logout: () => {
        if (usuarioActual?.token) {
            authorizedFetch(`${API_URL}?action=logout`).catch(() => { });
        }
        usuarioActual = null;
        localStorage.removeItem('apprest_user_session');
        window.dispatchEvent(new Event('apprest-logout'));
    },

    obtenerUsuarioActual: () => usuarioActual || { id: '0', nombre: 'Invitado', email: '', rol: 'admin' },
    estaAutenticado: () => !!usuarioActual && !!usuarioActual.token,

    registrarUsuario: async (nombre: string, email: string, pass: string, rol: string) => {
        try {
            const res = await fetch(`${API_URL}?action=register`, {
                method: 'POST',
                // IMPORTANTE: Header necesario para que PHP decodifique json://input
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ nombre, email, password: pass, rol })
            });
            const data = await res.json();
            if (data.status === 'success') {
                return true;
            } else {
                throw new Error(data.message || "Error al registrar");
            }
        } catch (e: any) {
            throw new Error(e.message || "Error de conexión");
        }
    },

    actualizarPerfilUsuario: async (id: string, nombre: string, email: string) => {
        const res = await authorizedFetch(`${API_URL}?action=update_profile`, {
            method: 'POST',
            body: JSON.stringify({ id, nombre, email })
        });
        if (!res) throw new Error("No autorizado");
        const data = await res.json();
        if (data.status === 'success') {
            if (usuarioActual && usuarioActual.id === id) {
                usuarioActual = { ...usuarioActual, nombre, email };
                localStorage.setItem('apprest_user_session', JSON.stringify(usuarioActual));
            }
            return usuarioActual!;
        } else {
            throw new Error(data.message || "Error al actualizar perfil");
        }
    },

    cambiarPasswordUsuario: async (id: string, actual: string, nueva: string) => {
        const res = await authorizedFetch(`${API_URL}?action=change_password`, {
            method: 'POST',
            body: JSON.stringify({ id, actual, nueva })
        });
        if (!res) throw new Error("No autorizado");
        const data = await res.json();
        if (data.status !== 'success') {
            throw new Error(data.message || "Error al cambiar contraseña");
        }
        return true;
    },

    obtenerNombreUsuario: (id: string) => usuarios.find(u => u.id === id)?.nombre || 'Desconocido',

    obtenerInfoNegocio: () => info_negocio,
    actualizarInfoNegocio: async (datos: InformacionNegocio) => {
        info_negocio = datos;
        await authorizedFetch(`${API_URL}?action=save_config`, { method: 'POST', body: JSON.stringify(datos) });
        window.dispatchEvent(new Event('apprest-config-updated'));
    },

    obtenerCategorias: () => categorias,
    guardarCategoria: async (cat: Categoria) => {
        // Enviar al backend SIN generar ID aquí. El backend lo genera si está vacío.
        const res = await authorizedFetch(`${API_URL}?action=save_category`, { method: 'POST', body: JSON.stringify(cat) });
        if (res && res.ok) {
            const data = await res.json();
            if (data.status === 'success' && data.id) {
                cat.id = data.id; // Actualizar con ID real
                const idx = categorias.findIndex(c => c.id === cat.id);
                if (idx >= 0) categorias[idx] = cat; else categorias.push(cat);
            }
        }
    },
    eliminarCategoria: async (id: string) => {
        if (insumos.some(i => i.categoria_id === id)) throw new Error("Tiene productos asociados");
        categorias = categorias.filter(c => c.id !== id);
        await authorizedFetch(`${API_URL}?action=delete_category&id=${id}`);
    },

    obtenerInsumos: () => insumos,
    obtenerInsumoPorId: (id: string) => insumos.find(i => i.id === id),
    guardarInsumo: async (insumo: Insumo) => {
        const res = await authorizedFetch(`${API_URL}?action=save_product`, { method: 'POST', body: JSON.stringify(insumo) });
        if (res && res.ok) {
            const data = await res.json();
            if (data.status === 'success' && data.id) {
                insumo.id = data.id;
                const idx = insumos.findIndex(i => i.id === insumo.id);
                if (idx >= 0) insumos[idx] = insumo; else insumos.push(insumo);
            }
        }
    },
    eliminarInsumo: async (id: string) => {
        insumos = insumos.filter(i => i.id !== id);
        await authorizedFetch(`${API_URL}?action=delete_product&id=${id}`);
    },

    obtenerPedidosMesa: (idMesa: string) => pedidos_temporales.filter(p => p.id_mesa === idMesa),

    // --- LÓGICA CORE: Agregar con UI Optimista y Agrupación Estricta ---
    agregarPedidoTemporal: async (idMesa: string, idInsumo: string, cantidad: number, idUsuario: string) => {
        const insumo = insumos.find(i => i.id === idInsumo);
        if (!insumo) return;

        // CORRECCIÓN: Búsqueda estricta. Solo agrupar si NO tiene notas.
        const existente = pedidos_temporales.find(p =>
            p.id_mesa === idMesa &&
            p.id_insumo === idInsumo &&
            p.estado === 'sin_enviar' &&
            (!p.notas || p.notas.trim() === '')
        );

        if (existente) {
            // Actualización síncrona en memoria (EVITA SALTOS DE NÚMEROS)
            existente.cantidad += cantidad;

            // Enviar al backend en background
            const payload = {
                ...existente,
                fecha_hora: formatMySQLDate(existente.fecha_hora)
            };
            authorizedFetch(`${API_URL}?action=save_temp_order`, { method: 'POST', body: JSON.stringify(payload) }).catch(console.error);

        } else {
            // Nuevo Item en memoria
            const tipo = mesa_metadata[idMesa]?.tipoPedido || 'LOCAL';
            const cliente = mesa_metadata[idMesa]?.cliente || '';
            const tempId = 'temp_' + Date.now() + Math.random().toString(36).substr(2, 5);

            const nuevoPedido: PedidoTemporal = {
                id: tempId,
                id_mesa: idMesa,
                id_insumo: idInsumo,
                cantidad,
                id_usuario: idUsuario,
                insumo_snapshot: insumo,
                notas: '',
                fecha_hora: new Date(),
                estado: 'sin_enviar',
                tipo_pedido: tipo
            };

            // INSERCIÓN SÍNCRONA: La "fuente de la verdad" se actualiza al instante
            pedidos_temporales.push(nuevoPedido);

            // Backend
            const payload = {
                ...nuevoPedido,
                id: '',
                cliente,
                fecha_hora: formatMySQLDate(nuevoPedido.fecha_hora)
            };

            try {
                const res = await authorizedFetch(`${API_URL}?action=save_temp_order`, { method: 'POST', body: JSON.stringify(payload) });
                if (res && res.ok) {
                    const data = await res.json();
                    if (data.status === 'success' && data.id) {
                        // Reemplazo silencioso de ID
                        const itemEnCache = pedidos_temporales.find(p => p.id === tempId);
                        if (itemEnCache) itemEnCache.id = data.id;
                    }
                }
            } catch (e) {
                console.error("Error guardando pedido", e);
            }
        }
    },

    actualizarNotasPedido: async (id: string, notas: string) => {
        const p = pedidos_temporales.find(x => x.id === id);
        if (p) {
            // ACTUALIZACIÓN SÍNCRONA: Evita que el intervalo sobrescriba lo que escribes
            p.notas = notas;

            const cliente = mesa_metadata[p.id_mesa]?.cliente || '';
            const payload = {
                ...p,
                cliente,
                fecha_hora: formatMySQLDate(p.fecha_hora)
            };
            await authorizedFetch(`${API_URL}?action=save_temp_order`, { method: 'POST', body: JSON.stringify(payload) });
        }
    },

    eliminarPedidoTemporal: async (id: string) => {
        pedidos_temporales = pedidos_temporales.filter(p => p.id !== id);
        await authorizedFetch(`${API_URL}?action=delete_temp_order&id=${id}`);
    },

    vaciarMesa: async (idMesa: string) => {
        pedidos_temporales = pedidos_temporales.filter(p => p.id_mesa !== idMesa);
        delete mesa_metadata[idMesa];
        await authorizedFetch(`${API_URL}?action=clear_table&id_mesa=${idMesa}`);
    },

    enviarOrdenCocina: (idMesa: string) => {
        pedidos_temporales.filter(p => p.id_mesa === idMesa && p.estado === 'sin_enviar')
            .forEach(async p => {
                p.estado = 'pendiente';
                p.fecha_hora = new Date();
                await authorizedFetch(`${API_URL}?action=update_order_status`, {
                    method: 'POST',
                    body: JSON.stringify({ id: p.id, estado: 'pendiente' })
                });
            });
    },

    obtenerPedidosCocina: () => pedidos_temporales.filter(p => p.estado && ['pendiente', 'preparando', 'listo'].includes(p.estado)),

    cambiarEstadoPedido: async (id: string, estado: any) => {
        const p = pedidos_temporales.find(x => x.id === id);
        if (p) {
            p.estado = estado;
            await authorizedFetch(`${API_URL}?action=update_order_status`, {
                method: 'POST',
                body: JSON.stringify({ id: p.id, estado })
            });
        }
    },

    obtenerEstadoMesa: (idMesa: string) => {
        const peds = pedidos_temporales.filter(p => p.id_mesa === idMesa);
        if (peds.length === 0) return { estado: 'libre', total: 0, items: 0 };
        const total = peds.reduce((acc, p) => acc + (p.cantidad * (p.insumo_snapshot?.precio || 0)), 0);
        return { estado: 'ocupada', total, items: peds.length, mesero: peds[0].id_usuario };
    },

    actualizarNombreCliente: async (id: string, val: string) => {
        if (!mesa_metadata[id]) mesa_metadata[id] = { cliente: '', tipoPedido: 'LOCAL' };
        mesa_metadata[id].cliente = val;
        await authorizedFetch(`${API_URL}?action=update_table_meta`, {
            method: 'POST',
            body: JSON.stringify({ id_mesa: id, cliente: val, tipo_pedido: mesa_metadata[id].tipoPedido })
        });
    },
    obtenerNombreCliente: (id: string) => mesa_metadata[id]?.cliente || '',

    actualizarTipoPedido: async (id: string, val: any) => {
        if (!mesa_metadata[id]) mesa_metadata[id] = { cliente: '', tipoPedido: 'LOCAL' };
        mesa_metadata[id].tipoPedido = val;
        pedidos_temporales.filter(p => p.id_mesa === id).forEach(p => p.tipo_pedido = val);
        await authorizedFetch(`${API_URL}?action=update_table_meta`, {
            method: 'POST',
            body: JSON.stringify({ id_mesa: id, cliente: mesa_metadata[id].cliente, tipo_pedido: val })
        });
    },
    obtenerTipoPedido: (id: string) => mesa_metadata[id]?.tipoPedido || 'LOCAL',

    cerrarCuenta: (idMesa: string, idUsuario: string, cliente?: string, recibido: number = 0): Venta & { detalles: DetalleVenta[] } => {
        const peds = pedidos_temporales.filter(p => p.id_mesa === idMesa);
        if (peds.length === 0) throw new Error("Mesa vacía");

        let total = peds.reduce((acc, p) => acc + (p.cantidad * (p.insumo_snapshot?.precio || 0)), 0);
        const tipo = mesa_metadata[idMesa]?.tipoPedido || 'LOCAL';
        if (tipo === 'DOMICILIO') total += 10;

        const maxC = ventas.reduce((max, v) => (v.consecutivo > max ? v.consecutivo : max), 0);

        // Creamos objeto venta SIN ID todavía
        const nuevaVenta: Venta = {
            id: '', // Se generará en backend
            consecutivo: maxC + 1,
            id_mesa: idMesa,
            cliente: cliente || "Publico General",
            total,
            monto_recibido: recibido,
            monto_cambio: recibido - total,
            pagado: true,
            id_usuario: idUsuario,
            fecha: new Date(),
            tipo_pedido: tipo
        };

        const nuevosDetalles: DetalleVenta[] = [];
        peds.forEach(p => {
            nuevosDetalles.push({
                id: '', // Se generará en backend
                id_venta: '',
                id_insumo: p.id_insumo,
                codigo_producto: p.insumo_snapshot?.codigo || 'X',
                nombre_producto: p.insumo_snapshot?.nombre || 'X',
                cantidad: p.cantidad,
                precio_unitario: p.insumo_snapshot?.precio || 0,
                subtotal: p.cantidad * (p.insumo_snapshot?.precio || 0),
                notas: p.notas
            });
        });

        if (tipo === 'DOMICILIO') {
            nuevosDetalles.push({
                id: '', id_venta: '', id_insumo: 'FEE',
                codigo_producto: 'SERV', nombre_producto: 'Servicio Domicilio', cantidad: 1, precio_unitario: 10, subtotal: 10, notas: ''
            });
        }

        const payload = {
            venta: { ...nuevaVenta, fecha: formatMySQLDate(nuevaVenta.fecha) },
            detalles: nuevosDetalles
        };

        // Enviamos al backend y esperamos ID real
        authorizedFetch(`${API_URL}?action=save_sale`, { method: 'POST', body: JSON.stringify(payload) })
            .then(async (res) => {
                if (res && res.ok) {
                    const data = await res.json();
                    if (data.status === 'success' && data.id) {
                        // Actualizar ID real en cache local
                        nuevaVenta.id = data.id;
                        nuevosDetalles.forEach(d => d.id_venta = data.id); // Vincular detalles
                        ventas.push(nuevaVenta);
                        // Recargar todo para asegurar IDs de detalles
                        dbService.cargarDatosGenerales();
                    }
                }
            })
            .catch(console.error);

        // Limpieza local inmediata para UX (Optimistic)
        pedidos_temporales = pedidos_temporales.filter(p => p.id_mesa !== idMesa);
        delete mesa_metadata[idMesa];
        authorizedFetch(`${API_URL}?action=clear_table&id_mesa=${idMesa}`).catch(console.error);

        // Retornamos objeto temporal para imprimir ticket, aunque el ID sea vacío momentáneamente
        return { ...nuevaVenta, detalles: nuevosDetalles };
    },

    obtenerTodasLasVentas: () => ventas.map(v => ({ ...v, detalles: detalles_venta.filter(d => d.id_venta === v.id) })).sort((a, b) => b.consecutivo - a.consecutivo),

    _getVentasRaw: () => ventas,
    _getDetallesRaw: () => detalles_venta
};

dbService.cargarDatosGenerales();