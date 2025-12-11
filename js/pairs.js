// Sistema de gestión de parejas
class PairManager {
    constructor() {
        this.pairs = [];
        this.approvedMembers = [];
        this.initEventListeners();
    }

    // Inicializar event listeners
    initEventListeners() {
        document.addEventListener('DOMContentLoaded', () => {
            const toggleBtn = document.getElementById('togglePairForm');
            const cancelBtn = document.getElementById('cancelPairForm');
            const createForm = document.getElementById('createPairForm');

            if (toggleBtn) {
                toggleBtn.addEventListener('click', () => this.togglePairForm());
            }

            if (cancelBtn) {
                cancelBtn.addEventListener('click', () => this.hidePairForm());
            }

            if (createForm) {
                createForm.addEventListener('submit', (e) => this.handleCreatePair(e));
            }
        });
    }

    // Mostrar/ocultar formulario de crear pareja
    togglePairForm() {
        const form = document.getElementById('pairForm');
        const isVisible = form.style.display !== 'none';
        
        if (isVisible) {
            this.hidePairForm();
        } else {
            this.showPairForm();
        }
    }

    // Mostrar formulario y cargar miembros
    async showPairForm() {
        const form = document.getElementById('pairForm');
        form.style.display = 'block';
        
        // Cargar miembros aprobados para selección
        await this.loadApprovedMembersForPairs();
        
        // Scroll hasta el formulario
        form.scrollIntoView({ behavior: 'smooth' });
    }

    // Ocultar formulario
    hidePairForm() {
        const form = document.getElementById('pairForm');
        form.style.display = 'none';
        
        // Resetear formulario
        const createForm = document.getElementById('createPairForm');
        if (createForm) {
            createForm.reset();
        }
    }

