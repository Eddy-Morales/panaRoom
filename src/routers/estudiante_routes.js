
import { Router } from 'express'
import {
	registrarEstudiante as registrarEstudianteAdmin,
	listarEstudiantes as listarEstudiantesAdmin,
	actualizarEstudiante as actualizarEstudianteAdmin,
	eliminarEstudiante as eliminarEstudianteAdmin
} from '../controllers/administrador_controller.js'
import {
	registrarEstudiante,
	
	actualizarEstudiante,
	eliminarEstudiante,
	loginEstudiante
} from '../controllers/estudiante_controller.js'

import { verificarTokenJWT } from '../middlewares/JWT.js'

const router = Router()

// Login estudiante
router.post('/loginEstudiante', loginEstudiante)
// Registrar estudiante (token solo si es admin)
router.post('/registroEstudiante', (req, res, next) => {
	// Si hay token y es admin, usar controlador admin
	if (req.headers.authorization) {
		// Intentar verificar token
		return verificarTokenJWT(req, res, function () {
			if (req.administradorBDD) {
				return registrarEstudianteAdmin(req, res, next);
			}
			return registrarEstudiante(req, res, next);
		});
	}
	// Si no hay token, registro público
	return registrarEstudiante(req, res, next);
})
// Listar estudiantes (solo administrador)
router.get('/estudiantes', verificarTokenJWT, (req, res, next) => {
  if (req.administradorBDD) {
    return listarEstudiantesAdmin(req, res, next);
  }
  return res.status(403).json({ msg: 'Solo el administrador puede listar estudiantes' });
})
// Actualizar estudiante
router.put('/estudiante/:id', verificarTokenJWT, (req, res, next) => {
	// Si es admin, puede actualizar cualquier estudiante
	if (req.administradorBDD) {
		return actualizarEstudianteAdmin(req, res, next);
	}
	// Si es estudiante, solo puede actualizar su propio perfil
	if (req.estudianteBDD && req.estudianteBDD._id.toString() === req.params.id) {
		return actualizarEstudiante(req, res, next);
	}
	return res.status(403).json({ msg: 'No tienes permisos para actualizar este estudiante' });
})
// Eliminar estudiante
router.delete('/estudiante/:id', verificarTokenJWT, (req, res, next) => {
	if (req.administradorBDD) {
		return eliminarEstudianteAdmin(req, res, next);
	}
	return eliminarEstudiante(req, res, next);
})

export default router
