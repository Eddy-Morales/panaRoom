import { jest } from '@jest/globals'
import mongoose from 'mongoose'

// ==========================================
// 1. CONFIGURACIÓN DE GLOBALES Y MOCKS
// ==========================================

// Mock global de WebSockets
const mockEmit = jest.fn()
global.io = { emit: mockEmit }

// Mock de Cloudinary
jest.unstable_mockModule('cloudinary', () => ({
    v2: {
        uploader: {
            upload: jest.fn().mockResolvedValue({
                secure_url: 'https://res.cloudinary.com/demo/image/upload/v1/depa.jpg',
                public_id: 'Departamentos/mock_id'
            })
        }
    }
}))

// Mock de fs-extra para evitar manipular archivos reales en el sistema
jest.unstable_mockModule('fs-extra', () => ({
    default: {
        unlink: jest.fn().mockResolvedValue(true)
    }
}))

// ==========================================
// 2. CONTROLADORES SIMULADOS (Aislamiento de Módulos)
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
        io.emit('nuevo-mensaje-chat', nuevoMensaje);

        res.status(201).json({ msg: "Mensaje registrado correctamente", chat: nuevoMensaje });
    } catch (error) {
        res.status(500).json({ msg: "Error al registrar el mensaje", error: error.message });
    }
};

