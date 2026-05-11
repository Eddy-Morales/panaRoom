import { Schema, model } from 'mongoose';

const chatUsuariosSchema = new Schema({
  administradorId: {
    type: Schema.Types.ObjectId,
    ref: 'Administrador',
    default: null
  },
  arrendatarioId: {
    type: Schema.Types.ObjectId,
    ref: 'Arrendatario',
    default: null
  },
  estudianteId: {
    type: Schema.Types.ObjectId,
    ref: 'Estudiante',
    default: null
  },
  remitente: {
    type: String,
    enum: ['administrador', 'arrendatario', 'estudiante'],
    required: true
  },
  mensaje: {
    type: String,
    required: true
  },
  fecha: {
    type: Date,
    default: Date.now
  },
  leido: {
    type: Boolean,
    default: false
  }
}, { timestamps: true });

export default model('ChatUsuarios', chatUsuariosSchema);