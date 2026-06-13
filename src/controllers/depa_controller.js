
import Departamento from "../models/Departamento.js"
import { v2 as cloudinary } from 'cloudinary';
import fs from 'fs-extra';
import mongoose from 'mongoose';
import { Stripe } from "stripe"
import Arrendatario from "../models/Arrendatario.js";
import ChatUsuarios from "../models/ChatUsuarios.js";
import QuejaSugerencias from "../models/Quejas_Sugerencias.js";

import Estudiante from "../models/Estudiante.js";

import { io } from '../index.js'; // Ajusta la ruta si es necesario



const stripe = new Stripe(`${process.env.STRIPE_PRIVATE_KEY}`);


// Asignar estudiante a un departamento
const asignarEstudianteADepartamento = async (req, res) => {
  const { departamentoId, estudianteId } = req.body;

  // 1. Validación de formato de los IDs
  if (!mongoose.Types.ObjectId.isValid(departamentoId) || !mongoose.Types.ObjectId.isValid(estudianteId)) {
    return res.status(400).json({ msg: "ID de departamento o estudiante no válido" });
  }

  try {
    // 2. Verificar si el estudiante existe en la colección "estudiantes"
    const estudianteExiste = await Estudiante.findById(estudianteId);
    if (!estudianteExiste) {
      return res.status(404).json({ msg: "El estudiante especificado no existe en el sistema" });
    }

    // 3. Buscar el departamento
    const departamento = await Departamento.findById(departamentoId);
    if (!departamento) {
      return res.status(404).json({ msg: "Departamento no encontrado" });
    }

    // 4. Verificar si ya cuenta con un inquilino asignado
    if (departamento.estudiante) {
      return res.status(400).json({ msg: "El departamento ya tiene un estudiante asignado" });
    }

    // 5. Vincular y guardar cambios de manera definitiva
    departamento.estudiante = estudianteId;
    await departamento.save();

    res.status(200).json({ 
      msg: "Estudiante asignado correctamente al departamento", 
      departamento 
    });

  } catch (error) {
    console.error("Error al asignar estudiante:", error);
    res.status(500).json({ msg: "Error al asignar estudiante", error: error.message });
  }
};


