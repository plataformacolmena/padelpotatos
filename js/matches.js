// Sistema de gestión de partidos
class MatchManager {
    constructor() {
        this.matches = [];
        this.approvedMembers = [];
        this.initEventListeners();
    }

    // Inicializar event listeners
    initEventListeners() {
        document.addEventListener('DOMContentLoaded', () => {
            const toggleBtn = document.getElementById('toggleMatchForm');
            const cancelBtn = document.getElementById('cancelMatchForm');
            const createForm = document.getElementById('createMatchForm');

            if (toggleBtn) {
                toggleBtn.addEventListener('click', () => this.toggleMatchForm());
            }

            if (cancelBtn) {
                cancelBtn.addEventListener('click', () => this.hideMatchForm());
            }

            if (createForm) {
                createForm.addEventListener('submit', (e) => this.handleCreateMatch(e));
            }
        });
    }

    // Mostrar/ocultar formulario de crear partido
    toggleMatchForm() {
        const form = document.getElementById('matchForm');
        const isVisible = form.style.display !== 'none';
        
        if (isVisible) {
            this.hideMatchForm();
        } else {
            this.showMatchForm();
        }
    }

    // Mostrar formulario y cargar miembros
    async showMatchForm() {
        const form = document.getElementById('matchForm');
        form.style.display = 'block';
        
        // Cargar miembros aprobados para selección
        await this.loadApprovedMembersForSelection();
        
        // Scroll hasta el formulario
        form.scrollIntoView({ behavior: 'smooth' });
    }

    // Ocultar formulario
    hideMatchForm() {
        const form = document.getElementById('matchForm');
        form.style.display = 'none';
        
        // Resetear formulario
        const createForm = document.getElementById('createMatchForm');
        if (createForm) {
            createForm.reset();
        }
    }

    // Cargar miembros aprobados para el selector de jugadores
    async loadApprovedMembersForSelection() {
        try {
            const snapshot = await db.collection(COLLECTIONS.USER_PROFILES)
                .where('status', '==', USER_STATUS.APPROVED)
                .where('role', '==', USER_ROLES.MEMBER)
                .get();

            this.approvedMembers = [];
            snapshot.forEach(doc => {
                this.approvedMembers.push({
                    id: doc.id,
                    ...doc.data()
                });
            });

            this.renderPlayerSelection();
        } catch (error) {
            console.error('Error cargando miembros para selección:', error);
            showNotification('Error al cargar miembros', 'error');
        }
    }

    // Renderizar selector de jugadores
    renderPlayerSelection() {
        const container = document.getElementById('playerSelection');
        if (!container) return;

        if (this.approvedMembers.length === 0) {
            container.innerHTML = '<p style="color: #718096;">No hay miembros aprobados disponibles.</p>';
            return;
        }

        container.innerHTML = this.approvedMembers.map(member => `
            <div class="player-item">
                <input type="checkbox" id="player_${member.id}" value="${member.id}">
                <label for="player_${member.id}">
                    <strong>${member.name || 'Sin nombre'}</strong>
                    <span style="color: #718096; margin-left: 0.5rem;">${member.email}</span>
                </label>
            </div>
        `).join('');
    }

