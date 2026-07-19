require('dotenv').config();
const { Client, GatewayIntentBits, Partials, Collection, REST, Routes, SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');

// ===== CONFIG =====
const CONFIG = {
  AFK_CHANNEL_ID: '1371119823437824111',
  BOT_HOME_CHANNEL_ID: '1401074295022817381',
  AFK_TIMEOUT_MS: 15 * 60 * 1000,
  WARN_ROLES: {
    1: '1482963105943126108',
    2: '1482963310860042300',
    3: '1482963374605340734',
  },
  SCHEDULE_INTERVAL: 30 * 60 * 1000, // كل 30 دقيقة
};

const token = process.env.DISCORD_TOKEN;
const clientId = process.env.CLIENT_ID;
const guildId = process.env.GUILD_ID;

if (!token || !clientId || !guildId) {
  console.error('❌ تأكد من وجود DISCORD_TOKEN و CLIENT_ID و GUILD_ID في ملف .env');
  process.exit(1);
}

// ===== CLIENT SETUP =====
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.GuildMessageReactions,
    GatewayIntentBits.GuildVoiceStates,
    GatewayIntentBits.GuildModeration,
    GatewayIntentBits.GuildPresences,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.DirectMessages,
  ],
  partials: [Partials.Message, Partials.Channel, Partials.Reaction],
});

client.commands = new Collection();
client.afkTimers = new Map();
client.userWarns = new Map();
client.sahsahIntervals = new Map();
client.xpData = new Map();

// ===== SLASH COMMANDS =====
const slashCommands = [
  new SlashCommandBuilder()
    .setName('ping')
    .setDescription('🏓 كشف التأخير')
    .toJSON(),

  new SlashCommandBuilder()
    .setName('stats')
    .setDescription('📊 إحصائيات السيرفر')
    .toJSON(),

  new SlashCommandBuilder()
    .setName('leaderboard')
    .setDescription('🏆 جدول الترتيب')
    .toJSON(),

  new SlashCommandBuilder()
    .setName('adddm')
    .setDescription('📨 إضافة رسالة DM')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .toJSON(),

  new SlashCommandBuilder()
    .setName('mute')
    .setDescription('🔇 ميوت عضو')
    .addUserOption(opt => opt.setName('user').setDescription('العضو').setRequired(true))
    .addIntegerOption(opt => opt.setName('duration').setDescription('المدة بالدقائق').setRequired(false))
    .setDefaultMemberPermissions(PermissionFlagsBits.MuteMembers)
    .toJSON(),

  new SlashCommandBuilder()
    .setName('unmute')
    .setDescription('🔊 فك الميوت')
    .addUserOption(opt => opt.setName('user').setDescription('العضو').setRequired(true))
    .setDefaultMemberPermissions(PermissionFlagsBits.MuteMembers)
    .toJSON(),

  new SlashCommandBuilder()
    .setName('sahsah')
    .setDescription('🎲 صحصح - نقل عشوائي بين الرومات')
    .addUserOption(opt => opt.setName('user').setDescription('العضو').setRequired(true))
    .addIntegerOption(opt => opt.setName('duration').setDescription('المدة بالثواني (حد أقصى 5)').setRequired(true))
    .setDefaultMemberPermissions(PermissionFlagsBits.MoveMembers)
    .toJSON(),

  new SlashCommandBuilder()
    .setName('kick')
    .setDescription('👢 طرد عضو')
    .addUserOption(opt => opt.setName('user').setDescription('العضو').setRequired(true))
    .addStringOption(opt => opt.setName('reason').setDescription('السبب').setRequired(false))
    .setDefaultMemberPermissions(PermissionFlagsBits.KickMembers)
    .toJSON(),

  new SlashCommandBuilder()
    .setName('ban')
    .setDescription('🚫 حظر عضو')
    .addUserOption(opt => opt.setName('user').setDescription('العضو').setRequired(true))
    .addStringOption(opt => opt.setName('reason').setDescription('السبب').setRequired(false))
    .setDefaultMemberPermissions(PermissionFlagsBits.BanMembers)
    .toJSON(),
];

