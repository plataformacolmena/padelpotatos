// Sistema de administración para gestión de usuarios
class AdminManager {
    constructor() {
        this.pendingUsers = [];
        this.approvedUsers = [];
    }

    // Cargar usuarios pendientes de aprobación
    async loadPendingUsers() {
        try {
            const snapshot = await db.collection(COLLECTIONS.USER_PROFILES)
                .where('status', '==', USER_STATUS.PENDING)
                .orderBy('createdAt', 'desc')
                .get();

            this.pendingUsers = [];
            snapshot.forEach(doc => {
                this.pendingUsers.push({
                    id: doc.id,
                    ...doc.data()
                });
            });

            this.renderPendingUsers();
        } catch (error) {
            console.error('Error cargando usuarios pendientes:', error);
            showNotification('Error al cargar usuarios pendientes', 'error');
        }
    }

    // Cargar usuarios aprobados
    async loadApprovedUsers() {
        try {
            const snapshot = await db.collection(COLLECTIONS.USER_PROFILES)
                .where('status', '==', USER_STATUS.APPROVED)
                .where('role', '==', USER_ROLES.MEMBER)
                .orderBy('createdAt', 'desc')
                .get();

            this.approvedUsers = [];
            snapshot.forEach(doc => {
                this.approvedUsers.push({
                    id: doc.id,
                    ...doc.data()
                });
            });

            this.renderApprovedUsers();
        } catch (error) {
            console.error('Error cargando usuarios aprobados:', error);
            showNotification('Error al cargar usuarios aprobados', 'error');
        }
    }

    // Renderizar lista de usuarios pendientes
    renderPendingUsers() {
        const container = document.getElementById('pendingUsers');
        if (!container) return;

        if (this.pendingUsers.length === 0) {
            container.innerHTML = '<p style="text-align: center; color: #718096; padding: 2rem;">No hay solicitudes pendientes.</p>';
            return;
        }

        container.innerHTML = this.pendingUsers.map(user => `
            <div class="user-card">
                <div class="user-info-card">
                    <h4>${user.name || 'Sin nombre'}</h4>
                    <p><strong>Email:</strong> ${user.email}</p>
                    <p><strong>Fecha de solicitud:</strong> ${this.formatDate(user.createdAt)}</p>
                </div>
                <div class="user-actions">
                    <button class="btn btn-success" onclick="adminManager.approveUser('${user.id}')">
                        Aprobar
                    </button>
                    <button class="btn btn-danger" onclick="adminManager.denyUser('${user.id}')">
                        Denegar
                    </button>
                </div>
            </div>
        `).join('');
    }

    // Renderizar lista de usuarios aprobados
    renderApprovedUsers() {
        const container = document.getElementById('approvedUsers');
        if (!container) return;

        if (this.approvedUsers.length === 0) {
            container.innerHTML = '<p style="text-align: center; color: #718096; padding: 2rem;">No hay miembros aprobados.</p>';
            return;
        }

        container.innerHTML = this.approvedUsers.map(user => `
            <div class="user-card">
                <div class="user-info-card">
                    <h4>${user.name || 'Sin nombre'}</h4>
                    <p><strong>Email:</strong> ${user.email}</p>
                    <p><strong>Miembro desde:</strong> ${this.formatDate(user.approvedAt || user.createdAt)}</p>
                </div>
                <div class="user-actions">
                    <button class="btn btn-danger" onclick="adminManager.revokeUser('${user.id}')">
                        Revocar Acceso
                    </button>
                </div>
            </div>
        `).join('');
    }

    // Aprobar usuario
    async approveUser(userId) {
        try {
            showLoading(true);
            
            await db.collection(COLLECTIONS.USER_PROFILES).doc(userId).update({
                status: USER_STATUS.APPROVED,
                approvedAt: firebase.firestore.FieldValue.serverTimestamp(),
                approvedBy: authManager.currentUser.uid
            });

            showNotification('Usuario aprobado exitosamente', 'success');
            
            // Recargar listas
            await this.loadPendingUsers();
            await this.loadApprovedUsers();
            
        } catch (error) {
            console.error('Error aprobando usuario:', error);
            showNotification('Error al aprobar usuario', 'error');
        } finally {
            showLoading(false);
        }
    }

