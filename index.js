module.exports=function(token,firetoken){
  let Discord = require("discord.js");
  Discord.Channel.prototype.svg = function(data){
    return this.send(new Discord.MessageAttachment("https://svg.thei5pro.repl.co/svg.png?svg="+encodeURIComponent(data))) //SVG API
  }
  let assetFor = a=>require("asset-js")(require("asset-js-firestore")(a,firetoken));
  let user = assetFor("users");
  let guild = assetFor("guilds");
  let bot = new Discord.Client();
  bot.Discord = Discord;
  Discord.Message.prototype.replyWith = Discord.Message.prototype.reply
  Discord.Message.prototype.reply = async function reply(content, options) {
    const mentionRepliedUser = typeof ((options || content || {}).allowedMentions || {}).repliedUser === "undefined" ? true : ((options || content).allowedMentions).repliedUser;
    delete ((options || content || {}).allowedMentions || {}).repliedUser;
    const apiMessage = content instanceof APIMessage ? content.resolveData() : APIMessage.create(this.channel, content, options).resolveData();
    Object.assign(apiMessage.data, { message_reference: { message_id: this.id } });
    if (!apiMessage.data.allowed_mentions || Object.keys(apiMessage.data.allowed_mentions).length === 0) apiMessage.data.allowed_mentions = { parse: ["users", "roles", "everyone"] };
    if(typeof apiMessage.data.allowed_mentions.replied_user === "undefined") Object.assign(apiMessage.data.allowed_mentions, { replied_user: mentionRepliedUser });
    if (Array.isArray(apiMessage.data.content)) {
      return Promise.all(apiMessage.split().map(x => {
        x.data.allowed_mentions = apiMessage.data.allowed_mentions;
        return x;
      }).map(this.inlineReply.bind(this)));
    }
    const { data, files } = await apiMessage.resolveFiles();
    return this.client.api.channels[this.channel.id].messages.post({ data, files }).then(d => this.client.actions.MessageCreate.handle(d).message);
  }
  bot.assets = {user, guild, save(){
    return Promise.all([
      user.save(),
      guild.save()
    ])
  }}
  let ai = new (require('alexa-bot-api'))();
  ai = ai.getReply.bind(ai);
  bot.ai = ai;
  bot.assetFor = assetFor
  bot.login(token);
  function cmd(reg, hd){
    let res = []
    reg.replace(/(?:[\w_-]+(?:\|[\w_-]+)*|:(:?[\w_-]*))(\??)/g,(a,c,o)=>{
      let thing;
      if(typeof c=="string"){
        thing = cmd.typeregs[c]
        if(c[0]==":"&&!thing&&cmd.typeregs[c.slice(1)]) thing = [new RegExp("(?:"+cmd.typeregs[c.slice(1)][0].source+")(?: "+cmd.typeregs[c.slice(1)][0].source+")*",cmd.typeregs[c.slice(1)][0].flags+"g"),a=>a.map(cmd.typeregs[c.slice(1)][1]),1];
        else if(!thing) thing = [/\S+/,a=>a]
      }else{
        thing = [new RegExp(a),a=>a]
      }
      if(o)thing[2]|=2
      res.push(thing)
    })
    cmd.stack.push([hd,...res])
    return bot;
  }
  bot.cmd = cmd;
  bot.msg = function(reg,hd){
    Object.defineProperty(hd,"__prefixless",{enumerable:false,value:true})
    return bot.cmd(reg,hd)
  }
  bot.cmd.stack = []
  bot.cmd.typeregs = {};
  bot.type = function(name, reg, parser){
    name = name.replace(/[^\w_-]/g,"");
    if(cmd.typeregs[name])throw new Error("'"+name+"' is an already registered type. Please use a different name.")
    cmd.typeregs[name] = [new RegExp("(?:"+(reg.source||reg)+")(?= |$)"),parser]
  }
  let pr = "!", rp = null, ph="Oops, an error occured. Here's the error: ```js\n$0\n```";
  bot.set = function(a){
    pr = a.prefix || pr
    rp = a.pingHint || rp
    ph = a.errorHint || ph
    return bot;
  }
  let json = a => {try{return JSON.parse(a)}catch(e){return null}}
  bot.type("int",/\d+/, a=>+a)
  bot.type("num",/-?\d+(\.\d*)?(e[+-]?\d+)?|-?\.\d+/, a=>+a)
  bot.type("bool",/true|false|yes|no|1|0/i,a=>"tyTY1".includes(a[0]))
  bot.type("str",/"([^\\"]|\\.)+"|\S+/,a=>a[0]=='"'?JSON.parse(a):a)
  bot.type("", /[^]*/,a=>a)
  bot.type("user", /<@!?\d{11,20}>|\d+|.+/,async (a)=>{
    if(+a||a.match(/<@!?\d+>/)){
      a = a.match(/<@!?(\d+)>|/)[1] || a
      try{return bot.users.cache.get(a)||await bot.users.fetch(a)}catch(e){return null}
    }else{
      a = a[0]=='"'?json(a):a
      a = bot.users.cache.filter(b=>b.username.toLowerCase().startsWith(a.toLowerCase()))
      return a.size==1?a.first():null
    }
  })
  bot.type("member", /<@!?\d{11,20}>|\d+|.+/,async (a,msg)=>{
    if(+a||a.match(/<@!?\d+>/)){
      a = a.match(/<@!?(\d+)>|/)[1] || a
      try{return msg.guild.members.cache.get(a)||await msg.guild.members.fetch(a)}catch(e){return null}
    }else{
      a = a[0]=='"'?json(a):a
      a = msg.guild.members.cache.filter(b=>(b.nickname||b.user.username).toLowerCase().startsWith(a.toLowerCase()))
      return a.size==1?a.first():null
    }
  })
  bot.type("channel", /<#\d{11,20}>|\d+|.+/,async (a,msg)=>{
    if(+a||a.match(/<#\d+>/)){
      a = a.match(/<#(\d+)>|/)[1] || a
      try{return msg.guild.channels.cache.get(a)||await msg.guild.channels.fetch(a)}catch(e){return null}
    }else{
      a = a[0]=='"'?json(a):a
      a = msg.guild.channels.cache.filter(b=>b.name.toLowerCase().startsWith(a.toLowerCase())||b.name.toLowerCase().startsWith(a.toLowerCase().replace(/^#/,"")))
      return a.size==1?a.first():null
    }
  })
  bot.type("role", /<#\d{11,20}>|\d+|.+/,async (a,msg)=>{
    if(+a||a.match(/<#\d+>/)){
      a = a.match(/<#(\d+)>|/)[1] || a
      try{return msg.guild.roles.cache.get(a)||await msg.guild.roles.fetch(a)}catch(e){return null}
    }else{
      a = a[0]=='"'?json(a):a
      a = msg.guild.roles.cache.filter(b=>b.name.toLowerCase().startsWith(a.toLowerCase()))
      return a.size==1?a.first():null
    }
  })
  bot.on("message", async mg => {
    if(mg.author.bot || mg.webhookID)return
    if(mg.guild && !mg.guild.me.permissionsIn(mg.channel).has("SEND_MESSAGES"))return
    let m = mg.content.slice(pr.length);
    if(mg.content.match(new RegExp("^<@!?"+bot.id+">")))return mg.channel.send(rp||"Hey there, my prefix is `"+pr+"`").catch(e=>e)
    let calculated = false;
    let u, g, cx;
    a: for(var i of cmd.stack){
      if(!i[0].__prefixless && !mg.content.startsWith(pr))continue
      let pos = 0;
      let call = [mg]
      for(var q of i.slice(1)){
        let r = m.slice(pos).match(new RegExp("^(?:"+q[0].source+")(?= |$)",q[0].flags+"i")) || [""]
        if(r[0].length){
          pos += r[0].length + 1;
          r = await q[1](q[2]&1?r:r[0],mg)
          q[0].source.match(/[^\w_-]/) && call.push(r)
        }else if(q[2]&2){
          q[0].source.match(/[^\w_-]/) && call.push(undefined)
        }else continue a
      }
      if(pos < m.length)continue
      if(!calculated){
        u = await user(mg.author.id)
        g = mg.guild ? await guild(mg.guild.id) : null
        cx = {user:u,guild:g}
        calculated = true
      }
      try{if(!await i[0].apply(cx, call))break}catch(e){
        mg.channel.send(ph.replace("$0",e))
        break;
      }
    }
  });
  bot.on("ready", () => {
    console.log("\x1b[1A\x1b[2KLogged in as \x1b[36m"+bot.user.username+"\x1b[33m#"+bot.user.discriminator)
  });
  return bot;
}