// ===== REGISTER COMMANDS =====
async function registerCommands() {
  try {
    console.log('🔄 جاري تسجيل الأوامر...');
    const rest = new REST({ version: '10' }).setToken(token);
    await rest.put(Routes.applicationGuildCommands(clientId, guildId), {
      body: slashCommands,
    });
    console.log('✅ تم تسجيل الأوامر بنجاح!');
  } catch (error) {
    console.error('❌ خطأ في تسجيل الأوامر:', error.message);
  }
}

// ===== XP SYSTEM =====
function addXP(userId, amount = 10) {
  const current = client.xpData.get(userId) || 0;
  client.xpData.set(userId, current + amount);
}

function getLevel(xp) {
  return Math.floor(xp / 100);
}

// ===== WARN SYSTEM =====
async function addWarn(userId, guildId) {
  const key = `${guildId}-${userId}`;
  const warns = (client.userWarns.get(key) || 0) + 1;
  client.userWarns.set(key, warns);

  const guild = client.guilds.cache.get(guildId);
  const member = await guild.members.fetch(userId).catch(() => null);
  if (!member) return warns;

  if (warns <= 3) {
    const role = guild.roles.cache.get(CONFIG.WARN_ROLES[warns]);
    if (role) {
      await member.roles.add(role).catch(() => {});
    }
  }

  if (warns === 3) {
    await member.roles.remove(Object.values(CONFIG.WARN_ROLES)).catch(() => {});
  }

  return warns;
}