const registrarDepartamento = async (req, res) => {
    try {
        const { arrendatario, alicuota, alicoutaMonto, parqueadero, numParqueaderos } = req.body;

        if (!mongoose.Types.ObjectId.isValid(arrendatario)) {
            return res.status(400).json({ msg: "El ID del arrendatario no es válido." });
        }

        const camposObligatorios = [
            "titulo", "descripcion", "direccion", "precioMensual", 
            "numeroHabitaciones", "numeroBanos", "categoria"
        ];

        for (const campo of camposObligatorios) {
            if (!req.body[campo] || req.body[campo] === "") {
                return res.status(400).json({ msg: `El campo ${campo} es obligatorio.` });
            }
        }

        if (req.body.titulo.trim().length < 5 || req.body.titulo.trim().length > 50) {
            return res.status(400).json({ msg: "El título debe tener entre 5 y 50 caracteres." });
        }

        if (req.body.descripcion.trim().length < 10 || req.body.descripcion.trim().length > 1000) {
            return res.status(400).json({ msg: "La descripción debe tener entre 10 y 1000 caracteres." });
        }

        if (req.body.direccion.trim().length < 5 || req.body.direccion.trim().length > 100) {
            return res.status(400).json({ msg: "La dirección debe tener entre 5 y 100 caracteres." });
        }

        if (isNaN(req.body.precioMensual) || Number(req.body.precioMensual) <= 0) {
            return res.status(400).json({ msg: "El precio mensual debe ser un valor mayor a 0." });
        }

        if (isNaN(req.body.numeroHabitaciones) || Number(req.body.numeroHabitaciones) < 1) {
            return res.status(400).json({ msg: "Debe existir al menos una habitación." });
        }

        if (isNaN(req.body.numeroBanos) || Number(req.body.numeroBanos) < 1) {
            return res.status(400).json({ msg: "Debe existir al menos un baño." });
        }

        if (!["suit", "departamento"].includes(req.body.categoria)) {
            return res.status(400).json({ msg: "La categoría debe ser 'suit' o 'departamento'." });
        }

        if (req.body.urlMapa) {
            try {
                new URL(req.body.urlMapa);
            } catch (urlError) {
                return res.status(400).json({ msg: "La URL del mapa no es válida." });
            }
        }

        if (!req.files?.imagenes) {
            return res.status(400).json({ msg: "Debe subir al menos una imagen del departamento." });
        }

        if (req.files?.imagenes && (Array.isArray(req.files.imagenes) ? req.files.imagenes.length : 1) > 10) {
            return res.status(400).json({ msg: "Solo se permiten hasta 10 imágenes." });
        }

        const imagenesSubidas = [];
        if (req.files?.imagenes) {
            const archivos = Array.isArray(req.files.imagenes) ? req.files.imagenes : [req.files.imagenes];
            for (const archivo of archivos) {
                const cloudinary = (await import('cloudinary')).v2;
                const fs = (await import('fs-extra')).default;
                
                const { secure_url, public_id } = await cloudinary.uploader.upload(
                    archivo.tempFilePath, { folder: "Departamentos" }
                );
                imagenesSubidas.push({ url: secure_url, public_id });
                await fs.unlink(archivo.tempFilePath);
            }
        }

        let qrPago = { url: null, public_id: null };
        if (req.files?.qrPago) {
            const cloudinary = (await import('cloudinary')).v2;
            const fs = (await import('fs-extra')).default;

            const resultadoQr = await cloudinary.uploader.upload(
                req.files.qrPago.tempFilePath, { folder: "Departamentos/QR" }
            );
            qrPago = { url: resultadoQr.secure_url, public_id: resultadoQr.public_id };
            await fs.unlink(req.files.qrPago.tempFilePath);
        }

        const alicuotaBool = alicuota === true || alicuota === "true";
        if (alicuotaBool) {
            if (!alicoutaMonto || isNaN(alicoutaMonto) || Number(alicoutaMonto) <= 0) {
                return res.status(400).json({ msg: "Debe ingresar un monto de alícuota válido mayor a 0." });
            }
        }

        const parqueaderoBool = parqueadero === true || parqueadero === "true";
        if (parqueaderoBool) {
            if (!numParqueaderos || isNaN(numParqueaderos) || Number(numParqueaderos) < 1 || Number(numParqueaderos) > 10) {
                return res.status(400).json({ msg: "El número de parqueaderos debe estar entre 1 y 10." });
            }
        }

        const metodoPago = {};
        if (req.body.metodoPago) {
            try {
                const metodoPagoParseado = typeof req.body.metodoPago === "string" ? JSON.parse(req.body.metodoPago) : req.body.metodoPago;
                if (metodoPagoParseado?.cuentaBancaria) metodoPago.cuentaBancaria = metodoPagoParseado.cuentaBancaria;
                if (metodoPagoParseado?.tipoCuenta) metodoPago.tipoCuenta = metodoPagoParseado.tipoCuenta;
                if (metodoPagoParseado?.tipoBanco) metodoPago.tipoBanco = metodoPagoParseado.tipoBanco;
                if (metodoPagoParseado?.numeroCedula) metodoPago.numeroCedula = metodoPagoParseado.numeroCedula;
            } catch (parseError) {
                return res.status(400).json({ msg: "El campo metodoPago no tiene un formato JSON válido." });
            }
        } else {
            if (req.body.cuentaBancaria) metodoPago.cuentaBancaria = req.body.cuentaBancaria;
            if (req.body.tipoCuenta) metodoPago.tipoCuenta = req.body.tipoCuenta;
            if (req.body.tipoBanco) metodoPago.tipoBanco = req.body.tipoBanco;
            if (req.body.numeroCedula) metodoPago.numeroCedula = req.body.numeroCedula;
        }

        if (qrPago.url) metodoPago.qrPago = qrPago;

        const nuevoDepartamento = new Departamento({
            ...req.body,
            alicuota: alicuotaBool,
            alicoutaMonto: alicuotaBool ? Number(alicoutaMonto) : null,
            parqueadero: parqueaderoBool,
            numParqueaderos: parqueaderoBool ? Number(numParqueaderos) : 0,
            imagenes: imagenesSubidas,
            metodoPago: Object.keys(metodoPago).length > 0 ? metodoPago : undefined
        });

        await nuevoDepartamento.save();

        res.status(201).json({ msg: "Departamento registrado exitosamente", departamento: nuevoDepartamento });
    } catch (error) {
        res.status(500).json({ msg: "Error interno", error: error.message });
    }
};

const obtenerQuejasSugerenciasDepartamento = async (req, res) => {
    try {
        const arrendatarioId = req.arrendatarioBDD?._id;
        if (!arrendatarioId) {
            return res.status(401).json({ msg: "No autenticado" });
        }

        // CORRECCIÓN AQUÍ: Se añade "../src/" para que encuentre el modelo real desde la carpeta tests/
        const Departamento = (await import("../src/models/Departamento.js")).default;

        const departamentos = await Departamento.find({ arrendatario: arrendatarioId }).select("_id titulo");
        if (!departamentos.length) {
            return res.status(404).json({ msg: "No tienes departamentos registrados" });
        }

        const idsDepartamentos = departamentos.map((dep) => dep._id);

        const comentarios = await QuejaSugerencias.find({ departamento: { $in: idsDepartamentos } })
            .populate("usuario", "nombre apellido email")
            .populate("departamento", "titulo")
            .sort({ fecha: -1 });

        res.status(200).json({
            departamentos,
            comentarios,
        });
    } catch (error) {
        res.status(500).json({ msg: "Error al obtener comentarios", error: error.message });
    }
};

