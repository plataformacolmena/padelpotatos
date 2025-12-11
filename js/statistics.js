// Sistema de estadísticas del torneo
class StatisticsManager {
    constructor() {
        this.statistics = {};
        this.pairStats = [];
        this.generalStats = {};
    }

    // Generar estadísticas completas del torneo
    async generateTournamentStatistics() {
        try {
            showLoading(true);
            
            // Obtener todos los partidos completados con resultados
            const completedMatches = await this.getCompletedMatches();
            
            // Generar estadísticas por pareja
            this.pairStats = await this.generatePairStatistics(completedMatches);
            
            // Generar estadísticas generales
            this.generalStats = this.generateGeneralStatistics(completedMatches);
            
            // Guardar en localStorage para cache
            this.saveStatisticsCache();
            
            return {
                pairs: this.pairStats,
                general: this.generalStats
            };
            
        } catch (error) {
            console.error('Error generando estadísticas:', error);
            throw error;
        } finally {
            showLoading(false);
        }
    }

    // Obtener partidos completados con resultados
    async getCompletedMatches() {
        try {
            const snapshot = await db.collection(COLLECTIONS.MATCHES)
                .where('status', '==', MATCH_STATUS.COMPLETED)
                .get();

            const matches = [];
            snapshot.forEach(doc => {
                const matchData = { id: doc.id, ...doc.data() };
                if (matchData.result) {  // Solo partidos con resultado registrado
                    matches.push(matchData);
                }
            });

            return matches;
        } catch (error) {
            console.error('Error obteniendo partidos completados:', error);
            return [];
        }
    }

    // Generar estadísticas por pareja
    async generatePairStatistics(matches) {
        const pairStatsMap = new Map();

        // Obtener todas las parejas que han jugado
        const allPairIds = new Set();
        matches.forEach(match => {
            if (match.pairs) {
                match.pairs.forEach(pairId => allPairIds.add(pairId));
            }
        });

        // Inicializar estadísticas para cada pareja
        for (const pairId of allPairIds) {
            try {
                const pairDoc = await db.collection(COLLECTIONS.PAIRS).doc(pairId).get();
                if (pairDoc.exists) {
                    const pairData = { id: pairDoc.id, ...pairDoc.data() };
                    pairStatsMap.set(pairId, {
                        id: pairId,
                        name: pairData.name,
                        players: pairData.players || [],
                        playersInfo: await this.getPlayersInfo(pairData.players || []),
                        matchesPlayed: 0,
                        matchesWon: 0,
                        matchesLost: 0,
                        setsWon: 0,
                        setsLost: 0,
                        gamesWon: 0,
                        gamesLost: 0,
                        winPercentage: 0,
                        currentStreak: 0,
                        maxWinStreak: 0,
                        maxLossStreak: 0,
                        averageGamesDifference: 0,
                        dominantVictories: 0, // 2-0 en sets
                        closeMatches: 0,      // 2-1 en sets
                        lastMatches: []
                    });
                }
            } catch (error) {
                console.error(`Error obteniendo datos de pareja ${pairId}:`, error);
            }
        }

        // Procesar cada partido
        matches.forEach(match => {
            if (match.pairs && match.pairs.length === 2 && match.result) {
                const [pair1Id, pair2Id] = match.pairs;
                const winnerId = match.result.winner;
                const loserId = winnerId === pair1Id ? pair2Id : pair1Id;

                const winnerStats = pairStatsMap.get(winnerId);
                const loserStats = pairStatsMap.get(loserId);

                if (winnerStats && loserStats) {
                    // Estadísticas básicas
                    winnerStats.matchesPlayed++;
                    winnerStats.matchesWon++;
                    loserStats.matchesPlayed++;
                    loserStats.matchesLost++;

                    // Analizar sets y games
                    const setResults = this.analyzeMatchScore(match.result.score, winnerId === pair1Id);
                    
                    winnerStats.setsWon += setResults.winnerSets;
                    winnerStats.setsLost += setResults.loserSets;
                    winnerStats.gamesWon += setResults.winnerGames;
                    winnerStats.gamesLost += setResults.loserGames;

                    loserStats.setsWon += setResults.loserSets;
                    loserStats.setsLost += setResults.winnerSets;
                    loserStats.gamesWon += setResults.loserGames;
                    loserStats.gamesLost += setResults.winnerGames;

                    // Tipos de victoria
                    if (setResults.winnerSets === 2 && setResults.loserSets === 0) {
                        winnerStats.dominantVictories++;
                    } else if (setResults.winnerSets === 2 && setResults.loserSets === 1) {
                        winnerStats.closeMatches++;
                        loserStats.closeMatches++;
                    }

                    // Agregar partido a historial reciente
                    const matchSummary = {
                        date: match.date,
                        opponent: loserId,
                        result: 'victory',
                        score: setResults
                    };
                    winnerStats.lastMatches.unshift(matchSummary);
                    if (winnerStats.lastMatches.length > 10) {
                        winnerStats.lastMatches.pop();
                    }

                    const loserMatchSummary = {
                        date: match.date,
                        opponent: winnerId,
                        result: 'defeat',
                        score: setResults
                    };
                    loserStats.lastMatches.unshift(loserMatchSummary);
                    if (loserStats.lastMatches.length > 10) {
                        loserStats.lastMatches.pop();
                    }
                }
            }
        });

        // Calcular porcentajes y rachas
        Array.from(pairStatsMap.values()).forEach(stats => {
            if (stats.matchesPlayed > 0) {
                stats.winPercentage = Math.round((stats.matchesWon / stats.matchesPlayed) * 100);
                stats.averageGamesDifference = stats.matchesPlayed > 0 ? 
                    Math.round(((stats.gamesWon - stats.gamesLost) / stats.matchesPlayed) * 100) / 100 : 0;
                
                // Calcular rachas actuales y máximas
                this.calculateStreaks(stats);
            }
        });

        // Convertir Map a Array y ordenar por win percentage
        return Array.from(pairStatsMap.values())
            .filter(stats => stats.matchesPlayed > 0)
            .sort((a, b) => b.winPercentage - a.winPercentage || b.matchesWon - a.matchesWon);
    }

