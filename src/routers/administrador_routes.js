import { Router } from 'express'
import { verificarTokenJWT } from '../middlewares/JWT.js'
import {login,perfil, registro, registroArrendatario} from '../controllers/administrador_controller.js'

const router = Router()

router.post('/administrador/registro', registro) // http://localhost:3000/api/registro
router.post('/loginAd', login)
router.get('/perfilAd',verificarTokenJWT,perfil)
router.post('/registroArrendatario', verificarTokenJWT, (req, res, next) => {
  if (!req.administradorBDD) {
    return res.status(403).json({ msg: 'Solo el administrador puede crear arrendatarios' });
  }
  return registroArrendatario(req, res, next);
});

export default router