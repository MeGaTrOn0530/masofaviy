import { Router } from 'express';
import swaggerUi from 'swagger-ui-express';
import { openApiDocument } from './openapi.js';

const router = Router();

router.get('/openapi.json', (req, res) => {
  void req;
  res.json(openApiDocument);
});

router.use('/docs', swaggerUi.serve);
router.get('/docs', swaggerUi.setup(openApiDocument, {
  explorer: true,
  customSiteTitle: 'Meeting Backend Swagger',
}));

export default router;
