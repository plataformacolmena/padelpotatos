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
        this.userMatches = this.matches.filter(match => 
            match.players && match.players.includes(currentUserId)
        );
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

        // Obtener información de jugadores para todos los partidos
        const matchesWithPlayers = await Promise.all(
            matches.map(async (match) => ({
                ...match,
                playersInfo: await this.getPlayersInfo(match.players || [])
            }))
        );

        container.innerHTML = matchesWithPlayers.map(match => this.renderMatchCard(match, containerId === 'matchHistory')).join('');
    }

    // Renderizar tarjeta individual de partido
    renderMatchCard(match, isHistory = false) {
        const date = match.date?.toDate ? match.date.toDate() : new Date(match.date);
        const isUserMatch = match.players && match.players.includes(authManager.currentUser?.uid);
        
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
                        <p><strong>👥 Jugadores:</strong> ${match.playersInfo.length}/${match.maxPlayers}</p>
                        ${match.description ? `<p><strong>📝 Descripción:</strong> ${match.description}</p>` : ''}
                        ${isHistory && match.result ? `<p><strong>🏆 Resultado:</strong> ${match.result}</p>` : ''}
                    </div>
                </div>
                
                ${match.playersInfo.length > 0 ? `
                    <div class="match-players">
                        <h5>Jugadores:</h5>
                        <div class="players-list">
                            ${match.playersInfo.map(player => `
                                <span class="player-tag ${player.id === authManager.currentUser?.uid ? 'current-user' : ''}">
                                    ${player.name || 'Sin nombre'}
                                </span>
                            `).join('')}
                        </div>
                    </div>
                ` : ''}
                
                ${!isHistory && match.status === MATCH_STATUS.SCHEDULED && !isUserMatch && match.playersInfo.length < match.maxPlayers ? `
                    <div class="match-actions">
                        <button class="btn btn-primary btn-small" onclick="tournamentViewer.joinMatch('${match.id}')">
                            Unirse al Partido
                        </button>
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