// Gestionnaire des matchs (simplifié)
async function handleMatchCommand(interaction) {
    const subcommand = interaction.options.getSubcommand();

    switch (subcommand) {
        case 'resultat':
            const adversaire = interaction.options.getString('adversaire');
            const resultat = interaction.options.getString('resultat');
            const score = interaction.options.getString('score');
            const notes = interaction.options.getString('notes');

            const matches = Database.load('matches');
            const matchId = Date.now().toString();
            
            matches[matchId] = {
                id: matchId,
                adversaire,
                resultat,
                score,
                notes,
                date: new Date().toISOString(),
                rapporte_par: interaction.user.id
            };
            
            Database.save('matches', matches);

            const resultEmbed = new EmbedBuilder()
                .setTitle(resultat === 'victoire' ? '🎉 Victoire enregistrée !' : '😞 Défaite enregistrée')
                .addFields(
                    { name: 'Adversaire', value: adversaire, inline: true },
                    { name: 'Résultat', value: resultat === 'victoire' ? '✅ Victoire' : '❌ Défaite', inline: true },
                    { name: 'Score', value: score || 'Non précisé', inline: true }
                )
                .setColor(resultat === 'victoire' ? 0x00ff00 : 0xff6600)
                .setTimestamp();

            if (notes) {
                resultEmbed.addFields({ name: 'Notes', value: notes, inline: false });
            }

            await interaction.reply({ embeds: [resultEmbed] });
            break;

        case 'historique':
            const allMatches = Database.load('matches');
            const matchesList = Object.values(allMatches)
                .sort((a, b) => new Date(b.date) - new Date(a.date))
                .slice(0, 10);

            if (matchesList.length === 0) {
                await interaction.reply('📊 Aucun résultat de match enregistré.');
                return;
            }

            const historyEmbed = new EmbedBuilder()
                .setTitle('📊 Historique des matchs')
                .setColor(0x9900ff);

            const victoires = matchesList.filter(m => m.resultat === 'victoire').length;
            const defaites = matchesList.filter(m => m.resultat === 'defaite').length;

            historyEmbed.setDescription(`**Bilan récent:** ${victoires}V - ${defaites}D`);

            matchesList.forEach(match => {
                const date = new Date(match.date).toLocaleDateString('fr-FR');
                const status = match.resultat === 'victoire' ? '✅' : '❌';
                historyEmbed.addFields({
                    name: `${status} vs ${match.adversaire} (${date})`,
                    value: `Score: ${match.score || 'Non précisé'}${match.notes ? `\nNotes: ${match.notes.substring(0, 50)}...` : ''}`,
                    inline: false
                });
            });

            await interaction.reply({ embeds: [historyEmbed] });
            break;
    }
}

// Gestionnaire de motivation (manuel uniquement)
async function handleMotivationCommand(interaction) {
    const subcommand = interaction.options.getSubcommand();

    switch (subcommand) {
        case 'citation':
            const randomQuote = motivationalQuotes[Math.floor(Math.random() * motivationalQuotes.length)];
            
            const embed = new EmbedBuilder()
                .setTitle('💪 Motivation')
                .setDescription(randomQuote)
                .setColor(0xff6600)
                .setFooter({ text: 'EVA Battle Arena Team' })
                .setTimestamp();

            await interaction.reply({ embeds: [embed] });
            break;

        case 'message':
            const messageMotivant = interaction.options.getString('message');
            
            const customEmbed = new EmbedBuilder()
                .setTitle('💪 Message de l\'équipe')
                .setDescription(messageMotivant)
                .addFields({ name: 'De la part de', value: `${interaction.user.displayName}`, inline: true })
                .setColor(0xff6600)
                .setThumbnail(interaction.user.displayAvatarURL())
                .setTimestamp();

            await interaction.reply({ embeds: [customEmbed] });
            break;
    }
}

