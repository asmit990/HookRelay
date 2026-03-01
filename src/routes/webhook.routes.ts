import { Router } from 'express';
import {
  createWebhook,
  listWebhooks,
  updateWebhook,
  deleteWebhook,
  toggleWebhook
} from '../controllers/webhook.controller';
import { authMiddleware } from '../middleware/auth.middlerware';

const router = Router();

router.use(authMiddleware);

router.post('/',  createWebhook);

router.get('/', listWebhooks);

router.patch('/:id',  updateWebhook);

router.delete('/:id', deleteWebhook);

router.patch('/:id/toggle', toggleWebhook);

export default router;