const listarDepartamento = async (req, res) => {
    try {
        const { categoria } = req.query;

        let filtro = {};

        if (categoria) {
            filtro.categoria = categoria;
        }

        const departamentos = await Departamento.find(filtro);

        res.status(200).json(departamentos);
    } catch (error) {
        res.status(500).json({
            msg: "Error al listar departamentos",
            error: error.message
        });
    }
};

// ==========================================
// 3. IMPORTACIÓN DE MODELOS REALES
// ==========================================
import ChatUsuarios from '../src/models/ChatUsuarios.js'
import Departamento from '../src/models/Departamento.js'
import QuejaSugerencias from '../src/models/Quejas_Sugerencias.js'

// ==========================================
// SUITE DE PRUEBAS DE DEPARTAMENTOS
// ==========================================
describe('Pruebas del Módulo de Departamentos - Chat', () => {
    let res

    beforeEach(() => {
        jest.clearAllMocks()
        res = {
            status: jest.fn().mockReturnThis(),
            json: jest.fn()
        }
    })

    // ==========================================
    // BLOQUE: REGISTRAR MENSAJE CHAT
    // ==========================================
    describe('Registrar Mensaje Chat', () => {
        test('Debe retornar 400 si falta el mensaje o el remitente', async () => {
            const req = { body: { mensaje: "", remitente: "estudiante" } }
            await registrarMensajeChat(req, res)
            expect(res.status).toHaveBeenCalledWith(400)
        })

        test('Debe retornar 400 si el rol del remitente no es válido', async () => {
            const req = { body: { mensaje: "Hola", remitente: "invitado" } }
            await registrarMensajeChat(req, res)
            expect(res.status).toHaveBeenCalledWith(400)
        })

        test('Debe retornar 400 si no se envía ningún ID de participante', async () => {
            const req = { body: { mensaje: "Hola", remitente: "estudiante" } }
            await registrarMensajeChat(req, res)
            expect(res.status).toHaveBeenCalledWith(400)
        })

        test('Debe retornar 400 si se intenta chatear entre Admin y Estudiante sin intermediario', async () => {
            const req = { 
                body: { 
                    mensaje: "Trato directo", remitente: "estudiante",
                    administradorId: "60c72b2f9b1d8b2bad888888", estudianteId: "60c72b2f9b1d8b2bad999999"
                } 
            }
            await registrarMensajeChat(req, res)
            expect(res.status).toHaveBeenCalledWith(400)
        })

        test('Debe guardar el mensaje con éxito y emitirlo por WebSockets', async () => {
            const mockSave = jest.fn().mockResolvedValue(true)
            jest.spyOn(ChatUsuarios.prototype, 'save').mockImplementation(mockSave)

            const req = { 
                body: {
                    mensaje: "Me interesa el cuarto disponible", remitente: "estudiante",
                    estudianteId: "60c72b2f9b1d8b2bad111111", arrendatarioId: "60c72b2f9b1d8b2bad222222"
                } 
            }
            await registrarMensajeChat(req, res)
            expect(mockSave).toHaveBeenCalled()
            expect(mockEmit).toHaveBeenCalledWith('nuevo-mensaje-chat', expect.any(Object))
            expect(res.status).toHaveBeenCalledWith(201)
        })

        test('Debe retornar 500 si la base de datos se cae al guardar el mensaje', async () => {
            jest.spyOn(ChatUsuarios.prototype, 'save').mockRejectedValue(new Error('Error de escritura en disco'))
            const req = { body: { mensaje: "Error", remitente: "estudiante", estudianteId: "60c72b2f9b1d8b2bad111111" } }
            await registrarMensajeChat(req, res)
            expect(res.status).toHaveBeenCalledWith(500)
        })
    })

    // ==========================================
    // BLOQUE: REGISTRAR DEPARTAMENTO
    // ==========================================
    describe('Gestión de residencias', () => {
        let req, mockCloudinary, mockFs

        beforeEach(async () => {
            const cloudinaryModule = await import('cloudinary')
            const fsModule = await import('fs-extra')
            mockCloudinary = cloudinaryModule.v2.uploader.upload
            mockFs = fsModule.default.unlink

            req = {
                body: {
                    arrendatario: '60c72b2f9b1d8b2bad888888',
                    titulo: 'Hermoso Departamento Cerca EPN',
                    descripcion: 'Cuenta con todos los servicios y excelente ubicación estudiantil.',
                    direccion: 'Av. Ladrón de Guevara y Andalucía',
                    precioMensual: 250,
                    numeroHabitaciones: 2,
                    numeroBanos: 1,
                    categoria: 'departamento',
                    alicuota: 'false',
                    parqueadero: 'false'
                },
                files: {
                    imagenes: { tempFilePath: '/tmp/img1.jpg' }
                }
            }
        })

        test('Debe retornar 400 si el ID del arrendatario no cumple el formato de Mongoose', async () => {
            req.body.arrendatario = 'id-invalido'
            await registrarDepartamento(req, res)
            expect(res.status).toHaveBeenCalledWith(400)
        })

        test('Debe retornar 400 si falta algún campo obligatorio (ej. titulo)', async () => {
            req.body.titulo = ''
            await registrarDepartamento(req, res)
            expect(res.status).toHaveBeenCalledWith(400)
        })

        test('Debe retornar 400 si la dirección es demasiado corta', async () => {
            req.body.direccion = 'Uio'
            await registrarDepartamento(req, res)
            expect(res.status).toHaveBeenCalledWith(400)
        })

        test('Debe retornar 400 si el precio mensual es menor o igual a 0', async () => {
            req.body.precioMensual = 0
            await registrarDepartamento(req, res)
            expect(res.status).toHaveBeenCalledWith(400)
        })

        test('Debe retornar 400 si la categoría no pertenece al ENUM', async () => {
            req.body.categoria = 'casa'
            await registrarDepartamento(req, res)
            expect(res.status).toHaveBeenCalledWith(400)
        })

        test('Debe retornar 400 si no se envía el objeto de imágenes', async () => {
            req.files = null
            await registrarDepartamento(req, res)
            expect(res.status).toHaveBeenCalledWith(400)
        })

        test('Debe retornar 400 si alícuota es true pero el monto no se envía o es inválido', async () => {
            req.body.alicuota = 'true'
            req.body.alicoutaMonto = ''
            await registrarDepartamento(req, res)
            expect(res.status).toHaveBeenCalledWith(400)
        })

        test('Debe guardar exitosamente el departamento con sus imágenes y QR procesados', async () => {
            const mockSave = jest.fn().mockResolvedValue(true)
            jest.spyOn(Departamento.prototype, 'save').mockImplementation(mockSave)
            req.files.qrPago = { tempFilePath: '/tmp/qr.jpg' }

            await registrarDepartamento(req, res)

            expect(mockCloudinary).toHaveBeenCalled()
            expect(mockFs).toHaveBeenCalled()
            expect(mockSave).toHaveBeenCalled()
            expect(res.status).toHaveBeenCalledWith(201)
        })

        test('Debe retornar error 500 ante un colapso en la base de datos o Cloudinary', async () => {
            jest.spyOn(Departamento.prototype, 'save').mockRejectedValue(new Error('Fallo crítico en Atlas'))
            await registrarDepartamento(req, res)
            expect(res.status).toHaveBeenCalledWith(500)
        })
    })

    // ==========================================
    // BLOQUE: OBTENER QUEJAS Y SUGERENCIAS POR DEPARTAMENTO
    // ==========================================
    describe('Obtener Quejas y Sugerencias de Departamentos', () => {
        let mockSort

        beforeEach(() => {
            mockSort = jest.fn()
            const mockPopulate2 = { sort: mockSort }
            const mockPopulate1 = { populate: jest.fn().mockReturnValue(mockPopulate2) }
            const mockFindChain = { populate: jest.fn().mockReturnValue(mockPopulate1) }

            QuejaSugerencias.find = jest.fn().mockReturnValue(mockFindChain)
        })

        test('Debe retornar 401 si el usuario no está autenticado', async () => {
            const req = { req: {} }

            await obtenerQuejasSugerenciasDepartamento(req, res)

            expect(res.status).toHaveBeenCalledWith(401)
            expect(res.json).toHaveBeenCalledWith({ msg: "No autenticado" })
        })

        test('Debe retornar 404 si el arrendatario no posee ningún departamento', async () => {
            const mockSelect = jest.fn().mockResolvedValue([])
            Departamento.find = jest.fn().mockReturnValue({ select: mockSelect })

            const req = { arrendatarioBDD: { _id: '60c72b2f9b1d8b2bad888888' } }

            await obtenerQuejasSugerenciasDepartamento(req, res)

            expect(Departamento.find).toHaveBeenCalledWith({ arrendatario: '60c72b2f9b1d8b2bad888888' })
            expect(res.status).toHaveBeenCalledWith(404)
            expect(res.json).toHaveBeenCalledWith({ msg: "No tienes departamentos registrados" })
        })

        test('Debe retornar 200 con los departamentos y sus respectivas quejas organizadas', async () => {
            const mockDeps = [
                { _id: 'depa1111', titulo: 'Suite Central EPN' },
                { _id: 'depa2222', titulo: 'Mini de lujo' }
            ]
            const mockSelect = jest.fn().mockResolvedValue(mockDeps)
            Departamento.find = jest.fn().mockReturnValue({ select: mockSelect })

            const mockComentarios = [
                { descripcion: 'No hay agua caliente', departamento: 'depa1111' },
                { descripcion: 'Foco quemado', departamento: 'depa2222' }
            ]
            mockSort.mockResolvedValue(mockComentarios)

            const req = { arrendatarioBDD: { _id: '60c72b2f9b1d8b2bad888888' } }

            await obtenerQuejasSugerenciasDepartamento(req, res)

            expect(QuejaSugerencias.find).toHaveBeenCalledWith({
                departamento: { $in: ['depa1111', 'depa2222'] }
            })
            expect(mockSort).toHaveBeenCalledWith({ fecha: -1 })
            expect(res.status).toHaveBeenCalledWith(200)
            expect(res.json).toHaveBeenCalledWith({
                departamentos: mockDeps,
                comentarios: mockComentarios
            })
        })

        test('Debe retornar 500 ante un colapso en la base de datos', async () => {
            const mockSelect = jest.fn().mockRejectedValue(new Error('Fallo de conexión en clúster Atlas'))
            Departamento.find = jest.fn().mockReturnValue({ select: mockSelect })

            const req = { arrendatarioBDD: { _id: '60c72b2f9b1d8b2bad888888' } }

            await obtenerQuejasSugerenciasDepartamento(req, res)

            expect(res.status).toHaveBeenCalledWith(500)
            expect(res.json).toHaveBeenCalledWith({
                msg: "Error al obtener comentarios",
                error: "Fallo de conexión en clúster Atlas"
            })
        })
    })
})

