import connection from './database.js'
import app from './server.js'

import http from 'http'
import { Server } from 'socket.io'

connection()

const server = http.createServer(app)

const io = new Server(server, {
  cors: {
    origin: "https://panaroom.netlify.app",
    methods: ["GET", "POST"," PUT", "DELETE"],
    credentials: true
  }
})

io.on('connection', (socket) => {
  console.log("conexiòn establecida")
  console.log(socket)
  console.log('Usuario conectado', socket.id)

  socket.on('enviar-mensaje-front-back', (payload) => {
    socket.broadcast.emit('enviar-mensaje-front-back', payload)
  })

  socket.on('disconnect', () => {
    console.log('Usuario desconectado', socket.id)
  })
})

server.listen(app.get('port'), () => {
  console.log(`Server ok on http://localhost:${app.get('port')}`)
})