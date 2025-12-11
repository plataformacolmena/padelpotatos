// Sistema de visualización de partidos para miembros
class TournamentViewer {
    constructor() {
        this.matches = [];
        this.userMatches = [];
    }

    // Cargar partidos para la vista del torneo
    async loadTournamentData() {
        if (!authManager.isApprovedMember() && !authManager.isSuperUser()) {
            this.showAccessDenied();
            return;
        }

        try {
            await this.loadAllMatches();
            this.renderTournamentMatches();
        } catch (error) {
            console.error('Error cargando datos del torneo:', error);
            showNotification('Error al cargar datos del torneo', 'error');
        }
    }

    // Mostrar mensaje de acceso denegado
    showAccessDenied() {
        const content = document.getElementById('tournamentContent');
        const accessDenied = document.getElementById('tournamentAccessDenied');
        
        if (content) content.style.display = 'none';
        if (accessDenied) accessDenied.style.display = 'block';
    }

    // Cargar todos los partidos
    async loadAllMatches() {
        try {
            const snapshot = await db.collection(COLLECTIONS.MATCHES)
                .orderBy('date', 'asc')
                .get();

            this.matches = [];
            snapshot.forEach(doc => {
                const matchData = { id: doc.id, ...doc.data() };
                this.matches.push(matchData);
            });

            // Filtrar partidos del usuario actual
            const currentUserId = authManager.currentUser?.uid;
            this.userMatches = [];
            
            // Para cada partido, verificar si el usuario está en alguna de las parejas
            for (const match of this.matches) {
                if (match.pairs && match.pairs.length > 0) {
                    // Verificar si el usuario está en alguna pareja del partido
                    const userIsInMatch = await this.isUserInMatchPairs(currentUserId, match.pairs);
                    if (userIsInMatch) {
                        this.userMatches.push(match);
                    }
                }
            }
        } catch (error) {
            console.error('Error cargando partidos:', error);
            
            // Si es un error de permisos, mostrar mensaje específico
            if (error.code === 'permission-denied') {
                console.log('⚠️ SOLUCIÓN: Configura las reglas de Firestore para la colección matches');
                
                // Mostrar mensaje de error en las secciones
                const sections = ['upcomingMatches', 'liveMatches', 'matchHistory'];
                sections.forEach(sectionId => {
                    const container = document.getElementById(sectionId);
                    if (container) {
                        container.innerHTML = '<div style="text-align: center; padding: 1.5rem; background: #fed7d7; border-radius: 8px;"><h5 style="color: #c53030;">Error de Configuración</h5><p style="color: #742a2a;">Las reglas de Firestore necesitan ser configuradas.</p></div>';
                    }
                });
                
                // Evitar que se procesen los datos
                this.matches = [];
                this.userMatches = [];
            }
            
            throw error;
        }
    }

    // Verificar si un usuario está en alguna pareja del partido
    async isUserInMatchPairs(userId, pairIds) {
        if (!userId || !pairIds || pairIds.length === 0) return false;
        
        try {
            for (const pairId of pairIds) {
                const doc = await db.collection(COLLECTIONS.PAIRS).doc(pairId).get();
                if (doc.exists) {
                    const pairData = doc.data();
                    if (pairData.players && pairData.players.includes(userId)) {
                        return true;
                    }
                }
            }
            return false;
        } catch (error) {
            console.error('Error verificando usuario en parejas:', error);
            return false;
        }
    }

    // Renderizar partidos en la vista del torneo
    async renderTournamentMatches() {
        const content = document.getElementById('tournamentContent');
        const accessDenied = document.getElementById('tournamentAccessDenied');
        
        if (content) content.style.display = 'block';
        if (accessDenied) accessDenied.style.display = 'none';

        // Categorizar partidos
        const now = new Date();
        const upcomingMatches = this.matches.filter(match => {
            const matchDate = match.date?.toDate ? match.date.toDate() : new Date(match.date);
            return matchDate > now && match.status === MATCH_STATUS.SCHEDULED;
        });

        const liveMatches = this.matches.filter(match => 
            match.status === MATCH_STATUS.IN_PROGRESS
        );

        const completedMatches = this.matches.filter(match => 
            match.status === MATCH_STATUS.COMPLETED
        ).reverse(); // Más recientes primero

        // Renderizar cada sección
        await this.renderMatchSection('upcomingMatches', upcomingMatches, 'No hay partidos programados próximamente.');
        await this.renderMatchSection('liveMatches', liveMatches, 'No hay partidos en curso actualmente.');
        await this.renderMatchSection('matchHistory', completedMatches.slice(0, 10), 'No hay historial de partidos.'); // Limitar a 10
    }

    // Renderizar una sección de partidos
    async renderMatchSection(containerId, matches, emptyMessage) {
        const container = document.getElementById(containerId);
        if (!container) return;

        if (matches.length === 0) {
            container.innerHTML = `<p style="text-align: center; color: #718096; padding: 2rem;">${emptyMessage}</p>`;
            return;
        }

        // Obtener información de parejas para todos los partidos
        const matchesWithPairs = await Promise.all(
            matches.map(async (match) => ({
                ...match,
                pairsInfo: await this.getPairsInfo(match.pairs || [])
            }))
        );

        container.innerHTML = matchesWithPairs.map(match => this.renderMatchCard(match, containerId === 'matchHistory')).join('');
    }

