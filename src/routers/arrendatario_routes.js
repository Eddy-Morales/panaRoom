import { Router } from 'express'
import passport from "passport";
import {
  crearArrendatario,
  actualizarPassword,
  actualizarPerfil,
  comprobarTokenPasword,
  crearNuevoPassword,
  login,
  perfil,
  recuperarPassword,
  cambiarDisponibilidadDepartamentoArrendatario,
  obtenerQuejasSugerenciasDepartamento
} from '../controllers/arrendatario_controller.js'


import { verificarTokenJWT } from '../middlewares/JWT.js'

const router = Router()

// Obtener quejas y sugerencias del departamento del arrendatario autenticado
router.get('/arrendatario/comentarios', verificarTokenJWT, obtenerQuejasSugerenciasDepartamento)

// Ruta para crear arrendatario sin autenticación ni token
router.post('/arrendatario/crear', crearArrendatario)


router.post('/arrendatario/recuperarpassword', recuperarPassword)
router.get('/arrendatario/recuperarpassword/:token', comprobarTokenPasword)
router.post('/arrendatario/nuevopassword/:token', crearNuevoPassword)
router.post('/arrendatario/login', login)
router.get('/arrendatario/perfil',verificarTokenJWT,perfil)
router.put('/arrendatario/:id',verificarTokenJWT,actualizarPerfil)
router.put('/arrendatario/actualizarpassword/:id',verificarTokenJWT,actualizarPassword)
router.put('/arrendatario/cambiarDisponibilidad/:idDepartamento', verificarTokenJWT, cambiarDisponibilidadDepartamentoArrendatario)


router.get("/auth/google", passport.authenticate("google", {
  scope: ["profile", "email"]
}));

router.get("/auth/google/callback",
  passport.authenticate("google", { session: false, failureRedirect: "/login" }),
  (req, res) => {
    const { token, usuario } = req.user;
    const { nombre, apellido, direccion, celular, _id, rol, email } = usuario;
    
    // URL del frontend (debe configurarse en variables de entorno)
    const frontendUrl = process.env.URL_FRONTEND; // Ajusta esto según tu configuración
    
    // Corregir el formato de la URL base para evitar el doble slash
    const baseUrl = frontendUrl.endsWith('/') ? frontendUrl.slice(0, -1) : frontendUrl;
    
    // Construir la URL de redirección con los datos necesarios
    const redirectUrl = `${baseUrl}/auth/success?token=${token}&_id=${_id}&nombre=${encodeURIComponent(nombre || '')}&apellido=${encodeURIComponent(apellido || '')}&direccion=${encodeURIComponent(direccion || '')}&celular=${encodeURIComponent(celular || '')}&rol=${rol || 'arrendatario'}&email=${encodeURIComponent(email || '')}`;
    
    // Redirigir al frontend en lugar de enviar JSON
    res.redirect(redirectUrl);
  }
);

export default router
