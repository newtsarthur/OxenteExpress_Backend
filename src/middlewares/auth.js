import jwt from 'jsonwebtoken';
import { ObjectId } from 'bson';

const JWT_SECRET = process.env.JWT_SECRET;

const auth = (req, res, next) => {
  const token = req.headers.authorization;

  if (!token) {
    return res.status(400).json({ message: "Acesso negado!" });
  }

  try {
    const decoded = jwt.verify(token.replace('Bearer ', ''), JWT_SECRET);
    const userId = decoded.id;

    // Verifica se o userId é um ObjectId válido
    if (!ObjectId.isValid(userId)) {
      return res.status(400).json({ message: "ID do usuário inválido." });
    }

    req.userId = userId; // Passa o userId para a próxima função
    next();
  } catch (error) {
    return res.status(401).json({ message: "Token Inválido" });
  }
};

export default auth;