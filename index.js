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

    servidores[guild.id] = { // cria um servidor se não existir
        connection: null, // conexão
        dispatcher: null, // isso é o que vai tocar
        queue: [], // isso é a fila de músicas
        playingNow: false, // isso é se está tocando alguma música
    }

    saveServer(guild.id); // salva o servidor
});

client.on("ready", () => {
    // quando o bot estiver pronto
    loadServers(); // carrega os servidores
    console.log("Estou pronto!");
});

client.on("message", async (msg) => {
  //filtro de mensagens

  if (!msg.guild) return; // se não for uma mensagem de servidor, retorna

  if (!msg.content.startsWith(prefix)) return; //se não for uma mensagem com o prefixo, retorna

  if (!msg.member.voice.channel) {
    msg.channel.send("Se não ta em um canal 🦧");
    return; // se não estiver em um canal de voz, retorna
  }
  //comandos
  if (msg.content === prefix + "j") {
    // .j
    try {
      // tenta
      servidores[msg.guild.id].connection = await msg.member.voice.channel.join(); // espera o comando ser executado e então conecta
    } catch (err) {
      // se der erro
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
    let oQueTocar = msg.content.slice(3); // pega o que está depois do comando

    if (oQueTocar.length === 0) {
      // se não tiver nada depois do comando
      msg.channel.send("Você tem que digitar algo corno 🐂"); // manda uma mensagem
      return;
    }

    if (servidores[msg.guild.id].connection === null) {
      // se não estiver conectado ao canal de voz, ele entra
      try {
        servidores[msg.guild.id].connection = await msg.member.voice.channel.join();
      } catch (err) {
        console.log("'Erro ao entra no canal de voz!");
        console.log(err);
      }
    }

    if (ytdl.validateURL(oQueTocar)) {
      // se o que está depois do comando for uma url válida
      servidores[msg.guild.id].queue.push(oQueTocar); // adiciona a fila
      console.log("Adicionado: " + oQueTocar);
      playMusics(msg);
    } else {
      youtube.search.list(
        {
          // se não for uma url válida, procura na api do youtube
          q: oQueTocar, // Search query
          part: "snippet", //pedaço de informação de cada vídeo
          fields: "items(id(videoId), snippet(title, channelTitle))", //campos que quero que retorne
          type: "video", //tipo de pesquisa
        },
        function (err, result) {
          if (err) {
            console.log(err);
          }

          if (result) {
            // se tiver resultado
            const listResult = [];

            //organiza nossos resultados da pesquisa
            for (let i in result.data.items) {
              // para cada item
              const createItem = {
                // cria um objeto
                titleVideo: result.data.items[i].snippet.title, // titulo do vídeo
                channelTitle: result.data.items[i].snippet.channelTitle, // canal do vídeo
                videoId:
                  "https://www.youtube.com/watch?v=" +
                  result.data.items[i].id.videoId, // id do vídeo
                urlVideo: "https://www.youtube.com/watch?v=" + result.data.items[i].id.videoId, // url do vídeo
              };

              listResult.push(createItem); // adiciona o objeto a lista
            }

            // construindo a mensagem de Embed
            const embed = new Discord.MessageEmbed() // cria um embed
              .setColor([194, 90, 1]) // cor do embed
              .setAuthor("🎶 R3ɳ3ɠ Sounds 🎶") // titulo do embed
              .setDescription("🎵 Escolha uma música de 1-5 🎵"); // descrição do embed

            // adiciona campos para cada resultado da lista
            for (let i in listResult) {
              // para cada resultado
              embed.addField(
                // adiciona um campo
                `${parseInt(i) + 1}: ${listResult[i].titleVideo}`, // titulo do campo
                `${listResult[i].channelTitle}` // canal do campo
              );
            }

            msg.channel
              .send(embed) // envia o embed
              .then((embedMessage) => {
                // quando envia o embed
                const reactions = ["1️⃣", "2️⃣", "3️⃣", "4️⃣", "5️⃣"]; // lista de reações

                //reage na mensagem para cada emoji que escolhemos
                for (let i = 0; i < reactions.length; i++) {
                  // for(let i in reactions) são a mesma coisa
                  embedMessage.react(reactions[i]); // reage na mensagem
                }

                const filter = (reaction, user) => {
                  // filtro de reações
                  return (
                    reactions.includes(reaction.emoji.name) && // se a reação for uma das escolhidas
                    user.id === msg.author.id
                  ); // e o usuário for o mesmo que enviou a mensagem que enviou a reação retorna true, senão false
                };

                embedMessage
                  .awaitReactions(filter, {
                    max: 1,
                    time: 30000,
                    errors: ["time"],
                  }) // espera por uma reação e filtra as reações que foram escolhidas
                  .then((collected) => {
                    // quando tiver uma reação
                    const reaction = collected.first(); // pega a primeira reação
                    const idOption = reactions.indexOf(reaction.emoji.name); // pega o index da reação escolhida e armazena na variável idOption

                    msg.channel
                      .send(`🎵 Você escolheu: ${listResult[idOption].titleVideo} 
                                                              de ${listResult[idOption].channelTitle} 🎵`); // manda a mensagem com o que o usuário escolheu

                    servidores[msg.guild.id].queue.push(listResult[idOption].videoId); // adiciona a fila
                    for (let i in servidores[msg.guild.id].queue) {
                      msg.channel.send(
                        `🎵 ${parseInt(i) + 1} - ${listResult[i].titleVideo } - ${listResult[i].urlVideo}`
                        
                      );
                      return;
                    }

                    playMusics(msg); // toca a música
                  })
                  .catch((err) => {
                    msg.reply("Você não escolheu nenhuma música macaco 🦧"); // manda uma mensagem de erro
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
    servidores[msg.guild.id].dispatcher.end(); // para a música atual e vai para a proxima
    // mostra a nova música
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
    // se não estiver tocando nada

    const playNow = servidores[msg.guild.id].queue[0]; // pega a primeira música da fila
    servidores[msg.guild.id].playingNow = true; // está tocando
    servidores[msg.guild.id].dispatcher = servidores[msg.guild.id].connection.play(
      ytdl(playNow)
    ); // toca a música

    servidores[msg.guild.id].dispatcher.on("finish", () => {
      // quando terminar
      servidores[msg.guild.id].queue.shift(); // remove a primeira música da fila
      servidores[msg.guild.id].playingNow = false; // não está tocando
      if (servidores[msg.guild.id].queue.length > 0) {
        // se a fila tiver mais de uma música
        playMusics(msg); // roda a função novamente
      } else {
        servidores[msg.guild.id].dispatcher = null; // se não tiver mais nada, ele não está tocando nada
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

client.login(configs.TOKEN_DISCORD); // login do bot
