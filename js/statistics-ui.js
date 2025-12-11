// Interfaz de usuario para estadísticas
class StatisticsUI {
    constructor() {
        this.initEventListeners();
    }

    // Inicializar event listeners
    initEventListeners() {
        document.addEventListener('DOMContentLoaded', () => {
            const refreshBtn = document.getElementById('refreshStats');
            const exportBtn = document.getElementById('exportStats');

            if (refreshBtn) {
                refreshBtn.addEventListener('click', () => this.loadStatistics());
            }

            if (exportBtn) {
                exportBtn.addEventListener('click', () => this.exportStatistics());
            }
        });
    }

    // Cargar y mostrar estadísticas
    async loadStatistics() {
        if (!authManager.isApprovedMember() && !authManager.isSuperUser()) {
            this.showAccessDenied();
            return;
        }

        try {
            showLoading(true);
            
            // Intentar cargar desde cache primero
            const cached = statisticsManager.loadStatisticsCache();
            if (cached && statisticsManager.isCacheValid(cached)) {
                this.renderStatistics(cached);
                showNotification('Estadísticas cargadas (cache)', 'info');
                return;
            }

            // Generar estadísticas frescas
            const stats = await statisticsManager.generateTournamentStatistics();
            this.renderStatistics(stats);
            
            showNotification('Estadísticas actualizadas', 'success');
            
        } catch (error) {
            console.error('Error cargando estadísticas:', error);
            showNotification('Error al cargar estadísticas', 'error');
        } finally {
            showLoading(false);
        }
    }

    // Mostrar mensaje de acceso denegado
    showAccessDenied() {
        const content = document.getElementById('statisticsContent');
        const accessDenied = document.getElementById('statisticsAccessDenied');
        
        if (content) content.style.display = 'none';
        if (accessDenied) accessDenied.style.display = 'block';
    }

    // Renderizar todas las estadísticas
    renderStatistics(stats) {
        const content = document.getElementById('statisticsContent');
        const accessDenied = document.getElementById('statisticsAccessDenied');
        
        if (content) content.style.display = 'block';
        if (accessDenied) accessDenied.style.display = 'none';

        this.renderGeneralStats(stats.general);
        this.renderPairRanking(stats.pairs);
    }

    // Renderizar estadísticas generales
    renderGeneralStats(generalStats) {
        const container = document.getElementById('generalStats');
        if (!container) return;

        container.innerHTML = `
            <div class="stats-card">
                <span class="stats-number">${generalStats.totalMatches || 0}</span>
                <div class="stats-label">Partidos Completados</div>
            </div>
            
            <div class="stats-card">
                <span class="stats-number">${generalStats.activePairs || 0}</span>
                <div class="stats-label">Parejas Activas</div>
            </div>
            
            <div class="stats-card">
                <span class="stats-number">${generalStats.averageSetsPerMatch || 0}</span>
                <div class="stats-label">Sets Promedio por Partido</div>
            </div>
            
            <div class="stats-card">
                <span class="stats-number">${generalStats.dominantVictoryPercentage || 0}%</span>
                <div class="stats-label">Victorias Dominantes (2-0)</div>
            </div>
            
            <div class="stats-card">
                <span class="stats-number">${generalStats.closeMatchPercentage || 0}%</span>
                <div class="stats-label">Partidos Cerrados (2-1)</div>
            </div>
            
            <div class="stats-card">
                <span class="stats-number">${generalStats.averageGamesPerSet || 0}</span>
                <div class="stats-label">Games Promedio por Set</div>
            </div>
        `;
    }

    // Renderizar ranking de parejas
    renderPairRanking(pairStats) {
        const container = document.getElementById('pairRanking');
        if (!container) return;

        if (pairStats.length === 0) {
            container.innerHTML = `
                <div style="text-align: center; padding: 2rem; color: #718096;">
                    No hay estadísticas de parejas disponibles.<br>
                    <span style="font-size: 0.9em;">Los resultados aparecerán aquí una vez que se registren partidos completados.</span>
                </div>
            `;
            return;
        }

        const tableHTML = `
            <table>
                <thead>
                    <tr>
                        <th>Ranking</th>
                        <th>Pareja</th>
                        <th>Partidos</th>
                        <th>Victorias</th>
                        <th>Derrotas</th>
                        <th>% Victoria</th>
                        <th>Sets G/P</th>
                        <th>Racha Actual</th>
                    </tr>
                </thead>
                <tbody>
                    ${pairStats.map((pair, index) => this.renderPairRow(pair, index + 1)).join('')}
                </tbody>
            </table>
        `;

        container.innerHTML = tableHTML;
    }