    // Manejar creación de partido
    async handleCreateMatch(event) {
        event.preventDefault();
        
        try {
            showLoading(true);
            
            // Obtener datos del formulario
            const formData = new FormData(event.target);
            const selectedPlayers = Array.from(document.querySelectorAll('#playerSelection input[type="checkbox"]:checked'))
                .map(checkbox => checkbox.value);

            // Validaciones
            if (selectedPlayers.length === 0) {
                showNotification('Debes seleccionar al menos un jugador', 'error');
                return;
            }

            const maxPlayers = parseInt(document.getElementById('maxPlayers').value);
            if (selectedPlayers.length > maxPlayers) {
                showNotification(`No puedes seleccionar más de ${maxPlayers} jugadores`, 'error');
                return;
            }

            // Crear objeto del partido
            const matchData = {
                date: new Date(document.getElementById('matchDate').value),
                type: document.getElementById('matchType').value,
                location: document.getElementById('matchLocation').value,
                maxPlayers: maxPlayers,
                description: document.getElementById('matchDescription').value,
                status: MATCH_STATUS.SCHEDULED,
                players: selectedPlayers,
                createdBy: authManager.currentUser.uid,
                createdAt: firebase.firestore.FieldValue.serverTimestamp(),
                updatedAt: firebase.firestore.FieldValue.serverTimestamp()
            };

            // Guardar en Firestore
            const docRef = await db.collection(COLLECTIONS.MATCHES).add(matchData);
            
            showNotification('Partido creado exitosamente', 'success');
            this.hideMatchForm();
            
            // Recargar lista de partidos
            await this.loadMatches();
            
        } catch (error) {
            console.error('Error creando partido:', error);
            showNotification('Error al crear partido', 'error');
        } finally {
            showLoading(false);
        }
    }

    // Cargar todos los partidos
    async loadMatches() {
        try {
            const snapshot = await db.collection(COLLECTIONS.MATCHES)
                .orderBy('date', 'asc')
                .get();

            this.matches = [];
            snapshot.forEach(doc => {
                this.matches.push({
                    id: doc.id,
                    ...doc.data()
                });
            });

            await this.renderMatchesList();
        } catch (error) {
            console.error('Error cargando partidos:', error);
            showNotification('Error al cargar partidos', 'error');
        }
    }

    // Renderizar lista de partidos para administradores
    async renderMatchesList() {
        const container = document.getElementById('matchesList');
        if (!container) return;

        if (this.matches.length === 0) {
            container.innerHTML = '<p style="text-align: center; color: #718096; padding: 2rem;">No hay partidos programados.</p>';
            return;
        }

        // Obtener información de jugadores
        const playerPromises = this.matches.map(match => this.getPlayersInfo(match.players || []));
        const playersData = await Promise.all(playerPromises);

        container.innerHTML = this.matches.map((match, index) => {
            const players = playersData[index];
            const date = match.date?.toDate ? match.date.toDate() : new Date(match.date);
            
            return `
                <div class="match-card">
                    <div class="match-header">
                        <span class="match-type ${match.type}">${this.getTypeLabel(match.type)}</span>
                        <span class="match-status ${match.status}">${this.getStatusLabel(match.status)}</span>
                    </div>
                    
                    <div class="match-info">
                        <h4>${match.location}</h4>
                        <div class="match-details">
                            <p><strong>📅 Fecha:</strong> ${this.formatDate(date)}</p>
                            <p><strong>⏰ Hora:</strong> ${this.formatTime(date)}</p>
                            <p><strong>👥 Jugadores:</strong> ${players.length}/${match.maxPlayers}</p>
                            ${match.description ? `<p><strong>📝 Descripción:</strong> ${match.description}</p>` : ''}
                        </div>
                    </div>
                    
                    ${players.length > 0 ? `
                        <div class="match-players">
                            <h5>Jugadores:</h5>
                            <div class="players-list">
                                ${players.map(player => `<span class="player-tag">${player.name || 'Sin nombre'}</span>`).join('')}
                            </div>
                        </div>
                    ` : ''}
                    
                    <div class="match-actions">
                        <button class="btn btn-primary btn-small" onclick="matchManager.editMatch('${match.id}')">
                            Editar
                        </button>
                        <button class="btn btn-secondary btn-small" onclick="matchManager.updateMatchStatus('${match.id}')">
                            Cambiar Estado
                        </button>
                        <button class="btn btn-danger btn-small" onclick="matchManager.deleteMatch('${match.id}')">
                            Eliminar
                        </button>
                    </div>
                </div>
            `;
        }).join('');
    }

