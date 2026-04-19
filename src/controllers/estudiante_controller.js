
import { crearTokenJWT } from "../middlewares/JWT.js"
import Estudiante from "../models/Estudiante.js"
import mongoose from "mongoose"

import { sendMailToRegister, sendMailToRecoveryPassword } from "../config/nodemailer.js"


// --- Recuperación y actualización de contraseña  ---
const confirmarMailEstudiante = async (req, res) => {
    try {
        if (!(req.params.token)) return res.status(400).json({ msg: "Lo sentimos, no se puede validar la cuenta" })
        const estudianteBDD = await Estudiante.findOne({ token: req.params.token })
        if (!estudianteBDD?.token) return res.status(404).json({ msg: "La cuenta ya ha sido confirmada" })
        estudianteBDD.token = null
        estudianteBDD.confirmEmail = true
        await estudianteBDD.save()
        res.status(200).json({ msg: "Token confirmado, ya puedes iniciar sesión" })
    } catch (error) {
        console.error("Error al confirmar email:", error)
        res.status(500).json({ msg: "Error interno al confirmar email" })
    }
}

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
	const { email, password } = req.body;
	if (Object.values(req.body).includes("")) return res.status(400).json({ msg: "Todos los campos son obligatorios" });
	const estudianteEmailBDD = await Estudiante.findOne({ email });
	if (estudianteEmailBDD) return res.status(400).json({ msg: "El Email ya está registrado" });
	const nuevoEstudiante = new Estudiante(req.body);
	if (password) {
		nuevoEstudiante.password = await nuevoEstudiante.encrypPassword(password);
	}
	const token = nuevoEstudiante.crearToken();
	await sendMailToRegister(email, token);
	await nuevoEstudiante.save();
	res.status(200).json({ msg: "Revisa tu correo electrónico para confirmar tu cuenta" });
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

export {
	registrarEstudiante,
	actualizarEstudiante,
	eliminarEstudiante,
	loginEstudiante,
	// nuevas funciones
	confirmarMailEstudiante,
	recuperarPasswordEstudiante,
	comprobarTokenPasswordEstudiante,
	crearNuevoPasswordEstudiante,
	actualizarPasswordEstudiante,
	actualizarPerfilEstudiante
}
