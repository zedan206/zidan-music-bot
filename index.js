require('dotenv').config();
const ffmpegStatic = require('ffmpeg-static');
process.env.FFMPEG_PATH = ffmpegStatic;

const { Client, GatewayIntentBits, EmbedBuilder, ActivityType } = require('discord.js');
const { DisTube } = require('distube');
const { YtDlpPlugin } = require('@distube/yt-dlp');

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

  if (command === 'play' || command === 'p') {
    const query = args.join(' ');
    if (!query) {
      return message.reply({ embeds: [errorEmbed('❌ اكتب اسم أغنية أو رابط بعد `!play`')] });
    }
    if (!voiceChannel) {
      return message.reply({ embeds: [errorEmbed('🔇 ادخل قناة صوتية أولاً!')] });
    }
    try {
      await distube.play(voiceChannel, query, { message, textChannel: message.channel });
    } catch (err) {
      console.error(err);
      message.reply({ embeds: [errorEmbed(`❌ خطأ: ${err.message}`)] });
    }
  }

  else if (command === 'skip' || command === 's') {
    const queue = distube.getQueue(message.guildId);
    if (!queue) return message.reply({ embeds: [errorEmbed('📭 لا يوجد شيء يعزف!')] });
    try {
      await queue.skip();
      message.reply({ embeds: [new EmbedBuilder().setColor('#00C48C').setDescription('⏭️ تم التخطي!')] });
    } catch (err) {
      distube.stop(message.guildId);
      message.reply({ embeds: [new EmbedBuilder().setColor('#FF6B6B').setDescription('⏹️ آخر أغنية، تم الإيقاف.')] });
    }
  }

  else if (command === 'stop' || command === 'st') {
    const queue = distube.getQueue(message.guildId);
    if (!queue) return message.reply({ embeds: [errorEmbed('📭 لا يوجد شيء يعزف!')] });
    distube.stop(message.guildId);
    message.reply({ embeds: [new EmbedBuilder().setColor('#FF6B6B').setDescription('⏹️ تم الإيقاف ومسح القائمة.')] });
  }

  else if (command === 'queue' || command === 'q') {
    const queue = distube.getQueue(message.guildId);
    if (!queue || !queue.songs.length) {
      return message.reply({ embeds: [errorEmbed('📭 القائمة فارغة!')] });
    }
    const current = queue.songs[0];
    const list = queue.songs.slice(1, 11)
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

  else if (command === 'pause') {
    const queue = distube.getQueue(message.guildId);
    if (!queue) return message.reply({ embeds: [errorEmbed('📭 لا يوجد شيء يعزف!')] });
    queue.pause();
    message.reply({ embeds: [new EmbedBuilder().setColor('#FFA500').setDescription('⏸️ تم الإيقاف المؤقت.')] });
  }

  else if (command === 'resume' || command === 'r') {
    const queue = distube.getQueue(message.guildId);
    if (!queue) return message.reply({ embeds: [errorEmbed('📭 لا يوجد شيء متوقف!')] });
    queue.resume();
    message.reply({ embeds: [new EmbedBuilder().setColor('#00C48C').setDescription('▶️ تم الاستئناف.')] });
  }

  else if (command === 'volume' || command === 'v') {
    const queue = distube.getQueue(message.guildId);
    if (!queue) return message.reply({ embeds: [errorEmbed('📭 لا يوجد شيء يعزف!')] });
    const vol = parseInt(args[0]);
    if (isNaN(vol) || vol < 1 || vol > 100) {
      return message.reply({ embeds: [errorEmbed('🔊 أدخل رقماً بين 1 و 100')] });
    }
    queue.setVolume(vol);
    message.reply({ embeds: [new EmbedBuilder().setColor('#5865F2').setDescription(`🔊 الصوت: **${vol}%**`)] });
  }

  else if (command === 'loop' || command === 'l') {
    const queue = distube.getQueue(message.guildId);
    if (!queue) return message.reply({ embeds: [errorEmbed('📭 لا يوجد شيء يعزف!')] });
    const mode = queue.setRepeatMode();
    const modes = ['🚫 بدون تكرار', '🔂 تكرار الأغنية', '🔁 تكرار القائمة'];
    message.reply({ embeds: [new EmbedBuilder().setColor('#5865F2').setDescription(`وضع التكرار: **${modes[mode]}**`)] });
  }

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

  else if (command === 'help' || command === 'h') {
    const embed = new EmbedBuilder()
      .setColor('#5865F2')
      .setTitle('📖 قائمة الأوامر')
      .addFields(
        { name: '`!play [رابط/اسم]`', value: 'تشغيل أغنية', inline: false },
        { name: '`!skip`', value: 'تخطي', inline: true },
        { name: '`!stop`', value: 'إيقاف', inline: true },
        { name: '`!queue`', value: 'القائمة', inline: true },
        { name: '`!pause`', value: 'توقف مؤقت', inline: true },
        { name: '`!resume`', value: 'استئناف', inline: true },
        { name: '`!volume [1-100]`', value: 'الصوت', inline: true },
        { name: '`!loop`', value: 'تكرار', inline: true },
        { name: '`!nowplaying`', value: 'الأغنية الحالية', inline: true },
      );
    message.reply({ embeds: [embed] });
  }
});

distube.on('playSong', (queue, song) => {
  const embed = new EmbedBuilder()
    .setColor('#00C48C')
    .setTitle('🎵 يعزف الآن')
    .setDescription(`[${song.name}](${song.url})`)
    .addFields(
      { name: '⏱️ المدة', value: `\`${song.formattedDuration}\``, inline: true },
      { name: '👤 طلب من', value: `${song.user}`, inline: true }
    );
  if (song.thumbnail) embed.setThumbnail(song.thumbnail);
  queue.textChannel?.send({ embeds: [embed] });
});

distube.on('addSong', (queue, song) => {
  queue.textChannel?.send({
    embeds: [new EmbedBuilder().setColor('#5865F2')
      .setDescription(`✅ أُضيفت **${song.name}** للقائمة (رقم ${queue.songs.length})`)]
  });
});

distube.on('error', (channel, error) => {
  console.error('DisTube Error:', error);
  channel?.send({ embeds: [errorEmbed(`❌ خطأ: ${error.message}`)] });
});

distube.on('finish', (queue) => {
  queue.textChannel?.send({
    embeds: [new EmbedBuilder().setColor('#FF6B6B').setDescription('✅ انتهت الأغاني. أضف المزيد بـ `!play`')]
  });
});

distube.on('empty', (queue) => {
  queue.textChannel?.send({
    embeds: [new EmbedBuilder().setColor('#FFA500').setDescription('👋 القناة فارغة، غادرت.')]
  });
});

client.login(process.env.DISCORD_TOKEN);
