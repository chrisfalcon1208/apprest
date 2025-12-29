import { dbService } from './dbService';
import { Insumo } from '../types';

/**
 * Recrea las consultas SQL del sistema original para analítica.
 */
export const reportService = {

    // 1. Ventas del día (Hoy)
    obtenerVentasHoy: () => {
        // SQL: SELECT SUM(total) FROM ventas WHERE DATE(fecha) = CURDATE()
        const ventas = dbService._getVentasRaw();
        const hoy = new Date().toDateString();
        
        const ventasHoy = ventas.filter(v => v.fecha.toDateString() === hoy);
        const total = ventasHoy.reduce((acc, v) => acc + v.total, 0);
        const conteo = ventasHoy.length;
        
        return { total, conteo, ventas: ventasHoy };
    },

    // 2. Ventas por hora (Picos de demanda)
    obtenerVentasPorHora: (fechaInicio?: Date, fechaFin?: Date) => {
        // SQL: SELECT HOUR(fecha) as hora, COUNT(*) as transacciones, SUM(total) as ingreso FROM ventas GROUP BY HOUR(fecha)
        const ventas = dbService._getVentasRaw();
        
        // Definir rango por defecto (Hoy) si no vienen parámetros
        let start = fechaInicio;
        let end = fechaFin;

        if (!start || !end) {
            const now = new Date();
            start = new Date(now);
            start.setHours(0, 0, 0, 0);
            
            end = new Date(now);
            end.setHours(23, 59, 59, 999);
        } else {
            // Asegurar que fechaFin cubra hasta el final del día seleccionado
            end = new Date(end);
            end.setHours(23, 59, 59, 999);
            
            start = new Date(start);
            start.setHours(0,0,0,0);
        }

        // Filtrar por rango
        const ventasFiltradas = ventas.filter(v => v.fecha >= start! && v.fecha <= end!);

        const porHora: Record<number, number> = {};
        
        // Inicializar todas las horas en 0 para que el gráfico no tenga huecos
        for(let i=0; i<24; i++) {
            porHora[i] = 0;
        }
        
        ventasFiltradas.forEach(v => {
            const hora = v.fecha.getHours();
            porHora[hora] = (porHora[hora] || 0) + v.total;
        });

        return porHora;
    },

    // 2.5 Ventas por Semana (Días de la semana)
    obtenerVentasPorSemana: (fechaInicio?: Date, fechaFin?: Date) => {
        const ventas = dbService._getVentasRaw();
        
        // Definir rango por defecto (Hoy) si no vienen parámetros
        let start = fechaInicio;
        let end = fechaFin;

        if (!start || !end) {
            const now = new Date();
            start = new Date(now);
            start.setHours(0, 0, 0, 0);
            
            end = new Date(now);
            end.setHours(23, 59, 59, 999);
        } else {
            end = new Date(end);
            end.setHours(23, 59, 59, 999);
            
            start = new Date(start);
            start.setHours(0,0,0,0);
        }

        // Filtrar por rango
        const ventasFiltradas = ventas.filter(v => v.fecha >= start! && v.fecha <= end!);

        const porDia: Record<number, number> = {};
        
        // Inicializar 0-6 (Domingo-Sábado)
        for(let i=0; i<7; i++) {
            porDia[i] = 0;
        }
        
        ventasFiltradas.forEach(v => {
            const dia = v.fecha.getDay(); // 0 = Domingo, 1 = Lunes...
            porDia[dia] = (porDia[dia] || 0) + v.total;
        });

        return porDia;
    },

    // 2.8 Ventas por Año (Mensual)
    obtenerVentasMensualesPorAno: (year: number) => {
        const ventas = dbService._getVentasRaw();
        
        // Filtrar solo las ventas del año solicitado
        const ventasFiltradas = ventas.filter(v => v.fecha.getFullYear() === year);

        const porMes: Record<number, number> = {};
        
        // Inicializar 0-11 (Enero-Diciembre)
        for(let i=0; i<12; i++) {
            porMes[i] = 0;
        }
        
        ventasFiltradas.forEach(v => {
            const mes = v.fecha.getMonth(); // 0 = Enero
            porMes[mes] = (porMes[mes] || 0) + v.total;
        });

        return porMes;
    },

    // 3. Insumos más vendidos (Top Productos)
    obtenerTopInsumos: () => {
        // SQL: SELECT i.nombre, SUM(dv.cantidad) as total_vendido, SUM(dv.subtotal) as ingreso_total
        // FROM ventas_detalles dv JOIN insumos i ON dv.id_insumo = i.id 
        // GROUP BY i.id ORDER BY total_vendido DESC
        
        const detalles = dbService._getDetallesRaw();
        
        // Objeto para acumular cantidad y total monetario por insumo
        const stats: Record<string, { cantidad: number, total: number }> = {};

        detalles.forEach(d => {
            if (!stats[d.id_insumo]) {
                stats[d.id_insumo] = { cantidad: 0, total: 0 };
            }
            stats[d.id_insumo].cantidad += d.cantidad;
            stats[d.id_insumo].total += d.subtotal;
        });

        // Convertir a array y ordenar por cantidad descendente
        const sorted = Object.entries(stats)
            .sort(([, a], [, b]) => b.cantidad - a.cantidad);

        return sorted.map(([id, stat]) => {
            const insumo = dbService.obtenerInsumoPorId(id);
            return {
                nombre: insumo?.nombre || (id === 'FEE_DOMICILIO' ? 'Envío Domicilio' : 'Desconocido'),
                cantidad: stat.cantidad,
                total: stat.total, // Total histórico en dinero
                tipo: insumo?.tipo || 'SERVICIO'
            };
        });
    },

    // 4. Ventas por usuario (Desempeño)
    obtenerDesempenoUsuarios: () => {
        // SQL: SELECT u.nombre, COUNT(v.id) as mesas_cerradas, SUM(v.total) as total_vendido
        // FROM ventas v JOIN usuarios u ON v.id_usuario = u.id GROUP BY u.id
        
        const ventas = dbService._getVentasRaw();
        const stats: Record<string, { mesas: number, total: number }> = {};

        ventas.forEach(v => {
            if (!stats[v.id_usuario]) stats[v.id_usuario] = { mesas: 0, total: 0 };
            stats[v.id_usuario].mesas += 1;
            stats[v.id_usuario].total += v.total;
        });

        // Mapear IDs a nombres (simulado)
        const usuariosMock = { 'u1': 'Juan Pérez', 'u2': 'Maria G.' };
        
        return Object.entries(stats).map(([id, stat]) => ({
            // @ts-ignore
            nombre: usuariosMock[id] || id,
            mesas: stat.mesas,
            total: stat.total
        }));
    },

    // 5. Resumen de Estado de Mesas
    obtenerResumenMesas: () => {
        const negocio = dbService.obtenerInfoNegocio();
        let ocupadas = 0;
        
        // Iterar sobre el número de mesas configuradas para verificar su estado en tiempo real
        for (let i = 1; i <= negocio.numeroMesas; i++) {
            const estado = dbService.obtenerEstadoMesa(i.toString());
            if (estado.estado === 'ocupada') {
                ocupadas++;
            }
        }
        
        return {
            total: negocio.numeroMesas,
            ocupadas: ocupadas,
            libres: negocio.numeroMesas - ocupadas,
            porcentajeOcupacion: (ocupadas / negocio.numeroMesas) * 100
        };
    },

    // 6. Total de Productos Registrados
    obtenerTotalProductos: () => {
        return dbService.obtenerInsumos().length;
    },

    // 7. Venta Histórica Total
    obtenerVentaHistorica: () => {
        const ventas = dbService._getVentasRaw();
        return ventas.reduce((acc, v) => acc + v.total, 0);
    }
};