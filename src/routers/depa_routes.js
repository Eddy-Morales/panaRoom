import {Router} from 'express'
import { verificarTokenJWT } from '../middlewares/JWT.js'
import { registrarDepartamento,listarDepartamento,eliminarDepa,
    verDepartamentoPorId, pagarDepartamento,
     asignarEstudianteADepartamento, 
     quitarEstudianteDeDepartamento, 
     cambiarDisponibilidadDepartamento,
     registrarMensajeChat,
     actualizarComentarioUsuario,
     listarChats,
     actualizarCalificacion,
     listarContactosChat,
    listarComentariosDepartamento,
    actualizarDepartamento
    } from '../controllers/depa_controller.js'



const router = Router()

// Asignar estudiante a un departamento
router.put('/departamento/asignarEstudiante', verificarTokenJWT, asignarEstudianteADepartamento)
router.post('/departamento/registro', verificarTokenJWT, registrarDepartamento)
router.get('/departamentos', verificarTokenJWT, listarDepartamento) 
router.delete('/departamento/eliminar/:id',verificarTokenJWT,eliminarDepa)
router.post('/departamento/pago',verificarTokenJWT,pagarDepartamento)
router.get("/departamento/:id",verificarTokenJWT, verDepartamentoPorId);
router.put('/departamento/quitarEstudiante', verificarTokenJWT, quitarEstudianteDeDepartamento)
router.put('/departamento/cambiarDisponibilidad', verificarTokenJWT, cambiarDisponibilidadDepartamento)
router.post('/chat/mensaje', verificarTokenJWT, registrarMensajeChat)
router.put('/queja-sugerencia/comentario', verificarTokenJWT, actualizarComentarioUsuario)
router.get('/listar-chats', verificarTokenJWT, listarChats)
router.put('/queja-sugerencia/calificacion', verificarTokenJWT, actualizarCalificacion)
router.get('/listar-contactos', verificarTokenJWT, listarContactosChat)
router.get('/departamento/comentarios/:id', verificarTokenJWT, listarComentariosDepartamento)
router.put('/departamento/actualizar/:id', verificarTokenJWT, actualizarDepartamento);
export default router