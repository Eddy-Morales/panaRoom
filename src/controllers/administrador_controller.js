
import Administrador from "../models/Administrador.js"
import Estudiante from "../models/Estudiante.js"
import Arrendatario from "../models/Arrendatario.js"
import { crearTokenJWT } from "../middlewares/JWT.js"
import mongoose from "mongoose"
import { sendMailToRegister, sendMailToRecoveryPassword } from "../config/nodemailer.js"

const registro = async (req, res) => {
  const { email, password } = req.body
  if (Object.values(req.body).includes("")) return res.status(400).json({ msg: "todos los campos son obligatorios" })
  const administradorEmailBDD = await Administrador.findOne({ email })
  if (administradorEmailBDD) return res.status(400).json({ msg: "el Email ya está registrado" })
  const nuevoAdministrador = new Administrador(req.body)
  nuevoAdministrador.password = await nuevoAdministrador.encrypPassword(password)
  await nuevoAdministrador.save()
  res.status(200).json({ msg: "Usuario registrado correctamente" })

  console.log("Administrador registrado:")
}



const login = async (req, res) => {
  const { email, password } = req.body
  if (Object.values(req.body).includes("")) return res.status(400).json({ msg: "Lo sentimos, debes llenar todos los campos" })
  const administradorBDD = await Administrador.findOne({ email }).select("-status -__v -token -updatedAt -createdAt")
  if (administradorBDD?.confirmEmail === false) return res.status(401).json({ msg: "Lo sentimos, debe verificar su cuenta, antes de iniciar sesión" })
  if (!administradorBDD) return res.status(404).json({ msg: "Lo sentimos, el usuario no se encuentra registrado" })
  const verificarPassword = await administradorBDD.matchPassword(password)
  if (!verificarPassword) return res.status(401).json({ msg: "Lo sentimos, la contraseña es incorrecta" })
  const { nombre, apellido, direccion, telefono, _id, rol } = administradorBDD
  const token = crearTokenJWT(administradorBDD._id, administradorBDD.rol)

  res.status(200).json({ token, rol, nombre, apellido, direccion, telefono, _id })
}


const perfil =(req,res)=>{
    const {token,createdAt,updatedAt,__v,...datosPerfil} = req.administradorBDD
    res.status(200).json(datosPerfil)
}

export {
  registro,
  login,  
  perfil
  ,
  // CRUD para Estudiante
  registrarEstudiante,
  listarEstudiantes,
  actualizarEstudiante,
  eliminarEstudiante,

  registroArrendatario
}

// --- CRUD para Estudiante ---
// Crear estudiante
const registrarEstudiante = async (req, res) => {
  const { email, password } = req.body;
  if (Object.values(req.body).includes("")) return res.status(400).json({ msg: "Todos los campos son obligatorios" });
  const estudianteEmailBDD = await Estudiante.findOne({ email });
  if (estudianteEmailBDD) return res.status(400).json({ msg: "El Email ya está registrado" });
  const nuevoEstudiante = new Estudiante(req.body);
  if (password) {
    nuevoEstudiante.password = await nuevoEstudiante.encrypPassword(password);
  }
  const token = nuevoEstudiante.crearToken();
  await nuevoEstudiante.save();
  res.status(200).json({ msg: "Estudiante registrado correctamente" });
};

// Listar estudiantes
const listarEstudiantes = async (req, res) => {
  try {
    const estudiantes = await Estudiante.find().select("-createdAt -updatedAt -__v");
    res.status(200).json(estudiantes);
  } catch (error) {
    res.status(500).json({ mensaje: "Error al listar estudiantes", error });
  }
};

// Actualizar estudiante
const actualizarEstudiante = async (req, res) => {
  try {
    const { id } = req.params;
    const { nombre, apellido, direccion, celular, email } = req.body;
    if (!mongoose.Types.ObjectId.isValid(id))
      return res.status(404).json({ msg: `Debe ser un id válido` });
    const estudianteBDD = await Estudiante.findById(id);
    if (!estudianteBDD)
      return res.status(404).json({ msg: `No existe el estudiante ${id}` });
    if (email && estudianteBDD.email !== email) {
      const estudianteBDDMail = await Estudiante.findOne({ email });
      if (estudianteBDDMail) {
        return res.status(404).json({ msg: `El email ya se encuentra registrado` });
      }
    }
    estudianteBDD.nombre = nombre ?? estudianteBDD.nombre;
    estudianteBDD.apellido = apellido ?? estudianteBDD.apellido;
    estudianteBDD.direccion = direccion ?? estudianteBDD.direccion;
    estudianteBDD.celular = celular ?? estudianteBDD.celular;
    estudianteBDD.email = email ?? estudianteBDD.email;
    await estudianteBDD.save();
    res.status(200).json(estudianteBDD);
  } catch (error) {
    res.status(500).json({ msg: "Error al actualizar el estudiante", error: error.message });
  }
};

// Eliminar estudiante
const eliminarEstudiante = async (req, res) => {
  try {
    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id))
      return res.status(404).json({ msg: `Debe ser un id válido` });
    const estudianteBDD = await Estudiante.findById(id);
    if (!estudianteBDD)
      return res.status(404).json({ msg: `No existe el estudiante ${id}` });
    await estudianteBDD.deleteOne();
    res.status(200).json({ msg: "Estudiante eliminado correctamente" });
  } catch (error) {
    res.status(500).json({ msg: "Error al eliminar el estudiante", error: error.message });
  }
};


//arendatario
const registroArrendatario = async (req, res) => {
  const { email, password } = req.body
  if (Object.values(req.body).includes("")) return res.status(400).json({ msg: "todos los campos son obligatorios" })
  const arrendatarioEmailBDD = await Arrendatario.findOne({ email })
  if (arrendatarioEmailBDD) return res.status(400).json({ msg: "el Email ya está registrado" })
  const nuevoArrendatario = new Arrendatario(req.body)
  nuevoArrendatario.password = await nuevoArrendatario.encrypPassword(password)
  const token = nuevoArrendatario.crearToken()
  await sendMailToRegister(email, token)
  await nuevoArrendatario.save()
  res.status(200).json({ msg: "Revisa tu correo electrónico para confirmar tu cuenta" })
}
