import { crearTokenJWT } from "../middlewares/JWT.js"
import Estudiante from "../models/Estudiante.js"
import mongoose from "mongoose"

import { sendMailToRegister, sendMailToRecoveryPassword } from "../config/nodemailer.js"

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
	eliminarEstudiante
	,loginEstudiante
}