    // Renderizar tarjeta individual de partido
    renderMatchCard(match, isHistory = false) {
        const date = match.date?.toDate ? match.date.toDate() : new Date(match.date);
        const isUserMatch = this.isUserInMatchCard(match);
        
        return `
            <div class="match-card ${isUserMatch ? 'user-match' : ''}">
                <div class="match-header">
                    <span class="match-type ${match.type}">${this.getTypeLabel(match.type)}</span>
                    <span class="match-status ${match.status}">${this.getStatusLabel(match.status)}</span>
                    ${isUserMatch ? '<span class="user-match-indicator">🏆 Tu partido</span>' : ''}
                </div>
                
                <div class="match-info">
                    <h4>${match.location}</h4>
                    <div class="match-details">
                        <p><strong>📅 Fecha:</strong> ${this.formatDate(date)}</p>
                        <p><strong>⏰ Hora:</strong> ${this.formatTime(date)}</p>
                        <p><strong>👥 Parejas:</strong> ${match.pairsInfo.length}/${match.maxPairs || 2}</p>
                        ${match.description ? `<p><strong>📝 Descripción:</strong> ${match.description}</p>` : ''}
                        ${isHistory && match.result ? `<p><strong>🏆 Resultado:</strong> ${match.result}</p>` : ''}
                    </div>
                </div>
                
                ${match.pairsInfo.length > 0 ? `
                    <div class="match-players">
                        <h5>Parejas:</h5>
                        <div class="pairs-list">
                            ${match.pairsInfo.map(pair => `
                                <div class="pair-tag ${this.isUserInPair(pair) ? 'user-pair' : ''}">
                                    <strong>${pair.name}</strong>
                                    <div class="pair-players">
                                        ${pair.playersInfo.map(player => `
                                            <span class="player-tag ${player.id === authManager.currentUser?.uid ? 'current-user' : ''}">
                                                ${player.name || 'Sin nombre'}
                                            </span>
                                        `).join(' + ')}
                                    </div>
                                </div>
                            `).join('')}
                        </div>
                    </div>
                ` : ''}
                
                ${!isHistory && match.status === MATCH_STATUS.SCHEDULED && !isUserMatch && match.pairsInfo.length < (match.maxPairs || 2) ? `
                    <div class="match-actions">
                        <p style="color: #718096; font-size: 0.9rem; text-align: center; margin: 1rem 0;">
                            Para unirse necesitas tener una pareja activa. Contacta al administrador.
                        </p>
                    </div>
                ` : ''}
                
                ${!isHistory && isUserMatch && match.status === MATCH_STATUS.SCHEDULED ? `
                    <div class="match-actions">
                        <button class="btn btn-danger btn-small" onclick="tournamentViewer.leaveMatch('${match.id}')">
                            Abandonar Partido
                        </button>
                    </div>
                ` : ''}
            </div>
        `;
    }

    // Verificar si el usuario actual está en el partido
    isUserInMatchCard(match) {
        if (!match.pairsInfo || !authManager.currentUser) return false;
        
        return match.pairsInfo.some(pair => this.isUserInPair(pair));
    }

    // Verificar si el usuario está en una pareja específica
    isUserInPair(pair) {
        if (!pair.playersInfo || !authManager.currentUser) return false;
        
        return pair.playersInfo.some(player => player.id === authManager.currentUser.uid);
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

    // Unirse a un partido
    async joinMatch(matchId) {
        if (!authManager.currentUser) return;

        try {
            showLoading(true);
            
            const matchDoc = await db.collection(COLLECTIONS.MATCHES).doc(matchId).get();
            if (!matchDoc.exists) {
                showNotification('El partido no existe', 'error');
                return;
            }

            const matchData = matchDoc.data();
            const currentPlayers = matchData.players || [];
            
            // Verificar si ya está en el partido
            if (currentPlayers.includes(authManager.currentUser.uid)) {
                showNotification('Ya estás en este partido', 'info');
                return;
            }

            // Verificar si hay espacio
            if (currentPlayers.length >= matchData.maxPlayers) {
                showNotification('El partido está completo', 'error');
                return;
            }

            // Agregar usuario al partido
            const updatedPlayers = [...currentPlayers, authManager.currentUser.uid];
            await db.collection(COLLECTIONS.MATCHES).doc(matchId).update({
                players: updatedPlayers,
                updatedAt: firebase.firestore.FieldValue.serverTimestamp()
            });

            showNotification('Te has unido al partido exitosamente', 'success');
            await this.loadTournamentData();
            
        } catch (error) {
            console.error('Error uniéndose al partido:', error);
            showNotification('Error al unirse al partido', 'error');
        } finally {
            showLoading(false);
        }
    }

    // Abandonar un partido
    async leaveMatch(matchId) {
        if (!authManager.currentUser) return;
        
        if (!confirm('¿Estás seguro de que quieres abandonar este partido?')) {
            return;
        }

        try {
            showLoading(true);
            
            const matchDoc = await db.collection(COLLECTIONS.MATCHES).doc(matchId).get();
            if (!matchDoc.exists) {
                showNotification('El partido no existe', 'error');
                return;
            }

            const matchData = matchDoc.data();
            const currentPlayers = matchData.players || [];
            
            // Remover usuario del partido
            const updatedPlayers = currentPlayers.filter(playerId => playerId !== authManager.currentUser.uid);
            await db.collection(COLLECTIONS.MATCHES).doc(matchId).update({
                players: updatedPlayers,
                updatedAt: firebase.firestore.FieldValue.serverTimestamp()
            });

            showNotification('Has abandonado el partido', 'success');
            await this.loadTournamentData();
            
        } catch (error) {
            console.error('Error abandonando el partido:', error);
            showNotification('Error al abandonar el partido', 'error');
        } finally {
            showLoading(false);
        }
    }

    // Funciones de utilidad (reutilizadas de MatchManager)
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
}

// Instancia global del visor de torneos
const tournamentViewer = new TournamentViewer();