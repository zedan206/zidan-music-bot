require('dotenv').config();
const ffmpegStatic = require('ffmpeg-static');
process.env.FFMPEG_PATH = ffmpegStatic;

const { Client, GatewayIntentBits, EmbedBuilder, ActivityType } = require('discord.js');
const { DisTube } = require('distube');
const { YtDlpPlugin } = require('@distube/yt-dlp');
const { joinVoiceChannel, VoiceConnectionStatus, entersState, getVoiceConnection } = require('@discordjs/voice');

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildVoiceStates,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
  ],
});

const distube = new DisTube(client, {
  searchSongs: 5,
  searchCooldown: 30,
  emitNewSongOnly: true,
  joinNewVoiceChannel: true,
  nsfw: false,
  leaveOnEmpty: false,
  leaveOnFinish: false,
  leaveOnStop: false,
  plugins: [new YtDlpPlugin({ update: false })],
});

const PREFIX = '!';

function errorEmbed(description) {
  return new EmbedBuilder().setColor('#FF6B6B').setDescription(description);
}

client.once('ready', () => {
  console.log(`✅ البوت جاهز: ${client.user.tag}`);
  client.user.setActivity('🎵 الموسيقى | !help', { type: ActivityType.Listening });
});

client.on('messageCreate', async (message) => {
  if (message.author.bot || !message.guild) return;
  if (!message.content.startsWith(PREFIX)) return;

  const args = message.content.slice(PREFIX.length).trim().split(/ +/);
  const command = args.shift().toLowerCase();
  const voiceChannel = message.member?.voice?.channel;

  // ─── !join ──────────────────────────────────────────────────────
  if (command === 'join' || command === 'j') {
    if (!voiceChannel) {
      return message.reply({ embeds: [errorEmbed('🔇 ادخل قناة صوتية أولاً!')] });
    }
    try {
      const connection = joinVoiceChannel({
        channelId: voiceChannel.id,
        guildId: message.guild.id,
        adapterCreator: message.guild.voiceAdapterCreator,
        selfDeaf: true,
      });
      await entersState(connection, VoiceConnectionStatus.Ready, 15_000);
      message.reply({
        embeds: [
          new EmbedBuilder()
            .setColor('#00C48C')
            .setDescription(`✅ انضممت إلى **${voiceChannel.name}**! استخدم \`!play\` لتشغيل أغنية.`),
        ],
      });
    } catch {
      message.reply({ embeds: [errorEmbed('❌ فشل الانضمام إلى القناة الصوتية.')] });
    }
  }

  // ─── !leave ─────────────────────────────────────────────────────
  else if (command === 'leave' || command === 'dc') {
    const queue = distube.getQueue(message.guildId);
    if (queue) distube.stop(message.guildId);

    const connection = getVoiceConnection(message.guild.id);
    if (connection) {
      connection.destroy();
      message.reply({
        embeds: [
          new EmbedBuilder()
            .setColor('#FF6B6B')
            .setDescription('👋 غادرت القناة الصوتية.'),
        ],
      });
    } else {
      message.reply({ embeds: [errorEmbed('📭 البوت ليس في أي قناة صوتية!')] });
    }
  }

  // ─── !play ──────────────────────────────────────────────────────
  else if (command === 'play' || command === 'p') {
    const query = args.join(' ');

    if (!query) {
      return message.reply({ embeds: [errorEmbed('❌ اكتب اسم أغنية أو رابط بعد `!play`')] });
    }
    if (!voiceChannel) {
      return message.reply({ embeds: [errorEmbed('🔇 ادخل قناة صوتية أولاً!')] });
    }

    try {
      const connection = joinVoiceChannel({
        channelId: voiceChannel.id,
        guildId: message.guild.id,
        adapterCreator: message.guild.voiceAdapterCreator,
        selfDeaf: true,
      });

      await entersState(connection, VoiceConnectionStatus.Ready, 30_000).catch(() => {
        connection.destroy();
        throw new Error('تعذّر الاتصال بالقناة الصوتية، حاول مرة أخرى.');
      });

      await distube.play(voiceChannel, query, {
        message,
        textChannel: message.channel,
      });
    } catch (err) {
      console.error('خطأ في التشغيل:', err);
      message.reply({ embeds: [errorEmbed(`❌ ${err.message}`)] });
    }
  }

  // ─── !skip ──────────────────────────────────────────────────────
  else if (command === 'skip' || command === 's') {
    const queue = distube.getQueue(message.guildId);
    if (!queue) return message.reply({ embeds: [errorEmbed('📭 لا يوجد شيء يعزف!')] });

    try {
      await queue.skip();
      message.reply({
        embeds: [new EmbedBuilder().setColor('#00C48C').setDescription('⏭️ تم تخطي الأغنية!')],
      });
    } catch {
      distube.stop(message.guildId);
      message.reply({
        embeds: [new EmbedBuilder().setColor('#FFA500').setDescription('⏹️ آخر أغنية، انتهت القائمة. البوت لا يزال في القناة.')],
      });
    }
  }

  // ─── !stop ──────────────────────────────────────────────────────
  else if (command === 'stop' || command === 'st') {
    const queue = distube.getQueue(message.guildId);
    if (!queue) return message.reply({ embeds: [errorEmbed('📭 لا يوجد شيء يعزف!')] });
    distube.stop(message.guildId);
    message.reply({
      embeds: [
        new EmbedBuilder()
          .setColor('#FFA500')
          .setDescription('⏹️ تم إيقاف الموسيقى ومسح القائمة.\nالبوت لا يزال في القناة. استخدم `!leave` للمغادرة.'),
      ],
    });
  }

  // ─── !queue ─────────────────────────────────────────────────────
  else if (command === 'queue' || command === 'q') {
    const queue = distube.getQueue(message.guildId);
    if (!queue || !queue.songs.length) {
      return message.reply({ embeds: [errorEmbed('📭 القائمة فارغة! استخدم `!play` لإضافة أغنية.')] });
    }

    const current = queue.songs[0];
    const list = queue.songs
      .slice(1, 11)
      .map((s, i) => `**${i + 1}.** ${s.name} — \`${s.formattedDuration}\``)
      .join('\n');

    const embed = new EmbedBuilder()
      .setColor('#5865F2')
      .setTitle('🎶 قائمة الأغاني')
      .addFields(
        { name: '▶️ يعزف الآن', value: `${current.name} — \`${current.formattedDuration}\`` },
        { name: `📋 في الانتظار (${queue.songs.length - 1})`, value: list || '_لا توجد أغاني_' }
      );
    message.reply({ embeds: [embed] });
  }

  // ─── !pause ─────────────────────────────────────────────────────
  else if (command === 'pause') {
    const queue = distube.getQueue(message.guildId);
    if (!queue) return message.reply({ embeds: [errorEmbed('📭 لا يوجد شيء يعزف!')] });
    queue.pause();
    message.reply({
      embeds: [new EmbedBuilder().setColor('#FFA500').setDescription('⏸️ تم الإيقاف المؤقت.')],
    });
  }

  // ─── !resume ────────────────────────────────────────────────────
  else if (command === 'resume' || command === 'r') {
    const queue = distube.getQueue(message.guildId);
    if (!queue) return message.reply({ embeds: [errorEmbed('📭 لا يوجد شيء متوقف!')] });
    queue.resume();
    message.reply({
      embeds: [new EmbedBuilder().setColor('#00C48C').setDescription('▶️ تم الاستئناف.')],
    });
  }

  // ─── !volume ────────────────────────────────────────────────────
  else if (command === 'volume' || command === 'v') {
    const queue = distube.getQueue(message.guildId);
    if (!queue) return message.reply({ embeds: [errorEmbed('📭 لا يوجد شيء يعزف!')] });
    const vol = parseInt(args[0]);
    if (isNaN(vol) || vol < 1 || vol > 100) {
      return message.reply({ embeds: [errorEmbed('🔊 أدخل رقماً بين 1 و 100\nمثال: `!volume 75`')] });
    }
    queue.setVolume(vol);
    message.reply({
      embeds: [new EmbedBuilder().setColor('#5865F2').setDescription(`🔊 الصوت: **${vol}%**`)],
    });
  }

  // ─── !loop ──────────────────────────────────────────────────────
  else if (command === 'loop' || command === 'l') {
    const queue = distube.getQueue(message.guildId);
    if (!queue) return message.reply({ embeds: [errorEmbed('📭 لا يوجد شيء يعزف!')] });
    const mode = queue.setRepeatMode();
    const modes = ['🚫 بدون تكرار', '🔂 تكرار الأغنية', '🔁 تكرار القائمة'];
    message.reply({
      embeds: [new EmbedBuilder().setColor('#5865F2').setDescription(`وضع التكرار: **${modes[mode]}**`)],
    });
  }

  // ─── !nowplaying ────────────────────────────────────────────────
  else if (command === 'nowplaying' || command === 'np') {
    const queue = distube.getQueue(message.guildId);
    if (!queue) return message.reply({ embeds: [errorEmbed('📭 لا يوجد شيء يعزف!')] });
    const song = queue.songs[0];
    const embed = new EmbedBuilder()
      .setColor('#5865F2')
      .setTitle('🎵 يعزف الآن')
      .setDescription(`[${song.name}](${song.url})`)
      .addFields(
        { name: '⏱️ المدة', value: `\`${song.formattedDuration}\``, inline: true },
        { name: '👤 طلب من', value: `${song.user}`, inline: true }
      );
    if (song.thumbnail) embed.setThumbnail(song.thumbnail);
    message.reply({ embeds: [embed] });
  }

  // ─── !reconnect ─────────────────────────────────────────────────
  else if (command === 'reconnect' || command === 'rc') {
    if (!voiceChannel) {
      return message.reply({ embeds: [errorEmbed('🔇 ادخل قناة صوتية أولاً!')] });
    }
    try {
      const existing = getVoiceConnection(message.guild.id);
      if (existing) existing.destroy();

      const connection = joinVoiceChannel({
        channelId: voiceChannel.id,
        guildId: message.guild.id,
        adapterCreator: message.guild.voiceAdapterCreator,
        selfDeaf: true,
      });

      await entersState(connection, VoiceConnectionStatus.Ready, 15_000);
      message.reply({
        embeds: [
          new EmbedBuilder()
            .setColor('#00C48C')
            .setDescription('✅ أُعيد الاتصال! الآن استخدم `!play` لتشغيل أغنية.'),
        ],
      });
    } catch {
      message.reply({ embeds: [errorEmbed('❌ فشل إعادة الاتصال. حاول مرة أخرى.')] });
    }
  }

  // ─── !help ──────────────────────────────────────────────────────
  else if (command === 'help' || command === 'h') {
    const embed = new EmbedBuilder()
      .setColor('#5865F2')
      .setTitle('📖 قائمة الأوامر')
      .addFields(
        { name: '`!join` أو `!j`', value: 'الانضمام للقناة الصوتية بدون تشغيل', inline: false },
        { name: '`!leave` أو `!dc`', value: 'مغادرة القناة الصوتية', inline: false },
        { name: '`!play [رابط/اسم]`', value: 'تشغيل أغنية أو إضافتها للقائمة', inline: false },
        { name: '`!skip` أو `!s`', value: 'تخطي الأغنية الحالية', inline: true },
        { name: '`!stop` أو `!st`', value: 'إيقاف الموسيقى (البوت يبقى)', inline: true },
        { name: '`!queue` أو `!q`', value: 'قائمة الأغاني', inline: true },
        { name: '`!pause`', value: 'توقف مؤقت', inline: true },
        { name: '`!resume` أو `!r`', value: 'استئناف', inline: true },
        { name: '`!volume [1-100]`', value: 'مستوى الصوت', inline: true },
        { name: '`!loop` أو `!l`', value: 'وضع التكرار', inline: true },
        { name: '`!nowplaying` أو `!np`', value: 'الأغنية الحالية', inline: true },
        { name: '`!reconnect` أو `!rc`', value: 'إعادة الاتصال', inline: true },
      )
      .setFooter({ text: '🎵 البوت يبقى في القناة حتى تستخدم !leave' });
    message.reply({ embeds: [embed] });
  }
});

// ─── أحداث DisTube ─────────────────────────────────────────────────
distube.on('playSong', (queue, song) => {
  const embed = new EmbedBuilder()
    .setColor('#00C48C')
    .setTitle('🎵 يعز
