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

    // Mostrar formulario y cargar parejas
    async showMatchForm() {
        const form = document.getElementById('matchForm');
        form.style.display = 'block';
        
        // Cargar parejas activas para selección
        await this.loadActivePairsForSelection();
        
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

    // Cargar parejas activas para el selector
    async loadActivePairsForSelection() {
        try {
            this.activePairs = await pairManager.getActivePairs();
            
            // Obtener información de jugadores para cada pareja
            this.pairsWithPlayers = await Promise.all(
                this.activePairs.map(async (pair) => ({
                    ...pair,
                    playersInfo: await this.getPlayersInfoForPair(pair.players || [])
                }))
            );

            this.renderPairSelection();
        } catch (error) {
            console.error('Error cargando parejas para selección:', error);
            showNotification('Error al cargar parejas', 'error');
        }
    }

    // Obtener información de jugadores para una pareja
    async getPlayersInfoForPair(playerIds) {
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

    // Renderizar selector de parejas
    renderPairSelection() {
        const container = document.getElementById('playerSelection');
        if (!container) return;

        if (this.pairsWithPlayers.length === 0) {
            container.innerHTML = '<p style="color: #718096;">No hay parejas activas disponibles. <br><span style="font-size: 0.9em;">Primero debes crear parejas en la sección de Gestión de Parejas.</span></p>';
            return;
        }

        container.innerHTML = this.pairsWithPlayers.map(pair => `
            <div class="player-item">
                <input type="checkbox" id="pair_${pair.id}" value="${pair.id}">
                <label for="pair_${pair.id}">
                    <strong>${pair.name}</strong>
                    <span style="color: #718096; margin-left: 0.5rem;">
                        (${pair.playersInfo.map(p => p.name || 'Sin nombre').join(' + ')})
                    </span>
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
            const selectedPairs = Array.from(document.querySelectorAll('#playerSelection input[type="checkbox"]:checked'))
                .map(checkbox => checkbox.value);

            // Validaciones
            if (selectedPairs.length === 0) {
                showNotification('Debes seleccionar al menos una pareja', 'error');
                return;
            }

            // Para pádel, validar que haya exactamente 2 parejas (4 jugadores total)
            if (selectedPairs.length !== 2) {
                showNotification('Para pádel debes seleccionar exactamente 2 parejas', 'error');
                return;
            }

            // Crear objeto del partido
            const matchData = {
                date: new Date(document.getElementById('matchDate').value),
                type: document.getElementById('matchType').value,
                location: document.getElementById('matchLocation').value,
                description: document.getElementById('matchDescription').value,
                status: MATCH_STATUS.SCHEDULED,
                pairs: selectedPairs, // Cambiado de 'players' a 'pairs'
                maxPairs: 2, // Cambiado de 'maxPlayers' a 'maxPairs'
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
            
            // Si es un error de permisos, mostrar mensaje específico
            if (error.code === 'permission-denied') {
                showNotification('Configura las reglas de Firestore para la colección matches', 'error');
                console.log('⚠️ SOLUCIÓN: Ve a Firebase Console > Firestore > Rules y configura permisos para la colección matches');
                
                // Mostrar lista vacía con mensaje
                const container = document.getElementById('matchesList');
                if (container) {
                    container.innerHTML = '<div style="text-align: center; padding: 2rem; background: #fed7d7; border-radius: 8px; margin: 1rem 0;"><h4 style="color: #c53030;">Error de Permisos</h4><p>Necesitas configurar las reglas de Firestore. <br>Ve a <strong>Firebase Console > Firestore > Rules</strong></p></div>';
                }
            } else {
                showNotification('Error al cargar partidos', 'error');
            }
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

        // Obtener información de parejas
        const pairPromises = this.matches.map(match => this.getPairsInfo(match.pairs || []));
        const pairsData = await Promise.all(pairPromises);

        container.innerHTML = this.matches.map((match, index) => {
            const pairs = pairsData[index];
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
                            <p><strong>👥 Parejas:</strong> ${pairs.length}/${match.maxPairs || 2}</p>
                            ${match.description ? `<p><strong>📝 Descripción:</strong> ${match.description}</p>` : ''}
                        </div>
                    </div>
                    
                    ${pairs.length > 0 ? `
                        <div class="match-players">
                            <h5>Parejas:</h5>
                            <div class="pairs-list">
                                ${pairs.map(pair => `
                                    <div class="pair-tag">
                                        <strong>${pair.name}</strong>
                                        <span class="pair-players">(${pair.playersInfo.map(p => p.name || 'Sin nombre').join(' + ')})</span>
                                    </div>
                                `).join('')}
                            </div>
                        </div>
                    ` : ''}
                    
                    <div class="match-actions">
                        ${match.status === MATCH_STATUS.COMPLETED && !match.result ? `
                            <button class="btn btn-success btn-small" onclick="matchManager.showResultForm('${match.id}')">
                                Registrar Resultado
                            </button>
                        ` : ''}
                        ${match.status === MATCH_STATUS.IN_PROGRESS ? `
                            <button class="btn btn-success btn-small" onclick="matchManager.showResultForm('${match.id}')">
                                Finalizar Partido
                            </button>
                        ` : ''}
                        ${match.result ? `
                            <button class="btn btn-info btn-small" onclick="matchManager.viewResult('${match.id}')">
                                Ver Resultado
                            </button>
                        ` : ''}
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

    // Obtener información de parejas
    async getPairsInfo(pairIds) {
        if (!pairIds || pairIds.length === 0) return [];

        try {
            const pairs = [];
            for (const pairId of pairIds) {
                const doc = await db.collection(COLLECTIONS.PAIRS).doc(pairId).get();
                if (doc.exists) {
                    const pairData = { id: doc.id, ...doc.data() };
                    // Obtener información de jugadores de la pareja
                    pairData.playersInfo = await this.getPlayersInfoForPair(pairData.players || []);
                    pairs.push(pairData);
                }
            }
            return pairs;
        } catch (error) {
            console.error('Error obteniendo información de parejas:', error);
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

    // Mostrar formulario de resultado
    async showResultForm(matchId) {
        const match = this.matches.find(m => m.id === matchId);
        if (!match) {
            showNotification('Partido no encontrado', 'error');
            return;
        }

        // Obtener información de las parejas
        const pairsInfo = await this.getPairsInfo(match.pairs || []);
        if (pairsInfo.length !== 2) {
            showNotification('Error: El partido debe tener exactamente 2 parejas', 'error');
            return;
        }

        // Crear modal con formulario de resultado
        const modal = document.createElement('div');
        modal.className = 'modal-overlay';
        modal.innerHTML = `
            <div class="modal-content">
                <div class="modal-header">
                    <h3>Registrar Resultado del Partido</h3>
                    <button class="modal-close" onclick="this.closest('.modal-overlay').remove()">&times;</button>
                </div>
                
                <div class="modal-body">
                    <div class="match-info">
                        <h4>${match.location} - ${this.formatDate(match.date?.toDate ? match.date.toDate() : new Date(match.date))}</h4>
                        <div class="pairs-vs">
                            <div class="pair-vs-item">
                                <strong>${pairsInfo[0].name}</strong>
                                <span>(${pairsInfo[0].playersInfo.map(p => p.name).join(' + ')})</span>
                            </div>
                            <div class="vs">VS</div>
                            <div class="pair-vs-item">
                                <strong>${pairsInfo[1].name}</strong>
                                <span>(${pairsInfo[1].playersInfo.map(p => p.name).join(' + ')})</span>
                            </div>
                        </div>
                    </div>

                    <form id="resultForm">
                        <input type="hidden" id="matchId" value="${matchId}">
                        
                        <div class="result-section">
                            <h4>Ganador del Partido</h4>
                            <div class="winner-selection">
                                <label>
                                    <input type="radio" name="winner" value="${match.pairs[0]}" required>
                                    ${pairsInfo[0].name}
                                </label>
                                <label>
                                    <input type="radio" name="winner" value="${match.pairs[1]}" required>
                                    ${pairsInfo[1].name}
                                </label>
                            </div>
                        </div>

                        <div class="result-section">
                            <h4>Puntuación por Sets</h4>
                            <div class="sets-score">
                                <div class="set-input">
                                    <label>Set 1:</label>
                                    <div class="set-score">
                                        <input type="number" id="set1_pair1" min="0" max="7" placeholder="0" required>
                                        <span>-</span>
                                        <input type="number" id="set1_pair2" min="0" max="7" placeholder="0" required>
                                    </div>
                                </div>
                                
                                <div class="set-input">
                                    <label>Set 2:</label>
                                    <div class="set-score">
                                        <input type="number" id="set2_pair1" min="0" max="7" placeholder="0" required>
                                        <span>-</span>
                                        <input type="number" id="set2_pair2" min="0" max="7" placeholder="0" required>
                                    </div>
                                </div>
                                
                                <div class="set-input">
                                    <label>Set 3 (si aplica):</label>
                                    <div class="set-score">
                                        <input type="number" id="set3_pair1" min="0" max="10" placeholder="0">
                                        <span>-</span>
                                        <input type="number" id="set3_pair2" min="0" max="10" placeholder="0">
                                    </div>
                                </div>
                            </div>
                        </div>

                        <div class="result-section">
                            <label for="resultNotes">Notas adicionales:</label>
                            <textarea id="resultNotes" placeholder="Comentarios sobre el partido..." rows="3"></textarea>
                        </div>

                        <div class="modal-actions">
                            <button type="submit" class="btn btn-success">Guardar Resultado</button>
                            <button type="button" class="btn btn-secondary" onclick="this.closest('.modal-overlay').remove()">Cancelar</button>
                        </div>
                    </form>
                </div>
            </div>
        `;

        document.body.appendChild(modal);

        // Agregar event listener al formulario
        document.getElementById('resultForm').addEventListener('submit', (e) => {
            e.preventDefault();
            this.handleSaveResult(e);
        });
    }

    // Manejar guardado de resultado
    async handleSaveResult(event) {
        try {
            showLoading(true);

            const formData = new FormData(event.target);
            const matchId = document.getElementById('matchId').value;
            const winner = formData.get('winner');

            // Recopilar puntuación
            const score = {
                set1: {
                    pair1: parseInt(document.getElementById('set1_pair1').value) || 0,
                    pair2: parseInt(document.getElementById('set1_pair2').value) || 0
                },
                set2: {
                    pair1: parseInt(document.getElementById('set2_pair1').value) || 0,
                    pair2: parseInt(document.getElementById('set2_pair2').value) || 0
                }
            };

            // Agregar set 3 si tiene valores
            const set3_p1 = document.getElementById('set3_pair1').value;
            const set3_p2 = document.getElementById('set3_pair2').value;
            if (set3_p1 || set3_p2) {
                score.set3 = {
                    pair1: parseInt(set3_p1) || 0,
                    pair2: parseInt(set3_p2) || 0
                };
            }

            // Validar puntuación básica
            if (!this.validateScore(score)) {
                showNotification('La puntuación no es válida para pádel', 'error');
                return;
            }

            // Crear objeto de resultado
            const result = {
                winner: winner,
                score: score,
                notes: document.getElementById('resultNotes').value,
                recordedBy: authManager.currentUser.uid,
                recordedAt: firebase.firestore.FieldValue.serverTimestamp()
            };

            // Actualizar partido en Firestore
            await db.collection(COLLECTIONS.MATCHES).doc(matchId).update({
                result: result,
                status: MATCH_STATUS.COMPLETED,
                updatedAt: firebase.firestore.FieldValue.serverTimestamp()
            });

            showNotification('Resultado guardado exitosamente', 'success');
            
            // Cerrar modal y recargar lista
            document.querySelector('.modal-overlay').remove();
            await this.loadMatches();

            // Actualizar estadísticas
            await this.updateStatistics(matchId, result);

        } catch (error) {
            console.error('Error guardando resultado:', error);
            showNotification('Error al guardar resultado', 'error');
        } finally {
            showLoading(false);
        }
    }

    // Validar puntuación de pádel
    validateScore(score) {
        // Validación básica de sets de pádel
        const { set1, set2, set3 } = score;
        
        // Al menos 2 sets deben estar completos
        if (!set1 || !set2) return false;
        
        // Validar que los sets tengan sentido
        if (set1.pair1 < 0 || set1.pair2 < 0 || set2.pair1 < 0 || set2.pair2 < 0) {
            return false;
        }

        return true;
    }

    // Ver resultado de un partido
    async viewResult(matchId) {
        const match = this.matches.find(m => m.id === matchId);
        if (!match || !match.result) {
            showNotification('No hay resultado registrado', 'info');
            return;
        }

        const pairsInfo = await this.getPairsInfo(match.pairs || []);
        const winnerPair = pairsInfo.find(pair => pair.id === match.result.winner);

        const modal = document.createElement('div');
        modal.className = 'modal-overlay';
        modal.innerHTML = `
            <div class="modal-content">
                <div class="modal-header">
                    <h3>Resultado del Partido</h3>
                    <button class="modal-close" onclick="this.closest('.modal-overlay').remove()">&times;</button>
                </div>
                
                <div class="modal-body">
                    <div class="result-display">
                        <h4>🏆 Ganador: ${winnerPair ? winnerPair.name : 'Desconocido'}</h4>
                        
                        <div class="score-display">
                            <h5>Puntuación:</h5>
                            <div class="score-sets">
                                <div>Set 1: ${match.result.score.set1.pair1} - ${match.result.score.set1.pair2}</div>
                                <div>Set 2: ${match.result.score.set2.pair1} - ${match.result.score.set2.pair2}</div>
                                ${match.result.score.set3 ? `<div>Set 3: ${match.result.score.set3.pair1} - ${match.result.score.set3.pair2}</div>` : ''}
                            </div>
                        </div>

                        ${match.result.notes ? `
                            <div class="result-notes">
                                <h5>Notas:</h5>
                                <p>${match.result.notes}</p>
                            </div>
                        ` : ''}
                    </div>
                </div>
                
                <div class="modal-actions">
                    <button class="btn btn-secondary" onclick="this.closest('.modal-overlay').remove()">Cerrar</button>
                </div>
            </div>
        `;

        document.body.appendChild(modal);
    }

    // Actualizar estadísticas después de registrar resultado
    async updateStatistics(matchId, result) {
        try {
            console.log('Resultado registrado - Invalidando cache de estadísticas');
            
            // Limpiar cache de estadísticas para forzar actualización
            localStorage.removeItem('tournamentStatistics');
            
            // Si estamos en la pestaña de estadísticas, recargarlas
            const currentTab = document.querySelector('.nav-btn.active');
            if (currentTab && currentTab.getAttribute('data-tab') === 'estadisticas') {
                await statisticsUI.loadStatistics();
            }
            
        } catch (error) {
            console.error('Error actualizando estadísticas:', error);
        }
    }
}

// Instancia global del manager de partidos
const matchManager = new MatchManager();