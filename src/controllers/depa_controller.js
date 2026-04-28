
import Departamento from "../models/Departamento.js"
import { v2 as cloudinary } from 'cloudinary';
import fs from 'fs-extra';
import mongoose from 'mongoose';
import { Stripe } from "stripe"

const stripe = new Stripe(`${process.env.STRIPE_PRIVATE_KEY}`);


// Asignar estudiante a un departamento
const asignarEstudianteADepartamento = async (req, res) => {
  const { departamentoId, estudianteId } = req.body;
  if (!mongoose.Types.ObjectId.isValid(departamentoId) || !mongoose.Types.ObjectId.isValid(estudianteId)) {
    return res.status(400).json({ msg: "ID de departamento o estudiante no válido" });
  }
  try {
    const departamento = await Departamento.findById(departamentoId);
    if (!departamento) {
      return res.status(404).json({ msg: "Departamento no encontrado" });
    }
    if (departamento.estudiante) {
      return res.status(400).json({ msg: "El departamento ya tiene un estudiante asignado" });
    }
    departamento.estudiante = estudianteId;
    await departamento.save();
    res.status(200).json({ msg: "Estudiante asignado correctamente al departamento", departamento });
  } catch (error) {
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

    // Validación de campos obligatorios (ajusta según tus requeridos)
    const camposObligatorios = ['titulo', 'descripcion', 'direccion', 'ciudad', 'precioMensual', 'numeroHabitaciones', 'numeroBanos', 'categoria'];
    for (const campo of camposObligatorios) {
      if (!req.body[campo] || req.body[campo] === "") {
        return res.status(400).json({ msg: `El campo ${campo} es obligatorio.` });
      }
    }

    const imagenesSubidas = [];

    // Subida de imágenes
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

    // Validación de alicuota y alicoutaMonto
    const alicuotaBool = alicuota === true || alicuota === 'true';
    if (alicuotaBool) {
      if (!alicoutaMonto || isNaN(alicoutaMonto)) {
        return res.status(400).json({ msg: "Debe ingresar el monto de la alícuota si escogió la opción de alícuota." });
      }
    }

    // Validación de parqueadero y numParqueaderos
    const parqueaderoBool = parqueadero === true || parqueadero === 'true';
    if (parqueaderoBool) {
      if (!numParqueaderos || isNaN(numParqueaderos) || Number(numParqueaderos) < 1) {
        return res.status(400).json({ msg: "Debe ingresar el número de parqueaderos si escogió la opción de parqueadero." });
      }
    }

    const nuevoDepartamento = new Departamento({
      ...req.body,
      imagenes: imagenesSubidas
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


const listarDepartamento = async (req,res)=>{
    const departamentos = await Departamento.find()
    res.status(200).json(departamentos)
}

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
    const departamento = await Departamento.findById(id);

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


export {

    registrarDepartamento,
    listarDepartamento,
    eliminarDepa,
    verDepartamentoPorId,
    pagarDepartamento,
    asignarEstudianteADepartamento
  }