<?php
/**
 * API BACKEND PARA APP REST
 * ---------------------------------------------------
 * Este archivo maneja todas las peticiones del frontend (React).
 * Actúa como un controlador monolítico simple para gestión de TPV.
 */

// 1. CONFIGURACIÓN INICIAL
// ---------------------------------------------------
// Iniciar buffer para evitar salidas indeseadas (warnings, espacios en blanco) antes del JSON
ob_start();

// Configurar zona horaria para asegurar que los registros de ventas tengan la hora correcta
date_default_timezone_set('America/Mexico_City');

// 2. CONFIGURACIÓN CORS (Cross-Origin Resource Sharing)
// ---------------------------------------------------
// Permite que el frontend (que corre en un puerto distinto, ej: 5173) 
// pueda hacer peticiones a este backend (puerto 80) sin ser bloqueado por el navegador.
header("Access-Control-Allow-Origin: *");
header("Access-Control-Allow-Headers: Origin, X-Requested-With, Content-Type, Accept, Authorization");
header("Access-Control-Allow-Methods: GET, POST, OPTIONS");
header("Content-Type: application/json; charset=UTF-8");

// Manejo de la petición "Preflight" (OPTIONS) que envían los navegadores antes de un POST
if ($_SERVER['REQUEST_METHOD'] == 'OPTIONS') {
    ob_end_clean();
    http_response_code(200);
    exit();
}

// 3. CONEXIÓN A BASE DE DATOS
// ---------------------------------------------------
$servername = "localhost";
$username = "root";
$password = ""; 
$dbname = "apprest";

// Crear carpeta para subida de imágenes si no existe
if (!file_exists('uploads')) {
    mkdir('uploads', 0777, true);
}

$conn = new mysqli($servername, $username, $password);

// Forzar codificación UTF-8 para soportar tildes y caracteres especiales
if (!$conn->connect_error) {
    $conn->set_charset("utf8mb4");
}

// 4. FUNCIONES AUXILIARES
// ---------------------------------------------------

/**
 * Envía una respuesta JSON estandarizada y termina la ejecución.
 * Limpia el buffer para asegurar que solo se envíe el JSON limpio.
 */
function send_response($data, $code = 200) {
    ob_end_clean();
    http_response_code($code);
    echo json_encode($data);
    exit();
}

/**
 * AUTENTICACIÓN (Middleware)
 * Verifica que la petición incluya un Token Bearer válido en los headers.
 * Funciona tanto en Apache como en Nginx.
 */
function authenticate($conn) {
    $authHeader = null;

    // 1. Intentar obtener vía getallheaders() (Típico de Apache)
    if (function_exists('getallheaders')) {
        $headers = getallheaders();
        foreach ($headers as $key => $value) {
            if (strtolower($key) === 'authorization') {
                $authHeader = $value;
                break;
            }
        }
    }

    // 2. Fallback a $_SERVER (Nginx, FastCGI, o si Apache reescribe headers)
    if (!$authHeader) {
        if (isset($_SERVER['HTTP_AUTHORIZATION'])) {
            $authHeader = $_SERVER['HTTP_AUTHORIZATION'];
        } elseif (isset($_SERVER['REDIRECT_HTTP_AUTHORIZATION'])) {
            $authHeader = $_SERVER['REDIRECT_HTTP_AUTHORIZATION'];
        }
    }
    
    // Validar formato "Bearer TOKEN"
    if ($authHeader && preg_match('/Bearer\s(\S+)/', $authHeader, $matches)) {
        $token = $conn->real_escape_string($matches[1]);
        
        // Verificar si la columna token existe (por si es una BD vieja)
        $checkCol = $conn->query("SHOW COLUMNS FROM usuarios LIKE 'token'");
        if($checkCol && $checkCol->num_rows > 0) {
            // Buscar usuario dueño del token
            $result = $conn->query("SELECT * FROM usuarios WHERE token = '$token' AND token IS NOT NULL AND token != ''");
            if ($result && $result->num_rows > 0) {
                return $result->fetch_assoc(); // Retorna datos del usuario si es válido
            }
        }
    }
    
    // Si falla, detener ejecución (401 Unauthorized)
    send_response(["status" => "error", "message" => "No autorizado. Sesión inválida o expirada."], 401);
}