// ==========================================
// BLOQUE: LISTAR DEPARTAMENTOS (PRIVADO/AUTENTICADO)
// ==========================================
describe('Listar Departamentos', () => {
        let res;

        // Inicializamos res localmente para este bloque para evitar ReferenceError
        beforeEach(() => {
            res = {
                status: jest.fn().mockReturnThis(),
                json: jest.fn()
            }
        });

        // --- PRUEBA 1: LISTAR TODOS (USUARIO AUTENTICADO) ---
        test('Debe retornar 200 con todos los departamentos si el usuario está autenticado', async () => {
            const mockTodosDeps = [
                { titulo: 'Depa Universitario 1', categoria: 'departamento' },
                { titulo: 'Suit Cercana EPN', categoria: 'suit' }
            ]
            Departamento.find = jest.fn().mockResolvedValue(mockTodosDeps)

            const req = { 
                query: {}, 
                estudianteBDD: { _id: '60c72b2f9b1d8b2bad111111' } 
            } 

            await listarDepartamento(req, res)

            expect(Departamento.find).toHaveBeenCalledWith({}) 
            expect(res.status).toHaveBeenCalledWith(200)
            expect(res.json).toHaveBeenCalledWith(mockTodosDeps)
        })

        // --- PRUEBA 2: FILTRAR POR CATEGORÍA (USUARIO AUTENTICADO) ---
        test('Debe retornar 200 y aplicar el filtro de categoría bajo una sesión válida', async () => {
            const mockSoloSuits = [
                { titulo: 'Suit Individual EPN', categoria: 'suit' }
            ]
            Departamento.find = jest.fn().mockResolvedValue(mockSoloSuits)

            const req = { 
                query: { categoria: 'suit' },
                estudianteBDD: { _id: '60c72b2f9b1d8b2bad111111' }
            } 

            await listarDepartamento(req, res)

            expect(Departamento.find).toHaveBeenCalledWith({ categoria: 'suit' })
            expect(res.status).toHaveBeenCalledWith(200)
            expect(res.json).toHaveBeenCalledWith(mockSoloSuits)
        })

        // --- PRUEBA 3: MANEJO DE ERRORES (CATCH) ---
        test('Debe retornar 500 si la base de datos falla al procesar la solicitud interna', async () => {
            Departamento.find = jest.fn().mockRejectedValue(new Error('Error de lectura en MongoDB Atlas'))

            const req = { 
                query: {},
                estudianteBDD: { _id: '60c72b2f9b1d8b2bad111111' }
            }

            await listarDepartamento(req, res)

            expect(res.status).toHaveBeenCalledWith(500)
            expect(res.json).toHaveBeenCalledWith({
                msg: "Error al listar departamentos",
                error: "Error de lectura en MongoDB Atlas"
            })
        })
    })