// Gestionnaire des votes
async function handleVoteCommand(interaction) {
    const subcommand = interaction.options.getSubcommand();

    switch (subcommand) {
        case 'creer':
            const type = interaction.options.getString('type');
            const question = interaction.options.getString('question');
            const optionsStr = interaction.options.getString('options');
            const duree = interaction.options.getInteger('duree') || 24;

            const options = optionsStr.split('|').map(opt => opt.trim());
            
            if (options.length < 2) {
                await interaction.reply({ content: '❌ Il faut au moins 2 options séparées par |', ephemeral: true });
                return;
            }

            if (options.length > 10) {
                await interaction.reply({ content: '❌ Maximum 10 options par vote', ephemeral: true });
                return;
            }

            const votes = Database.load('votes');
            const voteId = Date.now().toString();
            const endTime = new Date(Date.now() + duree * 60 * 60 * 1000);

            votes[voteId] = {
                id: voteId,
                type,
                question,
                options,
                votes: {}, // userId: optionIndex
                createdBy: interaction.user.id,
                createdAt: new Date().toISOString(),
                endTime: endTime.toISOString(),
                active: true
            };

            Database.save('votes', votes);

            // Créer les boutons de vote
            const buttons = options.slice(0, 5).map((option, index) => 
                new ButtonBuilder()
                    .setCustomId(`vote_${voteId}_${index}`)
                    .setLabel(`${index + 1}. ${option}`)
                    .setStyle(ButtonStyle.Primary)
            );

            const row1 = new ActionRowBuilder().addComponents(buttons);
            let row2 = null;

            // Si plus de 5 options, créer une deuxième rangée
            if (options.length > 5) {
                const buttons2 = options.slice(5, 10).map((option, index) => 
                    new ButtonBuilder()
                        .setCustomId(`vote_${voteId}_${index + 5}`)
                        .setLabel(`${index + 6}. ${option}`)
                        .setStyle(ButtonStyle.Primary)
                );
                row2 = new ActionRowBuilder().addComponents(buttons2);
            }

            const typeEmojis = {
                map_preference: '🗺️',
                strategy: '⚔️',
                training_time: '📅',
                objective: '🎯',
                custom: '❓'
            };

            const voteEmbed = new EmbedBuilder()
                .setTitle(`${typeEmojis[type]} ${question}`)
                .setDescription(`**Options disponibles :**\n${options.map((opt, i) => `${i + 1}. ${opt}`).join('\n')}\n\n🕐 **Se termine :** ${endTime.toLocaleDateString('fr-FR')} à ${endTime.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}`)
                .addFields(
                    { name: 'ID du Vote', value: `\`${voteId}\``, inline: true },
                    { name: 'Créé par', value: `<@${interaction.user.id}>`, inline: true },
                    { name: 'Participants', value: '0/6 joueurs', inline: true }
                )
                .setColor(0x00aaff)
                .setFooter({ text: 'Cliquez sur les boutons pour voter !' })
                .setTimestamp();

            const components = row2 ? [row1, row2] : [row1];
            await interaction.reply({ embeds: [voteEmbed], components });
            break;

        case 'liste':
            const allVotes = Database.load('votes');
            const activeVotes = Object.values(allVotes).filter(v => v.active);

            if (activeVotes.length === 0) {
                await interaction.reply('🗳️ Aucun vote en cours pour le moment.');
                return;
            }

            const listEmbed = new EmbedBuilder()
                .setTitle('🗳️ Votes en cours')
                .setColor(0x00aaff);

            activeVotes.forEach(vote => {
                const creator = client.users.cache.get(vote.createdBy);
                const endTime = new Date(vote.endTime);
                const voteCount = Object.keys(vote.votes).length;
                
                listEmbed.addFields({
                    name: vote.question,
                    value: `**ID:** \`${vote.id}\`\n**Créé par:** ${creator?.displayName || 'Inconnu'}\n**Votes:** ${voteCount}/6\n**Fin:** ${endTime.toLocaleDateString('fr-FR')} ${endTime.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}`,
                    inline: false
                });
            });

            await interaction.reply({ embeds: [listEmbed] });
            break;

        case 'resultats':
            const voteId = interaction.options.getString('vote_id');
            const allVotes2 = Database.load('votes');
            const vote = allVotes2[voteId];

            if (!vote) {
                await interaction.reply({ content: '❌ Vote introuvable.', ephemeral: true });
                return;
            }

            // Compter les votes
            const results = {};
            vote.options.forEach((option, index) => {
                results[index] = { option, count: 0, voters: [] };
            });

            Object.entries(vote.votes).forEach(([userId, optionIndex]) => {
                results[optionIndex].count++;
                const user = client.users.cache.get(userId);
                results[optionIndex].voters.push(user?.displayName || 'Inconnu');
            });

            // Trier par nombre de votes
            const sortedResults = Object.values(results).sort((a, b) => b.count - a.count);

            const resultsEmbed = new EmbedBuilder()
                .setTitle(`📊 Résultats : ${vote.question}`)
                .setDescription(`**Total des votes :** ${Object.keys(vote.votes).length}/6 joueurs`)
                .setColor(vote.active ? 0x00aaff : 0x00ff00)
                .setFooter({ text: vote.active ? 'Vote en cours' : 'Vote terminé' })
                .setTimestamp();

            sortedResults.forEach((result, index) => {
                const medal = index === 0 && result.count > 0 ? '🥇 ' : index === 1 && result.count > 0 ? '🥈 ' : index === 2 && result.count > 0 ? '🥉 ' : '';
                const percentage = Object.keys(vote.votes).length > 0 ? Math.round((result.count / Object.keys(vote.votes).length) * 100) : 0;
                
                resultsEmbed.addFields({
                    name: `${medal}${result.option}`,
                    value: `**${result.count} votes** (${percentage}%)\n${result.voters.length > 0 ? `Votants: ${result.voters.join(', ')}` : 'Aucun vote'}`,
                    inline: false
                });
            });

            await interaction.reply({ embeds: [resultsEmbed] });
            break;

        case 'fermer':
            // Vérification Coach Unit
            const isCoach = interaction.member.roles.cache.some(role => 
                role.name.toLowerCase().includes('coach unit')
            );
            
            if (!isCoach) {
                await interaction.reply({ content: '❌ Seuls les Coach Unit peuvent fermer un vote.', ephemeral: true });
                return;
            }

            const closeVoteId = interaction.options.getString('vote_id');
            const allVotes3 = Database.load('votes');
            
            if (!allVotes3[closeVoteId]) {
                await interaction.reply({ content: '❌ Vote introuvable.', ephemeral: true });
                return;
            }

            allVotes3[closeVoteId].active = false;
            allVotes3[closeVoteId].closedBy = interaction.user.id;
            allVotes3[closeVoteId].closedAt = new Date().toISOString();
            
            Database.save('votes', allVotes3);

            await interaction.reply(`✅ Vote fermé par ${interaction.user.displayName}. Utilisez \`/vote resultats ${closeVoteId}\` pour voir les résultats finaux.`);
            break;
    }
}

// Gestionnaire des interactions des boutons de vote
client.on('interactionCreate', async interaction => {
    if (!interaction.isButton()) return;

    if (interaction.customId.startsWith('vote_')) {
        const [, voteId, optionIndex] = interaction.customId.split('_');
        const votes = Database.load('votes');
        const vote = votes[voteId];

        if (!vote || !vote.active) {
            await interaction.reply({ content: '❌ Ce vote n\'est plus actif.', ephemeral: true });
            return;
        }

        // Vérifier si le vote n'est pas expiré
        if (new Date() > new Date(vote.endTime)) {
            vote.active = false;
            Database.save('votes', votes);
            await interaction.reply({ content: '❌ Ce vote a expiré.', ephemeral: true });
            return;
        }

        // Enregistrer le vote
        vote.votes[interaction.user.id] = parseInt(optionIndex);
        Database.save('votes', votes);

        const selectedOption = vote.options[optionIndex];
        await interaction.reply({ 
            content: `✅ Vote enregistré pour : **${selectedOption}**\n\nUtilisez \`/vote resultats ${voteId}\` pour voir les résultats actuels.`, 
            ephemeral: true 
        });

        // Mettre à jour l'embed original avec le nouveau nombre de participants
        const voteCount = Object.keys(vote.votes).length;
        const originalEmbed = interaction.message.embeds[0];
        const updatedEmbed = new EmbedBuilder(originalEmbed.toJSON());
        
        // Mettre à jour le champ participants
        const fields = updatedEmbed.toJSON().fields;
        fields[2] = { name: 'Participants', value: `${voteCount}/6 joueurs`, inline: true };
        updatedEmbed.setFields(fields);

        try {
            await interaction.message.edit({ embeds: [updatedEmbed], components: interaction.message.components });
        } catch (error) {
            // Ignore les erreurs de modification de message
        }
    }
});

