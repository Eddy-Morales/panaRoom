import mongoose from "mongoose";

const QuejaSugerenciasSchema = new mongoose.Schema({
 
  descripcion: {
    type: String,
    required: true,
    trim: true
  },
  usuario: {
    type: mongoose.Schema.Types.ObjectId,
    required: true, // ID del usuario (arrendatario o estudiante)
    ref: "Estudiante" // Cambia a "Arrendatario" si es necesario, o usa discriminadores si ambos
  },
  arrendatarioId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Arrendatario",
    required: false // Solo si aplica
  },
  departamento: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Departamento",
    required: true
  },
  estado: {
    type: Boolean,
    default: false
  },
  fecha: {
    type: Date,
    default: Date.now
  }
});

const QuejaSugerencias = mongoose.model("QuejaSugerencias", QuejaSugerenciasSchema);

export default QuejaSugerencias;