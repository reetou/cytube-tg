import socketClient from "socket.io-client"
import tgBot from "node-telegram-bot-api"
import nodeRedis from "redis"
import ent from "ent"
import moment from "moment"
import "colors"

const
  config = require("./config.json"),
  client = socketClient.connect(config.url),
  token = config.token,
  bot = new tgBot(token, { polling: true }),
  redis = nodeRedis.createClient()

console.log("Initializing...".yellow)
if (!config.url) {
  console.log("ERROR: Please add cytube or fork url to your config.json file.".red)
  process.exit()
} else {
  console.log(`Url: OK. ${config.url}`.magenta)
}
if (!config.telegram) {
  console.log("ERROR: Please add telegram channel to your config.json file.".red)
  process.exit()
} else {
  console.log(`Telegram: OK. ${config.telegram}`.magenta)
}
if (!config.room) {
  console.log("ERROR: Please add room name to your config.json file.".red)
  process.exit()
} else {
  console.log(`Room: OK. ${config.room}`.magenta)
}
if (!config.username || !config.password) {
  console.log("No account provided, join room as anonymous".magenta)
} else {
  console.log(`Account: OK. ${config.username}`.magenta)
}
if (!config.consoleMessages) {
  console.log("Msgs in console: DISABLED")
} else {
  console.log("Msgs in console: ENABLED")
}
console.log(`Started.`.green)

function handleMessage(message, msgForTg, time) {
  redis.get(time, (err, reply) => {
    if (err) {
      console.log(err)
      return false
    }
    if (reply === null) {
      // by null we mean that this message doesnt exist in redis and we can send it to telegram
      if (config.consoleMessages) {
        console.log(`${message} is null, not exists, will send to telegram`)
      }
      // save in redis by time to prevent shit like encoding
      redis.set(time, message)
      if (config.consoleMessages) {
        console.log(`set < ${message} > as < ${time} > in redis`.yellow)
      }
      bot.sendMessage(config.telegram, msgForTg)
      return true
    } else {
      // if exists we return false and dont send it to telegram
      return false
    }
  })
}

client.on("connect", () => {
  console.log(`connected to ${config.url}`)
  client.on("chatMsg", data => {
    let time = moment(data.time).format("DD MMM YYYY hh:mm a")
    let message = `[${data.time}] ${data.username}: ${data.msg}`
    let msgForTg = `[${time}] ${data.username}: ${ent.decode(data.msg)}`
    if (config.username && config.password) {
      if (data.username !== config.username && data.username !== "[server]") {
        handleMessage(message, msgForTg, data.time)
      }
    } else {
      handleMessage(message, msgForTg, data.time)
    }
  })
  client.on("disconnect", () => {
    console.log(`disconnected from synchtube, closing bot process...`)
    process.exit()
  })
})
if (config.room) {
  client.emit("joinChannel", {
    name: config.room
  })
}
bot.onText(/./, msg => console.log(`msg`, msg))
if (config.username && config.password) {
  client.emit("login", {
    name: config.username,
    pw: config.password
  })
}
client.on("error", err => console.log(`Error with cytube:`, err))