const registrarDepartamento = async (req, res) => {
  try {
    const { arrendatario, alicuota, alicoutaMonto, parqueadero, numParqueaderos } = req.body;

    // Validación básica de arrendatario
    if (!mongoose.Types.ObjectId.isValid(arrendatario)) {
      return res.status(400).json({ msg: "El ID del arrendatario no es válido." });
    }

    // Validación de campos obligatorios
    const camposObligatorios = [
      "titulo",
      "descripcion",
      "direccion",
      "precioMensual",
      "numeroHabitaciones",
      "numeroBanos",
      "categoria"
    ];

    for (const campo of camposObligatorios) {
      if (!req.body[campo] || req.body[campo] === "") {
        return res.status(400).json({ msg: `El campo ${campo} es obligatorio.` });
      }
    }


  // Título
  if (
    req.body.titulo.trim().length < 5 ||
    req.body.titulo.trim().length > 50
  ) {
    return res.status(400).json({
      msg: "El título debe tener entre 5 y 50 caracteres."
    });
  }

  // Descripción
  if (
    req.body.descripcion.trim().length < 10 ||
    req.body.descripcion.trim().length > 1000
  ) {
    return res.status(400).json({
      msg: "La descripción debe tener entre 10 y 1000 caracteres."
    });
  }

  // Dirección
  if (
    req.body.direccion.trim().length < 5 ||
    req.body.direccion.trim().length > 100
  ) {
    return res.status(400).json({
      msg: "La dirección debe tener entre 5 y 100 caracteres."
    });
  }

  // Precio
  if (
    isNaN(req.body.precioMensual) ||
    Number(req.body.precioMensual) <= 0
  ) {
    return res.status(400).json({
      msg: "El precio mensual debe ser un valor mayor a 0."
    });
  }

  // Habitaciones
  if (
    isNaN(req.body.numeroHabitaciones) ||
    Number(req.body.numeroHabitaciones) < 1
  ) {
    return res.status(400).json({
      msg: "Debe existir al menos una habitación."
    });
  }

  // Baños
  if (
    isNaN(req.body.numeroBanos) ||
    Number(req.body.numeroBanos) < 1
  ) {
    return res.status(400).json({
      msg: "Debe existir al menos un baño."
    });
  }

  // Categoría
  if (
    !["suit", "departamento"].includes(req.body.categoria)
  ) {
    return res.status(400).json({
      msg: "La categoría debe ser 'suit' o 'departamento'."
    });
  }

  // URL del mapa
  if (req.body.urlMapa) {
    try {
      new URL(req.body.urlMapa);
    } catch {
      return res.status(400).json({
        msg: "La URL del mapa no es válida."
      });
    }
  }

  // Al menos una imagen
  if (!req.files?.imagenes) {
    return res.status(400).json({
      msg: "Debe subir al menos una imagen del departamento."
    });
  }

  // Máximo 10 imágenes
  if (
    req.files?.imagenes &&
    (
      Array.isArray(req.files.imagenes)
        ? req.files.imagenes.length
        : 1
    ) > 10
  ) {
    return res.status(400).json({
      msg: "Solo se permiten hasta 10 imágenes."
    });
  }

    const imagenesSubidas = [];

    // Subida de imágenes del departamento
    if (req.files?.imagenes) {
      const archivos = Array.isArray(req.files.imagenes)
        ? req.files.imagenes
        : [req.files.imagenes];

      for (const archivo of archivos) {
        const { secure_url, public_id } = await cloudinary.uploader.upload(
          archivo.tempFilePath,
          { folder: "Departamentos" }
        );
        imagenesSubidas.push({ url: secure_url, public_id });
        await fs.unlink(archivo.tempFilePath);
      }
    }

    // Subida de QR del método de pago
    let qrPago = { url: null, public_id: null };
    if (req.files?.qrPago) {
      const resultadoQr = await cloudinary.uploader.upload(
        req.files.qrPago.tempFilePath,
        { folder: "Departamentos/QR" }
      );
      qrPago = {
        url: resultadoQr.secure_url,
        public_id: resultadoQr.public_id
      };
      await fs.unlink(req.files.qrPago.tempFilePath);
    }

    // Validación de alícuota y alicoutaMonto
    const alicuotaBool = alicuota === true || alicuota === "true";

    if (alicuotaBool) {
      if (
        !alicoutaMonto ||
        isNaN(alicoutaMonto) ||
        Number(alicoutaMonto) <= 0
      ) {
        return res.status(400).json({
          msg: "Debe ingresar un monto de alícuota válido mayor a 0."
        });
      }
    }

    // Validación de parqueadero y numParqueaderos
    const parqueaderoBool = parqueadero === true || parqueadero === "true";

    if (parqueaderoBool) {
      if (
        !numParqueaderos ||
        isNaN(numParqueaderos) ||
        Number(numParqueaderos) < 1 ||
        Number(numParqueaderos) > 10
      ) {
        return res.status(400).json({
          msg: "El número de parqueaderos debe estar entre 1 y 10."
        });
      }
    }

    // Construcción de metodoPago
    const metodoPago = {};

    if (req.body.metodoPago) {
      try {
        const metodoPagoParseado =
          typeof req.body.metodoPago === "string"
            ? JSON.parse(req.body.metodoPago)
            : req.body.metodoPago;

        if (metodoPagoParseado?.cuentaBancaria) {
          metodoPago.cuentaBancaria = metodoPagoParseado.cuentaBancaria;
        }
        if (metodoPagoParseado?.tipoCuenta) {
          metodoPago.tipoCuenta = metodoPagoParseado.tipoCuenta;
        }
        if (metodoPagoParseado?.tipoBanco) {
          metodoPago.tipoBanco = metodoPagoParseado.tipoBanco;
        }
        if (metodoPagoParseado?.numeroCedula) {
          metodoPago.numeroCedula = metodoPagoParseado.numeroCedula;
        }
      } catch (parseError) {
        return res.status(400).json({ msg: "El campo metodoPago no tiene un formato JSON válido." });
      }
    } else {
      if (req.body.cuentaBancaria) {
        metodoPago.cuentaBancaria = req.body.cuentaBancaria;
      }
      if (req.body.tipoCuenta) {
        metodoPago.tipoCuenta = req.body.tipoCuenta;
      }
      if (req.body.tipoBanco) {
        metodoPago.tipoBanco = req.body.tipoBanco;
      }
      if (req.body.numeroCedula) {
        metodoPago.numeroCedula = req.body.numeroCedula;
      }
    }

    if (qrPago.url) {
      metodoPago.qrPago = qrPago;
    }

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

    res.status(201).json({
      msg: "Departamento registrado exitosamente",
      departamento: nuevoDepartamento
    });
  } catch (error) {
    console.error("Error al registrar departamento:", error);
    res.status(500).json({ msg: "Error interno", error: error.message });
  }
};

