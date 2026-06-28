import { jest } from '@jest/globals';

// 1. Definir mocks inestables para ES Modules ANTES de importar lo demás
// 1. Definir mocks inestables para ES Modules ANTES de importar lo demás
jest.unstable_mockModule('../src/models/Arrendatario.js', () => {
  // Creamos una función simulada que actúe como constructor
  const MockArrendatario = jest.fn().mockImplementation(() => ({
    save: jest.fn().mockResolvedValue({})
  }));
  
  // Le añadimos el método estático findOne a esa misma función
  MockArrendatario.findOne = jest.fn();
  
  return {
    __esModule: true,
    default: MockArrendatario
  };
});

jest.unstable_mockModule('cloudinary', () => ({
  v2: {
    uploader: {
      upload: jest.fn()
    }
  }
}));

jest.unstable_mockModule('fs-extra', () => ({
  __esModule: true,
  default: {
    unlink: jest.fn(),
    pathExists: jest.fn()
  }
}));

// 2. Importaciones de librerías y utilitarios
import request from 'supertest';
import express from 'express';

// 3. Importaciones dinámicas de tus archivos locales para que respeten los mocks
const { crearArrendatario } = await import('../src/controllers/arrendatario_controller.js');
const { default: Arrendatario } = await import('../src/models/Arrendatario.js');
const { v2: cloudinary } = await import('cloudinary');
const { default: fs } = await import('fs-extra');

// 4. Configurar la app Express ficticia
const app = express();
app.use(express.json());

// Middleware simulador para interceptar peticiones multipart en los tests
app.use((req, res, next) => {
  // Cuando usamos .field() y .attach() en supertest, Express sin middlewares multipart lo ve vacío.
  // Interceptamos la petición para popular req.body y req.files dinámicamente según el caso de uso.
  if (req.method === 'POST') {
    // Caso de éxito: pasamos datos válidos si viene del test de creación exitosa
    if (!req.body || Object.keys(req.body).length === 0) {
      req.body = {
        nombre: 'Juan',
        apellido: 'Pérez',
        direccion: 'Av. Amazonas y Colón',
        celular: '0987654321',
        email: 'juan.perez@gmail.com'
      };
    }
    
    // Inyectamos el archivo simulado para que no cause undefined en el controlador
    req.files = {
      imagenesDocumentos: {
        name: 'cedula.png',
        mimetype: 'image/png',
        tempFilePath: '/tmp/cedula.png'
      }
    };
  }
  next();
});

app.post('/api/arrendatario', crearArrendatario);

// 5. Bloque de Pruebas unitarias/integración
describe('Pruebas para crearArrendatario', () => {
  
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('Debería crear un arrendatario exitosamente con datos válidos y archivos', async () => {
    // Simular que el correo NO existe en la base de datos
    Arrendatario.findOne.mockResolvedValue(null);
    
    // Simular el guardado exitoso en MongoDB
    Arrendatario.prototype.save = jest.fn().mockResolvedValue({
      _id: 'mockId123',
      nombre: 'Juan',
      apellido: 'Pérez',
      direccion: 'Av. Amazonas y Colón',
      celular: '0987654321',
      email: 'juan.perez@gmail.com',
      imagenesDocumentos: [{ url: 'https://cloudinary.com/doc.png', public_id: '123' }]
    });

    // Simular la subida exitosa a Cloudinary
    cloudinary.uploader.upload.mockResolvedValue({
      secure_url: 'https://cloudinary.com/doc.png',
      public_id: '123'
    });

    // Simular que fs-extra maneja la limpieza correctamente
    fs.unlink.mockResolvedValue(true);

    const response = await request(app)
      .post('/api/arrendatario')
      .field('nombre', 'Juan')
      .field('apellido', 'Pérez')
      .field('direccion', 'Av. Amazonas y Colón')
      .field('celular', '0987654321')
      .field('email', 'juan.perez@gmail.com')
      .attach('imagenesDocumentos', Buffer.from('fake-image-content'), {
        filename: 'cedula.png',
        contentType: 'image/png'
      });

    expect(response.status).toBe(201);
    expect(response.body.msg).toContain('Datos enviados exitosamente');
    expect(Arrendatario.findOne).toHaveBeenCalledWith({ email: 'juan.perez@gmail.com' });
    expect(cloudinary.uploader.upload).toHaveBeenCalled();
  });

  test('Debería retornar 400 si el número celular ecuatoriano es inválido', async () => {
    const response = await request(app)
      .post('/api/arrendatario')
      .send({
        nombre: 'Juan',
        apellido: 'Pérez',
        direccion: 'Av. Amazonas y Colón',
        celular: '022345678', // Formato convencional, gatilla la validación del Regex /^09\d{8}$/
        email: 'juan.perez@gmail.com'
      });

    expect(response.status).toBe(400);
    expect(response.body.msg).toBe('Ingrese un número celular ecuatoriano válido');
  });

  test('Debería retornar 409 si el correo ya se encuentra registrado', async () => {
    // Simular que findOne SÍ encuentra un arrendatario duplicado en la DB
    Arrendatario.findOne.mockResolvedValue({ email: 'juan.perez@gmail.com' });

    const response = await request(app)
      .post('/api/arrendatario')
      .send({
        nombre: 'Juan',
        apellido: 'Pérez',
        direccion: 'Av. Amazonas y Colón',
        celular: '0987654321',
        email: 'juan.perez@gmail.com'
      });

    expect(response.status).toBe(409);
    expect(response.body.msg).toBe('El email ya está registrado');
  });
});