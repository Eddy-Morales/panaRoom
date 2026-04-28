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
  categoria: {
    type: String,
    enum: ['suit', 'departamento'],
    default: 'departamento',
    required: true
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
  alicuota: {
    type: Boolean,
    default: false
  },
  alicoutaMonto: {
    type: Number,
    default: null
  },
  mascotas: {
    type: Boolean,
    default: false,
    required: true

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
  },
  parqueadero: {
    type: Boolean,
    default: false // o true, según prefieras el valor por defecto
  },
  numParqueaderos: {
    type: Number,
    default: 0 
  }
}, {
  timestamps: true
});

export default model('Departamento', departamentoSchema);