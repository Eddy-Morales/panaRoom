import { jest } from '@jest/globals'

// ==========================================
// 1. TODOS LOS MOCKS DE ESM AL INICIO
// ==========================================
jest.unstable_mockModule('../src/config/nodemailer.js', () => ({
    sendMailToRegister: jest.fn().mockResolvedValue(true),
    sendMailToRecoveryPassword: jest.fn().mockResolvedValue(true) // <-- Faltaba esta línea aquí dentro
}))

jest.unstable_mockModule('../src/middlewares/JWT.js', () => ({
    crearTokenJWT: jest.fn().mockReturnValue('mocked_jwt_token_123')
}))

// ==========================================
// 2. TODAS LAS IMPORTACIONES DINÁMICAS (CON AWAIT)
// ==========================================
const { sendMailToRegister, sendMailToRecoveryPassword } = await import('../src/config/nodemailer.js')
const { crearTokenJWT } = await import('../src/middlewares/JWT.js')

const { registrarEstudiante } = await import('../src/controllers/estudiante_controller.js')
const { login, actualizarPerfil, 
    recuperarPassword, 
    actualizarPassword, 
    listarDepartamentosArrendatario } = await import('../src/controllers/arrendatario_controller.js')

// ==========================================
// 3. IMPORTACIONES NORMALES DE MODELOS
// ==========================================
import Estudiante from '../src/models/Estudiante.js'
import Arrendatario from '../src/models/Arrendatario.js'
import Departamento from '../src/models/Departamento.js'


