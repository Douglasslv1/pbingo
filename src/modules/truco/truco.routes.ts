import { createTableRouters } from '../tables/tables.routes';
import { trucoActionSchema, trucoQueueSchema } from './truco.schemas';

export const { router: trucoRouter, admin: adminTrucoRouter } = createTableRouters('TRUCO', {
  queue: trucoQueueSchema,
  action: trucoActionSchema,
});