const actualizarDepartamento = async (req, res) => {
  try {
    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ msg: "ID de departamento no válido" });
    }

    // Busca el departamento
    const departamento = await Departamento.findById(id);
    if (!departamento) {
      return res.status(404).json({ msg: "Departamento no encontrado" });
    }

    // Título
    if (req.body.titulo !== undefined) {
      if (
        req.body.titulo.trim().length < 5 ||
        req.body.titulo.trim().length > 50
      ) {
        return res.status(400).json({
          msg: "El título debe tener entre 5 y 50 caracteres."
        });
      }
    }

    // Descripción
    if (req.body.descripcion !== undefined) {
      if (
        req.body.descripcion.trim().length < 10 ||
        req.body.descripcion.trim().length > 1000
      ) {
        return res.status(400).json({
          msg: "La descripción debe tener entre 10 y 1000 caracteres."
        });
      }
    }

    // Dirección
    if (req.body.direccion !== undefined) {
      if (
        req.body.direccion.trim().length < 5 ||
        req.body.direccion.trim().length > 100
      ) {
        return res.status(400).json({
          msg: "La dirección debe tener entre 5 y 100 caracteres."
        });
      }
    }

    // Precio
    if (req.body.precioMensual !== undefined) {
      if (
        isNaN(req.body.precioMensual) ||
        Number(req.body.precioMensual) <= 0
      ) {
        return res.status(400).json({
          msg: "El precio mensual debe ser mayor a 0."
        });
      }
    }

    // Habitaciones
    if (req.body.numeroHabitaciones !== undefined) {
      if (
        isNaN(req.body.numeroHabitaciones) ||
        Number(req.body.numeroHabitaciones) < 1
      ) {
        return res.status(400).json({
          msg: "Debe existir al menos una habitación."
        });
      }
    }

    // Baños
    if (req.body.numeroBanos !== undefined) {
      if (
        isNaN(req.body.numeroBanos) ||
        Number(req.body.numeroBanos) < 1
      ) {
        return res.status(400).json({
          msg: "Debe existir al menos un baño."
        });
      }
    }

    // Categoría
    if (req.body.categoria !== undefined) {
      if (!["suit", "departamento"].includes(req.body.categoria)) {
        return res.status(400).json({
          msg: "La categoría debe ser 'suit' o 'departamento'."
        });
      }
    }

    // URL del mapa
    if (req.body.urlMapa !== undefined && req.body.urlMapa !== "") {
      try {
        new URL(req.body.urlMapa);
      } catch {
        return res.status(400).json({
          msg: "La URL del mapa no es válida."
        });
      }
    }

    // Alícuota
    if (
      req.body.alicuota === true ||
      req.body.alicuota === "true"
    ) {
      if (
        req.body.alicoutaMonto === undefined ||
        isNaN(req.body.alicoutaMonto) ||
        Number(req.body.alicoutaMonto) <= 0
      ) {
        return res.status(400).json({
          msg: "Debe ingresar un monto de alícuota válido mayor a 0."
        });
      }
    }

    // Parqueaderos
    if (
      req.body.parqueadero === true ||
      req.body.parqueadero === "true"
    ) {
      if (
        req.body.numParqueaderos === undefined ||
        isNaN(req.body.numParqueaderos) ||
        Number(req.body.numParqueaderos) < 1 ||
        Number(req.body.numParqueaderos) > 10
      ) {
        return res.status(400).json({
          msg: "El número de parqueaderos debe estar entre 1 y 10."
        });
      }
    }

  
    // Actualiza solo los campos enviados en el body
    const camposActualizables = [
      "titulo", "descripcion", "direccion", "categoria", "precioMensual",
      "numeroHabitaciones", "numeroBanos", "disponible", "serviciosIncluidos",
      "alicuota", "alicoutaMonto", "mascotas", "urlMapa", "referencia",
      "bodega", "parqueadero", "numParqueaderos", "guardiania"
    ];

    camposActualizables.forEach(campo => {
      if (req.body[campo] !== undefined) {
        departamento[campo] = req.body[campo];
      }
    });

    if (departamento.alicuota === false) {
      departamento.alicoutaMonto = null;
    }

    if (departamento.parqueadero === false) {
      departamento.numParqueaderos = 0;
    }

    // Actualizar metodoPago si viene en el body
    if (req.body.metodoPago) {
      departamento.metodoPago = {
        ...departamento.metodoPago,
        ...req.body.metodoPago
      };
    }

    if (
      departamento.metodoPago?.numeroCedula &&
      !/^\d{10}$/.test(departamento.metodoPago.numeroCedula)
    ) {
      return res.status(400).json({
        msg: "La cédula debe contener exactamente 10 dígitos."
      });
    }

    if (
      departamento.metodoPago?.cuentaBancaria &&
      !/^\d+$/.test(departamento.metodoPago.cuentaBancaria)
    ) {
      return res.status(400).json({
        msg: "La cuenta bancaria solo debe contener números."
      });
    }

    // Actualizar imagen QR de pago si se envía un archivo
    if (req.files?.qrPago) {
      // Elimina la imagen QR anterior de Cloudinary si existe
      if (departamento.metodoPago?.qrPago?.public_id) {
        await cloudinary.uploader.destroy(departamento.metodoPago.qrPago.public_id);
      }
      // Sube la nueva imagen QR
      const resultado = await cloudinary.uploader.upload(req.files.qrPago.tempFilePath, {
        folder: "Departamentos/QR"
      });
      departamento.metodoPago.qrPago = {
        url: resultado.secure_url,
        public_id: resultado.public_id
      };
      await fs.unlink(req.files.qrPago.tempFilePath);
    }

    // Actualización de imágenes (si se envían nuevas imágenes)
    if (req.files?.imagenes) {
      // Elimina imágenes antiguas de Cloudinary
      for (const img of departamento.imagenes) {
        if (img.public_id) {
          await cloudinary.uploader.destroy(img.public_id);
        }
      }

      // Sube nuevas imágenes
      const archivos = Array.isArray(req.files.imagenes)
        ? req.files.imagenes
        : [req.files.imagenes];

      const nuevasImagenes = [];
      for (const archivo of archivos) {
        const { secure_url, public_id } = await cloudinary.uploader.upload(
          archivo.tempFilePath,
          { folder: "Departamentos" }
        );
        nuevasImagenes.push({ url: secure_url, public_id });
        await fs.unlink(archivo.tempFilePath);
      }
      departamento.imagenes = nuevasImagenes;
    }

    await departamento.save();
    res.status(200).json({ msg: "Departamento actualizado correctamente", departamento });
  } catch (error) {
    res.status(500).json({ msg: "Error al actualizar el departamento", error: error.message });
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

const eliminarDepa = async (req, res) => {
    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
        return res.status(400).json({ msg: "ID de departamento no válido" });
    }
    const depaEliminado = await Departamento.findByIdAndDelete(id);
    if (!depaEliminado) {
        return res.status(404).json({ msg: "Departamento no encontrado" });
    }
    res.status(200).json({ msg: "Departamento eliminado correctamente" });
};

