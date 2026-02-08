
import { Venta, DetalleVenta, PedidoTemporal, InformacionNegocio } from '../types';

// Web Serial API Type Definitions
interface SerialPort {
    open(options: { baudRate: number }): Promise<void>;
    close(): Promise<void>;
    writable: WritableStream;
}

declare global {
    interface Navigator {
        serial: {
            requestPort(): Promise<SerialPort>;
        };
    }
}

// Comandos ESC/POS Básicos
const ESC = '\x1b';
const GS = '\x1d';
const LF = '\x0a';

const COMMANDS = {
    INIT: ESC + '@',
    CUT: GS + 'V' + '\x41' + '\x03', // Corte total
    TEXT_NORMAL: ESC + '!' + '\x00',
    TEXT_BOLD: ESC + '!' + '\x08',
    TEXT_DOUBLE: ESC + '!' + '\x30', // Doble altura/anchura
    ALIGN_LEFT: ESC + 'a' + '\x00',
    ALIGN_CENTER: ESC + 'a' + '\x01',
    ALIGN_RIGHT: ESC + 'a' + '\x02',
};

// Helper para limpiar acentos (ESC/POS básico suele fallar con UTF-8 directo sin configuración de CodePage)
const normalize = (str: string) => {
    return str.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/Ñ/g, "N").replace(/ñ/g, "n");
};

class PrinterService {
    private port: SerialPort | null = null;
    private writer: WritableStreamDefaultWriter | null = null;
    private isConnectedVal: boolean = false;

    // Verificar soporte del navegador
    isSupported() {
        return 'serial' in navigator;
    }

    isConnected() {
        return this.isConnectedVal;
    }

    async connect() {
        if (!this.isSupported()) {
            throw new Error("Tu navegador no soporta Web Serial API (Usa Chrome o Edge).");
        }

        try {
            // Solicitar al usuario que seleccione el puerto
            // @ts-ignore
            this.port = await navigator.serial.requestPort();
            
            // Abrir puerto (9600 es estándar, pero algunas usan 115200)
            // @ts-ignore
            await this.port.open({ baudRate: 9600 });

            // @ts-ignore
            const textEncoder = new TextEncoderStream();
            // @ts-ignore
            const writableStreamClosed = textEncoder.readable.pipeTo(this.port.writable);
            this.writer = textEncoder.writable.getWriter();

            this.isConnectedVal = true;
            return true;
        } catch (error) {
            console.error("Error conectando impresora:", error);
            this.isConnectedVal = false;
            return false;
        }
    }

    async disconnect() {
        if (this.writer) {
            await this.writer.close();
            this.writer = null;
        }
        if (this.port) {
            // @ts-ignore
            await this.port.close();
            this.port = null;
        }
        this.isConnectedVal = false;
    }

    private async write(data: string) {
        if (!this.writer) return;
        await this.writer.write(data);
    }

    // Formatear línea con espacio entre nombre y precio (Ej: "Coca Cola ...... $20.00")
    private formatLine(left: string, right: string, width: number = 32) {
        const leftClean = normalize(left);
        const rightClean = normalize(right);
        const spaces = width - leftClean.length - rightClean.length;
        if (spaces < 1) return leftClean.substring(0, width - rightClean.length - 1) + ' ' + rightClean;
        return leftClean + ' '.repeat(spaces) + rightClean;
    }

    async printTicket(venta: Venta & { detalles: DetalleVenta[] }, negocio: InformacionNegocio) {
        if (!this.isConnectedVal) return false;

        try {
            let cmds = COMMANDS.INIT;

            // Header
            cmds += COMMANDS.ALIGN_CENTER;
            cmds += COMMANDS.TEXT_BOLD;
            cmds += normalize(negocio.nombre) + LF;
            cmds += COMMANDS.TEXT_NORMAL;
            if(negocio.telefono) cmds += "Tel: " + normalize(negocio.telefono) + LF;
            cmds += "--------------------------------" + LF;
            
            // Info Venta
            cmds += COMMANDS.ALIGN_LEFT;
            cmds += `Ticket: #${venta.consecutivo}` + LF;
            cmds += `Fecha: ${new Date().toLocaleDateString()} ${new Date().toLocaleTimeString()}` + LF;
            cmds += `Cliente: ${normalize(venta.cliente)}` + LF;
            cmds += "--------------------------------" + LF;

            // Items
            cmds += COMMANDS.TEXT_BOLD;
            cmds += this.formatLine("CANT DESC", "TOTAL") + LF;
            cmds += COMMANDS.TEXT_NORMAL;
            
            venta.detalles.forEach(d => {
                const totalItem = `$${d.subtotal.toFixed(2)}`;
                const nombreItem = `${d.cantidad} ${d.nombre_producto}`;
                cmds += this.formatLine(nombreItem, totalItem) + LF;
                if(d.notas) cmds += `  (${normalize(d.notas)})` + LF;
            });

            cmds += "--------------------------------" + LF;

            // Totales
            cmds += COMMANDS.ALIGN_RIGHT;
            cmds += COMMANDS.TEXT_DOUBLE; // Grande
            cmds += `TOTAL: $${venta.total.toFixed(2)}` + LF;
            cmds += COMMANDS.TEXT_NORMAL;
            cmds += `Recibido: $${(venta.monto_recibido || 0).toFixed(2)}` + LF;
            cmds += `Cambio: $${(venta.monto_cambio || 0).toFixed(2)}` + LF;
            
            // Footer
            cmds += COMMANDS.ALIGN_CENTER;
            cmds += LF + "Gracias por su compra" + LF + LF + LF;
            
            // Corte
            cmds += COMMANDS.CUT;

            await this.write(cmds);
            return true;
        } catch (e) {
            console.error("Error imprimiendo:", e);
            return false;
        }
    }

    async printPreCuenta(pedidos: PedidoTemporal[], negocio: InformacionNegocio, mesaId: string, total: number) {
        if (!this.isConnectedVal) return false;

        try {
            let cmds = COMMANDS.INIT;

            // Header
            cmds += COMMANDS.ALIGN_CENTER;
            cmds += COMMANDS.TEXT_BOLD;
            cmds += normalize(negocio.nombre) + LF;
            cmds += COMMANDS.TEXT_NORMAL;
            cmds += "*** PRE-CUENTA ***" + LF;
            cmds += `Mesa: ${mesaId}` + LF;
            cmds += `${new Date().toLocaleTimeString()}` + LF;
            cmds += "--------------------------------" + LF;

            // Items
            cmds += COMMANDS.ALIGN_LEFT;
            pedidos.forEach(p => {
                const precio = p.insumo_snapshot?.precio || 0;
                const subtotal = p.cantidad * precio;
                const line = this.formatLine(`${p.cantidad} ${p.insumo_snapshot?.nombre}`, `$${subtotal.toFixed(2)}`);
                cmds += line + LF;
            });

            cmds += "--------------------------------" + LF;
            
            // Total
            cmds += COMMANDS.ALIGN_RIGHT;
            cmds += COMMANDS.TEXT_BOLD;
            cmds += `TOTAL A PAGAR: $${total.toFixed(2)}` + LF;
            cmds += COMMANDS.TEXT_NORMAL;
            cmds += LF + LF + LF;
            
            // Corte
            cmds += COMMANDS.CUT;

            await this.write(cmds);
            return true;
        } catch (e) {
            console.error(e);
            return false;
        }
    }
}

export const printerService = new PrinterService();
