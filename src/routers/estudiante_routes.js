
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
	loginEstudiante,
	confirmarMailEstudiante,
	recuperarPasswordEstudiante,
	comprobarTokenPasswordEstudiante,
	crearNuevoPasswordEstudiante,
	actualizarPasswordEstudiante,
	actualizarPerfilEstudiante
    ,registrarQuejaSugerenciaEstudiante
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
// Actualizar estudiante (admin o propio)
router.put('/estudiante/:id', verificarTokenJWT, (req, res, next) => {
	if (req.administradorBDD) {
		return actualizarEstudianteAdmin(req, res, next);
	}
	if (req.estudianteBDD && req.estudianteBDD._id.toString() === req.params.id) {
		return actualizarPerfilEstudiante(req, res, next);
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


// Confirmar email estudiante
router.get('/estudiante/confirmar/:token', confirmarMailEstudiante)
// Recuperar password estudiante
router.post('/estudiante/recuperarpassword', recuperarPasswordEstudiante)
router.get('/estudiante/recuperarpassword/:token', comprobarTokenPasswordEstudiante)
router.post('/estudiante/nuevopassword/:token', crearNuevoPasswordEstudiante)

// Actualizar password desde perfil (autenticado)
router.put('/estudiante/actualizarpassword/:id', verificarTokenJWT, actualizarPasswordEstudiante)

// Actualizar perfil estudiante (autenticado)
router.put('/estudiante/perfil/:id', verificarTokenJWT, actualizarPerfilEstudiante)

// Registrar queja o sugerencia (autenticado)
router.post('/estudiante/queja-sugerencia', verificarTokenJWT, registrarQuejaSugerenciaEstudiante)


export default router
