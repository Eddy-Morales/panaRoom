
import nodemailer from "nodemailer"
import dotenv from 'dotenv'
dotenv.config()


let transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
        user: process.env.USER_MAILTRAP,
        pass: process.env.PASS_MAILTRAP
    },
    tls: {
        rejectUnauthorized: false // Soluciona el error de "self-signed certificate"
    }
});


// Enviar correo de bienvenida con usuario y contraseña al arrendatario
const sendWelcomeMailArrendatario = async (userMail, usuario, password) => {
    let info = await transporter.sendMail({
        from: process.env.USER_MAILTRAP,
        to: userMail,
        subject: "¡Bienvenido a Pana Room! Tus credenciales de acceso",
        html: `
        <div style="font-family: Arial, sans-serif; background-color: #f4f4f4; padding: 20px; border-radius: 10px;">
            <h1 style="text-align:center; color:#2F8F9D;">🏡 Pana Room - Bienvenido</h1>
            <p style="font-size:16px; text-align:center;">¡Hola <b>${usuario}</b>! Tu cuenta ha sido creada exitosamente.</p>
            <p style="font-size:16px; text-align:center;">Aquí tienes tus credenciales de acceso:</p>
            <div style="text-align:center; margin: 20px 0;">
                <table style="margin: 0 auto; font-size:16px;">
                    <tr><td style="padding: 5px 10px; font-weight:bold;">Usuario (email):</td><td style="padding: 5px 10px;">${userMail}</td></tr>
                    <tr><td style="padding: 5px 10px; font-weight:bold;">Contraseña:</td><td style="padding: 5px 10px;">${password}</td></tr>
                </table>
            </div>
            <p style="font-size:15px; text-align:center; color:#888;">Te recomendamos cambiar tu contraseña después de iniciar sesión por primera vez.</p>
            <hr>
            <footer style="text-align:center; font-size:14px; color:#555;">
                El equipo de Pana Room te ayuda a encontrar el mejor alojamiento universitario. 🏡✨
            </footer>
        </div>
        `
    });
    console.log("Correo de bienvenida enviado satisfactoriamente:", info.messageId);
};

const sendMailToRegister = async (userMail, token) => {
    let mailOptions = {
        from: process.env.USER_MAILTRAP,
        to: userMail,
        subject: "Bienvenido a Pana Room - Encuentra tu espacio universitario 🏡",
        html: `
        <div style="font-family: Arial, sans-serif; background-color: #f4f4f4; padding: 20px; border-radius: 10px;">
            <h1 style="text-align:center; color:#2F8F9D;">🏡 Pana Room - Tu Plataforma de Alquiler Universitario</h1>
            <p style="font-size:16px; text-align:center;">¡Hola! Gracias por registrarte en Pana Room.</p>
            <p style="font-size:16px; text-align:center;">Para completar tu registro y empezar a gestionar alquileres, haz clic en el siguiente botón:</p>
            <div style="text-align:center; margin-top:15px;">
                <a href="${process.env.URL_FRONTEND}confirm/${token}" 
                style="background:#2F8F9D; color:white; padding:15px 30px; text-decoration:none; border-radius:5px; font-size:18px;">
                Confirmar mi cuenta
                </a>
            </div>
            <hr>
            <p style="color:#888; text-align:center;">Si no solicitaste este registro, puedes ignorar este mensaje.</p>
            <footer style="text-align:center; font-size:14px; color:#555;">
                El equipo de Pana Room te ayuda a encontrar el mejor alojamiento universitario. 🏡✨
            </footer>
        </div>
        `
    };

    try {
        let info = await transporter.sendMail(mailOptions);
        console.log("Correo de registro enviado satisfactoriamente:", info.messageId);
    } catch (error) {
        console.error("Error al enviar el correo de registro:", error);
    }
};

const sendMailToRecoveryPassword = async (userMail, token) => {
    let info = await transporter.sendMail({
        from: "admin@panaroom.com",
        to: userMail,
        subject: "Recuperación de contraseña - Pana Room 🔑",
        html: `
        <div style="font-family: Arial, sans-serif; background-color: #f4f4f4; padding: 20px; border-radius: 10px;">
            <h1 style="text-align:center; color:#2F8F9D;">🔑 Pana Room - Recuperación de Contraseña</h1>
            <p style="font-size:16px; text-align:center;">Hemos recibido una solicitud para restablecer tu contraseña.</p>
            <p style="font-size:16px; text-align:center;">Si fuiste tú quien solicitó el cambio, haz clic en el siguiente botón:</p>
            <div style="text-align:center; margin-top:15px;">
                <a href="${process.env.URL_FRONTEND}reset/${token}" 
                style="background:#2F8F9D; color:white; padding:15px 30px; text-decoration:none; border-radius:5px; font-size:18px;">
                Restablecer contraseña
                </a>
            </div>
            <hr>
            <p style="color:#888; text-align:center;">Si no solicitaste este cambio, puedes ignorar este mensaje.</p>
            <footer style="text-align:center; font-size:14px; color:#555;">
                El equipo de Pana Room está aquí para asistirte en tu experiencia de alquiler. 🔑🏡
            </footer>
        </div>
        `
    });

    console.log("Correo de recuperación de contraseña enviado satisfactoriamente:", info.messageId);
};


export {
    sendMailToRegister,
    sendMailToRecoveryPassword
    , sendWelcomeMailArrendatario
}