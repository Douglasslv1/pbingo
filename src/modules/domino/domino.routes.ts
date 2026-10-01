import { createTableRouters } from '../tables/tables.routes';
import { dominoActionSchema, queueChoiceSchema } from './domino.schemas';

export const { router: dominoRouter, admin: adminDominoRouter } = createTableRouters('DOMINO', {
  queue: queueChoiceSchema,
  action: dominoActionSchema,
});