describe('Registro de Estudiante', () => {

    let res

    beforeEach(() => {
        jest.clearAllMocks()

        res = {
            status: jest.fn().mockReturnThis(),
            json: jest.fn()
        }

        Estudiante.findOne = jest.fn().mockResolvedValue(null)
    })

    test('Debe retornar error cuando existen campos vacíos', async () => {
        const req = {
            body: {
                nombre: '',
                apellido: '',
                celular: '',
                email: '',
                password: ''
            }
        }

        await registrarEstudiante(req, res)

        expect(res.status).toHaveBeenCalledWith(400)
        expect(res.json).toHaveBeenCalledWith({
            msg: 'Todos los campos son obligatorios y no pueden contener solo espacios'
        })
    })

    test('Debe retornar error cuando el nombre tiene menos de 3 caracteres', async () => {
        const req = {
            body: {
                nombre: 'Ed',
                apellido: 'Morales',
                celular: '0999999999',
                email: 'eddy@test.com',
                password: '12345678'
            }
        }

        await registrarEstudiante(req, res)

        expect(res.status).toHaveBeenCalledWith(400)
        expect(res.json).toHaveBeenCalledWith({
            msg: 'El nombre debe tener entre 3 y 30 caracteres.'
        })
    })

    test('Debe retornar error cuando el apellido tiene menos de 3 caracteres', async () => {
        const req = {
            body: {
                nombre: 'Eddy',
                apellido: 'Mo',
                celular: '0999999999',
                email: 'eddy@test.com',
                password: '12345678'
            }
        }

        await registrarEstudiante(req, res)

        expect(res.status).toHaveBeenCalledWith(400)
        expect(res.json).toHaveBeenCalledWith({
            msg: 'El apellido debe tener entre 3 y 30 caracteres.'
        })
    })

    test('Debe retornar error cuando el celular no tiene 10 dígitos', async () => {
        const req = {
            body: {
                nombre: 'Eddy',
                apellido: 'Morales',
                celular: '12345',
                email: 'eddy@test.com',
                password: '12345678'
            }
        }

        await registrarEstudiante(req, res)

        expect(res.status).toHaveBeenCalledWith(400)
        expect(res.json).toHaveBeenCalledWith({
            msg: 'El celular debe contener exactamente 10 dígitos numéricos.'
        })
    })

    test('Debe retornar error cuando el correo es inválido', async () => {
        const req = {
            body: {
                nombre: 'Eddy',
                apellido: 'Morales',
                celular: '0999999999',
                email: 'correo_invalido',
                password: '12345678'
            }
        }

        await registrarEstudiante(req, res)

        expect(res.status).toHaveBeenCalledWith(400)
        expect(res.json).toHaveBeenCalledWith({
            msg: 'Debe ingresar un correo electrónico válido.'
        })
    })

    test('Debe retornar error cuando la contraseña tiene menos de 8 caracteres', async () => {
        const req = {
            body: {
                nombre: 'Eddy',
                apellido: 'Morales',
                celular: '0999999999',
                email: 'eddy@test.com',
                password: '123'
            }
        }

        await registrarEstudiante(req, res)

        expect(res.status).toHaveBeenCalledWith(400)
        expect(res.json).toHaveBeenCalledWith({
            msg: 'La contraseña debe tener entre 8 y 20 caracteres.'
        })
    })

    test('Debe retornar error cuando el email ya está registrado', async () => {
        Estudiante.findOne = jest.fn().mockResolvedValue({
            _id: '123456'
        })

        const req = {
            body: {
                nombre: 'Eddy',
                apellido: 'Morales',
                celular: '0999999999',
                email: 'eddy@test10.com',
                password: '12345678'
            }
        }

        await registrarEstudiante(req, res)

        expect(res.status).toHaveBeenCalledWith(400)
        expect(res.json).toHaveBeenCalledWith({
            msg: 'El Email ya está registrado'
        })
    })

    // ==========================================
    // NUEVO: CASO DE PRUEBA EXITOSO
    // ==========================================
    test('Debe registrar exitosamente un estudiante y enviar el correo de confirmación', async () => {
        // Mockear el .save() del prototipo de Mongoose para simular el guardado exitoso
        const mockSave = jest.fn().mockResolvedValue({
            _id: 'mock_id_generado',
            nombre: 'Eddy',
            apellido: 'Morales',
            email: 'eddy@test.com',
            token: 'token_mock_123'
        })
        jest.spyOn(Estudiante.prototype, 'save').mockImplementation(mockSave)

        const req = {
            body: {
                nombre: 'Eddy',
                apellido: 'Morales',
                celular: '0999999999',
                email: 'eddy@test.com',
                password: 'passwordSeguro123'
            }
        }

        await registrarEstudiante(req, res)

        // Verificaciones del Estado de Respuesta HTTP
        expect(res.status).toHaveBeenCalledWith(200) 
        
        // Ajustamos la 'R' mayúscula para que coincida exactamente con tu respuesta
        expect(res.json).toHaveBeenCalledWith(
            expect.objectContaining({
                msg: expect.stringContaining('Revisa tu correo') 
            })
        )

        // Verificar que interactuó con la Base de Datos y el servicio de Mail
        expect(mockSave).toHaveBeenCalled()
        expect(sendMailToRegister).toHaveBeenCalled() // o sendMailToRegister según tu mock
    })

})