const verDepartamentoPorId = async (req, res) => {
  const { id } = req.params;

  // Validar ID
  if (!mongoose.Types.ObjectId.isValid(id)) {
    return res.status(400).json({ msg: "ID de departamento no válido." });
  }

  try {
    // Popula la información del arrendatario
    const departamento = await Departamento.findById(id).populate('arrendatario');

    if (!departamento) {
      return res.status(404).json({ msg: "Departamento no encontrado." });
    }

    res.status(200).json(departamento);
  } catch (error) {
    console.error("Error al obtener departamento:", error);
    res.status(500).json({ msg: "Error interno", error: error.message });
  }
};


const pagarDepartamento = async (req, res) => {
  const { paymentMethodId, departamentoId, cantidad, motivo } = req.body;

  try {
    const departamento = await Departamento.findById(departamentoId).populate('arrendatario');
    if (!departamento) return res.status(404).json({ message: "Departamento no encontrado" });
    if (!departamento.disponible) return res.status(400).json({ message: "Este departamento ya está ocupado" });
    if (!paymentMethodId) return res.status(400).json({ message: "paymentMethodId no proporcionado" });

    const emailCliente = departamento.arrendatario?.email || "sin-email@ejemplo.com";
    const nombreCliente = departamento.arrendatario?.nombre || "Arrendatario";

    let [cliente] = (await stripe.customers.list({ email: emailCliente, limit: 1 })).data || [];

    if (!cliente) {
      cliente = await stripe.customers.create({ name: nombreCliente, email: emailCliente });
    }

    const payment = await stripe.paymentIntents.create({
      amount: cantidad,
      currency: "USD",
      description: motivo,
      payment_method: paymentMethodId,
      confirm: true,
      customer: cliente.id,
      automatic_payment_methods: {
        enabled: true,
        allow_redirects: "never"
      }
    });

    if (payment.status === "succeeded") {
      await Departamento.findByIdAndUpdate(departamentoId, { disponible: false });
      return res.status(200).json({ msg: "Pago exitoso. El departamento ahora está marcado como no disponible." });
    }

    res.status(400).json({ msg: "El pago no se completó correctamente", status: payment.status });
  } catch (error) {
    res.status(500).json({ msg: "Error al intentar pagar el departamento", error });
  }
};

