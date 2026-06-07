
import { crearTokenJWT } from "../middlewares/JWT.js"
import Estudiante from "../models/Estudiante.js"
import mongoose from "mongoose"
import { v2 as cloudinary } from 'cloudinary';
import fs from 'fs-extra';
import QuejaSugerencias from "../models/Quejas_Sugerencias.js"

import { sendMailToRegister, sendMailToRecoveryPassword } from "../config/nodemailer.js"



const perfilEstudiante =(req,res)=>{
		const {password,googleId,token,confirmEmail,createdAt,updatedAt,__v,...datosPerfil} = req.estudianteBDD
	res.status(200).json(datosPerfil)
}

// --- Recuperación y actualización de contraseña  ---
const confirmarMailEstudiante = async (req, res) => {
    try {
        const { token } = req.params;

        // Validación del parámetro de la ruta
        if (!token || token.trim() === "") {
            return res.status(400).json({ msg: "Token no proporcionado o inválido" });
        }

        // Buscar al estudiante por el token
        const estudianteBDD = await Estudiante.findOne({ token });
        
        // SI NO SE ENCUENTRA: Significa que el token nunca existió, expiró, 
        // o ya se usó con éxito (y por ende se cambió a null).
        if (!estudianteBDD) {
            return res.status(404).json({ 
                msg: "El enlace es inválido, ha expirado o la cuenta ya fue confirmada previamente. Intenta iniciar sesión." 
            });
        }

        // Este condicional queda como doble respaldo por si acaso el token no se limpió correctamente
        if (estudianteBDD.confirmEmail) {
            return res.status(400).json({ msg: "La cuenta ya ha sido confirmada previamente" });
        }

        // Modificaciones del documento en la primera confirmación
        estudianteBDD.token = null; 
        estudianteBDD.confirmEmail = true;
        
        await estudianteBDD.save();
        res.status(200).json({ msg: "Token confirmado con éxito, ya puedes iniciar sesión" });
        
    } catch (error) {
        console.error("Error al confirmar email:", error);
        res.status(500).json({ msg: "Error interno al confirmar email" });
    }
};

const recuperarPasswordEstudiante = async (req, res) => {
	const { email } = req.body
	if (Object.values(req.body).includes("")) return res.status(404).json({ msg: "Lo sentimos, debes llenar todos los campos" })
	const estudianteBDD = await Estudiante.findOne({ email })
	if (!estudianteBDD) return res.status(404).json({ msg: "Lo sentimos, el usuario no se encuentra registrado" })
	const token = estudianteBDD.crearToken()
	estudianteBDD.token = token
	sendMailToRecoveryPassword(email, token)
	await estudianteBDD.save()
	res.status(200).json({ msg: "Revisa tu correo electrónico para reestablecer tu contraseña" })
}

const comprobarTokenPasswordEstudiante = async (req, res) => {
	const { token } = req.params
	const estudianteBDD = await Estudiante.findOne({ token })
	if (estudianteBDD?.token !== req.params.token) return res.status(404).json({ msg: "Lo sentimos, no se puede validar la cuenta" })
	await estudianteBDD.save()
	res.status(200).json({ msg: "Token confirmado, ya puedes crear tu nuevo password" })
}

const crearNuevoPasswordEstudiante = async (req, res) => {
	const { password, confirmpassword } = req.body
	if (Object.values(req.body).includes("")) return res.status(404).json({ msg: "Lo sentimos, debes llenar todos los campos" })
	if (password != confirmpassword) return res.status(404).json({ msg: "Lo sentimos, los passwords no coinciden" })
	const estudianteBDD = await Estudiante.findOne({ token: req.params.token })
	if (estudianteBDD?.token !== req.params.token) return res.status(404).json({ msg: "Lo sentimos, no se puede validar la cuenta" })
	estudianteBDD.token = null
	estudianteBDD.password = await estudianteBDD.encrypPassword(password)
	await estudianteBDD.save()
	res.status(200).json({ msg: "Felicitaciones, ya puedes iniciar sesión con tu nuevo password" })
}