// ===== SLASH COMMAND HANDLERS =====
client.on('interactionCreate', async interaction => {
  if (!interaction.isCommand()) return;

  const { commandName } = interaction;

  try {
    if (commandName === 'ping') {
      await interaction.reply(`🏓 Pong! ${client.ws.ping}ms`);
    }

    else if (commandName === 'stats') {
      const guild = interaction.guild;
      const members = await guild.members.fetch();
      const botCount = members.filter(m => m.user.bot).size;
      const voiceCount = guild.voiceStates.cache.size;

      const embed = new EmbedBuilder()
        .setColor(0x0099ff)
        .setTitle('📊 إحصائيات السيرفر')
        .setThumbnail(guild.iconURL())
        .addFields(
          { name: '👥 عدد الأعضاء', value: `${guild.memberCount}`, inline: true },
          { name: '🎮 داخل الصوت', value: `${voiceCount}`, inline: true },
          { name: '🤖 عدد البوتات', value: `${botCount}`, inline: true },
          { name: '🏓 Ping', value: `${client.ws.ping}ms`, inline: true },
          { name: '💻 الحالة', value: 'Online ✅', inline: true },
          { name: '📅 تاريخ الإنشاء', value: `<t:${Math.floor(guild.createdTimestamp / 1000)}:d>`, inline: true },
        )
        .setFooter({ text: `السيرفر ID: ${guild.id}` });

      await interaction.reply({ embeds: [embed] });
    }

    else if (commandName === 'leaderboard') {
      const sorted = Array.from(client.xpData.entries())
        .sort((a, b) => b[1] - a[1])
        .slice(0, 10);

      let leaderboard = '🏆 **جدول الترتيب**\n\n';
      sorted.forEach((entry, index) => {
        const [userId, xp] = entry;
        const level = getLevel(xp);
        leaderboard += `${index + 1}. <@${userId}> - Level **${level}** (${xp} XP)\n`;
      });

      const embed = new EmbedBuilder()
        .setColor(0xFFD700)
        .setDescription(leaderboard)
        .setTitle('🏆 جدول الترتيب');

      await interaction.reply({ embeds: [embed] });
    }

    else if (commandName === 'adddm') {
      const embed = new EmbedBuilder()
        .setColor(0x00AA00)
        .setTitle('📨 نظام الرسائل الخاصة')
        .setDescription('اختر الطريقة المناسبة لإرسال الرسالة الخاصة:')
        .addFields(
          { name: '👤 فرد واحد', value: 'أرسل رسالة لشخص معين', inline: true },
          { name: '👥 رتبة معينة', value: 'أرسل رسالة لجميع من يملكون الرتبة', inline: true },
        );

      const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId('dm_individual').setLabel('👤 فرد').setStyle(ButtonStyle.Primary),
        new ButtonBuilder().setCustomId('dm_role').setLabel('👥 رتبة').setStyle(ButtonStyle.Success),
      );

      await interaction.reply({ embeds: [embed], components: [row] });
    }

    else if (commandName === 'mute') {
      const user = interaction.options.getUser('user');
      const duration = interaction.options.getInteger('duration') || 5;
      const member = await interaction.guild.members.fetch(user.id);

      try {
        await member.voice.setMute(true, `Muted by ${interaction.user.tag}`);
        await interaction.reply(`🔇 تم ميوت ${user.username} لمدة ${duration} دقائق`);

        setTimeout(async () => {
          try {
            await member.voice.setMute(false);
          } catch (e) {}
        }, duration * 60 * 1000);
      } catch (e) {
        await interaction.reply(`❌ خطأ: ${e.message}`);
      }
    }

    else if (commandName === 'unmute') {
      const user = interaction.options.getUser('user');
      const member = await interaction.guild.members.fetch(user.id);

      try {
        await member.voice.setMute(false);
        await interaction.reply(`🔊 تم فك الميوت عن ${user.username}`);
      } catch (e) {
        await interaction.reply(`❌ خطأ: ${e.message}`);
      }
    }

    else if (commandName === 'sahsah') {
      const user = interaction.options.getUser('user');
      const duration = Math.min(interaction.options.getInteger('duration'), 5);
      const member = await interaction.guild.members.fetch(user.id);

      if (!member.voice.channel) {
        await interaction.reply('❌ العضو ليس في قناة صوتية');
        return;
      }

      await interaction.reply(`🎲 صحصح لـ ${user.username}! ينقل لمدة ${duration} ثواني...`);

      const channels = interaction.guild.channels.cache.filter(c => c.isVoiceBased());
      const startTime = Date.now();

      const interval = setInterval(async () => {
        if (Date.now() - startTime > duration * 1000) {
          clearInterval(interval);
          client.sahsahIntervals.delete(member.id);
          return;
        }

        const randomChannel = channels.random();
        try {
          await member.voice.setChannel(randomChannel);
        } catch (e) {}
      }, 500);

      client.sahsahIntervals.set(member.id, interval);
    }

    else if (commandName === 'kick') {
      const user = interaction.options.getUser('user');
      const reason = interaction.options.getString('reason') || 'بدون سبب';
      const member = await interaction.guild.members.fetch(user.id);

      try {
        await member.kick(reason);
        await interaction.reply(`👢 تم طرد ${user.username}\nالسبب: ${reason}`);
      } catch (e) {
        await interaction.reply(`❌ خطأ: ${e.message}`);
      }
    }

    else if (commandName === 'ban') {
      const user = interaction.options.getUser('user');
      const reason = interaction.options.getString('reason') || 'بدون سبب';

      try {
        await interaction.guild.members.ban(user, { reason });
        await interaction.reply(`🚫 تم حظر ${user.username}\nالسبب: ${reason}`);
      } catch (e) {
        await interaction.reply(`❌ خطأ: ${e.message}`);
      }
    }
  } catch (error) {
    console.error('❌ خطأ:', error);
    await interaction.reply('❌ حدث خطأ').catch(() => {});
  }
});

// ===== BUTTON HANDLERS =====
client.on('interactionCreate', async interaction => {
  if (!interaction.isButton()) return;

  const { customId, user, guild, channel } = interaction;

  if (customId === 'dm_individual') {
    const dmEmbed = new EmbedBuilder()
      .setColor(0x0099ff)
      .setTitle('📨 أرسل رسالة لفرد')
      .setDescription('اكتب معرّف الشخص أو منشنه');

    await interaction.reply({ embeds: [dmEmbed], ephemeral: true });
  }

  else if (customId === 'dm_role') {
    const roleEmbed = new EmbedBuilder()
      .setColor(0x0099ff)
      .setTitle('📨 أرسل رسالة لرتبة')
      .setDescription('اكتب اسم الرتبة');

    await interaction.reply({ embeds: [roleEmbed], ephemeral: true });
  }
});

// ===== MESSAGE EVENTS =====
client.on('messageCreate', async message => {
  if (message.author.bot) return;

  // XP System
  addXP(message.author.id);

  // Check for role/channel modifications
  if (message.guild) {
    const before = await message.guild.roles.fetch().catch(() => null);
  }
});

client.on('messageReactionAdd', async (reaction, user) => {
  if (user.bot) return;
  addXP(user.id, 5);
});