const quitarEstudianteDeDepartamento = async (req, res) => {
  const { departamentoId } = req.body;
  if (!mongoose.Types.ObjectId.isValid(departamentoId)) {
    return res.status(400).json({ msg: "ID de departamento no válido" });
  }
  try {
    const departamento = await Departamento.findById(departamentoId);
    if (!departamento) {
      return res.status(404).json({ msg: "Departamento no encontrado" });
    }
    if (!departamento.estudiante) {
      return res.status(400).json({ msg: "El departamento no tiene un estudiante asignado" });
    }
    departamento.estudiante = null;
    await departamento.save();
    res.status(200).json({ msg: "Estudiante removido del departamento correctamente", departamento });
  } catch (error) {
    res.status(500).json({ msg: "Error al quitar estudiante", error: error.message });
  }
};
// Cambiar el estado de disponibilidad de un departamento (solo por ID)
const cambiarDisponibilidadDepartamento = async (req, res) => {
  try {
    const { departamentoId } = req.body; // o req.params, según la ruta que definas
    const { disponible } = req.body; // true o false

    if (!mongoose.Types.ObjectId.isValid(departamentoId)) {
      return res.status(400).json({ msg: "ID de departamento no válido" });
    }
    if (typeof disponible !== "boolean") {
      return res.status(400).json({ msg: "El campo 'disponible' debe ser booleano (true o false)" });
    }

    const departamento = await Departamento.findById(departamentoId);
    if (!departamento) {
      return res.status(404).json({ msg: "Departamento no encontrado" });
    }

    departamento.disponible = disponible;
    await departamento.save();

    res.status(200).json({ msg: "Disponibilidad actualizada correctamente", departamento });
  } catch (error) {
    res.status(500).json({ msg: "Error al actualizar la disponibilidad", error: error.message });
  }
};