// Gestionnaire des commandes coach
async function handleCoachCommand(interaction) {
    const subcommand = interaction.options.getSubcommand();
    
    // Vérification si l'utilisateur est coach
    const isCoach = interaction.member.roles.cache.some(role => 
        role.name.toLowerCase().includes('coach unit')
    );
    
    if (!isCoach) {
        await interaction.reply({ content: '❌ Cette commande est réservée aux Coach Unit.', ephemeral: true });
        return;
    }

    switch (subcommand) {
        case 'note':
            const sujet = interaction.options.getString('sujet');
            const contenu = interaction.options.getString('contenu');
            
            const notes = Database.load('coach_notes');
            const noteId = Date.now().toString();
            
            if (!notes.team_notes) notes.team_notes = [];
            
            notes.team_notes.push({
                id: noteId,
                sujet,
                contenu,
                coach: interaction.user.id,
                date: new Date().toISOString()
            });
            
            Database.save('coach_notes', notes);
            
            const embed = new EmbedBuilder()
                .setTitle('📝 Note d\'équipe ajoutée')
                .addFields(
                    { name: 'Sujet', value: sujet, inline: true },
                    { name: 'Coach', value: `<@${interaction.user.id}>`, inline: true },
                    { name: 'Contenu', value: contenu, inline: false }
                )
                .setColor(0x9900cc)
                .setTimestamp();
            
            await interaction.reply({ embeds: [embed] });
            break;

        case 'notes':
            const allNotes = Database.load('coach_notes');
            const teamNotes = allNotes.team_notes || [];
            
            if (teamNotes.length === 0) {
                await interaction.reply('📝 Aucune note d\'équipe pour le moment.');
                return;
            }

            const notesEmbed = new EmbedBuilder()
                .setTitle('📝 Notes d\'équipe')
                .setColor(0x9900cc);

            // Afficher les 5 dernières notes
            teamNotes
                .sort((a, b) => new Date(b.date) - new Date(a.date))
                .slice(0, 5)
                .forEach(note => {
                    const coach = client.users.cache.get(note.coach);
                    const date = new Date(note.date).toLocaleDateString('fr-FR');
                    notesEmbed.addFields({
                        name: `${note.sujet} (${date})`,
                        value: `${note.contenu.substring(0, 100)}${note.contenu.length > 100 ? '...' : ''}\n*Par ${coach?.displayName || 'Coach inconnu'}*`,
                        inline: false
                    });
                });

            await interaction.reply({ embeds: [notesEmbed] });
            break;

        case 'bilan':
            const bilan = await generateTeamSummary();
            await interaction.reply({ embeds: [bilan] });
            break;
    }
}

// Fonction pour générer un bilan d'équipe
async function generateTeamSummary() {
    const matches = Database.load('matches');
    const objectives = Database.load('objectives');
    const investment = Database.load('investment');
    
    const matchHistory = Object.values(matches);
    const completedObjectives = Object.values(objectives).filter(obj => obj.complete);
    const activeObjectives = Object.values(objectives).filter(obj => !obj.complete);
    
    // Calculs de base
    const totalMatches = matchHistory.length;
    const victories = matchHistory.filter(m => m.resultat === 'victoire').length;
    const defeats = matchHistory.filter(m => m.resultat === 'defaite').length;
    const winRate = totalMatches > 0 ? Math.round((victories / totalMatches) * 100) : 0;
    
    // Forme récente (5 derniers matchs)
    const recentMatches = matchHistory
        .sort((a, b) => new Date(b.date) - new Date(a.date))
        .slice(0, 5);
    const recentForm = recentMatches.map(m => m.resultat === 'victoire' ? 'V' : 'D').join('-');
    
    // Investissement de l'équipe
    const totalInvestors = Object.keys(investment).length;
    const avgVocalTime = totalInvestors > 0 
        ? Math.round(Object.values(investment).reduce((sum, inv) => sum + inv.temps_vocal, 0) / totalInvestors / 60) 
        : 0;

    const bilanEmbed = new EmbedBuilder()
        .setTitle('📊 Bilan d\'équipe EVA Battle Arena')
        .setDescription('**🎯 Objectif : Division 3 → Division 2**')
        .addFields(
            { 
                name: '⚔️ Performances de match', 
                value: `Matchs joués: ${totalMatches}\nVictoires: ${victories} | Défaites: ${defeats}\nTaux de victoire: ${winRate}%\nForme récente: ${recentForm || 'Aucun match récent'}`, 
                inline: true 
            },
            { 
                name: '🎯 Objectifs', 
                value: `En cours: ${activeObjectives.length}\nAtteints: ${completedObjectives.length}\nProgression visible !`, 
                inline: true 
            },
            { 
                name: '📊 Investissement équipe', 
                value: `Joueurs actifs: ${totalInvestors}\nTemps vocal moyen: ${avgVocalTime}h\nCohésion d'équipe positive`, 
                inline: true 
            },
            {
                name: '🚀 Prochaines étapes',
                value: '• Maintenir la régularité des entraînements\n• Continuer le travail en équipe (vocal)\n• Se fixer de nouveaux objectifs\n• Analyser nos matchs pour progresser',
                inline: false
            }
        )
        .setColor(0x00ccff)
        .setFooter({ text: 'Bilan généré par les coachs' })
        .setTimestamp();

    return bilanEmbed;
}

// Gestion des événements vocaux (suivi du temps d'investissement)
client.on('voiceStateUpdate', (oldState, newState) => {
    const userId = newState.id;
    
    // Si l'utilisateur rejoint un channel vocal
    if (!oldState.channelId && newState.channelId) {
        const voiceSessions = Database.load('voice_sessions');
        voiceSessions[userId] = {
            start: new Date().toISOString(),
            channel: newState.channelId
        };
        Database.save('voice_sessions', voiceSessions);
    }
    
    // Si l'utilisateur quitte un channel vocal
    if (oldState.channelId && !newState.channelId) {
        const voiceSessions = Database.load('voice_sessions');
        if (voiceSessions[userId]) {
            const startTime = new Date(voiceSessions[userId].start);
            const endTime = new Date();
            const duration = Math.floor((endTime - startTime) / (1000 * 60)); // en minutes
            
            // Met à jour le temps d'investissement
            const investment = Database.load('investment');
            if (!investment[userId]) {
                investment[userId] = {
                    temps_vocal: 0,
                    participations_events: 0,
                    derniere_activite: null
                };
            }
            
            investment[userId].temps_vocal += duration;
            investment[userId].derniere_activite = new Date().toISOString();
            
            Database.save('investment', investment);
            
            delete voiceSessions[userId];
            Database.save('voice_sessions', voiceSessions);
        }
    }
});