    // Obtener información de jugadores
    async getPlayersInfo(playerIds) {
        if (!playerIds || playerIds.length === 0) return [];

        try {
            const players = [];
            for (const playerId of playerIds) {
                const doc = await db.collection(COLLECTIONS.USER_PROFILES).doc(playerId).get();
                if (doc.exists) {
                    players.push({ id: doc.id, ...doc.data() });
                }
            }
            return players;
        } catch (error) {
            console.error('Error obteniendo información de jugadores:', error);
            return [];
        }
    }

    // Actualizar estado del partido
    async updateMatchStatus(matchId) {
        const currentMatch = this.matches.find(m => m.id === matchId);
        if (!currentMatch) return;

        const statusOptions = [
            { value: MATCH_STATUS.SCHEDULED, label: 'Programado' },
            { value: MATCH_STATUS.IN_PROGRESS, label: 'En curso' },
            { value: MATCH_STATUS.COMPLETED, label: 'Completado' },
            { value: MATCH_STATUS.CANCELLED, label: 'Cancelado' }
        ];

        const currentStatus = currentMatch.status;
        const newStatus = prompt(`Estado actual: ${this.getStatusLabel(currentStatus)}\n\nSelecciona nuevo estado:\n${statusOptions.map((s, i) => `${i + 1}. ${s.label}`).join('\n')}`);

        if (newStatus && parseInt(newStatus) >= 1 && parseInt(newStatus) <= 4) {
            const selectedStatus = statusOptions[parseInt(newStatus) - 1];
            
            try {
                showLoading(true);
                await db.collection(COLLECTIONS.MATCHES).doc(matchId).update({
                    status: selectedStatus.value,
                    updatedAt: firebase.firestore.FieldValue.serverTimestamp()
                });

                showNotification(`Estado actualizado a: ${selectedStatus.label}`, 'success');
                await this.loadMatches();
            } catch (error) {
                console.error('Error actualizando estado:', error);
                showNotification('Error al actualizar estado', 'error');
            } finally {
                showLoading(false);
            }
        }
    }

    // Eliminar partido
    async deleteMatch(matchId) {
        if (!confirm('¿Estás seguro de que quieres eliminar este partido?')) {
            return;
        }

        try {
            showLoading(true);
            await db.collection(COLLECTIONS.MATCHES).doc(matchId).delete();
            
            showNotification('Partido eliminado exitosamente', 'success');
            await this.loadMatches();
        } catch (error) {
            console.error('Error eliminando partido:', error);
            showNotification('Error al eliminar partido', 'error');
        } finally {
            showLoading(false);
        }
    }

    // Funciones de utilidad
    getTypeLabel(type) {
        switch (type) {
            case MATCH_TYPES.FRIENDLY: return 'Amistoso';
            case MATCH_TYPES.TOURNAMENT: return 'Torneo';
            case MATCH_TYPES.LEAGUE: return 'Liga';
            default: return 'Desconocido';
        }
    }

    getStatusLabel(status) {
        switch (status) {
            case MATCH_STATUS.SCHEDULED: return 'Programado';
            case MATCH_STATUS.IN_PROGRESS: return 'En curso';
            case MATCH_STATUS.COMPLETED: return 'Completado';
            case MATCH_STATUS.CANCELLED: return 'Cancelado';
            default: return 'Desconocido';
        }
    }

    formatDate(date) {
        return date.toLocaleDateString('es-ES', {
            year: 'numeric',
            month: 'long',
            day: 'numeric'
        });
    }

    formatTime(date) {
        return date.toLocaleTimeString('es-ES', {
            hour: '2-digit',
            minute: '2-digit'
        });
    }

    // Función placeholder para editar partido
    editMatch(matchId) {
        showNotification('Función de edición en desarrollo', 'info');
        // TODO: Implementar edición de partidos
    }
}

// Instancia global del manager de partidos
const matchManager = new MatchManager();