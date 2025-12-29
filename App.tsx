import React, { useState, useEffect } from 'react';
import { HashRouter, Routes, Route, Navigate } from 'react-router-dom';
import { LoginScreen, RegisterScreen, ForgotPasswordScreen } from './screens/AuthScreens';
import { ScreenFloorPlan, ScreenOrder, ScreenKDS, ScreenDailyReport } from './screens/POSScreens';
import { ScreenAdminDashboard, ScreenInventory, ScreenUsers, ScreenReports, ScreenDayClose, ScreenConfig, ScreenUserConfig } from './screens/AdminScreens';
import { ScreenProductManager, ScreenCategoryManager } from './screens/InventoryScreens';
import { dbService } from './services/dbService';

const App = () => {
    // Inicializar estado basado en si el servicio tiene un usuario cargado
    const [isAuthenticated, setIsAuthenticated] = useState(dbService.estaAutenticado());
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const initApp = async () => {
            // Esperar a que dbService cargue datos y verifique sesión
            await dbService.cargarDatosGenerales();
            setIsAuthenticated(dbService.estaAutenticado());
            setLoading(false);
        };
        initApp();

        const handleLogoutEvent = () => {
            setIsAuthenticated(false);
        };
        window.addEventListener('apprest-logout', handleLogoutEvent);

        return () => {
            window.removeEventListener('apprest-logout', handleLogoutEvent);
        };
    }, []);

    // Efecto para actualizar el título de la pestaña con el nombre del negocio
    useEffect(() => {
        const updateTitle = () => {
            const info = dbService.obtenerInfoNegocio();
            if (info && info.nombre && info.nombre !== "Cargando...") {
                document.title = info.nombre;
            } else {
                document.title = "AppRest POS";
            }
        };

        // Ejecutar inicialmente
        updateTitle();

        // Escuchar cambios en la configuración (ej. si cambian el nombre en Admin)
        window.addEventListener('apprest-config-updated', updateTitle);

        return () => {
            window.removeEventListener('apprest-config-updated', updateTitle);
        };
    }, []);

    const handleLogin = () => setIsAuthenticated(true);

    const ProtectedRoute = ({ children }: { children?: React.ReactNode }) => {
        if (loading) return <div className="h-screen w-full flex items-center justify-center bg-[#102216] text-white">Cargando...</div>;
        if (!isAuthenticated) {
            return <Navigate to="/login" replace />;
        }
        return <>{children}</>;
    };

    if (loading) return <div className="h-screen w-full flex items-center justify-center bg-[#102216] text-white">Iniciando Sistema...</div>;

    return (
        <HashRouter>
            <Routes>
                {/* Auth Routes */}
                <Route path="/login" element={isAuthenticated ? <Navigate to="/" /> : <LoginScreen onLogin={handleLogin} />} />
                <Route path="/register" element={<RegisterScreen />} />
                <Route path="/forgot-password" element={<ForgotPasswordScreen />} />

                {/* Protected POS Routes */}
                <Route path="/" element={<ProtectedRoute><ScreenFloorPlan /></ProtectedRoute>} />
                <Route path="/order" element={<ProtectedRoute><ScreenOrder /></ProtectedRoute>} />
                {/* Nueva ruta de ventas */}
                <Route path="/sales" element={<ProtectedRoute><ScreenDailyReport /></ProtectedRoute>} />
                <Route path="/kds" element={<ProtectedRoute><ScreenKDS /></ProtectedRoute>} />

                {/* Protected Admin Routes */}
                <Route path="/admin" element={<ProtectedRoute><ScreenAdminDashboard /></ProtectedRoute>} />
                <Route path="/admin/config" element={<ProtectedRoute><ScreenConfig /></ProtectedRoute>} />
                <Route path="/admin/profile" element={<ProtectedRoute><ScreenUserConfig /></ProtectedRoute>} />

                {/* New Inventory Management Routes */}
                <Route path="/admin/products" element={<ProtectedRoute><ScreenProductManager /></ProtectedRoute>} />
                <Route path="/admin/categories" element={<ProtectedRoute><ScreenCategoryManager /></ProtectedRoute>} />

                <Route path="/admin/inventory" element={<ProtectedRoute><ScreenInventory /></ProtectedRoute>} />
                <Route path="/admin/users" element={<ProtectedRoute><ScreenUsers /></ProtectedRoute>} />
                <Route path="/admin/reports" element={<ProtectedRoute><ScreenReports /></ProtectedRoute>} />
                <Route path="/admin/close" element={<ProtectedRoute><ScreenDayClose /></ProtectedRoute>} />
            </Routes>
        </HashRouter>
    );
};

export default App;