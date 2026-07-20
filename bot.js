require('dotenv').config();
const { Client, GatewayIntentBits, Partials, Collection, REST, Routes, SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, ModalBuilder, TextInputBuilder, TextInputStyle, ChannelType } = require('discord.js');
const { joinVoiceChannel, createAudioPlayer, createAudioResource, AudioPlayerStatus, VoiceConnectionStatus } = require('@discordjs/voice');
const fs = require('fs');
const path = require('path');

// ===== CONFIG =====
const CONFIG = {
  BOT_HOME_CHANNEL_ID: '1401074295022817381',
  AFK_CHANNEL_ID: '1371119823437824111',
  OWNER_ID: '1058107732584050879',
  TIMEOUT_DURATION: 10 * 60 * 1000, // 10 دقايق
  AFK_TIMEOUT_MS: 10 * 60 * 1000, // 10 دقايق
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
client.userTimeouts = new Map();
client.afkTimers = new Map();
client.xpData = new Map();
client.autoReplies = new Map();

// ===== SLASH COMMANDS =====
const slashCommands = [
  new SlashCommandBuilder()
    .setName('ping')
    .setDescription('🏓 كشف التأخير')
    .toJSON(),

  new SlashCommandBuilder()
    .setName('sendmessage')
    .setDescription('📨 إرسال رسالة خاصة')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .toJSON(),

  new SlashCommandBuilder()
    .setName('sahsah')
    .setDescription('🎲 نقل عشوائي بين الرومات')
    .addUserOption(opt => opt.setName('user').setDescription('العضو').setRequired(true))
    .addIntegerOption(opt => opt.setName('seconds').setDescription('عدد الثواني (حد أقصى 5)').setRequired(true))
    .setDefaultMemberPermissions(PermissionFlagsBits.MoveMembers)
    .toJSON(),

  new SlashCommandBuilder()
    .setName('playaudio')
    .setDescription('🎵 تشغيل صوتية')
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
    .setName('autoreply')
    .setDescription('🤖 ضع رد تلقائي')
    .addStringOption(opt => opt.setName('trigger').setDescription('الكلمة المفعلة').setRequired(true))
    .addStringOption(opt => opt.setName('response').setDescription('الرد').setRequired(true))
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .toJSON(),

  new SlashCommandBuilder()
    .setName('userinfo')
    .setDescription('👤 معلومات المستخدم')
    .addUserOption(opt => opt.setName('user').setDescription('العضو').setRequired(true))
    .toJSON(),

  new SlashCommandBuilder()
    .setName('forceservertag')
    .setDescription('🏷️ فرض تاق السيرفر على الأعضاء')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
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

// ===== SLASH COMMAND HANDLERS =====
client.on('interactionCreate', async interaction => {
  if (!interaction.isCommand()) return;

  const { commandName, guild, user } = interaction;

  try {
    if (commandName === 'ping') {
      await interaction.reply(`🏓 Pong! ${client.ws.ping}ms`);
    }

    else if (commandName === 'sendmessage') {
      const modal = new ModalBuilder()
        .setCustomId('send_message_modal')
        .setTitle('إرسال رسالة خاصة');

      const typeInput = new TextInputBuilder()
        .setCustomId('message_type')
        .setLabel('نوع الرسالة (فرد أو رتبة)')
        .setStyle(TextInputStyle.Short)
        .setPlaceholder('فرد / رتبة');

      const targetInput = new TextInputBuilder()
        .setCustomId('message_target')
        .setLabel('معرف الشخص أو اسم الرتبة')
        .setStyle(TextInputStyle.Short)
        .setPlaceholder('@username أو اسم الرتبة');

      const messageInput = new TextInputBuilder()
        .setCustomId('message_content')
        .setLabel('الرسالة')
        .setStyle(TextInputStyle.Paragraph);

      modal.addComponents(
        new ActionRowBuilder().addComponents(typeInput),
        new ActionRowBuilder().addComponents(targetInput),
        new ActionRowBuilder().addComponents(messageInput)
      );

      await interaction.showModal(modal);
    }

    else if (commandName === 'sahsah') {
      const targetUser = interaction.options.getUser('user');
      let seconds = Math.min(interaction.options.getInteger('seconds'), 5);
      const member = await guild.members.fetch(targetUser.id);

      if (!member.voice.channel) {
        await interaction.reply('❌ العضو ليس في قناة صوتية');
        return;
      }

      await interaction.reply(`🎲 صحصح! نقل ${targetUser.username} لمدة ${seconds} ثواني...`);

      const channels = guild.channels.cache.filter(c => c.isVoiceBased());
      const originalChannel = member.voice.channel;
      const startTime = Date.now();

      const interval = setInterval(async () => {
        if (Date.now() - startTime > seconds * 1000) {
          clearInterval(interval);
          try {
            await member.voice.setChannel(originalChannel);
            console.log(`✅ [SAHSAH] ${targetUser.tag} رجع لروم ${originalChannel.name}`);
          } catch (e) {}
          return;
        }

        const randomChannel = channels.random();
        try {
          await member.voice.setChannel(randomChannel);
        } catch (e) {}
      }, 500);
    }

    else if (commandName === 'playaudio') {
      const audioNum = interaction.options.getInteger('audio');
      const member = interaction.member;

      if (!member.voice.channel) {
        await interaction.reply('❌ أنت لست في قناة صوتية');
        return;
      }

      const originalChannel = member.voice.channel;
      const audioPath = path.join(__dirname, 'audio', `audio${audioNum}.mp3`);

      if (!fs.existsSync(audioPath)) {
        await interaction.reply(`❌ الملف الصوتي ${audioNum} غير موجود`);
        return;
      }

      try {
        const connection = joinVoiceChannel({
          channelId: originalChannel.id,
          guildId: guild.id,
          adapterCreator: guild.voiceAdapterCreator,
        });

        const player = createAudioPlayer();
        const resource = createAudioResource(audioPath);

        player.play(resource);
        connection.subscribe(player);

        await interaction.reply(`🎵 جاري تشغيل الصوتية ${audioNum}...`);

        player.on(AudioPlayerStatus.Idle, () => {
          connection.destroy();
          console.log('✅ [AUDIO] انتهت الصوتية');
        });

        player.on('error', error => {
          console.error('[AUDIO] خطأ:', error.message);
          connection.destroy();
        });

        connection.on(VoiceConnectionStatus.Disconnected, () => {
          connection.destroy();
        });
      } catch (e) {
        await interaction.reply(`❌ خطأ: ${e.message}`);
      }
    }

    else if (commandName === 'autoreply') {
      const trigger = interaction.options.getString('trigger').toLowerCase();
      const response = interaction.options.getString('response');

      client.autoReplies.set(trigger, response);
      await interaction.reply(`✅ تم ضع الرد التلقائي\n**${trigger}** → ${response}`);
    }

    else if (commandName === 'userinfo') {
      const targetUser = interaction.options.getUser('user');
      const member = await guild.members.fetch(targetUser.id);

      const embed = new EmbedBuilder()
        .setColor(0x0099ff)
        .setTitle(`👤 معلومات ${targetUser.username}`)
        .setThumbnail(targetUser.displayAvatarURL())
        .addFields(
          { name: '🆔 معرف المستخدم', value: targetUser.id, inline: true },
          { name: '📝 الاسم', value: targetUser.username, inline: true },
          { name: '🎭 اللقب', value: member.displayName, inline: true },
          { name: '🤖 بوت؟', value: targetUser.bot ? 'نعم ✅' : 'لا ❌', inline: true },
          { name: '📅 تاريخ الانضمام', value: `<t:${Math.floor(member.joinedTimestamp / 1000)}:d>`, inline: true },
          { name: '⏰ تاريخ الإنشاء', value: `<t:${Math.floor(targetUser.createdTimestamp / 1000)}:d>`, inline: true },
          { name: '👥 عدد الأدوار', value: `${member.roles.cache.size}`, inline: true },
        );

      await interaction.reply({ embeds: [embed] });
    }

    else if (commandName === 'forceservertag') {
      const members = await guild.members.fetch();
      let count = 0;

      for (const [memberId, member] of members) {
        if (member.user.bot) continue;

        if (!member.displayName.includes('[')) {
          try {
            await member.setNickname(`[SRV] ${member.displayName}`);
            count++;
          } catch (e) {
            try {
              await member.user.send({
                content: '🏷️ **يرجى إضافة تاق السيرفر**',
                components: [
                  new ActionRowBuilder().addComponents(
                    new ButtonBuilder()
                      .setCustomId('add_tag')
                      .setLabel('✅ أضف التاق')
                      .setStyle(ButtonStyle.Primary)
                  ),
                ],
              });
            } catch (e2) {}
          }
        }
      }

      await interaction.reply(`✅ تم فرض التاق على **${count}** عضو`);
    }
  } catch (error) {
    console.error('❌ خطأ:', error);
    await interaction.reply('❌ حدث خطأ ما').catch(() => {});
  }
});

// ===== MODAL SUBMISSION =====
client.on('interactionCreate', async interaction => {
  if (!interaction.isModalSubmit()) return;

  const { customId, fields, guild, user } = interaction;

  if (customId === 'send_message_modal') {
    const type = fields.getTextInputValue('message_type').toLowerCase();
    const target = fields.getTextInputValue('message_target');
    const message = fields.getTextInputValue('message_content');

    try {
      if (type.includes('فرد')) {
        let targetUser;

        if (target.startsWith('<@') && target.endsWith('>')) {
          const userId = target.slice(2, -1).replace('!', '');
          targetUser = await client.users.fetch(userId).catch(() => null);
        } else if (/^\d+$/.test(target)) {
          targetUser = await client.users.fetch(target).catch(() => null);
        } else {
          const members = await guild.members.search({ query: target, limit: 1 });
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

        await targetUser.send({ embeds: [dmEmbed] });
        await interaction.reply({ content: `✅ تم إرسال الرسالة لـ ${targetUser.username}`, ephemeral: true });
      }

      else if (type.includes('رتبة')) {
        let targetRole = guild.roles.cache.find(r => r.name.toLowerCase() === target.toLowerCase());

        if (!targetRole && /^\d+$/.test(target)) {
          targetRole = guild.roles.cache.get(target);
        }

        if (!targetRole) {
          await interaction.reply({ content: '❌ لم أجد الرتبة', ephemeral: true });
          return;
        }

        let successCount = 0;

        const dmEmbed = new EmbedBuilder()
          .setColor(0x00AA00)
          .setAuthor({ name: `رسالة من ${user.username}` })
          .setDescription(message)
          .addFields({ name: '👥 الفئة', value: `أصحاب الرتبة: ${targetRole.name}` })
          .setTimestamp();

        for (const [memberId, member] of targetRole.members) {
          try {
            await member.user.send({ embeds: [dmEmbed] });
            successCount++;
          } catch (e) {}
        }

        await interaction.reply({ content: `✅ تم إرسال الرسائل: **${successCount}**`, ephemeral: true });
      }
    } catch (error) {
      await interaction.reply({ content: '❌ خطأ: ' + error.message, ephemeral: true });
    }
  }
});

// ===== BUTTON HANDLERS =====
client.on('interactionCreate', async interaction => {
  if (!interaction.isButton()) return;

  if (interaction.customId === 'add_tag') {
    const member = await interaction.guild.members.fetch(interaction.user.id);
    try {
      await member.setNickname(`[SRV] ${member.displayName}`);
      await interaction.reply({ content: '✅ تم إضافة التاق', ephemeral: true });
    } catch (e) {
      await interaction.reply({ content: '❌ لم أستطع إضافة التاق', ephemeral: true });
    }
  }
});

// ===== MESSAGE EVENTS =====
client.on('messageCreate', async message => {
  if (message.author.bot) return;

  // XP
  const current = client.xpData.get(message.author.id) || 0;
  client.xpData.set(message.author.id, current + 10);

  // Auto Replies
  const content = message.content.toLowerCase();
  for (const [trigger, response] of client.autoReplies) {
    if (content.includes(trigger)) {
      await message.reply(response).catch(() => {});
    }
  }
});

// ===== VOICE STATE UPDATE - AFK & ABUSE =====
client.on('voiceStateUpdate', async (oldState, newState) => {
  const member = newState.member ?? oldState.member;
  const guild = newState.guild;

  if (!member || member.user.bot) return;

  // ===== AFK SYSTEM =====
  const userId = member.id;

  if (!newState.channelId) {
    if (client.afkTimers.has(userId)) {
      clearTimeout(client.afkTimers.get(userId));
      client.afkTimers.delete(userId);
    }
    return;
  }

  if (newState.channelId === CONFIG.AFK_CHANNEL_ID) {
    if (client.afkTimers.has(userId)) {
      clearTimeout(client.afkTimers.get(userId));
      client.afkTimers.delete(userId);
    }
    return;
  }

  const isMutedOrDeafened = newState.selfMute || newState.selfDeaf;

  if (isMutedOrDeafened) {
    const timer = setTimeout(async () => {
      try {
        const freshMember = await guild.members.fetch(userId).catch(() => null);
        if (!freshMember || !freshMember.voice.channel) return;

        if (freshMember.voice.selfMute || freshMember.voice.selfDeaf) {
          await freshMember.voice.setChannel(CONFIG.AFK_CHANNEL_ID, 'AFK - صمت 10 دقايق');
          console.log(`[AFK] نقل ${member.user.tag}`);
        }
      } catch (e) {
        console.error('[AFK] خطأ:', e.message);
      } finally {
        client.afkTimers.delete(userId);
      }
    }, CONFIG.AFK_TIMEOUT_MS);

    client.afkTimers.set(userId, timer);
  } else {
    if (client.afkTimers.has(userId)) {
      clearTimeout(client.afkTimers.get(userId));
      client.afkTimers.delete(userId);
    }
  }

  // ===== ABUSE DETECTION =====
  const key = `abuse-${userId}`;
  let abuseCount = client.userWarns.get(key) || 0;

  // كل حركة مريبة
  if (oldState.channelId && !newState.channelId) {
    abuseCount++;
  }

  client.userWarns.set(key, abuseCount);

  if (abuseCount >= 3) {
    const timeoutKey = `timeout-${userId}`;
    const hasTimeout = client.userTimeouts.has(timeoutKey);

    if (!hasTimeout) {
      // أول تحذير
      if (abuseCount === 3) {
        const dmEmbed = new EmbedBuilder()
          .setColor(0xFFAA00)
          .setTitle('⚠️ تحذير - استخدام خاطئ للصلاحيات')
          .setDescription(`تم اكتشاف تصرفات مريبة من قبلك\n\n**المشكلة:** عمليات متكررة على الرومات/الرتب\n\n⚠️ **التنبيه:** المرة القادمة سيتم سحب جميع الصلاحيات`);

        try {
          await member.user.send({ embeds: [dmEmbed] });
        } catch (e) {}

        // إرسال للأونر
        const ownerUser = await client.users.fetch(CONFIG.OWNER_ID).catch(() => null);
        if (ownerUser) {
          const ownerEmbed = new EmbedBuilder()
            .setColor(0xFF0000)
            .setTitle('🚨 تنبيه - عضو مريب')
            .setDescription(`**العضو:** ${member.user.tag} (${member.user.id})\n**الحركات:** ${abuseCount} حركات مريبة\n**الإجراء:** تحذير أول`)
            .setThumbnail(member.user.displayAvatarURL())
            .setTimestamp();

          try {
            await ownerUser.send({ embeds: [ownerEmbed] });
          } catch (e) {}
        }
      }

      // سحب الصلاحيات
      else if (abuseCount >= 6) {
        try {
          await member.roles.removeAll('سحب جميع الصلاحيات - استخدام خاطئ');
          console.log(`🚫 [ABUSE] تم سحب الصلاحيات من ${member.user.tag}`);

          const dmEmbed = new EmbedBuilder()
            .setColor(0xFF0000)
            .setTitle('🚫 تم سحب الصلاحيات')
            .setDescription(`تم سحب جميع صلاحياتك لأسباب أمنية`);

          await member.user.send({ embeds: [dmEmbed] }).catch(() => {});

          // إرسال للأونر
          const ownerUser = await client.users.fetch(CONFIG.OWNER_ID).catch(() => null);
          if (ownerUser) {
            const ownerEmbed = new EmbedBuilder()
              .setColor(0xFF0000)
              .setTitle('🚨 تم سحب الصلاحيات')
              .setDescription(`**العضو:** ${member.user.tag}\n**السبب:** استخدام خاطئ متكرر للصلاحيات`)
              .setTimestamp();

            await ownerUser.send({ embeds: [ownerEmbed] }).catch(() => {});
          }

          // Timeout
          client.userTimeouts.set(timeoutKey, true);
          setTimeout(() => {
            client.userTimeouts.delete(timeoutKey);
            client.userWarns.set(key, 0);
            console.log(`✅ انتهى الـ timeout لـ ${member.user.tag}`);
          }, CONFIG.TIMEOUT_DURATION);
        } catch (e) {
          console.error('[ABUSE] خطأ في سحب الصلاحيات:', e.message);
        }
      }
    }
  }
});

// ===== BOT VOICE PROTECTION =====
client.on('voiceStateUpdate', async (oldState, newState) => {
  if (oldState.member?.id === client.user.id && oldState.channelId === CONFIG.BOT_HOME_CHANNEL_ID) {
    setTimeout(async () => {
      try {
        const guild = oldState.guild;
        const channel = guild.channels.cache.get(CONFIG.BOT_HOME_CHANNEL_ID);
        if (!channel?.isVoiceBased()) return;

        const botMember = guild.members.me;
        if (!botMember || botMember.voice.channelId === CONFIG.BOT_HOME_CHANNEL_ID) return;

        await botMember.voice.setChannel(channel);
        console.log('🔙 [BOT GUARD] البوت رجع للروم');
      } catch (e) {
        console.error('[BOT GUARD] خطأ:', e.message);
      }
    }, 500);
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

  // حاول دخول الروم
  async function ensureBotChannel() {
    try {
      const guild = client.guilds.cache.first();
      if (!guild) return;

      const channel = guild.channels.cache.get(CONFIG.BOT_HOME_CHANNEL_ID);
      if (!channel?.isVoiceBased()) return;

      const botMember = guild.members.me;
      if (!botMember) return;

      const perms = channel.permissionsFor(botMember);
      if (!perms.has('Connect')) {
        console.error('[BOT] ما عندي صلاحية Connect');
        return;
      }

      if (botMember.voice.channelId !== CONFIG.BOT_HOME_CHANNEL_ID) {
        await botMember.voice.setChannel(channel);
        console.log('✅ [BOT] دخل الروم الأساسي');
      }
    } catch (e) {
      console.error('[BOT] خطأ:', e.message);
    }
  }

  await ensureBotChannel();
  setTimeout(() => ensureBotChannel(), 3000);

  await registerCommands();
});

// ===== LOGIN =====
client.login(token).catch(err => {
  console.error('❌ فشل:', err.message);
  process.exit(1);
});
