import Arrendatario from "../models/Arrendatario.js"
import { sendMailToRegister, sendMailToRecoveryPassword } from "../config/nodemailer.js"

import { crearTokenJWT } from "../middlewares/JWT.js"
import mongoose from "mongoose"

import { v2 as cloudinary } from 'cloudinary';
import fs from 'fs-extra';

// Crear arrendatario sin autenticación ni token
const crearArrendatario = async (req, res) => {
  try {
    const { nombre, apellido, direccion, celular, email } = req.body;
    // Validar campos obligatorios
    if ([nombre, apellido, direccion, celular, email].some(campo => !campo || campo.trim() === "")) {
      return res.status(400).json({ msg: "Todos los campos son obligatorios" });
    }
    // Verificar si el email ya está registrado
    const existe = await Arrendatario.findOne({ email });
    if (existe) {
      return res.status(409).json({ msg: "El email ya está registrado" });
    }
    // Crear el arrendatario
    const nuevoArrendatario = new Arrendatario({ nombre, apellido, direccion, celular, email });
    await nuevoArrendatario.save();
    res.status(201).json({ msg: "Arrendatario creado exitosamente", arrendatario: nuevoArrendatario });
  } catch (error) {
    console.error("Error al crear arrendatario:", error);
    res.status(500).json({ msg: "Error al crear arrendatario", error: error.message });
  }
};




const recuperarPassword = async (req, res) => {
  const { email } = req.body
  if (Object.values(req.body).includes("")) return res.status(404).json({ msg: "Lo sentimos, debes llenar todos los campos" })
  const arrendatarioBDD = await Arrendatario.findOne({ email })
  if (!arrendatarioBDD) return res.status(404).json({ msg: "Lo sentimos, el usuario no se encuentra registrado" })
  const token = arrendatarioBDD.crearToken()
  arrendatarioBDD.token = token
  sendMailToRecoveryPassword(email, token)
  await arrendatarioBDD.save()
  res.status(200).json({ msg: "Revisa tu correo electrónico para reestablecer tu contraseña" })
}

const comprobarTokenPasword = async (req, res) => {
  const { token } = req.params
  const arrendatarioBDD = await Arrendatario.findOne({ token })
  if (arrendatarioBDD?.token !== req.params.token) return res.status(404).json({ msg: "Lo sentimos, no se puede validar la cuenta" })
  await arrendatarioBDD.save()
  res.status(200).json({ msg: "Token confirmado, ya puedes crear tu nuevo password" })
}

const crearNuevoPassword = async (req, res) => {
  const { password, confirmpassword } = req.body
  if (Object.values(req.body).includes("")) return res.status(404).json({ msg: "Lo sentimos, debes llenar todos los campos" })
  if (password != confirmpassword) return res.status(404).json({ msg: "Lo sentimos, los passwords no coinciden" })
  const arrendatarioBDD = await Arrendatario.findOne({ token: req.params.token })
  if (arrendatarioBDD?.token !== req.params.token) return res.status(404).json({ msg: "Lo sentimos, no se puede validar la cuenta" })
  arrendatarioBDD.token = null
  arrendatarioBDD.password = await arrendatarioBDD.encrypPassword(password)
  await arrendatarioBDD.save()
  res.status(200).json({ msg: "Felicitaciones, ya puedes iniciar sesión con tu nuevo password" })
}

const login = async (req, res) => {
  const { email, password } = req.body;
  if (Object.values(req.body).includes("")) {
    return res.status(400).json({ msg: "Lo sentimos, debes llenar todos los campos" });
  }

  const arrendatarioBDD = await Arrendatario.findOne({ email }).select("-status -__v -token -updatedAt -createdAt");
  if (!arrendatarioBDD) {
    return res.status(404).json({ msg: "Lo sentimos, el usuario no se encuentra registrado" });
  }

  if (!arrendatarioBDD.password) {
    return res.status(400).json({ msg: "Este usuario debe iniciar sesión con Google" });
  }

  if (arrendatarioBDD.confirmEmail === false) {
    return res.status(401).json({ msg: "Lo sentimos, debe verificar su cuenta, antes de iniciar sesión" });
  }

  const verificarPassword = await arrendatarioBDD.matchPassword(password);
  if (!verificarPassword) {
    return res.status(401).json({ msg: "Lo sentimos, la contraseña es incorrecta" });
  }

  const { nombre, apellido, direccion, celular, _id, rol } = arrendatarioBDD;
  const token = crearTokenJWT(arrendatarioBDD._id, arrendatarioBDD.rol);

  res.status(200).json({ token, rol, nombre, apellido, direccion, celular, _id });
};


const perfil =(req,res)=>{
		const {token,confirmEmail,createdAt,updatedAt,__v,...datosPerfil} = req.arrendatarioBDD
    res.status(200).json(datosPerfil)
}