    // Cargar miembros aprobados para el selector de parejas
    async loadApprovedMembersForPairs() {
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

            await this.renderPlayerSelectionForPairs();
        } catch (error) {
            console.error('Error cargando miembros para parejas:', error);
            showNotification('Error al cargar miembros', 'error');
        }
    }

    // Renderizar selector de jugadores para parejas
    async renderPlayerSelectionForPairs() {
        const container = document.getElementById('playerSelectionForPair');
        if (!container) return;

        if (this.approvedMembers.length === 0) {
            container.innerHTML = '<p style="color: #718096;">No hay miembros aprobados disponibles.</p>';
            return;
        }

        // Obtener miembros que ya están en parejas activas
        const membersInActivePairs = await this.getMembersInActivePairs();

        container.innerHTML = this.approvedMembers.map(member => {
            const isInActivePair = membersInActivePairs.includes(member.id);
            const disabledAttr = isInActivePair ? 'disabled' : '';
            const statusText = isInActivePair ? ' (Ya en pareja activa)' : '';
            
            return `
                <div class="player-item">
                    <input type="checkbox" id="pair_player_${member.id}" value="${member.id}" ${disabledAttr}>
                    <label for="pair_player_${member.id}" style="${isInActivePair ? 'color: #a0aec0;' : ''}">
                        <strong>${member.name || 'Sin nombre'}</strong>
                        <span style="color: #718096; margin-left: 0.5rem;">${member.email}${statusText}</span>
                    </label>
                </div>
            `;
        }).join('');

        // Agregar listener para validar selección de exactamente 2 jugadores
        container.addEventListener('change', (e) => {
            if (e.target.type === 'checkbox') {
                this.validatePairSelection();
            }
        });
    }

    // Obtener miembros que ya están en parejas activas
    async getMembersInActivePairs() {
        try {
            const snapshot = await db.collection(COLLECTIONS.PAIRS)
                .where('status', '==', PAIR_STATUS.ACTIVE)
                .get();

            const membersInPairs = [];
            snapshot.forEach(doc => {
                const pairData = doc.data();
                if (pairData.players) {
                    membersInPairs.push(...pairData.players);
                }
            });

            return membersInPairs;
        } catch (error) {
            console.error('Error obteniendo miembros en parejas:', error);
            return [];
        }
    }

    // Validar que se seleccionen exactamente 2 jugadores
    validatePairSelection() {
        const checkboxes = document.querySelectorAll('#playerSelectionForPair input[type="checkbox"]:checked');
        const submitBtn = document.querySelector('#createPairForm button[type="submit"]');
        
        if (checkboxes.length === 2) {
            submitBtn.disabled = false;
            submitBtn.textContent = 'Crear Pareja';
        } else if (checkboxes.length > 2) {
            // Desmarcar el último seleccionado si hay más de 2
            const lastChecked = Array.from(checkboxes).pop();
            lastChecked.checked = false;
            showNotification('Solo puedes seleccionar 2 jugadores por pareja', 'info');
        } else {
            submitBtn.disabled = true;
            submitBtn.textContent = `Selecciona ${2 - checkboxes.length} jugador(es) más`;
        }
    }

    // Manejar creación de pareja
    async handleCreatePair(event) {
        event.preventDefault();
        
        try {
            showLoading(true);
            
            // Obtener datos del formulario
            const selectedPlayers = Array.from(document.querySelectorAll('#playerSelectionForPair input[type="checkbox"]:checked'))
                .map(checkbox => checkbox.value);

            // Validaciones
            if (selectedPlayers.length !== 2) {
                showNotification('Debes seleccionar exactamente 2 jugadores', 'error');
                return;
            }

            // Verificar que los jugadores no estén ya en parejas activas
            const membersInActivePairs = await this.getMembersInActivePairs();
            const conflictingMembers = selectedPlayers.filter(playerId => membersInActivePairs.includes(playerId));
            
            if (conflictingMembers.length > 0) {
                showNotification('Uno o más jugadores ya están en una pareja activa', 'error');
                return;
            }

            // Crear objeto de la pareja
            const pairData = {
                name: document.getElementById('pairName').value,
                players: selectedPlayers,
                status: document.getElementById('pairStatus').value,
                createdBy: authManager.currentUser.uid,
                createdAt: firebase.firestore.FieldValue.serverTimestamp(),
                updatedAt: firebase.firestore.FieldValue.serverTimestamp()
            };

            // Guardar en Firestore
            const docRef = await db.collection(COLLECTIONS.PAIRS).add(pairData);
            
            showNotification('Pareja creada exitosamente', 'success');
            this.hidePairForm();
            
            // Recargar lista de parejas
            await this.loadPairs();
            
        } catch (error) {
            console.error('Error creando pareja:', error);
            showNotification('Error al crear pareja', 'error');
        } finally {
            showLoading(false);
        }
    }

    // Cargar todas las parejas
    async loadPairs() {
        try {
            const snapshot = await db.collection(COLLECTIONS.PAIRS)
                .orderBy('createdAt', 'desc')
                .get();

            this.pairs = [];
            snapshot.forEach(doc => {
                this.pairs.push({
                    id: doc.id,
                    ...doc.data()
                });
            });

            await this.renderPairsList();
        } catch (error) {
            console.error('Error cargando parejas:', error);
            
            if (error.code === 'permission-denied') {
                console.log('⚠️ SOLUCIÓN: Configura las reglas de Firestore para la colección pairs');
                const container = document.getElementById('pairsList');
                if (container) {
                    container.innerHTML = '<div style="text-align: center; padding: 2rem; background: #fed7d7; border-radius: 8px; margin: 1rem 0;"><h4 style="color: #c53030;">Error de Permisos</h4><p>Necesitas configurar las reglas de Firestore para parejas.</p></div>';
                }
            } else {
                showNotification('Error al cargar parejas', 'error');
            }
        }
    }

    // Renderizar lista de parejas
    async renderPairsList() {
        const container = document.getElementById('pairsList');
        if (!container) return;

        if (this.pairs.length === 0) {
            container.innerHTML = '<p style="text-align: center; color: #718096; padding: 2rem;">No hay parejas registradas.</p>';
            return;
        }

        // Obtener información de jugadores para todas las parejas
        const pairsWithPlayers = await Promise.all(
            this.pairs.map(async (pair) => ({
                ...pair,
                playersInfo: await this.getPlayersInfo(pair.players || [])
            }))
        );

        container.innerHTML = pairsWithPlayers.map(pair => `
            <div class="pair-card">
                <div class="pair-header">
                    <span class="pair-name">${pair.name}</span>
                    <span class="pair-status ${pair.status}">${this.getStatusLabel(pair.status)}</span>
                </div>
                
                <div class="pair-players">
                    <h5>Jugadores:</h5>
                    <div class="pair-player-tags">
                        ${pair.playersInfo.map(player => 
                            `<span class="pair-player-tag">${player.name || 'Sin nombre'}</span>`
                        ).join('')}
                    </div>
                </div>
                
                <div class="pair-actions">
                    <button class="btn btn-secondary btn-small" onclick="pairManager.updatePairStatus('${pair.id}')">
                        Cambiar Estado
                    </button>
                    <button class="btn btn-danger btn-small" onclick="pairManager.deletePair('${pair.id}')">
                        Eliminar
                    </button>
                </div>
            </div>
        `).join('');
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

    // Actualizar estado de pareja
    async updatePairStatus(pairId) {
        const currentPair = this.pairs.find(p => p.id === pairId);
        if (!currentPair) return;

        const statusOptions = [
            { value: PAIR_STATUS.ACTIVE, label: 'Activa' },
            { value: PAIR_STATUS.INACTIVE, label: 'Inactiva' },
            { value: PAIR_STATUS.TEMPORARY, label: 'Temporal' }
        ];

        const currentStatus = currentPair.status;
        const newStatus = prompt(`Estado actual: ${this.getStatusLabel(currentStatus)}\n\nSelecciona nuevo estado:\n${statusOptions.map((s, i) => `${i + 1}. ${s.label}`).join('\n')}`);

        if (newStatus && parseInt(newStatus) >= 1 && parseInt(newStatus) <= 3) {
            const selectedStatus = statusOptions[parseInt(newStatus) - 1];
            
            try {
                showLoading(true);
                await db.collection(COLLECTIONS.PAIRS).doc(pairId).update({
                    status: selectedStatus.value,
                    updatedAt: firebase.firestore.FieldValue.serverTimestamp()
                });

                showNotification(`Estado actualizado a: ${selectedStatus.label}`, 'success');
                await this.loadPairs();
            } catch (error) {
                console.error('Error actualizando estado de pareja:', error);
                showNotification('Error al actualizar estado', 'error');
            } finally {
                showLoading(false);
            }
        }
    }

    // Eliminar pareja
    async deletePair(pairId) {
        if (!confirm('¿Estás seguro de que quieres eliminar esta pareja?')) {
            return;
        }

        try {
            showLoading(true);
            await db.collection(COLLECTIONS.PAIRS).doc(pairId).delete();
            
            showNotification('Pareja eliminada exitosamente', 'success');
            await this.loadPairs();
        } catch (error) {
            console.error('Error eliminando pareja:', error);
            showNotification('Error al eliminar pareja', 'error');
        } finally {
            showLoading(false);
        }
    }

    // Obtener parejas activas para selección en partidos
    async getActivePairs() {
        try {
            const snapshot = await db.collection(COLLECTIONS.PAIRS)
                .where('status', '==', PAIR_STATUS.ACTIVE)
                .get();

            const activePairs = [];
            snapshot.forEach(doc => {
                activePairs.push({
                    id: doc.id,
                    ...doc.data()
                });
            });

            return activePairs;
        } catch (error) {
            console.error('Error obteniendo parejas activas:', error);
            return [];
        }
    }

    // Funciones de utilidad
    getStatusLabel(status) {
        switch (status) {
            case PAIR_STATUS.ACTIVE: return 'Activa';
            case PAIR_STATUS.INACTIVE: return 'Inactiva';
            case PAIR_STATUS.TEMPORARY: return 'Temporal';
            default: return 'Desconocido';
        }
    }
}

// Instancia global del manager de parejas
const pairManager = new PairManager();