// ===== FORUM POST THANKS =====
client.on('threadCreate', async thread => {
  if (thread.parent?.isForumChannel?.()) {
    try {
      const embed = new EmbedBuilder()
        .setColor(0x00AA00)
        .setTitle('✨ شكراً على البوست!')
        .setDescription(`شكراً <@${thread.ownerId}> على مساهمتك في المجتمع!`)
        .setTimestamp();

      await thread.send({ embeds: [embed] });
    } catch (e) {
      console.error('خطأ في شكر البوست:', e.message);
    }
  }
});

// ===== PROTECTION SYSTEM =====
client.on('roleUpdate', async (oldRole, newRole) => {
  console.log(`[PROTECTION] محاولة تعديل الرتبة: ${oldRole.name}`);
});

client.on('channelUpdate', async (oldChannel, newChannel) => {
  console.log(`[PROTECTION] محاولة تعديل القناة: ${oldChannel.name}`);
});

// ===== ABUSE DETECTION =====
client.on('guildMemberUpdate', async (oldMember, newMember) => {
  const userId = newMember.id;
  const guildId = newMember.guild.id;

  // تتبع التغييرات المشبوهة
  const changeKey = `${guildId}-changes-${userId}`;
  const changes = (client.userWarns.get(changeKey) || 0) + 1;
  client.userWarns.set(changeKey, changes);

  if (changes >= 3) {
    const warns = await addWarn(userId, guildId);
    const user = await client.users.fetch(userId).catch(() => null);

    if (user) {
      const embed = new EmbedBuilder()
        .setColor(0xFF0000)
        .setTitle('⚠️ تحذير')
        .setDescription(`تم اكتشاف استخدام مشبوه للصلاحيات!\nعدد التحذيرات: ${warns}/3`)
        .addFields(
          { name: 'السبب', value: 'محاولات متعددة لتعديل الأدوار/القنوات', inline: false },
          { name: 'تنبيه', value: warns === 3 ? '⛔ تم سحب جميع الصلاحيات!' : 'استمر وستفقد الصلاحيات', inline: false },
        );

      try {
        await user.send({ embeds: [embed] });
      } catch (e) {}
    }
  }
});

// ===== SCHEDULED MESSAGES =====
function startScheduledMessages() {
  setInterval(async () => {
    try {
      const guild = client.guilds.cache.first();
      if (!guild) return;

      const members = await guild.members.fetch();
      const randomMember = members.random();

      if (randomMember?.user?.id === client.user.id) return;

      const embed = new EmbedBuilder()
        .setColor(0x00AA00)
        .setTitle('💬 رسالة عشوائية')
        .setDescription(`مرحباً <@${randomMember.id}>!\n\nهذه رسالة عشوائية من البوت. كيف حالك؟`)
        .setTimestamp();

      try {
        await randomMember.send({ embeds: [embed] });
        console.log(`[SCHEDULER] أرسلت رسالة عشوائية لـ ${randomMember.user.tag}`);
      } catch (e) {}
    } catch (e) {
      console.error('[SCHEDULER] خطأ:', e.message);
    }
  }, CONFIG.SCHEDULE_INTERVAL);
}

// ===== AFK SYSTEM =====
function startAfkTimer(member, client) {
  if (client.afkTimers.has(member.id)) {
    clearTimeout(client.afkTimers.get(member.id));
  }

  const timer = setTimeout(async () => {
    try {
      const guild = client.guilds.cache.get(member.guild.id);
      if (!guild) return;

      const freshMember = await guild.members.fetch(member.id).catch(() => null);
      if (!freshMember) return;

      const vs = freshMember.voice;
      if (!vs?.channelId || vs.channelId === CONFIG.AFK_CHANNEL_ID) return;

      if (vs.selfMute || vs.selfDeaf) {
        await freshMember.voice.setChannel(CONFIG.AFK_CHANNEL_ID, 'AFK');
        console.log(`[AFK] نقل ${freshMember.user.tag}`);
      }
    } catch (err) {
      console.error('[AFK]:', err.message);
    } finally {
      client.afkTimers.delete(member.id);
    }
  }, CONFIG.AFK_TIMEOUT_MS);

  client.afkTimers.set(member.id, timer);
}

