require('dotenv').config();
const { Client, GatewayIntentBits, EmbedBuilder, ActivityType } = require('discord.js');
const { DisTube } = require('distube');
const { YtDlpPlugin } = require('@distube/yt-dlp');

// ─── إنشاء الكلايانت ───────────────────────────────────────────────
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildVoiceStates,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
  ],
});

// ─── إنشاء DisTube ─────────────────────────────────────────────────
const distube = new DisTube(client, {
  plugins: [new YtDlpPlugin({ update: false })],
  emitNewSongOnly: true,
  joinNewVoiceChannel: true,
});

const PREFIX = '!';

// ─── رسالة الجاهزية ────────────────────────────────────────────────
client.once('ready', () => {
  console.log(`✅ البوت جاهز: ${client.user.tag}`);
  client.user.setActivity('🎵 الموسيقى | !help', { type: ActivityType.Listening });
});

// ─── استقبال الأوامر ───────────────────────────────────────────────
client.on('messageCreate', async (message) => {
  if (message.author.bot || !message.guild) return;
  if (!message.content.startsWith(PREFIX)) return;

  const args = message.content.slice(PREFIX.length).trim().split(/ +/);
  const command = args.shift().toLowerCase();

  const voiceChannel = message.member?.voice?.channel;

  // ─── أمر !play ──────────────────────────────────────────────────
  if (command === 'play' || command === 'p') {
    const query = args.join(' ');

    if (!query) {
      return message.reply({
        embeds: [
          errorEmbed('❌ يجب كتابة اسم أغنية أو رابط بعد الأمر!\nمثال: `!play اسم الأغنية`'),
        ],
      });
    }

    if (!voiceChannel) {
      return message.reply({
        embeds: [errorEmbed('🔇 يجب أن تكون في قناة صوتية أولاً!')],
      });
    }

    const permissions = voiceChannel.permissionsFor(client.user);
    if (!permissions.has('Connect') || !permissions.has('Speak')) {
      return message.reply({
        embeds: [errorEmbed('🚫 ليس لدي صلاحية الدخول أو التحدث في قناتك الصوتية!')],
      });
    }

    try {
      await distube.play(voiceChannel, query, {
        message,
        textChannel: message.channel,
      });
    } catch (err) {
      console.error('خطأ في التشغيل:', err);
      message.reply({
        embeds: [errorEmbed(`❌ حدث خطأ أثناء التشغيل:\n\`${err.message}\``)],
      });
    }
  }

  // ─── أمر !skip ──────────────────────────────────────────────────
  else if (command === 'skip' || command === 's') {
    if (!voiceChannel) {
      return message.reply({ embeds: [errorEmbed('🔇 أنت لست في قناة صوتية!')] });
    }

    const queue = distube.getQueue(message.guild.id);
    if (!queue) {
      return message.reply({ embeds: [errorEmbed('📭 لا يوجد شيء يعزف الآن!')] });
    }

    if (queue.songs.length <= 1) {
      distube.stop(message.guild.id);
      return message.reply({
        embeds: [
          new EmbedBuilder()
            .setColor('#FF6B6B')
            .setDescription('⏹️ لا توجد أغنية تالية، تم إيقاف التشغيل.'),
        ],
      });
    }

    try {
      await distube.skip(message.guild.id);
      message.reply({
        embeds: [
          new EmbedBuilder()
            .setColor('#00C48C')
            .setDescription('⏭️ تم تخطي الأغنية الحالية!'),
        ],
      });
    } catch (err) {
      message.reply({ embeds: [errorEmbed(`❌ ${err.message}`)] });
    }
  }

  // ─── أمر !stop ──────────────────────────────────────────────────
  else if (command === 'stop' || command === 'st') {
    if (!voiceChannel) {
      return message.reply({ embeds: [errorEmbed('🔇 أنت لست في قناة صوتية!')] });
    }

    const queue = distube.getQueue(message.guild.id);
    if (!queue) {
      return message.reply({ embeds: [errorEmbed('📭 لا يوجد شيء يعزف الآن!')] });
    }

    distube.stop(message.guild.id);
    message.reply({
      embeds: [
        new EmbedBuilder()
          .setColor('#FF6B6B')
          .setDescription('⏹️ تم إيقاف الموسيقى ومسح قائمة الأغاني.'),
      ],
    });
  }

  // ─── أمر !queue ─────────────────────────────────────────────────
  else if (command === 'queue' || command === 'q') {
    const queue = distube.getQueue(message.guild.id);

    if (!queue || queue.songs.length === 0) {
      return message.reply({ embeds: [errorEmbed('📭 قائمة الأغاني فارغة!')] });
    }

    const songs = queue.songs;
    const current = songs[0];

    const songList = songs
      .slice(1, 11)
      .map((song, i) => `**${i + 1}.** [${song.name}](${song.url}) — \`${song.formattedDuration}\``)
      .join('\n');

    const embed = new EmbedBuilder()
      .setColor('#5865F2')
      .setTitle('🎶 قائمة الأغاني')
      .addFields(
        {
          name: '▶️ يعزف الآن',
          value: `[${current.name}](${current.url}) — \`${current.formattedDuration}\``,
        },
        {
          name: `📋 في الانتظار (${songs.length - 1} أغنية)`,
          value: songList || '_لا توجد أغاني في الانتظار_',
        }
      )
      .setFooter({ text: `إجمالي الأغاني: ${songs.length}` });

    if (songs.length > 11) {
      embed.addFields({
        name: '\u200B',
        value: `_... و ${songs.length - 11} أغنية أخرى_`,
      });
    }

    message.reply({ embeds: [embed] });
  }

  // ─── أمر !pause ─────────────────────────────────────────────────
  else if (command === 'pause') {
    const queue = distube.getQueue(message.guild.id);
    if (!queue) return message.reply({ embeds: [errorEmbed('📭 لا يوجد شيء يعزف!')] });

    if (queue.paused) {
      return message.reply({ embeds: [errorEmbed('⏸️ الموسيقى متوقفة مسبقاً!')] });
    }

    distube.pause(message.guild.id);
    message.reply({
      embeds: [
        new EmbedBuilder().setColor('#FFA500').setDescription('⏸️ تم إيقاف الموسيقى مؤقتاً.'),
      ],
    });
  }

  // ─── أمر !resume ────────────────────────────────────────────────
  else if (command === 'resume' || command === 'r') {
    const queue = distube.getQueue(message.guild.id);
    if (!queue) return message.reply({ embeds: [errorEmbed('📭 لا يوجد شيء متوقف!')] });

    if (!queue.paused) {
      return message.reply({ embeds: [errorEmbed('▶️ الموسيقى تعزف بالفعل!')] });
    }

    distube.resume(message.guild.id);
    message.reply({
      embeds: [
        new EmbedBuilder().setColor('#00C48C').setDescription('▶️ تم استئناف تشغيل الموسيقى.'),
      ],
    });
  }

  // ─── أمر !volume ────────────────────────────────────────────────
  else if (command === 'volume' || command === 'v') {
    const queue = distube.getQueue(message.guild.id);
    if (!queue) return message.reply({ embeds: [errorEmbed('📭 لا يوجد شيء يعزف!')] });

    const vol = parseInt(args[0]);
    if (isNaN(vol) || vol < 1 || vol > 100) {
      return message.reply({
        embeds: [errorEmbed('🔊 أدخل رقماً بين 1 و 100\nمثال: `!volume 75`')],
      });
    }

    distube.setVolume(message.guild.id, vol);
    message.reply({
      embeds: [
        new EmbedBuilder()
          .setColor('#5865F2')
          .setDescription(`🔊 تم ضبط الصوت على **${vol}%**`),
      ],
    });
  }

  // ─── أمر !loop ──────────────────────────────────────────────────
  else if (command === 'loop' || command === 'l') {
    const queue = distube.getQueue(message.guild.id);
    if (!queue) return message.reply({ embeds: [errorEmbed('📭 لا يوجد شيء يعزف!')] });

    const mode = distube.setRepeatMode(message.guild.id);
    const modes = ['🚫 بدون تكرار', '🔂 تكرار الأغنية الحالية', '🔁 تكرار القائمة كاملة'];
    message.reply({
      embeds: [
        new EmbedBuilder()
          .setColor('#5865F2')
          .setDescription(`تم تغيير وضع التكرار إلى: **${modes[mode]}**`),
      ],
    });
  }

  // ─── أمر !nowplaying ────────────────────────────────────────────
  else if (command === 'nowplaying' || command === 'np') {
    const queue = distube.getQueue(message.guild.id);
    if (!queue) return message.reply({ embeds: [errorEmbed('📭 لا يوجد شيء يعزف الآن!')] });

    const song = queue.songs[0];
    const embed = new EmbedBuilder()
      .setColor('#5865F2')
      .setTitle('🎵 يعزف الآن')
      .setDescription(`[${song.name}](${song.url})`)
      .addFields(
        { name: '⏱️ المدة', value: `\`${song.formattedDuration}\``, inline: true },
        { name: '🎤 الفنان', value: song.uploader?.name || 'غير معروف', inline: true },
        { name: '👤 طلب من', value: `${song.user}`, inline: true }
      );

    if (song.thumbnail) embed.setThumbnail(song.thumbnail);
    message.reply({ embeds: [embed] });
  }

  // ─── أمر !help ──────────────────────────────────────────────────
  else if (command === 'help' || command === 'h') {
    const embed = new EmbedBuilder()
      .setColor('#5865F2')
      .setTitle('📖 قائمة الأوامر')
      .addFields(
        { name: '`!play [رابط/اسم]`', value: 'تشغيل أغنية أو إضافتها للقائمة', inline: false },
        { name: '`!skip`', value: 'تخطي الأغنية الحالية', inline: true },
        { name: '`!stop`', value: 'إيقاف التشغيل ومسح القائمة', inline: true },
        { name: '`!queue`', value: 'عرض قائمة الأغاني', inline: true },
        { name: '`!pause`', value: 'إيقاف مؤقت', inline: true },
        { name: '`!resume`', value: 'استئناف التشغيل', inline: true },
        { name: '`!volume [1-100]`', value: 'ضبط مستوى الصوت', inline: true },
        { name: '`!loop`', value: 'تبديل وضع التكرار', inline: true },
        { name: '`!nowplaying`', value: 'معلومات الأغنية الحالية', inline: true },
      )
      .setFooter({ text: 'يمكن استخدام الاختصارات: !p, !s, !st, !q, !r, !v, !l, !np' });

    message.reply({ embeds: [embed] });
  }
});

