import { Router } from 'express'
import { verificarTokenJWT } from '../middlewares/JWT.js'
import {login,perfil, registro, listarArrendatarios, listarEstudiantes ,registroArrendatario, listarArrendatariosNoConfirmados, confirmarArrendatarioPorAdmin, recuperarPasswordAdministrador, comprobarTokenPasswordAdministrador, crearNuevoPasswordAdministrador, actualizarPasswordAdministrador, actualizarPerfilAdministrador, listarTodasQuejasSugerencias} from '../controllers/administrador_controller.js'


const router = Router()
// Ruta para que el administrador vea todas las quejas/sugerencias
router.get('/administrador/quejas', verificarTokenJWT, (req, res, next) => {
  if (!req.administradorBDD) {
    return res.status(403).json({ msg: 'Solo el administrador puede ver esta información' });
  }
  return listarTodasQuejasSugerencias(req, res, next);
});
router.post('/administrador/registro', registro) // http://localhost:3000/api/registro
router.post('/loginAd', login)
router.get('/perfilAd',verificarTokenJWT,perfil)
router.post('/administrador/registroArrendatario', verificarTokenJWT, (req, res, next) => {
  if (!req.administradorBDD) {
    return res.status(403).json({ msg: 'Solo el administrador puede crear arrendatarios' });
  }
  return registroArrendatario(req, res, next);
});

// Ruta para listar arrendatarios no confirmados (confirmEmail: false)
router.get('/administrador/arrendatarios/noconfirmados', verificarTokenJWT, (req, res, next) => {
  if (!req.administradorBDD) {
    return res.status(403).json({ msg: 'Solo el administrador puede ver esta información' });
  }
  return listarArrendatariosNoConfirmados(req, res, next);
});

// Ruta para que el administrador confirme un arrendatario por id
router.put('/arrendatarios/confirmar/:id', verificarTokenJWT, (req, res, next) => {
  if (!req.administradorBDD) {
    return res.status(403).json({ msg: 'Solo el administrador puede realizar esta acción' });
  }
  return confirmarArrendatarioPorAdmin(req, res, next);
});

// --- Rutas para recuperación y cambio de contraseña de administrador ---
// Recuperar password administrador
router.post('/administrador/recuperarpassword', recuperarPasswordAdministrador);
// Comprobar token para nuevo password
router.get('/administrador/recuperarpassword/:token', comprobarTokenPasswordAdministrador);
// Crear nuevo password con token
router.post('/administrador/nuevopassword/:token', crearNuevoPasswordAdministrador);
// Actualizar password desde perfil (autenticado)
router.put('/administrador/actualizarpassword/:id', verificarTokenJWT, actualizarPasswordAdministrador);
// Actualizar perfil del administrador (autenticado)
router.put('/administrador/perfil/:id', verificarTokenJWT, actualizarPerfilAdministrador);

router.get('/administrador/listarArrendatarios', verificarTokenJWT, (req, res, next) => {
  if (!req.administradorBDD) {
    return res.status(403).json({ msg: 'Solo el administrador puede ver esta información' });
  }
  return listarArrendatarios(req, res, next);
});
router.get('/administrador/listarEstudiantes', verificarTokenJWT, (req, res, next) => {
  if (!req.administradorBDD) {
    return res.status(403).json({ msg: 'Solo el administrador puede ver esta información' });
  }
  return listarEstudiantes(req, res, next);
});
export default router