function clearAfkTimer(userId, client) {
  if (client.afkTimers.has(userId)) {
    clearTimeout(client.afkTimers.get(userId));
    client.afkTimers.delete(userId);
  }
}

// ===== VOICE STATE UPDATE =====
client.on('voiceStateUpdate', async (oldState, newState) => {
  const member = newState.member ?? oldState.member;
  if (!member || member.user.bot) return;

  // AFK
  const userId = member.id;
  if (!newState.channelId) {
    clearAfkTimer(userId, client);
    return;
  }

  if (newState.channelId === CONFIG.AFK_CHANNEL_ID) {
    clearAfkTimer(userId, client);
    return;
  }

  const isMutedOrDeafened = newState.selfMute || newState.selfDeaf;
  const wasInAfkRoom = oldState.channelId === CONFIG.AFK_CHANNEL_ID;

  if (isMutedOrDeafened && !wasInAfkRoom) {
    startAfkTimer(member, client);
  } else {
    clearAfkTimer(userId, client);
  }

  // ===== BOT VOICE GUARD - البوت يبقى في الروم =====
  if (oldState.member?.id === client.user.id && oldState.channelId === CONFIG.BOT_HOME_CHANNEL_ID) {
    setTimeout(async () => {
      try {
        const guild = oldState.guild;
        const botMember = guild.members.me;
        
        if (!botMember) return;

        // إذا البوت انسحب من روم الجلوس، يرجع فوراً
        if (botMember.voice.channelId !== CONFIG.BOT_HOME_CHANNEL_ID) {
          const channel = guild.channels.cache.get(CONFIG.BOT_HOME_CHANNEL_ID);
          if (channel && channel.isVoiceBased()) {
            try {
              await botMember.voice.setChannel(channel);
              console.log('🔙 [BOT GUARD] البوت رجع لروم الجلوس');
            } catch (e) {
              console.error('[BOT GUARD] خطأ في إرجاع البوت:', e.message);
            }
          }
        }
      } catch (e) {
        console.error('[BOT GUARD] خطأ:', e.message);
      }
    }, 500);
  }

  // ===== PERSON KICKED FROM AFK - إذا شخص حط ديف بدون صوت ينقله =====
  if (newState.channelId === CONFIG.AFK_CHANNEL_ID && !oldState.channelId) {
    // دخل روم AFK للتو
    if (newState.selfDeaf && !newState.channel?.members.some(m => !m.voice.selfDeaf && !m.user.bot)) {
      // كل الناس في الروم مدفونين، نقله بدون الاستنتاظ
      console.log(`[AFK] ${member.user.tag} دخل روم AFK بدون صوت`);
    }
  }
});

// ===== READY EVENT =====
client.on('ready', async () => {
  console.log(`✅ ${client.user.tag} شغال!`);
  client.user.setActivity('الكومينتي', { type: 'WATCHING' });
  
  // البوت يدخل روم الجلوس الدائم
  try {
    const guild = client.guilds.cache.first();
    if (guild) {
      const channel = guild.channels.cache.get(CONFIG.BOT_HOME_CHANNEL_ID);
      if (channel && channel.isVoiceBased()) {
        const botMember = guild.members.me;
        if (botMember && botMember.voice.channelId !== CONFIG.BOT_HOME_CHANNEL_ID) {
          await botMember.voice.setChannel(channel).catch(() => {});
          console.log('✅ [BOT GUARD] البوت دخل روم الجلوس الدائم');
        }
      }
    }
  } catch (e) {
    console.error('[BOT GUARD] خطأ:', e.message);
  }

  await registerCommands();
  startScheduledMessages();
});

// ===== LOGIN =====
client.login(token).catch(err => {
  console.error('❌ فشل:', err.message);
  process.exit(1);
});

// ===== PROTECTION FROM REMOVAL =====
client.on('voiceChannelLeave', async (member, channel) => {
  if (member.user.id === client.user.id) {
    console.log('[BOT GUARD] محاولة طرد البوت من الروم!');
    setTimeout(async () => {
      try {
        await member.voice.setChannel(CONFIG.BOT_HOME_CHANNEL_ID);
      } catch (e) {
        console.error('[BOT GUARD] خطأ:', e.message);
      }
    }, 1000);
  }
});
