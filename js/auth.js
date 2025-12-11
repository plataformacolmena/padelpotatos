// Sistema de autenticación
class AuthManager {
    constructor() {
        this.currentUser = null;
        this.userProfile = null;
        this.initAuthStateListener();
    }

    // Escuchar cambios en el estado de autenticación
    initAuthStateListener() {
        auth.onAuthStateChanged(async (user) => {
            showLoading(true);
            if (user) {
                this.currentUser = user;
                await this.loadUserProfile();
                this.showMainApp();
            } else {
                this.currentUser = null;
                this.userProfile = null;
                this.showLoginScreen();
            }
            showLoading(false);
        });
    }

    // Cargar perfil del usuario desde Firestore
    async loadUserProfile() {
        try {
            const userDoc = await db.collection(COLLECTIONS.USER_PROFILES).doc(this.currentUser.uid).get();
            
            if (userDoc.exists) {
                this.userProfile = userDoc.data();
            } else {
                // Si es un nuevo usuario, crear perfil inicial
                this.userProfile = {
                    email: this.currentUser.email,
                    name: '',
                    role: USER_ROLES.MEMBER,
                    status: USER_STATUS.PENDING,
                    createdAt: firebase.firestore.FieldValue.serverTimestamp()
                };
                
                await db.collection(COLLECTIONS.USER_PROFILES).doc(this.currentUser.uid).set(this.userProfile);
            }
            
            this.updateUserInterface();
        } catch (error) {
            console.error('Error cargando perfil de usuario:', error);
            showNotification('Error al cargar el perfil de usuario', 'error');
        }
    }

    // Actualizar la interfaz con información del usuario
    updateUserInterface() {
        const userEmailElement = document.getElementById('userEmail');
        const userRoleElement = document.getElementById('userRole');
        
        if (userEmailElement && userRoleElement) {
            userEmailElement.textContent = this.userProfile.email;
            
            // Configurar rol y estado
            let roleText = '';
            let roleClass = '';
            
            if (this.userProfile.role === USER_ROLES.SU) {
                roleText = 'Super Usuario';
                roleClass = 'su';
            } else {
                switch (this.userProfile.status) {
                    case USER_STATUS.APPROVED:
                        roleText = 'Miembro';
                        roleClass = 'member';
                        break;
                    case USER_STATUS.PENDING:
                        roleText = 'Pendiente';
                        roleClass = 'pending';
                        break;
                    case USER_STATUS.DENIED:
                        roleText = 'Denegado';
                        roleClass = 'denied';
                        break;
                }
            }
            
            userRoleElement.textContent = roleText;
            userRoleElement.className = `user-role ${roleClass}`;
        }
    }

    // Mostrar pantalla de login
    showLoginScreen() {
        document.getElementById('loginScreen').style.display = 'flex';
        document.getElementById('registerScreen').style.display = 'none';
        document.getElementById('mainContent').style.display = 'none';
        document.getElementById('mainNav').style.display = 'none';
    }

    // Mostrar pantalla de registro
    showRegisterScreen() {
        document.getElementById('loginScreen').style.display = 'none';
        document.getElementById('registerScreen').style.display = 'flex';
        document.getElementById('mainContent').style.display = 'none';
        document.getElementById('mainNav').style.display = 'none';
    }

    // Mostrar aplicación principal
    showMainApp() {
        document.getElementById('loginScreen').style.display = 'none';
        document.getElementById('registerScreen').style.display = 'none';
        document.getElementById('mainContent').style.display = 'block';
        document.getElementById('mainNav').style.display = 'flex';
        
        // Mostrar el panel apropiado según el rol y estado
        this.updateAdminPanels();
    }

    // Actualizar paneles de administración según rol
    updateAdminPanels() {
        const adminPanel = document.getElementById('adminPanel');
        const memberPanel = document.getElementById('memberPanel');
        const accessDenied = document.getElementById('accessDenied');
        
        // Ocultar todos primero
        adminPanel.style.display = 'none';
        memberPanel.style.display = 'none';
        accessDenied.style.display = 'none';
        
        if (this.userProfile.role === USER_ROLES.SU) {
            // Super Usuario ve el panel de administración
            adminPanel.style.display = 'block';
            // Cargar datos de administración
            if (window.adminManager) {
                window.adminManager.loadPendingUsers();
                window.adminManager.loadApprovedUsers();
            }
        } else {
            // Miembros ven diferentes pantallas según su estado
            switch (this.userProfile.status) {
                case USER_STATUS.APPROVED:
                    memberPanel.style.display = 'block';
                    document.getElementById('memberStatus').textContent = '¡Tu membresía ha sido aprobada! Tienes acceso completo al torneo.';
                    break;
                case USER_STATUS.PENDING:
                    memberPanel.style.display = 'block';
                    document.getElementById('memberStatus').textContent = 'Tu solicitud está siendo revisada por un administrador.';
                    break;
                case USER_STATUS.DENIED:
                    accessDenied.style.display = 'block';
                    break;
            }
        }
    }

