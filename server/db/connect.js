const config = require('../config/config.js')
const mongoose = require('mongoose')

const mongo = config.mongo;
let url = `mongodb://${mongo.user}:${mongo.pwd}@${mongo.host}:${mongo.port}/${mongo.name}?authSource=admin`

module.exports.openDB = function() {
  // 连接数据库
  mongoose.connect(url, { useNewUrlParser: true })

  const db = mongoose.connection;

  db.on('error', () => {
    console.log('url', url)
    console.log('mongoDB connect error')
  })

  db.once('open', () => {
    console.log('mongoDB connect success')
  })

  return db
}