// ─── أحداث DisTube ─────────────────────────────────────────────────
distube.on('playSong', (queue, song) => {
  const embed = new EmbedBuilder()
    .setColor('#00C48C')
    .setTitle('🎵 يعزف الآن')
    .setDescription(`[${song.name}](${song.url})`)
    .addFields(
      { name: '⏱️ المدة', value: `\`${song.formattedDuration}\``, inline: true },
      { name: '🔊 الصوت', value: `${queue.volume}%`, inline: true },
      { name: '👤 طلب من', value: `${song.user}`, inline: true }
    );

  if (song.thumbnail) embed.setThumbnail(song.thumbnail);
  queue.textChannel?.send({ embeds: [embed] });
});

distube.on('addSong', (queue, song) => {
  const embed = new EmbedBuilder()
    .setColor('#5865F2')
    .setDescription(
      `✅ تمت إضافة **[${song.name}](${song.url})** إلى القائمة\n` +
      `الموضع في القائمة: **#${queue.songs.length}**`
    );

  queue.textChannel?.send({ embeds: [embed] });
});

distube.on('addList', (queue, playlist) => {
  const embed = new EmbedBuilder()
    .setColor('#5865F2')
    .setDescription(
      `✅ تمت إضافة قائمة تشغيل **${playlist.name}** (${playlist.songs.length} أغنية) إلى القائمة`
    );

  queue.textChannel?.send({ embeds: [embed] });
});