// Verificar conexión inicial
if ($conn->connect_error) {
    send_response(["status" => "error", "message" => "Conexión fallida: " . $conn->connect_error]);
}

// 5. ENRUTAMIENTO
// ---------------------------------------------------
// Determina qué acción ejecutar basado en el parámetro GET ?action=...
$action = $_GET['action'] ?? '';

// Seleccionar la base de datos (excepto para 'init' y 'check' que pueden correr sin ella)
if ($action !== 'init' && $action !== 'check') {
    $conn->select_db($dbname);
}

// --- ENDPOINTS PÚBLICOS (Sin Token) ---

// Verificar estado del servidor (Health Check)
if ($action === 'check') {
    try {
        if ($conn->select_db($dbname)) {
            send_response(["status" => "connected"]);
        } else {
            send_response(["status" => "missing"]);
        }
    } catch (Exception $e) {
        send_response(["status" => "missing"]);
    }
} 
// Inicializar Base de Datos (Primer uso)
// Crea tablas y usuario administrador por defecto
elseif ($action === 'init') {
    $sql = "CREATE DATABASE IF NOT EXISTS $dbname CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci";
    if ($conn->query($sql) === TRUE) {
        $conn->select_db($dbname);
        
        // Tablas del sistema
        $conn->query("CREATE TABLE IF NOT EXISTS usuarios (id VARCHAR(50) PRIMARY KEY, nombre VARCHAR(100), email VARCHAR(100) UNIQUE, password_hash VARCHAR(255), rol VARCHAR(20))");
        
        // Migración automática para columna token
        $check = $conn->query("SHOW COLUMNS FROM usuarios LIKE 'token'");
        if ($check && $check->num_rows == 0) {
            $conn->query("ALTER TABLE usuarios ADD COLUMN token VARCHAR(64)");
        }

        $conn->query("CREATE TABLE IF NOT EXISTS categorias (id VARCHAR(50) PRIMARY KEY, nombre VARCHAR(100), tipo VARCHAR(20), descripcion TEXT)");
        $conn->query("CREATE TABLE IF NOT EXISTS insumos (id VARCHAR(50) PRIMARY KEY, codigo VARCHAR(50), nombre VARCHAR(100), descripcion TEXT, precio DECIMAL(10,2), tipo VARCHAR(20), categoria_id VARCHAR(50), imagen TEXT)");
        $conn->query("CREATE TABLE IF NOT EXISTS ventas (id VARCHAR(50) PRIMARY KEY, consecutivo INT AUTO_INCREMENT UNIQUE, id_mesa VARCHAR(20), cliente VARCHAR(100), total DECIMAL(10,2), monto_recibido DECIMAL(10,2), monto_cambio DECIMAL(10,2), pagado TINYINT(1), id_usuario VARCHAR(50), fecha DATETIME, tipo_pedido VARCHAR(20))");
        $conn->query("CREATE TABLE IF NOT EXISTS detalles_venta (id VARCHAR(50) PRIMARY KEY, id_venta VARCHAR(50), id_insumo VARCHAR(50), codigo_producto VARCHAR(50), nombre_producto VARCHAR(100), cantidad INT, precio_unitario DECIMAL(10,2), subtotal DECIMAL(10,2), notas TEXT)");
        $conn->query("CREATE TABLE IF NOT EXISTS config (id INT PRIMARY KEY, nombre VARCHAR(100), telefono VARCHAR(50), logo TEXT, numeroMesas INT)");
        $conn->query("CREATE TABLE IF NOT EXISTS pedidos_temporales (
            id VARCHAR(50) PRIMARY KEY, id_mesa VARCHAR(20), id_insumo VARCHAR(50), cantidad INT, id_usuario VARCHAR(50), notas TEXT, estado VARCHAR(20), fecha_hora DATETIME, cliente VARCHAR(100), tipo_pedido VARCHAR(20)
        )");

        // Usuario Admin por defecto
        $adminPass = password_hash('admin123', PASSWORD_DEFAULT);
        $conn->query("INSERT IGNORE INTO usuarios (id, nombre, email, password_hash, rol) VALUES ('u1', 'Admin', 'admin@apprest.com', '$adminPass', 'admin')");
        $conn->query("INSERT IGNORE INTO config (id, nombre, telefono, logo, numeroMesas) VALUES (1, 'Mi Restaurante', '555-0000', '', 10)");

        send_response(["status" => "success"]);
    } else {
        send_response(["status" => "error", "message" => $conn->error]);
    }
}
// Login de Usuarios
elseif ($action === 'login') {
    $data = json_decode(file_get_contents("php://input"), true);
    $email = $conn->real_escape_string($data['email']);
    $pass = $data['password']; 
    
    $result = $conn->query("SELECT * FROM usuarios WHERE email = '$email'");
    if ($result && $result->num_rows > 0) {
        $user = $result->fetch_assoc();
        // Verificar Hash de contraseña
        if (password_verify($pass, $user['password_hash'])) {
            // Generar Token Nuevo
            $token = bin2hex(random_bytes(32));
            $uid = $user['id'];
            
            $updateSuccess = $conn->query("UPDATE usuarios SET token = '$token' WHERE id = '$uid'");
            if (!$updateSuccess) {
                // Intento de reparación si falta columna
                $conn->query("ALTER TABLE usuarios ADD COLUMN token VARCHAR(64)");
                $conn->query("UPDATE usuarios SET token = '$token' WHERE id = '$uid'");
            }
            
            $user['token'] = $token;
            unset($user['password_hash']); // No devolver hash al frontend
            send_response(["status" => "success", "user" => $user]);
        } else {
            send_response(["status" => "error", "message" => "Contraseña incorrecta"]);
        }
    } else {
        send_response(["status" => "error", "message" => "Usuario no encontrado"]);
    }
}
// Registro de Usuarios
elseif ($action === 'register') {
    $data = json_decode(file_get_contents("php://input"), true);
    $id = uniqid('u_');
    $nombre = $conn->real_escape_string($data['nombre']);
    $email = $conn->real_escape_string($data['email']);
    $pass = password_hash($data['password'], PASSWORD_DEFAULT);
    $rol = 'admin'; // Por defecto admin en versión monopuesto

    $check = $conn->query("SELECT id FROM usuarios WHERE email = '$email'");
    if ($check && $check->num_rows > 0) {
        send_response(["status" => "error", "message" => "El correo ya está registrado"]);
    } else {
        $checkCol = $conn->query("SHOW COLUMNS FROM usuarios LIKE 'token'");
        if ($checkCol && $checkCol->num_rows == 0) {
            $conn->query("ALTER TABLE usuarios ADD COLUMN token VARCHAR(64)");
        }

        $sql = "INSERT INTO usuarios (id, nombre, email, password_hash, rol) VALUES ('$id', '$nombre', '$email', '$pass', '$rol')";
        if ($conn->query($sql) === TRUE) {
            send_response(["status" => "success"]);
        } else {
            send_response(["status" => "error", "message" => $conn->error]);
        }
    }
}