const registrarMensajeChat = async (req, res) => {
  try {
    const { mensaje, remitente, administradorId, arrendatarioId, estudianteId, departamentoId } = req.body;

    // Validación básica
    if (!mensaje || !remitente) {
      return res.status(400).json({ msg: "El mensaje y el remitente son obligatorios" });
    }
    if (!["administrador", "arrendatario", "estudiante"].includes(remitente)) {
      return res.status(400).json({ msg: "El remitente debe ser administrador, arrendatario o estudiante" });
    }

    // Al menos uno de los IDs debe estar presente
    if (!administradorId && !arrendatarioId && !estudianteId) {
      return res.status(400).json({ msg: "Debe especificar al menos un ID de usuario" });
    }

    // Crea el mensaje
    const nuevoMensaje = new ChatUsuarios({
      mensaje,
      remitente,
      administradorId: administradorId || null,
      arrendatarioId: arrendatarioId || null,
      estudianteId: estudianteId || null,
      departamentoId: departamentoId || null
    });

    await nuevoMensaje.save();

    // Emitir el mensaje a todos los clientes (puedes filtrar por destinatario si lo deseas)
    io.emit('nuevo-mensaje-chat', nuevoMensaje);

    res.status(201).json({ msg: "Mensaje registrado correctamente", chat: nuevoMensaje });
  } catch (error) {
    res.status(500).json({ msg: "Error al registrar el mensaje", error: error.message });
  }
};

// Actualizar comentarioUsuario
const actualizarComentarioUsuario = async (req, res) => {
  try {
    const { id, comentarioUsuario } = req.body;
    if (!id) {
      return res.status(400).json({ msg: "El id es obligatorio" });
    }
    if (!comentarioUsuario) {
      return res.status(400).json({ msg: "El comentarioUsuario es obligatorio" });
    }
    const queja = await QuejaSugerencias.findById(id);
    if (!queja) {
      return res.status(404).json({ msg: "Queja/Sugerencia no encontrada" });
    }
    queja.comentarioUsuario = comentarioUsuario;
    await queja.save();
    res.status(200).json({ msg: "Comentario actualizado correctamente", queja });
  } catch (error) {
    res.status(500).json({ msg: "Error al actualizar el comentario", error: error.message });
  }
};



// Actualizar calificacion
const actualizarCalificacion = async (req, res) => {
  try {
    const { id, calificacion } = req.body;
    if (!id) {
      return res.status(400).json({ msg: "El id es obligatorio" });
    }
    if (typeof calificacion !== "number" || calificacion < 0) {
      return res.status(400).json({ msg: "La calificación debe ser un número positivo" });
    }
    const queja = await QuejaSugerencias.findById(id);
    if (!queja) {
      return res.status(404).json({ msg: "Queja/Sugerencia no encontrada" });
    }
    queja.calificacion = calificacion;
    await queja.save();
    res.status(200).json({ msg: "Calificación actualizada correctamente", queja });
  } catch (error) {
    res.status(500).json({ msg: "Error al actualizar la calificación", error: error.message });
  }
};
const listarChats = async (req, res) => {
  try {
    // Obtén los IDs desde los query params
    const { arrendatarioId, estudianteId, administradorId } = req.query;

    // Construye el filtro dinámicamente según los parámetros recibidos
    let filtro = {};

    // Conversación entre estudiante y arrendatario
    if (arrendatarioId && estudianteId) {
      filtro = {
        $or: [
          { arrendatarioId, estudianteId },
          { arrendatarioId, estudianteId }
        ]
      };
    }
    // Conversación entre arrendatario y administrador
    else if (arrendatarioId && administradorId) {
      filtro = {
        $or: [
          { arrendatarioId, administradorId },
          { arrendatarioId, administradorId }
        ]
      };
    }
    // Conversación entre estudiante y administrador
    else if (estudianteId && administradorId) {
      filtro = {
        $or: [
          { estudianteId, administradorId },
          { estudianteId, administradorId }
        ]
      };
    }
    // Si solo hay un ID, filtra por ese usuario (todos sus mensajes)
    else if (arrendatarioId) {
      filtro = { arrendatarioId };
    } else if (estudianteId) {
      filtro = { estudianteId };
    } else if (administradorId) {
      filtro = { administradorId };
    }

    const chats = await ChatUsuarios.find(filtro)
      .populate('administradorId', 'nombre apellido email')
      .populate('arrendatarioId', 'nombre apellido email')
      .populate('estudianteId', 'nombre apellido email')
      .sort({ createdAt: 1 });

    res.status(200).json(chats);
  } catch (error) {
    res.status(500).json({ msg: "Error al listar los chats", error: error.message });
  }
};


