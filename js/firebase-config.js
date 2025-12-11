// Configuración de Firebase
// IMPORTANTE: Reemplaza estos valores con tu configuración real de Firebase
const firebaseConfig = {
    apiKey: "AIzaSyAMiD7jn5uY8RWkoqbQwe0louM-JQ_5HgY",
    authDomain: "padelpotatos.firebaseapp.com",
    projectId: "padelpotatos",
    storageBucket: "padelpotatos.firebasestorage.app",
    messagingSenderId: "1087228968044",
    appId: "1:1087228968044:web:94e69c11a6bb806a51ec49",
    measurementId: "G-QPNXK20BL0"
};

// Inicializar Firebase
firebase.initializeApp(firebaseConfig);

// Referencias a los servicios de Firebase
const auth = firebase.auth();
const db = firebase.firestore();

// Colecciones de Firestore
const COLLECTIONS = {
    USERS: 'users',
    USER_PROFILES: 'userProfiles',
    MATCHES: 'matches',
    PAIRS: 'pairs',
    STATISTICS: 'statistics'
};

// Estados de usuario
const USER_STATUS = {
    PENDING: 'pending',
    APPROVED: 'approved',
    DENIED: 'denied'
};

// Roles de usuario
const USER_ROLES = {
    SU: 'su',           // Super Usuario
    MEMBER: 'member'    // Miembro
};

// Estados de partidos
const MATCH_STATUS = {
    SCHEDULED: 'scheduled',     // Programado
    IN_PROGRESS: 'in_progress', // En curso
    COMPLETED: 'completed',     // Completado
    CANCELLED: 'cancelled'      // Cancelado
};

// Tipos de partido
const MATCH_TYPES = {
    FRIENDLY: 'friendly',       // Amistoso
    TOURNAMENT: 'tournament',   // Torneo
    LEAGUE: 'league'           // Liga
};

// Estados de parejas
const PAIR_STATUS = {
    ACTIVE: 'active',           // Pareja activa
    INACTIVE: 'inactive',       // Pareja disuelta
    TEMPORARY: 'temporary'      // Pareja temporal para un partido
};

// Estados de resultados
const RESULT_STATUS = {
    PENDING: 'pending',         // Sin resultado registrado
    COMPLETED: 'completed'      // Resultado registrado
};

// Formato de sets para pádel (primer set a ganar por pareja)
const PADEL_SETS = {
    SET_1: 'set1',
    SET_2: 'set2', 
    SET_3: 'set3'  // Super tie-break si es necesario
};

// Función para mostrar notificaciones
function showNotification(message, type = 'info') {
    const notification = document.createElement('div');
    notification.className = `notification ${type}`;
    notification.textContent = message;
    document.body.appendChild(notification);

    setTimeout(() => {
        notification.remove();
    }, 4000);
}

// Función para mostrar/ocultar loading
function showLoading(show = true) {
    const loading = document.getElementById('loading');
    loading.style.display = show ? 'flex' : 'none';
}

console.log('Firebase configurado correctamente');