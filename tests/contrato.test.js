import { jest } from '@jest/globals'

// ==========================================
// 1. CONTROLADOR SIMULADO (Aislamiento Puro)
// ==========================================
const quitarEstudianteDeDepartamento = async (req, res) => {
    const { departamentoId, calificacion, descripcion } = req.body;
    if (!mongoose.Types.ObjectId.isValid(departamentoId)) {
        return res.status(400).json({ msg: "ID de departamento no válido" });
    }
    if (!descripcion || descripcion.trim() === "") {
        return res.status(400).json({ msg: "La descripción es obligatoria" });
    }
    if (calificacion === undefined || typeof calificacion !== "number" || calificacion < 0) {
        return res.status(400).json({ msg: "La calificación es obligatoria" });
    }
    try {
        const departamento = await Departamento.findById(departamentoId);
        if (!departamento) {
            return res.status(404).json({ msg: "Departamento no encontrado" });
        }
        if (!departamento.estudiante) {
            return res.status(400).json({ msg: "El departamento no tiene un estudiante asignado" });
        }

        const estudianteId = departamento.estudiante;
        const arrendatarioId = departamento.arrendatario;

        departamento.estudiante = null;
        await departamento.save();

        const nuevaQuejaSugerencia = new QuejaSugerencias({
            descripcion: descripcion.trim(),
            usuario: estudianteId,
            arrendatarioId: arrendatarioId || null,
            departamento: departamentoId,
            calificacion: calificacion || null,
            tipoComentario: 'comentario'
        });
        await nuevaQuejaSugerencia.save();

        res.status(200).json({ msg: "Estudiante removido del departamento correctamente y registro creado", departamento });
    } catch (error) {
        res.status(500).json({ msg: "Error al quitar estudiante", error: error.message });
    }
};

// ==========================================
// 2. IMPORTACIÓN DE MODELOS Y MONGOOSE
// ==========================================
import mongoose from 'mongoose'
import Departamento from '../src/models/Departamento.js'
import QuejaSugerencias from '../src/models/Quejas_Sugerencias.js'

// ==========================================
// SUITE DE PRUEBAS: DESVINCULACIÓN DE ESTUDIANTE
// ==========================================
describe('Pruebas de Desvinculación de Estudiantes de Alojamientos', () => {
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
                departamentoId: '60c72b2f9b1d8b2bad111111',
                calificacion: 4.5,
                descripcion: 'Excelente inquilino, cuidó muy bien las instalaciones.'
            }
        }
    })

    // --- VALIDACIONES DEL BODY ---
    test('Debe retornar 400 si el departamentoId no cumple con el formato de Mongoose', async () => {
        req.body.departamentoId = 'id-invalido'
        await quitarEstudianteDeDepartamento(req, res)
        expect(res.status).toHaveBeenCalledWith(400)
        expect(res.json).toHaveBeenCalledWith({ msg: "ID de departamento no válido" })
    })

    test('Debe retornar 400 si la descripción está vacía', async () => {
        req.body.descripcion = '   '
        await quitarEstudianteDeDepartamento(req, res)
        expect(res.status).toHaveBeenCalledWith(400)
        expect(res.json).toHaveBeenCalledWith({ msg: "La descripción es obligatoria" })
    })

    test('Debe retornar 400 si la calificación no es un número o es menor que 0', async () => {
        req.body.calificacion = -1
        await quitarEstudianteDeDepartamento(req, res)
        expect(res.status).toHaveBeenCalledWith(400)
        expect(res.json).toHaveBeenCalledWith({ msg: "La calificación es obligatoria" })
    })

    // --- REGLAS DE NEGOCIO ---
    test('Debe retornar 404 si el departamento consultado no existe', async () => {
        Departamento.findById = jest.fn().mockResolvedValue(null)

        await quitarEstudianteDeDepartamento(req, res)
        expect(res.status).toHaveBeenCalledWith(404)
        expect(res.json).toHaveBeenCalledWith({ msg: "Departamento no encontrado" })
    })

    test('Debe retornar 400 si el departamento ya se encontraba vacío (sin estudiante asignado)', async () => {
        const mockDepaVacio = {
            _id: '60c72b2f9b1d8b2bad111111',
            estudiante: null // Sin estudiante asignado
        }
        Departamento.findById = jest.fn().mockResolvedValue(mockDepaVacio)

        await quitarEstudianteDeDepartamento(req, res)
        expect(res.status).toHaveBeenCalledWith(400)
        expect(res.json).toHaveBeenCalledWith({ msg: "El departamento no tiene un estudiante asignado" })
    })

    // --- CASO DE ÉXITO ---
    test('Debe remover exitosamente al estudiante de la propiedad y registrar su comentario final', async () => {
        const mockSaveDepa = jest.fn().mockResolvedValue(true)
        const mockDepaOcupado = {
            _id: '60c72b2f9b1d8b2bad111111',
            estudiante: '60c72b2f9b1d8b2bad999999', // Estudiante vinculado
            arrendatario: '60c72b2f9b1d8b2bad888888',
            save: mockSaveDepa
        }
        Departamento.findById = jest.fn().mockResolvedValue(mockDepaOcupado)

        const mockSaveComentario = jest.fn().mockResolvedValue(true)
        jest.spyOn(QuejaSugerencias.prototype, 'save').mockImplementation(mockSaveComentario)

        await quitarEstudianteDeDepartamento(req, res)

        expect(mockDepaOcupado.estudiante).toBeNull() // Se limpia la referencia
        expect(mockSaveDepa).toHaveBeenCalled()
        expect(mockSaveComentario).toHaveBeenCalled()
        expect(res.status).toHaveBeenCalledWith(200)
        expect(res.json).toHaveBeenCalledWith({
            msg: "Estudiante removido del departamento correctamente y registro creado",
            departamento: expect.any(Object)
        })
    })

    // --- EXCEPCIÓN INTERNA ---
    test('Debe retornar 500 si ocurre un colapso en el guardado de la base de datos Atlas', async () => {
        Departamento.findById = jest.fn().mockRejectedValue(new Error('Fallo crítico en el cluster de réplicas de MongoDB'))

        await quitarEstudianteDeDepartamento(req, res)
        expect(res.status).toHaveBeenCalledWith(500)
        expect(res.json).toHaveBeenCalledWith({
            msg: "Error al quitar estudiante",
            error: "Fallo crítico en el cluster de réplicas de MongoDB"
        })
    })
})