distube.on('error', (error, queue, song) => {
  console.error('DisTube Error:', error);
  queue.textChannel?.send({
    embeds: [
      errorEmbed(
        `❌ حدث خطأ ${song ? `أثناء تشغيل: **${song.name}**` : ''}:\n\`${error.message}\``
      ),
    ],
  });
});

distube.on('finish', (queue) => {
  queue.textChannel?.send({
    embeds: [
      new EmbedBuilder()
        .setColor('#FF6B6B')
        .setDescription('✅ انتهت قائمة الأغاني. أضف أغاني جديدة بـ `!play`'),
    ],
  });
});

distube.on('disconnect', (queue) => {
  queue.textChannel?.send({
    embeds: [
      new EmbedBuilder()
        .setColor('#FF6B6B')
        .setDescription('🔌 تم قطع الاتصال بالقناة الصوتية.'),
    ],
  });
});

distube.on('empty', (queue) => {
  queue.textChannel?.send({
    embeds: [
      new EmbedBuilder()
        .setColor('#FFA500')
        .setDescription('👋 القناة الصوتية فارغة، غادرت القناة.'),
    ],
  });
});

// ─── دالة مساعدة للخطأ ────────────────────────────────────────────
function errorEmbed(description) {
  return new EmbedBuilder().setColor('#FF6B6B').setDescription(description);
}

// ─── تشغيل البوت ──────────────────────────────────────────────────
client.login(process.env.DISCORD_TOKEN);