const actualizarPerfil = async (req, res) => {
    try {
        const { id } = req.params;
        const { nombre, apellido, direccion, celular, email, profileImageOption } = req.body;
        
        if (!mongoose.Types.ObjectId.isValid(id)) 
            return res.status(404).json({ msg: `Lo sentimos, debe ser un id válido` });
        
        // No verificamos campos vacíos para permitir actualizaciones parciales
        
        const arrendatarioBDD = await Arrendatario.findById(id);
        if (!arrendatarioBDD) 
            return res.status(404).json({ msg: `Lo sentimos, no existe el arrendatario ${id}` });
        
        // Verificar si el email ya existe (solo si se está cambiando)
        if (email && arrendatarioBDD.email !== email) {
            const arrendatarioBDDMail = await Arrendatario.findOne({ email });
            if (arrendatarioBDDMail) {
                return res.status(404).json({ msg: `Lo sentimos, el email ya se encuentra registrado `});
            }
        }
        
        // Actualizar campos básicos
        arrendatarioBDD.nombre = nombre ?? arrendatarioBDD.nombre;
        arrendatarioBDD.apellido = apellido ?? arrendatarioBDD.apellido;
        arrendatarioBDD.direccion = direccion ?? arrendatarioBDD.direccion;
        arrendatarioBDD.celular = celular ?? arrendatarioBDD.celular;
        arrendatarioBDD.email = email ?? arrendatarioBDD.email;
        
        // Si se envió una opción de imagen de perfil, la guardamos
        if (profileImageOption) {
            arrendatarioBDD.avatarType = profileImageOption;
        }
        
        // Procesar la imagen subida
        if (profileImageOption === 'upload' && req.files && req.files.avatarArren) {
            // Si ya hay una imagen anterior, la eliminamos de Cloudinary
            if (arrendatarioBDD.avatarArrenID) {
                await cloudinary.uploader.destroy(arrendatarioBDD.avatarArrenID);
            }
            
            // Subir la nueva imagen
            const resultado = await cloudinary.uploader.upload(req.files.avatarArren.tempFilePath, {
                folder: "avataresArrendatario"
            });
            
            // Guardar datos de la nueva imagen
            arrendatarioBDD.avatarUrl = resultado.secure_url;
            arrendatarioBDD.avatarArrenID = resultado.public_id;
            
            // Eliminar archivo temporal
            await fs.remove(req.files.avatarArren.tempFilePath);
        } 
        // Procesar la imagen generada por IA
        else if (profileImageOption === 'ia' && req.body.avatarArrenIA) {
            // Si ya hay una imagen anterior, la eliminamos de Cloudinary
            if (arrendatarioBDD.avatarArrenID) {
                await cloudinary.uploader.destroy(arrendatarioBDD.avatarArrenID);
            }
            
            // Subir la imagen base64 a Cloudinary
            const resultado = await cloudinary.uploader.upload(req.body.avatarArrenIA, {
                folder: "avataresArrendatario"
            });
            
            // Guardar datos de la nueva imagen
            arrendatarioBDD.avatarUrl = resultado.secure_url;
            arrendatarioBDD.avatarArrenID = resultado.public_id;
        }
        
        // Guardar cambios en la base de datos
        await arrendatarioBDD.save();
        
        // Devolver el arrendatario actualizado
        res.status(200).json(arrendatarioBDD);
    } catch (error) {
        console.error("Error al actualizar perfil:", error);
        res.status(500).json({ msg: "Error al actualizar el perfil", error: error.message });
    }
};

const actualizarPassword = async (req,res)=>{
    const arrendatarioBDD = await Arrendatario.findById(req.arrendatarioBDD._id)
    if(!arrendatarioBDD) return res.status(404).json({msg:`Lo sentimos, no existe el veterinario ${id}`})
    const verificarPassword = await arrendatarioBDD.matchPassword(req.body.passwordactual)
    if(!verificarPassword) return res.status(404).json({msg:"Lo sentimos, el password actual no es el correcto"})
    arrendatarioBDD.password = await arrendatarioBDD.encrypPassword(req.body.passwordnuevo)
    await arrendatarioBDD.save()
    res.status(200).json({msg:"Password actualizado correctamente"})
}
const listarArrendatarios = async (req, res) => {
    try {
        const arrendatarios = await Arrendatario.find()
            .select("-createdAt -updatedAt -__v"); // Excluye campos internos

        res.status(200).json(arrendatarios);
    } catch (error) {
        res.status(500).json({ mensaje: "Error al listar arrendatarios", error });
    }
};


export {
  crearArrendatario,
  recuperarPassword,
  comprobarTokenPasword,
  crearNuevoPassword,
  login,
  perfil,
  actualizarPerfil,
  actualizarPassword,
  listarArrendatarios
}