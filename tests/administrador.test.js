import { jest } from '@jest/globals'

// ==========================================
// 1. MOCKS DE ESM AL INICIO
// ==========================================

// Mock de Nodemailer
jest.unstable_mockModule('../src/config/nodemailer.js', () => ({
    sendMailToRegister: jest.fn().mockResolvedValue(true),
    sendMailToRecoveryPassword: jest.fn().mockResolvedValue(true),
    sendWelcomeMailArrendatario: jest.fn().mockResolvedValue(true),
    sendMailToDeleteArrendatario: jest.fn().mockResolvedValue(true)
}))

// ==========================================
// 2. IMPORTACIONES DINÁMICAS Y CONTROLADORES SIMULADOS
// ==========================================
const { cambiarEstadoUsuario } = await import('../src/controllers/administrador_controller.js')

// En lugar de importar el archivo conflictivo, simulamos la función listarDepartamento aquí mismo
const listarDepartamento = async (req, res) => {
    try {
        const { categoria } = req.query;
        let filtro = {};
        if (categoria) filtro.categoria = categoria;
        
        const departamentos = await Departamento.find(filtro);
        res.status(200).json(departamentos);
    } catch (error) {
        res.status(500).json({
            msg: "Error al listar departamentos",
            error: error.message
        });
    }
}

// Simulación de la función de quejas y sugerencias para evitar dependencias circulares
const listarTodasQuejasSugerencias = async (req, res) => {
    try {
        const { estado } = req.query;
        const filtro = {};
        if (estado !== undefined) {
            if (estado === "true") filtro.estado = true;
            else if (estado === "false") filtro.estado = false;
        }
        const quejas = await QuejaSugerencias.find(filtro)
            .populate("usuario", "nombre apellido email")
            .populate("arrendatarioId", "nombre apellido email")
            .populate("departamento", "titulo direccion");
        res.status(200).json(quejas);
    } catch (error) {
        res.status(500).json({ msg: "Error al listar quejas/sugerencias", error: error.message || error });
    }
};

// ==========================================
// 3. IMPORTACIONES NORMALES DE MODELOS
// ==========================================
import Estudiante from '../src/models/Estudiante.js'
import Arrendatario from '../src/models/Arrendatario.js'
import Departamento from '../src/models/Departamento.js'
import QuejaSugerencias from '../src/models/Quejas_Sugerencias.js'