    // Analizar puntuación de un partido
    analyzeMatchScore(score, isWinnerPair1) {
        let winnerSets = 0;
        let loserSets = 0;
        let winnerGames = 0;
        let loserGames = 0;

        // Analizar cada set
        ['set1', 'set2', 'set3'].forEach(setKey => {
            if (score[setKey]) {
                const pair1Games = score[setKey].pair1;
                const pair2Games = score[setKey].pair2;

                if (pair1Games > pair2Games) {
                    if (isWinnerPair1) {
                        winnerSets++;
                        winnerGames += pair1Games;
                        loserGames += pair2Games;
                    } else {
                        loserSets++;
                        loserGames += pair1Games;
                        winnerGames += pair2Games;
                    }
                } else if (pair2Games > pair1Games) {
                    if (isWinnerPair1) {
                        loserSets++;
                        winnerGames += pair1Games;
                        loserGames += pair2Games;
                    } else {
                        winnerSets++;
                        loserGames += pair1Games;
                        winnerGames += pair2Games;
                    }
                }
            }
        });

        return { winnerSets, loserSets, winnerGames, loserGames };
    }

    // Calcular rachas de victorias/derrotas
    calculateStreaks(stats) {
        let currentStreak = 0;
        let maxWinStreak = 0;
        let maxLossStreak = 0;
        let tempWinStreak = 0;
        let tempLossStreak = 0;

        // Analizar últimos partidos (más reciente primero)
        stats.lastMatches.forEach((match, index) => {
            if (index === 0) {
                // Racha actual
                currentStreak = match.result === 'victory' ? 1 : -1;
            }

            if (match.result === 'victory') {
                tempWinStreak++;
                tempLossStreak = 0;
                maxWinStreak = Math.max(maxWinStreak, tempWinStreak);
            } else {
                tempLossStreak++;
                tempWinStreak = 0;
                maxLossStreak = Math.max(maxLossStreak, tempLossStreak);
            }
        });

        stats.currentStreak = currentStreak;
        stats.maxWinStreak = maxWinStreak;
        stats.maxLossStreak = maxLossStreak;
    }