const listarContactosChat = async (req, res) => {
  try {
    const { arrendatarioId, estudianteId, administradorId } = req.query;

    // El usuario debe enviar su propio ID (uno de los tres)
    let filtro = {};
    if (arrendatarioId) filtro.arrendatarioId = arrendatarioId;
    else if (estudianteId) filtro.estudianteId = estudianteId;
    else if (administradorId) filtro.administradorId = administradorId;
    else return res.status(400).json({ msg: "Debes enviar tu ID de usuario" });

    // Busca todos los mensajes donde el usuario es remitente o destinatario
    const chats = await ChatUsuarios.find(filtro)
      .populate('administradorId', 'nombre apellido email')
      .populate('arrendatarioId', 'nombre apellido email')
      .populate('estudianteId', 'nombre apellido email');

    // Extrae los contactos únicos
    const contactos = new Map();
    chats.forEach(chat => {
      // Si el usuario es arrendatario, agrega estudiantes y administradores con los que ha chateado
      if (arrendatarioId) {
        if (chat.estudianteId && chat.estudianteId._id.toString() !== arrendatarioId) {
          contactos.set(chat.estudianteId._id.toString(), {
            tipo: 'estudiante',
            ...chat.estudianteId._doc
          });
        }
        if (chat.administradorId && chat.administradorId._id.toString() !== arrendatarioId) {
          contactos.set(chat.administradorId._id.toString(), {
            tipo: 'administrador',
            ...chat.administradorId._doc
          });
        }
      }
      // Si el usuario es estudiante, agrega arrendatarios y administradores
      if (estudianteId) {
        if (chat.arrendatarioId && chat.arrendatarioId._id.toString() !== estudianteId) {
          contactos.set(chat.arrendatarioId._id.toString(), {
            tipo: 'arrendatario',
            ...chat.arrendatarioId._doc
          });
        }
        if (chat.administradorId && chat.administradorId._id.toString() !== estudianteId) {
          contactos.set(chat.administradorId._id.toString(), {
            tipo: 'administrador',
            ...chat.administradorId._doc
          });
        }
      }
      // Si el usuario es administrador, agrega arrendatarios y estudiantes
      if (administradorId) {
        if (chat.arrendatarioId && chat.arrendatarioId._id.toString() !== administradorId) {
          contactos.set(chat.arrendatarioId._id.toString(), {
            tipo: 'arrendatario',
            ...chat.arrendatarioId._doc
          });
        }
        if (chat.estudianteId && chat.estudianteId._id.toString() !== administradorId) {
          contactos.set(chat.estudianteId._id.toString(), {
            tipo: 'estudiante',
            ...chat.estudianteId._doc
          });
        }
      }
    });

    res.status(200).json(Array.from(contactos.values()));
  } catch (error) {
    res.status(500).json({ msg: "Error al listar los contactos de chat", error: error.message });
  }
};

const listarComentariosDepartamento = async (req, res) => {
  try {
    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ msg: "ID de departamento no válido" });
    }

    const comentarios = await QuejaSugerencias.find({ departamento: id })
      .populate("usuario", "nombre apellido email")
      .populate("arrendatarioId", "nombre apellido email")
      .sort({ fecha: -1 });

    res.status(200).json(comentarios);
  } catch (error) {
    res.status(500).json({ msg: "Error al listar los comentarios", error: error.message });
  }
};
export {

    registrarDepartamento,
    listarDepartamento,
    eliminarDepa,
    verDepartamentoPorId,
    pagarDepartamento,
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
  }