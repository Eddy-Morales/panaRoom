import QuejaSugerencias from "../models/Quejas_Sugerencias.js"
import Departamento from "../models/Departamento.js";


import Arrendatario from "../models/Arrendatario.js"
import { sendMailToRegister, sendMailToRecoveryPassword } from "../config/nodemailer.js"

import { crearTokenJWT } from "../middlewares/JWT.js"
import mongoose from "mongoose"

import { v2 as cloudinary } from 'cloudinary';
import fs from 'fs-extra';


// Obtener quejas y sugerencias de un departamento por arrendatario autenticado
const obtenerQuejasSugerenciasDepartamento = async (req, res) => {
  try {
    const arrendatarioId = req.arrendatarioBDD?._id;
    if (!arrendatarioId) {
      return res.status(401).json({ msg: "No autenticado" });
    }

    const Departamento = (await import("../models/Departamento.js")).default;

    const departamentos = await Departamento.find({ arrendatario: arrendatarioId }).select("_id titulo");
    if (!departamentos.length) {
      return res.status(404).json({ msg: "No tienes departamentos registrados" });
    }

    const idsDepartamentos = departamentos.map((dep) => dep._id);

    const comentarios = await QuejaSugerencias.find({ departamento: { $in: idsDepartamentos } })
      .populate("usuario", "nombre apellido email")
      .populate("departamento", "titulo")
      .sort({ fecha: -1 });

    res.status(200).json({
      departamentos,
      comentarios,
    });
  } catch (error) {
    res.status(500).json({ msg: "Error al obtener comentarios", error: error.message });
  }
};
// Crear arrendatario sin autenticación ni token
const crearArrendatario = async (req, res) => {
  try {
    console.log("Archivos recibidos en req.files:", req.files);

    const { nombre, apellido, direccion, celular, email } = req.body;

    // 1. Validar campos obligatorios
    if (
      [nombre, apellido, direccion, celular, email].some(
        campo => !campo || campo.trim() === ""
      )
    ) {
      return res.status(400).json({
        msg: "Todos los campos son obligatorios"
      });
    }

    // 2. Validar nombre
    if (nombre.trim().length < 3 || nombre.trim().length > 30) {
      return res.status(400).json({
        msg: "El nombre debe tener entre 3 y 30 caracteres"
      });
    }

    // 3. Validar apellido
    if (apellido.trim().length < 3 || apellido.trim().length > 30) {
      return res.status(400).json({
        msg: "El apellido debe tener entre 3 y 30 caracteres"
      });
    }

    // 4. Validar dirección
    if (direccion.trim().length < 5 || direccion.trim().length > 100) {
      return res.status(400).json({
        msg: "La dirección debe tener entre 5 y 100 caracteres"
      });
    }

    // 5. Validar celular ecuatoriano
    if (!/^09\d{8}$/.test(celular)) {
      return res.status(400).json({
        msg: "Ingrese un número celular ecuatoriano válido"
      });
    }

    // 6. Validar email
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

    if (!emailRegex.test(email)) {
      return res.status(400).json({
        msg: "El correo electrónico no es válido"
      });
    }

    // 7. Verificar si el email ya está registrado
    const existe = await Arrendatario.findOne({ email });

    if (existe) {
      return res.status(409).json({
        msg: "El email ya está registrado"
      });
    }

    // 8. Subir documentos a Cloudinary
    const imagenesDocumentos = [];

    if (req.files?.imagenesDocumentos) {
      const archivos = Array.isArray(req.files.imagenesDocumentos)
        ? req.files.imagenesDocumentos
        : [req.files.imagenesDocumentos];

      const formatosPermitidos = [
        "image/jpeg",
        "image/png",
        "image/jpg",
        "application/pdf"
      ];

      for (const archivo of archivos) {
        if (!formatosPermitidos.includes(archivo.mimetype)) {
          await fs.unlink(archivo.tempFilePath);

          return res.status(400).json({
            msg: `Formato no válido para el archivo '${archivo.name}'. Solo se permiten imágenes (JPG, PNG) y PDFs.`
          });
        }

        const { secure_url, public_id } =
          await cloudinary.uploader.upload(
            archivo.tempFilePath,
            {
              folder: "DocumentosArrendatario",
              resource_type: "auto"
            }
          );

        imagenesDocumentos.push({
          url: secure_url,
          public_id
        });

        await fs.unlink(archivo.tempFilePath);
      }
    }

    // 9. Crear arrendatario
    const nuevoArrendatario = new Arrendatario({
      nombre: nombre.trim(),
      apellido: apellido.trim(),
      direccion: direccion.trim(),
      celular: celular.trim(),
      email: email.trim().toLowerCase(),
      imagenesDocumentos
    });

    await nuevoArrendatario.save();

    return res.status(201).json({
      msg: "Datos enviados exitosamente, el administrador confirmará tu cuenta y sus credenciales serán enviadas a su correo",
      arrendatario: nuevoArrendatario
    });

  } catch (error) {
    console.error("Error al crear arrendatario:", error);

    // Limpieza de archivos temporales
    if (req.files?.imagenesDocumentos) {
      const archivos = Array.isArray(req.files.imagenesDocumentos)
        ? req.files.imagenesDocumentos
        : [req.files.imagenesDocumentos];

      for (const archivo of archivos) {
        if (await fs.pathExists(archivo.tempFilePath)) {
          await fs.unlink(archivo.tempFilePath).catch(() => {});
        }
      }
    }

    return res.status(500).json({
      msg: "Error al crear arrendatario",
      error: error.message
    });
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

        // Validar ID
        if (!mongoose.Types.ObjectId.isValid(id)) {
            return res.status(404).json({
                msg: "Lo sentimos, debe ser un id válido"
            });
        }

        // Buscar arrendatario
        const arrendatarioBDD = await Arrendatario.findById(id);

        if (!arrendatarioBDD) {
            return res.status(404).json({
                msg: `Lo sentimos, no existe el arrendatario ${id}`
            });
        }

        // ==========================
        // VALIDACIONES
        // ==========================

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

        // Validar celular ecuatoriano
        if (celular !== undefined) {
            if (!/^09\d{8}$/.test(celular)) {
                return res.status(400).json({
                    msg: "Ingrese un número celular válido"
                });
            }
        }

        // Validar email
        if (email !== undefined) {
            const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

            if (!emailRegex.test(email)) {
                return res.status(400).json({
                    msg: "El correo electrónico no es válido"
                });
            }
        }

        // Verificar si el email ya existe (solo si se está cambiando)
        if (
            email &&
            arrendatarioBDD.email.toLowerCase() !== email.toLowerCase()
        ) {
            const arrendatarioBDDMail = await Arrendatario.findOne({
                email: email.toLowerCase()
            });

            if (arrendatarioBDDMail) {
                return res.status(409).json({
                    msg: "Lo sentimos, el email ya se encuentra registrado"
                });
            }
        }

        // ==========================
        // ACTUALIZAR DATOS
        // ==========================

        arrendatarioBDD.nombre =
            nombre !== undefined ? nombre.trim() : arrendatarioBDD.nombre;

        arrendatarioBDD.apellido =
            apellido !== undefined ? apellido.trim() : arrendatarioBDD.apellido;

        arrendatarioBDD.direccion =
            direccion !== undefined ? direccion.trim() : arrendatarioBDD.direccion;

        arrendatarioBDD.celular =
            celular !== undefined ? celular.trim() : arrendatarioBDD.celular;

        arrendatarioBDD.email =
            email !== undefined
                ? email.trim().toLowerCase()
                : arrendatarioBDD.email;

        // ==========================
        // AVATAR
        // ==========================

        if (profileImageOption) {
            arrendatarioBDD.avatarType = profileImageOption;
        }

        // Imagen subida por el usuario
        if (
            profileImageOption === "upload" &&
            req.files &&
            req.files.avatarArren
        ) {
            // Eliminar imagen anterior
            if (arrendatarioBDD.avatarArrenID) {
                await cloudinary.uploader.destroy(
                    arrendatarioBDD.avatarArrenID
                );
            }

            const resultado = await cloudinary.uploader.upload(
                req.files.avatarArren.tempFilePath,
                {
                    folder: "avataresArrendatario"
                }
            );

            arrendatarioBDD.avatarUrl = resultado.secure_url;
            arrendatarioBDD.avatarArrenID = resultado.public_id;

            await fs.remove(req.files.avatarArren.tempFilePath);
        }

        // Imagen generada por IA
        else if (
            profileImageOption === "ia" &&
            req.body.avatarArrenIA
        ) {
            // Eliminar imagen anterior
            if (arrendatarioBDD.avatarArrenID) {
                await cloudinary.uploader.destroy(
                    arrendatarioBDD.avatarArrenID
                );
            }

            const resultado = await cloudinary.uploader.upload(
                req.body.avatarArrenIA,
                {
                    folder: "avataresArrendatario"
                }
            );

            arrendatarioBDD.avatarUrl = resultado.secure_url;
            arrendatarioBDD.avatarArrenID = resultado.public_id;
        }

        // ==========================
        // GUARDAR CAMBIOS
        // ==========================

        await arrendatarioBDD.save();

        return res.status(200).json(arrendatarioBDD);

    } catch (error) {
        console.error("Error al actualizar perfil:", error);

        return res.status(500).json({
            msg: "Error al actualizar el perfil",
            error: error.message
        });
    }
};

