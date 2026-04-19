import mongoose, { Schema, model } from 'mongoose';

const departamentoSchema = new Schema({
  titulo: {
    type: String,
    required: true,
    trim: true
  },
  descripcion: {
    type: String,
    required: true,
    trim: true
  },
  direccion: {
    type: String,
    required: true,
    trim: true
  },
  ciudad: {
    type: String,
    required: true,
    trim: true
  },
  precioMensual: {
    type: Number,
    required: true,
    min: 0
  },
  numeroHabitaciones: {
    type: Number,
    required: true,
    min: 1
  },
  numeroBanos: {
    type: Number,
    required: true,
    min: 1
  },
  disponible: {
    type: Boolean,
    default: true
  },
  serviciosIncluidos: {
    type: [String], // Ejemplo: ['Agua', 'Luz', 'Internet']
    default: []
  },
  urlMapa: {
    type: String,
    trim: true,
    default: null
  },
  imagenes: [{
  url: { type: String, required: true },
  public_id: { type: String, required: true }
}],
  arrendatario: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Arrendatario' // O 'Propietario', según tu modelo
  },
  estudiante: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Estudiante',
    default: null
  }
}, {
  timestamps: true
});

export default model('Departamento', departamentoSchema);