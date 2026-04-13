import { Router } from 'express';
import { listarDepartamentosInvitado } from '../controllers/invitado_controller.js';

const router = Router();

// Ruta pública para listar departamentos
router.get('/departamentoInfo', listarDepartamentosInvitado);

export default router;
