// Archivo principal de la aplicación
class TournamentApp {
    constructor() {
        this.currentTab = 'administracion';
        this.initEventListeners();
    }

    // Inicializar event listeners
    initEventListeners() {
        document.addEventListener('DOMContentLoaded', () => {
            this.setupTabNavigation();
            this.setupFormValidation();
        });
    }

    // Configurar navegación entre pestañas
    setupTabNavigation() {
        const navButtons = document.querySelectorAll('.nav-btn');
        const tabContents = document.querySelectorAll('.tab-content');

        navButtons.forEach(button => {
            button.addEventListener('click', () => {
                const tabName = button.getAttribute('data-tab');
                this.switchTab(tabName);
                
                // Actualizar botones activos
                navButtons.forEach(btn => btn.classList.remove('active'));
                button.classList.add('active');
            });
        });
    }

    // Cambiar entre pestañas
    switchTab(tabName) {
        const tabContents = document.querySelectorAll('.tab-content');
        
        // Ocultar todas las pestañas
        tabContents.forEach(tab => {
            tab.classList.remove('active');
        });
        
        // Mostrar pestaña seleccionada
        const targetTab = document.getElementById(tabName + 'Tab');
        if (targetTab) {
            targetTab.classList.add('active');
            this.currentTab = tabName;
        }

        // Acciones específicas según la pestaña
        switch (tabName) {
            case 'administracion':
                this.handleAdminTab();
                break;
            case 'torneo':
                this.handleTournamentTab();
                break;
        }
    }

    // Manejar pestaña de administración
    handleAdminTab() {
        // Solo cargar datos de admin si el usuario es Super Usuario
        if (authManager && authManager.isSuperUser()) {
            adminManager.loadPendingUsers();
            adminManager.loadApprovedUsers();
        }
    }

    // Manejar pestaña del torneo
    handleTournamentTab() {
        // Aquí se implementará la lógica del torneo en futuras versiones
        console.log('Pestaña del torneo activada');
        
        // Por ahora solo verificar permisos
        if (authManager && !authManager.isApprovedMember() && !authManager.isSuperUser()) {
            document.querySelector('#torneoTab .tournament-info').innerHTML = `
                <p style="color: #e53e3e;">Necesitas ser un miembro aprobado para acceder al torneo.</p>
                <p style="color: #718096;">Tu solicitud está siendo revisada por un administrador.</p>
            `;
        }
    }

    // Configurar validación de formularios
    setupFormValidation() {
        // Validación del formulario de login
        const loginForm = document.getElementById('loginForm');
        if (loginForm) {
            const emailField = document.getElementById('email');
            const passwordField = document.getElementById('password');

            emailField.addEventListener('blur', this.validateEmail);
            passwordField.addEventListener('blur', this.validatePassword);
        }

        // Validación del formulario de registro
        const registerForm = document.getElementById('registerForm');
        if (registerForm) {
            const regEmailField = document.getElementById('regEmail');
            const regPasswordField = document.getElementById('regPassword');
            const regNameField = document.getElementById('regName');

            regEmailField.addEventListener('blur', this.validateEmail);
            regPasswordField.addEventListener('blur', this.validatePassword);
            regNameField.addEventListener('blur', this.validateName);
        }
    }

    // Validar email
    validateEmail(event) {
        const email = event.target.value;
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        
        if (email && !emailRegex.test(email)) {
            event.target.style.borderColor = '#e53e3e';
            showNotification('Email inválido', 'error');
        } else {
            event.target.style.borderColor = '#e2e8f0';
        }
    }

    // Validar contraseña
    validatePassword(event) {
        const password = event.target.value;
        
        if (password && password.length < 6) {
            event.target.style.borderColor = '#e53e3e';
            showNotification('La contraseña debe tener al menos 6 caracteres', 'error');
        } else {
            event.target.style.borderColor = '#e2e8f0';
        }
    }

    // Validar nombre
    validateName(event) {
        const name = event.target.value;
        
        if (name && name.length < 2) {
            event.target.style.borderColor = '#e53e3e';
            showNotification('El nombre debe tener al menos 2 caracteres', 'error');
        } else {
            event.target.style.borderColor = '#e2e8f0';
        }
    }

    // Obtener información del usuario actual
    getCurrentUserInfo() {
        if (authManager && authManager.userProfile) {
            return {
                email: authManager.userProfile.email,
                name: authManager.userProfile.name,
                role: authManager.userProfile.role,
                status: authManager.userProfile.status,
                isSU: authManager.isSuperUser(),
                isApproved: authManager.isApprovedMember()
            };
        }
        return null;
    }

    // Método para refrescar la aplicación
    refresh() {
        if (authManager && authManager.userProfile) {
            authManager.updateUserInterface();
            authManager.updateAdminPanels();
            
            if (this.currentTab === 'administracion') {
                this.handleAdminTab();
            } else if (this.currentTab === 'torneo') {
                this.handleTournamentTab();
            }
        }
    }
}

// Inicializar la aplicación
const tournamentApp = new TournamentApp();

// Funciones globales de utilidad
window.refreshApp = () => tournamentApp.refresh();

// Función para debugging - obtener información del usuario actual
window.getCurrentUser = () => tournamentApp.getCurrentUserInfo();

// Función para debugging - mostrar estadísticas
window.showUserStats = async () => {
    if (adminManager && authManager && authManager.isSuperUser()) {
        const stats = await adminManager.getUserStats();
        console.log('Estadísticas de usuarios:', stats);
        return stats;
    } else {
        console.log('Solo los Super Usuarios pueden ver estadísticas');
        return null;
    }
};

console.log('Aplicación del Torneo de Pádel inicializada correctamente');
console.log('Para crear el primer Super Usuario, usa: createFirstSU("email@ejemplo.com", "contraseña", "Nombre Admin")');