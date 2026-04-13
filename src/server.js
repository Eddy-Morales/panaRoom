import express from 'express'
import dotenv from 'dotenv'
import cors from 'cors'



import routerArrendatarios from './routers/arrendatario_routes.js'
import routerAdministradores from './routers/administrador_routes.js'
import routerDepartamentos from './routers/depa_routes.js'
import routerEstudiantes from './routers/estudiante_routes.js'
import routerInvitado from './routers/invitado_routes.js'

import cloudinary from 'cloudinary'
import fileUpload from "express-fileupload"

import passport from "passport";
import "./config/passport.js";


const app = express()
dotenv.config()

// Inicializaciones

app.use(passport.initialize());

cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET
})


app.use(fileUpload({
    useTempFiles : true,
    tempFileDir : './uploads'
}))



app.set('port', process.env.PORT || 3000)

app.use(cors({
  origin: "https://panaroom.netlify.app",
  methods: ["GET", "POST", "PUT", "DELETE"],
  credentials: true
}))
app.use(express.json())




// Ruta base
app.get('/', (req, res) => {
  res.send("Server on")
})

// Rutas para arrendatarios
app.use('/api', routerArrendatarios) // http://localhost:3000/api

// ruta para administrador
app.use('/api', routerAdministradores) // http://localhost:3000/api


app.use('/api', routerDepartamentos) // http://localhost:3000/api
// rutas para estudiantes
app.use('/api', routerEstudiantes) // http://localhost:3000/api
// rutas públicas para invitados
app.use('/api/public', routerInvitado) // http://localhost:3000/api/public

// Ruta no encontrada
app.use((req, res) => res.status(404).send("Endpoint no encontrado - 404"))


export default app
