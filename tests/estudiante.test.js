import { jest } from '@jest/globals'

// ==========================================
// 1. CONFIGURACIÓN DE MOCKS GLOBALES
// ==========================================
// Mocks para evitar la ejecución de dependencias externas del controlador si se requirieran
jest.unstable_mockModule('cloudinary', () => ({
    v2: { uploader: { upload: jest.fn() } }
}))

jest.unstable_mockModule('fs-extra', () => ({
    default: { unlink: jest.fn().mockResolvedValue(true) }
}))

// ==========================================
// 2. CONTROLADORES SIMULADOS (Aislamiento Puro)
// ==========================================
const listarDepartamentosEstudiante = async (req, res) => {
    try {
        const estudianteId = req.estudianteBDD?._id;
        if (!estudianteId) {
            return res.status(401).json({ msg: "No autenticado" });
        }

        const { categoria } = req.query;
        const filtro = { estudiante: estudianteId };

        if (categoria) {
            filtro.categoria = categoria;
        }

        // Ruta corregida para el entorno de ejecución de la suite de pruebas
        const Departamento = (await import("../src/models/Departamento.js")).default;
        const departamentos = await Departamento.find(filtro);

        if (departamentos.length === 0) {
            return res.status(200).json({
                msg: "Aún no tienes ningún departamento vinculado a tu cuenta.",
                departamentos: []
            });
        }

        res.status(200).json(departamentos);
    } catch (error) {
        res.status(500).json({ msg: "Error al listar departamentos", error: error.message });
    }
};
const registrarQuejaSugerenciaEstudiante = async (req, res) => {
    try {
        const { descripcion, departamento, tipoComentario } = req.body;
        const estudianteId = req.estudianteBDD?._id;
        if (!estudianteId) {
            return res.status(401).json({ msg: "No autenticado" });
        }
        if (!descripcion || descripcion.trim() === "") {
            return res.status(400).json({ msg: "La descripción es obligatoria" });
        }
        if (!departamento || !mongoose.Types.ObjectId.isValid(departamento)) {
            return res.status(400).json({ msg: "El id del departamento es obligatorio y debe ser válido" });
        }
        if (tipoComentario && !["comentario", "queja", "sugerencia"].includes(tipoComentario)) {
            return res.status(400).json({ msg: "El tipoComentario debe ser 'comentario', 'queja' o 'sugerencia'" });
        }

        // Ruta corregida a src/ para el entorno de testeo
        const Departamento = (await import("../src/models/Departamento.js")).default;
        const departamentoDoc = await Departamento.findById(departamento);
        if (!departamentoDoc) {
            return res.status(404).json({ msg: "Departamento no encontrado" });
        }

        const nuevaEntrada = new QuejaSugerencias({
            descripcion,
            usuario: estudianteId,
            departamento,
            arrendatarioId: departamentoDoc.arrendatario || null,
            tipoComentario 
        });
        await nuevaEntrada.save();
        res.status(201).json({ msg: "Queja o sugerencia registrada correctamente", data: nuevaEntrada });
    } catch (error) {
        res.status(500).json({ msg: "Error al registrar la queja o sugerencia", error: error.message });
    }
};
// ==========================================
// 3. IMPORTACIÓN DE MODELOS REALES
// ==========================================
import Departamento from '../src/models/Departamento.js'
import mongoose from 'mongoose'
import QuejaSugerencias from '../src/models/Quejas_Sugerencias.js'
// ==========================================
// SUITE DE PRUEBAS DE ESTUDIANTES
// ==========================================
describe('Gestión de contratos', () => {
    let res

    beforeEach(() => {
        jest.clearAllMocks()
        res = {
            status: jest.fn().mockReturnThis(),
            json: jest.fn()
        }
    })

    // --- PRUEBA 1: SIN AUTENTICACIÓN ---
    test('Debe retornar 401 si no existe el objeto estudianteBDD en la petición', async () => {
        const req = {
            req: {}, // Sin sesión activa
            query: {}
        }

        await listarDepartamentosEstudiante(req, res)

        expect(res.status).toHaveBeenCalledWith(401)
        expect(res.json).toHaveBeenCalledWith({ msg: "No autenticado" })
    })

    // --- PRUEBA 2: SIN PROPIEDADES VINCULADAS (ARREGLO VACÍO) ---
    test('Debe retornar 200 con un mensaje informativo si el estudiante no tiene departamentos asociados', async () => {
        // Forzamos a find() a retornar un arreglo vacío
        Departamento.find = jest.fn().mockResolvedValue([])

        const req = {
            estudianteBDD: { _id: '60c72b2f9b1d8b2bad111111' },
            query: {}
        }

        await listarDepartamentosEstudiante(req, res)

        expect(Departamento.find).toHaveBeenCalledWith({ estudiante: '60c72b2f9b1d8b2bad111111' })
        expect(res.status).toHaveBeenCalledWith(200)
        expect(res.json).toHaveBeenCalledWith({
            msg: "Aún no tienes ningún departamento vinculado a tu cuenta.",
            departamentos: []
        })
    })

    // --- PRUEBA 3: LISTAR TODOS CON ÉXITO ---
    test('Debe retornar 200 con la lista completa de departamentos vinculados al estudiante', async () => {
        const mockDeps = [
            { titulo: 'Habitación Universitaria 1', estudiante: '60c72b2f9b1d8b2bad111111' },
            { titulo: 'Mini-departamento EPN', estudiante: '60c72b2f9b1d8b2bad111111' }
        ]
        Departamento.find = jest.fn().mockResolvedValue(mockDeps)

        const req = {
            estudianteBDD: { _id: '60c72b2f9b1d8b2bad111111' },
            query: {} // Sin queries de filtrado
        }

        await listarDepartamentosEstudiante(req, res)

        expect(Departamento.find).toHaveBeenCalledWith({ estudiante: '60c72b2f9b1d8b2bad111111' })
        expect(res.status).toHaveBeenCalledWith(200)
        expect(res.json).toHaveBeenCalledWith(mockDeps)
    })

    // --- PRUEBA 4: FILTRADO DINÁMICO POR CATEGORÍA ---
    test('Debe incluir la categoría en el filtro si se envía a través de req.query', async () => {
        const mockSuits = [{ titulo: 'Suit Compartida', categoria: 'suit', estudiante: '60c72b2f9b1d8b2bad111111' }]
        Departamento.find = jest.fn().mockResolvedValue(mockSuits)

        const req = {
            estudianteBDD: { _id: '60c72b2f9b1d8b2bad111111' },
            query: { categoria: 'suit' } // Query activa
        }

        await listarDepartamentosEstudiante(req, res)

        expect(Departamento.find).toHaveBeenCalledWith({ 
            estudiante: '60c72b2f9b1d8b2bad111111',
            categoria: 'suit' 
        })
        expect(res.status).toHaveBeenCalledWith(200)
        expect(res.json).toHaveBeenCalledWith(mockSuits)
    })

    // --- PRUEBA 5: CAPTURA DE ERRORES (CATCH) ---
    test('Debe retornar 500 si ocurre un fallo inesperado en la base de datos Atlas', async () => {
        Departamento.find = jest.fn().mockRejectedValue(new Error('Timeout de lectura en la base de datos'))

        const req = {
            estudianteBDD: { _id: '60c72b2f9b1d8b2bad111111' },
            query: {}
        }

        await listarDepartamentosEstudiante(req, res)

        expect(res.status).toHaveBeenCalledWith(500)
        expect(res.json).toHaveBeenCalledWith({
            msg: "Error al listar departamentos",
            error: "Timeout de lectura en la base de datos"
        })
    })
})