describe('Login de Arrendatario', () => {

    let res

    beforeEach(() => {
        jest.clearAllMocks()

        res = {
            status: jest.fn().mockReturnThis(),
            json: jest.fn()
        }
    })

    // --- PRUEBA 1: CAMPOS VACÍOS ---
    test('Debe retornar error 400 si existen campos vacíos', async () => {
        const req = {
            body: {
                email: '',
                password: 'password123'
            }
        }

        await login(req, res)

        expect(res.status).toHaveBeenCalledWith(400)
        expect(res.json).toHaveBeenCalledWith({
            msg: "Lo sentimos, debes llenar todos los campos"
        })
    })

    // --- PRUEBA 2: USUARIO NO REGISTRADO ---
    test('Debe retornar error 404 si el usuario no se encuentra registrado', async () => {
        // Simular que no encuentra nada en la BDD
        Arrendatario.findOne = jest.fn().mockReturnThis()
        Arrendatario.select = jest.fn().mockResolvedValue(null)

        const req = {
            body: {
                email: 'no_existe@test.com',
                password: 'password123'
            }
        }

        await login(req, res)

        expect(res.status).toHaveBeenCalledWith(404)
        expect(res.json).toHaveBeenCalledWith({
            msg: "Lo sentimos, el usuario no se encuentra registrado"
        })
    })

    // --- PRUEBA 3: LOGIN CON GOOGLE (Sin contraseña local) ---
    test('Debe retornar error 400 si el usuario no tiene contraseña (debe usar Google)', async () => {
        // Simular un usuario que se registró con Google y no tiene el campo password
        const mockArrendatario = {
            email: 'googleuser@test.com'
            // password: undefined
        }
        Arrendatario.findOne = jest.fn().mockReturnThis()
        Arrendatario.select = jest.fn().mockResolvedValue(mockArrendatario)

        const req = {
            body: {
                email: 'googleuser@test.com',
                password: 'password123'
            }
        }

        await login(req, res)

        expect(res.status).toHaveBeenCalledWith(400)
        expect(res.json).toHaveBeenCalledWith({
            msg: "Este usuario debe iniciar sesión con Google"
        })
    })

    // --- PRUEBA 4: CORREO NO VERIFICADO ---
    test('Debe retornar error 401 si la cuenta no ha sido verificada', async () => {
        const mockArrendatario = {
            email: 'unverified@test.com',
            password: 'hashed_password_123',
            confirmEmail: false // Cuenta sin verificar
        }
        Arrendatario.findOne = jest.fn().mockReturnThis()
        Arrendatario.select = jest.fn().mockResolvedValue(mockArrendatario)

        const req = {
            body: {
                email: 'unverified@test.com',
                password: 'password123'
            }
        }

        await login(req, res)

        expect(res.status).toHaveBeenCalledWith(401)
        expect(res.json).toHaveBeenCalledWith({
            msg: "Lo sentimos, debe verificar su cuenta, antes de iniciar sesión"
        })
    })

    // --- PRUEBA 5: CONTRASEÑA INCORRECTA ---
    test('Debe retornar error 401 si la contraseña es incorrecta', async () => {
        const mockArrendatario = {
            email: 'eddy@test.com',
            password: 'hashed_password_123',
            confirmEmail: true,
            matchPassword: jest.fn().mockResolvedValue(false) // Contraseña no coincide
        }
        Arrendatario.findOne = jest.fn().mockReturnThis()
        Arrendatario.select = jest.fn().mockResolvedValue(mockArrendatario)

        const req = {
            body: {
                email: 'eddy@test.com',
                password: 'wrong_password'
            }
        }

        await login(req, res)

        expect(res.status).toHaveBeenCalledWith(401)
        expect(res.json).toHaveBeenCalledWith({
            msg: "Lo sentimos, la contraseña es incorrecta"
        })
    })

    // --- PRUEBA 6: INICIO DE SESIÓN EXITOSO ---
    test('Debe iniciar sesión exitosamente y retornar los datos con el token JWT', async () => {
        const mockArrendatario = {
            _id: 'arrendatario_id_999',
            nombre: 'Juan',
            apellido: 'Pérez',
            direccion: 'Quito Centro',
            celular: '0987654321',
            rol: 'Arrendatario',
            password: 'hashed_password_123',
            confirmEmail: true,
            matchPassword: jest.fn().mockResolvedValue(true) // Contraseña correcta
        }
        Arrendatario.findOne = jest.fn().mockReturnThis()
        Arrendatario.select = jest.fn().mockResolvedValue(mockArrendatario)

        const req = {
            body: {
                email: 'juan@test.com',
                password: 'correct_password'
            }
        }

        await login(req, res)

        // Verificaciones
        expect(res.status).toHaveBeenCalledWith(200)
        expect(crearTokenJWT).toHaveBeenCalledWith('arrendatario_id_999', 'Arrendatario')
        expect(res.json).toHaveBeenCalledWith({
            token: 'mocked_jwt_token_123',
            rol: 'Arrendatario',
            nombre: 'Juan',
            apellido: 'Pérez',
            direccion: 'Quito Centro',
            celular: '0987654321',
            _id: 'arrendatario_id_999'
        })
    })
})