    // Generar estadísticas generales del torneo
    generateGeneralStatistics(matches) {
        const totalMatches = matches.length;
        let totalSets = 0;
        let totalGames = 0;
        const pairParticipation = new Map();
        let dominantVictories = 0;
        let closeMatches = 0;

        matches.forEach(match => {
            if (match.result && match.result.score) {
                // Contar sets y games
                ['set1', 'set2', 'set3'].forEach(setKey => {
                    if (match.result.score[setKey]) {
                        totalSets++;
                        totalGames += match.result.score[setKey].pair1 + match.result.score[setKey].pair2;
                    }
                });

                // Analizar tipo de victoria
                const setResults = this.analyzeMatchScore(match.result.score, true);
                if (setResults.winnerSets === 2 && setResults.loserSets === 0) {
                    dominantVictories++;
                } else if (setResults.winnerSets === 2 && setResults.loserSets === 1) {
                    closeMatches++;
                }

                // Contar participación por pareja
                if (match.pairs) {
                    match.pairs.forEach(pairId => {
                        pairParticipation.set(pairId, (pairParticipation.get(pairId) || 0) + 1);
                    });
                }
            }
        });

        const averageGamesPerSet = totalSets > 0 ? Math.round((totalGames / totalSets) * 100) / 100 : 0;
        const averageSetsPerMatch = totalMatches > 0 ? Math.round((totalSets / totalMatches) * 100) / 100 : 0;

        return {
            totalMatches,
            totalSets,
            totalGames,
            averageGamesPerSet,
            averageSetsPerMatch,
            dominantVictories,
            closeMatches,
            dominantVictoryPercentage: totalMatches > 0 ? Math.round((dominantVictories / totalMatches) * 100) : 0,
            closeMatchPercentage: totalMatches > 0 ? Math.round((closeMatches / totalMatches) * 100) : 0,
            activePairs: pairParticipation.size,
            mostActivePair: this.getMostActivePair(pairParticipation)
        };
    }

    // Obtener la pareja más activa
    getMostActivePair(pairParticipation) {
        if (pairParticipation.size === 0) return null;

        let maxMatches = 0;
        let mostActivePairId = null;

        pairParticipation.forEach((matches, pairId) => {
            if (matches > maxMatches) {
                maxMatches = matches;
                mostActivePairId = pairId;
            }
        });

        return { pairId: mostActivePairId, matches: maxMatches };
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

    // Guardar estadísticas en cache
    saveStatisticsCache() {
        try {
            localStorage.setItem('tournamentStatistics', JSON.stringify({
                pairs: this.pairStats,
                general: this.generalStats,
                lastUpdated: new Date().toISOString()
            }));
        } catch (error) {
            console.error('Error guardando cache de estadísticas:', error);
        }
    }

    // Cargar estadísticas desde cache
    loadStatisticsCache() {
        try {
            const cached = localStorage.getItem('tournamentStatistics');
            if (cached) {
                const data = JSON.parse(cached);
                this.pairStats = data.pairs || [];
                this.generalStats = data.general || {};
                return data;
            }
        } catch (error) {
            console.error('Error cargando cache de estadísticas:', error);
        }
        return null;
    }

    // Verificar si el cache es reciente (menos de 1 hora)
    isCacheValid(cached) {
        if (!cached || !cached.lastUpdated) return false;
        
        const cacheTime = new Date(cached.lastUpdated);
        const now = new Date();
        const hoursDiff = (now - cacheTime) / (1000 * 60 * 60);
        
        return hoursDiff < 1; // Cache válido por 1 hora
    }
}

// Instancia global del manager de estadísticas
const statisticsManager = new StatisticsManager();