// Suivi des participations aux événements
client.on('interactionCreate', async interaction => {
    if (!interaction.isCommand()) return;
    
    // Si quelqu'un participe à un événement, on met à jour ses stats d'investissement
    if (interaction.commandName === 'event' && interaction.options.getSubcommand() === 'participer') {
        const investment = Database.load('investment');
        const userId = interaction.user.id;
        
        if (!investment[userId]) {
            investment[userId] = {
                temps_vocal: 0,
                participations_events: 0,
                derniere_activite: null
            };
        }
        
        investment[userId].participations_events += 1;
        investment[userId].derniere_activite = new Date().toISOString();
        
        Database.save('investment', investment);
    }
});

// Fermeture automatique des votes expirés
setInterval(() => {
    const votes = Database.load('votes');
    const now = new Date();
    let hasChanges = false;
    
    Object.values(votes).forEach(vote => {
        if (vote.active && new Date(vote.endTime) < now) {
            vote.active = false;
            vote.autoClosedAt = now.toISOString();
            hasChanges = true;
            
            // Optionnel : notifier dans le channel général
            const channel = client.channels.cache.find(ch => ch.name === 'général');
            if (channel && Object.keys(vote.votes).length > 0) {
                const embed = new EmbedBuilder()
                    .setTitle('🗳️ Vote terminé automatiquement')
                    .setDescription(`**${vote.question}**\n\nVote fermé automatiquement après expiration.\nUtilisez \`/vote resultats ${vote.id}\` pour voir les résultats.`)
                    .setColor(0xff9900)
                    .setTimestamp();
                
                channel.send({ embeds: [embed] });
            }
        }
    });
    
    if (hasChanges) {
        Database.save('votes', votes);
    }
}, 10 * 60 * 1000); // Vérification toutes les 10 minutes

// Rappels d'événements (1 heure avant)
setInterval(() => {
    const sessions = TrainingSession.getUpcoming();
    const now = new Date();
    
    sessions.forEach(session => {
        const sessionDate = new Date(session.date);
        const timeUntil = sessionDate - now;
        
        // Rappel 1 heure avant
        if (timeUntil > 0 && timeUntil <= 60 * 60 * 1000) {
            const channel = client.channels.cache.find(ch => ch.name === 'général');
            if (channel) {
                const typeEmojis = {
                    entrainement_4v4: '🎯',
                    entrainement_6v4: '🎯',
                    match_4v4: '⚔️',
                    amical: '🤝',
                    review: '📺',
                    teambuilding: '🎉'
                };
                
                const embed = new EmbedBuilder()
                    .setTitle(`⏰ Rappel - ${typeEmojis[session.type] || '📅'} ${session.type}`)
                    .setDescription(`L'événement commence dans 1 heure !\n\n**Description:** ${session.description}`)
                    .addFields({ name: 'Participants confirmés', value: session.participants.length.toString(), inline: true })
                    .setColor(0xffaa00)
                    .setTimestamp();
                
                channel.send({ embeds: [embed] });
            }
        }
    });
}, 15 * 60 * 1000); // Vérification toutes les 15 minutes

// Commande d'aide
const helpCommand = new SlashCommandBuilder()
    .setName('aide')
    .setDescription('Affiche l\'aide du bot EVA');

commands.push(helpCommand);

client.on('interactionCreate', async interaction => {
    if (!interaction.isCommand()) return;
    
    if (interaction.commandName === 'aide') {
        const helpEmbed = new EmbedBuilder()
            .setTitle('🎮 Aide Bot EVA Battle Arena')
            .setDescription('Voici toutes les commandes disponibles pour notre équipe Division 3 !')
            .addFields(
                {
                    name: '📅 Événements',
                    value: '`/event creer` - Créer un événement\n`/event liste` - Voir les événements\n`/event participer` - Confirmer sa participation',
                    inline: false
                },
                {
                    name: '⚔️ Équipe',
                    value: '`/equipe role` - Assigner un rôle EVA\n`/equipe composition` - Voir la compo\n`/equipe lineup` - Définir le lineup (coachs)',
                    inline: false
                },
                {
                    name: '📊 Investissement',
                    value: '`/investissement voir` - Voir son investissement\n`/investissement classement` - Classement d\'investissement',
                    inline: false
                },
                {
                    name: '🎯 Objectifs',
                    value: '`/objectif definir` - Créer un objectif\n`/objectif liste` - Voir les objectifs\n`/objectif completer` - Marquer comme fait',
                    inline: false
                },
                {
                    name: '⚔️ Matchs',
                    value: '`/match resultat` - Enregistrer un résultat\n`/match historique` - Voir l\'historique',
                    inline: false
                },
                {
                    name: '🗳️ Votes',
                    value: '`/vote creer` - Créer un vote\n`/vote liste` - Votes en cours\n`/vote resultats` - Voir les résultats',
                    inline: false
                },
                {
                    name: '💪 Motivation',
                    value: '`/motivation citation` - Citation motivante\n`/motivation message` - Message personnalisé',
                    inline: false
                },
                {
                    name: '👨‍🏫 Coach Unit uniquement',
                    value: '`/coach note` - Ajouter une note d\'équipe\n`/coach notes` - Voir les notes\n`/coach bilan` - Bilan complet\n`/vote fermer` - Fermer un vote',
                    inline: false
                }
            )
            .setColor(0x0099ff)
            .setFooter({ text: 'Bot spécialement conçu pour notre équipe EVA !' })
            .setTimestamp();

        await interaction.reply({ embeds: [helpEmbed] });
    }
});

// Message de bienvenue au démarrage
client.once('ready', () => {
    const channel = client.channels.cache.find(ch => ch.name === 'général');
    if (channel) {
        const welcomeEmbed = new EmbedBuilder()
            .setTitle('🎮 Bot EVA Team est en ligne !')
            .setDescription('Je suis là pour vous aider à progresser vers la **Division 2** !')
            .addFields(
                { name: '🚀 Fonctionnalités principales', value: '• Gestion des événements\n• Suivi de l\'investissement\n• Gestion des objectifs\n• Système de votes\n• Outils pour les coachs', inline: false },
                { name: '📖 Aide', value: 'Tapez `/aide` pour voir toutes les commandes !', inline: false }
            )
            .setColor(0x00ff00)
            .setTimestamp();
        
        setTimeout(() => {
            channel.send({ embeds: [welcomeEmbed] });
        }, 2000);
    }
});