// ==========================================
// PRUEBAS DE MODIFICACIÓN DE PERFIL ARRENDATARIO
// ==========================================
describe('Modificación de perfil de Arrendatario', () => {
    let res

    beforeEach(() => {
        jest.clearAllMocks()
        res = {
            status: jest.fn().mockReturnThis(),
            json: jest.fn()
        }
    })

    // --- PRUEBA 1: ID INVÁLIDO ---
    test('Debe retornar error 404 si el ID no es un ObjectId válido de Mongoose', async () => {
        const req = {
            params: { id: 'id-invalido-123' },
            body: {}
        }

        await actualizarPerfil(req, res)

        expect(res.status).toHaveBeenCalledWith(404)
        expect(res.json).toHaveBeenCalledWith({
            msg: "Lo sentimos, debe ser un id válido"
        })
    })

    // --- PRUEBA 2: USUARIO NO ENCONTRADO ---
    test('Debe retornar error 404 si el arrendatario no existe en la BDD', async () => {
        // Simulamos un ID estructuralmente válido pero inexistente
        Arrendatario.findById = jest.fn().mockResolvedValue(null)

        const req = {
            params: { id: '60c72b2f9b1d8b2bad888888' },
            body: {}
        }

        await actualizarPerfil(req, res)

        expect(res.status).toHaveBeenCalledWith(404)
        expect(res.json).toHaveBeenCalledWith({
            msg: "Lo sentimos, no existe el arrendatario 60c72b2f9b1d8b2bad888888"
        })
    })

    // --- PRUEBA 3: VALIDACIÓN DE LONGITUD (NOMBRE CORTO) ---
    test('Debe retornar error 400 si el nombre modificado tiene menos de 3 caracteres', async () => {
        const mockArrendatario = { id: '60c72b2f9b1d8b2bad888888' }
        Arrendatario.findById = jest.fn().mockResolvedValue(mockArrendatario)

        const req = {
            params: { id: '60c72b2f9b1d8b2bad888888' },
            body: { nombre: 'Ed' } // Corto
        }

        await actualizarPerfil(req, res)

        expect(res.status).toHaveBeenCalledWith(400)
        expect(res.json).toHaveBeenCalledWith({
            msg: "El nombre debe tener entre 3 y 30 caracteres"
        })
    })

    // --- PRUEBA 4: VALIDACIÓN DE CELULAR ---
    test('Debe retornar error 400 si el formato de celular ecuatoriano no es válido', async () => {
        const mockArrendatario = { id: '60c72b2f9b1d8b2bad888888' }
        Arrendatario.findById = jest.fn().mockResolvedValue(mockArrendatario)

        const req = {
            params: { id: '60c72b2f9b1d8b2bad888888' },
            body: { celular: '0855555555' } // No empieza con 09
        }

        await actualizarPerfil(req, res)

        expect(res.status).toHaveBeenCalledWith(400)
        expect(res.json).toHaveBeenCalledWith({
            msg: "Ingrese un número celular válido"
        })
    })

    // --- PRUEBA 5: EMAIL DUPLICADO ---
    test('Debe retornar error 409 si intenta cambiar el correo a uno que ya está en uso', async () => {
        const mockArrendatario = { 
            id: '60c72b2f9b1d8b2bad888888',
            email: 'original@test.com'
        }
        Arrendatario.findById = jest.fn().mockResolvedValue(mockArrendatario)
        
        // Simular que findOne encuentra OTRO arrendatario con ese correo nuevo
        Arrendatario.findOne = jest.fn().mockResolvedValue({ id: '60c72b2f9b1d8b2bad999999' })

        const req = {
            params: { id: '60c72b2f9b1d8b2bad888888' },
            body: { email: 'nuevo_duplicado@test.com' }
        }

        await actualizarPerfil(req, res)

        expect(res.status).toHaveBeenCalledWith(409)
        expect(res.json).toHaveBeenCalledWith({
            msg: "Lo sentimos, el email ya se encuentra registrado"
        })
    })

    // --- PRUEBA 6: ACTUALIZACIÓN EXITOSA (FLUJO BÁSICO) ---
    test('Debe actualizar los datos básicos exitosamente sin modificar avatar', async () => {
        const mockSave = jest.fn().mockResolvedValue(true)
        const mockArrendatario = {
            id: '60c72b2f9b1d8b2bad888888',
            nombre: 'Juan',
            apellido: 'Perez',
            direccion: 'Quito Norte',
            celular: '0999999999',
            email: 'juan@test.com',
            save: mockSave
        }
        Arrendatario.findById = jest.fn().mockResolvedValue(mockArrendatario)

        const req = {
            params: { id: '60c72b2f9b1d8b2bad888888' },
            body: {
                nombre: 'Juan Carlos',
                direccion: 'Quito Sur (Modificado)'
            }
        }

        await actualizarPerfil(req, res)

        expect(mockSave).toHaveBeenCalled()
        expect(res.status).toHaveBeenCalledWith(200)
        // Comprobar que los campos en el objeto de respuesta mutaron correctamente
        expect(res.json).toHaveBeenCalledWith(
            expect.objectContaining({
                nombre: 'Juan Carlos',
                direccion: 'Quito Sur (Modificado)'
            })
        )
    })
})

