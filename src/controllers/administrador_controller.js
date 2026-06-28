import QuejaSugerencias from "../models/Quejas_Sugerencias.js"



import Administrador from "../models/Administrador.js"
import Estudiante from "../models/Estudiante.js"
import Arrendatario from "../models/Arrendatario.js"
import Departamento from "../models/Departamento.js";

import { crearTokenJWT } from "../middlewares/JWT.js"
import mongoose from "mongoose"
import { sendMailToRegister, sendMailToRecoveryPassword, sendWelcomeMailArrendatario, sendMailToDeleteArrendatario} from "../config/nodemailer.js"

// Cambiar contraseña de un arrendatario por el administrador
const cambiarPasswordArrendatario = async (req, res) => {
  try {
    const { id } = req.params; // ID del arrendatario
    const { password } = req.body;
    if (!password) {
      return res.status(400).json({ msg: "El campo password es obligatorio" });
    }
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ msg: "ID de arrendatario no válido" });
    }
    const arrendatario = await Arrendatario.findById(id);
    if (!arrendatario) {
      return res.status(404).json({ msg: "Arrendatario no encontrado" });
    }
    arrendatario.password = await arrendatario.encrypPassword(password);
    await arrendatario.save();
    res.status(200).json({ msg: "Contraseña actualizada correctamente" });
  } catch (error) {
    res.status(500).json({ msg: "Error al actualizar la contraseña", error: error.message });
  }
};
// Listar todas las quejas/sugerencias
const listarTodasQuejasSugerencias = async (req, res) => {
  try {
    const { estado } = req.query;

    // Construimos el filtro dinámico
    const filtro = {};

    // Si viene el parámetro estado, lo aplicamos
    if (estado !== undefined) {
      // Convertimos string a boolean
      if (estado === "true") {
        filtro.estado = true;
      } else if (estado === "false") {
        filtro.estado = false;
      }
    }

    const quejas = await QuejaSugerencias.find(filtro)
      .populate("usuario", "nombre apellido email")
      .populate("arrendatarioId", "nombre apellido email")
      .populate("departamento", "titulo direccion");

    res.status(200).json(quejas);
  } catch (error) {
    res.status(500).json({ msg: "Error al listar quejas/sugerencias", error });
  }
};

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

  const { nombre, apellido, direccion, telefono, email, password } = req.body;

  // Validar campos vacíos
  if (Object.values(req.body).includes("")) {
    return res.status(400).json({
      msg: "Todos los campos son obligatorios"
    });
  }

  // Validar longitud de nombre
  if (nombre.length < 3 || nombre.length > 30) {
    return res.status(400).json({
      msg: "El nombre debe tener entre 3 y 30 caracteres"
    });
  }

  // Validar longitud de apellido
  if (apellido.length < 3 || apellido.length > 30) {
    return res.status(400).json({
      msg: "El apellido debe tener entre 3 y 30 caracteres"
    });
  }

  // Validar longitud de dirección
  if (direccion.length < 5 || direccion.length > 100) {
    return res.status(400).json({
      msg: "La dirección debe tener entre 5 y 100 caracteres"
    });
  }

  // Validar teléfono (solo números)
  if (!/^\d+$/.test(telefono)) {
    return res.status(400).json({
      msg: "El teléfono debe contener únicamente números"
    });
  }

  // Validar longitud de teléfono
  if (telefono.length !== 10) {
    return res.status(400).json({
      msg: "El teléfono debe tener 10 dígitos"
    });
  }

  // Validar email
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

  if (!emailRegex.test(email)) {
    return res.status(400).json({
      msg: "El correo electrónico no es válido"
    });
  }

  // Validar contraseña
  if (password.length < 8) {
    return res.status(400).json({
      msg: "La contraseña debe tener al menos 8 caracteres"
    });
  }

  const administradorEmailBDD = await Administrador.findOne({ email });

  if (administradorEmailBDD) {
    return res.status(400).json({
      msg: "El Email ya está registrado"
    });
  }

  const nuevoAdministrador = new Administrador(req.body);

  nuevoAdministrador.password =
    await nuevoAdministrador.encrypPassword(password);

  await nuevoAdministrador.save();

  res.status(200).json({
    msg: "Usuario registrado correctamente"
  });

  console.log("Administrador registrado:");
};



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

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(404).json({
        msg: "Debe ser un id válido"
      });
    }

    const adminBDD = await Administrador.findById(id);

    if (!adminBDD) {
      return res.status(404).json({
        msg: `No existe el administrador ${id}`
      });
    }

    // Validar nombre
    if (nombre !== undefined) {
      if (nombre.trim().length < 3 || nombre.trim().length > 30) {
        return res.status(400).json({
          msg: "El nombre debe tener entre 3 y 30 caracteres"
        });
      }
    }

    // Validar apellido
    if (apellido !== undefined) {
      if (apellido.trim().length < 3 || apellido.trim().length > 30) {
        return res.status(400).json({
          msg: "El apellido debe tener entre 3 y 30 caracteres"
        });
      }
    }

    // Validar dirección
    if (direccion !== undefined) {
      if (direccion.trim().length < 5 || direccion.trim().length > 100) {
        return res.status(400).json({
          msg: "La dirección debe tener entre 5 y 100 caracteres"
        });
      }
    }

    // Validar teléfono ecuatoriano
    if (telefono !== undefined) {
      if (!/^09\d{8}$/.test(telefono)) {
        return res.status(400).json({
          msg: "Ingrese un número telefónico válido"
        });
      }
    }

    adminBDD.nombre = nombre ?? adminBDD.nombre;
    adminBDD.apellido = apellido ?? adminBDD.apellido;
    adminBDD.direccion = direccion ?? adminBDD.direccion;
    adminBDD.telefono = telefono ?? adminBDD.telefono;

    await adminBDD.save();

    res.status(200).json(adminBDD);

  } catch (error) {
    res.status(500).json({
      msg: "Error al actualizar el administrador",
      error: error.message
    });
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

const cambiarDisponibilidadDepartamento = async (req, res) => {
  try {
    const { id } = req.params;
    const { disponible } = req.body; // true o false

    if (typeof disponible !== "boolean") {
      return res.status(400).json({ msg: "El campo 'disponible' debe ser booleano (true o false)" });
    }

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ msg: "ID de departamento no válido" });
    }

    const departamento = await Departamento.findById(id);
    if (!departamento) {
      return res.status(404).json({ msg: "Departamento no encontrado" });
    }

    departamento.disponible = disponible;
    await departamento.save();

    res.status(200).json({ msg: "Disponibilidad actualizada correctamente", departamento });
  } catch (error) {
    res.status(500).json({ msg: "Error al actualizar la disponibilidad", error: error.message });
  }
};
const cambiarEstadoQuejaSugerencia = async (req, res) => {
  try {
    // Permite recibir el id por params o por body
    const id = req.params.id || req.body.id;
    const { estado, comentarioUsuario } = req.body; // true o false, comentario opcional

    if (typeof estado !== "boolean") {
      return res.status(400).json({ msg: "El campo 'estado' debe ser booleano (true o false)" });
    }

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ msg: "ID de queja/sugerencia no válido" });
    }

    const queja = await QuejaSugerencias.findById(id);
    if (!queja) {
      return res.status(404).json({ msg: "Queja/Sugerencia no encontrada" });
    }

    queja.estado = estado;

    // Actualizar comentarioUsuario si se proporciona (opcional)
    if (comentarioUsuario !== undefined && comentarioUsuario !== null) {
      queja.comentarioUsuario = comentarioUsuario;
    }

    await queja.save();

    res.status(200).json({ msg: "Estado actualizado correctamente", queja });
  } catch (error) {
    res.status(500).json({ msg: "Error al actualizar el estado", error: error.message });
  }
};