    // Renderizar fila de pareja en ranking
    renderPairRow(pair, rank) {
        const winPercentageClass = this.getWinPercentageClass(pair.winPercentage);
        const streakIcon = pair.currentStreak > 0 ? '📈' : (pair.currentStreak < 0 ? '📉' : '➖');
        const streakText = pair.currentStreak > 0 ? `+${pair.currentStreak}` : pair.currentStreak.toString();

        return `
            <tr>
                <td>
                    <span class="rank-number">${rank}</span>
                </td>
                <td>
                    <div>
                        <strong>${pair.name}</strong>
                        <div style="font-size: 0.8rem; color: #718096;">
                            ${pair.playersInfo.map(p => p.name || 'Sin nombre').join(' + ')}
                        </div>
                    </div>
                </td>
                <td>${pair.matchesPlayed}</td>
                <td style="color: #38a169; font-weight: bold;">${pair.matchesWon}</td>
                <td style="color: #e53e3e; font-weight: bold;">${pair.matchesLost}</td>
                <td>
                    <span class="win-percentage ${winPercentageClass}">
                        ${pair.winPercentage}%
                    </span>
                </td>
                <td>
                    <span style="color: #38a169;">${pair.setsWon}</span>
                    /
                    <span style="color: #e53e3e;">${pair.setsLost}</span>
                </td>
                <td>
                    <span style="cursor: help;" title="Racha actual: ${Math.abs(pair.currentStreak)} ${pair.currentStreak >= 0 ? 'victorias' : 'derrotas'}">
                        ${streakIcon} ${streakText}
                    </span>
                </td>
            </tr>
        `;
    }

    // Obtener clase CSS según porcentaje de victorias
    getWinPercentageClass(percentage) {
        if (percentage >= 70) return 'high';
        if (percentage >= 50) return 'medium';
        return 'low';
    }

    // Exportar estadísticas
    async exportStatistics() {
        try {
            const stats = {
                pairs: statisticsManager.pairStats,
                general: statisticsManager.generalStats,
                exportDate: new Date().toISOString()
            };

            const dataStr = JSON.stringify(stats, null, 2);
            const blob = new Blob([dataStr], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            
            const link = document.createElement('a');
            link.href = url;
            link.download = `estadisticas-torneo-padel-${new Date().toISOString().split('T')[0]}.json`;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            URL.revokeObjectURL(url);

            showNotification('Estadísticas exportadas exitosamente', 'success');
            
        } catch (error) {
            console.error('Error exportando estadísticas:', error);
            showNotification('Error al exportar estadísticas', 'error');
        }
    }

    // Mostrar estadísticas detalladas de una pareja (modal)
    async showPairDetails(pairId) {
        const pair = statisticsManager.pairStats.find(p => p.id === pairId);
        if (!pair) {
            showNotification('Pareja no encontrada', 'error');
            return;
        }

        const modal = document.createElement('div');
        modal.className = 'modal-overlay';
        modal.innerHTML = `
            <div class="modal-content">
                <div class="modal-header">
                    <h3>Estadísticas Detalladas: ${pair.name}</h3>
                    <button class="modal-close" onclick="this.closest('.modal-overlay').remove()">&times;</button>
                </div>
                
                <div class="modal-body">
                    <div class="pair-detail-stats">
                        
                        <!-- Información básica -->
                        <div class="stats-section">
                            <h4>Información General</h4>
                            <div class="stats-grid">
                                <div class="stats-card">
                                    <span class="stats-number">${pair.matchesPlayed}</span>
                                    <div class="stats-label">Partidos Jugados</div>
                                </div>
                                <div class="stats-card">
                                    <span class="stats-number">${pair.winPercentage}%</span>
                                    <div class="stats-label">Porcentaje de Victoria</div>
                                </div>
                                <div class="stats-card">
                                    <span class="stats-number">${pair.dominantVictories}</span>
                                    <div class="stats-label">Victorias 2-0</div>
                                </div>
                                <div class="stats-card">
                                    <span class="stats-number">${pair.closeMatches}</span>
                                    <div class="stats-label">Partidos 2-1</div>
                                </div>
                            </div>
                        </div>

                        <!-- Rachas -->
                        <div class="stats-section">
                            <h4>Rachas</h4>
                            <div class="stats-grid">
                                <div class="stats-card">
                                    <span class="stats-number">${pair.maxWinStreak}</span>
                                    <div class="stats-label">Máx. Racha Victorias</div>
                                </div>
                                <div class="stats-card">
                                    <span class="stats-number">${pair.maxLossStreak}</span>
                                    <div class="stats-label">Máx. Racha Derrotas</div>
                                </div>
                                <div class="stats-card">
                                    <span class="stats-number">${Math.abs(pair.currentStreak)}</span>
                                    <div class="stats-label">Racha Actual (${pair.currentStreak >= 0 ? 'V' : 'D'})</div>
                                </div>
                            </div>
                        </div>

                        <!-- Últimos partidos -->
                        ${pair.lastMatches.length > 0 ? `
                            <div class="stats-section">
                                <h4>Últimos Partidos</h4>
                                <div class="recent-matches">
                                    ${pair.lastMatches.slice(0, 5).map(match => `
                                        <div class="recent-match ${match.result}">
                                            <span class="match-result">${match.result === 'victory' ? '✅ Victoria' : '❌ Derrota'}</span>
                                            <span class="match-score">${match.score.winnerSets}-${match.score.loserSets}</span>
                                        </div>
                                    `).join('')}
                                </div>
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
}

// Instancia global de la UI de estadísticas
const statisticsUI = new StatisticsUI();