// Démarrage du bot
client.login(process.env.DISCORD_TOKEN);const { Client, GatewayIntentBits, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, SlashCommandBuilder } = require('discord.js');
const fs = require('fs');
const path = require('path');

// Configuration du bot
const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.GuildMembers,
        GatewayIntentBits.GuildVoiceStates
    ]
});

// Base de données simple en fichier JSON
const DB_PATH = './data/';
if (!fs.existsSync(DB_PATH)) fs.mkdirSync(DB_PATH, { recursive: true });

// Système de stockage des données
class Database {
    static load(file) {
        const filepath = path.join(DB_PATH, `${file}.json`);
        if (fs.existsSync(filepath)) {
            return JSON.parse(fs.readFileSync(filepath, 'utf8'));
        }
        return {};
    }

    static save(file, data) {
        const filepath = path.join(DB_PATH, `${file}.json`);
        fs.writeFileSync(filepath, JSON.stringify(data, null, 2));
    }
}

// Gestion des sessions d'entraînement
class TrainingSession {
    static create(coachId, date, description, type = 'entrainement') {
        const sessions = Database.load('training');
        const id = Date.now().toString();
        
        sessions[id] = {
            id,
            coach: coachId,
            date,
            description,
            type,
            participants: [],
            status: 'planifiee',
            created: new Date().toISOString()
        };
        
        Database.save('training', sessions);
        return sessions[id];
    }

    static getUpcoming() {
        const sessions = Database.load('training');
        const now = new Date();
        
        return Object.values(sessions)
            .filter(s => new Date(s.date) > now)
            .sort((a, b) => new Date(a.date) - new Date(b.date));
    }

    static addParticipant(sessionId, userId) {
        const sessions = Database.load('training');
        if (sessions[sessionId] && !sessions[sessionId].participants.includes(userId)) {
            sessions[sessionId].participants.push(userId);
            Database.save('training', sessions);
            return true;
        }
        return false;
    }
}