const cambiarEstadoUsuario = async (req, res) => {
  try {
    const { id, tipo, status } = req.body; // status: true o false

    if (typeof status !== "boolean") {
      return res.status(400).json({
        msg: "El campo 'status' debe ser booleano (true o false)"
      });
    }

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ msg: "ID no válido" });
    }

    let usuario;

    if (tipo === "estudiante") {
      usuario = await Estudiante.findById(id);
    } else if (tipo === "arrendatario") {
      usuario = await Arrendatario.findById(id);
    } else {
      return res.status(400).json({ msg: "Tipo de usuario no válido" });
    }

    if (!usuario) {
      return res.status(404).json({ msg: "Usuario no encontrado" });
    }

    usuario.status = status;
    await usuario.save();

    res.status(200).json({
      msg: "Estado actualizado correctamente",
      usuario
    });
  } catch (error) {
    res.status(500).json({
      msg: "Error al actualizar el estado",
      error: error.message
    });
  }
};

const listarAdministradores = async (req, res) => {
  try {
    const administradores = await Administrador.find().select("-password -token -__v -createdAt -updatedAt");
    res.status(200).json(administradores);
  } catch (error) {
    res.status(500).json({ msg: "Error al listar administradores", error: error.message });
  }
};


const eliminarArrendatarioPorAdmin = async (req, res) => {
  try {
    const { id } = req.params;
    const { motivo } = req.body;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ msg: "ID de arrendatario no válido" });
    }

    if (!motivo || !motivo.trim()) {
      return res.status(400).json({ msg: "El motivo de eliminación es obligatorio" });
    }

    const arrendatario = await Arrendatario.findById(id);
    if (!arrendatario) {
      return res.status(404).json({ msg: "Arrendatario no encontrado" });
    }

    await sendMailToDeleteArrendatario(
      arrendatario.email,
      arrendatario.nombre || arrendatario.email,
      motivo.trim()
    );

    await Arrendatario.findByIdAndDelete(id);

    return res.status(200).json({
      msg: "Arrendatario eliminado correctamente después de enviar el correo"
    });
  } catch (error) {
    return res.status(500).json({
      msg: "No se pudo eliminar el arrendatario",
      error: error.message
    });
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
  listarTodasQuejasSugerencias,
  cambiarPasswordArrendatario,
  cambiarDisponibilidadDepartamento,
  cambiarEstadoQuejaSugerencia,
  cambiarEstadoUsuario,
  listarAdministradores,
  eliminarArrendatarioPorAdmin
}