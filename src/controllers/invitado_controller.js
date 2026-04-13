import Departamento from "../models/Departamento.js";

// Listar departamentos para invitados (sin autenticación)
const listarDepartamentosInvitado = async (req, res) => {
	try {
		const departamentos = await Departamento.find().select("-__v -createdAt -updatedAt");
		res.status(200).json(departamentos);
	} catch (error) {
		res.status(500).json({ msg: "Error al listar departamentos", error });
	}
};

export { listarDepartamentosInvitado };