// Commandes slash
const commands = [
    // Commande pour les entraînements et événements
    new SlashCommandBuilder()
        .setName('event')
        .setDescription('Gère les événements d\'équipe')
        .addSubcommand(sub => 
            sub.setName('creer')
                .setDescription('Créer un événement (entraînement, match, etc.)')
                .addStringOption(opt => opt.setName('type').setDescription('Type d\'événement').setRequired(true)
                    .addChoices(
                        { name: '🎯 Entraînement 4v4', value: 'entrainement_4v4' },
                        { name: '🎯 Entraînement 6v4', value: 'entrainement_6v4' },
                        { name: '⚔️ Match officiel 4v4', value: 'match_4v4' },
                        { name: '🤝 Match amical', value: 'amical' },
                        { name: '📺 Review de match', value: 'review' },
                        { name: '🎉 Événement team building', value: 'teambuilding' }
                    ))
                .addStringOption(opt => opt.setName('date').setDescription('Date (DD/MM/YYYY HH:MM)').setRequired(true))
                .addStringOption(opt => opt.setName('description').setDescription('Description de l\'événement').setRequired(true))
        )
        .addSubcommand(sub =>
            sub.setName('liste')
                .setDescription('Voir les prochains événements')
        )
        .addSubcommand(sub =>
            sub.setName('participer')
                .setDescription('Confirmer sa participation à un événement')
                .addStringOption(opt => opt.setName('event_id').setDescription('ID de l\'événement').setRequired(true))
        ),

    // Commande pour la gestion des rôles dans l'équipe
    new SlashCommandBuilder()
        .setName('equipe')
        .setDescription('Gestion de l\'équipe')
        .addSubcommand(sub =>
            sub.setName('role')
                .setDescription('Assigner un rôle EVA à un joueur')
                .addUserOption(opt => opt.setName('joueur').setDescription('Le joueur').setRequired(true))
                .addStringOption(opt => opt.setName('role').setDescription('Rôle EVA').setRequired(true)
                    .addChoices(
                        { name: 'Assault', value: 'assault' },
                        { name: 'Support', value: 'support' },
                        { name: 'Sniper', value: 'sniper' },
                        { name: 'Flanker', value: 'flanker' },
                        { name: 'IGL (In-Game Leader)', value: 'igl' }
                    ))
        )
        .addSubcommand(sub =>
            sub.setName('composition')
                .setDescription('Voir la composition actuelle de l\'équipe')
        )
        .addSubcommand(sub =>
            sub.setName('lineup')
                .setDescription('Définir la composition pour le prochain match (4v4)')
                .addUserOption(opt => opt.setName('joueur1').setDescription('Joueur 1').setRequired(true))
                .addUserOption(opt => opt.setName('joueur2').setDescription('Joueur 2').setRequired(true))
                .addUserOption(opt => opt.setName('joueur3').setDescription('Joueur 3').setRequired(true))
                .addUserOption(opt => opt.setName('joueur4').setDescription('Joueur 4').setRequired(true))
        ),

    // Commande de suivi d'investissement (temps vocal, participation)
    new SlashCommandBuilder()
        .setName('investissement')
        .setDescription('Suivi de l\'investissement des joueurs')
        .addSubcommand(sub =>
            sub.setName('voir')
                .setDescription('Voir l\'investissement d\'un joueur')
                .addUserOption(opt => opt.setName('joueur').setDescription('Le joueur'))
        )
        .addSubcommand(sub =>
            sub.setName('classement')
                .setDescription('Classement d\'investissement de l\'équipe')
        ),

    // Commande pour les objectifs d'équipe
    new SlashCommandBuilder()
        .setName('objectif')
        .setDescription('Gestion des objectifs d\'équipe')
        .addSubcommand(sub =>
            sub.setName('definir')
                .setDescription('Définir un nouvel objectif')
                .addStringOption(opt => opt.setName('titre').setDescription('Titre de l\'objectif').setRequired(true))
                .addStringOption(opt => opt.setName('description').setDescription('Description détaillée').setRequired(true))
                .addStringOption(opt => opt.setName('echeance').setDescription('Date limite (DD/MM/YYYY)'))
        )
        .addSubcommand(sub =>
            sub.setName('liste')
                .setDescription('Voir tous les objectifs en cours')
        )
        .addSubcommand(sub =>
            sub.setName('completer')
                .setDescription('Marquer un objectif comme accompli')
                .addStringOption(opt => opt.setName('objectif_id').setDescription('ID de l\'objectif').setRequired(true))
        ),

    // Commande pour les résultats de matchs (simple)
    new SlashCommandBuilder()
        .setName('match')
        .setDescription('Gestion des résultats de matchs')
        .addSubcommand(sub =>
            sub.setName('resultat')
                .setDescription('Enregistrer le résultat d\'un match')
                .addStringOption(opt => opt.setName('adversaire').setDescription('Équipe adverse').setRequired(true))
                .addStringOption(opt => opt.setName('resultat').setDescription('Résultat').setRequired(true)
                    .addChoices(
                        { name: '✅ Victoire', value: 'victoire' },
                        { name: '❌ Défaite', value: 'defaite' }
                    ))
                .addStringOption(opt => opt.setName('score').setDescription('Score (ex: 13-8)'))
                .addStringOption(opt => opt.setName('notes').setDescription('Notes sur le match'))
        )
        .addSubcommand(sub =>
            sub.setName('historique')
                .setDescription('Voir l\'historique des matchs')
        ),

    // Commande de motivation manuelle
    new SlashCommandBuilder()
        .setName('motivation')
        .setDescription('Messages de motivation pour l\'équipe')
        .addSubcommand(sub =>
            sub.setName('citation')
                .setDescription('Afficher une citation motivante')
        )
        .addSubcommand(sub =>
            sub.setName('message')
                .setDescription('Envoyer un message motivant personnalisé')
                .addStringOption(opt => opt.setName('message').setDescription('Votre message motivant').setRequired(true))
        ),

    // Système de votes
    new SlashCommandBuilder()
        .setName('vote')
        .setDescription('Système de votes pour l\'équipe')
        .addSubcommand(sub =>
            sub.setName('creer')
                .setDescription('Créer un nouveau vote')
                .addStringOption(opt => opt.setName('type').setDescription('Type de vote').setRequired(true)
                    .addChoices(
                        { name: '🗺️ Préférence de map', value: 'map_preference' },
                        { name: '⚔️ Stratégie à adopter', value: 'strategy' },
                        { name: '📅 Horaire d\'entraînement', value: 'training_time' },
                        { name: '🎯 Objectif prioritaire', value: 'objective' },
                        { name: '❓ Vote personnalisé', value: 'custom' }
                    ))
                .addStringOption(opt => opt.setName('question').setDescription('Question du vote').setRequired(true))
                .addStringOption(opt => opt.setName('options').setDescription('Options séparées par | (ex: Map1|Map2|Map3)').setRequired(true))
                .addIntegerOption(opt => opt.setName('duree').setDescription('Durée en heures (défaut: 24h)'))
        )
        .addSubcommand(sub =>
            sub.setName('liste')
                .setDescription('Voir tous les votes en cours')
        )
        .addSubcommand(sub =>
            sub.setName('resultats')
                .setDescription('Voir les résultats d\'un vote')
                .addStringOption(opt => opt.setName('vote_id').setDescription('ID du vote').setRequired(true))
        )
        .addSubcommand(sub =>
            sub.setName('fermer')
                .setDescription('Fermer un vote (Coach Unit uniquement)')
                .addStringOption(opt => opt.setName('vote_id').setDescription('ID du vote').setRequired(true))
        ),

    // Commandes coach simplifiées
    new SlashCommandBuilder()
        .setName('coach')
        .setDescription('Outils pour les coachs')
        .addSubcommand(sub =>
            sub.setName('note')
                .setDescription('Ajouter une note d\'équipe')
                .addStringOption(opt => opt.setName('sujet').setDescription('Sujet de la note').setRequired(true))
                .addStringOption(opt => opt.setName('contenu').setDescription('Contenu de la note').setRequired(true))
        )
        .addSubcommand(sub =>
            sub.setName('notes')
                .setDescription('Voir toutes les notes d\'équipe')
        )
        .addSubcommand(sub =>
            sub.setName('bilan')
                .setDescription('Faire un bilan d\'équipe')
        )
];

// Citations motivantes pour l'e-sport
const motivationalQuotes = [
    "🔥 **Division 2 nous attend !** Chaque match nous rapproche de notre objectif !",
    "⚔️ **L'équipe qui communique ensemble, gagne ensemble !** Notre coordination fait la différence !",
    "🎯 **Précision, stratégie, teamwork !** EVA Battle Arena récompense les équipes organisées !",
    "💪 **De Division 3 à Division 1 !** Un pas à la fois, mais toujours vers le haut !",
    "🏆 **Chaque entraînement compte !** C'est notre investissement qui paiera !",
    "🚀 **Nous sommes les pionniers de l'e-sport VR !** Montrons l'exemple !",
    "⭐ **Nos coachs nous guident, notre détermination nous mène à la victoire !**"
];

// Événement de connexion du bot
client.once('ready', () => {
    console.log(`🎮 Bot EVA Team connecté en tant que ${client.user.tag}`);
    
    // Mise à jour du statut
    client.user.setActivity('EVA Battle Arena | Division 3 → Division 2', { type: 'PLAYING' });
    
    // Enregistrement des commandes slash
    client.application.commands.set(commands);
});

// Gestion des commandes slash
client.on('interactionCreate', async interaction => {
    if (!interaction.isCommand()) return;

    const { commandName } = interaction;

    try {
        switch (commandName) {
            case 'event':
                await handleEventCommand(interaction);
                break;
            case 'equipe':
                await handleTeamCommand(interaction);
                break;
            case 'investissement':
                await handleInvestmentCommand(interaction);
                break;
            case 'objectif':
                await handleObjectiveCommand(interaction);
                break;
            case 'match':
                await handleMatchCommand(interaction);
                break;
            case 'motivation':
                await handleMotivationCommand(interaction);
                break;
            case 'vote':
                await handleVoteCommand(interaction);
                break;
            case 'coach':
                await handleCoachCommand(interaction);
                break;
        }
    } catch (error) {
        console.error('Erreur lors de l\'exécution de la commande:', error);
        await interaction.reply({ content: '❌ Une erreur s\'est produite lors de l\'exécution de la commande.', ephemeral: true });
    }
});