// ==========================================
// PRUEBAS DE RECUPERACIÓN DE CONTRASEÑA ARRENDATARIO
// ==========================================
describe('Recuperar Contraseña de Arrendatario', () => {
    let res

    beforeEach(() => {
        jest.clearAllMocks()
        res = {
            status: jest.fn().mockReturnThis(),
            json: jest.fn()
        }
    })

    // --- PRUEBA 1: CAMPOS VACÍOS ---
    test('Debe retornar error 404 si el campo de email está vacío', async () => {
        const req = {
            body: { email: "" }
        }

        await recuperarPassword(req, res)

        expect(res.status).toHaveBeenCalledWith(404)
        expect(res.json).toHaveBeenCalledWith({
            msg: "Lo sentimos, debes llenar todos los campos"
        })
    })

    // --- PRUEBA 2: USUARIO NO REGISTRADO ---
    test('Debe retornar error 404 si el correo electrónico no pertenece a ningún arrendatario', async () => {
        // Simular que no se encuentra al usuario en la base de datos
        Arrendatario.findOne = jest.fn().mockResolvedValue(null)

        const req = {
            body: { email: "noexiste@test.com" }
        }

        await recuperarPassword(req, res)

        expect(res.status).toHaveBeenCalledWith(404)
        expect(res.json).toHaveBeenCalledWith({
            msg: "Lo sentimos, el usuario no se encuentra registrado"
        })
    })

    // --- PRUEBA 3: FLUJO EXITOSO ---
    test('Debe generar un token, guardarlo en la BDD, enviar el correo y responder con éxito 200', async () => {
        const mockSave = jest.fn().mockResolvedValue(true)
        const mockCrearToken = jest.fn().mockReturnValue('token_recuperacion_mock_123')
        
        const mockArrendatario = {
            email: 'eddy@test.com',
            token: null,
            crearToken: mockCrearToken,
            save: mockSave
        }

        // Simular que encuentra al arrendatario existente
        Arrendatario.findOne = jest.fn().mockResolvedValue(mockArrendatario)

        const req = {
            body: { email: 'eddy@test.com' }
        }

        await recuperarPassword(req, res)

        // 1. Validar que se llamó al generador de tokens interno del modelo
        expect(mockCrearToken).toHaveBeenCalled()

        // 2. Verificar que el token se asignó correctamente a la instancia
        expect(mockArrendatario.token).toBe('token_recuperacion_mock_123')

        // 3. Verificar que se llamó a la función de nodemailer mockeada al inicio del archivo
        expect(sendMailToRecoveryPassword).toHaveBeenCalledWith(
            'eddy@test.com', 
            'token_recuperacion_mock_123'
        )

        // 4. Validar persistencia en base de datos
        expect(mockSave).toHaveBeenCalled()

        // 5. Validar respuesta HTTP correcta enviada al cliente
        expect(res.status).toHaveBeenCalledWith(200)
        expect(res.json).toHaveBeenCalledWith({
            msg: "Revisa tu correo electrónico para reestablecer tu contraseña"
        })
    })
})