    // Denegar usuario
    async denyUser(userId) {
        if (!confirm('¿Estás seguro de que quieres denegar esta solicitud?')) {
            return;
        }

        try {
            showLoading(true);
            
            await db.collection(COLLECTIONS.USER_PROFILES).doc(userId).update({
                status: USER_STATUS.DENIED,
                deniedAt: firebase.firestore.FieldValue.serverTimestamp(),
                deniedBy: authManager.currentUser.uid
            });

            showNotification('Solicitud denegada', 'success');
            
            // Recargar lista de pendientes
            await this.loadPendingUsers();
            
        } catch (error) {
            console.error('Error denegando usuario:', error);
            showNotification('Error al denegar usuario', 'error');
        } finally {
            showLoading(false);
        }
    }

    // Revocar acceso de usuario aprobado
    async revokeUser(userId) {
        if (!confirm('¿Estás seguro de que quieres revocar el acceso de este miembro?')) {
            return;
        }

        try {
            showLoading(true);
            
            await db.collection(COLLECTIONS.USER_PROFILES).doc(userId).update({
                status: USER_STATUS.DENIED,
                revokedAt: firebase.firestore.FieldValue.serverTimestamp(),
                revokedBy: authManager.currentUser.uid
            });

            showNotification('Acceso revocado exitosamente', 'success');
            
            // Recargar listas
            await this.loadApprovedUsers();
            
        } catch (error) {
            console.error('Error revocando acceso:', error);
            showNotification('Error al revocar acceso', 'error');
        } finally {
            showLoading(false);
        }
    }

    // Formatear fecha para mostrar
    formatDate(timestamp) {
        if (!timestamp) return 'Fecha no disponible';
        
        let date;
        if (timestamp.toDate) {
            // Firestore Timestamp
            date = timestamp.toDate();
        } else if (timestamp instanceof Date) {
            date = timestamp;
        } else {
            return 'Fecha inválida';
        }

        return date.toLocaleDateString('es-ES', {
            year: 'numeric',
            month: 'long',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });
    }

    // Estadísticas de usuarios
    async getUserStats() {
        try {
            const [pendingSnapshot, approvedSnapshot, deniedSnapshot] = await Promise.all([
                db.collection(COLLECTIONS.USER_PROFILES).where('status', '==', USER_STATUS.PENDING).get(),
                db.collection(COLLECTIONS.USER_PROFILES).where('status', '==', USER_STATUS.APPROVED).get(),
                db.collection(COLLECTIONS.USER_PROFILES).where('status', '==', USER_STATUS.DENIED).get()
            ]);

            return {
                pending: pendingSnapshot.size,
                approved: approvedSnapshot.size,
                denied: deniedSnapshot.size,
                total: pendingSnapshot.size + approvedSnapshot.size + deniedSnapshot.size
            };
        } catch (error) {
            console.error('Error obteniendo estadísticas:', error);
            return null;
        }
    }


}

// Instancia global del manager de administración
const adminManager = new AdminManager();



// Escuchar cambios en tiempo real para usuarios pendientes (opcional)
function startRealtimeListeners() {
    if (!authManager.isSuperUser()) return;

    // Listener para usuarios pendientes
    db.collection(COLLECTIONS.USER_PROFILES)
        .where('status', '==', USER_STATUS.PENDING)
        .onSnapshot(snapshot => {
            adminManager.loadPendingUsers();
        });

    // Listener para usuarios aprobados
    db.collection(COLLECTIONS.USER_PROFILES)
        .where('status', '==', USER_STATUS.APPROVED)
        .where('role', '==', USER_ROLES.MEMBER)
        .onSnapshot(snapshot => {
            adminManager.loadApprovedUsers();
        });
}

// Inicializar listeners cuando el usuario esté autenticado
auth.onAuthStateChanged(user => {
    if (user && authManager.isSuperUser()) {
        setTimeout(startRealtimeListeners, 1000);
    }
});