// Gestionnaire des événements
async function handleEventCommand(interaction) {
    const subcommand = interaction.options.getSubcommand();

    switch (subcommand) {
        case 'creer':
            const type = interaction.options.getString('type');
            const dateStr = interaction.options.getString('date');
            const description = interaction.options.getString('description');

            try {
                const [datePart, timePart] = dateStr.split(' ');
                const [day, month, year] = datePart.split('/');
                const [hour, minute] = timePart.split(':');
                const date = new Date(year, month - 1, day, hour, minute);

                const session = TrainingSession.create(interaction.user.id, date.toISOString(), description, type);

                const typeEmojis = {
                    entrainement_4v4: '🎯',
                    entrainement_6v4: '🎯',
                    match_4v4: '⚔️',
                    amical: '🤝',
                    review: '📺',
                    teambuilding: '🎉'
                };

                const embed = new EmbedBuilder()
                    .setTitle(`${typeEmojis[type]} Événement créé`)
                    .addFields(
                        { name: 'Type', value: type.charAt(0).toUpperCase() + type.slice(1), inline: true },
                        { name: 'Date', value: date.toLocaleDateString('fr-FR') + ' à ' + date.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }), inline: true },
                        { name: 'Organisateur', value: `<@${interaction.user.id}>`, inline: true },
                        { name: 'Description', value: description, inline: false },
                        { name: 'ID Événement', value: `\`${session.id}\``, inline: false }
                    )
                    .setColor(0x00ff00)
                    .setFooter({ text: 'Utilisez /event participer avec cet ID pour confirmer votre participation' })
                    .setTimestamp();

                await interaction.reply({ embeds: [embed] });
            } catch (error) {
                await interaction.reply({ content: '❌ Format de date invalide. Utilisez DD/MM/YYYY HH:MM', ephemeral: true });
            }
            break;

        case 'liste':
            const sessions = TrainingSession.getUpcoming();
            
            if (sessions.length === 0) {
                await interaction.reply('📅 Aucun événement planifié pour le moment.');
                return;
            }

            const listEmbed = new EmbedBuilder()
                .setTitle('📅 Prochains événements')
                .setColor(0x0099ff);

            sessions.forEach((session, index) => {
                const date = new Date(session.date);
                const organizer = client.users.cache.get(session.coach);
                const typeEmojis = {
                    entrainement_4v4: '🎯',
                    entrainement_6v4: '🎯',
                    match_4v4: '⚔️',
                    amical: '🤝',
                    review: '📺',
                    teambuilding: '🎉'
                };
                
                listEmbed.addFields({
                    name: `${typeEmojis[session.type] || '📅'} ${date.toLocaleDateString('fr-FR')} à ${date.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}`,
                    value: `**Type:** ${session.type}\n**Organisateur:** ${organizer?.displayName || 'Inconnu'}\n**Description:** ${session.description}\n**Participants:** ${session.participants.length}\n**ID:** \`${session.id}\``,
                    inline: false
                });
            });

            await interaction.reply({ embeds: [listEmbed] });
            break;

        case 'participer':
            const eventId = interaction.options.getString('event_id');
            const success = TrainingSession.addParticipant(eventId, interaction.user.id);
            
            if (success) {
                await interaction.reply(`✅ Participation confirmée pour l'événement \`${eventId}\` !`);
            } else {
                await interaction.reply({ content: '❌ Événement introuvable ou vous participez déjà.', ephemeral: true });
            }
            break;
    }
}

// Gestionnaire de l'équipe
async function handleTeamCommand(interaction) {
    const subcommand = interaction.options.getSubcommand();

    switch (subcommand) {
        case 'role':
            const joueur = interaction.options.getUser('joueur');
            const role = interaction.options.getString('role');

            const roles = Database.load('roles');
            roles[joueur.id] = {
                role,
                assignePar: interaction.user.id,
                date: new Date().toISOString()
            };
            Database.save('roles', roles);

            const roleNamesTeam = {
                assault: 'Assault',
                support: 'Support',
                sniper: 'Sniper',
                flanker: 'Flanker',
                igl: 'IGL (In-Game Leader)'
            };

            const embed = new EmbedBuilder()
                .setTitle('⚔️ Rôle assigné')
                .setDescription(`${joueur.displayName} a été assigné au rôle **${roleNamesTeam[role]}**`)
                .setColor(0xff0099)
                .setTimestamp();

            await interaction.reply({ embeds: [embed] });
            break;

        case 'composition':
            const allRoles = Database.load('roles');
            
            const composition = {};
            Object.entries(allRoles).forEach(([userId, data]) => {
                if (!composition[data.role]) composition[data.role] = [];
                composition[data.role].push(userId);
            });

            const compEmbed = new EmbedBuilder()
                .setTitle('⚔️ Composition de l\'équipe')
                .setColor(0xff0099);

            const roleNamesComposition = {
                assault: '🔥 Assault',
                support: '🛡️ Support',
                sniper: '🎯 Sniper',
                flanker: '👻 Flanker',
                igl: '👑 IGL (In-Game Leader)'
            };

            Object.entries(roleNamesComposition).forEach(([roleKey, roleName]) => {
                const players = composition[roleKey] || [];
                const playerNames = players.map(id => {
                    const user = client.users.cache.get(id);
                    return user ? user.displayName : 'Joueur inconnu';
                }).join(', ') || 'Aucun joueur assigné';

                compEmbed.addFields({
                    name: roleName,
                    value: playerNames,
                    inline: false
                });
            });

            await interaction.reply({ embeds: [compEmbed] });
            break;

        case 'lineup':
            // Vérification si l'utilisateur est coach
            const isCoach = interaction.member.roles.cache.some(role => 
                role.name.toLowerCase().includes('coach unit')
            );
            
            if (!isCoach) {
                await interaction.reply({ content: '❌ Cette commande est réservée aux Coach Unit.', ephemeral: true });
                return;
            }

            const lineup = [];
            for (let i = 1; i <= 4; i++) {
                const player = interaction.options.getUser(`joueur${i}`);
                lineup.push(player);
            }
            
            const lineupData = Database.load('lineup');
            lineupData.current = {
                players: lineup.map(p => p.id),
                coach: interaction.user.id,
                date: new Date().toISOString()
            };
            Database.save('lineup', lineupData);
            
            const lineupEmbed = new EmbedBuilder()
                .setTitle('⚔️ Lineup Match 4v4')
                .setDescription('Composition officielle pour le prochain match :')
                .addFields(
                    lineup.map((player, index) => ({
                        name: `Joueur ${index + 1}`,
                        value: player.displayName,
                        inline: true
                    }))
                )
                .setColor(0x00ff99)
                .setFooter({ text: 'Match compétitif EVA Battle Arena 4v4' })
                .setTimestamp();
            
            await interaction.reply({ embeds: [lineupEmbed] });
            break;
    }
}