// ==========================================
// PRUEBAS DE RESTABLECIMIENTO DE CONTRASEÑA ARRENDATARIO
// ==========================================
describe('Restablecimiento de contraseña de Arrendatario', () => {
    let res

    beforeEach(() => {
        jest.clearAllMocks()
        res = {
            status: jest.fn().mockReturnThis(),
            json: jest.fn()
        }
    })

    // --- PRUEBA 1: USUARIO NO ENCONTRADO ---
    test('Debe retornar error 404 si el arrendatario no existe en la BDD', async () => {
        // Simular que no encuentra al usuario mediante el ID del token/request
        Arrendatario.findById = jest.fn().mockResolvedValue(null)

        const req = {
            arrendatarioBDD: { _id: '60c72b2f9b1d8b2bad888888' },
            body: {
                passwordactual: 'password123',
                passwordnuevo: 'nuevoPassword123'
            }
        }

        await actualizarPassword(req, res)

        expect(res.status).toHaveBeenCalledWith(404)
        expect(res.json).toHaveBeenCalledWith({
            // Evaluamos el msg exacto que tienes en tu controlador actual
            msg: expect.stringContaining('Lo sentimos, no existe el arrendatario')
        })
    })

    // --- PRUEBA 2: CONTRASEÑA ACTUAL INCORRECTA ---
    test('Debe retornar error 404 si la contraseña actual no coincide', async () => {
        const mockArrendatario = {
            _id: '60c72b2f9b1d8b2bad888888',
            matchPassword: jest.fn().mockResolvedValue(false) // Contraseña incorrecta
        }
        Arrendatario.findById = jest.fn().mockResolvedValue(mockArrendatario)

        const req = {
            arrendatarioBDD: { _id: '60c72b2f9b1d8b2bad888888' },
            body: {
                passwordactual: 'incorrecta123',
                passwordnuevo: 'nuevoPassword123'
            }
        }

        await actualizarPassword(req, res)

        expect(mockArrendatario.matchPassword).toHaveBeenCalledWith('incorrecta123')
        expect(res.status).toHaveBeenCalledWith(404)
        expect(res.json).toHaveBeenCalledWith({
            msg: "Lo sentimos, el password actual no es el correcto"
        })
    })

    // --- PRUEBA 3: ACTUALIZACIÓN EXITOSA ---
    test('Debe encriptar la nueva contraseña, guardarla en la BDD y responder con éxito 200', async () => {
        const mockSave = jest.fn().mockResolvedValue(true)
        const mockEncrypPassword = jest.fn().mockResolvedValue('new_hashed_password_xyz')
        const mockMatchPassword = jest.fn().mockResolvedValue(true) // Contraseña actual correcta

        const mockArrendatario = {
            _id: '60c72b2f9b1d8b2bad888888',
            password: 'old_hashed_password',
            matchPassword: mockMatchPassword,
            encrypPassword: mockEncrypPassword,
            save: mockSave
        }

        Arrendatario.findById = jest.fn().mockResolvedValue(mockArrendatario)

        const req = {
            arrendatarioBDD: { _id: '60c72b2f9b1d8b2bad888888' },
            body: {
                passwordactual: 'passwordActualOk',
                passwordnuevo: 'miNuevoPasswordSuperSeguro'
            }
        }

        await actualizarPassword(req, res)

        // 1. Validar que verificó la contraseña anterior
        expect(mockMatchPassword).toHaveBeenCalledWith('passwordActualOk')

        // 2. Validar que invocó el método de encriptación con la contraseña nueva
        expect(mockEncrypPassword).toHaveBeenCalledWith('miNuevoPasswordSuperSeguro')

        // 3. Verificar que la propiedad password de la instancia cambió al hash nuevo antes de guardar
        expect(mockArrendatario.password).toBe('new_hashed_password_xyz')

        // 4. Validar persistencia en la base de datos
        expect(mockSave).toHaveBeenCalled()

        // 5. Validar respuesta HTTP enviada al cliente
        expect(res.status).toHaveBeenCalledWith(200)
        expect(res.json).toHaveBeenCalledWith({
            msg: "Password actualizado correctamente"
        })
    })
})