const actualizarPasswordEstudiante = async (req, res) => {
	const estudianteBDD = await Estudiante.findById(req.estudianteBDD._id)
	if (!estudianteBDD) return res.status(404).json({ msg: `Lo sentimos, no existe el estudiante` })
	const verificarPassword = await estudianteBDD.matchPassword(req.body.passwordactual)
	if (!verificarPassword) return res.status(404).json({ msg: "Lo sentimos, el password actual no es el correcto" })
	estudianteBDD.password = await estudianteBDD.encrypPassword(req.body.passwordnuevo)
	await estudianteBDD.save()
	res.status(200).json({ msg: "Password actualizado correctamente" })
}

// --- Actualizar perfil (similar a arrendatario, pero sin imagen) ---
const actualizarPerfilEstudiante = async (req, res) => {
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




// Login estudiante
const loginEstudiante = async (req, res) => {
	const { email, password } = req.body;
	if (Object.values(req.body).includes("")) {
		return res.status(400).json({ msg: "Lo sentimos, debes llenar todos los campos" });
	}

	const estudianteBDD = await Estudiante.findOne({ email }).select("-status -__v -token -updatedAt -createdAt");
	if (!estudianteBDD) {
		return res.status(404).json({ msg: "Lo sentimos, el usuario no se encuentra registrado" });
	}

	if (!estudianteBDD.password) {
		return res.status(400).json({ msg: "Este usuario debe iniciar sesión con Google" });
	}

	if (estudianteBDD.confirmEmail === false) {
		return res.status(401).json({ msg: "Lo sentimos, debe verificar su cuenta, antes de iniciar sesión" });
	}

	const verificarPassword = await estudianteBDD.matchPassword(password);
	if (!verificarPassword) {
		return res.status(401).json({ msg: "Lo sentimos, la contraseña es incorrecta" });
	}

	const { nombre, apellido, direccion, celular, _id, rol } = estudianteBDD;
	const token = crearTokenJWT(estudianteBDD._id, estudianteBDD.rol);

	res.status(200).json({ token, rol, nombre, apellido, direccion, celular, _id });
};


// Crear estudiante
const registrarEstudiante = async (req, res) => {
    try {
        const { email, password, nombre, apellido } = req.body;

        // 1. Validación estricta contra vacíos, nulos, indefinidos y espacios en blanco
        const camposObligatorios = [email, password, nombre, apellido];
        if (camposObligatorios.some(campo => !campo || String(campo).trim() === "")) {
            return res.status(400).json({ msg: "Todos los campos son obligatorios y no pueden contener solo espacios" });
        }

        // 2. Verificar si el Email ya existe
        const estudianteEmailBDD = await Estudiante.findOne({ email });
        if (estudianteEmailBDD) {
            return res.status(400).json({ msg: "El Email ya está registrado" });
        }

        // 3. Instanciar y asegurar password
        const nuevoEstudiante = new Estudiante(req.body);
        nuevoEstudiante.password = await nuevoEstudiante.encrypPassword(password);
        
        // 4. Token y envío de correo
        const token = nuevoEstudiante.crearToken();
        
        // Colocamos el envío en un bloque protegido por si falla el proveedor de e-mail (Nodemailer)
        try {
            await sendMailToRegister(email, token);
        } catch (mailError) {
            console.error("Error al enviar el correo de registro:", mailError);
            return res.status(500).json({ msg: "Error al enviar el correo de confirmación. Inténtalo más tarde." });
        }

        // 5. Guardar en base de datos de manera definitiva
        await nuevoEstudiante.save();
        res.status(200).json({ msg: "Revisa tu correo electrónico para confirmar tu cuenta" });

    } catch (error) {
        console.error("Error en registrarEstudiante:", error);
        res.status(500).json({ msg: "Error interno en el servidor al registrar estudiante", error: error.message });
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
// Registrar queja o sugerencia de estudiante
const registrarQuejaSugerenciaEstudiante = async (req, res) => {
    try {
        const { descripcion, departamento, tipoComentario } = req.body;
        const estudianteId = req.estudianteBDD?._id;
        if (!estudianteId) {
            return res.status(401).json({ msg: "No autenticado" });
        }
        if (!descripcion || descripcion.trim() === "") {
            return res.status(400).json({ msg: "La descripción es obligatoria" });
        }
        if (!departamento || !mongoose.Types.ObjectId.isValid(departamento)) {
            return res.status(400).json({ msg: "El id del departamento es obligatorio y debe ser válido" });
        }
        // Validar tipoComentario si viene en el body
        if (tipoComentario && !["comentario", "queja", "sugerencia"].includes(tipoComentario)) {
            return res.status(400).json({ msg: "El tipoComentario debe ser 'comentario', 'queja' o 'sugerencia'" });
        }

        // Buscar el departamento y su arrendatario
        const Departamento = (await import("../models/Departamento.js")).default;
        const departamentoDoc = await Departamento.findById(departamento);
        if (!departamentoDoc) {
            return res.status(404).json({ msg: "Departamento no encontrado" });
        }

        const nuevaEntrada = new QuejaSugerencias({
            descripcion,
            usuario: estudianteId,
            departamento,
            arrendatarioId: departamentoDoc.arrendatario || null,
            tipoComentario // <-- ahora sí se guarda si lo envías
        });
        await nuevaEntrada.save();
        res.status(201).json({ msg: "Queja o sugerencia registrada correctamente", data: nuevaEntrada });
    } catch (error) {
        res.status(500).json({ msg: "Error al registrar la queja o sugerencia", error: error.message });
    }
};

const listarDepartamentosEstudiante = async (req, res) => {
  try {
    const estudianteId = req.estudianteBDD?._id;
    if (!estudianteId) {
      return res.status(401).json({ msg: "No autenticado" });
    }

    const Departamento = (await import("../models/Departamento.js")).default;
    const departamentos = await Departamento.find({ estudiante: estudianteId });

    res.status(200).json(departamentos);
  } catch (error) {
    res.status(500).json({ msg: "Error al listar departamentos", error: error.message });
  }
};

const listarQuejasEstudiante = async (req, res) => {
  try {
    const estudianteId = req.estudianteBDD?._id;
    if (!estudianteId) {
      return res.status(401).json({ msg: "No autenticado" });
    }

    const quejas = await QuejaSugerencias.find({ usuario: estudianteId })
      .populate("departamento", "titulo direccion")
      .populate("arrendatarioId", "nombre apellido email");

    res.status(200).json(quejas);
  } catch (error) {
    res.status(500).json({ msg: "Error al listar las quejas/sugerencias", error: error.message });
  }
};


const subirImagenEstudiante = async (req, res) => {
  try {
    const estudianteId = req.estudianteBDD._id;
    if (!mongoose.Types.ObjectId.isValid(estudianteId)) {
      return res.status(400).json({ msg: "ID de estudiante no válido" });
    }

    const estudiante = await Estudiante.findById(estudianteId);
    if (!estudiante) {
      return res.status(404).json({ msg: "Estudiante no encontrado" });
    }

    if (!req.files || !req.files.imagen) {
      return res.status(400).json({ msg: "No se envió ninguna imagen" });
    }

    // Si ya hay una imagen anterior, la eliminamos de Cloudinary
    if (estudiante.avatarEstudianteID) {
      await cloudinary.uploader.destroy(estudiante.avatarEstudianteID);
    }

    // Subir la nueva imagen
    const resultado = await cloudinary.uploader.upload(req.files.imagen.tempFilePath, {
      folder: "avataresEstudiante"
    });

    estudiante.avatarUrl = resultado.secure_url;
    estudiante.avatarEstudianteID = resultado.public_id;

    await estudiante.save();
    await fs.remove(req.files.imagen.tempFilePath);

    res.status(200).json({ msg: "Imagen subida correctamente", estudiante });
  } catch (error) {
    res.status(500).json({ msg: "Error al subir la imagen", error: error.message });
  }
};


export {
	perfilEstudiante,
	registrarEstudiante,
	actualizarEstudiante,
	eliminarEstudiante,
	listarDepartamentosEstudiante,
	loginEstudiante,
	// nuevas funciones
	confirmarMailEstudiante,
	recuperarPasswordEstudiante,
	comprobarTokenPasswordEstudiante,
	crearNuevoPasswordEstudiante,
	actualizarPasswordEstudiante,
	actualizarPerfilEstudiante
    ,registrarQuejaSugerenciaEstudiante,
	listarQuejasEstudiante,
	subirImagenEstudiante
}