// Gestionnaire d'investissement
async function handleInvestmentCommand(interaction) {
    const subcommand = interaction.options.getSubcommand();

    switch (subcommand) {
        case 'voir':
            const targetUser = interaction.options.getUser('joueur') || interaction.user;
            const investment = Database.load('investment')[targetUser.id] || {
                temps_vocal: 0,
                participations_events: 0,
                derniere_activite: null
            };

            const investEmbed = new EmbedBuilder()
                .setTitle(`📊 Investissement de ${targetUser.displayName}`)
                .addFields(
                    { name: '🎤 Temps vocal total', value: `${Math.floor(investment.temps_vocal / 60)}h ${investment.temps_vocal % 60}min`, inline: true },
                    { name: '📅 Participations événements', value: investment.participations_events.toString(), inline: true },
                    { name: '📈 Dernière activité', value: investment.derniere_activite ? new Date(investment.derniere_activite).toLocaleDateString('fr-FR') : 'Jamais', inline: true }
                )
                .setColor(0x00ccff)
                .setThumbnail(targetUser.displayAvatarURL())
                .setTimestamp();

            await interaction.reply({ embeds: [investEmbed] });
            break;

        case 'classement':
            const allInvestment = Database.load('investment');
            const classement = Object.entries(allInvestment)
                .map(([userId, data]) => ({ userId, ...data }))
                .sort((a, b) => (b.temps_vocal + b.participations_events * 60) - (a.temps_vocal + a.participations_events * 60))
                .slice(0, 10);

            const rankingEmbed = new EmbedBuilder()
                .setTitle('🏆 Classement d\'investissement')
                .setDescription('Basé sur le temps vocal et la participation aux événements')
                .setColor(0xffd700);

            classement.forEach((player, index) => {
                const user = client.users.cache.get(player.userId);
                const medal = index < 3 ? ['🥇', '🥈', '🥉'][index] : `${index + 1}.`;
                const score = Math.floor(player.temps_vocal / 60) + player.participations_events;
                rankingEmbed.addFields({
                    name: `${medal} ${user?.displayName || 'Joueur inconnu'}`,
                    value: `Score: ${score} | Vocal: ${Math.floor(player.temps_vocal / 60)}h | Events: ${player.participations_events}`,
                    inline: false
                });
            });

            await interaction.reply({ embeds: [rankingEmbed] });
            break;
    }
}

// Gestionnaire des objectifs
async function handleObjectiveCommand(interaction) {
    const subcommand = interaction.options.getSubcommand();

    switch (subcommand) {
        case 'definir':
            const titre = interaction.options.getString('titre');
            const description = interaction.options.getString('description');
            const echeance = interaction.options.getString('echeance');

            const objectives = Database.load('objectives');
            const objId = Date.now().toString();
            
            objectives[objId] = {
                id: objId,
                titre,
                description,
                echeance,
                auteur: interaction.user.id,
                date_creation: new Date().toISOString(),
                complete: false
            };
            
            Database.save('objectives', objectives);

            const objEmbed = new EmbedBuilder()
                .setTitle('🎯 Nouvel objectif défini')
                .addFields(
                    { name: 'Titre', value: titre, inline: false },
                    { name: 'Description', value: description, inline: false },
                    { name: 'Échéance', value: echeance || 'Non définie', inline: true },
                    { name: 'Défini par', value: `<@${interaction.user.id}>`, inline: true },
                    { name: 'ID Objectif', value: `\`${objId}\``, inline: true }
                )
                .setColor(0x00ffff)
                .setTimestamp();

            await interaction.reply({ embeds: [objEmbed] });
            break;

        case 'liste':
            const allObjectives = Database.load('objectives');
            const objectivesList = Object.values(allObjectives)
                .filter(obj => !obj.complete)
                .sort((a, b) => new Date(a.date_creation) - new Date(b.date_creation));

            if (objectivesList.length === 0) {
                await interaction.reply('🎯 Aucun objectif en cours. Temps de s\'en fixer de nouveaux !');
                return;
            }

            const listObjEmbed = new EmbedBuilder()
                .setTitle('🎯 Objectifs en cours')
                .setColor(0x00ffff);

            objectivesList.forEach(obj => {
                const auteur = client.users.cache.get(obj.auteur);
                listObjEmbed.addFields({
                    name: obj.titre,
                    value: `${obj.description}\n**Échéance:** ${obj.echeance || 'Non définie'}\n**Par:** ${auteur?.displayName || 'Inconnu'}\n**ID:** \`${obj.id}\``,
                    inline: false
                });
            });

            await interaction.reply({ embeds: [listObjEmbed] });
            break;

        case 'completer':
            const objectifId = interaction.options.getString('objectif_id');
            const objectives2 = Database.load('objectives');
            
            if (objectives2[objectifId]) {
                objectives2[objectifId].complete = true;
                objectives2[objectifId].complete_par = interaction.user.id;
                objectives2[objectifId].date_completion = new Date().toISOString();
                Database.save('objectives', objectives2);

                const completeEmbed = new EmbedBuilder()
                    .setTitle('🎉 Objectif accompli !')
                    .setDescription(`**${objectives2[objectifId].titre}** a été marqué comme terminé !`)
                    .addFields(
                        { name: 'Complété par', value: `<@${interaction.user.id}>`, inline: true },
                        { name: 'Date', value: new Date().toLocaleDateString('fr-FR'), inline: true }
                    )
                    .setColor(0x00ff00)
                    .setTimestamp();

                await interaction.reply({ embeds: [completeEmbed] });
            } else {
                await interaction.reply({ content: '❌ Objectif introuvable.', ephemeral: true });
            }
            break;
    }
}

// Gestionnaire des matchs (simplifié