    // Iniciar sesión
    async login(email, password) {
        try {
            showLoading(true);
            await auth.signInWithEmailAndPassword(email, password);
            showNotification('Inicio de sesión exitoso', 'success');
        } catch (error) {
            console.error('Error en login:', error);
            let message = 'Error al iniciar sesión';
            
            switch (error.code) {
                case 'auth/user-not-found':
                    message = 'Usuario no encontrado';
                    break;
                case 'auth/wrong-password':
                    message = 'Contraseña incorrecta';
                    break;
                case 'auth/invalid-email':
                    message = 'Email inválido';
                    break;
                case 'auth/user-disabled':
                    message = 'Usuario deshabilitado';
                    break;
            }
            
            showNotification(message, 'error');
            showLoading(false);
        }
    }

    // Registrar nuevo usuario
    async register(email, password, name) {
        try {
            showLoading(true);
            const userCredential = await auth.createUserWithEmailAndPassword(email, password);
            
            // Crear perfil de usuario en Firestore
            const userProfile = {
                email: email,
                name: name,
                role: USER_ROLES.MEMBER,
                status: USER_STATUS.PENDING,
                createdAt: firebase.firestore.FieldValue.serverTimestamp()
            };
            
            await db.collection(COLLECTIONS.USER_PROFILES).doc(userCredential.user.uid).set(userProfile);
            
            showNotification('Registro exitoso. Tu solicitud será revisada por un administrador.', 'success');
        } catch (error) {
            console.error('Error en registro:', error);
            let message = 'Error al registrarse';
            
            switch (error.code) {
                case 'auth/email-already-in-use':
                    message = 'El email ya está registrado';
                    break;
                case 'auth/invalid-email':
                    message = 'Email inválido';
                    break;
                case 'auth/weak-password':
                    message = 'La contraseña es muy débil';
                    break;
            }
            
            showNotification(message, 'error');
            showLoading(false);
        }
    }

    // Cerrar sesión
    async logout() {
        try {
            await auth.signOut();
            showNotification('Sesión cerrada correctamente', 'success');
        } catch (error) {
            console.error('Error al cerrar sesión:', error);
            showNotification('Error al cerrar sesión', 'error');
        }
    }

    // Verificar si el usuario actual es Super Usuario
    isSuperUser() {
        return this.userProfile && this.userProfile.role === USER_ROLES.SU;
    }

    // Verificar si el usuario actual es miembro aprobado
    isApprovedMember() {
        return this.userProfile && 
               this.userProfile.role === USER_ROLES.MEMBER && 
               this.userProfile.status === USER_STATUS.APPROVED;
    }
}

// Instancia global del manager de autenticación
const authManager = new AuthManager();

// Event listeners para los formularios de autenticación
document.addEventListener('DOMContentLoaded', function() {
    // Form de login
    const loginForm = document.getElementById('loginForm');
    if (loginForm) {
        loginForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const email = document.getElementById('email').value;
            const password = document.getElementById('password').value;
            await authManager.login(email, password);
        });
    }

    // Form de registro
    const registerForm = document.getElementById('registerForm');
    if (registerForm) {
        registerForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const email = document.getElementById('regEmail').value;
            const password = document.getElementById('regPassword').value;
            const name = document.getElementById('regName').value;
            await authManager.register(email, password, name);
        });
    }

    // Enlaces para cambiar entre login y registro
    const showRegisterLink = document.getElementById('showRegister');
    if (showRegisterLink) {
        showRegisterLink.addEventListener('click', (e) => {
            e.preventDefault();
            authManager.showRegisterScreen();
        });
    }

    const showLoginLink = document.getElementById('showLogin');
    if (showLoginLink) {
        showLoginLink.addEventListener('click', (e) => {
            e.preventDefault();
            authManager.showLoginScreen();
        });
    }

    // Botón de logout
    const logoutBtn = document.getElementById('logoutBtn');
    if (logoutBtn) {
        logoutBtn.addEventListener('click', async () => {
            await authManager.logout();
        });
    }
});