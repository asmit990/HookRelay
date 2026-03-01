import { Router } from 'express';
import { registerHandler, loginHandler, meHandler } from '../controllers/auth.controller';
import { authMiddleware } from '../middleware/auth.middlerware';

const router = Router();

router.post('/register', registerHandler);

router.post('/login', loginHandler);

router.get('/me', authMiddleware, meHandler);

export default router;
