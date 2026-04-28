import QuejaSugerencias from "../models/Quejas_Sugerencias.js"
// Listar todas las quejas/sugerencias
const listarTodasQuejasSugerencias = async (req, res) => {
  try {
    const quejas = await QuejaSugerencias.find()
      .populate("usuario", "nombre apellido email")
      .populate("arrendatarioId", "nombre apellido email")
      .populate("departamento", "titulo direccion");
    res.status(200).json(quejas);
  } catch (error) {
    res.status(500).json({ msg: "Error al listar quejas/sugerencias", error });
  }
};


import Administrador from "../models/Administrador.js"
import Estudiante from "../models/Estudiante.js"
import Arrendatario from "../models/Arrendatario.js"
import { crearTokenJWT } from "../middlewares/JWT.js"
import mongoose from "mongoose"
import { sendMailToRegister, sendMailToRecoveryPassword, sendWelcomeMailArrendatario } from "../config/nodemailer.js"

// Listar arrendatarios con confirmEmail en false
const listarArrendatariosNoConfirmados = async (req, res) => {
  try {
    const arrendatarios = await Arrendatario.find({ confirmEmail: false }).select("-createdAt -updatedAt -__v");
    res.status(200).json(arrendatarios);
  } catch (error) {
    res.status(500).json({ msg: "Error al listar arrendatarios no confirmados", error });
  }
};

// Cambiar confirmEmail de arrendatario a true por id, asignar password igual al email y enviar correo de bienvenida
const confirmarArrendatarioPorAdmin = async (req, res) => {
  try {
    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ msg: "ID de arrendatario no válido" });
    }
    const arrendatario = await Arrendatario.findById(id);
    if (!arrendatario) {
      return res.status(404).json({ msg: "Arrendatario no encontrado" });
    }
    if (arrendatario.confirmEmail) {
      return res.status(200).json({ msg: "El usuario ya está habilitado", arrendatario });
    }
    arrendatario.confirmEmail = true;
    // Asignar password igual al email y encriptar
    arrendatario.password = await arrendatario.encrypPassword(arrendatario.email);
    await arrendatario.save();

    // Responde primero al cliente
    res.status(200).json({ msg: "Arrendatario confirmado correctamente y credenciales enviadas", arrendatario });

    // Luego intenta enviar el correo en segundo plano
    sendWelcomeMailArrendatario(
      arrendatario.email,
      arrendatario.nombre || arrendatario.email,
      arrendatario.email
    ).catch(mailError => {
      console.error("Error enviando correo de bienvenida:", mailError);
    });

  } catch (error) {
    res.status(500).json({ msg: "Error al confirmar arrendatario", error: error.message });
  }
};
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

// Actualizar perfil del administrador
const actualizarPerfilAdministrador = async (req, res) => {
  try {
    const { id } = req.params;
    const { nombre, apellido, direccion, telefono } = req.body;
    if (!mongoose.Types.ObjectId.isValid(id))
      return res.status(404).json({ msg: `Debe ser un id válido` });
    const adminBDD = await Administrador.findById(id);
    if (!adminBDD)
      return res.status(404).json({ msg: `No existe el administrador ${id}` });
    adminBDD.nombre = nombre ?? adminBDD.nombre;
    adminBDD.apellido = apellido ?? adminBDD.apellido;
    adminBDD.direccion = direccion ?? adminBDD.direccion;
    adminBDD.telefono = telefono ?? adminBDD.telefono;
    await adminBDD.save();
    res.status(200).json(adminBDD);
  } catch (error) {
    res.status(500).json({ msg: "Error al actualizar el administrador", error: error.message });
  }
};

// --- Recuperación y actualización de contraseña para Administrador ---
const recuperarPasswordAdministrador = async (req, res) => {
  const { email } = req.body;
  if (Object.values(req.body).includes("")) return res.status(404).json({ msg: "Lo sentimos, debes llenar todos los campos" });
  const adminBDD = await Administrador.findOne({ email });
  if (!adminBDD) return res.status(404).json({ msg: "Lo sentimos, el usuario no se encuentra registrado" });
  const token = adminBDD.crearToken();
  adminBDD.token = token;
  await sendMailToRecoveryPassword(email, token);
  await adminBDD.save();
  res.status(200).json({ msg: "Revisa tu correo electrónico para reestablecer tu contraseña" });
};

const comprobarTokenPasswordAdministrador = async (req, res) => {
  const { token } = req.params;
  const adminBDD = await Administrador.findOne({ token });
  if (adminBDD?.token !== req.params.token) return res.status(404).json({ msg: "Lo sentimos, no se puede validar la cuenta" });
  await adminBDD.save();
  res.status(200).json({ msg: "Token confirmado, ya puedes crear tu nuevo password" });
};

const crearNuevoPasswordAdministrador = async (req, res) => {
  const { password, confirmpassword } = req.body;
  if (Object.values(req.body).includes("")) return res.status(404).json({ msg: "Lo sentimos, debes llenar todos los campos" });
  if (password != confirmpassword) return res.status(404).json({ msg: "Lo sentimos, los passwords no coinciden" });
  const adminBDD = await Administrador.findOne({ token: req.params.token });
  if (adminBDD?.token !== req.params.token) return res.status(404).json({ msg: "Lo sentimos, no se puede validar la cuenta" });
  adminBDD.token = null;
  adminBDD.password = await adminBDD.encrypPassword(password);
  await adminBDD.save();
  res.status(200).json({ msg: "Felicitaciones, ya puedes iniciar sesión con tu nuevo password" });
};

const actualizarPasswordAdministrador = async (req, res) => {
  const adminBDD = await Administrador.findById(req.administradorBDD._id);
  if (!adminBDD) return res.status(404).json({ msg: `Lo sentimos, no existe el administrador` });
  const verificarPassword = await adminBDD.matchPassword(req.body.passwordactual);
  if (!verificarPassword) return res.status(404).json({ msg: "Lo sentimos, el password actual no es el correcto" });
  adminBDD.password = await adminBDD.encrypPassword(req.body.passwordnuevo);
  await adminBDD.save();
  res.status(200).json({ msg: "Password actualizado correctamente" });
}

const listarArrendatarios = async (req, res) => {
  try {
    const arrendatarios = await Arrendatario.find().select("-password -token -__v -createdAt -updatedAt");
    res.status(200).json(arrendatarios);
  } catch (error) {
    res.status(500).json({ msg: "Error al listar arrendatarios", error: error.message });
  }
};

export {
  registro,
  login,  
  perfil,
  listarArrendatarios,
  // CRUD para Estudiante
  registrarEstudiante,
  listarEstudiantes,
  actualizarEstudiante,
  eliminarEstudiante,
  registroArrendatario,
  listarArrendatariosNoConfirmados,
  confirmarArrendatarioPorAdmin,
  actualizarPasswordAdministrador,
  recuperarPasswordAdministrador,
  comprobarTokenPasswordAdministrador,
  crearNuevoPasswordAdministrador,
  actualizarPerfilAdministrador,
  listarTodasQuejasSugerencias
}