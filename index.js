const Discord = require("discord.js");
const ytdl = require("ytdl-core");
const client = new Discord.Client();
const configs = require("./config.json");
const google = require("googleapis");
const fs = require('fs');

const youtube = new google.youtube_v3.Youtube({
  version: "v3",
  auth: configs.GOOGLE_API_KEY,
});

const prefix = configs.PREFIX;

const servidores = [];

client.on("guildCreate", (guild) => {
    // quando entrar no servidor
    console.log('Id da Guild onde eu entrei: ' + guild.id);
    console.log('Nome da Guild onde eu entrei: ' + guild.name);

    servidores[guild.id] = { 
        connection: null, 
        dispatcher: null, 
        queue: [], 
        playingNow: false, 
    }

    saveServer(guild.id); 
});

client.on("ready", () => {
    // quando o bot estiver pronto
    loadServers(); // carrega os servidores
    console.log("Estou pronto!");
});

client.on("message", async (msg) => {
  // quando receber uma mensagem

  if (!msg.guild) return; 

  if (!msg.content.startsWith(prefix)) return; 

  if (!msg.member.voice.channel) {
    msg.channel.send("Se não ta em um canal 🦧");
    return; 
  }
  //comandos
  if (msg.content === prefix + "j") {
    // .j
    try {
      servidores[msg.guild.id].connection = await msg.member.voice.channel.join(); // espera o comando ser executado e então conecta
    } catch (err) {
      console.log("'Erro ao entra no canal de voz!");
      console.log(err);
    }
  }

  if (msg.content === prefix + "dc") {
    // .dc
    msg.member.voice.channel.leave();
    servidores[msg.guild.id].connection = null;
    servidores[msg.guild.id].dispatcher = null;
    servidores[msg.guild.id].queue = [];
    servidores[msg.guild.id].playingNow = false;
  }

  if (msg.content.startsWith(prefix + "p")) {
    // .p <link>
    let oQueTocar = msg.content.slice(3);

    if (oQueTocar.length === 0) {
      msg.channel.send("Você tem que digitar algo corno 🐂"); 
      return;
    }

    if (servidores[msg.guild.id].connection === null) {
      try {
        servidores[msg.guild.id].connection = await msg.member.voice.channel.join();
      } catch (err) {
        console.log("'Erro ao entra no canal de voz!");
        console.log(err);
      }
    }

    if (ytdl.validateURL(oQueTocar)) {
      servidores[msg.guild.id].queue.push(oQueTocar); 
      console.log("Adicionado: " + oQueTocar);
      playMusics(msg);
    } else {
      youtube.search.list(
        {
          q: oQueTocar, 
          part: "snippet",
          fields: "items(id(videoId), snippet(title, channelTitle))",
          type: "video",
        },
        function (err, result) {
          if (err) {
            console.log(err);
          }

          if (result) {
            const listResult = [];

            for (let i in result.data.items) {
              const createItem = {
                titleVideo: result.data.items[i].snippet.title, 
                channelTitle: result.data.items[i].snippet.channelTitle, 
                videoId:
                  "https://www.youtube.com/watch?v=" +
                  result.data.items[i].id.videoId, 
                urlVideo: "https://www.youtube.com/watch?v=" + result.data.items[i].id.videoId, 
              };

              listResult.push(createItem);
            }

            const embed = new Discord.MessageEmbed() 
              .setColor([194, 90, 1]) 
              .setAuthor("🎶 R3ɳ3ɠ Sounds 🎶") 
              .setDescription("🎵 Escolha uma música de 1-5 🎵"); 

            for (let i in listResult) {
              embed.addField(
                `${parseInt(i) + 1}: ${listResult[i].titleVideo}`, 
                `${listResult[i].channelTitle}`
              );
            }

            msg.channel
              .send(embed) 
              .then((embedMessage) => {
                const reactions = ["1️⃣", "2️⃣", "3️⃣", "4️⃣", "5️⃣"]; 

                for (let i = 0; i < reactions.length; i++) {
                  embedMessage.react(reactions[i]);
                }

                const filter = (reaction, user) => {
                  return (
                    reactions.includes(reaction.emoji.name) && 
                    user.id === msg.author.id
                  );
                };

                embedMessage
                  .awaitReactions(filter, {
                    max: 1,
                    time: 30000,
                    errors: ["time"],
                  }) 
                  .then((collected) => {
                    const reaction = collected.first(); 
                    const idOption = reactions.indexOf(reaction.emoji.name); 

                    msg.channel
                      .send(`🎵 Você escolheu: ${listResult[idOption].titleVideo} 
                                                              de ${listResult[idOption].channelTitle} 🎵`); 

                    servidores[msg.guild.id].queue.push(listResult[idOption].videoId);
                    for (let i in servidores[msg.guild.id].queue) {
                      msg.channel.send(
                        `🎵 ${parseInt(i) + 1} - ${listResult[i].titleVideo } - ${listResult[i].urlVideo}`
                        
                      );
                    }

                    playMusics(msg);
                  })
                  .catch((err) => {
                    msg.reply("Você não escolheu nenhuma música macaco 🦧");
                    console.log(err);
                  });
              });
          }
        }
      );
    }
  }

  if (msg.content === prefix + "s") {
    // .s
    servidores[msg.guild.id].dispatcher.end(); 
    for (let i in servidores[msg.guild.id].queue) {
      msg.channel.send(
        `A musica que está tocando é: ${
          servidores[msg.guild.id].queue[parseInt(i) + 1]
        }`
      );
      break;
    }
  }
});

const playMusics = (msg) => {
  if (servidores[msg.guild.id].playingNow === false) {

    const playNow = servidores[msg.guild.id].queue[0]; 
    servidores[msg.guild.id].playingNow = true; 
    servidores[msg.guild.id].dispatcher = servidores[msg.guild.id].connection.play(
      ytdl(playNow)
    );

    servidores[msg.guild.id].dispatcher.on("finish", () => {
      servidores[msg.guild.id].queue.shift(); 
      servidores[msg.guild.id].playingNow = false; 
      if (servidores[msg.guild.id].queue.length > 0) {
        playMusics(msg); 
      } else {
        servidores[msg.guild.id].dispatcher = null;
      }
    });
  }
};

const loadServers = () =>{
    fs.readFile("serverList.json", "utf8", (err, data) => {
        if(err){
            console.log('ERRO: 312 Ocorreu um erro ao ler registro de servidores.');
            console.log(err);
        } else{
            const readObj = JSON.parse(data);
            for(let i in readObj.servers){
                servidores[readObj.servers[i]] = {
                    connection: null,
                    dispatcher: null,
                    queue: [],
                    playingNow: false
                }
            }
        }
    });
}

const saveServer = (idNewServer) => {
    fs.readFile("serverList.json", "utf8", (err, data) => {
        if(err){
            console.log('ERRO: 666 Ocorreu um erro ao tentar ler o arquivo e salvar o servidor novo.');
            console.log(err);
        } else{
            const readObj = JSON.parse(data);
            readObj.servers.push(idNewServer);
            const writeObj = JSON.stringify(readObj);

            fs.writeFile("serverList.json", writeObj, 'utf8', () => {})
        }
    });
}

client.login(configs.TOKEN_DISCORD);