// --- ENDPOINTS PROTEGIDOS (Requieren Token) ---
// A partir de aquí, si no hay token válido, se devuelve error 401
$currentUser = authenticate($conn);

// Subida de Imágenes
if ($action === 'upload') {
    if (isset($_FILES['image'])) {
        $file = $_FILES['image'];
        $ext = pathinfo($file['name'], PATHINFO_EXTENSION);
        $filename = uniqid() . '.' . $ext;
        $target = 'uploads/' . $filename;
        if (move_uploaded_file($file['tmp_name'], $target)) {
            $protocol = isset($_SERVER['HTTPS']) && $_SERVER['HTTPS'] === 'on' ? "https" : "http";
            $url = "$protocol://$_SERVER[HTTP_HOST]" . dirname($_SERVER['REQUEST_URI']) . "/$target";
            send_response(["status" => "success", "url" => $url]);
        } else {
            send_response(["status" => "error", "message" => "Fallo al mover archivo"]);
        }
    } else {
        send_response(["status" => "error", "message" => "No se envió imagen"]);
    }
}
// Logout (Invalida el token)
elseif ($action === 'logout') {
    $uid = $currentUser['id'];
    $conn->query("UPDATE usuarios SET token = NULL WHERE id = '$uid'");
    send_response(["status" => "success"]);
}
// Sincronización Completa
// Devuelve toda la info necesaria para que el TPV funcione (Insumos, Mesas, Ventas recientes)
elseif ($action === 'get_all_data') {
    $data = [];
    
    $resConfig = $conn->query("SELECT * FROM config WHERE id = 1");
    $data['config'] = ($resConfig && $resConfig->num_rows > 0) ? $resConfig->fetch_assoc() : null;

    $resUsers = $conn->query("SELECT id, nombre, email, rol FROM usuarios");
    $data['usuarios'] = ($resUsers) ? $resUsers->fetch_all(MYSQLI_ASSOC) : [];

    $resCats = $conn->query("SELECT * FROM categorias");
    $data['categorias'] = ($resCats) ? $resCats->fetch_all(MYSQLI_ASSOC) : [];

    $resInsumos = $conn->query("SELECT * FROM insumos");
    $data['insumos'] = ($resInsumos) ? $resInsumos->fetch_all(MYSQLI_ASSOC) : [];

    // Limitamos a las últimas 1000 ventas para no saturar
    $resVentas = $conn->query("SELECT * FROM ventas ORDER BY consecutivo DESC LIMIT 1000");
    $ventas = ($resVentas) ? $resVentas->fetch_all(MYSQLI_ASSOC) : [];
    $data['ventas'] = $ventas;

    // Obtener detalles de esas ventas
    if (count($ventas) > 0) {
        $ids = array_map(function($v) { return "'" . $v['id'] . "'"; }, $ventas);
        $idsStr = implode(',', $ids);
        $resDetalles = $conn->query("SELECT * FROM detalles_venta WHERE id_venta IN ($idsStr)");
        $data['detalles'] = ($resDetalles) ? $resDetalles->fetch_all(MYSQLI_ASSOC) : [];
    } else {
        $data['detalles'] = [];
    }

    $resTemp = $conn->query("SELECT * FROM pedidos_temporales");
    $data['pedidos_temporales'] = ($resTemp) ? $resTemp->fetch_all(MYSQLI_ASSOC) : [];

    send_response($data);
}
// Guardar Configuración del Negocio
elseif ($action === 'save_config') {
    $d = json_decode(file_get_contents("php://input"), true);
    $nombre = $conn->real_escape_string($d['nombre']);
    $tel = $conn->real_escape_string($d['telefono']);
    $logo = $conn->real_escape_string($d['logo']);
    $mesas = (int)$d['numeroMesas'];
    $sql = "UPDATE config SET nombre='$nombre', telefono='$tel', logo='$logo', numeroMesas=$mesas WHERE id=1";
    $conn->query($sql);
    send_response(["status" => "success"]);
}
// Gestión de Categorías (Upsert: Insertar o Actualizar)
elseif ($action === 'save_category') {
    $d = json_decode(file_get_contents("php://input"), true);
    $id = !empty($d['id']) ? $conn->real_escape_string($d['id']) : uniqid('c_');
    $nom = $conn->real_escape_string($d['nombre']);
    $tipo = $conn->real_escape_string($d['tipo']);
    $desc = $conn->real_escape_string($d['descripcion']);
    
    $sql = "INSERT INTO categorias (id, nombre, tipo, descripcion) VALUES ('$id', '$nom', '$tipo', '$desc') 
            ON DUPLICATE KEY UPDATE nombre='$nom', tipo='$tipo', descripcion='$desc'";
            
    if ($conn->query($sql)) {
        send_response(["status" => "success", "id" => $id]);
    } else {
        send_response(["status" => "error", "message" => $conn->error]);
    }
}
elseif ($action === 'delete_category') {
    $id = $conn->real_escape_string($_GET['id']);
    $conn->query("DELETE FROM categorias WHERE id='$id'");
    send_response(["status" => "success"]);
}
// Gestión de Productos (Upsert)
elseif ($action === 'save_product') {
    $d = json_decode(file_get_contents("php://input"), true);
    $id = !empty($d['id']) ? $conn->real_escape_string($d['id']) : uniqid('p_');
    $cod = $conn->real_escape_string($d['codigo']);
    $nom = $conn->real_escape_string($d['nombre']);
    $desc = $conn->real_escape_string($d['descripcion']);
    $pre = (float)$d['precio'];
    $tipo = $conn->real_escape_string($d['tipo']);
    $cat = $conn->real_escape_string($d['categoria_id']);
    $img = $conn->real_escape_string($d['imagen']);
    
    $sql = "INSERT INTO insumos (id, codigo, nombre, descripcion, precio, tipo, categoria_id, imagen) 
            VALUES ('$id', '$cod', '$nom', '$desc', $pre, '$tipo', '$cat', '$img') 
            ON DUPLICATE KEY UPDATE codigo='$cod', nombre='$nom', descripcion='$desc', precio=$pre, tipo='$tipo', categoria_id='$cat', imagen='$img'";
            
    if($conn->query($sql)) send_response(["status" => "success", "id" => $id]);
    else send_response(["status" => "error", "message" => $conn->error]);
}
elseif ($action === 'delete_product') {
    $id = $conn->real_escape_string($_GET['id']);
    $conn->query("DELETE FROM insumos WHERE id='$id'");
    send_response(["status" => "success"]);
}
// Guardar Venta (Cerrar Cuenta)
// Esta acción es transaccional: guarda cabecera y luego los detalles
elseif ($action === 'save_sale') {
    $d = json_decode(file_get_contents("php://input"), true);
    $v = $d['venta'];
    $detalles = $d['detalles'];

    $id = !empty($v['id']) ? $conn->real_escape_string($v['id']) : uniqid('v_');
    $consecutivo = (int)$v['consecutivo'];
    $id_mesa = $conn->real_escape_string($v['id_mesa']);
    $cliente = $conn->real_escape_string($v['cliente']);
    $total = (float)$v['total'];
    $monto_recibido = (float)$v['monto_recibido'];
    $monto_cambio = (float)$v['monto_cambio'];
    $id_usuario = $conn->real_escape_string($v['id_usuario']);
    $fecha = $conn->real_escape_string($v['fecha']);
    $tipo_pedido = $conn->real_escape_string($v['tipo_pedido']);

    $sqlV = "INSERT INTO ventas (id, consecutivo, id_mesa, cliente, total, monto_recibido, monto_cambio, pagado, id_usuario, fecha, tipo_pedido) 
             VALUES ('$id', $consecutivo, '$id_mesa', '$cliente', $total, $monto_recibido, $monto_cambio, 1, '$id_usuario', '$fecha', '$tipo_pedido')";
    
    if ($conn->query($sqlV)) {
        foreach($detalles as $det) {
            $id_d = !empty($det['id']) ? $conn->real_escape_string($det['id']) : uniqid('d_');
            $id_insumo = $conn->real_escape_string($det['id_insumo']);
            $codigo_prod = $conn->real_escape_string($det['codigo_producto']);
            $nombre_prod = $conn->real_escape_string($det['nombre_producto']);
            $cantidad = (int)$det['cantidad'];
            $precio_unit = (float)$det['precio_unitario'];
            $subtotal = (float)$det['subtotal'];
            $notas = $conn->real_escape_string($det['notas']);

            $sqlD = "INSERT INTO detalles_venta (id, id_venta, id_insumo, codigo_producto, nombre_producto, cantidad, precio_unitario, subtotal, notas) 
                     VALUES ('$id_d', '$id', '$id_insumo', '$codigo_prod', '$nombre_prod', $cantidad, $precio_unit, $subtotal, '$notas')";
            $conn->query($sqlD);
        }
        send_response(["status" => "success", "id" => $id]);
    } else {
        send_response(["status" => "error", "message" => "Error guardando venta: " . $conn->error]);
    }
}
// Guardar Pedido Temporal (Comanda)
// Usa UPSERT para actualizar cantidad si el producto ya existe en esa mesa
elseif ($action === 'save_temp_order') {
    $d = json_decode(file_get_contents("php://input"), true);
    
    $id = !empty($d['id']) ? $conn->real_escape_string($d['id']) : uniqid('t_');
    $idMesa = $conn->real_escape_string($d['id_mesa']);
    $idInsumo = $conn->real_escape_string($d['id_insumo']);
    $cantidad = (int)$d['cantidad'];
    $idUsuario = $conn->real_escape_string($d['id_usuario']);
    $notas = $conn->real_escape_string($d['notas']);
    $estado = $conn->real_escape_string($d['estado']);
    $fecha = $conn->real_escape_string($d['fecha_hora']);
    $cliente = $conn->real_escape_string($d['cliente'] ?? '');
    $tipo = $conn->real_escape_string($d['tipo_pedido'] ?? 'LOCAL');

    $sql = "INSERT INTO pedidos_temporales (id, id_mesa, id_insumo, cantidad, id_usuario, notas, estado, fecha_hora, cliente, tipo_pedido) 
            VALUES ('$id', '$idMesa', '$idInsumo', $cantidad, '$idUsuario', '$notas', '$estado', '$fecha', '$cliente', '$tipo')
            ON DUPLICATE KEY UPDATE cantidad=$cantidad, notas='$notas', estado='$estado', cliente='$cliente', tipo_pedido='$tipo'";
    
    if($conn->query($sql)) send_response(["status" => "success", "id" => $id]);
    else send_response(["status" => "error", "message" => $conn->error]);
}
elseif ($action === 'delete_temp_order') {
    $id = $conn->real_escape_string($_GET['id']);
    $conn->query("DELETE FROM pedidos_temporales WHERE id='$id'");
    send_response(["status" => "success"]);
}
// Vaciar Mesa (Eliminar todos los pedidos temporales de una mesa)
elseif ($action === 'clear_table') {
    $idMesa = $conn->real_escape_string($_GET['id_mesa']);
    $conn->query("DELETE FROM pedidos_temporales WHERE id_mesa='$idMesa'");
    send_response(["status" => "success"]);
}
// Actualizar Estado KDS (Pendiente -> Preparando -> Listo)
elseif ($action === 'update_order_status') {
    $d = json_decode(file_get_contents("php://input"), true);
    $id = $conn->real_escape_string($d['id']);
    $estado = $conn->real_escape_string($d['estado']);
    $conn->query("UPDATE pedidos_temporales SET estado='$estado' WHERE id='$id'");
    send_response(["status" => "success"]);
}
// Actualizar Meta-datos de Mesa (Cliente, Tipo Pedido)
elseif ($action === 'update_table_meta') {
    $d = json_decode(file_get_contents("php://input"), true);
    $idMesa = $conn->real_escape_string($d['id_mesa']);
    $cliente = $conn->real_escape_string($d['cliente']);
    $tipo = $conn->real_escape_string($d['tipo_pedido']);
    $conn->query("UPDATE pedidos_temporales SET cliente='$cliente', tipo_pedido='$tipo' WHERE id_mesa='$idMesa'");
    send_response(["status" => "success"]);
}
// Actualizar Perfil Usuario
elseif ($action === 'update_profile') {
    $d = json_decode(file_get_contents("php://input"), true);
    $id = $conn->real_escape_string($d['id']);
    
    // Seguridad: Solo el propio usuario puede editarse
    if ($currentUser['id'] !== $id) {
        send_response(["status" => "error", "message" => "No autorizado para editar este perfil"], 403);
    }

    $nombre = $conn->real_escape_string($d['nombre']);
    $email = $conn->real_escape_string($d['email']);
    
    $sql = "UPDATE usuarios SET nombre='$nombre', email='$email' WHERE id='$id'";
    if ($conn->query($sql) === TRUE) {
        send_response(["status" => "success"]);
    } else {
        send_response(["status" => "error", "message" => $conn->error]);
    }
}
// Cambio de Contraseña
elseif ($action === 'change_password') {
    $d = json_decode(file_get_contents("php://input"), true);
    $id = $conn->real_escape_string($d['id']);
    
    if ($currentUser['id'] !== $id) {
        send_response(["status" => "error", "message" => "No autorizado"], 403);
    }

    $actual = $d['actual'];
    $nueva = $d['nueva'];
    
    $check = $conn->query("SELECT * FROM usuarios WHERE id='$id'");
    if ($check && $check->num_rows > 0) {
        $user = $check->fetch_assoc();
        // Verificar contraseña actual antes de cambiar
        if (password_verify($actual, $user['password_hash'])) {
            $nuevaHash = password_hash($nueva, PASSWORD_DEFAULT);
            $sql = "UPDATE usuarios SET password_hash='$nuevaHash' WHERE id='$id'";
            if ($conn->query($sql) === TRUE) {
                send_response(["status" => "success"]);
            } else {
                send_response(["status" => "error", "message" => $conn->error]);
            }
        } else {
            send_response(["status" => "error", "message" => "Contraseña actual incorrecta"]);
        }
    } else {
        send_response(["status" => "error", "message" => "Usuario no encontrado"]);
    }
}

$conn->close();
?>