const actualizarPassword = async (req,res)=>{
    const arrendatarioBDD = await Arrendatario.findById(req.arrendatarioBDD._id)
    
    // CORRECCIÓN: Cambiar ${id} por ${req.arrendatarioBDD._id}
    if(!arrendatarioBDD) return res.status(404).json({msg:`Lo sentimos, no existe el arrendatario ${req.arrendatarioBDD._id}`})
    
    const verificarPassword = await arrendatarioBDD.matchPassword(req.body.passwordactual)
    if(!verificarPassword) return res.status(404).json({msg:"Lo sentimos, el password actual no es el correcto"})
    arrendatarioBDD.password = await arrendatarioBDD.encrypPassword(req.body.passwordnuevo)
    await arrendatarioBDD.save()
    res.status(200).json({msg:"Password actualizado correctamente"})
}

const cambiarDisponibilidadDepartamentoArrendatario = async (req, res) => {
  try {
    const { idDepartamento } = req.params;
    const { disponible } = req.body; // true o false

    if (typeof disponible !== "boolean") {
      return res.status(400).json({ msg: "El campo 'disponible' debe ser booleano (true o false)" });
    }

    if (!mongoose.Types.ObjectId.isValid(idDepartamento)) {
      return res.status(400).json({ msg: "ID de departamento no válido" });
    }

    // Solo puede modificar departamentos donde él es el arrendatario
    const departamento = await Departamento.findOne({
      _id: idDepartamento,
      arrendatario: req.arrendatarioBDD._id // Ajusta el campo si tu modelo usa otro nombre
    });

    if (!departamento) {
      return res.status(404).json({ msg: "Departamento no encontrado o no tienes permisos para modificarlo" });
    }

    departamento.disponible = disponible;
    await departamento.save();

    res.status(200).json({ msg: "Disponibilidad actualizada correctamente", departamento });
  } catch (error) {
    res.status(500).json({ msg: "Error al actualizar la disponibilidad", error: error.message });
  }
};
const listarArrendatarios = async (req, res) => {
  try {
    const arrendatarios = await Arrendatario.find().select("-password -token -__v -createdAt -updatedAt");
    res.status(200).json(arrendatarios);
  } catch (error) {
    res.status(500).json({ msg: "Error al listar arrendatarios", error: error.message });
  }
};

