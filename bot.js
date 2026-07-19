require('dotenv').config();
const { Client, GatewayIntentBits, Partials, Collection, REST, Routes, SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, ModalBuilder, TextInputBuilder, TextInputStyle, ChannelType } = require('discord.js');
const fs = require('fs');

// ===== CONFIG =====
const CONFIG = {
  BOT_HOME_CHANNEL_ID: '1401074295022817381',
  AFK_CHANNEL_ID: '1371119823437824111',
  WARN_ROLE_ID: '1525750932615331881', // رتبة التحذير النهائية
  WARN_ROLES: {
    1: '1482963105943126108', // warn 1
    2: '1482963310860042300', // warn 2
    3: '1482963374605340734', // warn 3
  },
  AUDIO_FILES: {
    1: 'audio1.mp3',
    2: 'audio2.mp3',
    3: 'audio3.mp3',
  },
};

const token = process.env.DISCORD_TOKEN;
const clientId = process.env.CLIENT_ID;
const guildId = process.env.GUILD_ID;

if (!token || !clientId || !guildId) {
  console.error('❌ تأكد من وجود متغيرات البيئة');
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
client.userWarns = new Map();
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
    .setName('playaudio')
    .setDescription('🎵 تشغيل صوتية')
    .addChannelOption(opt => 
      opt.setName('channel')
        .setDescription('قناة الصوت')
        .addChannelTypes(ChannelType.GuildVoice)
        .setRequired(true)
    )
    .addIntegerOption(opt =>
      opt.setName('audio')
        .setDescription('رقم الصوتية (1-3)')
        .setRequired(true)
        .addChoices(
          { name: 'صوتية 1', value: 1 },
          { name: 'صوتية 2', value: 2 },
          { name: 'صوتية 3', value: 3 }
        )
    )
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
    .setName('kick')
    .setDescription('👢 طرد عضو')
    .addUserOption(opt => opt.setName('user').setDescription('العضو').setRequired(true))
    .setDefaultMemberPermissions(PermissionFlagsBits.KickMembers)
    .toJSON(),

  new SlashCommandBuilder()
    .setName('ban')
    .setDescription('🚫 حظر عضو')
    .addUserOption(opt => opt.setName('user').setDescription('العضو').setRequired(true))
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

// ===== WARN SYSTEM =====
async function addWarn(memberId, guildId, guild) {
  const key = `${guildId}-${memberId}`;
  let warns = client.userWarns.get(key) || 0;
  warns++;
  client.userWarns.set(key, warns);

  console.log(`[WARN] ${memberId} - تحذير ${warns}`);

  const member = await guild.members.fetch(memberId).catch(() => null);
  if (!member) return warns;

  // إضافة رتب التحذير
  if (warns <= 3 && CONFIG.WARN_ROLES[warns]) {
    const role = guild.roles.cache.get(CONFIG.WARN_ROLES[warns]);
    if (role) {
      await member.roles.add(role).catch(() => {});
    }
  }

  // بعد الـ warn 3 - سحب جميع الصلاحيات
  if (warns >= 3) {
    const warnRole = guild.roles.cache.get(CONFIG.WARN_ROLE_ID);
    if (warnRole) {
      await member.roles.add(warnRole).catch(() => {});
      // سحب الرتب
      await member.roles.remove(Object.values(CONFIG.WARN_ROLES)).catch(() => {});
    }
  }

  return warns;
}

// ===== SLASH COMMAND HANDLERS =====
client.on('interactionCreate', async interaction => {
  if (!interaction.isCommand()) return;

  const { commandName, guild } = interaction;

  try {
    if (commandName === 'ping') {
      await interaction.reply(`🏓 Pong! ${client.ws.ping}ms`);
    }

    else if (commandName === 'stats') {
      const members = await guild.members.fetch();
      const botCount = members.filter(m => m.user.bot).size;
      const voiceCount = guild.voiceStates.cache.size;

      const embed = new EmbedBuilder()
        .setColor(0x0099ff)
        .setTitle('📊 إحصائيات السيرفر')
        .addFields(
          { name: '👥 عدد الأعضاء', value: `${guild.memberCount}`, inline: true },
          { name: '🎮 داخل الصوت', value: `${voiceCount}`, inline: true },
          { name: '🤖 عدد البوتات', value: `${botCount}`, inline: true },
          { name: '🏓 Ping', value: `${client.ws.ping}ms`, inline: true },
          { name: '💻 الحالة', value: 'Online ✅', inline: true },
        );

      await interaction.reply({ embeds: [embed] });
    }

    else if (commandName === 'leaderboard') {
      const sorted = Array.from(client.xpData.entries())
        .sort((a, b) => b[1] - a[1])
        .slice(0, 10);

      let leaderboard = '🏆 **جدول الترتيب**\n\n';
      sorted.forEach((entry, index) => {
        const [userId, xp] = entry;
        const level = Math.floor(xp / 100);
        leaderboard += `${index + 1}. <@${userId}> - Level **${level}** (${xp} XP)\n`;
      });

      const embed = new EmbedBuilder()
        .setColor(0xFFD700)
        .setDescription(leaderboard || 'لا توجد بيانات');

      await interaction.reply({ embeds: [embed] });
    }

    else if (commandName === 'adddm') {
      const embed = new EmbedBuilder()
        .setColor(0x00AA00)
        .setTitle('📨 نظام الرسائل الخاصة')
        .setDescription('اختر الطريقة:');

      const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId('dm_individual').setLabel('👤 فرد').setStyle(ButtonStyle.Primary),
        new ButtonBuilder().setCustomId('dm_role').setLabel('👥 رتبة').setStyle(ButtonStyle.Success),
      );

      await interaction.reply({ embeds: [embed], components: [row] });
    }

    else if (commandName === 'playaudio') {
      const channel = interaction.options.getChannel('channel');
      const audioNum = interaction.options.getInteger('audio');

      if (!channel.isVoiceBased()) {
        await interaction.reply('❌ هذا ليس روم صوتي');
        return;
      }

      const botMember = guild.members.me;
      if (!botMember?.voice?.channel) {
        // البوت ليس في روم، ادخله أولاً
        try {
          await botMember.voice.setChannel(channel);
        } catch (e) {
          await interaction.reply('❌ لم أستطع الدخول للروم');
          return;
        }
      }

      await interaction.reply(`🎵 جاري تشغيل الصوتية ${audioNum}...`);

      // بعد 10 ثواني (مثال) - اطلع من الروم
      setTimeout(async () => {
        try {
          await botMember.voice.disconnect();
          console.log('✅ [AUDIO] خرج من الروم بعد انتهاء الصوتية');
        } catch (e) {}
      }, 10000); // غيّر الوقت حسب طول الصوتية
    }

    else if (commandName === 'mute') {
      const user = interaction.options.getUser('user');
      const duration = interaction.options.getInteger('duration') || 5;
      const member = await guild.members.fetch(user.id);

      try {
        await member.voice.setMute(true);
        await interaction.reply(`🔇 تم ميوت ${user.username}`);

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
      const member = await guild.members.fetch(user.id);

      try {
        await member.voice.setMute(false);
        await interaction.reply(`🔊 تم فك الميوت عن ${user.username}`);
      } catch (e) {
        await interaction.reply(`❌ خطأ: ${e.message}`);
      }
    }

    else if (commandName === 'kick') {
      const user = interaction.options.getUser('user');
      const member = await guild.members.fetch(user.id);

      try {
        await member.kick();
        await interaction.reply(`👢 تم طرد ${user.username}`);

        // تسجيل تحذير
        await addWarn(user.id, guild.id, guild);
      } catch (e) {
        await interaction.reply(`❌ خطأ: ${e.message}`);
      }
    }

    else if (commandName === 'ban') {
      const user = interaction.options.getUser('user');

      try {
        await guild.members.ban(user);
        await interaction.reply(`🚫 تم حظر ${user.username}`);
      } catch (e) {
        await interaction.reply(`❌ خطأ: ${e.message}`);
      }
    }
  } catch (error) {
    console.error('❌ خطأ:', error);
    await interaction.reply('❌ حدث خطأ ما').catch(() => {});
  }
});

// ===== BUTTON HANDLERS =====
client.on('interactionCreate', async interaction => {
  if (!interaction.isButton()) return;

  const { customId, guild } = interaction;

  if (customId === 'dm_individual') {
    const modal = new ModalBuilder()
      .setCustomId('dm_individual_modal')
      .setTitle('أرسل رسالة لفرد');

    const userInput = new TextInputBuilder()
      .setCustomId('target_user')
      .setLabel('معرف الشخص أو رقمه')
      .setStyle(TextInputStyle.Short)
      .setPlaceholder('@username أو ID');

    const messageInput = new TextInputBuilder()
      .setCustomId('dm_message')
      .setLabel('الرسالة')
      .setStyle(TextInputStyle.Paragraph);

    modal.addComponents(
      new ActionRowBuilder().addComponents(userInput),
      new ActionRowBuilder().addComponents(messageInput)
    );

    await interaction.showModal(modal);
  }

  else if (customId === 'dm_role') {
    const modal = new ModalBuilder()
      .setCustomId('dm_role_modal')
      .setTitle('أرسل رسالة لرتبة');

    const roleInput = new TextInputBuilder()
      .setCustomId('target_role')
      .setLabel('اسم الرتبة أو رقمها')
      .setStyle(TextInputStyle.Short);

    const messageInput = new TextInputBuilder()
      .setCustomId('dm_message_role')
      .setLabel('الرسالة')
      .setStyle(TextInputStyle.Paragraph);

    modal.addComponents(
      new ActionRowBuilder().addComponents(roleInput),
      new ActionRowBuilder().addComponents(messageInput)
    );

    await interaction.showModal(modal);
  }
});

// ===== MODAL SUBMISSION =====
client.on('interactionCreate', async interaction => {
  if (!interaction.isModalSubmit()) return;

  const { customId, user, guild, fields } = interaction;

  try {
    if (customId === 'dm_individual_modal') {
      const targetIdentifier = fields.getTextInputValue('target_user');
      const message = fields.getTextInputValue('dm_message');

      let targetUser;

      if (targetIdentifier.startsWith('<@') && targetIdentifier.endsWith('>')) {
        const userId = targetIdentifier.slice(2, -1).replace('!', '');
        targetUser = await client.users.fetch(userId).catch(() => null);
      } else if (/^\d+$/.test(targetIdentifier)) {
        targetUser = await client.users.fetch(targetIdentifier).catch(() => null);
      } else {
        const members = await guild.members.search({ query: targetIdentifier, limit: 1 });
        if (members.size > 0) {
          targetUser = members.first().user;
        }
      }

      if (!targetUser) {
        await interaction.reply({ content: '❌ لم أجد الشخص', ephemeral: true });
        return;
      }

      const dmEmbed = new EmbedBuilder()
        .setColor(0x0099ff)
        .setAuthor({ name: `رسالة من ${user.username}`, iconURL: user.displayAvatarURL() })
        .setDescription(message)
        .setFooter({ text: `من السيرفر: ${guild.name}` })
        .setTimestamp();

      try {
        await targetUser.send({ embeds: [dmEmbed] });
        await interaction.reply({ content: `✅ تم إرسال الرسالة لـ ${targetUser.username}`, ephemeral: true });
      } catch (e) {
        await interaction.reply({ content: `❌ لم أستطع الإرسال`, ephemeral: true });
      }
    }

    else if (customId === 'dm_role_modal') {
      const roleIdentifier = fields.getTextInputValue('target_role');
      const message = fields.getTextInputValue('dm_message_role');

      let targetRole;

      if (/^\d+$/.test(roleIdentifier)) {
        targetRole = guild.roles.cache.get(roleIdentifier);
      } else {
        targetRole = guild.roles.cache.find(r => r.name.toLowerCase() === roleIdentifier.toLowerCase());
      }

      if (!targetRole) {
        await interaction.reply({ content: '❌ لم أجد الرتبة', ephemeral: true });
        return;
      }

      const members = targetRole.members;
      let successCount = 0;

      const dmEmbed = new EmbedBuilder()
        .setColor(0x00AA00)
        .setAuthor({ name: `رسالة من ${user.username}` })
        .setDescription(message)
        .addFields({ name: '👥 الفئة', value: `أصحاب: ${targetRole.name}` })
        .setTimestamp();

      for (const [memberId, member] of members) {
        try {
          await member.user.send({ embeds: [dmEmbed] });
          successCount++;
        } catch (e) {}
      }

      await interaction.reply({ content: `✅ تم إرسال الرسائل: **${successCount}**`, ephemeral: true });
    }
  } catch (error) {
    console.error('❌ خطأ:', error);
    await interaction.reply({ content: '❌ خطأ', ephemeral: true }).catch(() => {});
  }
});

// ===== MESSAGE EVENTS - ABUSE DETECTION =====
client.on('messageCreate', async message => {
  if (message.author.bot) return;

  // XP
  const current = client.xpData.get(message.author.id) || 0;
  client.xpData.set(message.author.id, current + 10);
});

// ===== MEMBER UPDATE - DETECT ABUSE =====
client.on('guildMemberUpdate', async (oldMember, newMember) => {
  const guild = newMember.guild;

  // إذا شاف تعديل على الرتب أو الرومات
  if (oldMember.roles.cache.size !== newMember.roles.cache.size) {
    console.log(`[SUSPICIOUS] ${newMember.user.tag} تعديل على الرتب`);

    const warns = await addWarn(newMember.id, guild.id, guild);
    const dmEmbed = new EmbedBuilder()
      .setColor(warns >= 3 ? 0xFF0000 : 0xFFAA00)
      .setTitle('⚠️ تحذير - استخدام خاطئ للصلاحيات')
      .setDescription(`تم اكتشاف محاولة تعديل على الأدوار/القنوات\n\nعدد التحذيرات: **${warns}/3**`)
      .addFields(
        { name: '⚠️ تنبيه', value: warns >= 3 ? '🚫 تم سحب جميع الصلاحيات!' : 'استمر = خسارة الصلاحيات' }
      );

    try {
      await newMember.user.send({ embeds: [dmEmbed] });
    } catch (e) {}
  }
});

// ===== VOICE STATE UPDATE - BOT PROTECTION & ABUSE =====
client.on('voiceStateUpdate', async (oldState, newState) => {
  const member = newState.member ?? oldState.member;
  const guild = newState.guild;

  // ===== BOT PROTECTION =====
  if (oldState.member?.id === client.user.id && oldState.channelId === CONFIG.BOT_HOME_CHANNEL_ID) {
    setTimeout(async () => {
      try {
        const botMember = guild.members.me;
        if (botMember?.voice?.channelId !== CONFIG.BOT_HOME_CHANNEL_ID) {
          const channel = guild.channels.cache.get(CONFIG.BOT_HOME_CHANNEL_ID);
          if (channel?.isVoiceBased()) {
            await botMember.voice.setChannel(channel);
            console.log('🔙 [BOT GUARD] البوت رجع');
          }
        }
      } catch (e) {
        console.error('[BOT GUARD] خطأ:', e.message);
      }
    }, 500);
  }

  // ===== DETECT ABUSE - كثير طرد/ميوت/نقل =====
  if (!member || member.user.bot) return;

  if (oldState.channelId && !newState.channelId) {
    // طرد من روم
    const key = `abuse-${member.id}-kicked`;
    const count = (client.userWarns.get(key) || 0) + 1;
    client.userWarns.set(key, count);

    if (count >= 3) {
      const warns = await addWarn(member.id, guild.id, guild);
      const dmEmbed = new EmbedBuilder()
        .setColor(0xFF0000)
        .setTitle('⚠️ تحذير - إساءة استخدام الصلاحيات')
        .setDescription(`اكتشفنا تصرفات مريبة (طرد متكرر)\n\nعدد التحذيرات: **${warns}/3**`)
        .addFields(
          { name: 'تنبيه', value: warns >= 3 ? '🚫 تم سحب الصلاحيات!' : 'كن حذراً!' }
        );

      try {
        await member.user.send({ embeds: [dmEmbed] });
      } catch (e) {}

      // إعادة تعيين العداد
      client.userWarns.set(key, 0);
    }
  }
});

// ===== FORUM POST THANKS =====
client.on('threadCreate', async thread => {
  if (thread.parent?.isForumChannel?.()) {
    try {
      const embed = new EmbedBuilder()
        .setColor(0x00AA00)
        .setTitle('✨ شكراً على البوست!')
        .setDescription(`شكراً <@${thread.ownerId}> على مساهمتك!`)
        .setTimestamp();

      await thread.send({ embeds: [embed] });
    } catch (e) {}
  }
});

// ===== READY EVENT =====
client.on('ready', async () => {
  console.log(`✅ ${client.user.tag} شغال!`);
  client.user.setActivity('الكومينتي', { type: 'WATCHING' });

  // دخول الروم
  async function joinBotChannel() {
    try {
      const guild = client.guilds.cache.first();
      if (!guild) return;

      const channel = guild.channels.cache.get(CONFIG.BOT_HOME_CHANNEL_ID);
      if (!channel?.isVoiceBased()) return;

      const botMember = guild.members.me;
      if (!botMember) return;

      const perms = channel.permissionsFor(botMember);
      if (!perms.has('Connect') || !perms.has('Speak')) {
        console.error('[BOT] ما عندي صلاحيات');
        return;
      }

      if (botMember.voice.channelId !== CONFIG.BOT_HOME_CHANNEL_ID) {
        await botMember.voice.setChannel(channel);
        console.log('✅ [BOT] دخل الروم');
      }
    } catch (e) {
      console.error('[BOT] خطأ:', e.message);
    }
  }

  await joinBotChannel();
  setTimeout(() => joinBotChannel(), 3000);

  await registerCommands();
});

// ===== LOGIN =====
client.login(token).catch(err => {
  console.error('❌ فشل:', err.message);
  process.exit(1);
});
