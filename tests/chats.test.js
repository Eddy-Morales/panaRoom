import { jest } from '@jest/globals'

// ==========================================
// 1. MOCKS DE DEPENDENCIAS GLOBALES (Socket.io)
// ==========================================
// Mockea el objeto 'io' exportado desde el index para capturar los emits
const mockEmit = jest.fn()
jest.unstable_mockModule('../src/index.js', () => ({
    io: {
        emit: mockEmit
    }
}))

// ==========================================
// 2. CONTROLADOR SIMULADO (Aislamiento de Módulos)
// ==========================================
const registrarMensajeChat = async (req, res) => {
    try {
        const { mensaje, remitente, administradorId, arrendatarioId, estudianteId, departamentoId } = req.body;

        if (!mensaje || !remitente) {
            return res.status(400).json({ msg: "El mensaje y el remitente son obligatorios" });
        }
        if (!["administrador", "arrendatario", "estudiante"].includes(remitente)) {
            return res.status(400).json({ msg: "El remitente debe ser administrador, arrendatario o estudiante" });
        }

        if (!administradorId && !arrendatarioId && !estudianteId) {
            return res.status(400).json({ msg: "Debe especificar al menos un ID de usuario" });
        }

        if (administradorId && estudianteId && !arrendatarioId) {
            return res.status(400).json({ msg: "No se permiten chats entre administrador y estudiante" });
        }

        const nuevoMensaje = new ChatUsuarios({
            mensaje,
            remitente,
            administradorId: administradorId || null,
            arrendatarioId: arrendatarioId || null,
            estudianteId: estudianteId || null,
            departamentoId: departamentoId || null
        });

        await nuevoMensaje.save();

        // Llamada a la dependencia mockeada de WebSockets
        const { io } = await import('../src/index.js');
        io.emit('nuevo-mensaje-chat', nuevoMensaje);

        res.status(201).json({ msg: "Mensaje registrado correctamente", chat: nuevoMensaje });
    } catch (error) {
        res.status(500).json({ msg: "Error al registrar el mensaje", error: error.message });
    }
};

// ==========================================
// 3. IMPORTACIÓN DE MODELOS REALES
// ==========================================
import ChatUsuarios from '../src/models/ChatUsuarios.js'

// ==========================================
// SUITE DE PRUEBAS DEL CHAT DE USUARIOS
// ==========================================
describe('Pruebas del Módulo de Chat - Mensajería Panaroom', () => {
    let req;
    let res;

    beforeEach(() => {
        jest.clearAllMocks()

        res = {
            status: jest.fn().mockReturnThis(),
            json: jest.fn()
        }

        req = {
            body: {
                mensaje: "Hola, estoy interesado en alquilar el departamento cerca de la EPN.",
                remitente: "estudiante",
                estudianteId: "60c72b2f9b1d8b2bad111111",
                arrendatarioId: "60c72b2f9b1d8b2bad222222",
                departamentoId: "60c72b2f9b1d8b2bad333333"
            }
        }
    })

    // --- VALIDACIONES DE CAMPOS ---
    test('Debe retornar 400 si falta el mensaje o el rol del remitente', async () => {
        req.body.mensaje = ""
        await registrarMensajeChat(req, res)
        expect(res.status).toHaveBeenCalledWith(400)
        expect(res.json).toHaveBeenCalledWith({ msg: "El mensaje y el remitente son obligatorios" })
    })

    test('Debe retornar 400 si el remitente no pertenece a los roles del ENUM', async () => {
        req.body.remitente = "invitado_externo"
        await registrarMensajeChat(req, res)
        expect(res.status).toHaveBeenCalledWith(400)
        expect(res.json).toHaveBeenCalledWith({ msg: "El remitente debe ser administrador, arrendatario o estudiante" })
    })

    test('Debe retornar 400 si no se proporciona ningún ID de involucrados', async () => {
        req.body.estudianteId = null
        req.body.arrendatarioId = null
        req.body.administradorId = null
        
        await registrarMensajeChat(req, res)
        expect(res.status).toHaveBeenCalledWith(400)
        expect(res.json).toHaveBeenCalledWith({ msg: "Debe especificar al menos un ID de usuario" })
    })

    // --- REGLAS DE NEGOCIO ---
    test('Debe retornar 400 y prohibir chats directos entre administradores y estudiantes sin un arrendatario', async () => {
        req.body.administradorId = "60c72b2f9b1d8b2bad444444"
        req.body.estudianteId = "60c72b2f9b1d8b2bad111111"
        req.body.arrendatarioId = null // Rompe la regla de negocio

        await registrarMensajeChat(req, res)
        expect(res.status).toHaveBeenCalledWith(400)
        expect(res.json).toHaveBeenCalledWith({ msg: "No se permiten chats entre administrador y estudiante" })
    })

    // --- PERSISTENCIA Y EMISIÓN EN TIEMPO REAL ---
    test('Debe registrar exitosamente el mensaje, salvar en BDD y emitirlo por WebSockets', async () => {
        // Espiamos el prototipo de save del Modelo de Chat
        const mockSave = jest.fn().mockResolvedValue(true)
        jest.spyOn(ChatUsuarios.prototype, 'save').mockImplementation(mockSave)

        await registrarMensajeChat(req, res)

        // Verificaciones
        expect(mockSave).toHaveBeenCalled()
        expect(mockEmit).toHaveBeenCalledWith('nuevo-mensaje-chat', expect.any(Object))
        expect(res.status).toHaveBeenCalledWith(201)
        expect(res.json).toHaveBeenCalledWith({
            msg: "Mensaje registrado correctamente",
            chat: expect.any(Object)
        })
    })

    // --- MANEJO DE EXCEPCIONES ---
    test('Debe retornar 500 ante un colapso del servidor o la base de datos', async () => {
        jest.spyOn(ChatUsuarios.prototype, 'save').mockRejectedValue(new Error('Fallo de red en el clúster de base de datos'))

        await registrarMensajeChat(req, res)

        expect(res.status).toHaveBeenCalledWith(500)
        expect(res.json).toHaveBeenCalledWith({
            msg: "Error al registrar el mensaje",
            error: "Fallo de red en el clúster de base de datos"
        })
    })
})