const listarDepartamentosArrendatario = async (req, res) => {
  try {
    const arrendatarioId = req.arrendatarioBDD?._id;
    if (!arrendatarioId) {
      return res.status(401).json({ msg: "No autenticado" });
    }

    const { categoria } = req.query;
    const filtro = { arrendatario: arrendatarioId };

    // Aplicar filtro por categoría si se proporciona
    if (categoria) {
      filtro.categoria = categoria;
    }

    const departamentos = await Departamento.find(filtro);

    // Validar si el arreglo viene vacío
    if (departamentos.length === 0) {
      return res.status(200).json({
        msg: "Aún no tienes ningún departamento vinculado a tu cuenta.",
        departamentos: []
      });
    }

    // Si sí tiene departamentos, los enviamos normalmente
    res.status(200).json(departamentos);
  } catch (error) {
    res.status(500).json({ msg: "Error al listar departamentos", error: error.message });
  }
};


const subirImagenArrendatario = async (req, res) => {
  try {
    const arrendatarioId = req.arrendatarioBDD._id;
    if (!mongoose.Types.ObjectId.isValid(arrendatarioId)) {
      return res.status(400).json({ msg: "ID de arrendatario no válido" });
    }

    const arrendatario = await Arrendatario.findById(arrendatarioId);
    if (!arrendatario) {
      return res.status(404).json({ msg: "Arrendatario no encontrado" });
    }

    if (!req.files || !req.files.imagen) {
      return res.status(400).json({ msg: "No se envió ninguna imagen" });
    }

    // Si ya hay una imagen anterior, la eliminamos de Cloudinary
    if (arrendatario.avatarArrenID) {
      await cloudinary.uploader.destroy(arrendatario.avatarArrenID);
    }

    // Subir la nueva imagen
    const resultado = await cloudinary.uploader.upload(req.files.imagen.tempFilePath, {
      folder: "avataresArrendatario"
    });

    arrendatario.avatarUrl = resultado.secure_url;
    arrendatario.avatarArrenID = resultado.public_id;

    await arrendatario.save();
    await fs.remove(req.files.imagen.tempFilePath);

    res.status(200).json({ msg: "Imagen subida correctamente", arrendatario });
  } catch (error) {
    res.status(500).json({ msg: "Error al subir la imagen", error: error.message });
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
  cambiarDisponibilidadDepartamentoArrendatario

  ,obtenerQuejasSugerenciasDepartamento,
  listarArrendatarios,
  listarDepartamentosArrendatario,
  subirImagenArrendatario
}