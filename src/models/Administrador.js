import { Schema, model } from 'mongoose'
import bcrypt from 'bcryptjs'

const administradorSchema = new Schema({
  nombre: {
    type: String,
    require: true,
    trim: true
  },
  apellido: {
    type: String,
    require: true,
    trim: true
  },
  direccion: {
    type: String,
    trim: true,
    default: null
  },
  telefono: {
    type: String,
    trim: true,
    default: null
  },
  email: {
    type: String,
    require: true,
    trim: true,
    unique: true
  },
  password: {
    type: String,
    require: true
  },
  token: {
    type: String,
    default: null
  },
  rol: {
    type: String,
    default: "administrador"
  }
}, { timestamps: true })

administradorSchema.methods.encrypPassword = async function (password) {
  const salt = await bcrypt.genSalt(10)
  const passwordEncryp = await bcrypt.hash(password, salt)
  return passwordEncryp
}

administradorSchema.methods.matchPassword = async function (password) {
  const response = await bcrypt.compare(password, this.password)
  return response
}

administradorSchema.methods.crearToken = function () {
  const tokenGenerado = this.token = Math.random().toString(32).slice(2)
  return tokenGenerado
}

export default model('Administrador', administradorSchema)