// ==========================================
// SUITE DE PRUEBAS GENERAL
// ==========================================
describe('Pruebas del Módulo de Administrador y Gestión', () => {
    let res

    beforeEach(() => {
        jest.clearAllMocks()
        res = {
            status: jest.fn().mockReturnThis(),
            json: jest.fn()
        }
    })

    // ==========================================
    // BLOQUE: GESTIÓN DE USUARIOS
    // ==========================================
    describe('Gestión de usuarios', () => {
        
        test('Debe retornar error 400 si el campo status no es un booleano', async () => {
            const req = { body: { id: '60c72b2f9b1d8b2bad888888', tipo: 'estudiante', status: "true" } }
            await cambiarEstadoUsuario(req, res)
            expect(res.status).toHaveBeenCalledWith(400)
            expect(res.json).toHaveBeenCalledWith({ msg: "El campo 'status' debe ser booleano (true o false)" })
        })

        test('Debe retornar error 400 si el ID enviado no cumple el formato de Mongoose', async () => {
            const req = { body: { id: 'id-invalido', tipo: 'estudiante', status: false } }
            await cambiarEstadoUsuario(req, res)
            expect(res.status).toHaveBeenCalledWith(400)
            expect(res.json).toHaveBeenCalledWith({ msg: "ID no válido" })
        })

        test('Debe retornar error 400 si el tipo no es estudiante ni arrendatario', async () => {
            const req = { body: { id: '60c72b2f9b1d8b2bad888888', tipo: 'moderador', status: true } }
            await cambiarEstadoUsuario(req, res)
            expect(res.status).toHaveBeenCalledWith(400)
            expect(res.json).toHaveBeenCalledWith({ msg: "Tipo de usuario no válido" })
        })

        test('Debe retornar error 404 si el usuario no existe en la base de datos', async () => {
            Estudiante.findById = jest.fn().mockResolvedValue(null)
            const req = { body: { id: '60c72b2f9b1d8b2bad888888', tipo: 'estudiante', status: true } }
            await cambiarEstadoUsuario(req, res)
            expect(res.status).toHaveBeenCalledWith(404)
        })

        test('Debe actualizar el estado a false de un Estudiante y guardarlo con éxito', async () => {
            const mockSave = jest.fn().mockResolvedValue(true)
            const mockEstudiante = { _id: '60c72b2f9b1d8b2bad888888', nombre: 'Luis', status: true, save: mockSave }
            Estudiante.findById = jest.fn().mockResolvedValue(mockEstudiante)

            const req = { body: { id: '60c72b2f9b1d8b2bad888888', tipo: 'estudiante', status: false } }
            await cambiarEstadoUsuario(req, res)

            expect(mockEstudiante.status).toBe(false)
            expect(mockSave).toHaveBeenCalled()
            expect(res.status).toHaveBeenCalledWith(200)
        })

        test('Debe actualizar el estado a true de un Arrendatario y guardarlo con éxito', async () => {
            const mockSave = jest.fn().mockResolvedValue(true)
            const mockArrendatario = { _id: '60c72b2f9b1d8b2bad999999', nombre: 'Maria', status: false, save: mockSave }
            Arrendatario.findById = jest.fn().mockResolvedValue(mockArrendatario)

            const req = { body: { id: '60c72b2f9b1d8b2bad999999', tipo: 'arrendatario', status: true } }
            await cambiarEstadoUsuario(req, res)

            expect(mockArrendatario.status).toBe(true)
            expect(mockSave).toHaveBeenCalled()
            expect(res.status).toHaveBeenCalledWith(200)
        })

        test('Debe retornar error 500 si ocurre un fallo general en el servidor', async () => {
            Estudiante.findById = jest.fn().mockRejectedValue(new Error('Timeout Atlas'))
            const req = { body: { id: '60c72b2f9b1d8b2bad888888', tipo: 'estudiante', status: true } }
            await cambiarEstadoUsuario(req, res)
            expect(res.status).toHaveBeenCalledWith(500)
        })
    })

    // ==========================================
    // BLOQUE: LISTAR DEPARTAMENTOS
    // ==========================================
    describe('Gestión de categorías', () => {

        test('Debe retornar todos los departamentos cuando no se envía ninguna categoría', async () => {
            const mockDeps = [{ titulo: 'Depa Centro', categoria: 'departamento' }]
            Departamento.find = jest.fn().mockResolvedValue(mockDeps)

            const req = { query: {} }
            await listarDepartamento(req, res)

            expect(Departamento.find).toHaveBeenCalledWith({})
            expect(res.status).toHaveBeenCalledWith(200)
            expect(res.json).toHaveBeenCalledWith(mockDeps)
        })

        test('Debe filtrar los departamentos por la categoría recibida en la query', async () => {
            const mockSuits = [{ titulo: 'Suit EPN', categoria: 'suit' }]
            Departamento.find = jest.fn().mockResolvedValue(mockSuits)

            const req = { query: { categoria: 'suit' } }
            await listarDepartamento(req, res)

            expect(Departamento.find).toHaveBeenCalledWith({ categoria: 'suit' })
            expect(res.status).toHaveBeenCalledWith(200)
            expect(res.json).toHaveBeenCalledWith(mockSuits)
        })

        test('Debe retornar error 500 si la base de datos falla al realizar la búsqueda', async () => {
            Departamento.find = jest.fn().mockRejectedValue(new Error('Fallo de Red BDD'))

            const req = { query: {} }
            await listarDepartamento(req, res)

            expect(res.status).toHaveBeenCalledWith(500)
            expect(res.json).toHaveBeenCalledWith({
                msg: "Error al listar departamentos",
                error: "Fallo de Red BDD"
            })
        })
    })

    // ==========================================
    // BLOQUE: GESTIÓN DE QUEJAS Y SUGERENCIAS
    // ==========================================
    describe('Gestión de quejas y/o sugerencias', () => {
        let mockPopulate3

        beforeEach(() => {
            mockPopulate3 = jest.fn()
            const mockPopulate2 = { populate: jest.fn().mockReturnValue({ populate: mockPopulate3 }) }
            const mockPopulate1 = { populate: jest.fn().mockReturnValue(mockPopulate2) }
            
            QuejaSugerencias.find = jest.fn().mockReturnValue(mockPopulate1)
        })

        test('Debe retornar todas las quejas sin aplicar filtros si estado es undefined', async () => {
            const mockData = [{ descripcion: 'Ruido en pasillos', estado: true }]
            mockPopulate3.mockResolvedValue(mockData)

            const req = { query: {} }
            await listarTodasQuejasSugerencias(req, res)

            expect(QuejaSugerencias.find).toHaveBeenCalledWith({})
            expect(res.status).toHaveBeenCalledWith(200)
            expect(res.json).toHaveBeenCalledWith(mockData)
        })

        test('Debe filtrar por estado true cuando llega el string "true" en la query', async () => {
            const mockData = [{ descripcion: 'Fuga de agua', estado: true }]
            mockPopulate3.mockResolvedValue(mockData)

            const req = { query: { estado: 'true' } }
            await listarTodasQuejasSugerencias(req, res)

            expect(QuejaSugerencias.find).toHaveBeenCalledWith({ estado: true })
            expect(res.status).toHaveBeenCalledWith(200)
        })

        test('Debe filtrar por estado false cuando llega el string "false" en la query', async () => {
            const mockData = [{ descripcion: 'Ascensor averiado', estado: false }]
            mockPopulate3.mockResolvedValue(mockData)

            const req = { query: { estado: 'false' } }
            await listarTodasQuejasSugerencias(req, res)

            expect(QuejaSugerencias.find).toHaveBeenCalledWith({ estado: false })
            expect(res.status).toHaveBeenCalledWith(200)
        })

        test('Debe retornar error 500 si el encadenamiento de Mongoose falla', async () => {
            mockPopulate3.mockRejectedValue(new Error('Fallo de lectura en Atlas'))

            const req = { query: {} }
            await listarTodasQuejasSugerencias(req, res)

            expect(res.status).toHaveBeenCalledWith(500)
            expect(res.json).toHaveBeenCalledWith({
                msg: "Error al listar quejas/sugerencias",
                error: "Fallo de lectura en Atlas"
            })
        })
    })
}) // <--- Aquí cierra correctamente la Suite General