// ==========================================
// SUITE DE PRUEBAS DE ARRENDATARIO
// ==========================================
describe('Gestión de categorías', () => {
    let res

    beforeEach(() => {
        jest.clearAllMocks()
        res = {
            status: jest.fn().mockReturnThis(),
            json: jest.fn()
        }
    })

    // --- PRUEBA 1: SIN AUTENTICACIÓN ---
    test('Debe retornar 401 si no existe el objeto arrendatarioBDD en la petición', async () => {
        const req = {
            req: {}, // Sin sesión activa
            query: {}
        }

        await listarDepartamentosArrendatario(req, res)

        expect(res.status).toHaveBeenCalledWith(401)
        expect(res.json).toHaveBeenCalledWith({ msg: "No autenticado" })
    })

    // --- PRUEBA 2: SIN PROPIEDADES DE DEPARTAMENTOS (ARREGLO VACÍO) ---
    test('Debe retornar 200 con un mensaje informativo si el arrendatario no tiene propiedades creadas', async () => {
        // Simulamos que find() devuelve un arreglo vacío
        Departamento.find = jest.fn().mockResolvedValue([])

        const req = {
            arrendatarioBDD: { _id: '60c72b2f9b1d8b2bad888888' },
            query: {}
        }

        await listarDepartamentosArrendatario(req, res)

        expect(Departamento.find).toHaveBeenCalledWith({ arrendatario: '60c72b2f9b1d8b2bad888888' })
        expect(res.status).toHaveBeenCalledWith(200)
        expect(res.json).toHaveBeenCalledWith({
            msg: "Aún no tienes ningún departamento vinculado a tu cuenta.",
            departamentos: []
        })
    })

    // --- PRUEBA 3: LISTAR TODOS EXITOSAMENTE ---
    test('Debe retornar 200 con la lista de departamentos vinculados al arrendatario', async () => {
        const mockDeps = [
            { titulo: 'Depa 1', arrendatario: '60c72b2f9b1d8b2bad888888' },
            { titulo: 'Depa 2', arrendatario: '60c72b2f9b1d8b2bad888888' }
        ]
        Departamento.find = jest.fn().mockResolvedValue(mockDeps)

        const req = {
            arrendatarioBDD: { _id: '60c72b2f9b1d8b2bad888888' },
            query: {} // Sin filtrar por categoría
        }

        await listarDepartamentosArrendatario(req, res)

        expect(Departamento.find).toHaveBeenCalledWith({ arrendatario: '60c72b2f9b1d8b2bad888888' })
        expect(res.status).toHaveBeenCalledWith(200)
        expect(res.json).toHaveBeenCalledWith(mockDeps)
    })

    // --- PRUEBA 4: FILTRADO DINÁMICO POR CATEGORÍA ---
    test('Debe incluir la categoría en el filtro de Mongoose si se envía en la query', async () => {
        const mockSuits = [{ titulo: 'Mini Suit', categoria: 'suit', arrendatario: '60c72b2f9b1d8b2bad888888' }]
        Departamento.find = jest.fn().mockResolvedValue(mockSuits)

        const req = {
            arrendatarioBDD: { _id: '60c72b2f9b1d8b2bad888888' },
            query: { categoria: 'suit' } // Filtrado activo
        }

        await listarDepartamentosArrendatario(req, res)

        expect(Departamento.find).toHaveBeenCalledWith({ 
            arrendatario: '60c72b2f9b1d8b2bad888888',
            categoria: 'suit' 
        })
        expect(res.status).toHaveBeenCalledWith(200)
        expect(res.json).toHaveBeenCalledWith(mockSuits)
    })

    // --- PRUEBA 5: MANEJO DE ERRORES (CATCH) ---
    test('Debe retornar 500 si ocurre un fallo en la consulta a la base de datos', async () => {
        Departamento.find = jest.fn().mockRejectedValue(new Error('Conexión perdida con Atlas'))

        const req = {
            arrendatarioBDD: { _id: '60c72b2f9b1d8b2bad888888' },
            query: {}
        }

        await listarDepartamentosArrendatario(req, res)

        expect(res.status).toHaveBeenCalledWith(500)
        expect(res.json).toHaveBeenCalledWith({
            msg: "Error al listar departamentos",
            error: "Conexión perdida con Atlas"
        })
    })
})