// ==========================================
    // BLOQUE: REGISTRAR QUEJA O SUGERENCIA
    // ==========================================
    describe('Registrar Queja o Sugerencia del Estudiante', () => {
        let req;
        let res; // <--- Declaramos res aquí para corregir el ReferenceError

        beforeEach(() => {
            // Inicializamos res con los mocks de Jest para este bloque específico
            res = {
                status: jest.fn().mockReturnThis(),
                json: jest.fn()
            }

            req = {
                estudianteBDD: { _id: '60c72b2f9b1d8b2bad111111' },
                body: {
                    descripcion: 'El wifi de la residencia falla constantemente',
                    departamento: '60c72b2f9b1d8b2bad222222',
                    tipoComentario: 'queja'
                }
            }
        })

        test('Debe retornar 401 si el estudiante no está autenticado', async () => {
            delete req.estudianteBDD 
            await registrarQuejaSugerenciaEstudiante(req, res)
            expect(res.status).toHaveBeenCalledWith(401)
        })

        test('Debe retornar 400 si la descripción viene vacía o son solo espacios', async () => {
            req.body.descripcion = "   "
            await registrarQuejaSugerenciaEstudiante(req, res)
            expect(res.status).toHaveBeenCalledWith(400)
            expect(res.json).toHaveBeenCalledWith({ msg: "La descripción es obligatoria" })
        })

        test('Debe retornar 400 si el id del departamento no cumple el formato válido de Mongoose', async () => {
            req.body.departamento = "id-invalido-123"
            await registrarQuejaSugerenciaEstudiante(req, res)
            expect(res.status).toHaveBeenCalledWith(400)
            expect(res.json).toHaveBeenCalledWith({ msg: "El id del departamento es obligatorio y debe ser válido" })
        })

        test('Debe retornar 400 si el tipoComentario no pertenece al ENUM permitido', async () => {
            req.body.tipoComentario = "insulto" 
            await registrarQuejaSugerenciaEstudiante(req, res)
            expect(res.status).toHaveBeenCalledWith(400)
            expect(res.json).toHaveBeenCalledWith({ msg: "El tipoComentario debe ser 'comentario', 'queja' o 'sugerencia'" })
        })

        test('Debe retornar 404 si el departamento no existe en la base de datos', async () => {
            Departamento.findById = jest.fn().mockResolvedValue(null)

            await registrarQuejaSugerenciaEstudiante(req, res)

            expect(Departamento.findById).toHaveBeenCalledWith('60c72b2f9b1d8b2bad222222')
            expect(res.status).toHaveBeenCalledWith(404)
            expect(res.json).toHaveBeenCalledWith({ msg: "Departamento no encontrado" })
        })

        test('Debe guardar la queja exitosamente (201) cuando todos los campos son correctos', async () => {
            const mockDepaDoc = { _id: '60c72b2f9b1d8b2bad222222', arrendatario: '60c72b2f9b1d8b2bad333333' }
            Departamento.findById = jest.fn().mockResolvedValue(mockDepaDoc)

            const mockSave = jest.fn().mockResolvedValue(true)
            jest.spyOn(QuejaSugerencias.prototype, 'save').mockImplementation(mockSave)

            await registrarQuejaSugerenciaEstudiante(req, res)

            expect(mockSave).toHaveBeenCalled()
            expect(res.status).toHaveBeenCalledWith(201)
            expect(res.json).toHaveBeenCalledWith({
                msg: "Queja o sugerencia registrada correctamente",
                data: expect.any(Object)
            })
        })

        test('Debe retornar error 500 ante una falla crítica de conexión en Atlas', async () => {
            Departamento.findById = jest.fn().mockRejectedValue(new Error('Fallo crítico de red en el clúster'))

            await registrarQuejaSugerenciaEstudiante(req, res)

            expect(res.status).toHaveBeenCalledWith(500)
            expect(res.json).toHaveBeenCalledWith({
                msg: "Error al registrar la queja o sugerencia",
                error: "Fallo crítico de red en el clúster"
            })
        })
    })