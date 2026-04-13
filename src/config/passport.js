import passport from "passport";
import { Strategy as GoogleStrategy } from "passport-google-oauth20";
import Arrendatario from "../models/Arrendatario.js";
import { crearTokenJWT } from "../middlewares/JWT.js";

passport.use(
  new GoogleStrategy(
    {
      clientID: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
      callbackURL: "https://bakend-alquiler.onrender.com/api/auth/google/callback"

    },
    async (accessToken, refreshToken, profile, done) => {
      const email = profile.emails?.[0].value;
      const googleId = profile.id;

      try {
        let usuario = await Arrendatario.findOne({ email });

        if (!usuario) {
          usuario = await Arrendatario.create({
            nombre: profile.name.givenName,
            apellido: profile.name.familyName,
            email,
            confirmEmail: true,
            rol: "arrendatario",
            direccion: null,
            celular: null,
            googleId
          });
        }

        const token = crearTokenJWT(usuario._id, usuario.rol);
        return done(null, { token, usuario });
      } catch (error) {
        return done(error, null);
      }
    }
  )
);
